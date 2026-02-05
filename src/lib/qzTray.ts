/**
 * QZ Tray Silent Printing Service
 * 
 * Connects to QZ Tray (https://qz.io) for direct printing to thermal printers
 * without browser print dialogs.
 */

import { OrderItemWithOrder } from '@/types/orderItems';

// Type declarations for QZ Tray global
declare global {
  interface Window {
    qz: {
      websocket: {
        connect: () => Promise<void>;
        disconnect: () => Promise<void>;
        isActive: () => boolean;
      };
      printers: {
        find: () => Promise<string[]>;
        getDefault: () => Promise<string>;
      };
      print: (config: any, data: any[]) => Promise<void>;
      configs: {
        create: (printer: string, options?: any) => any;
      };
      security: {
        setCertificatePromise: (callback: (resolve: (cert: string) => void) => void) => void;
        setSignaturePromise: (callback: (toSign: string) => (resolve: (signature: string) => void) => void) => void;
      };
    };
  }
}

// Connection state
let isConnected = false;
let connectionPromise: Promise<void> | null = null;

/**
 * Check if QZ Tray library is loaded
 */
export function isQZLoaded(): boolean {
  return typeof window !== 'undefined' && typeof window.qz !== 'undefined';
}

/**
 * Check if connected to QZ Tray
 */
export function getConnectionStatus(): boolean {
  if (!isQZLoaded()) return false;
  return window.qz.websocket.isActive();
}

/**
 * Connect to QZ Tray local service
 */
export async function connect(): Promise<void> {
  if (!isQZLoaded()) {
    throw new Error('QZ Tray library not loaded. Please install QZ Tray: https://qz.io/download/');
  }

  if (getConnectionStatus()) {
    return; // Already connected
  }

  // Prevent multiple simultaneous connection attempts
  if (connectionPromise) {
    return connectionPromise;
  }

  connectionPromise = (async () => {
    try {
      // Skip certificate for demo/development
      // In production, you should implement proper signing
      window.qz.security.setCertificatePromise((resolve) => {
        resolve('');
      });

      window.qz.security.setSignaturePromise(() => (resolve) => {
        resolve('');
      });

      await window.qz.websocket.connect();
      isConnected = true;
      console.log('[QZ Tray] Connected successfully');
    } catch (error: any) {
      isConnected = false;
      console.error('[QZ Tray] Connection failed:', error);
      throw new Error(error?.message || 'Failed to connect to QZ Tray');
    } finally {
      connectionPromise = null;
    }
  })();

  return connectionPromise;
}

/**
 * Disconnect from QZ Tray
 */
export async function disconnect(): Promise<void> {
  if (!isQZLoaded() || !getConnectionStatus()) {
    return;
  }

  try {
    await window.qz.websocket.disconnect();
    isConnected = false;
    console.log('[QZ Tray] Disconnected');
  } catch (error) {
    console.error('[QZ Tray] Disconnect error:', error);
  }
}

/**
 * Get list of available printers
 */
export async function getPrinters(): Promise<string[]> {
  if (!getConnectionStatus()) {
    throw new Error('Not connected to QZ Tray');
  }

  try {
    const printers = await window.qz.printers.find();
    console.log('[QZ Tray] Found printers:', printers);
    return printers;
  } catch (error: any) {
    console.error('[QZ Tray] Error getting printers:', error);
    throw new Error(error?.message || 'Failed to get printer list');
  }
}

/**
 * Get default system printer
 */
export async function getDefaultPrinter(): Promise<string> {
  if (!getConnectionStatus()) {
    throw new Error('Not connected to QZ Tray');
  }

  try {
    const defaultPrinter = await window.qz.printers.getDefault();
    return defaultPrinter;
  } catch (error: any) {
    console.error('[QZ Tray] Error getting default printer:', error);
    throw new Error(error?.message || 'Failed to get default printer');
  }
}

/**
 * Format receipt content for ESC/POS thermal printer
 */
