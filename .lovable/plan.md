
# Plano: Criar Tela Exclusiva para Setor Despacho

## Entendimento do Problema

Atualmente o usuario do setor DESPACHO ve o Dashboard completo com 4 colunas:
- Em Producao
- Buffer de Espera
- Pedido Pronto
- Despachados

Porem, o fluxo correto e:
- Usuario DESPACHO ve APENAS o painel do forno (itens vindos das bancadas)
- Ao clicar PRONTO no item, o pedido vai para o fluxo normal (Buffer → Pronto → Despachados)
- As 4 colunas sao vistas SOMENTE por admins/owners

```text
FLUXO CORRETO:

   BANCADA               DESPACHO              ADMIN/OWNER
   (view: kds)           (view: dispatch)      (Dashboard completo)
        │                      │                     │
        ▼                      ▼                     ▼
   ┌─────────┐           ┌─────────────┐      ┌──────────────────┐
   │ INICIAR │           │   FORNO     │      │ Em Producao      │
   │  FORNO  │──────────►│  (timer)    │      │ Buffer de Espera │
   └─────────┘           │   PRONTO    │      │ Pedido Pronto    │
                         └──────┬──────┘      │ Despachados      │
                                │             └────────┬─────────┘
                                │                      │
                                └──────────────────────┘
                                    Envia para Buffer
```

---

## Solucao

Criar um novo componente `DispatchDashboard` que exibe APENAS:
1. Painel do Forno (OvenTimerPanel) - itens com status `in_oven`
2. Quando o usuario clica PRONTO, o item muda para `ready`
3. Quando TODOS os itens do pedido estao prontos, o pedido aparece no Dashboard (admins)

---

## Alteracoes Necessarias

### 1. Criar Componente `DispatchDashboard.tsx`

Novo componente simplificado para o setor de despacho:

```typescript
// src/components/DispatchDashboard.tsx
export function DispatchDashboard() {
  // Busca itens no forno (sem filtro de setor = ve todos)
  const { inOvenItems } = useOrderItems({ status: 'in_oven' });
  
  return (
    <div className="flex flex-col h-[calc(100vh-5rem)] p-4">
      {/* Cabecalho simples */}
      <div className="text-center mb-4">
        <h2>Painel do Forno</h2>
        <p>Itens aguardando finalizacao</p>
      </div>
      
      {/* Painel do forno expandido */}
      {inOvenItems.length === 0 ? (
        <EmptyState message="Nenhum item no forno" />
      ) : (
        <OvenTimerPanel />  // Sem sectorId = ve todos os setores
      )}
    </div>
  );
}
```

### 2. Atualizar `Index.tsx`

Trocar a renderizacao para usar `DispatchDashboard` quando o setor for `dispatch`:

```typescript
// src/pages/Index.tsx
import { DispatchDashboard } from '@/components/DispatchDashboard';

// Na renderizacao:
{isKDSSector 
  ? <KDSItemsDashboard userSector={userSector} /> 
  : isDispatchSector
    ? <DispatchDashboard />    // NOVO: Tela simplificada para despacho
    : mainView === 'kds'
      ? <KDSItemsDashboard />
      : <Dashboard />          // Dashboard completo so para admins
}
```

### 3. Transicao Automatica para Buffer

Quando o usuario de despacho clica PRONTO em um item:
1. Item vai para status `ready`
2. Se TODOS os itens do pedido estao prontos, marca `all_items_ready = true`
3. O sistema deve automaticamente mover o pedido para `waiting_buffer`

Atualmente isso NAO acontece automaticamente. Preciso modificar a funcao `check_order_completion` no banco para:
- Quando todos os itens estao prontos → mover pedido para `waiting_buffer`

```sql
-- Alteracao na funcao check_order_completion
IF v_total = v_ready THEN
  UPDATE orders
  SET 
    all_items_ready = true,
    mixed_origin = (v_sectors > 1),
    status = 'waiting_buffer',  -- NOVO: Mover automaticamente para buffer
    ready_at = NOW()            -- NOVO: Marcar quando ficou pronto
  WHERE id = p_order_id;
  
  RETURN true;
END IF;
```

---

## Resumo das Alteracoes

| Arquivo | Alteracao |
|---------|-----------|
| **NOVO** `src/components/DispatchDashboard.tsx` | Componente simplificado com apenas o painel do forno |
| `src/pages/Index.tsx` | Usar `DispatchDashboard` para setores `dispatch` |
| **Migracao SQL** | Atualizar `check_order_completion` para mover pedido para buffer automaticamente |

---

## Fluxo Final

```text
1. Pedido chega → itens criados e atribuidos as bancadas

2. Operador BANCADA:
   - Ve item em sua bancada
   - Clica INICIAR → status = 'in_prep'
   - Clica FORNO → status = 'in_oven'
   - Item desaparece da bancada

3. Operador DESPACHO:
   - Ve APENAS o painel do forno (OvenTimerPanel)
   - Timer contando para cada item
   - Clica PRONTO → item.status = 'ready'
   - Se todos os itens do pedido prontos → order.status = 'waiting_buffer'

4. ADMIN/OWNER:
   - Ve Dashboard completo (4 colunas)
   - Pedido aparece em "Buffer de Espera"
   - Fluxo continua normal: Buffer → Pronto → Despachados
```

---

## Beneficios

- Usuario de despacho tem interface simplificada e focada
- Transicao automatica para buffer quando todos os itens estao prontos
- Separacao clara de responsabilidades entre setores
- Admins mantem visao completa do fluxo
