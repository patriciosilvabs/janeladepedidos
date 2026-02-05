

# Plano: Corrigir Visualização Padrão para Admins - KDS Por Item

## Problema Identificado

O admin (owner) está vendo o **Dashboard de Despacho** (4 colunas) quando espera ver o **KDS Por Item** (cards individuais).

### Análise Técnica

**Configuração do usuário no banco:**
- User ID: `4a5ee05a-17fd-47ff-8bb6-676436ce9f8c`
- Role: `owner`
- Sector ID: `NULL` (sem setor vinculado)
- View Type: `NULL`

**Fluxo atual no código (`Index.tsx`):**
```
isKDSSector = false (sector é null)
isDispatchSector = false (sector é null)
mainView = 'dashboard' (valor inicial)
→ Resultado: Mostra <Dashboard /> (tela de despacho)
```

**Por que o admin vê "Por Pedido" (4 colunas):**
O `<Dashboard />` é a tela de **DESPACHO** com visão por pedido (Produção → Buffer → Pronto → Despachado). Isso NÃO é o KDS!

Para ver o KDS "Por Item", o admin precisa:
1. Clicar na aba "KDS Produção" no header
2. Só então `mainView` muda para `'kds'`
3. E aí sim mostra `<KDSItemsDashboard />`

---

## Soluções Propostas

### Opção A: Mudar visualização padrão para KDS (Recomendada)

Fazer com que admins sem setor vejam o **KDS Por Item** por padrão ao abrir o sistema, mantendo a opção de alternar para Despacho.

**Mudança:**
```typescript
// ANTES
const [mainView, setMainView] = useState<'dashboard' | 'kds'>('dashboard');

// DEPOIS - Iniciar com 'kds' para mostrar KDS por padrão
const [mainView, setMainView] = useState<'dashboard' | 'kds'>('kds');
```

### Opção B: Adicionar configuração no banco

Criar um campo `default_admin_view` no `app_settings` para controlar qual tela admins veem por padrão (`'dashboard'` ou `'kds'`).

### Opção C: Renomear tabs para clarificar

Manter comportamento atual mas renomear tabs:
- "Despacho" → "Gestão de Pedidos"  
- "KDS Produção" → "Visualização KDS"

---

## Implementação Recomendada (Opção A)

### Arquivo: `src/pages/Index.tsx`

```typescript
const Index = () => {
  // ... outros hooks ...
  
  // MUDANÇA: Iniciar com 'kds' para admins verem KDS por padrão
  const [mainView, setMainView] = useState<'dashboard' | 'kds'>('kds');
  
  // OU: Sincronizar com kds_default_mode para consistência
  useEffect(() => {
    if (settings?.kds_default_mode) {
      setKdsMode(settings.kds_default_mode);
      // Também definir a view inicial baseada no modo configurado
      if (!isKDSSector && !isDispatchSector) {
        // Se configurado para 'items', mostrar KDS por padrão
        if (settings.kds_default_mode === 'items') {
          setMainView('kds');
        }
      }
    }
  }, [settings?.kds_default_mode]);
  
  // ... resto do código ...
};
```

### Inverter ordem das tabs (UX melhorada)

```typescript
{/* Trocar ordem: KDS primeiro, Despacho segundo */}
<TabsList className="h-8">
  <TabsTrigger value="kds" className="text-xs px-3">
    KDS Produção
  </TabsTrigger>
  <TabsTrigger value="dashboard" className="text-xs px-3">
    Despacho
  </TabsTrigger>
</TabsList>
```

---

## Resumo das Mudanças

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/Index.tsx` | Alterar estado inicial de `mainView` de `'dashboard'` para `'kds'` |
| `src/pages/Index.tsx` | Sincronizar `mainView` com configuração do banco |
| `src/pages/Index.tsx` | Inverter ordem das tabs (KDS primeiro) |

---

## Comportamento Após Correção

```text
┌─────────────────────────────────────────────────────────────────┐
│                    ADMIN ABRE O SISTEMA                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Configuração: kds_default_mode = 'items'                   │
│     ↓                                                           │
│  2. Estado inicial: mainView = 'kds'                           │
│     ↓                                                           │
│  3. effectiveKdsMode = 'items'                                 │
│     ↓                                                           │
│  4. Renderiza: KDSItemsDashboard ✓                             │
│                                                                 │
│  [KDS Produção] [Despacho]    ← Tabs no header                 │
│       ↑                                                         │
│   (selecionado)                                                │
│                                                                 │
│  Admin vê cards individuais de itens (Por Item) ✓              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Benefícios

| Antes | Depois |
|-------|--------|
| Admin vê Dashboard de Despacho | Admin vê KDS Por Item |
| Precisa clicar tab manualmente | Já abre na view correta |
| Confusão entre "Por Pedido" e Dashboard | Visualização clara e correta |

