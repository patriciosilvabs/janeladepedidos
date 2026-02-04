

# Corrigir Atribuicao de Setor no Simulador de Pedidos

## Problema Identificado

Quando o simulador cria pedidos, os itens sao criados com `assigned_sector_id = NULL`:

```
| product_name          | assigned_sector_id |
|-----------------------|--------------------|
| Pizza Margherita      | NULL               |
| Pizza Quatro Queijos  | NULL               |
| Pizza Portuguesa      | NULL               |
```

Como os usuarios de setores (Bancada A, Bancada B) filtram por `assigned_sector_id`, eles **nao veem nenhum item** quando o valor e NULL.

## Causa Raiz

No `OrderSimulator.tsx`, a funcao RPC e chamada com setor null:

```typescript
await supabase.rpc('create_order_items_from_json', {
  p_order_id: order.id,
  p_items: itemsJson,
  p_default_sector_id: null,  // <-- Problema aqui!
});
```

## Solucao

Adicionar um campo de selecao de **setor padrao** no simulador de pedidos, permitindo que o admin escolha para qual setor os itens serao atribuidos.

---

## Mudancas Necessarias

### Arquivo: `src/components/OrderSimulator.tsx`

1. Importar o hook `useSectors`
2. Adicionar estado `sectorId` para o setor selecionado
3. Renderizar um `<Select>` para escolher o setor
4. Passar o `sectorId` na chamada RPC em vez de `null`

```typescript
// Adicionar imports
import { useSectors } from '@/hooks/useSectors';

// Dentro do componente
const { sectors } = useSectors();
const kdsSectors = sectors?.filter(s => s.view_type === 'kds') ?? [];
const [sectorId, setSectorId] = useState<string | null>(null);

// No handleSubmit, usar o sectorId selecionado
const { error: itemsError } = await supabase.rpc(
  'create_order_items_from_json',
  {
    p_order_id: order.id,
    p_items: itemsJson,
    p_default_sector_id: sectorId,  // <-- Agora usa o setor selecionado
  }
);
```

---

## Fluxo Corrigido

```text
Admin abre Simulador de Pedidos
        |
        v
Seleciona setor: "BANCADA A" ou "BANCADA B"
        |
        v
Cria pedido simulado
        |
        v
Itens criados com assigned_sector_id = 'uuid-bancada-a'
        |
        v
Usuario da BANCADA A ve os itens em tempo real!
```

---

## Interface do Usuario

O simulador tera um novo campo "Setor de Producao":

| Campo              | Valor                          |
|--------------------|--------------------------------|
| Cliente            | Joao Silva                     |
| Bairro             | Manaira                        |
| Loja (opcional)    | Sem loja especifica            |
| **Setor de Producao** | BANCADA A / BANCADA B / DESPACHO |
| Itens do Pedido    | Pizza Margherita (1)           |

---

## Arquivos a Modificar

| Arquivo | Alteracao |
|---------|-----------|
| `src/components/OrderSimulator.tsx` | Adicionar selecao de setor |

---

## Comportamento Final

| Cenario | Resultado |
|---------|-----------|
| Admin simula pedido com setor "BANCADA A" | Itens aparecem para usuario da BANCADA A |
| Admin simula pedido com setor "BANCADA B" | Itens aparecem para usuario da BANCADA B |
| Admin simula pedido sem setor (null) | Itens aparecem apenas para admins (todos) |

