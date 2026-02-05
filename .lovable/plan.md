
# Plano: Impressão Remota via Supabase Realtime

## Cenário Atual

Atualmente, quando o operador do **tablet (KDS de bancada)** clica em "PRONTO", a impressão ocorre **localmente no próprio tablet**. Isso é um problema porque:

1. O tablet não tem impressora térmica conectada
2. O QZ Tray não está instalado no tablet
3. A impressora está no **computador da gestão/despacho**

---

## Solução: Fila de Impressão com Realtime

A solução é criar uma **fila de trabalhos de impressão** no banco de dados. Quando o tablet marca um item como pronto, ele **insere um registro** na fila. O computador com QZ Tray **escuta essa fila em tempo real** e executa a impressão.

```text
┌──────────────────┐                     ┌──────────────────┐
│    TABLET        │                     │   COMPUTADOR     │
│  (KDS Bancada)   │                     │   (Despacho)     │
│                  │                     │   + QZ Tray      │
│  Clica PRONTO ───┼─────┐               │   + Impressora   │
│                  │     │               │                  │
└──────────────────┘     │               │  Escuta Realtime │
                         │               │        │         │
                         ▼               │        ▼         │
              ┌────────────────────┐     │  Recebe job      │
              │     SUPABASE       │     │        │         │
              │  ┌──────────────┐  │     │        ▼         │
              │  │  print_jobs  │──┼─────┼──► Imprime       │
              │  └──────────────┘  │     │        │         │
              └────────────────────┘     │        ▼         │
                                         │  Marca 'printed' │
                                         └──────────────────┘
```

---

## Arquivos a Criar/Modificar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| Migração SQL | **Criar** | Tabela `print_jobs` com Realtime habilitado |
| `src/hooks/usePrintJobQueue.ts` | **Criar** | Hook para escutar e processar jobs de impressão |
| `src/hooks/useQZTray.ts` | **Modificar** | Adicionar função `queuePrintJob` para inserir na fila |
| `src/components/kds/OvenTimerPanel.tsx` | **Modificar** | Usar nova lógica: local se tem QZ, remoto se não tem |
| `src/components/PrinterSettings.tsx` | **Modificar** | Adicionar toggle para "Modo Receptor de Impressão" |
| `src/App.tsx` ou `Layout` | **Modificar** | Inicializar listener de impressão quando em modo receptor |

---

## Estrutura da Tabela `print_jobs`

```sql
CREATE TABLE print_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id uuid REFERENCES order_items(id) ON DELETE CASCADE,
  item_data jsonb NOT NULL,           -- Dados completos para impressão
  status text DEFAULT 'pending',      -- pending, printing, printed, failed
  created_at timestamptz DEFAULT now(),
  printed_at timestamptz,
  printer_name text,                  -- Qual impressora processou
  error_message text                  -- Se falhou, motivo
);

-- Habilitar Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE print_jobs;
```

---

## Lógica de Decisão: Local vs Remoto

```text
┌─────────────────────────────────────────────────────┐
│            Clicou "PRONTO" no item                  │
└─────────────────────────────────────────────────────┘
                       │
                       ▼
        ┌──────────────────────────────┐
        │ QZ Tray conectado localmente?│
        └──────────────────────────────┘
               │                 │
              SIM               NÃO
               │                 │
               ▼                 ▼
    ┌─────────────────┐  ┌─────────────────────┐
    │ Imprime local   │  │ Insere print_job    │
    │ (direto no QZ)  │  │ (impressão remota)  │
    └─────────────────┘  └─────────────────────┘
```

---

## Hook: `usePrintJobQueue`

Este hook será usado no **computador receptor** para:

1. Escutar novos jobs via Realtime
2. Processar cada job com QZ Tray
3. Atualizar status para `printed` ou `failed`

```typescript
// Pseudocódigo
export function usePrintJobQueue(enabled: boolean) {
  const { printReceipt, isConnected } = useQZTray();
  
  useEffect(() => {
    if (!enabled || !isConnected) return;
    
    // Subscribe to print_jobs where status = 'pending'
    const channel = supabase
      .channel('print-jobs')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'print_jobs',
        filter: 'status=eq.pending'
      }, async (payload) => {
        const job = payload.new;
        
        try {
          // Update to 'printing'
          await updateJobStatus(job.id, 'printing');
          
          // Execute print
          await printReceipt(job.item_data);
          
          // Update to 'printed'
          await updateJobStatus(job.id, 'printed');
        } catch (error) {
          await updateJobStatus(job.id, 'failed', error.message);
        }
      })
      .subscribe();
      
    return () => supabase.removeChannel(channel);
  }, [enabled, isConnected]);
}
```

---

## Modificações no useQZTray

Adicionar função `queuePrintJob` que:

1. Verifica se QZ está conectado localmente
2. Se sim: imprime direto
3. Se não: insere na tabela `print_jobs`

```typescript
const queuePrintJob = async (item: OrderItemWithOrder) => {
  // Se QZ está conectado localmente, imprime direto
  if (isConnected && selectedPrinter) {
    await printReceipt(item);
    return;
  }
  
  // Caso contrário, envia para fila remota
  await supabase.from('print_jobs').insert({
    order_item_id: item.id,
    item_data: item,
    status: 'pending'
  });
};
```

---

## Configuração no PrinterSettings

Adicionar nova seção:

```text
┌─────────────────────────────────────────────────────┐
│ 🖨️ Modo de Operação                                │
├─────────────────────────────────────────────────────┤
│                                                     │
│ ○ Impressão Local                                   │
│   Imprime neste computador quando EU clicar PRONTO  │
│                                                     │
│ ● Receptor de Impressão Remota                [ON]  │
│   Recebe comandos de impressão de tablets/bancadas  │
│   Status: 3 jobs processados hoje                   │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## Fluxo Completo

1. **Tablet (Bancada)**:
   - Operador clica PRONTO no item
   - Sistema detecta que QZ não está conectado
   - Insere registro em `print_jobs`

2. **Computador (Despacho)**:
   - Está com "Receptor de Impressão" ativado
   - Recebe o job via Realtime
   - Executa impressão no QZ Tray
   - Atualiza status para `printed`

3. **Fallback**:
   - Se nenhum receptor estiver online
   - Job fica pendente até alguém processar
   - Pode mostrar alerta visual de jobs pendentes

---

## Configurações Adicionais no Banco

Adicionar em `app_settings`:

```sql
ALTER TABLE app_settings 
ADD COLUMN IF NOT EXISTS print_receiver_enabled boolean DEFAULT false;
```

---

## Limpeza Automática

Jobs antigos (>24h) serão limpos automaticamente:

```sql
-- Trigger ou cron job para limpar jobs antigos
DELETE FROM print_jobs 
WHERE created_at < now() - interval '24 hours'
  AND status IN ('printed', 'failed');
```

---

## Benefícios

1. **Sem dependência de rede local** - Funciona via internet
2. **Múltiplos tablets** - Todos enviam para mesma fila
3. **Múltiplos receptores** - Pode ter backup de impressoras
4. **Auditoria** - Histórico de impressões no banco
5. **Resiliente** - Jobs não se perdem se PC reiniciar

---

## Resumo das Mudanças

| Componente | Mudança |
|------------|---------|
| **Banco** | Nova tabela `print_jobs` + coluna `print_receiver_enabled` |
| **Tablet/KDS** | Insere na fila ao invés de imprimir local |
| **Computador** | Escuta fila e processa impressões |
| **UI Settings** | Toggle para ativar modo receptor |
