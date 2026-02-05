 import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
 import { supabase } from '@/integrations/supabase/client';
 import { RealtimeChannel } from '@supabase/supabase-js';
 import { useDebouncedCallback } from '@/hooks/useDebouncedCallback';
 
 interface SectorPresence {
   sectorId: string;
   userId: string;
   isOnline: boolean;
   lastSeenAt: string;
 }
 
 interface SectorStatus {
   sectorId: string;
   operatorCount: number;
   isAvailable: boolean;
 }
 
 interface PresenceContextValue {
   sectorStatuses: Map<string, SectorStatus>;
   getSectorStatus: (sectorId: string) => SectorStatus | undefined;
   isAnyOperatorOnline: (sectorId: string) => boolean;
   getOnlineOperatorCount: (sectorId: string) => number;
   refreshPresence: () => Promise<void>;
 }
 
 const PresenceContext = createContext<PresenceContextValue | null>(null);
 
 export function usePresence() {
   const context = useContext(PresenceContext);
   if (!context) {
     throw new Error('usePresence must be used within a PresenceProvider');
   }
   return context;
 }
 
 interface PresenceProviderProps {
   children: ReactNode;
 }
 
 export function PresenceProvider({ children }: PresenceProviderProps) {
   const [sectorStatuses, setSectorStatuses] = useState<Map<string, SectorStatus>>(new Map());
   const channelRef = useRef<RealtimeChannel | null>(null);
 
   // Fetch current presence data
   const fetchPresence = useCallback(async () => {
     try {
       const thirtySecondsAgo = new Date(Date.now() - 30000).toISOString();
       
       const { data, error } = await supabase
         .from('sector_presence')
         .select('sector_id, user_id, is_online, last_seen_at')
         .eq('is_online', true)
         .gte('last_seen_at', thirtySecondsAgo);
 
       if (error) {
         console.error('[Presence] Failed to fetch presence:', error);
         return;
       }
 
       // Group by sector
       const statusMap = new Map<string, SectorStatus>();
       
       if (data) {
         const sectorCounts = new Map<string, number>();
         
         for (const presence of data) {
           const count = sectorCounts.get(presence.sector_id) || 0;
           sectorCounts.set(presence.sector_id, count + 1);
         }
         
         for (const [sectorId, count] of sectorCounts) {
           statusMap.set(sectorId, {
             sectorId,
             operatorCount: count,
             isAvailable: count > 0,
           });
         }
       }
 
       setSectorStatuses(statusMap);
     } catch (error) {
       console.error('[Presence] Error fetching presence:', error);
     }
   }, []);
 
   // Debounced fetch for realtime updates
   const debouncedFetch = useDebouncedCallback(fetchPresence, 100);
 
   // Subscribe to realtime changes
   useEffect(() => {
     // Initial fetch
     fetchPresence();
 
     // Subscribe to presence changes
     channelRef.current = supabase
       .channel('sector-presence-changes')
       .on(
         'postgres_changes',
         {
           event: '*',
           schema: 'public',
           table: 'sector_presence',
         },
         () => {
           debouncedFetch();
         }
       )
       .subscribe();
 
     // Periodic refresh to handle stale presence
     const refreshInterval = setInterval(() => {
       fetchPresence();
     }, 15000); // Refresh every 15 seconds
 
     return () => {
       if (channelRef.current) {
         supabase.removeChannel(channelRef.current);
         channelRef.current = null;
       }
       clearInterval(refreshInterval);
     };
   }, [fetchPresence, debouncedFetch]);
 
   const getSectorStatus = useCallback((sectorId: string) => {
     return sectorStatuses.get(sectorId);
   }, [sectorStatuses]);
 
   const isAnyOperatorOnline = useCallback((sectorId: string) => {
     const status = sectorStatuses.get(sectorId);
     return status?.isAvailable ?? false;
   }, [sectorStatuses]);
 
   const getOnlineOperatorCount = useCallback((sectorId: string) => {
     const status = sectorStatuses.get(sectorId);
     return status?.operatorCount ?? 0;
   }, [sectorStatuses]);
 
   const value: PresenceContextValue = {
     sectorStatuses,
     getSectorStatus,
     isAnyOperatorOnline,
     getOnlineOperatorCount,
     refreshPresence: fetchPresence,
   };
 
   return (
     <PresenceContext.Provider value={value}>
       {children}
     </PresenceContext.Provider>
   );
 }