

# Corrigir badges de tipo de pedido que nao aparecem

## Problema

Os badges de tipo de pedido (Retirada, Delivery, Balcao) nao aparecem porque os valores salvos no banco de dados nao correspondem aos valores esperados no codigo.

**Valores no banco de dados:**
- `delivery` (216 pedidos) -- funciona
- `takeout` (61 pedidos) -- NAO mapeado
- `closed_table` (8 pedidos) -- NAO mapeado
- `takeaway` (6 pedidos) -- funciona

**Valores no codigo atual:**
- `delivery`, `dine_in`, `takeaway`, `counter`

O valor `takeout` (que eh o mais usado para retirada) nao esta mapeado, por isso o badge nao aparece.

## Solucao

Atualizar o mapeamento em `src/lib/orderTypeUtils.tsx` para incluir todos os valores reais do banco:

| Valor no banco | Label | Cor |
|---|---|---|
| `delivery` | Delivery | Azul |
| `takeout` | Retirada | Laranja |
| `takeaway` | Retirada | Laranja |
| `dine_in` | Mesa | Verde |
| `closed_table` | Mesa Fechada | Verde |
| `counter` | Balcao | Roxo |

## Detalhe Tecnico

Arquivo unico a alterar: `src/lib/orderTypeUtils.tsx`

Adicionar as entradas `takeout` e `closed_table` ao objeto `ORDER_TYPE_CONFIG`:

```typescript
const ORDER_TYPE_CONFIG = {
  delivery:     { label: 'Delivery',      className: 'bg-blue-600 text-white' },
  takeout:      { label: 'Retirada',      className: 'bg-orange-500 text-white' },
  takeaway:     { label: 'Retirada',      className: 'bg-orange-500 text-white' },
  dine_in:      { label: 'Mesa',          className: 'bg-green-600 text-white' },
  closed_table: { label: 'Mesa Fechada',  className: 'bg-green-600 text-white' },
  counter:      { label: 'Balcão',        className: 'bg-purple-600 text-white' },
};
```

Nenhuma outra alteracao necessaria -- os componentes `OvenItemRow`, `OrderOvenBlock` e demais ja usam o `OrderTypeBadge` corretamente; o problema era apenas o mapeamento incompleto.

