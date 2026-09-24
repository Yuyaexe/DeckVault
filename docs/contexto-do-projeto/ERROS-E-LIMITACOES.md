# Erros e limitações conhecidos

## Afetam o uso atual

- O instalador Windows não possui assinatura digital. O Windows pode mostrar um aviso ao abrir.
- O programa depende de internet para buscar catálogos, imagens e compras externas.
- Os dados locais do programa instalado e do navegador podem ficar em armazenamentos diferentes. Faça backup antes de alternar ou reinstalar.
- No Windows, configure o token em Configurações → CardTrader (desde 0.2.10). O token fica em `AppData/Roaming/deckvault/cardtrader.json`, fora do repositório. Em servidor web de produção, o histórico do CardTrader só é liberado quando `DECKVAULT_ALLOW_CARDTRADER_PURCHASES=1` estiver definido explicitamente.

## Técnicos

- O React Compiler ignora os quatro componentes que usam TanStack Virtual, pois essa biblioteca expõe funções imperativas que não podem ser memoizadas com segurança. O comportamento é esperado e está limitado a esses componentes.

## Corrigidos em 0.2.8

- O build não baixa mais as fontes Geist. O aplicativo usa as fontes do Windows com alternativas do sistema.
- A convenção do Next.js foi migrada de `middleware` para `proxy`.
- O lint ignora artefatos compilados em `releases/` e conclui sem erros ou avisos.
- A atualização automática e o remote Git apontam para `Yuyaexe/CollecitonMYPICA`.

## Corrigidos em 0.2.9

- A troca de identidade para `com.deckvault.desktop` permitiu uma instalação nova, mas não corrigiu a causa das falhas de atualização. A recorrência em 0.2.10 foi investigada em 0.2.11.
- O nome visível DeckVault e a pasta de dados do usuário foram preservados.

## Correção do instalador em 0.2.11

- Causa reproduzida: nomes longos do cache de imagens do Next cabem na pasta instalada, mas excedem o limite de caminho ao serem movidos para a pasta temporária do desinstalador NSIS.
- O aviso de fechamento também aparece após várias falhas de desinstalação. O código 2 é uma saída do desinstalador; não comprova arquivo ausente ou processo aberto.
- O instalador limpa somente o cache de imagens antes da desinstalação antiga. A configuração `images.maximumDiskCacheSize: 0` impede novas gravações desse cache no build instalado. Cache HTTP/do navegador permanece disponível.
- A identidade de instalação da 0.2.9 foi mantida. Não criar outra identidade para contornar erros futuros.

## Recursos remotos fora do fluxo atual

- A migration `0015_collection_owner_immutable.sql` precisa ser aplicada antes de considerar essa proteção ativa em um Supabase.
- A sincronização anime concorrente ainda precisa de validação contra um banco de teste real.

Consulte `docs/historico/REVISAO-2026-09-21.md` para o relatório técnico completo. Alguns itens antigos já foram corrigidos e devem ser conferidos contra o registro de manutenção mais recente.

## Corrigido em 0.2.12

- A exportação de cartas não compradas aceita compras de outras edições da mesma carta, pelo nome normalizado. Compras canceladas, perdidas e sem unidades válidas continuam excluídas da cobertura.

0.2.13: a regra de ignorar edição também se aplica a todos os indicadores de compra (coleções, anime, busca, prévia e detalhes), usando a mesma função da exportação.
