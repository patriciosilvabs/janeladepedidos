

# Plano: Item Fica no Despacho Ate Clicar + Garantir Exclusividade

## Problema Atual

### 1. Auto-Complete Indesejado
Quando o timer chega a 0, o sistema automaticamente marca o item como `ready`:

```typescript
// OvenTimerPanel.tsx - linha 56-59
if (remaining === 0) {
  onMarkReady(); // PROBLEMA: marca automaticamente
  clearInterval(interval);
}
```

Isso faz o item sumir do painel do forno. O comportamento correto e ficar piscando ate o funcionario clicar em PRONTO.

### 2. Exclusividade de Telas
A logica de filtros ja garante que itens nao aparecem em multiplas telas:

| Tela | Filtro de Status | Itens Visiveis |
|------|------------------|----------------|
| Bancada A/B | `pending, in_prep` | Producao |
| Despacho (Forno) | `in_oven` | No forno |
| Despacho (Colunas) | `ready, dispatched` | Prontos |

O claim atomico com `FOR UPDATE NOWAIT` impede dois funcionarios capturarem o mesmo item.

---

## Mudancas Necessarias

### 1. Remover Auto-Complete do Timer

```text
ANTES:
Timer = 0 → auto-marca como READY → item some

DEPOIS:
Timer = 0 → item fica piscando → funcionario clica PRONTO → item vai para coluna "Pronto"
```

### 2. Adicionar Estado "Timer Finalizado"

Novo visual quando countdown = 0:
- Piscando forte (animate-pulse mais intenso)
- Texto "0:00" em vermelho
- Alerta sonoro continuo (opcional)
- Botao PRONTO destacado

```text
┌────────────────────────────────────────────────┐
│ 🔥 FORNO                                  🔊   │
├────────────────────────────────────────────────┤
│ ⚠️ [0:00] #1234 Pizza Calabresa   [PRONTO]     │  ← Piscando vermelho
│    [1:15] #1235 Pizza Frango      [PRONTO]     │  ← Normal laranja
└────────────────────────────────────────────────┘
```

---

## Detalhes Tecnicos

### Alteracao no OvenItemRow

```typescript
// Remover auto-complete
useEffect(() => {
  // ...
  const interval = setInterval(() => {
    const remaining = calculateRemaining();
    setCountdown(remaining);

    // Alerta sonoro aos 10s
    if (remaining <= 10 && remaining > 0 && !hasPlayedAlert) {
      playAlert();
    }

    // NAO fazer auto-complete
    // Apenas parar o interval quando chegar a 0
    if (remaining === 0) {
      clearInterval(interval);
    }
  }, 1000);
}, [...]);

// Estado visual para timer finalizado
const isFinished = countdown === 0;
const isUrgent = countdown <= 10 && countdown > 0;
```

### Visual Diferenciado

```typescript
// Quando timer = 0
<div className={cn(
  "relative p-3 rounded-lg border-2 transition-all",
  isFinished 
    ? "border-red-600 bg-red-600/20 animate-[pulse_0.5s_ease-in-out_infinite]"  // Pulso rapido
    : isUrgent 
      ? "border-red-500 bg-red-500/10 animate-pulse"  // Pulso normal
      : "border-orange-500/30 bg-orange-500/5"
)}>
```

---

## Fluxo Completo Revisado

```text
┌─────────────────────────────────────────────────────────────────┐
│                         BANCADA A                               │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Item #1234 - Pizza Calabresa                             │  │
│  │  [INICIAR] → Captura item (claim)                         │  │
│  │  [FORNO]   → Envia ao forno (status = in_oven)            │  │
│  │             Item SOME da bancada                          │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼ (WebSocket 50ms)
┌─────────────────────────────────────────────────────────────────┐
│                         DESPACHO                                │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  🔥 FORNO                                                 │  │
│  │  [1:45] #1234 Pizza Calabresa   [PRONTO]                  │  │
│  │         ...timer contando...                              │  │
│  │  [0:10] Alerta sonoro + visual vermelho                   │  │
│  │  [0:00] PISCANDO FORTE - espera clique                    │  │
│  │         Funcionario clica [PRONTO]                        │  │
│  └───────────────────────────────────────────────────────────┘  │
│                              │                                   │
│                              ▼                                   │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐                        │
│  │Em Prod   │ │Buffer    │ │PRONTO    │ ← Item aparece aqui    │
│  │          │ │          │ │ #1234    │   apos clicar PRONTO   │
│  └──────────┘ └──────────┘ └──────────┘                        │
└─────────────────────────────────────────────────────────────────┘
```

---

## Garantia de Exclusividade (Ja Implementado)

### Banco de Dados
A funcao `claim_order_item` usa `FOR UPDATE NOWAIT` para lock atomico:

```sql
SELECT * INTO v_item FROM order_items
WHERE id = p_item_id
FOR UPDATE NOWAIT;  -- Falha se outro usuario tem lock
```

### Frontend
Cada tela filtra por status diferente:
- Bancada: `status IN ('pending', 'in_prep')`
- Forno: `status = 'in_oven'`
- Despacho: `status IN ('ready', 'dispatched')`

Item so pode ter UM status por vez → impossivel aparecer em duas telas.

---

## Arquivos a Modificar

| Arquivo | Alteracao |
|---------|-----------|
| `src/components/kds/OvenTimerPanel.tsx` | Remover auto-complete, adicionar visual piscante para timer=0 |

---

## Beneficios

- Item permanece visivel no forno ate acao manual
- Visual claro de "atencao necessaria" quando timer = 0
- Garante que funcionario confirme que item saiu do forno
- Exclusividade de telas mantida pelo filtro de status

