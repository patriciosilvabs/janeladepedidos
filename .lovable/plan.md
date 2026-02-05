

# Plano: Aumentar Fontes no KDS (Manter Layout Grid)

## Objetivo

Aumentar significativamente as fontes do **sabor da pizza** e do **numero do pedido** para melhor visibilidade, **mantendo o layout em grid** atual (multiplas colunas).

---

## Mudancas Propostas

**Arquivo**: `src/components/kds/KDSItemCard.tsx`

### 1. Numero do Pedido Maior

| Elemento | Antes | Depois |
|----------|-------|--------|
| Classe | `text-xs` (12px) | `text-base font-bold` (16px) |

```tsx
// ANTES (linha 207-209)
<Badge variant="outline" className="font-mono text-xs">
  #{orderId}
</Badge>

// DEPOIS
<Badge variant="outline" className="font-mono text-base font-bold px-2 py-0.5">
  #{orderId}
</Badge>
```

### 2. Nome do Sabor/Produto Maior

| Elemento | Antes | Depois |
|----------|-------|--------|
| Classe | `font-semibold` (~16px) | `text-xl font-bold` (20px) |
| Truncate | `truncate` | Removido para mostrar nome completo |

```tsx
// ANTES (linha 217-222)
<div className="mb-2">
  <h3 className="font-semibold text-foreground truncate">
    {item.quantity > 1 && <span className="text-primary">{item.quantity}x </span>}
    {item.product_name}
  </h3>
</div>

// DEPOIS
<div className="mb-3">
  <h3 className="text-xl font-bold text-foreground leading-tight">
    {item.quantity > 1 && <span className="text-primary">{item.quantity}x </span>}
    {item.product_name}
  </h3>
</div>
```

### 3. Padding do Card Ligeiramente Maior

```tsx
// ANTES (linha 188)
"rounded-lg border-2 p-3 transition-all duration-300 relative"

// DEPOIS
"rounded-lg border-2 p-4 transition-all duration-300 relative"
```

---

## Comparacao Visual

```
ANTES:                           DEPOIS:
+------------------+             +------------------+
| #SIM-ML8X (12px) |             | #SIM-ML8X (16px) |
|                  |             |  (MAIOR E BOLD)  |
| Pizza Calabresa  |             |                  |
| (16px normal)    |             | Pizza Calabresa  |
|                  |             | (20px BOLD)      |
| [INICIAR]        |             |                  |
+------------------+             | [INICIAR]        |
                                 +------------------+
```

---

## Resumo das Mudancas

| Elemento | Antes | Depois |
|----------|-------|--------|
| Numero do pedido | 12px (`text-xs`) | 16px (`text-base font-bold`) |
| Nome do sabor | ~16px (`font-semibold`) | 20px (`text-xl font-bold`) |
| Padding do card | 12px (`p-3`) | 16px (`p-4`) |
| Layout | Grid (mantido) | Grid (mantido) |

---

## Arquivo a Modificar

| Arquivo | Mudanca |
|---------|---------|
| `src/components/kds/KDSItemCard.tsx` | Aumentar fontes do pedido e sabor |

