 import { useEffect, useRef, useCallback } from 'react';
 import { supabase } from '@/integrations/supabase/client';
 import { useAuth } from '@/contexts/AuthContext';
 
 const HEARTBEAT_INTERVAL = 10000; // 10 seconds
 const PRESENCE_TIMEOUT = 30000; // 30 seconds
 
 interface UseSectorPresenceOptions {
   sectorId?: string;
   enabled?: boolean;
 }
 
 export function useSectorPresence({ sectorId, enabled = true }: UseSectorPresenceOptions) {
   const { user } = useAuth();
   const heartbeatRef = useRef<NodeJS.Timeout | null>(null);
   const isActiveRef = useRef(true);
 
   // Register or update presence
   const updatePresence = useCallback(async () => {
     if (!user?.id || !sectorId || !isActiveRef.current) return;
     
     try {
       await supabase.rpc('upsert_sector_presence', {
         p_sector_id: sectorId,
         p_user_id: user.id,
       });
     } catch (error) {
       console.error('[Presence] Failed to update presence:', error);
     }
   }, [user?.id, sectorId]);
 
   // Remove presence (mark as offline)
   const removePresence = useCallback(async () => {
     if (!user?.id || !sectorId) return;
     
     try {
       await supabase.rpc('remove_sector_presence', {
         p_sector_id: sectorId,
         p_user_id: user.id,
       });
     } catch (error) {
       console.error('[Presence] Failed to remove presence:', error);
     }
   }, [user?.id, sectorId]);
 
   useEffect(() => {
     if (!enabled || !user?.id || !sectorId) return;
 
     isActiveRef.current = true;
 
     // Register initial presence
     updatePresence();
 
     // Setup heartbeat interval
     heartbeatRef.current = setInterval(() => {
       if (isActiveRef.current && !document.hidden) {
         updatePresence();
       }
     }, HEARTBEAT_INTERVAL);
 
     // Handle visibility changes
     const handleVisibilityChange = () => {
       if (document.hidden) {
         // Tab is hidden - pause heartbeat but don't remove presence yet
         isActiveRef.current = false;
       } else {
         // Tab is visible again - resume and send immediate heartbeat
         isActiveRef.current = true;
         updatePresence();
       }
     };
 
     // Handle before unload (page close/refresh)
     const handleBeforeUnload = () => {
       // Use sendBeacon for reliable cleanup on page unload
       removePresence();
     };
 
     document.addEventListener('visibilitychange', handleVisibilityChange);
     window.addEventListener('beforeunload', handleBeforeUnload);
 
     return () => {
       isActiveRef.current = false;
       
       if (heartbeatRef.current) {
         clearInterval(heartbeatRef.current);
         heartbeatRef.current = null;
       }
       
       document.removeEventListener('visibilitychange', handleVisibilityChange);
       window.removeEventListener('beforeunload', handleBeforeUnload);
       
       // Remove presence on cleanup
       removePresence();
     };
   }, [enabled, user?.id, sectorId, updatePresence, removePresence]);
 
   return {
     updatePresence,
     removePresence,
   };
 }