
# Historico de Despachos Persistente (via Banco de Dados)

## Problema
Atualmente o historico de despachos e armazenado apenas na memoria do React (`useState`). Ao recarregar a pagina ou trocar de aba, todo o historico desaparece. O funcionario nao consegue conferir se um pedido ja foi despachado.

## Solucao
Substituir o estado local por uma consulta ao banco de dados, buscando pedidos que possuem `dispatched_at` preenchido (pedidos efetivamente despachados). O historico sera persistente e visivel em qualquer dispositivo.

## Detalhes Tecnicos

### 1. Criar hook `useDispatchedOrders`
Novo hook que busca pedidos despachados do dia atual com seus itens:
- Query: orders com `dispatched_at IS NOT NULL` das ultimas 24h (ou do dia)
- Join com `order_items` e `stores` para exibir itens e nome da loja
- Ordenacao por `dispatched_at DESC` (mais recentes primeiro)
- Realtime subscription para atualizar automaticamente quando novos despachos ocorrerem

### 2. Atualizar `OvenHistoryPanel`
- Remover a prop `dispatchedOrders` (dados vindos de estado local)
- Buscar dados internamente via o novo hook `useDispatchedOrders`
- Manter o mesmo layout visual atual (cards verdes com badge DESPACHADO)
- Exibir horario real do despacho (formatado) ao inves do "tempo atras" relativo

### 3. Atualizar `DispatchDashboard` e `KDSItemsDashboard`
- Remover o `useState<DispatchedOrder[]>` e o callback `handleDispatch`
- Simplificar a passagem de props para `OvenHistoryPanel` (sem props de dados)
- Manter o callback `onDispatch` no `OvenTimerPanel` apenas para invalidar cache do React Query

### 4. Atualizar `OvenTimerPanel`
- Simplificar `onDispatch` para apenas invalidar queries (sem construir objeto `DispatchedOrder`)

## Arquivos Modificados
- **Novo**: `src/hooks/useDispatchedOrders.ts` — hook de busca de pedidos despachados
- **Editado**: `src/components/kds/OvenHistoryPanel.tsx` — busca propria via hook
- **Editado**: `src/components/DispatchDashboard.tsx` — remover estado local de historico
- **Editado**: `src/components/kds/KDSItemsDashboard.tsx` — remover estado local de historico
- **Editado**: `src/components/kds/OvenTimerPanel.tsx` — simplificar callback onDispatch

## Resultado
- Historico persiste entre recarregamentos de pagina
- Visivel em qualquer tablet/dispositivo conectado
- Atualiza em tempo real quando um novo pedido e despachado
- Funcionario pode conferir a qualquer momento se um pedido ja saiu
