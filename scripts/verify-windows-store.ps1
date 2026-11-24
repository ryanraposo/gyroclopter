param([string]$PackageDirectory = 'dist/store')

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem

$packages = @(Get-ChildItem -LiteralPath $PackageDirectory -Filter '*-windows-store-x64.appx')
if ($packages.Count -ne 1) { throw 'Expected exactly one x64 Store package.' }
$identityJson = node -p "JSON.stringify(require('./scripts/windows-store-config').getWindowsStoreIdentity())"
if ($LASTEXITCODE -ne 0) { throw 'Could not load the expected package identity.' }
$expected = $identityJson | ConvertFrom-Json

$archive = [IO.Compression.ZipFile]::OpenRead($packages[0].FullName)
$extractDir = Join-Path ([IO.Path]::GetTempPath()) ([Guid]::NewGuid().ToString())
New-Item -ItemType Directory $extractDir | Out-Null
try {
  $reader = [IO.StreamReader]::new($archive.GetEntry('AppxManifest.xml').Open())
  try { [xml]$manifest = $reader.ReadToEnd() } finally { $reader.Dispose() }

  $identity = $manifest.Package.Identity
  $version = node -p "require('./package.json').version + '.0'"
  if ($identity.Name -cne $expected.identityName -or
      $identity.Publisher -cne $expected.publisher -or
      $manifest.Package.Properties.PublisherDisplayName -cne $expected.publisherDisplayName -or
      $identity.Version -cne $version -or
      $identity.ProcessorArchitecture -ne 'x64') {
    throw 'The manifest does not match the expected Store identity, version, or architecture.'
  }
  $application = $manifest.Package.Applications.Application
  $capabilities = @($manifest.Package.Capabilities.ChildNodes |
    Where-Object NodeType -eq 'Element' | ForEach-Object { $_.GetAttribute('Name') })
  if ($application.Id -cne 'Gyroclopter' -or
      $application.EntryPoint -cne 'Windows.FullTrustApplication' -or
      $capabilities.Count -ne 1 -or $capabilities[0] -cne 'runFullTrust') {
    throw 'Unexpected Store entry point or capabilities.'
  }

  $entries = @{}
  foreach ($entry in $archive.Entries) { $entries[($entry.FullName -replace '\\', '/')] = $entry }
  $required = @(
    ($application.Executable -replace '\\', '/'),
    'assets/StoreLogo.png',
    'assets/Square44x44Logo.png',
    'assets/Square150x150Logo.png',
    'assets/Wide310x150Logo.png'
  )
  foreach ($name in $required) {
    if (!$entries.ContainsKey($name)) { throw "Missing packaged file $name" }
  }
  $asarEntry = @($entries.Keys | Where-Object { $_ -match '(^|/)resources/app\.asar$' })
  $helperEntry = @($entries.Keys | Where-Object { $_ -match '(^|/)resources/native/gyroclopter-mouse\.exe$' })
  if ($asarEntry.Count -ne 1 -or $helperEntry.Count -ne 1) {
    throw 'Expected an app archive and the native Store mouse helper.'
  }

  $asar = Join-Path $extractDir 'app.asar'
  $helper = Join-Path $extractDir 'gyroclopter-mouse.exe'
  [IO.Compression.ZipFileExtensions]::ExtractToFile($entries[$asarEntry[0]], $asar)
  [IO.Compression.ZipFileExtensions]::ExtractToFile($entries[$helperEntry[0]], $helper)
  node -e "const asar = require('@electron/asar'); const p = process.argv[1]; if (JSON.parse(asar.extractFile(p, 'package.json')).gyroclopterEdition !== 'store' || !asar.statFile(p, 'platforms/desktop/windows/store-input.js')) process.exit(1)" $asar
  if ($LASTEXITCODE -ne 0) { throw 'The packaged app is missing Store metadata or the input backend.' }
  $result = & $helper --self-test
  if ($LASTEXITCODE -ne 0 -or $result -ne 'SELF_TEST_OK') { throw 'Native mouse helper self-test failed.' }
  Write-Host 'Store manifest, branding, runtime files and mouse helper verified.'
} finally {
  $archive.Dispose()
  Remove-Item -LiteralPath $extractDir -Recurse -Force
}
