# Estado atual

## Versão local

- Versão: `0.2.15`.
- Uso principal: programa Windows.
- Uso secundário: navegador local.
- Armazenamento principal: local.
- O fluxo ativo do aplicativo é local-only.
- Supabase, login, compartilhamento e sincronização entre PCs foram removidos do fluxo ativo.

## Mudança local-only em revisão

- `useAppConfig()` passa a retornar sempre modo local.
- O perfil do shell usa diretamente o estado local.
- O middleware/proxy de renovação de sessão Supabase foi removido.
- O Dashboard não monta mais `useAnimeCloudShareSync()`.
- Botões e modais de compartilhar coleção, gerenciar membros e compartilhar Anime Collection foram removidos da interface.
- Configurações usa apenas backup e restauração locais.
- Código legado Supabase ainda permanece no repositório, mas não participa do fluxo normal do app.
- Alteração preparada na branch `remove-supabase-flow` / PR #3.

## Última validação registrada

- Build de produção concluído.
- TypeScript concluído sem erros.
- 25 testes de compras aprovados.
- 7 testes de mesclagem anime aprovados.
- 2 testes de exportação YDK/YDKE aprovados.
- Auditoria das dependências de produção sem vulnerabilidades.
- Build concluído sem baixar fontes externas e sem aviso da convenção `middleware`.
- Lint concluído sem erros ou avisos.
- 0.2.15: 12 testes desktop (8 de atualização local), 25 de compras, 7 de mesclagem anime e 2 de exportação aprovados. TypeScript, lint e build aprovados. O instalador foi gerado pelo mesmo fluxo de compilação do novo botão.
- A alteração local-only desta branch ainda precisa ser validada com TypeScript/lint/build no workspace Windows antes de entrar em `main`.

## Instalador

O instalador mais recente fica em `releases/0.2.15/DeckVault-Setup-0.2.15.exe`.

SHA-256: `2EAC54B3297C6EC85A9CAB593A5C2A0DB8DD9D447CB07D0CCBC81B4287E85E85`.

O instalador ainda não possui assinatura digital com certificado de publicação.

A versão 0.2.11 mantém a identidade com.deckvault.desktop e o executável DeckVault Desktop.exe introduzidos na 0.2.9. A correção remove o cache de imagens antes da atualização e impede sua recriação no build instalado. Atualização real da 0.2.9 concluída com código 0; hashes dos 1.810 arquivos do perfil preservados.

## Limpeza de arquivos

- Removidos aproximadamente 1,32 GiB de builds descompactados antigos, cache de compilação e logs/resultados temporários.
- Instaladores por versão, fontes, dependências, decks e backups preservados.
- Resta `release-0.2.7/win-unpacked.tmp/resources/default_app.asar`, bloqueado por um processo do Windows. Tentar remover após reiniciar; não encerrar processos indiscriminadamente.

## Antes de começar uma nova alteração

0.2.15: Configurações oferece atualização pela pasta local do projeto. A pasta é lembrada; o fluxo compila, gera o instalador, fecha o aplicativo, faz backup completo verificado por hash, instala e reabre. Uma falha de compilação mantém o aplicativo aberto. O assistente exige confirmação interna de entrega antes de instalar, impedindo instalação tardia após falha. Consulte `ATUALIZACAO-LOCAL.md` para requisitos e uso. Instalador gerado, ainda não instalado nem publicado. O assistente foi testado com executável Windows de teste; a instalação NSIS real e o clique no aplicativo instalado ainda não foram validados nesta versão.

0.2.14: imagem da carta maior na janela de inspeção e ampliação ao clicar. TypeScript, lint, build e os 2 testes de configuração do instalador aprovados. Instalador NSIS gerado localmente; ainda não instalado nem publicado. A interação visual ainda não foi validada no aplicativo instalado.

1. Leia os quatro arquivos desta pasta.
2. Confira `git status` e preserve alterações existentes.
3. Determine se o pedido afeta o programa Windows, o navegador local ou ambos.
4. Teste primeiro o fluxo local correspondente.
5. Atualize este arquivo quando versão, modo de uso ou validações mudarem.

0.2.13: todos os indicadores de compra e a exportação consideram qualquer edição pelo nome normalizado; 25 testes de compras, 2 de exportação, build e lint aprovados. Instalador gerado localmente; ainda não instalado nem publicado.
