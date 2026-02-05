
# Correção: Listener de Impressão Remota Desconectando

## Problema Identificado

O listener da fila de impressão (`usePrintJobQueue`) está sendo inicializado **dentro do componente `PrinterSettings`**, que só existe quando o diálogo de configurações está aberto.

**Fluxo atual (problemático):**
1. Usuário abre Configurações → `PrinterSettings` monta → Subscription criada ✅
2. Usuário fecha Configurações → `PrinterSettings` desmonta → Subscription fechada ❌
3. Tablet envia job → Ninguém escutando → Job fica pendente eternamente ❌

**Evidência nos logs:**
```
[PrintQueue] Subscription status: SUBSCRIBED
[PrintQueue] Subscription status: CLOSED   ← Fechou quando diálogo fechou!
```

---

## Solução

Mover a inicialização do `usePrintJobQueue` para um **componente de nível superior** que permanece montado enquanto a aplicação está ativa.

O local ideal é o `Index.tsx`, pois:
- É o componente principal da aplicação autenticada
- Permanece montado durante toda a sessão do usuário
- Já tem acesso às settings via `useSettings`

---

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `src/pages/Index.tsx` | Adicionar chamada ao `usePrintJobQueue` |
| `src/components/PrinterSettings.tsx` | Remover chamada duplicada do hook |

---

## Implementação Detalhada

### 1. Modificar `Index.tsx`

Adicionar o hook de print queue que fica ativo enquanto o usuário está logado:

```typescript
import { usePrintJobQueue } from '@/hooks/usePrintJobQueue';
import { useQZTray } from '@/hooks/useQZTray';

const Index = () => {
  // ... existing code ...
  
  // Get QZ Tray state for print queue
  const { isConnected: isQZConnected, selectedPrinter, isReceiverEnabled } = useQZTray();
  
  // Initialize print job queue listener (stays active while app is mounted)
  usePrintJobQueue({
    enabled: isReceiverEnabled,
    printerName: selectedPrinter,
    isQZConnected: isQZConnected,
  });
  
  // ... rest of component ...
};
```

### 2. Modificar `PrinterSettings.tsx`

Remover a chamada do hook (já será gerenciado pelo Index):

```typescript
// REMOVER estas linhas:
// usePrintJobQueue({
//   enabled: isReceiverEnabled,
//   printerName: selectedPrinter,
//   isQZConnected: isConnected,
// });
```

---

## Fluxo Corrigido

```
┌─────────────────────────────────────────────────────────────┐
│                      Index.tsx                              │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ usePrintJobQueue({ enabled: true, ... })            │   │
│  │   → Subscription ATIVA enquanto app está aberta     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ Dashboard    │  │ KDSDashboard │  │ DispatchDashboard│  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ SettingsDialog (abre/fecha)                         │   │
│  │   └── PrinterSettings (UI de configuração apenas)   │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

**Resultado:**
- Subscription permanece ativa enquanto a aplicação está aberta
- PrinterSettings apenas gerencia configurações (UI)
- Jobs de impressão são processados mesmo com diálogo fechado

---

## Verificação Pós-Implementação

Após a correção, os logs devem mostrar:
```
[PrintQueue] Subscription status: SUBSCRIBED
// Deve permanecer SUBSCRIBED, sem CLOSED
```

E os jobs pendentes serão processados:
```
[PrintQueue] Processing 1 pending jobs
[PrintQueue] Job processed successfully: 32c7abb6-...
[QZ Tray] Print successful for order: 6300
```
