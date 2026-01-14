import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Starting cleanup of old orders...');

    // 1. Get max_order_age_hours from app_settings
    const { data: settings, error: settingsError } = await supabase
      .from('app_settings')
      .select('max_order_age_hours')
      .eq('id', 'default')
      .single();

    if (settingsError) {
      console.error('Error fetching settings:', settingsError);
      throw new Error('Failed to fetch app settings');
    }

    const maxAgeHours = settings?.max_order_age_hours || 24;
    console.log(`Max order age: ${maxAgeHours} hours`);

    // 2. Calculate cutoff date
    const cutoffDate = new Date();
    cutoffDate.setHours(cutoffDate.getHours() - maxAgeHours);
    const cutoffISO = cutoffDate.toISOString();
    console.log(`Cutoff date: ${cutoffISO}`);

    // 3. Delete old orders that are still pending or waiting_buffer
    // We don't delete dispatched orders as they may be needed for history
    const { data: deletedOrders, error: deleteError } = await supabase
      .from('orders')
      .delete()
      .lt('created_at', cutoffISO)
      .in('status', ['pending', 'waiting_buffer'])
      .select('id, customer_name, status, created_at');

    if (deleteError) {
      console.error('Error deleting old orders:', deleteError);
      throw new Error('Failed to delete old orders');
    }

    const deletedCount = deletedOrders?.length || 0;
    console.log(`Deleted ${deletedCount} old orders`);

    // Log details of deleted orders for audit
    if (deletedOrders && deletedOrders.length > 0) {
      console.log('Deleted orders:', deletedOrders.map(o => ({
        id: o.id,
        customer: o.customer_name,
        status: o.status,
        created_at: o.created_at
      })));
    }

    // 4. Also cleanup orphaned delivery groups (groups with no orders)
    const { data: orphanedGroups, error: groupError } = await supabase
      .from('delivery_groups')
      .delete()
      .eq('order_count', 0)
      .select('id');

    const orphanedGroupsCount = orphanedGroups?.length || 0;
    if (orphanedGroupsCount > 0) {
      console.log(`Cleaned up ${orphanedGroupsCount} orphaned delivery groups`);
    }

    const response = {
      success: true,
      deleted: deletedCount,
      orphanedGroupsCleaned: orphanedGroupsCount,
      maxAgeHours,
      cutoffDate: cutoffISO,
      message: deletedCount > 0 
        ? `${deletedCount} pedido${deletedCount > 1 ? 's' : ''} antigo${deletedCount > 1 ? 's' : ''} removido${deletedCount > 1 ? 's' : ''}`
        : 'Nenhum pedido antigo encontrado'
    };

    console.log('Cleanup completed:', response);

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Cleanup error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: errorMessage 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
