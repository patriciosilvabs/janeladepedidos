import { createClient } from '@supabase/supabase-js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
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

    // Check if force cleanup of error orders was requested
    const body = await req.json().catch(() => ({}));
    const forceCleanupErrors = body?.force_cleanup_errors === true;
    const cleanupDispatched = body?.cleanup_dispatched === true;
    console.log(`Force cleanup errors: ${forceCleanupErrors}, Cleanup all dispatched: ${cleanupDispatched}`);

    // 3. Delete old orders that are still pending or waiting_buffer
    const { data: deletedPendingOrders, error: deleteError } = await supabase
      .from('orders')
      .delete()
      .lt('created_at', cutoffISO)
      .in('status', ['pending', 'waiting_buffer'])
      .select('id, customer_name, status, created_at');

    if (deleteError) {
      console.error('Error deleting old pending orders:', deleteError);
      throw new Error('Failed to delete old pending orders');
    }

    const deletedPendingCount = deletedPendingOrders?.length || 0;
    console.log(`Deleted ${deletedPendingCount} old pending/buffer orders`);

    // 4. Delete dispatched orders (all if cleanup_dispatched=true, or only old ones)
    let deletedDispatchedCount = 0;
    if (cleanupDispatched) {
      // Force delete ALL dispatched orders
      const { data: deletedDispatchedOrders, error: deleteDispatchedError } = await supabase
        .from('orders')
        .delete()
        .eq('status', 'dispatched')
        .select('id, customer_name, status, created_at');

      if (deleteDispatchedError) {
        console.error('Error deleting all dispatched orders:', deleteDispatchedError);
      } else {
        deletedDispatchedCount = deletedDispatchedOrders?.length || 0;
        console.log(`Force deleted ${deletedDispatchedCount} dispatched orders`);
      }
    } else {
      // Original behavior: only delete old dispatched orders
      const { data: deletedDispatchedOrders, error: deleteDispatchedError } = await supabase
        .from('orders')
        .delete()
        .lt('created_at', cutoffISO)
        .eq('status', 'dispatched')
        .select('id, customer_name, status, created_at');

      if (deleteDispatchedError) {
        console.error('Error deleting old dispatched orders:', deleteDispatchedError);
      } else {
        deletedDispatchedCount = deletedDispatchedOrders?.length || 0;
        console.log(`Deleted ${deletedDispatchedCount} old dispatched orders`);
      }
    }

    // 5. Delete orders with errors (either immediately if forced, or if older than 48h)
    let deletedErrorsCount = 0;
    if (forceCleanupErrors) {
      // Force delete all orders with errors
      const { data: deletedErrorOrders, error: deleteErrorsError } = await supabase
        .from('orders')
        .delete()
        .or('foody_error.not.is.null,notification_error.not.is.null')
        .select('id, customer_name, status, foody_error, notification_error');

      if (deleteErrorsError) {
        console.error('Error deleting error orders:', deleteErrorsError);
      } else {
        deletedErrorsCount = deletedErrorOrders?.length || 0;
        console.log(`Force deleted ${deletedErrorsCount} orders with errors`);
      }
    } else {
      // Delete error orders older than 48 hours
      const errorCutoffDate = new Date();
      errorCutoffDate.setHours(errorCutoffDate.getHours() - 48);
      const errorCutoffISO = errorCutoffDate.toISOString();

      const { data: deletedErrorOrders, error: deleteErrorsError } = await supabase
        .from('orders')
        .delete()
        .lt('created_at', errorCutoffISO)
        .or('foody_error.not.is.null,notification_error.not.is.null')
        .select('id, customer_name, status, foody_error, notification_error');

      if (deleteErrorsError) {
        console.error('Error deleting old error orders:', deleteErrorsError);
      } else {
        deletedErrorsCount = deletedErrorOrders?.length || 0;
        console.log(`Deleted ${deletedErrorsCount} old orders with errors`);
      }
    }

    const totalDeletedCount = deletedPendingCount + deletedDispatchedCount + deletedErrorsCount;

    // Log summary
    console.log('Cleanup summary:', {
      pending: deletedPendingCount,
      dispatched: deletedDispatchedCount,
      errors: deletedErrorsCount,
      total: totalDeletedCount,
    });

    // 6. Also cleanup orphaned delivery groups (groups with no orders)
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
      deleted: totalDeletedCount,
      deletedPending: deletedPendingCount,
      deletedDispatched: deletedDispatchedCount,
      deletedErrors: deletedErrorsCount,
      orphanedGroupsCleaned: orphanedGroupsCount,
      maxAgeHours,
      cutoffDate: cutoffISO,
      message: totalDeletedCount > 0 
        ? `${totalDeletedCount} pedido${totalDeletedCount > 1 ? 's' : ''} removido${totalDeletedCount > 1 ? 's' : ''}`
        : 'Nenhum pedido para limpar'
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
