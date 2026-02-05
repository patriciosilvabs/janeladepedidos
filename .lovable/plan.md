
# Plano: Corrigir Erro de Carregamento de Itens na BANCADA - BORDAS

## Problema Identificado

A query do `useOrderItems.ts` falha com erro **PGRST201** porque a tabela `order_items` agora possui **duas** chaves estrangeiras para a tabela `sectors`:

1. `assigned_sector_id` - setor onde o item esta atualmente
2. `next_sector_id` - proximo setor (para roteamento de bordas)

O Supabase nao consegue determinar automaticamente qual relacionamento usar e retorna status **300** (Multiple Choices).

## Solucao

Especificar explicitamente qual foreign key usar no select do Supabase:

```text
Antes:  sectors(id, name)
Depois: sectors!order_items_assigned_sector_id_fkey(id, name)
```

## Mudancas Necessarias

| Arquivo | Mudanca |
|---------|---------|
| `src/hooks/useOrderItems.ts` | Alterar a query para especificar a foreign key correta |

## Codigo Atualizado

```typescript
// Linha 31-43 de useOrderItems.ts
let query = supabase
  .from('order_items')
  .select(`
    *,
    orders!inner(
      id,
      customer_name,
      cardapioweb_order_id,
      external_id,
      neighborhood,
      address,
      stores(id, name)
    ),
    sectors!order_items_assigned_sector_id_fkey(id, name)
  `)
  .order('created_at', { ascending: true });
```

## Por que isso funciona

O Supabase PostgREST usa o nome da foreign key constraint para desambiguar relacionamentos. Ao especificar `sectors!order_items_assigned_sector_id_fkey`, informamos explicitamente que queremos usar a relacao via `assigned_sector_id`.

## Impacto

- **Corrige** o erro "Erro ao carregar itens" na BANCADA - BORDAS
- **Corrige** o mesmo erro em todos os outros setores KDS
- **Nao afeta** a logica de roteamento de bordas ja implementada
