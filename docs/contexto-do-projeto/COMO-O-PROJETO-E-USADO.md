# Como o DeckVault é usado

## Uso principal

O DeckVault é usado principalmente como programa Windows instalado pelo arquivo `.exe`.

O usuário também abre o projeto no navegador local em alguns momentos, usando `DeckVault.bat` ou o servidor de desenvolvimento. Entre as duas opções, o programa Windows é preferido.

## Dados

- O fluxo atual é local.
- Os dados importantes ficam no armazenamento local do aplicativo ou navegador.
- Backups JSON são essenciais para recuperar a coleção ou trocar de computador.
- O aplicativo consulta serviços externos para catálogos, imagens e compras do CardTrader, quando configurado.

## Recursos que não fazem parte do uso atual

- Supabase como armazenamento principal.
- Implantação pela Vercel.
- Compartilhamento de coleções entre contas.
- Sincronização entre vários usuários.

Esses recursos continuam no código, mas não devem deslocar correções importantes do programa Windows e do modo local.
