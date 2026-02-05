

# Plano: Disponibilidade Dinâmica de Bancadas + Reatividade Total

## Resumo Executivo

O sistema precisa:
1. Detectar automaticamente quando uma bancada não tem operadores online
2. Redistribuir todos os itens para bancadas disponíveis
3. Manter reatividade em tempo real (< 100ms de latência)

---

## Parte 1: Rastreamento de Presença de Operadores

### Problema Atual
O sistema distribui itens entre BANCADA A e BANCADA B usando round-robin simples. Se um operador sair (fechar app, perder conexão), os itens vão para uma fila sem ninguém para processá-los.

### Solução: Supabase Realtime Presence

```text
┌─────────────────────────────────────────────────────────────────┐
│                    TRACKING DE PRESENÇA                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   BANCADA A                         BANCADA B                   │
│   ┌─────────┐                      ┌─────────┐                 │
│   │ João ✓  │ ◄─── Presença ───►   │         │  ← Ninguém      │
│   └─────────┘      Rastreada       └─────────┘                 │
│                                                                 │
│   Sistema detecta: BANCADA B INDISPONÍVEL                      │
│                                                                 │
│   ┌─────────────────────────────────────────────┐              │
│   │  Itens novos vão 100% para BANCADA A        │              │
│   │  Itens pendentes de B são redistribuídos    │              │
│   └─────────────────────────────────────────────┘              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Arquivos a Criar/Modificar

1. **`src/hooks/useSectorPresence.ts`** (NOVO)
   - Hook que rastreia presença de operadores por setor
   - Usa Supabase Realtime Presence API
   - Emite eventos quando setor fica disponível/indisponível

2. **`src/contexts/PresenceContext.tsx`** (NOVO)
   - Context global que mantém estado de presença
   - Disponibiliza para toda a aplicação quais setores estão online

---

## Parte 2: Redistribuição Inteligente de Itens

### Lógica de Distribuição

```text
┌──────────────────────────────────────────────────────────┐
│              ALGORITMO DE DISTRIBUIÇÃO                    │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  1. Buscar setores KDS ativos                            │
│  2. Filtrar apenas setores com operadores ONLINE         │
│  3. Se nenhum online: manter no setor original (esperar) │
│  4. Se apenas 1 online: enviar 100% para ele             │
│  5. Se múltiplos online: distribuir por carga atual      │
│                                                          │
│  Critério de carga:                                       │
│  - Itens pendentes + em preparo por setor                │
│  - Setor com menos carga recebe próximo item             │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### Arquivos a Modificar

3. **Migração SQL** - Nova função `get_available_sectors()`
   - Consulta tabela de presença para saber quais setores têm operadores
   - Retorna apenas setores com pelo menos 1 operador online

4. **Migração SQL** - Atualizar `create_order_items_from_json()`
   - Usar `get_available_sectors()` ao invés de todos os setores KDS
   - Distribuir por carga (menos itens pendentes) ao invés de round-robin puro

5. **`supabase/functions/redistribute-items/index.ts`** (NOVO)
   - Edge function que é chamada quando um setor fica indisponível
   - Move itens pendentes do setor offline para setores online

---

## Parte 3: Tabela de Presença no Banco

6. **Migração SQL** - Criar tabela `sector_presence`

```sql
CREATE TABLE sector_presence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sector_id uuid NOT NULL REFERENCES sectors(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  is_online boolean NOT NULL DEFAULT true,
  UNIQUE(sector_id, user_id)
);

-- Índice para busca rápida de setores online
CREATE INDEX idx_sector_presence_online 
ON sector_presence(sector_id) 
WHERE is_online = true;
```

---

## Parte 4: Reatividade Máxima

### Otimizações de Latência

7. **`src/hooks/useOrderItems.ts`** - Já está otimizado com debounce de 50ms

8. **`src/hooks/useOrders.ts`** - Já está otimizado com debounce de 50ms

