

# KDS Multitenant com Load Balancing Dinâmico

## Resumo Executivo

Transformação da arquitetura atual (Order como unidade) para um sistema de alta concorrência com **Order Items atômicos**, **Load Balancing entre setores** e **Timer de forno IoT** para pizzaria com forno de esteira.

---

## Análise do Sistema Atual

### O que existe hoje

| Componente | Status Atual | Gap |
|------------|--------------|-----|
| Unidade de processamento | Order (pedido inteiro) | Precisa ser Item |
| Concorrência | Realtime simples (invalidate) | Precisa de Pessimistic Locking |
| Setores | Apenas view_type (kds/management) | Precisa de assigned_sector por item |
| Timer | Buffer global por pedido | Precisa de timer por item + forno |
| Load Balancing | Não existe | Precisa de algoritmo de redistribuição |
| Offline | Não existe | Precisa de IndexedDB/sync |

### Arquitetura atual

```text
+----------------+     +----------------+     +----------------+
|   CardápioWeb  | --> |    Webhook     | --> |     Orders     |
+----------------+     +----------------+     +----------------+
                                                     |
                              +----------------------+
                              |                      |
                       +------v------+        +------v------+
                       | KDSDashboard |        |  Dashboard  |
                       | (Cozinha)    |        |  (Gestão)   |
                       +-------------+        +-------------+
```

---

## Nova Arquitetura Proposta

### Fase 1: Modelo de Dados (Order Items)

**Nova tabela: `order_items`**

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | uuid | PK |
| `order_id` | uuid | FK para orders |
| `product_name` | text | Nome do item |
| `quantity` | integer | Quantidade |
| `status` | enum | PENDING, IN_PREP, IN_OVEN, READY |
| `assigned_sector_id` | uuid | FK para sectors |
| `claimed_by` | uuid | Usuário que iniciou preparo |
| `claimed_at` | timestamptz | Momento do claim (locking) |
| `oven_entry_at` | timestamptz | Entrada no forno |
| `estimated_exit_at` | timestamptz | Saída estimada (entry + 120s) |
| `ready_at` | timestamptz | Marcado como pronto |

**Novo enum de status:**

```sql
CREATE TYPE item_status AS ENUM (
  'pending',    -- Aguardando preparo
  'in_prep',    -- Em preparação
  'in_oven',    -- No forno
  'ready'       -- Pronto
);
```

### Fase 2: Controle de Concorrência (Pessimistic Locking)

**RPC: `claim_order_item`**

Função atômica para evitar race conditions entre 9+ tablets:

```sql
CREATE OR REPLACE FUNCTION claim_order_item(
  p_item_id uuid,
  p_user_id uuid
) RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
  v_claimed boolean;
BEGIN
  -- Tenta atualizar apenas se não houver claim nos últimos 30 segundos
  UPDATE order_items
  SET 
    claimed_by = p_user_id,
    claimed_at = NOW(),
    status = 'in_prep'
  WHERE id = p_item_id
    AND status = 'pending'
    AND (claimed_by IS NULL OR claimed_at < NOW() - INTERVAL '30 seconds')
  RETURNING true INTO v_claimed;
  
  RETURN COALESCE(v_claimed, false);
END;
$$;
```

### Fase 3: Load Balancing (Work Stealing)

**Algoritmo de Rebalanceamento:**

```text
TRIGGER: on_item_status_change OR on_new_order

1. Calcular peso por setor:
   W_sector = COUNT(items WHERE status = 'pending' AND assigned_sector = sector_id)

2. Identificar desbalanceamento:
   IF (W_sector_B = 0 AND W_sector_A > 1)
   
3. Migrar item:
   MOVE last_pending_item FROM Sector_A TO Sector_B
   
4. Broadcast:
   EMIT realtime_event('queue_rebalanced', { sector_id, item_id })
```

**Edge Function: `rebalance-sectors`**

Executada via:
- Database trigger (on insert/update)
- Cron job (cada 5 segundos)

### Fase 4: Timer de Forno (IoT Pipeline)

**Lógica de Esteira:**

```text
+--------+     +----------+     +--------+     +--------+
| IN_PREP| --> | IN_OVEN  | --> | 120s   | --> | READY  |
+--------+     +----------+     | timer  |     +--------+
                    |           +--------+
                    v
              oven_entry_at = NOW()
              estimated_exit_at = NOW() + 120s
```

**Componente Frontend: `OvenTimerPanel`**

- Exibe todos os itens no forno com countdown
- Alerta sonoro 10s antes da saída
- Auto-transição para READY quando timer = 0

