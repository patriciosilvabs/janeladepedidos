
# Fix: Tornar o dialog de edição de loja rolável

## Problema
O dialog de edição de lojas tem muito conteúdo (nome, token, webhook, tipos de pedido, categorias, mapeamento de grupos) e não permite rolagem, cortando o conteúdo na parte inferior da tela.

## Solução
Adicionar rolagem ao conteúdo interno do dialog, mantendo o header e footer fixos.

## Detalhes Técnicos

**Arquivo:** `src/components/StoresManager.tsx`

1. Adicionar `className="max-h-[85vh] flex flex-col"` ao `DialogContent` (linha 264) para limitar a altura do dialog
2. Envolver o conteúdo do formulário (o `div` com `className="space-y-4 py-2"` na linha 272) com `overflow-y-auto` e padding adequado para permitir rolagem
3. O `DialogHeader` e `DialogFooter` permanecem fixos, apenas o corpo do formulário rola
