import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { OrderItemWithOrder, ClaimResult, OvenResult, ItemStatus } from '@/types/orderItems';
import { useEffect, useRef, useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
 
 interface EdgeCompletionResult {
   success: boolean;
   error?: string;
   message?: string;
   item_id?: string;
   moved_to_sector?: string;
 }

interface UseOrderItemsOptions {
  sectorId?: string;
  status?: ItemStatus | ItemStatus[];
}

export function useOrderItems(options: UseOrderItemsOptions = {}) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { sectorId, status } = options;

  // Fetch order items with related data
  const { data: items = [], isLoading, error } = useQuery({
    queryKey: ['order-items', sectorId, status],
    queryFn: async () => {
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

      if (sectorId) {
        query = query.eq('assigned_sector_id', sectorId);
      }

      if (status) {
        if (Array.isArray(status)) {
          query = query.in('status', status);
        } else {
          query = query.eq('status', status);
        }
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as unknown as OrderItemWithOrder[];
    },
    staleTime: 1000,
  });

  // Realtime subscription with debounce
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const debouncedInvalidate = useCallback(() => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
    debounceTimeoutRef.current = setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: ['order-items'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    }, 50);
  }, [queryClient]);

  useEffect(() => {
    // Gerar nome único para esta instância do hook - evita conflitos entre dispositivos/tabs
    const channelName = `order-items-${crypto.randomUUID()}`;
    
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'order_items' },
        debouncedInvalidate
      )
      .subscribe();

    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
      supabase.removeChannel(channel);
    };
  }, [debouncedInvalidate]);

  // Claim item - pessimistic locking for 9+ tablets
  const claimItem = useMutation({
    mutationFn: async (itemId: string) => {
      if (!user?.id) throw new Error('Usuário não autenticado');

      const { data, error } = await supabase.rpc('claim_order_item', {
        p_item_id: itemId,
        p_user_id: user.id,
      });

      if (error) throw error;
      
      const result = data as unknown as ClaimResult;
      if (!result.success) {
        throw new Error(result.message || 'Não foi possível capturar o item');
      }

      return result;
    },
    onMutate: async (itemId) => {
      await queryClient.cancelQueries({ queryKey: ['order-items'] });
      const previousItems = queryClient.getQueryData<OrderItemWithOrder[]>(['order-items', sectorId, status]);

      queryClient.setQueryData<OrderItemWithOrder[]>(['order-items', sectorId, status], (old) =>
        old?.map((item) =>
          item.id === itemId
            ? {
                ...item,
                status: 'in_prep' as const,
                claimed_by: user?.id || null,
                claimed_at: new Date().toISOString(),
              }
            : item
        ) ?? []
      );

      return { previousItems };
    },
    onError: (_err, _itemId, context) => {
      if (context?.previousItems) {
        queryClient.setQueryData(['order-items', sectorId, status], context.previousItems);
      }
    },
    onSettled: () => {
      // Delay para evitar flicker visual durante transição otimística
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['order-items'] });
      }, 100);
    },
  });

  // Release claim
  const releaseItem = useMutation({
    mutationFn: async (itemId: string) => {
      if (!user?.id) throw new Error('Usuário não autenticado');

      const { data, error } = await supabase.rpc('release_item_claim', {
        p_item_id: itemId,
        p_user_id: user.id,
      });

      if (error) throw error;
      
      const result = data as unknown as ClaimResult;
      if (!result.success) {
        throw new Error(result.message || 'Não foi possível liberar o item');
      }

      return result;
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['order-items'] });
    },
  });

   // Complete edge preparation and move to next sector
   const completeEdgePreparation = useMutation({
     mutationFn: async (itemId: string) => {
       if (!user?.id) throw new Error('Usuário não autenticado');
 
       const { data, error } = await supabase.rpc('complete_edge_preparation', {
         p_item_id: itemId,
         p_user_id: user.id,
       });
 
       if (error) throw error;
       
       const result = data as unknown as EdgeCompletionResult;
       if (!result.success) {
         throw new Error(result.message || 'Não foi possível mover o item');
       }
 
       return result;
     },
     onMutate: async (itemId) => {
       await queryClient.cancelQueries({ queryKey: ['order-items'] });
       const previousItems = queryClient.getQueryData<OrderItemWithOrder[]>(['order-items', sectorId, status]);
 
       // Remove item from current sector view (it will appear in new sector)
       queryClient.setQueryData<OrderItemWithOrder[]>(['order-items', sectorId, status], (old) =>
         old?.filter((item) => item.id !== itemId) ?? []
       );
 
       return { previousItems };
     },
     onError: (_err, _itemId, context) => {
       if (context?.previousItems) {
         queryClient.setQueryData(['order-items', sectorId, status], context.previousItems);
       }
     },
     onSettled: () => {
       queryClient.invalidateQueries({ queryKey: ['order-items'] });
     },
   });
 
  // Send to oven
  const sendToOven = useMutation({
    mutationFn: async ({ itemId, ovenTimeSeconds = 120 }: { itemId: string; ovenTimeSeconds?: number }) => {
      if (!user?.id) throw new Error('Usuário não autenticado');

      const { data, error } = await supabase.rpc('send_to_oven', {
        p_item_id: itemId,
        p_user_id: user.id,
        p_oven_time_seconds: ovenTimeSeconds,
      });

      if (error) throw error;
      
      const result = data as unknown as OvenResult;
      if (!result.success) {
        throw new Error(result.message || 'Não foi possível enviar ao forno');
      }

      return result;
    },
    onMutate: async ({ itemId }) => {
      await queryClient.cancelQueries({ queryKey: ['order-items'] });
      const previousItems = queryClient.getQueryData<OrderItemWithOrder[]>(['order-items', sectorId, status]);

      const now = new Date();
      const exitTime = new Date(now.getTime() + 120 * 1000);

      queryClient.setQueryData<OrderItemWithOrder[]>(['order-items', sectorId, status], (old) =>
        old?.map((item) =>
          item.id === itemId
            ? {
                ...item,
                status: 'in_oven' as const,
                oven_entry_at: now.toISOString(),
                estimated_exit_at: exitTime.toISOString(),
              }
            : item
        ) ?? []
      );

      return { previousItems };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousItems) {
        queryClient.setQueryData(['order-items', sectorId, status], context.previousItems);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['order-items'] });
    },
  });

  // Mark as ready
  const markItemReady = useMutation({
    mutationFn: async (itemId: string) => {
      const { data, error } = await supabase.rpc('mark_item_ready', {
        p_item_id: itemId,
      });

      if (error) throw error;
      
      const result = data as unknown as { success: boolean; error?: string };
      
      // Tratar 'not_in_oven' como sucesso silencioso
      // Isso significa que o item já foi marcado como pronto por outra requisição
      if (!result.success && result.error === 'not_in_oven') {
        console.log(`[markItemReady] Item ${itemId} já foi marcado como pronto`);
        return { success: true, already_processed: true };
      }
      
      if (!result.success) {
        throw new Error(result.error || 'Não foi possível marcar o item como pronto');
      }

      return result;
    },
    onMutate: async (itemId) => {
      await queryClient.cancelQueries({ queryKey: ['order-items'] });
      const previousItems = queryClient.getQueryData<OrderItemWithOrder[]>(['order-items', sectorId, status]);

      queryClient.setQueryData<OrderItemWithOrder[]>(['order-items', sectorId, status], (old) =>
        old?.map((item) =>
          item.id === itemId
            ? {
                ...item,
                status: 'ready' as const,
                ready_at: new Date().toISOString(),
              }
            : item
        ) ?? []
      );

      return { previousItems };
    },
    onError: (_err, _itemId, context) => {
      if (context?.previousItems) {
        queryClient.setQueryData(['order-items', sectorId, status], context.previousItems);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['order-items'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });

  // Collect order IDs that have at least one in_oven item
  const ovenOrderIds = useMemo(() => 
    items
      .filter(i => i.status === 'in_oven')
      .map(i => i.order_id)
      .filter((v, i, a) => a.indexOf(v) === i),
    [items]
  );

  // Fetch sibling items for orders that have in_oven items
  const { data: siblingItems = [] } = useQuery({
    queryKey: ['order-items-siblings', ovenOrderIds],
    queryFn: async () => {
      if (ovenOrderIds.length === 0) return [];
      const { data, error } = await supabase
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
        .in('order_id', ovenOrderIds)
        .neq('status', 'in_oven')
        .neq('status', 'cancelled');
      if (error) throw error;
      return data as unknown as OrderItemWithOrder[];
    },
    enabled: ovenOrderIds.length > 0,
    staleTime: 1000,
  });

  // Group items by order
  const itemsByOrder = items.reduce((acc, item) => {
    const orderId = item.order_id;
    if (!acc[orderId]) {
      acc[orderId] = [];
    }
    acc[orderId].push(item);
    return acc;
  }, {} as Record<string, OrderItemWithOrder[]>);

  // Group items by status
  const pendingItems = items.filter((i) => i.status === 'pending');
  const inPrepItems = items.filter((i) => i.status === 'in_prep');
  const inOvenItems = items.filter((i) => i.status === 'in_oven');
  const readyItems = items.filter((i) => i.status === 'ready');

  return {
    items,
    itemsByOrder,
    siblingItems,
    pendingItems,
    inPrepItems,
    inOvenItems,
    readyItems,
    isLoading,
    error,
    claimItem,
    releaseItem,
    sendToOven,
    markItemReady,
    completeEdgePreparation,
  };
}