### Fase 5: Despacho Inteligente

**Condição de completude do pedido:**

```sql
-- Pedido só está pronto quando TODOS os itens estão READY
SELECT o.id, 
       COUNT(*) as total_items,
       SUM(CASE WHEN oi.status = 'ready' THEN 1 ELSE 0 END) as ready_items,
       COUNT(DISTINCT oi.assigned_sector_id) > 1 as mixed_origin
FROM orders o
JOIN order_items oi ON oi.order_id = o.id
GROUP BY o.id
HAVING COUNT(*) = SUM(CASE WHEN oi.status = 'ready' THEN 1 ELSE 0 END)
```

**Flag visual:** Pedidos com `mixed_origin = true` exibem badge indicando origem múltipla.

---

## Fluxo Completo

```text
1. ENTRADA DO PEDIDO
   CardápioWeb → webhook-orders → orders + order_items

2. DISTRIBUIÇÃO INICIAL
   Trigger → rebalance-sectors → assigned_sector_id por item

3. VISUALIZAÇÃO KDS
   Tablet Setor A → realtime subscription → lista de itens pendentes

4. CLAIM DO ITEM
   Operador clica → claim_order_item() → pessimistic lock

5. ENTRADA NO FORNO
   Operador clica "Forno" → oven_entry_at = NOW()

6. COUNTDOWN
   Frontend monitora → estimated_exit_at - NOW()

7. SAÍDA DO FORNO
   Timer = 0 → status = 'ready'

8. VERIFICAÇÃO DO PEDIDO
   Trigger → se todos itens READY → order.status = 'ready'

9. DESPACHO
   CardápioWeb notificado → Foody chamado → motoboy
```

---

## Componentes a Criar/Modificar

### Banco de Dados

| Ação | Objeto |
|------|--------|
| CREATE TABLE | `order_items` |
| CREATE TYPE | `item_status` |
| CREATE FUNCTION | `claim_order_item` |
| CREATE FUNCTION | `release_item_claim` |
| CREATE FUNCTION | `rebalance_sectors` |
| CREATE TRIGGER | `on_item_status_change` |
| ALTER TABLE | `orders` (adicionar `all_items_ready`) |
| ALTER TABLE | `sectors` (adicionar `weight_limit`) |

### Edge Functions

| Nome | Responsabilidade |
|------|-----------------|
| `rebalance-sectors` | Algoritmo de load balancing |
| `oven-monitor` | Cron para verificar timers de forno |
| Modificar `webhook-orders` | Criar order_items ao receber pedido |

### Frontend

| Componente | Ação |
|------------|------|
| `KDSItemCard.tsx` | NOVO - Card por item com claim button |
| `OvenTimerPanel.tsx` | NOVO - Lista de itens no forno |
| `SectorQueuePanel.tsx` | NOVO - Fila de itens por setor |
| `useOrderItems.ts` | NOVO - Hook com claim/release |
| `KDSDashboard.tsx` | MODIFICAR - Usar items ao invés de orders |

### Realtime

```sql
-- Habilitar realtime para a nova tabela
ALTER PUBLICATION supabase_realtime ADD TABLE public.order_items;
```

---

## Riscos e Mitigações

| Risco | Probabilidade | Mitigação |
|-------|---------------|-----------|
| Race condition no claim | Alta | Pessimistic locking via RPC |
| Desync de dados | Média | Realtime + polling backup |
| Sobrecarga de rebalanceamento | Média | Debounce de 1s no trigger |
| Queda de internet | Alta em Manaus | Fase futura: offline-first |

---

## Fases de Implementação

### Sprint 1 (Esta Implementação)
- [x] Análise e planejamento
- [ ] Criar tabela `order_items` com RLS
- [ ] Criar RPCs de claim/release
- [ ] Modificar webhook para criar items
- [ ] Criar `KDSItemCard` e `OvenTimerPanel`
- [ ] Integrar realtime para items

### Sprint 2 (Próxima)
- [ ] Load Balancing automático
- [ ] Métricas e analytics
- [ ] Gestão de massas pré-abertas

### Sprint 3 (Futura)
- [ ] Offline-first com IndexedDB
- [ ] Sync inteligente

---

## Estimativa de Esforço

| Componente | Complexidade | Estimativa |
|------------|--------------|------------|
| Schema + RPCs | Alta | 2-3 horas |
| Edge Functions | Média | 1-2 horas |
| Frontend KDS | Alta | 3-4 horas |
| Testes E2E | Média | 1-2 horas |

**Total estimado:** 7-11 horas de desenvolvimento

