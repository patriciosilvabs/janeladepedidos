/**
 * QZ Tray Silent Printing Service
 * 
 * Connects to QZ Tray (https://qz.io) for direct printing to thermal printers
 * without browser print dialogs.
 * 
 * Uses digital signature for automatic trust (no popups).
 */

import { OrderItemWithOrder } from '@/types/orderItems';

// QZ Tray Public Certificate for automatic trust
const QZ_CERTIFICATE = `-----BEGIN CERTIFICATE-----
MIIDcTCCAlmgAwIBAgIUV4tLa/9s/MAR42Nq3z5P9iFHq9UwDQYJKoZIhvcNAQEL
BQAwYTELMAkGA1UEBhMCQlIxETAPBgNVBAgMCEFNQVpPTkFTMQ8wDQYDVQQHDAZN
QU5BVVMxETAPBgNVBAoMCFBEVlRPVEFMMQswCQYDVQQLDAJQRDEOMAwGA1UEAwwF
VE9UQUwwHhcNMjUxMjE3MDA0MjI4WhcNMzUxMjE1MDA0MjI4WjBhMQswCQYDVQQG
EwJCUjERMA8GA1UECAwIQU1BWk9OQVMxDzANBgNVBAcMBk1BTkFVUzERMA8GA1UE
CgwIUERWVE9UQUwxCzAJBgNVBAsMAlBEMQ4wDAYDVQQDDAVUT1RBTDCCASIwDQYJ
KoZIhvcNAQEBBQADggEPADCCAQoCggEBAN9+mvDiY1Q5WGGzwzguL1jvwlq5kmAs
YuaEu0JnWcxo17ym5D4lZEE7xS30lNPPirO5NhU0g0Yqz5i7pIP1DwneD+u2gO2y
zY7UWeY9ey7NLeBzwzgeWRm5r5FbhUSMd4IiDJZc+kXpwtpRur9rSDv95QT/pDw6
NJnZZGmo8UBTtcG+O8xRhCHzPsIVby4beH5f2gUqE1K/zJdB351AYiibCgX1Yvzg
OVh9SHIHgKsQqoHEwSJ1KemFqRSTRdRiqI/uisyl2ZU8poJmfqX5aS5XEDpLPwl+
+cjQnAlb/PNuUPAVi4rs6yjEP4hST45SMur0404U0HvmHQ8B9AbYS+UCAwEAAaMh
MB8wHQYDVR0OBBYEFDHdkyG2nM2jqv1Pu5ihkwFD1BM1MA0GCSqGSIb3DQEBCwUA
A4IBAQBz1AzFDJaBEQ35MVwKXhY9VFz0w8JrwGLshk5xqDWDswNzWZbj05HahWtU
P4FcwZO++vNSEn9jshWKfF8Bfm3s33yAk1xru5dypYMN0VQcWuBCXsJxWd2EmIgm
asQA6iZVrKV666UKSgIkom5T8ddGfyUbHoRkeDjG92/12VoICsp30cfporx3t6rN
A/nbcJqYec4NvQC4Qi+8gaF32CUjBO9OCuxaM+UHh819YdNOJT9NLyRSMGi42tps
2QYH3VnQsN1STpAker+wJeAD1GgyNEopRBiIjlmH/4oB6DtJOUxKi1//C6H3uy9l
Uy10/tlSW/tvtK20Hr2DZkIlVLfA
-----END CERTIFICATE-----`;

// Supabase URL for signing requests
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

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
      // Configure certificate for automatic trust
      window.qz.security.setCertificatePromise((resolve) => {
        resolve(QZ_CERTIFICATE);
      });

      // Configure signature using edge function
      window.qz.security.setSignaturePromise((toSign) => (resolve) => {
        fetch(`${SUPABASE_URL}/functions/v1/qz-sign`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ toSign })
        })
        .then(r => r.json())
        .then(data => resolve(data.signature || ''))
        .catch((err) => {
          console.error('[QZ Tray] Signing failed:', err);
          resolve('');
        });
      });

      await window.qz.websocket.connect();
      isConnected = true;
      console.log('[QZ Tray] Connected successfully with digital signature');
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
