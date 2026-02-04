
# Restringir Visibilidade de Itens por Setor do Usuario

## Problema Atual

Usuarios vinculados a um setor especifico (ex: "BANCADA A") conseguem ver itens de **todos** os setores KDS atraves das abas. Isso quebra a separacao logica de areas de producao.

## Situacao Identificada

| Usuario | Setor Vinculado | O que deveria ver |
|---------|-----------------|-------------------|
| Owner (sem setor) | Nenhum | Dashboard de gerenciamento |
| user-a@domhelderpizzaria.com.br | BANCADA A | **Somente** itens do setor BANCADA A |

## Solucao Proposta

Modificar `KDSItemsDashboard` para:
1. Receber o `userSector` do usuario logado
2. Se o usuario esta vinculado a um setor, mostrar **apenas** esse setor (sem abas)
3. Se o usuario nao esta vinculado a nenhum setor (admin/gerente), manter comportamento atual com todas as abas

### Fluxo Atualizado

```text
Usuario faz login
       |
       v
Index.tsx busca userSector via useUserSector()
       |
       v
userSector.view_type === 'kds'?
    |            |
   SIM          NAO
    |            |
    v            v
KDSItemsDashboard   Dashboard (gerenciamento)
com userSector.id
    |
    v
Filtra items APENAS do setor do usuario
```

## Mudancas Tecnicas

### Arquivo: `src/pages/Index.tsx`

Passar o `userSector` como prop para o `KDSItemsDashboard`:

```tsx
// ANTES (linha 45):
{isKDSSector 
  ? (kdsMode === 'items' ? <KDSItemsDashboard /> : <KDSDashboard />) 
  : <Dashboard />
}

// DEPOIS:
{isKDSSector 
  ? (kdsMode === 'items' 
    ? <KDSItemsDashboard userSector={userSector} /> 
    : <KDSDashboard userSector={userSector} />) 
  : <Dashboard />
}
```

### Arquivo: `src/components/kds/KDSItemsDashboard.tsx`

1. Aceitar prop `userSector`
2. Se usuario tem setor vinculado, mostrar apenas itens desse setor (sem abas)
3. Filtrar useOrderItems pelo sectorId do usuario

```tsx
// Interface para props
interface KDSItemsDashboardProps {
  userSector?: Sector | null;
}

export function KDSItemsDashboard({ userSector }: KDSItemsDashboardProps) {
  // Se usuario tem setor especifico, usar como filtro
  const filterSectorId = userSector?.id;
  
  // Buscar items filtrados pelo setor do usuario
  const { items, pendingItems, ... } = useOrderItems({ 
    sectorId: filterSectorId 
  });
  
  // ...
  
  // Se usuario esta vinculado a um setor, NAO mostrar abas
  // Mostrar apenas a fila do seu setor
  if (filterSectorId) {
    return (
      <div className="flex-1">
        <SectorQueuePanel 
          sectorId={filterSectorId} 
          sectorName={userSector?.name || 'Fila de Producao'} 
        />
      </div>
    );
  }
  
  // Comportamento original para admins (sem setor vinculado)
  // ... manter logica de abas
}
```

### Arquivo: `src/components/KDSDashboard.tsx`

Aplicar a mesma logica para o modo "Por Pedido", restringindo pelos pedidos do setor do usuario.

## Comportamento Final

| Tipo de Usuario | Interface |
|-----------------|-----------|
| Operador KDS (vinculado a setor) | Ve apenas itens do seu setor, sem abas |
| Admin/Owner (sem setor vinculado) | Ve todos os setores com abas (comportamento atual) |

## Arquivos a Modificar

| Arquivo | Acao |
|---------|------|
| `src/pages/Index.tsx` | Passar userSector como prop |
| `src/components/kds/KDSItemsDashboard.tsx` | Filtrar por setor do usuario |
| `src/components/KDSDashboard.tsx` | Aplicar mesma logica |

## Beneficios

- Operadores veem apenas itens relevantes ao seu setor
- Evita confusao entre areas de producao
- Mantém flexibilidade para admins visualizarem todos os setores
