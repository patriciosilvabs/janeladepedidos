import { createClient } from '@supabase/supabase-js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse request body
    const { offline_sector_id, cleanup_stale, cleanup_stale_pending } = await req.json().catch(() => ({}));

    console.log('[redistribute-items] Request received:', { offline_sector_id, cleanup_stale, cleanup_stale_pending });

    // Option 1: Cleanup stale presence and redistribute offline sectors
    if (cleanup_stale) {
      // First, mark stale presence as offline
      const { data: cleanupData, error: cleanupError } = await supabase.rpc('cleanup_stale_presence');
      
      if (cleanupError) {
        console.error('[redistribute-items] Cleanup error:', cleanupError);
        throw cleanupError;
      }

      console.log('[redistribute-items] Cleaned up stale presence:', cleanupData);

      // Find sectors that just went offline (have items but no online operators)
      const { data: offlineSectors, error: offlineError } = await supabase
        .from('sectors')
        .select(`
          id,
          name,
          order_items!order_items_assigned_sector_id_fkey(id)
        `)
        .eq('view_type', 'kds');

      if (offlineError) {
        console.error('[redistribute-items] Error fetching sectors:', offlineError);
        throw offlineError;
      }

      let totalRedistributed = 0;

      for (const sector of offlineSectors || []) {
        // Check if sector has any online operators
        const { data: presenceData } = await supabase
          .from('sector_presence')
          .select('id')
          .eq('sector_id', sector.id)
          .eq('is_online', true)
          .gte('last_seen_at', new Date(Date.now() - 30000).toISOString())
          .limit(1);

        // If no online operators and has pending items, redistribute
        if (!presenceData?.length) {
          const { data: redistributed, error: redistError } = await supabase.rpc(
            'redistribute_offline_sector_items',
            { p_offline_sector_id: sector.id }
          );

          if (redistError) {
            console.error(`[redistribute-items] Error redistributing from ${sector.name}:`, redistError);
          } else if (redistributed > 0) {
            console.log(`[redistribute-items] Redistributed ${redistributed} items from ${sector.name}`);
            totalRedistributed += redistributed;
          }
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          stale_cleaned: cleanupData,
          items_redistributed: totalRedistributed,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Option 2: Cleanup stale pending items (items pending too long without anyone starting)
    if (cleanup_stale_pending) {
      // Read timeout from app_settings
      const { data: settingsData, error: settingsError } = await supabase
        .from('app_settings')
        .select('pending_redistribution_minutes')
        .eq('id', 'default')
        .maybeSingle();

      if (settingsError) {
        console.error('[redistribute-items] Error reading settings:', settingsError);
        throw settingsError;
      }

      const timeoutMinutes = settingsData?.pending_redistribution_minutes ?? 3;

      console.log(`[redistribute-items] Checking stale pending items (timeout: ${timeoutMinutes}min)`);

      const { data: redistributed, error: redistError } = await supabase.rpc(
        'redistribute_stale_pending_items',
        { p_timeout_minutes: timeoutMinutes }
      );

      if (redistError) {
        console.error('[redistribute-items] Stale pending redistribution error:', redistError);
        throw redistError;
      }

      if (redistributed > 0) {
        console.log(`[redistribute-items] Redistributed ${redistributed} stale pending items`);
      }

      return new Response(
        JSON.stringify({
          success: true,
          stale_pending_redistributed: redistributed,
          timeout_minutes: timeoutMinutes,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Option 3: Redistribute from specific offline sector
    if (offline_sector_id) {
      const { data: redistributed, error } = await supabase.rpc(
        'redistribute_offline_sector_items',
        { p_offline_sector_id: offline_sector_id }
      );

      if (error) {
        console.error('[redistribute-items] Redistribution error:', error);
        throw error;
      }

      console.log(`[redistribute-items] Redistributed ${redistributed} items from sector ${offline_sector_id}`);

      return new Response(
        JSON.stringify({
          success: true,
          items_redistributed: redistributed,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Missing offline_sector_id, cleanup_stale, or cleanup_stale_pending parameter' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[redistribute-items] Error:', error);
    return new Response(
     JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
