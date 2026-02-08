
# Melhorias no Painel do Forno/Despacho e Cancelamentos

## 1. Badge de tipo de pedido (Retirada/Delivery/Balcao) no Forno

**Problema:** O painel do Forno nao mostra se o pedido eh Retirada, Delivery ou Balcao.

**Solucao:**
- Adicionar `order_type` na query do `useOrderItems` (campo `orders`)
- Atualizar o tipo `OrderItemWithOrder` para incluir `order_type`
- Criar funcao utilitaria `getOrderTypeBadge` reutilizavel (extrair do `OrderCard.tsx`)
- Exibir badge colorido no `OvenItemRow` (ao lado do numero do pedido) e no `OrderOvenBlock` (no header do bloco)

Badges: Azul (Delivery), Verde (Mesa), Laranja (Retirada), Roxo (Balcao)

## 2. Aumentar fonte na bancada de despacho

**Solucao:** No `OvenItemRow.tsx`:
- Nome do produto: de `text-xl` para `text-2xl`
- Sabores (badges): de `text-sm` para `text-base`
- Borda/Obs: de `text-sm` para `text-base`
- Timer: de `text-2xl` para `text-3xl`
- Numero do pedido: de `text-xl` para `text-2xl`

No `OrderOvenBlock.tsx`:
- Header do bloco: fontes proporcionalmente maiores
- Itens prontos e aguardando: fontes maiores tambem

## 3. Cancelamento de item NAO iniciado -- remover silenciosamente

**Problema:** Itens cancelados antes de serem iniciados (status `pending`) nao precisam de alerta.

**Solucao:** Modificar `CancellationAlert.tsx`:
- Filtrar a query para buscar apenas itens cancelados que JA tinham sido iniciados (que possuem `claimed_at` preenchido, indicando que alguem ja estava trabalhando neles)
- Itens que nunca foram iniciados (`claimed_at IS NULL`) serao automaticamente removidos da bancada pelo filtro de status existente, sem alerta

## 4. Modal fullscreen para cancelamento de item JA iniciado

**Problema:** Quando um item eh cancelado depois de ja ter sido iniciado na producao, o operador precisa de um aviso impactante.

**Solucao:** Substituir o componente `CancellationAlert` atual (card inline) por um modal fullscreen:
- Overlay vermelho cobrindo TODA a tela
- Icone grande de alerta centralizado
- Texto principal: "PEDIDO CANCELADO" com numero do pedido
- Texto secundario: "NAO produza mais este item. Se ja estiver pronto, encaixe em outro pedido."
- Lista dos itens cancelados
- Botao grande central "ENTENDI" para confirmar (chama `acknowledge_cancellation`)
- Som de alerta continuo ate o operador confirmar

## Detalhes Tecnicos

### Arquivos modificados:

1. **`src/types/orderItems.ts`** -- Adicionar `order_type` ao tipo `OrderItemWithOrder.orders`

2. **`src/hooks/useOrderItems.ts`** -- Adicionar `order_type` na query SELECT do Supabase (duas queries: items e siblings)

3. **`src/lib/orderTypeUtils.ts`** (novo) -- Funcao utilitaria `getOrderTypeBadge` extraida do OrderCard

4. **`src/components/kds/OvenItemRow.tsx`** -- Aumentar fontes + adicionar badge de tipo de pedido

5. **`src/components/kds/OrderOvenBlock.tsx`** -- Aumentar fontes + adicionar badge de tipo de pedido no header

6. **`src/components/kds/CancellationAlert.tsx`** -- Reescrever como modal fullscreen + filtrar apenas itens que ja foram iniciados (`claimed_at` preenchido)
