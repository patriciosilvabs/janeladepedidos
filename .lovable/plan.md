

# Restringir Visualização do KDS "Por Pedido" ao Setor do Usuário

## Problema Atual

No modo **"Por Pedido"** (`KDSDashboard`), usuários vinculados a um setor específico ainda veem **todos os pedidos pendentes**, em vez de apenas os pedidos que contêm itens do seu setor.

**Cenário:**
- Usuário `user-a@domhelderpizzaria.com.br` está vinculado ao setor "BANCADA A"
- Deveria ver apenas pedidos que têm itens atribuídos ao setor "BANCADA A"
- Atualmente vê todos os pedidos do sistema

## Análise Técnica

| Tabela | Campo de Setor |
|--------|----------------|
| `orders` | Não tem `sector_id` |
| `order_items` | `assigned_sector_id` |

Um pedido pode ter itens de **múltiplos setores** (ex: uma pizza na BANCADA A e um doce na BANCADA B).

## Solução Proposta

### Abordagem: Filtrar Pedidos por Itens do Setor

Se o usuário tem setor vinculado, buscar apenas pedidos que tenham pelo menos um `order_item` com `assigned_sector_id = userSector.id`.

### Mudanças Necessárias

**Arquivo: `src/hooks/useOrders.ts`**

Adicionar parâmetro opcional `sectorId` para filtrar pedidos:

```typescript
interface UseOrdersOptions {
  sectorId?: string;
}

export function useOrders(options: UseOrdersOptions = {}) {
  const { sectorId } = options;
  
  const { data: orders = [], isLoading, error } = useQuery({
    queryKey: ['orders', sectorId],
    queryFn: async () => {
      let query = supabase
        .from('orders')
        .select('*, delivery_groups(*), stores(*)')
        .order('created_at', { ascending: true });

      // Se tem filtro de setor, buscar apenas pedidos com itens desse setor
      if (sectorId) {
        // Buscar IDs de pedidos que têm itens neste setor
        const { data: itemData } = await supabase
          .from('order_items')
          .select('order_id')
          .eq('assigned_sector_id', sectorId);
        
        const orderIds = [...new Set(itemData?.map(i => i.order_id) || [])];
        
        if (orderIds.length === 0) {
          return []; // Nenhum pedido para este setor
        }
        
        query = query.in('id', orderIds);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as OrderWithGroup[];
    },
  });
  // ...
}
```

**Arquivo: `src/components/KDSDashboard.tsx`**

Passar o `filterSectorId` para o hook:

```typescript
export function KDSDashboard({ userSector }: KDSDashboardProps) {
  const filterSectorId = userSector?.id;
  
  // Agora filtrado pelo setor do usuário
  const { orders, isLoading, error, markAsReady, markAsReadyUrgent } = useOrders({
    sectorId: filterSectorId,
  });
  // ...
}
```

## Fluxo Corrigido

```text
Usuario KDS faz login
        |
        v
Index.tsx detecta userSector.view_type === 'kds'
        |
        v
Renderiza KDSDashboard com userSector prop
        |
        v
useOrders({ sectorId: userSector.id })
        |
        v
Query busca order_items do setor -> extrai order_ids
        |
        v
Query busca orders com IN(order_ids)
        |
        v
Usuario ve APENAS pedidos com itens do seu setor
```

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/hooks/useOrders.ts` | Aceitar `sectorId` opcional e filtrar query |
| `src/components/KDSDashboard.tsx` | Passar `filterSectorId` para hook |

## Comportamento Final

| Tipo de Usuário | Modo Por Pedido |
|-----------------|-----------------|
| Operador (com setor) | Vê apenas pedidos que contêm itens do seu setor |
| Admin/Owner (sem setor) | Vê todos os pedidos (comportamento atual) |

## Benefícios

- Consistência entre modos "Por Item" e "Por Pedido"
- Operadores focam apenas nos pedidos relevantes ao seu setor
- Administradores mantêm visão global para gerenciamento

