

# Plano: Fluxo Correto - Bancada Envia ao Forno, Despacho Recebe

## Problema Identificado

O sistema esta funcionando corretamente, mas o usuario esta na **tela errada**:

| Rota `/` | Setor do Usuario | Tela Exibida | Funcionalidade |
|----------|------------------|--------------|----------------|
| `/` | Nenhum (owner/admin) | `Dashboard` | Ve pedidos + forno (recebe) |
| `/` | Setor KDS | `KDSItemsDashboard` | Ve itens + botao FORNO (envia) |

O usuario owner que esta na rota `/` ve o Dashboard (despacho), nao a tela da bancada onde esta o botao FORNO.

## Solucao

Atualmente o painel do forno (`OvenTimerPanel`) aparece no `Dashboard`, mas o owner/admin **nao tem como enviar itens ao forno** porque ele nao ve o `KDSItemsDashboard`.

Precisamos permitir que admins alternem entre as views ou mostrar ambas as telas.

### Opcao Recomendada: Permitir Admin Ver KDS

Adicionar tabs no `Index.tsx` para que admins possam alternar entre:
- **Dashboard** (despacho tradicional)
- **KDS Items** (ver como operador de bancada)

```text
┌────────────────────────────────────────────────────────────┐
│  Header                    [Despacho] [KDS]                │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  Tab "Despacho" → Dashboard (colunas + forno)              │
│  Tab "KDS"      → KDSItemsDashboard (bancada)              │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

---

## Mudancas Necessarias

### 1. Atualizar Index.tsx

Adicionar tabs principais para admins alternarem entre Dashboard e KDS:

```typescript
// Para admins sem setor, mostrar tabs para alternar entre views
const [mainView, setMainView] = useState<'dashboard' | 'kds'>('dashboard');

// No header ou abaixo dele
{isAdmin && !isKDSSector && (
  <Tabs value={mainView} onValueChange={(v) => setMainView(v)}>
    <TabsTrigger value="dashboard">Despacho</TabsTrigger>
    <TabsTrigger value="kds">KDS Producao</TabsTrigger>
  </Tabs>
)}

// Renderizacao
{isKDSSector 
  ? <KDSItemsDashboard userSector={userSector} />
  : mainView === 'kds'
    ? <KDSItemsDashboard />
    : <Dashboard />
}
```

### 2. Fluxo Esperado Apos Mudanca

```text
ADMIN/OWNER (sem setor)
────────────────────────────────────────────────────
1. Abre o sistema → Tabs: [Despacho] [KDS]
2. Clica em "KDS" → Ve KDSItemsDashboard
3. Clica INICIAR em um item → Status = in_prep
4. Clica FORNO → Status = in_oven
5. Item SOME da tela KDS
6. Clica em "Despacho" → Ve Dashboard com OvenTimerPanel
7. Timer contando → Ao acabar, pisca vermelho
8. Clica PRONTO → Status = ready, item vai para coluna "Pronto"

OPERADOR DE BANCADA (com setor KDS)
────────────────────────────────────────────────────
1. Abre o sistema → Ve APENAS KDSItemsDashboard
2. Clica INICIAR → Status = in_prep
3. Clica FORNO → Status = in_oven, item SOME da tela
4. Item aparece no tablet do DESPACHO (outro dispositivo)
```

---

## Arquivo a Modificar

| Arquivo | Alteracao |
|---------|-----------|
| `src/pages/Index.tsx` | Adicionar tabs para admins alternarem entre Dashboard e KDS |

---

## Beneficios

- Admins podem testar o fluxo completo em um unico dispositivo
- Operadores de bancada continuam vendo apenas sua fila
- Despacho continua funcionando como antes
- Fluxo de bancada → forno → despacho fica claro e testavel

