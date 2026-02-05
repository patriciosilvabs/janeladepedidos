

# Plano: Reverter Mudanças do Admin e Corrigir Visão das Bancadas

## Problema Identificado

O usuário reportou que os **tablets das bancadas** não estão mostrando os pedidos "desmembrados" (por item). Após investigação detalhada:

### Dados do Banco (Confirmados Corretos)
- Configuração: `kds_default_mode = 'items'` (correto)
- Itens sendo criados corretamente como registros individuais em `order_items`
- Itens sendo distribuídos para setores (BANCADA A, BANCADA B)
- Operadores online nos tablets

### Lógica do Código (Revisada)
A lógica no `Index.tsx` **está correta** para operadores de bancada:

```typescript
// Para operadores (não-admin)
const effectiveKdsMode = isAdmin ? kdsMode : (settings?.kds_default_mode || 'items');
// → effectiveKdsMode = 'items' (do banco)

// Renderização
{isKDSSector 
  ? (effectiveKdsMode === 'items' 
      ? <KDSItemsDashboard userSector={userSector} />  // ← DEVERIA MOSTRAR ISSO
      : <KDSDashboard userSector={userSector} />) 
```

### Problema Real Identificado

As mudanças que fiz anteriormente **não afetam os tablets das bancadas** pois:
- Mudei `mainView` inicial de `'dashboard'` para `'kds'` - isso só afeta admins SEM setor
- Operadores de bancada TÊM setor vinculado (`isKDSSector = true`), então vão direto para o KDSItemsDashboard

O problema pode estar em:
1. **Cache do navegador** nos tablets com versão antiga
2. **Sessão antiga** precisando de reload
3. **Problema de sincronização** com as configurações

---

## Solução

### 1. Reverter Mudanças do Admin

Voltar o estado inicial de `mainView` para `'dashboard'` conforme solicitado, pois admins devem ver tudo:

```typescript
// ANTES (minha mudança)
const [mainView, setMainView] = useState<'dashboard' | 'kds'>('kds');

// DEPOIS (revertendo)
const [mainView, setMainView] = useState<'dashboard' | 'kds'>('dashboard');
```

### 2. Remover Lógica Desnecessária do useEffect

Remover a parte que força mainView para admins, já que queremos que eles vejam o Dashboard:

```typescript
useEffect(() => {
  if (settings?.kds_default_mode) {
    setKdsMode(settings.kds_default_mode);
    // REMOVER: A lógica abaixo não é mais necessária
    // if (!isKDSSector && !isDispatchSector) { ... }
  }
}, [settings?.kds_default_mode]);
```

### 3. Restaurar Ordem das Tabs

Voltar a ordem original: Despacho primeiro, KDS Produção depois:

```typescript
<TabsList className="h-8">
  <TabsTrigger value="dashboard" className="text-xs px-3">
    Despacho
  </TabsTrigger>
  <TabsTrigger value="kds" className="text-xs px-3">
    KDS Produção
  </TabsTrigger>
</TabsList>
```

---

## Verificação para os Tablets

Para os tablets das bancadas funcionarem corretamente, precisamos garantir que:

1. O operador está logado com um usuário vinculado a um setor KDS
2. O navegador tem a versão mais recente do código (fazer hard refresh: Ctrl+Shift+R)
3. A configuração `kds_default_mode` está como `'items'` no banco

### Teste nos Tablets

Após as mudanças:
1. Fazer logout e login novamente nos tablets
2. Ou fazer hard refresh (Ctrl+Shift+R ou Cmd+Shift+R)
3. O tablet deve mostrar o `KDSItemsDashboard` com cards individuais

---

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `src/pages/Index.tsx` | Reverter `mainView` inicial para `'dashboard'` |
| `src/pages/Index.tsx` | Remover lógica que força `mainView` no useEffect |
| `src/pages/Index.tsx` | Restaurar ordem das tabs (Despacho primeiro) |

---

## Resultado Esperado

| Tipo de Usuário | Visualização |
|-----------------|--------------|
| **Admin (Owner)** sem setor | Dashboard de Despacho com tabs para alternar |
| **Operador de Bancada** | KDSItemsDashboard com itens individuais |
| **Operador de Despacho** | DispatchDashboard |

