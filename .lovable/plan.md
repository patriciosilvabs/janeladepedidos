

# Plano: Layout Vertical com Fontes Maiores no KDS

## Objetivo

Mudar o layout da tela KDS para exibir os cards em uma **coluna única** (um abaixo do outro), com o **sabor da pizza** e o **número do pedido** em fontes muito maiores para facilitar a leitura à distância.

---

## Mudanças Propostas

### 1. Layout de Grid para Coluna Única

**Arquivo**: `src/components/kds/SectorQueuePanel.tsx`

Alterar o container de grid responsivo para uma coluna única centralizada:

| Antes | Depois |
|-------|--------|
| `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3` | `flex flex-col gap-4 max-w-2xl mx-auto` |

---

### 2. Fontes Maiores no Card

**Arquivo**: `src/components/kds/KDSItemCard.tsx`

| Elemento | Antes | Depois |
|----------|-------|--------|
| Numero do pedido | `text-xs` (12px) | `text-2xl font-bold` (24px) |
| Nome do produto/sabor | `font-semibold` (~16px) | `text-3xl font-bold` (30px) |
| Padding do card | `p-3` (12px) | `p-5` (20px) |

---

## Detalhes Tecnicos

### Numero do Pedido Maior (linha 207-209)

```tsx
// ANTES
<Badge variant="outline" className="font-mono text-xs">
  #{orderId}
</Badge>

// DEPOIS
<Badge variant="outline" className="font-mono text-2xl px-3 py-1 font-bold">
  #{orderId}
</Badge>
```

### Nome do Sabor Maior (linha 217-222)

```tsx
// ANTES
<div className="mb-2">
  <h3 className="font-semibold text-foreground truncate">
    {item.quantity > 1 && <span className="text-primary">{item.quantity}x </span>}
    {item.product_name}
  </h3>
</div>

// DEPOIS
<div className="mb-3">
  <h3 className="text-3xl font-bold text-foreground">
    {item.quantity > 1 && <span className="text-primary">{item.quantity}x </span>}
    {item.product_name}
  </h3>
</div>
```

### Padding do Card (linha 187-188)

```tsx
// ANTES
"rounded-lg border-2 p-3 transition-all duration-300 relative"

// DEPOIS
"rounded-lg border-2 p-5 transition-all duration-300 relative"
```

### Layout em Coluna (SectorQueuePanel linha 204)

```tsx
// ANTES
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">

// DEPOIS
<div className="flex flex-col gap-4 max-w-2xl mx-auto">
```

---

## Resultado Visual Esperado

```text
+--------------------------------------------------------------+
|                      BANCADA A                               |
+--------------------------------------------------------------+
|                                                              |
|  +--------------------------------------------------------+  |
|  |  #1                                                    |  |
|  |                                                        |  |
|  |  #ML8X42                                      6:42     |  |
|  |  (GRANDE - 24px)                                       |  |
|  |                                                        |  |
|  |        PIZZA CALABRESA                                 |  |
|  |     (MUITO GRANDE - 30px)                              |  |
|  |                                                        |  |
|  |  [          INICIAR          ]                         |  |
|  +--------------------------------------------------------+  |
|                                                              |
|  +--------------------------------------------------------+  |
|  |  #2                                                    |  |
|  |                                                        |  |
|  |  #ML8Y99                                      2:15     |  |
|  |                                                        |  |
|  |        PIZZA QUATRO QUEIJOS                            |  |
|  |                                                        |  |
|  |  [           INICIAR           ]                       |  |
|  +--------------------------------------------------------+  |
|                                                              |
|  +--------------------------------------------------------+  |
|  |  #3                                                    |  |
|  |                                                        |  |
|  |  #ML8Z77                                      0:45     |  |
|  |                                                        |  |
|  |        2x PIZZA MARGHERITA                             |  |
|  |                                                        |  |
|  |  [           INICIAR           ]                       |  |
|  +--------------------------------------------------------+  |
|                                                              |
+--------------------------------------------------------------+
```

---

## Arquivos a Modificar

| Arquivo | Mudancas |
|---------|----------|
| `src/components/kds/SectorQueuePanel.tsx` | Mudar grid para `flex-col` |
| `src/components/kds/KDSItemCard.tsx` | Aumentar fontes do pedido e sabor, padding |

---

## Resumo das Mudancas de Fonte

| Elemento | Antes | Depois |
|----------|-------|--------|
| Numero do pedido (`#ML8X`) | 12px (`text-xs`) | 24px (`text-2xl font-bold`) |
| Nome do produto | ~16px (`font-semibold`) | 30px (`text-3xl font-bold`) |
| Padding do card | 12px (`p-3`) | 20px (`p-5`) |
| Layout | Grid 4 colunas | Coluna unica centralizada |

