# Estado atual

## Versão local

- Versão: `0.2.15`.
- Uso principal: programa Windows.
- Uso secundário: navegador local.
- Armazenamento principal: IndexedDB local.
- O produto atual é local-only.
- O PR #3 com a migração para IndexedDB e remoção do fluxo Supabase já foi integrado à `main`.

## IndexedDB

- O store principal `deckvault-demo`, o store de UI `deckvault-ui` e o idioma `deckvault-locale` usam IndexedDB.
- Preferências de busca, binder/grid, banner e tema também usam IndexedDB.
- Dados antigos do `localStorage` são migrados automaticamente e só são removidos depois de uma gravação bem-sucedida no IndexedDB.
- Um gate de hidratação impede que o estado padrão sobrescreva dados persistidos durante a abertura.

## Limpeza cloud em revisão

Na branch `remove-supabase-legacy`:

- páginas de login/signup/reset foram removidas;
- todas as rotas `/api/app/*` de dados cloud foram removidas;
- clientes e middleware Supabase foram removidos;
- serviços de colaboração, membros, invites e sync foram removidos;
- migrations/schema PostgreSQL e scripts Drizzle foram removidos;
- dependências Supabase, Drizzle, PostgreSQL e `next-themes` foram removidas;
- CardTrader continua ativo sem depender de usuário Supabase;
- `useAppData`, mutações e Activity foram simplificados para local-only.

Essa limpeza ainda deve passar por lint, TypeScript, build e teste desktop antes de entrar na `main`.

## Última validação registrada da main

- Teste manual: adicionar carta, alterar quantidade, mover no binder, trocar tema, fechar e reabrir — aprovado.
- Interface sem compartilhar/membros/login/status de sync — aprovada.
- `npm run lint` — aprovado.
- `npx tsc --noEmit` — aprovado.
- `npm run build` — aprovado.
- `npm run desktop:dev` — aprovado após reinstalar o pacote Electron local.

## Instalador

O instalador mais recente fica em `releases/0.2.15/DeckVault-Setup-0.2.15.exe`.

SHA-256: `2EAC54B3297C6EC85A9CAB593A5C2A0DB8DD9D447CB07D0CCBC81B4287E85E85`.

O instalador ainda não possui assinatura digital com certificado de publicação.

## Antes de começar uma nova alteração

1. Leia os quatro arquivos desta pasta.
2. Confira `git status` e preserve alterações existentes.
3. Determine se o pedido afeta o programa Windows, o navegador local ou ambos.
4. Teste primeiro o fluxo local correspondente.
5. Atualize este arquivo quando versão, armazenamento ou validações mudarem.
