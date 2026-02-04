

# Plano: Corrigir Fluxo Bancada → Forno → Despacho

## Problema Identificado

O usuario do setor **DESPACHO** nao ve os itens no forno porque:

| Problema | Detalhes |
|----------|----------|
| Setor DESPACHO tem `view_type = 'kds'` | Isso faz o usuario ver a tela `KDSItemsDashboard` (bancada) |
| Itens mantem `assigned_sector_id` original | Quando vao ao forno, continuam associados a BANCADA A/B |
| `OvenTimerPanel` esta no `Dashboard` | Mas o usuario de DESPACHO ve `KDSItemsDashboard`, nao `Dashboard` |

```text
FLUXO ATUAL (QUEBRADO):
┌──────────────┐     ┌───────────────┐     ┌──────────────────┐
│  BANCADA A   │     │    FORNO      │     │    DESPACHO      │
│  view: kds   │────►│ (status only) │     │    view: kds     │
│              │     │               │     │   VE: KDSItems   │
│  Item aqui   │     │ Item tem      │     │   DEVERIA VER:   │
│  sector=A    │     │ sector=A      │     │   Dashboard      │
└──────────────┘     └───────────────┘     └──────────────────┘
                            │
                            ▼
                     Nao muda setor!
                     Despacho nao ve!
```

## Solucao Proposta

Criar um novo tipo de visualizacao `dispatch` para setores de despacho que mostra o **Dashboard** com o **OvenTimerPanel**.

```text
FLUXO CORRIGIDO:
┌──────────────┐     ┌───────────────┐     ┌──────────────────┐
│  BANCADA     │     │    FORNO      │     │    DESPACHO      │
│  view: kds   │────►│ status=in_oven│────►│  view: dispatch  │
│              │     │               │     │                  │
│  KDSItems    │     │ Timer ativo   │     │  Ve: Dashboard   │
│  INICIAR/    │     │               │     │  + OvenTimer     │
│  FORNO       │     │               │     │  + Colunas       │
└──────────────┘     └───────────────┘     └──────────────────┘
```

---

## Mudancas Necessarias

### 1. Adicionar Tipo `dispatch` na Tabela `sectors`

Alterar a coluna `view_type` para aceitar 3 valores:
- `kds` - Tela de bancada (producao)
- `management` - Tela administrativa
- `dispatch` - Tela de despacho (Dashboard + OvenTimer)

```sql
-- Alterar o check constraint ou enum para incluir 'dispatch'
ALTER TABLE sectors 
DROP CONSTRAINT IF EXISTS sectors_view_type_check;

ALTER TABLE sectors 
ADD CONSTRAINT sectors_view_type_check 
CHECK (view_type IN ('kds', 'management', 'dispatch'));

-- Atualizar setor DESPACHO existente
UPDATE sectors 
SET view_type = 'dispatch' 
WHERE name = 'DESPACHO';
```

### 2. Atualizar Hook `useSectors.ts`

Adicionar `dispatch` ao tipo TypeScript:

```typescript
export interface Sector {
  id: string;
  name: string;
  view_type: 'kds' | 'management' | 'dispatch'; // Adicionar dispatch
  // ...
}
```

### 3. Atualizar `Index.tsx`

Modificar logica para reconhecer setores `dispatch`:

```typescript
// Antes
const isKDSSector = userSector?.view_type === 'kds';

// Depois
const isKDSSector = userSector?.view_type === 'kds';
const isDispatchSector = userSector?.view_type === 'dispatch';

// Renderizacao
{isKDSSector 
  ? <KDSItemsDashboard userSector={userSector} />
  : isDispatchSector || mainView === 'dashboard'
    ? <Dashboard />
    : <KDSItemsDashboard />
}
```

### 4. OvenTimerPanel - Remover Filtro por Setor

Atualmente o `OvenTimerPanel` pode receber um `sectorId` opcional. Para o despacho, precisamos garantir que ele veja **todos** os itens no forno, independente do setor de origem:

```typescript
// OvenTimerPanel.tsx
// O Dashboard ja chama sem sectorId, entao todos os itens in_oven sao exibidos
const { inOvenItems, markItemReady } = useOrderItems({ status: 'in_oven' });
// Sem filtro de setor = ve tudo
```

### 5. Atualizar `SectorsManager.tsx`

Adicionar opcao `dispatch` ao criar/editar setores:

```typescript
const viewTypeOptions = [
  { value: 'kds', label: 'KDS (Bancada de Producao)' },
  { value: 'management', label: 'Gerencial' },
  { value: 'dispatch', label: 'Despacho' },
];
```

---

## Resumo das Alteracoes

| Arquivo | Alteracao |
|---------|-----------|
| **Migracao SQL** | Adicionar `dispatch` como valor valido para `view_type` |
| **Migracao SQL** | Atualizar setor DESPACHO para `view_type = 'dispatch'` |
| `src/hooks/useSectors.ts` | Adicionar `dispatch` ao tipo `view_type` |
| `src/pages/Index.tsx` | Adicionar logica para renderizar `Dashboard` para setores `dispatch` |
| `src/components/SectorsManager.tsx` | Adicionar opcao `dispatch` no formulario |

---

## Fluxo Final Esperado

```text
1. Pedido chega → itens criados com assigned_sector_id = BANCADA A/B

2. Operador BANCADA ve item → clica INICIAR → clica FORNO
   - Item muda para status = 'in_oven'
   - Item desaparece da tela do operador (filtro: pending/in_prep)

3. Operador DESPACHO ve Dashboard
   - OvenTimerPanel mostra item com timer contando
   - Clica PRONTO → status = 'ready'
   - Item vai para coluna "Pedido Pronto" do Dashboard

4. Fluxo continua normal: Buffer → Despachado
```

---

## Beneficios

- Separacao clara entre telas de producao (KDS) e despacho (Dashboard)
- Operador de despacho ve painel do forno centralizado
- Admins ainda podem alternar entre views
- Nao requer mudanca na logica de `assigned_sector_id` - itens no forno sao vistos globalmente pelo despacho

