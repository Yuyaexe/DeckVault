# Falha de atualização do Windows — 0.2.11

## Reprodução

A instalação 0.2.9 continha uma imagem otimizada em um caminho de 259 caracteres dentro de `resources/.next/standalone/.next/cache/images`. O NSIS move arquivos para `$PLUGINSDIR/old-install` antes de removê-los. Esse prefixo torna o destino longo demais para sua operação Rename.

Uma cópia da instalação foi usada com as funções `un.atomicRMDir` e `un.restoreFiles` do electron-builder 26.15.3. A rotina falhou precisamente na imagem em cache. Remover somente o cache fez a mesma rotina retornar zero. Inserir a nova macro NSIS também fez a rotina retornar zero com o cache original presente.

As consultas de processos e arquivos não mostraram o aplicativo aberto nem arquivo bloqueado. As hipóteses anteriores de processo residual, execução como administrador e arquivo ausente não estavam confirmadas e não explicavam a recorrência.

## Alterações

- `electron/installer.nsh`: mantém a verificação padrão de processos e limpa o cache de imagens com caminho estendido antes de executar o desinstalador antigo.
- `next.config.ts`: desativa o cache de imagens em disco, evitando recriar caminhos problemáticos dentro da instalação.
- `scripts/prepare-desktop.mjs`: exclui cache do standalone antes de empacotar.
- Identidade `com.deckvault.desktop` e executável `DeckVault Desktop.exe` mantidos.

## Verificação

- Reprodução NSIS: falha antes; retorno zero com a correção.
- Teste com ImageOptimizerCache real e configuração de produção: não cria diretório de cache nem persiste imagens.
- Build e lint aprovados.
- Instalação real sobre 0.2.9: código de saída 0, registro atualizado para 0.2.11.
- Backup do perfil feito antes do teste. Hashes dos 1.810 arquivos do perfil idênticos após instalar, sem iniciar o aplicativo.
- Instalador: `releases/0.2.11/DeckVault-Setup-0.2.11.exe`.
- SHA-256: `EEB2398F5A7BE32DB4ACC535F2155951108F23146A24228F4F4814F4470876F9`.
