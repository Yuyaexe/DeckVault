# Como o DeckVault é usado

## Uso principal

O DeckVault é usado principalmente como programa Windows instalado pelo arquivo `.exe`.

O usuário também abre o projeto no navegador local em alguns momentos, usando `DeckVault.bat` ou o servidor de desenvolvimento. Entre as duas opções, o programa Windows é preferido.

## Dados

- O fluxo atual é local e é a única fonte ativa de dados do aplicativo.
- Os dados importantes ficam no armazenamento local do aplicativo ou navegador.
- Backups JSON são essenciais para recuperar a coleção ou trocar de computador.
- O aplicativo consulta serviços externos para catálogos, imagens e compras do CardTrader, quando configurado.
- Para usar os mesmos dados em outro PC, exporte um backup JSON e restaure-o no outro computador.

## Supabase e sincronização

Supabase, login, compartilhamento de coleções e sincronização entre PCs/usuários foram removidos do fluxo ativo do DeckVault.

O código legado relacionado ainda pode existir no repositório enquanto a remoção física completa é feita em uma limpeza posterior, mas o aplicativo não entra em modo Supabase, não renova sessão, não monta a sincronização Anime e não oferece controles de compartilhamento na interface.

## Identificação de cartas compradas

O usuário considera uma carta comprada independentemente da edição. Todos os indicadores de compra e filtros de exportação devem reconhecer o nome normalizado, sem exigir a mesma expansão ou blueprint do CardTrader. Regra global confirmada pelo usuário em 22/09/2026.
