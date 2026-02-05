import { useState, useEffect, useCallback, useRef } from 'react';
import { useSettings } from '@/hooks/useSettings';
import { OrderItemWithOrder } from '@/types/orderItems';
import * as qzTray from '@/lib/qzTray';
import { toast } from 'sonner';
import { queuePrintJob } from '@/hooks/usePrintJobQueue';

// Browser fallback print function
const browserPrintFallback = (item: OrderItemWithOrder) => {
  const orderId = item.orders?.cardapioweb_order_id || 
                  item.orders?.external_id || 
                  item.order_id.slice(0, 8);

  const printWindow = window.open('', '_blank', 'width=300,height=400');
  if (!printWindow) return;

  const content = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Comanda #${orderId}</title>
      <style>
        body { font-family: monospace; padding: 10px; font-size: 14px; }
        .header { text-align: center; border-bottom: 1px dashed #000; padding-bottom: 10px; }
        .order-id { font-size: 24px; font-weight: bold; }
        .item { font-size: 18px; font-weight: bold; margin: 15px 0; }
        .customer { margin-top: 10px; }
        .address { margin-top: 5px; font-size: 12px; }
        .footer { text-align: center; margin-top: 15px; border-top: 1px dashed #000; padding-top: 10px; }
        .notes { color: red; font-weight: bold; margin: 10px 0; }
        .edge { color: #d97706; font-weight: bold; }
        .flavors { margin: 5px 0; padding-left: 10px; }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="order-id">#${orderId}</div>
        ${item.orders?.stores?.name ? `<div>${item.orders.stores.name}</div>` : ''}
      </div>
      <div class="item">
        ${item.quantity > 1 ? item.quantity + 'x ' : ''}${item.product_name}
      </div>
      ${item.flavors ? `<div class="flavors">${item.flavors.split('\n').map(f => `<div>${f}</div>`).join('')}</div>` : ''}
      ${item.edge_type ? `<div class="edge">BORDA: ${item.edge_type}</div>` : ''}
      ${item.complements ? `<div>${item.complements}</div>` : ''}
      ${item.notes ? `<div class="notes">OBS: ${item.notes}</div>` : ''}
      <div class="customer">
        <strong>${item.orders?.customer_name || 'Cliente'}</strong>
      </div>
      <div class="address">
        ${item.orders?.address || ''}
        ${item.orders?.neighborhood ? ' - ' + item.orders.neighborhood : ''}
      </div>
      <div class="footer">
        ${new Date().toLocaleString('pt-BR')}
      </div>
    </body>
    </html>
  `;

  printWindow.document.write(content);
  printWindow.document.close();
  printWindow.print();
};

export interface UseQZTrayReturn {
  isConnected: boolean;
  isConnecting: boolean;
  printers: string[];
  selectedPrinter: string | null;
  isEnabled: boolean;
  isReceiverEnabled: boolean;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  refreshPrinters: () => Promise<void>;
  printReceipt: (item: OrderItemWithOrder) => Promise<void>;
  printOrQueue: (item: OrderItemWithOrder) => Promise<void>;
  printTestPage: () => Promise<void>;
  setSelectedPrinter: (name: string) => Promise<void>;
  setEnabled: (enabled: boolean) => Promise<void>;
  setReceiverEnabled: (enabled: boolean) => Promise<void>;
}

export function useQZTray(): UseQZTrayReturn {
  const { settings, saveSettings } = useSettings();
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [printers, setPrinters] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  // Track if we've attempted auto-connect
  const hasAttemptedConnect = useRef(false);

  // Get values from settings
  const selectedPrinter = settings?.qz_printer_name || null;
  const isEnabled = settings?.qz_print_enabled || false;
  const isReceiverEnabled = settings?.print_receiver_enabled || false;

  // Check connection status periodically
  useEffect(() => {
    const checkConnection = () => {
      const connected = qzTray.getConnectionStatus();
      setIsConnected(connected);
    };

    checkConnection();
    const interval = setInterval(checkConnection, 2000);
    return () => clearInterval(interval);
  }, []);

  // Auto-connect when enabled and QZ is available
  useEffect(() => {
    if (isEnabled && !isConnected && !isConnecting && !hasAttemptedConnect.current) {
      hasAttemptedConnect.current = true;
      
      // Only attempt if QZ library is loaded
      if (qzTray.isQZLoaded()) {
        connect().catch(() => {
          // Silent fail on auto-connect - user can manually retry
        });
      }
    }
  }, [isEnabled, isConnected, isConnecting]);

  const connect = useCallback(async () => {
    setIsConnecting(true);
    setError(null);

    try {
      await qzTray.connect();
      setIsConnected(true);
      
      // Auto-fetch printers after connecting
      const printerList = await qzTray.getPrinters();
      setPrinters(printerList);
      
      toast.success('Conectado ao QZ Tray');
    } catch (err: any) {
      const errorMsg = err?.message || 'Falha ao conectar';
      setError(errorMsg);
      setIsConnected(false);
      throw err;
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    try {
      await qzTray.disconnect();
      setIsConnected(false);
      setPrinters([]);
      toast.info('Desconectado do QZ Tray');
    } catch (err: any) {
      console.error('Disconnect error:', err);
    }
  }, []);

  const refreshPrinters = useCallback(async () => {
    if (!isConnected) {
      setError('Não conectado ao QZ Tray');
      return;
    }

    try {
      const printerList = await qzTray.getPrinters();
      setPrinters(printerList);
      setError(null);
      toast.success(`${printerList.length} impressora(s) encontrada(s)`);
    } catch (err: any) {
      const errorMsg = err?.message || 'Erro ao buscar impressoras';
      setError(errorMsg);
      toast.error(errorMsg);
    }
  }, [isConnected]);

  const printReceipt = useCallback(async (item: OrderItemWithOrder) => {
    // If QZ is enabled and connected with a printer selected, use it
    if (isEnabled && isConnected && selectedPrinter) {
      try {
        await qzTray.printReceipt(selectedPrinter, item);
        console.log('[useQZTray] Silent print successful');
      } catch (err: any) {
        console.error('[useQZTray] QZ print failed, falling back to browser:', err);
        toast.error('Impressão QZ falhou, usando navegador');
        browserPrintFallback(item);
      }
    } else {
      // Fallback to browser print
      browserPrintFallback(item);
    }
  }, [isEnabled, isConnected, selectedPrinter]);

  // Smart print function: local if QZ connected, remote queue if not
  const printOrQueue = useCallback(async (item: OrderItemWithOrder) => {
    // If QZ is connected locally, print directly
    if (isEnabled && isConnected && selectedPrinter) {
      await printReceipt(item);
      return;
    }

    // Otherwise, queue for remote printing
    try {
      await queuePrintJob(item);
      console.log('[useQZTray] Job queued for remote printing');
    } catch (err: any) {
      console.error('[useQZTray] Failed to queue job, falling back to browser:', err);
      toast.error('Falha ao enfileirar impressão');
      browserPrintFallback(item);
    }
  }, [isEnabled, isConnected, selectedPrinter, printReceipt]);

  const printTestPage = useCallback(async () => {
    if (!isConnected) {
      throw new Error('Não conectado ao QZ Tray');
    }

    if (!selectedPrinter) {
      throw new Error('Nenhuma impressora selecionada');
    }

    try {
      await qzTray.printTestPage(selectedPrinter);
      toast.success('Página de teste enviada');
    } catch (err: any) {
      const errorMsg = err?.message || 'Erro ao imprimir teste';
      toast.error(errorMsg);
      throw err;
    }
  }, [isConnected, selectedPrinter]);

  const setSelectedPrinter = useCallback(async (name: string) => {
    try {
      await saveSettings.mutateAsync({ qz_printer_name: name });
    } catch (err) {
      toast.error('Erro ao salvar impressora');
      throw err;
    }
  }, [saveSettings]);

  const setEnabled = useCallback(async (enabled: boolean) => {
    try {
      await saveSettings.mutateAsync({ qz_print_enabled: enabled });
      
      // Reset auto-connect flag when toggling
      hasAttemptedConnect.current = false;
      
      if (!enabled && isConnected) {
        await disconnect();
      }
    } catch (err) {
      toast.error('Erro ao salvar configuração');
      throw err;
    }
  }, [saveSettings, isConnected, disconnect]);

  const setReceiverEnabled = useCallback(async (enabled: boolean) => {
    try {
      await saveSettings.mutateAsync({ print_receiver_enabled: enabled });
    } catch (err) {
      toast.error('Erro ao salvar configuração');
      throw err;
    }
  }, [saveSettings]);

  return {
    isConnected,
    isConnecting,
    printers,
    selectedPrinter,
    isEnabled,
    isReceiverEnabled,
    error,
    connect,
    disconnect,
    refreshPrinters,
    printReceipt,
    printOrQueue,
    printTestPage,
    setSelectedPrinter,
    setEnabled,
    setReceiverEnabled,
  };
}
