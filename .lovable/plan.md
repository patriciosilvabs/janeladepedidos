

# Correção: Renderizar DispatchDashboard para Setor Despacho

## Problema Identificado

O código no `Index.tsx` está renderizando o componente errado para usuários do setor despacho:

```typescript
// Linha 85-86 - ATUAL (ERRADO)
: isDispatchSector
  ? <Dashboard />  // ← Deveria ser <DispatchDashboard />
```

O componente `DispatchDashboard` foi criado corretamente e importado na linha 4, mas na hora de renderizar (linha 86), ainda está usando `<Dashboard />` ao invés de `<DispatchDashboard />`.

## Correção Necessária

Alterar a linha 86 do arquivo `src/pages/Index.tsx`:

| Antes | Depois |
|-------|--------|
| `? <Dashboard />` | `? <DispatchDashboard />` |

## Arquivo a Modificar

**`src/pages/Index.tsx`** - Linha 86:

```typescript
// ANTES (linha 81-90)
{isKDSSector 
  ? (effectiveKdsMode === 'items' 
      ? <KDSItemsDashboard userSector={userSector} /> 
      : <KDSDashboard userSector={userSector} />) 
  : isDispatchSector
    ? <Dashboard />           // ❌ ERRADO
    : mainView === 'kds'
      ? <KDSItemsDashboard />
      : <Dashboard />
}

// DEPOIS
{isKDSSector 
  ? (effectiveKdsMode === 'items' 
      ? <KDSItemsDashboard userSector={userSector} /> 
      : <KDSDashboard userSector={userSector} />) 
  : isDispatchSector
    ? <DispatchDashboard />   // ✅ CORRETO
    : mainView === 'kds'
      ? <KDSItemsDashboard />
      : <Dashboard />
}
```

## Resultado Esperado

Após a correção:
- Usuario do setor DESPACHO verá apenas o Painel do Forno
- Admin/Owner continuará vendo o Dashboard completo com 4 colunas
- Usuarios de bancada (KDS) continuarão vendo a tela de itens

