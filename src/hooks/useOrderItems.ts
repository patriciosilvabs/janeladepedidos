import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { OrderItemWithOrder, ClaimResult, OvenResult, ItemStatus } from '@/types/orderItems';
import { useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';

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
          sectors(id, name)
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
    const channel = supabase
      .channel('order-items-realtime')
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
      queryClient.invalidateQueries({ queryKey: ['order-items'] });
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
      if (!result.success) {
        throw new Error('Não foi possível marcar o item como pronto');
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
  };
}
