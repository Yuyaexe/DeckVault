# Benchmark de desempenho — 0.2.18

Medições feitas no PC Windows do DeckVault em 24/09/2026.

## Índice de cartas compradas

Cenário: 5.000 compras e 300 overlays consultando a mesma resposta.

- Antes: 507,40 ms para reconstruir o índice 300 vezes.
- Depois: 1,78 ms usando o índice compartilhado.
- Speedup observado em execuções repetidas: aproximadamente 260x a 285x no microbenchmark.
- A regra de matching por nome normalizado/blueprint não mudou.

## Cache de imagens — algoritmo

Cenário: cache iniciado com 400 entradas e 500 novas gravações.

- Antes: 500 execuções de prune e 200.500 entradas varridas.
- Depois: 16 execuções de prune e 6.881 entradas varridas.
- Redução de varredura: 29,1x.
- 500 cache hits deixaram de implicar 500 transações de escrita de recência; são agrupados em lotes de até 50.

## Cache de imagens — IndexedDB real do Electron

Banco temporário separado, executado no Chromium do Electron 44.4.5.

- 120 ciclos de gravação + manutenção ficaram aproximadamente 5,9x a 6,2x mais rápidos em execuções repetidas.
- 240 cache hits com atualização de recência ficaram aproximadamente 2,2x a 4,3x mais rápidos em execuções repetidas.
- A variação de tempo é esperada em benchmarks curtos de I/O; em todas as execuções a versão otimizada foi mais rápida.

## Passcodes simultâneos

Cenário: 50 solicitações concorrentes da mesma chave de carta.

- Antes: 50 execuções reais do resolver.
- Depois: 1 execução real compartilhada pelas 50 chamadas.
- Isso reduz chamadas duplicadas em 98%; a latência do primeiro request continua sendo a do resolver real.

Os benchmarks podem ser repetidos com `npm run benchmark:performance` e `npm run benchmark:idb`.
