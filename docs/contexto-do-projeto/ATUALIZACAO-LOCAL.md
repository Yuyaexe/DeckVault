# Atualização pelos arquivos locais

A partir da versão 0.2.15, o aplicativo Windows oferece **Configurações → Atualizar pela pasta DeckVault**.

Na primeira vez, selecione a pasta que contém o código do projeto e o arquivo `package.json`. A escolha fica salva no perfil do aplicativo. Use **Trocar pasta** se mover o projeto.

O botão compila as alterações salvas, gera um instalador Windows e só então fecha o DeckVault. Um assistente separado copia o perfil inteiro para `%APPDATA%\DeckVault Backups`, verifica os arquivos com SHA-256, instala a atualização e reabre o programa. Se o backup não puder ser verificado, a instalação é interrompida. Os backups ficam preservados.

O fluxo aceita recompilar a mesma versão e rejeita uma versão anterior à instalada. Não publica arquivos no GitHub e não modifica o número da versão no projeto.

## Requisitos

- Node.js 22 ou mais recente instalado no Windows.
- Dependências do projeto presentes em `node_modules`; se faltarem, execute `npm ci` na pasta do projeto.
- Internet pode ser necessária para o empacotador baixar ferramentas do Windows.
- Mantenha o DeckVault aberto enquanto a compilação estiver em andamento e evite compilar a mesma pasta por outro programa simultaneamente.

## Em caso de falha

Uma falha na compilação mantém o aplicativo instalado aberto. Consulte **Ver log** nas Configurações. Se houver uma falha depois do fechamento, o assistente tenta reabrir o aplicativo e abre um relatório de erro. Logs e o instalador gerado ficam em uma pasta `deckvault-local-update-*` dentro de `%TEMP%`.

O botão aplica o código que já existe na pasta; ele não cria novas funcionalidades por conta própria.