export function formatReceiptContent(item: OrderItemWithOrder): string[] {
  const orderId = item.orders?.cardapioweb_order_id || 
                  item.orders?.external_id || 
                  item.order_id.slice(0, 8);
  
  const storeName = item.orders?.stores?.name || 'Loja';
  const customerName = item.orders?.customer_name || 'Cliente';
  const neighborhood = item.orders?.neighborhood || '';
  const address = item.orders?.address || '';
  const now = new Date().toLocaleString('pt-BR');

  // ESC/POS commands mixed with text
  // Using raw text for maximum compatibility
  const lines: string[] = [];

  // Center + Double height for header
  lines.push('\x1B\x61\x01'); // Center align
  lines.push('\x1B\x21\x30'); // Double height + Double width
  lines.push(`#${orderId}`);
  lines.push('\x1B\x21\x00'); // Normal text
  lines.push(storeName);
  lines.push('================================');
  lines.push('');

  // Left align for item details
  lines.push('\x1B\x61\x00'); // Left align
  lines.push('\x1B\x21\x08'); // Bold
  
  // Product name with quantity
  const productLine = item.quantity > 1 
    ? `${item.quantity}x ${item.product_name}`
    : item.product_name;
  lines.push(productLine);
  lines.push('\x1B\x21\x00'); // Normal text

  // Flavors
  if (item.flavors) {
    const flavorLines = item.flavors.split('\n');
    flavorLines.forEach(f => lines.push(`   ${f}`));
  }

  // Edge type (borda)
  if (item.edge_type) {
    lines.push('');
    lines.push(`BORDA: ${item.edge_type}`);
  }

  // Complements
  if (item.complements) {
    lines.push('');
    const complementLines = item.complements.split('\n');
    complementLines.forEach(c => lines.push(c));
  }

  // Notes/Observations - Highlighted
  if (item.notes) {
    lines.push('');
    lines.push('\x1B\x21\x08'); // Bold
    lines.push(`OBS: ${item.notes}`);
    lines.push('\x1B\x21\x00'); // Normal
  }

  lines.push('');
  lines.push('--------------------------------');
  lines.push(`Cliente: ${customerName}`);
  if (neighborhood || address) {
    lines.push(`${neighborhood}${neighborhood && address ? ' - ' : ''}${address}`);
  }
  lines.push('--------------------------------');
  
  // Center for footer
  lines.push('\x1B\x61\x01'); // Center
  lines.push(now);
  lines.push('================================');
  lines.push('');
  lines.push('');
  lines.push('');

  // Cut paper (partial cut)
  lines.push('\x1D\x56\x01');

  return lines;
}

/**
 * Print receipt to thermal printer using ESC/POS
 */
export async function printReceipt(printerName: string, item: OrderItemWithOrder): Promise<void> {
  if (!getConnectionStatus()) {
    throw new Error('Not connected to QZ Tray');
  }

  if (!printerName) {
    throw new Error('No printer selected');
  }

  try {
    const config = window.qz.configs.create(printerName, {
      encoding: 'UTF-8',
    });

    const content = formatReceiptContent(item);
    
    // Send as raw commands
    const data = [{
      type: 'raw',
      format: 'command',
      data: content.join('\n'),
      options: { language: 'ESCPOS' }
    }];

    await window.qz.print(config, data);
    console.log('[QZ Tray] Print successful for order:', item.orders?.cardapioweb_order_id || item.order_id);
  } catch (error: any) {
    console.error('[QZ Tray] Print error:', error);
    throw new Error(error?.message || 'Print failed');
  }
}

/**
 * Print test page
 */
export async function printTestPage(printerName: string): Promise<void> {
  if (!getConnectionStatus()) {
    throw new Error('Not connected to QZ Tray');
  }

  if (!printerName) {
    throw new Error('No printer selected');
  }

  try {
    const config = window.qz.configs.create(printerName, {
      encoding: 'UTF-8',
    });

    const now = new Date().toLocaleString('pt-BR');
    const testContent = [
      '\x1B\x61\x01', // Center
      '\x1B\x21\x30', // Double height + width
      'TESTE DE IMPRESSAO',
      '\x1B\x21\x00', // Normal
      '',
      '================================',
      '',
      'QZ Tray configurado com sucesso!',
      '',
      `Impressora: ${printerName}`,
      `Data/Hora: ${now}`,
      '',
      '================================',
      '',
      'Sistema de Gestao de Pedidos',
      '',
      '',
      '',
      '\x1D\x56\x01', // Partial cut
    ];

    const data = [{
      type: 'raw',
      format: 'command',
      data: testContent.join('\n'),
      options: { language: 'ESCPOS' }
    }];

    await window.qz.print(config, data);
    console.log('[QZ Tray] Test print successful');
  } catch (error: any) {
    console.error('[QZ Tray] Test print error:', error);
    throw new Error(error?.message || 'Test print failed');
  }
}
