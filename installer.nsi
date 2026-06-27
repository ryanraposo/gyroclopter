; Gyroclopter NSIS installer
; Run: makensis /DVERSION=x.y.z /DPRODUCT_VERSION=x.y.z installer.nsi

!include "MUI2.nsh"

!ifndef VERSION
  !define VERSION "0.0.0"
!endif

!ifndef PRODUCT_VERSION
  !define PRODUCT_VERSION "${VERSION}"
!endif

Name "Gyroclopter ${VERSION}"
OutFile "dist\gyroclopter-setup-${VERSION}.exe"
InstallDir "$PROGRAMFILES64\Gyroclopter"
InstallDirRegKey HKLM "Software\Gyroclopter" "InstallDir"
RequestExecutionLevel admin
ShowInstDetails show

!define MUI_ABORTWARNING
!define MUI_ICON "build\icon.ico"
!define MUI_UNICON "build\icon.ico"

!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

!insertmacro MUI_LANGUAGE "English"

Section "Gyroclopter (required)"
  SectionIn RO
  SetOutPath "$INSTDIR"

  ; The pkg-built binary, renamed to gyroclopter.exe at install time.
  File "dist\gyroclopter-${VERSION}.exe"
  Rename "$INSTDIR\gyroclopter-${VERSION}.exe" "$INSTDIR\gyroclopter.exe"

  ; Store install dir and version in HKLM.
  WriteRegStr HKLM "Software\Gyroclopter" "InstallDir" "$INSTDIR"
  WriteRegStr HKLM "Software\Gyroclopter" "Version" "${VERSION}"

  ; Register uninstaller.
  WriteUninstaller "$INSTDIR\Uninstall.exe"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\Gyroclopter" \
    "DisplayName" "Gyroclopter"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\Gyroclopter" \
    "DisplayVersion" "${VERSION}"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\Gyroclopter" \
    "Publisher" "Ryan Raposo"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\Gyroclopter" \
    "InstallLocation" "$INSTDIR"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\Gyroclopter" \
    "UninstallString" "$\"$INSTDIR\Uninstall.exe$\""
SectionEnd

Section "Uninstall"
  Delete "$INSTDIR\gyroclopter.exe"
  Delete "$INSTDIR\Uninstall.exe"
  RMDir "$INSTDIR"

  DeleteRegKey HKLM "Software\Gyroclopter"
  DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\Gyroclopter"
SectionEnd
