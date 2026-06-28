; Gyroclopter NSIS installer
!include "MUI2.nsh"

!ifndef VERSION
  !define VERSION "0.0.0"
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

  ; Create the Neutralino runtime folder
  SetOutPath "$INSTDIR\gyroclopter"

  ; Install the entire Neutralino build folder WITH structure
  File /r "dist\gyroclopter\*.*"

  ; Shortcut points to the real Neutralino runtime
  CreateDirectory "$SMPROGRAMS\Gyroclopter"
  CreateShortCut "$SMPROGRAMS\Gyroclopter\Gyroclopter.lnk" "$INSTDIR\gyroclopter\gyroclopter-win_x64.exe"

  ; Registry entries
  WriteRegStr HKLM "Software\Gyroclopter" "InstallDir" "$INSTDIR"
  WriteRegStr HKLM "Software\Gyroclopter" "Version" "${VERSION}"

  ; Uninstaller
  WriteUninstaller "$INSTDIR\Uninstall.exe"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\Gyroclopter" "DisplayName" "Gyroclopter"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\Gyroclopter" "DisplayVersion" "${VERSION}"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\Gyroclopter" "Publisher" "Ryan Raposo"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\Gyroclopter" "InstallLocation" "$INSTDIR"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\Gyroclopter" "UninstallString" "$\"$INSTDIR\Uninstall.exe$\""
SectionEnd

Section "Uninstall"
  Delete "$SMPROGRAMS\Gyroclopter\Gyroclopter.lnk"
  RMDir "$SMPROGRAMS\Gyroclopter"

  RMDir /r "$INSTDIR\gyroclopter"
  Delete "$INSTDIR\Uninstall.exe"
  RMDir "$INSTDIR"

  DeleteRegKey HKLM "Software\Gyroclopter"
  DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\Gyroclopter"
SectionEnd
