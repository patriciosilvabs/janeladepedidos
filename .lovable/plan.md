

# Separar nome do produto em linha propria no painel do Forno

## Problema

No `OvenItemRow.tsx`, o nome do produto (ex: "Pizza Grande - 1 Sabor") aparece na mesma linha que o numero do pedido e o badge de tipo. O padrao correto e:

```text
Linha 1: [#6623] [Retirada]
Linha 2: Pizza Grande - 1 Sabor
Linha 3: AMERICANA (G)
Linha 4: Borda / Observacao
```

## Mudanca

**Arquivo:** `src/components/kds/OvenItemRow.tsx` (linhas 95-104)

Mover o `<p>` do nome do produto para fora do `<div>` que contem o ID e o badge, criando uma linha separada:

```tsx
{/* Linha 1: ID + Tipo */}
<div className="flex items-center gap-2 flex-wrap">
  {orderDisplayId && (
    <span className="text-2xl font-bold shrink-0 bg-foreground text-background px-2 py-0.5 rounded">#{orderDisplayId}</span>
  )}
  <OrderTypeBadge orderType={item.orders?.order_type} className="text-base px-3 py-1" />
</div>

{/* Linha 2: Nome do produto */}
<p className="text-2xl font-bold text-foreground truncate mt-1">
  {item.quantity > 1 && <span className="text-primary">{item.quantity}x </span>}
  {item.product_name}
</p>
```

Apenas essa separacao. A ordem dos demais elementos (sabores, borda, complementos, obs) ja esta correta.

