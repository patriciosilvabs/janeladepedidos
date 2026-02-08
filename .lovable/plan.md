
# Padronizar layout dos cards KDS

## Objetivo

Estabelecer uma ordem visual unica e consistente em todos os cards do sistema, seguindo o modelo da imagem de referencia:

1. **Numero do pedido + Tipo** (ex: #6620 + Retirada)
2. **Nome do produto** (ex: Pizza Grande - Meio a Meio)
3. **Sabores** (ex: 1/2 PEPPERONI E CHEDDAR)
4. **Borda** (tarja laranja, ex: # Borda de Cream Cheese)
5. **Complementos** (massas, adicionais)
6. **Observacao** (tarja vermelha)

## Mudancas por arquivo

### 1. KDSItemCard.tsx (card da bancada de producao)

**Problemas atuais:**
- Borda aparece ANTES dos sabores (invertido)
- Nao exibe o badge de tipo do pedido (Delivery/Retirada/Balcao)

**Correcoes:**
- Importar `OrderTypeBadge` de `@/lib/orderTypeUtils`
- No header, ao lado do `#orderId`, adicionar `<OrderTypeBadge orderType={item.orders?.order_type} />`
- Mover o bloco de `edge_type` (tarja laranja) para DEPOIS dos sabores (`flavors`)

A ordem final dos blocos no card sera:
```text
[#ID] [Retirada]         [timer]
Nome do produto
Sabores (texto grande)
[Borda - tarja laranja]       <-- movida para depois
[Barra FIFO se aplicavel]
Complementos
[Observacao - tarja vermelha]
Loja / Setor
Cliente
[Botao de acao]
```

### 2. OvenItemRow.tsx (itens individuais no forno)

**Estado atual:** Ja segue a ordem correta (ID + tipo, produto, sabores, borda, complementos, obs). Nenhuma mudanca necessaria na ordem.

### 3. OrderOvenBlock.tsx (blocos de pedido no forno)

**Estado atual:** Os blocos de itens ja prontos (`dbReadyItems`) e os itens em espera (`waitingItems`) seguem a mesma ordem. Nenhuma mudanca necessaria na ordem.

## Resumo

A unica alteracao real e no `KDSItemCard.tsx`:
- Adicionar o badge de tipo do pedido no header
- Inverter a posicao dos blocos de borda e sabores para que sabores venham primeiro
