
# Plano: Corrigir Aplicação da Configuração `kds_default_mode`

## Problema Identificado

A configuração `kds_default_mode` definida como `'items'` no painel de configurações **não está sendo aplicada corretamente** em todos os cenários.

### Análise do Código Atual

**Arquivo: `src/pages/Index.tsx`**

```typescript
// Linha 52 - Determina o modo efetivo
const effectiveKdsMode = isAdmin ? kdsMode : (settings?.kds_default_mode || 'items');

// Linhas 88-96 - Renderização condicional
{isKDSSector 
  ? (effectiveKdsMode === 'items' 
      ? <KDSItemsDashboard userSector={userSector} /> 
      : <KDSDashboard userSector={userSector} />) 
: isDispatchSector
  ? <DispatchDashboard />
    : mainView === 'kds'
      ? <KDSItemsDashboard />   // ← BUG: Ignora effectiveKdsMode!
      : <Dashboard />
}
```

### Bugs Encontrados

1. **Para admins sem setor KDS**: Quando clicam em "KDS Produção", o sistema mostra `<KDSItemsDashboard />` diretamente, **ignorando a configuração** `kds_default_mode`.

2. **Para admins com setor KDS**: O estado local `kdsMode` começa como `'items'`, mas não sincroniza com a configuração do banco quando o componente monta.

3. **Cache desatualizado**: O `staleTime` de 5 minutos pode fazer com que mudanças na configuração demorem a refletir.

---

## Solução

### Mudanças no `src/pages/Index.tsx`

1. **Sincronizar estado local com configuração do banco**:
   - Quando `settings` carregar, inicializar `kdsMode` com o valor do banco
   - Usar `useEffect` para sincronizar

2. **Aplicar `effectiveKdsMode` em TODOS os cenários**:
   - Quando admin sem setor clica em "KDS Produção", respeitar a configuração

3. **Reduzir `staleTime` das configurações**:
   - Mudar de 5 minutos para 30 segundos para refletir mudanças mais rápido

---

## Código Corrigido

### `src/pages/Index.tsx`

```typescript
const Index = () => {
  const { user, loading: authLoading, isAdmin } = useAuth();
  const { userSector, isLoading: sectorLoading } = useUserSector(user?.id);
  const { settings, isLoading: settingsLoading } = useSettings();
  
  // Estado local inicializado com fallback, será sincronizado com settings
  const [kdsMode, setKdsMode] = useState<'orders' | 'items'>('items');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [mainView, setMainView] = useState<'dashboard' | 'kds'>('dashboard');

  // NOVO: Sincronizar kdsMode com configuração do banco quando settings carregar
  useEffect(() => {
    if (settings?.kds_default_mode) {
      setKdsMode(settings.kds_default_mode);
    }
  }, [settings?.kds_default_mode]);

  // ... resto do código ...

  // KDS mode: usar configuração do settings como base
  // Admin pode sobrescrever via tabs, operadores usam sempre o settings
  const effectiveKdsMode = isAdmin ? kdsMode : (settings?.kds_default_mode || 'items');
  
  // ... resto do código ...

  // RENDERIZAÇÃO CORRIGIDA:
  return (
    <div className="min-h-screen bg-background">
      <Header sectorName={userSector?.name} isFullscreen={isFullscreen}>
        {/* ... tabs ... */}
      </Header>
      
      {/* CORRIGIDO: Aplicar effectiveKdsMode em todos os cenários */}
      {isKDSSector 
        ? (effectiveKdsMode === 'items' 
            ? <KDSItemsDashboard userSector={userSector} /> 
            : <KDSDashboard userSector={userSector} />) 
        : isDispatchSector
          ? <DispatchDashboard />
          : mainView === 'kds'
            ? (effectiveKdsMode === 'items'   // ← CORREÇÃO: Respeitar configuração
                ? <KDSItemsDashboard />
                : <KDSDashboard />)
            : <Dashboard />
      }
    </div>
  );
};
```

### `src/hooks/useSettings.ts`

```typescript
// Reduzir staleTime para refletir mudanças mais rápido
const { data: settings, isLoading, error } = useQuery({
  queryKey: ['app-settings'],
  queryFn: async () => {
    // ... query ...
  },
  staleTime: 1000 * 30, // 30 segundos ao invés de 5 minutos
});
```

---

## Resumo das Mudanças

| Arquivo | Mudança |
|---------|---------|
| `src/pages/Index.tsx` | Adicionar `useEffect` para sincronizar `kdsMode` com `settings` |
| `src/pages/Index.tsx` | Aplicar `effectiveKdsMode` quando admin clica em "KDS Produção" |
| `src/hooks/useSettings.ts` | Reduzir `staleTime` de 5min para 30s |

---

## Fluxo Após Correção

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                         FLUXO CORRIGIDO                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  1. Admin altera configuração para "Por Item" nas configurações         │
│     ↓                                                                   │
│  2. Banco salva: kds_default_mode = 'items'                            │
│     ↓                                                                   │
│  3. Query invalida cache → settings recarrega (30s máx)                │
│     ↓                                                                   │
│  4. useEffect sincroniza: setKdsMode('items')                          │
│     ↓                                                                   │
│  5. effectiveKdsMode = 'items'                                         │
│     ↓                                                                   │
│  6. Qualquer visão KDS mostra: KDSItemsDashboard ✓                     │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Benefícios

| Antes | Depois |
|-------|--------|
| Configuração ignorada para admins sem setor | Configuração respeitada em todos os cenários |
| Mudanças demoram 5 min para refletir | Mudanças refletem em até 30 segundos |
| Estado local não sincroniza com banco | Estado local sincroniza automaticamente |
