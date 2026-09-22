# Atualizações registradas — 21/09/2026

Registro do estado local do DeckVault nesta conversa. Os arquivos de implementação já estão salvos no projeto. Este registro não representa publicação, geração de instalador, commit ou envio ao GitHub.

## Implementado nesta conversa

### Destaque de cartas compradas

- Completada a integração do overlay nas visualizações da Collection e Anime Collection.
- Overlay também nas prévias ao passar o mouse, inspeção, busca e seleção de variantes.
- Controles conectados em Settings: ativar/desativar, cor personalizada e intensidade.
- Preferências persistidas no armazenamento local da interface.
- Corrigidos dois erros de JSX que impediam a compilação, em `CharacterCardThumb.tsx` e `CardInspectDialog.tsx`.

Arquivos centrais: `src/components/shared/PurchasedCardOverlay.tsx`, `PurchasedOverlaySettings.tsx`, `src/hooks/usePurchasedCardMatch.ts`, `src/lib/data/ui-store.ts` e `src/app/(dashboard)/settings/page.tsx`.

### Exportação

- Opção compartilhada em todas as janelas que usam `ExportDeckModal`: Collection, todas as séries de anime, anime individual e personagem.
- A versão final usa a checkbox **Exportar apenas não compradas**. Ela substitui a opção inicial de exportar compradas.
- Desmarcada: exporta todas as cartas recebidas pela janela. Marcada: exclui as identificadas como compradas.
- Prévia, copiar e baixar usam a mesma seleção filtrada.
- Contador mostra a quantidade a exportar e o total original, incluindo cópias.
- As quantidades da coleção são mantidas; o filtro atual é por carta, não subtrai o número de unidades compradas.
- Arquivos filtrados recebem o sufixo `_unpurchased`.
- Incluídos estados de carregamento, falha, tentativa novamente e seleção vazia.

Arquivo central: `src/features/import/components/ExportDeckModal.tsx`; textos em `src/lib/i18n/messages.ts`.

### Imagens de Purchased Cards

- Removidas as consultas individuais a páginas de blueprint do CardTrader.
- Yu-Gi-Oh usa o adaptador do YGOPRODeck; o caminho já existente de Digimon usa seu próprio catálogo.
- Removido o corte nas primeiras 80 cartas.
- No máximo três buscas de catálogo em andamento por requisição.
- Buscas repetidas por nome/jogo compartilham resultados e promessas em andamento.
- Cache de URLs no servidor: 24 horas para acertos e um minuto para respostas sem imagem. Não equivale a armazenar as imagens no IndexedDB.
- A consulta de pedidos continua usando a API do CardTrader.

Arquivo: `src/app/api/market/cardtrader/purchases/route.ts`.

## Outras alterações já presentes no diretório de trabalho

Estas diferenças foram observadas contra o HEAD do Git, mas não foram todas produzidas nesta conversa:

- Versão em `package.json`: 0.2.4 → 0.2.6.
- Lint migrado de `next lint` para `eslint .`; arquivo `eslint.config.mjs` novo e `.eslintrc.json` removido.
- Configuração de publicação do Electron aponta para `Yuyaexe/DeckVault`, com nome `DeckVault-Setup-${version}.${ext}`.
- Ajustes no fluxo de atualização automática e mensagens de erro do Electron.
- Página Purchased Cards, API de compras, navegação, proteção de rota, tipos e lógica de correspondência das compras.
- README documenta a variável de ambiente `CARDTRADER_API_TOKEN`.

## Verificações realizadas

- `npx tsc --noEmit`: passou.
- `npm run lint`: passou na revisão geral.
- `npm run test:anime-merge`: 7 testes passaram.
- Simulação da API de compras com 101 itens: imagens resolvidas, nomes repetidos reutilizados, até três consultas simultâneas e nenhuma consulta de imagem ao CardTrader.
- Teste de imagens que depende de `localhost:3000`: não completou porque o servidor local não estava disponível.
- Build de produção: tentativa observada falhou ao baixar Geist/Geist Mono por bloqueio de rede. Foi solicitada repetição com acesso à rede, mas não foi recuperado um resultado final; não há validação de build bem-sucedido nesta revisão.

## Pendências

### Correção posterior: compras válidas, paginação e completude

Os itens 6, 7 e 8 da revisão foram implementados posteriormente nesta conversa:

- Itens cancelados, perdidos, ausentes e sem quantidade válida permanecem no histórico, mas não cobrem cartas no overlay/exportação. CT Zero separa quantidade histórica de quantidade válida (`pending + ok`).
- Pedidos carregados em todas as páginas, com consultas sequenciais, cache curto por credencial e deduplicação de requisições concorrentes.
- Histórico informa fontes completas/desatualizadas/indisponíveis. Último histórico completo disponível é preservado quando uma fonte falha.
- Exportação de não compradas bloqueada enquanto carrega ou quando o histórico está incompleto; aviso e nova tentativa disponíveis. Contagem e prévia não apresentam resultados como definitivos nesses estados.
- Página de compras passou a usar os mesmos tipos, função de consulta e chave de cache usados pelo overlay e pela exportação. Filtro de cancelados reconhece as duas grafias.
- Adicionado `npm run test:purchases` em `scripts/test-purchases.ts`.

Detalhes, limites e prioridades restantes estão no relatório de revisão.

As funcionalidades acima foram implementadas, mas permanecem os demais problemas descritos em [REVISAO-2026-09-21.md](REVISAO-2026-09-21.md). Não houve alteração de dados de produção.

## Purchased Cards: interface inspirada no CardTrader

- Removida a coluna de vendedores da tela.
- Navegação por status no topo, com contadores de pedidos; CT Zero conta unidades de cartas.
- Busca por nome da carta, edição ou código do pedido.
- CT Zero possui painéis e listas por situação: recebidas/prontas para envio (verde), a caminho (azul) e indisponíveis (amarelo). Os painéis também filtram as listas.
- Linhas compactas com imagem, nome, edição, quantidade e preço unitário. As imagens continuam usando o catálogo existente.
- Pedidos comuns são agrupados pelo identificador do pedido, com seleção lateral e detalhes do pedido selecionado.
- Valores dos itens são somados por moeda, sem incluir frete; preços ausentes são indicados por um traço.
- Um item CT Zero com unidades recebidas, pendentes e ausentes aparece nas respectivas seções, sem alterar os dados usados pelo overlay/exportação. Cancelados ficam separados.
- Preservados os avisos de histórico incompleto, carregamento e nova tentativa. Textos adicionados em português e inglês.

Arquivos principais: `src/app/(dashboard)/purchases/page.tsx`, `src/lib/purchases/presentation.ts`, `src/lib/purchases/cardtrader.ts`, `src/lib/purchases/types.ts` e `src/lib/i18n/messages.ts`.

Validação desta alteração:

- 22 testes de compras passaram, incluindo agrupamento por pedido, busca e separação das quantidades do CT Zero.
- `npx tsc --noEmit` e `npm run lint` passaram.
- Conferência no navegador da disposição dos filtros, painéis, aviso de histórico incompleto e troca de status, sem erros no console.
- As duas fontes do CardTrader ficaram indisponíveis no ambiente local de teste; a conferência visual das listas com dados reais não foi concluída. A lógica das listas foi verificada com dados simulados nos testes.
