# Estado atual

## Versão local

- Versão: `0.2.13`.
- Uso principal: programa Windows.
- Uso secundário: navegador local.
- Armazenamento principal: local.
- Supabase, Vercel e compartilhamento: não usados atualmente.

## Última validação registrada

- Build de produção concluído.
- TypeScript concluído sem erros.
- 25 testes de compras aprovados.
- 7 testes de mesclagem anime aprovados.
- 2 testes de exportação YDK/YDKE aprovados.
- Auditoria das dependências de produção sem vulnerabilidades.
- Build concluído sem baixar fontes externas e sem aviso da convenção `middleware`.
- Lint concluído sem erros ou avisos.

## Instalador

O instalador mais recente fica em `releases/0.2.13/DeckVault-Setup-0.2.13.exe`.

SHA-256: `5A55F5F24025A226AC7EEF788BBFDF69A03B3D0D380439D84B9EDBFEEEADD6D6`.

O instalador ainda não possui assinatura digital com certificado de publicação.

A versão 0.2.11 mantém a identidade com.deckvault.desktop e o executável DeckVault Desktop.exe introduzidos na 0.2.9. A correção remove o cache de imagens antes da atualização e impede sua recriação no build instalado. Atualização real da 0.2.9 concluída com código 0; hashes dos 1.810 arquivos do perfil preservados.

## Limpeza de arquivos

- Removidos aproximadamente 1,32 GiB de builds descompactados antigos, cache de compilação e logs/resultados temporários.
- Instaladores por versão, fontes, dependências, decks e backups preservados.
- Resta `release-0.2.7/win-unpacked.tmp/resources/default_app.asar`, bloqueado por um processo do Windows. Tentar remover após reiniciar; não encerrar processos indiscriminadamente.

## Antes de começar uma nova alteração

1. Leia os quatro arquivos desta pasta.
2. Confira `git status` e preserve alterações existentes.
3. Determine se o pedido afeta o programa Windows, o navegador local ou ambos.
4. Teste primeiro o fluxo local correspondente.
5. Atualize este arquivo quando versão, modo de uso ou validações mudarem.



0.2.13: todos os indicadores de compra e a exportação consideram qualquer edição pelo nome normalizado; 25 testes de compras, 2 de exportação, build e lint aprovados. Instalador gerado localmente; ainda não instalado nem publicado.
