# Manutenção local — 22/09/2026

## Correções

- Restauração no Supabase: cartas já existentes no catálogo compartilhado são reutilizadas sem sobrescrever nome, imagem ou metadados. Uma inserção concorrente também não altera o registro existente.
- Resolução de passcodes: coleções com mais de 50 cartas são consultadas em lotes aceitos pela API. Falhas HTTP e respostas incompletas não são persistidas como resultados negativos no IndexedDB.
- Compras: quando um blueprint conhecido é diferente do comprado, a coincidência de nome por si só não marca a carta como comprada. A comparação usa a edição disponível quando não há blueprint suficiente.
- Verificador: a etapa de lint chama o ESLint configurado no projeto.
- Ferramentas: `eslint-config-next` foi alinhado com Next 16 e a configuração foi migrada para flat config nativo. Três regras novas do React Hooks permanecem temporariamente desativadas porque o código atual gera dezenas de erros nelas; a revisão desses padrões deve ser gradual.
- Documentação: este índice organiza os registros do projeto sem mover ou apagar arquivos do usuário.

## Continuação para 0.2.7

- `drizzle-orm` atualizado para 0.45.3; a auditoria das dependências de produção não encontrou vulnerabilidades.
- Sincronização anime: gravações compartilhadas agora comparam a revisão dentro da operação de atualização. Uma revisão antiga gera conflito para o fluxo de mesclagem. Fotos, metadados e layout entram na detecção de alterações.
- Exportação YDK/YDKE: IDs curtos de blueprint deixam de ser aceitos como passcodes; Fusão, Sincro, Xyz e Link vão para o Extra Deck. O modelo atual não contém uma seção Side Deck por carta, portanto essa seção continua vazia.
- Compras: a API devolve o histórico sem esperar por imagens. A página busca imagens apenas quando as linhas aparecem na tela. Jogos não mapeados não são tratados como Yu-Gi-Oh.
- Em produção, compras do CardTrader exigem `CARDTRADER_OWNER_USER_ID` igual ao usuário autenticado. Sem esse valor, o histórico fica indisponível.
- Nova migration `0015_collection_owner_immutable.sql` impede transferência do proprietário de uma coleção. Ela precisa ser aplicada ao Supabase usado pela implantação antes de considerar a proteção ativa naquele banco.
- Instalador Windows gerado em `releases/0.2.7/DeckVault-Setup-0.2.7.exe` (SHA-256 `BB4AEC4D6099ECA269509EDABE3B2F0F51E0CEB4E086A23C987CED222C3FBB35`). O executável não possui assinatura digital com certificado de publicação.

## Verificações

- `npx tsc --noEmit`: passou.
- `npm run test:purchases`: 23 testes passaram.
- `npm run test:anime-merge`: 7 testes passaram.
- `npm run lint`: passou com quatro avisos de compatibilidade entre React Compiler e TanStack Virtual.
- `npm run build`: passou após permitir o download das fontes Geist. O Next 16 emite um aviso de descontinuação para a convenção `middleware`.
- `npm audit --omit=dev --audit-level=high`: passou sem vulnerabilidades nas dependências de produção após a atualização do Drizzle ORM.

## Atualização 0.2.8

- O aplicativo deixou de baixar as fontes Geist durante o build e passou a usar as fontes disponíveis no Windows.
- A convenção do Next.js foi migrada de `middleware` para `proxy`, removendo o aviso de descontinuação.
- O ESLint passou a tratar de forma explícita os quatro componentes com TanStack Virtual que o React Compiler não pode memoizar com segurança. O lint conclui sem avisos.
- A configuração da atualização automática foi alinhada com o remote Git `Yuyaexe/CollecitonMYPICA`.
- Instalador Windows gerado em `releases/0.2.8/DeckVault-Setup-0.2.8.exe` (SHA-256 `5C15F319EEE32045BAC9D22D391CE7F479FD8B45F7CE57B7684EE75F39E6C26A`). O executável não possui assinatura digital com certificado de publicação.
- `npm run lint`, `npx tsc --noEmit`, os 32 testes automatizados e `npm run build` passaram. O build foi concluído sem acesso à rede.

## Limites

As demais pendências em [REVISAO-2026-09-21.md](REVISAO-2026-09-21.md) ainda exigem trabalho, especialmente a validação das políticas de acesso no banco. Como Supabase e compartilhamento não fazem parte do uso atual, elas permanecem com prioridade baixa. A versão 0.2.8 foi gerada localmente e não foi publicada.

## Reparo do instalador em 0.2.9

- As tentativas de instalar a versão 0.2.8 entravam no desinstalador antigo, que detectava um processo `DeckVault.exe` residual e terminava com o código 2.
- A nova versão usa o identificador `com.deckvault.desktop` e o executável interno `DeckVault Desktop.exe`. Isso isola a instalação nova do registro e do processo quebrados, mantendo o nome visível e os dados em `AppData\\Roaming\\deckvault`.
- Instalador gerado em `releases/0.2.9/DeckVault-Setup-0.2.9.exe` (SHA-256 `B659A1732A5B968EA11ADB3956B3A2E510AFCAFA1E796DBBEF923FA7EC1BF354`).
