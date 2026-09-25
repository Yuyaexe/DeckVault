# Estado atual

## Versão local

- Versão: `0.2.18`.
- Uso principal: programa Windows.
- Uso secundário: navegador local.
- Armazenamento principal: IndexedDB local.
- O produto atual é local-only.
- Electron atualizado para `44.4.5`, com `npm audit` sem vulnerabilidades conhecidas.

## IndexedDB

- O store principal `deckvault-demo`, o store de UI `deckvault-ui` e o idioma `deckvault-locale` usam IndexedDB.
- Preferências de busca, binder/grid, banner e tema também usam IndexedDB.
- O histórico de Activity mantém apenas os últimos 7 dias e é limpo automaticamente ao abrir o app e periodicamente enquanto ele fica aberto.
- Dados antigos do `localStorage` são migrados automaticamente e só são removidos depois de uma gravação bem-sucedida no IndexedDB.
- Um gate de hidratação impede que o estado padrão sobrescreva dados persistidos durante a abertura.

## Arquitetura local atual

- Login/signup/reset e todas as rotas cloud `/api/app/*` foram removidos.
- Supabase, PostgreSQL/Drizzle, compartilhamento, membros, invites e sync foram removidos.
- CardTrader continua ativo sem depender de usuário Supabase.
- `useAppData`, mutações, Activity, backup e Anime Collection operam localmente.
- O antigo `src/lib/demo/store.ts` monolítico foi dividido em módulos de Activity, coleção, Anime, helpers, tipos e migrações; o arquivo principal agora só monta o store.
- O índice de cartas compradas é reutilizado entre overlays da mesma resposta, evitando reconstrução repetida.
- O cache de imagens usa leituras `readonly`, agrupa atualizações de recência e reduz a frequência de prune; resoluções simultâneas do mesmo passcode são deduplicadas.
- O fluxo atual foi validado com lint, TypeScript, build, Electron desktop e teste manual.

## Última validação registrada da main

- Teste manual: adicionar carta, alterar quantidade, mover no binder, trocar tema, fechar e reabrir — aprovado.
- Interface sem compartilhar/membros/login/status de sync — aprovada.
- `npm run lint` — aprovado.
- `npx tsc --noEmit` — aprovado.
- `npm run build` — aprovado.
- `npm run desktop:dev` — aprovado com Electron 44.4.5.
- `npm audit` — 0 vulnerabilidades.
- Aplicativo instalado atualizado para 0.2.18 preservando o mesmo perfil de dados.

## Instalador

O instalador mais recente fica em `releases/0.2.18/DeckVault-Setup-0.2.18.exe`.

SHA-256: `857CF57C6C608AFBEF8BDB74E74A19BA7002B01AC326DE94AFE0A238951B45B3`.

O instalador ainda não possui assinatura digital com certificado de publicação.

## Antes de começar uma nova alteração

1. Leia os quatro arquivos desta pasta.
2. Confira `git status` e preserve alterações existentes.
3. Determine se o pedido afeta o programa Windows, o navegador local ou ambos.
4. Teste primeiro o fluxo local correspondente.
5. Atualize este arquivo quando versão, armazenamento ou validações mudarem.
