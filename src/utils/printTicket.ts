import { OrderItemWithOrder } from '@/types/orderItems';

/**
 * Formata um ticket de despacho para impressão em impressora térmica
 * Formato texto simples com 40 colunas (padrão 58mm)
 */
export function formatDispatchTicket(item: OrderItemWithOrder): string {
  const order = item.orders;
  const orderId = order?.cardapioweb_order_id || order?.external_id || item.order_id.slice(0, 8);
  const customerName = order?.customer_name || 'Cliente não informado';
  const neighborhood = order?.neighborhood || '';
  const address = order?.address || '';
  const storeName = order?.stores?.name || '';
  
  const now = new Date();
  const dateStr = now.toLocaleDateString('pt-BR');
  const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  const lines: string[] = [];
  
  // Header
  lines.push('========================================');
  lines.push(centerText('PEDIDO PRONTO', 40));
  lines.push('========================================');
  lines.push('');
  
  // Order info
  lines.push(`Pedido: #${orderId}`);
  if (storeName) {
    lines.push(`Loja: ${storeName}`);
  }
  lines.push(`Data: ${dateStr} ${timeStr}`);
  lines.push('----------------------------------------');
  
  // Customer info
  lines.push(`Cliente: ${customerName}`);
  if (neighborhood) {
    lines.push(`Bairro: ${neighborhood}`);
  }
  if (address) {
    // Truncate long addresses
    const maxLen = 38;
    if (address.length > maxLen) {
      lines.push(`End: ${address.substring(0, maxLen)}...`);
    } else {
      lines.push(`End: ${address}`);
    }
  }
  lines.push('----------------------------------------');
  
  // Product info
  lines.push('');
  lines.push(`${item.quantity}x ${item.product_name}`);
  
  // Flavors (sabores)
  if (item.flavors) {
    lines.push('');
    lines.push('SABORES:');
    item.flavors.split('\n').forEach(flavor => {
      lines.push(`  ${flavor}`);
    });
  }
  
  // Edge (borda)
  if (item.edge_type) {
    lines.push('');
    lines.push('BORDA:');
    item.edge_type.split('\n').forEach(edge => {
      lines.push(`  ${edge}`);
    });
  }
  
  // Complements
  if (item.complements) {
    lines.push('');
    lines.push('COMPLEMENTOS:');
    item.complements.split('\n').forEach(comp => {
      lines.push(`  ${comp}`);
    });
  }
  
  // Notes (observations)
  if (item.notes) {
    lines.push('');
    lines.push('*** OBSERVACOES ***');
    // Word wrap notes
    wrapText(item.notes, 38).forEach(line => {
      lines.push(`  ${line}`);
    });
  }
  
  // Footer
  lines.push('');
  lines.push('========================================');
  lines.push(centerText('PRONTO PARA ENTREGA', 40));
  lines.push('========================================');
  lines.push('');
  lines.push('');
  lines.push('');
  
  return lines.join('\n');
}

/**
 * Centraliza texto em uma largura específica
 */
function centerText(text: string, width: number): string {
  if (text.length >= width) return text;
  const padding = Math.floor((width - text.length) / 2);
  return ' '.repeat(padding) + text;
}

/**
 * Quebra texto longo em múltiplas linhas
 */
function wrapText(text: string, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';
  
  for (const word of words) {
    if (currentLine.length + word.length + 1 <= maxWidth) {
      currentLine += (currentLine ? ' ' : '') + word;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }
  
  if (currentLine) lines.push(currentLine);
  return lines;
}
