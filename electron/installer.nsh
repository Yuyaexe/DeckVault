; Preserve the standard running-app checks, then discard only regenerable images.
; NSIS moves old files under $PLUGINSDIR during upgrades. Next image cache names
; can fit in $INSTDIR but exceed MAX_PATH in that longer temporary directory.
!include "getProcessInfo.nsh"
Var pid

!macro DeckVaultRemoveImageCache DIRECTORY
  ${If} ${FileExists} "${DIRECTORY}\resources\.next\standalone\server.js"
  ${AndIf} ${FileExists} "${DIRECTORY}\resources\.next\standalone\.next\cache\images\*.*"
    ClearErrors
    RMDir /r "\\?\${DIRECTORY}\resources\.next\standalone\.next\cache\images"
    ${If} ${Errors}
      MessageBox MB_OK|MB_ICONEXCLAMATION "Não foi possível limpar o cache de imagens do DeckVault. Feche o programa e tente novamente."
      SetErrorLevel 2
      Quit
    ${EndIf}
  ${EndIf}
!macroend

!macro customCheckAppRunning
  !insertmacro IS_POWERSHELL_AVAILABLE
  !insertmacro _CHECK_APP_RUNNING
  !insertmacro DeckVaultRemoveImageCache "$INSTDIR"
!macroend
