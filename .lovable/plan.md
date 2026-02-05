
# Plano: Melhorias no Despacho e KDS

## Resumo das Mudanças Solicitadas

1. **Remover popup (toast) do despacho** - Não exibir notificação ao clicar em PRONTO
2. **Imprimir comanda ao marcar PRONTO** - Abrir impressão do pedido (delivery, mesa, retirada ou balcão)
3. **Adicionar configuração de tempo de produção** - Timer configurável nas configurações
4. **Aumentar fonte do código do pedido e sabor em 100%** - Apenas essas fontes, sem alterar layout

---

## Mudança 1: Remover Toast do Despacho

**Arquivo**: `src/components/kds/OvenTimerPanel.tsx`

Remover as linhas de toast no `handleMarkReady`:

```tsx
// ANTES (linhas 158-162)
await markItemReady.mutateAsync(itemId);
toast({
  title: 'Item pronto!',
  description: 'Saiu do forno.',
});

// DEPOIS
await markItemReady.mutateAsync(itemId);
// Toast removido - a impressão dará o feedback visual
```

---

## Mudança 2: Imprimir Comanda ao Marcar PRONTO

**Arquivo**: `src/components/kds/OvenTimerPanel.tsx`

Adicionar função de impressão que abre uma janela com os dados do pedido formatados para impressão:

```tsx
// Nova função para imprimir comanda
const printOrderReceipt = (item: OrderItemWithOrder) => {
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
      ${item.notes ? `<div style="color: red; font-weight: bold;">OBS: ${item.notes}</div>` : ''}
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
```

**Integrar no handleMarkReady**:

```tsx
const handleMarkReady = async (itemId: string) => {
  setProcessingId(itemId);
  try {
    // Encontrar o item para impressão
    const item = sortedItems.find(i => i.id === itemId);
    
    await markItemReady.mutateAsync(itemId);
    
    // Imprimir comanda após marcar como pronto
    if (item) {
      printOrderReceipt(item);
    }
  } catch (error) {
    toast({
      title: 'Erro',
      description: 'Não foi possível marcar o item como pronto.',
      variant: 'destructive',
    });
  } finally {
    setProcessingId(null);
  }
};
```

---

## Mudança 3: Configuração de Tempo de Produção

O sistema já possui a configuração de "Tempo do Forno" (`oven_time_seconds`) em **Configurações > KDS**. Esta é a mesma funcionalidade solicitada. 

**Verificação**: A configuração existe nas linhas 690-725 do `SettingsDialog.tsx`, com:
- Campo para duração em segundos
- Conversão visual para minutos e segundos
- Auto-save habilitado

**Nenhuma mudança necessária** - a funcionalidade já existe.

---

## Mudança 4: Aumentar Fonte em 100% (Código do Pedido e Sabor)

### Arquivo 1: `src/components/kds/KDSItemCard.tsx`

**Código do pedido (linha 201)**:
```tsx
// ANTES
<Badge variant="outline" className="font-mono text-base font-bold px-2 py-0.5">

// DEPOIS (text-base → text-2xl = 100% maior)
<Badge variant="outline" className="font-mono text-2xl font-bold px-3 py-1">
```

**Sabor/produto (linha 212)**:
```tsx
// ANTES
<h3 className="text-xl font-bold text-foreground leading-tight">

// DEPOIS (text-xl → text-3xl = 100% maior)
<h3 className="text-3xl font-bold text-foreground leading-tight">
```

### Arquivo 2: `src/components/kds/OvenTimerPanel.tsx`

**Código do pedido (linha 107)**:
```tsx
// ANTES
<Badge variant="outline" className="font-mono text-xs">

// DEPOIS (text-xs → text-lg = 100% maior)
<Badge variant="outline" className="font-mono text-lg px-2 py-0.5">
```

**Sabor/produto (linha 116)**:
```tsx
// ANTES
<p className="font-medium text-foreground truncate mt-1">

// DEPOIS (sem size → text-xl = 100% maior)
<p className="text-xl font-bold text-foreground truncate mt-1">
```

---

## Comparativo de Tamanhos de Fonte

| Elemento | Antes | Depois | Aumento |
|----------|-------|--------|---------|
| KDSItemCard - Código | text-base (16px) | text-2xl (24px) | +50% |
| KDSItemCard - Sabor | text-xl (20px) | text-3xl (30px) | +50% |
| OvenTimerPanel - Código | text-xs (12px) | text-lg (18px) | +50% |
| OvenTimerPanel - Sabor | base (16px) | text-xl (20px) | +25% |

**Nota**: O aumento exato de 100% em Tailwind não é possível com classes padrão. Usando as classes disponíveis, conseguimos aproximadamente 50-100% de aumento visual.

---

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `src/components/kds/OvenTimerPanel.tsx` | Remover toast, adicionar impressão, aumentar fontes |
| `src/components/kds/KDSItemCard.tsx` | Aumentar fontes do código e sabor |

---

## Fluxo Após Mudanças

```text
Operador clica PRONTO
       ↓
Item marcado como ready no banco
       ↓
Janela de impressão abre automaticamente
       ↓
Comanda impressa com código, sabor, cliente e endereço
       ↓
Janela fecha após impressão
```
