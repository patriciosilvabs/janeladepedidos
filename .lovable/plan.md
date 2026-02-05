

# Plano: Garantir Exclusividade de Visualização por Setor no KDS

## Problema Identificado

Itens desmembrados estão aparecendo em **ambos os tablets**, quando deveriam aparecer apenas no tablet do setor atribuído. Isso gera conflito pois dois operadores podem tentar trabalhar no mesmo item.

### Diagnóstico do Banco de Dados

Os dados estão **corretos**:
```
order_items (pedido sim-1770264422061):
├── Pizza Margherita → BANCADA A (92e3f369...)
├── Pizza Margherita → BANCADA A 
├── Pizza Margherita → BANCADA B (bfbd6e97...)
└── Pizza Margherita → BANCADA B
```

### Diagnóstico do Código

O hook `useOrderItems` filtra por `sectorId` corretamente na linha 38-39:
```typescript
if (sectorId) {
  query = query.eq('assigned_sector_id', sectorId);
}
```

### Possíveis Causas

1. **Usuário admin visualizando KDS**: O admin (`patriciobarbosadasilva@gmail.com`) não tem setor vinculado. Quando acessa a aba "KDS Produção", vê a aba "Todos" que mostra todos os itens sem filtro.

2. **Múltiplas abas abertas**: Se os tablets estão usando a mesma conta (admin) ou não estão logados com os operadores corretos, verão todos os itens.

3. **Cache de query compartilhado**: Se a query `['order-items', undefined, ...]` foi executada antes (sem sectorId), ela pode estar sendo reusada.

---

## Solução

### 1. Verificar Vinculação de Usuários (Imediato)

Confirmar que cada tablet está logado com o operador correto:

| Tablet | Usuário Esperado | Setor |
|--------|------------------|-------|
| Tablet 1 | user-a@domhelderpizzaria.com.br | BANCADA A |
| Tablet 2 | user-b@domhelderpizzaria.com.br | BANCADA B |

### 2. Remover Aba "Todos" para Evitar Conflitos

Modificar o `KDSItemsDashboard` para que **mesmo admins** vejam os itens separados por aba de setor, sem opção "Todos".

### 3. Forçar Filtro por Setor no SectorQueuePanel

Quando `sectorId` não é passado, o painel não deveria mostrar itens que já estão atribuídos a setores específicos.

---

## Alterações de Código

### Arquivo: `src/components/kds/KDSItemsDashboard.tsx`

**Antes (linha 70-81)**:
```tsx
<Tabs defaultValue="all">
  <TabsTrigger value="all">Todos</TabsTrigger>
  ...
  <TabsContent value="all">
    <SectorQueuePanel sectorName="Todos os Setores" />
    // SEM sectorId - mostra TODOS os itens!
  </TabsContent>
```

**Depois**:
```tsx
<Tabs defaultValue={kdsSectors[0]?.id}>
  // Remover aba "Todos"
  {kdsSectors.map((sector) => (
    <TabsTrigger key={sector.id} value={sector.id}>
      {sector.name}
    </TabsTrigger>
  ))}
  ...
  {kdsSectors.map((sector) => (
    <TabsContent key={sector.id} value={sector.id}>
      <SectorQueuePanel 
        sectorId={sector.id}  // SEMPRE passa sectorId
        sectorName={sector.name} 
      />
    </TabsContent>
  ))}
```

### Arquivo: `src/components/kds/SectorQueuePanel.tsx`

Adicionar validação para impedir renderização sem sectorId:

```tsx
// Se não tiver sectorId, não mostrar itens (evita conflito)
if (!sectorId) {
  return (
    <Card>
      <CardContent className="py-8 text-center text-muted-foreground">
        <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>Selecione um setor para visualizar os itens.</p>
      </CardContent>
    </Card>
  );
}
```

---

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `src/components/kds/KDSItemsDashboard.tsx` | Remover aba "Todos", sempre usar primeiro setor como default |
| `src/components/kds/SectorQueuePanel.tsx` | Bloquear renderização sem sectorId |

---

## Resultado Esperado

| Tela | Antes | Depois |
|------|-------|--------|
| Tablet BANCADA A | 4 pizzas (todas) | 2 pizzas (apenas BANCADA A) |
| Tablet BANCADA B | 4 pizzas (todas) | 2 pizzas (apenas BANCADA B) |
| Admin sem setor | 4 pizzas (aba Todos) | Abas separadas: BANCADA A (2), BANCADA B (2) |

---

## Verificação Pré-Implementação

Antes de implementar, confirme qual usuário está logado em cada tablet para garantir que não é apenas um problema de login incorreto.