9. **Adicionar Realtime à tabela `sector_presence`**

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE sector_presence;
```

10. **`src/hooks/useSectorPresence.ts`** - Heartbeat automático
    - Envia ping a cada 10 segundos para confirmar presença
    - Se não receber ping em 30 segundos, marca como offline
    - Usa `visibilitychange` do browser para detectar tab inativa

---

## Parte 5: Integração com Componentes

11. **`src/components/kds/SectorQueuePanel.tsx`** 
    - Mostrar indicador visual de quantos operadores online no setor
    - Badge vermelho se nenhum operador (itens serão redistribuídos)

12. **`src/pages/Index.tsx`**
    - Inicializar tracking de presença quando usuário KDS faz login
    - Cleanup automático quando usuário sai

13. **`src/components/Dashboard.tsx`** 
    - Painel admin mostra status de todos os setores
    - Indicador visual de setores sem operadores

---

## Fluxo Completo

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                         FLUXO DE PRESENÇA                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  1. Operador faz login → Sistema registra presença no setor             │
│                                                                         │
│  2. Heartbeat a cada 10s → Atualiza last_seen_at                        │
│                                                                         │
│  3. Pedido chega via webhook/simulador                                  │
│     ↓                                                                   │
│  4. Função create_order_items_from_json                                 │
│     ↓                                                                   │
│  5. Consulta setores com operadores online (last_seen < 30s)            │
│     ↓                                                                   │
│  6. Distribui itens apenas para setores disponíveis                     │
│                                                                         │
│  7. Operador sai (fecha app/perde conexão)                              │
│     ↓                                                                   │
│  8. Heartbeat para → Timeout 30s → Marca offline                        │
│     ↓                                                                   │
│  9. Edge function redistribui itens pendentes                           │
│     ↓                                                                   │
│  10. Itens aparecem no setor disponível via Realtime                    │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Detalhes Técnicos

### Hook useSectorPresence.ts

```typescript
// Estrutura básica
export function useSectorPresence(sectorId: string) {
  const { user } = useAuth();
  const channel = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!user || !sectorId) return;

    // 1. Registrar presença inicial
    registerPresence(sectorId, user.id);

    // 2. Configurar heartbeat
    const heartbeat = setInterval(() => {
      updatePresence(sectorId, user.id);
    }, 10000);

    // 3. Listener de visibilidade
    const handleVisibility = () => {
      if (document.hidden) {
        // Tab inativa - pausar heartbeat
      } else {
        // Tab ativa - enviar heartbeat imediato
        updatePresence(sectorId, user.id);
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);

    // 4. Cleanup
    return () => {
      clearInterval(heartbeat);
      removePresence(sectorId, user.id);
    };
  }, [sectorId, user]);
}
```

### Função SQL get_available_sectors()

```sql
CREATE FUNCTION get_available_sectors()
RETURNS uuid[]
AS $$
BEGIN
  RETURN ARRAY(
    SELECT DISTINCT s.id 
    FROM sectors s
    JOIN sector_presence sp ON sp.sector_id = s.id
    WHERE s.view_type = 'kds'
      AND sp.is_online = true
      AND sp.last_seen_at > NOW() - INTERVAL '30 seconds'
  );
END;
$$ LANGUAGE plpgsql;
```

---

## Benefícios

| Antes | Depois |
|-------|--------|
| Itens ficam parados em bancada vazia | Redistribuição automática |
| Round-robin cego | Distribuição por carga real |
| Sem visibilidade de operadores | Dashboard mostra quem está online |
| Itens podem se perder | Sistema resiliente a falhas |

---

## Ordem de Implementação

1. Criar tabela `sector_presence` + habilitar Realtime
2. Criar hook `useSectorPresence` com heartbeat
3. Criar context `PresenceContext` para estado global
4. Atualizar função SQL de distribuição
5. Criar edge function de redistribuição
6. Integrar nos componentes KDS
7. Adicionar indicadores visuais no Dashboard admin
8. Testar fluxo completo com múltiplos dispositivos

