
# Plano: Posição Fixa dos Cards (Sem Mudança ao INICIAR)

## Problema Identificado

Quando um funcionário toca em INICIAR, dois problemas visuais ocorrem:

1. **Números da fila mudam** - A função `getQueuePosition` só conta itens `pending`, então quando um item vira `in_prep`, os números recalculam
2. **Badge de posição some** - O badge só aparece em itens `pending`

Isso pode causar confusão quando múltiplos funcionários usam o mesmo tablet.

---

## Solução

Manter a posição de fila **fixa baseada na ordem de criação**, independente do status. O badge de posição continuará visível mesmo após iniciar.

---

## Mudanças Propostas

### Arquivo 1: `src/components/kds/SectorQueuePanel.tsx`

**Mudança na função `getQueuePosition`** (linhas 113-118):

| Antes | Depois |
|-------|--------|
| Filtra apenas `pending` | Usa todos os itens (`displayItems`) |
| Posição muda ao iniciar | Posição permanece fixa |

```tsx
// ANTES
const getQueuePosition = (itemId: string): number | undefined => {
  const pendingItemsSorted = displayItems.filter(i => i.status === 'pending');
  const index = pendingItemsSorted.findIndex(i => i.id === itemId);
  return index >= 0 ? index + 1 : undefined;
};

// DEPOIS
const getQueuePosition = (itemId: string): number | undefined => {
  // Posição baseada na ordem de criação, independente do status
  const index = displayItems.findIndex(i => i.id === itemId);
  return index >= 0 ? index + 1 : undefined;
};
```

---

### Arquivo 2: `src/components/kds/KDSItemCard.tsx`

**Mudança na condição do badge** (linha 194):

| Antes | Depois |
|-------|--------|
| `item.status === 'pending'` | Mostrar sempre (remover condição de status) |

```tsx
// ANTES
{isFifoEnabled && queuePosition && item.status === 'pending' && (
  <div className="absolute -top-3 -left-3 ...">
    #{queuePosition}
  </div>
)}

// DEPOIS
{isFifoEnabled && queuePosition && (
  <div className="absolute -top-3 -left-3 ...">
    #{queuePosition}
  </div>
)}
```

---

## Comportamento Após Mudança

| Ação | Número na Fila | Posição do Card |
|------|----------------|-----------------|
| Card criado como #3 | #3 | Terceira posição |
| Clica INICIAR | #3 (mantém) | Terceira posição (mantém) |
| Clica FORNO | Card sai | Cards abaixo sobem |

---

## Fluxo Visual

```text
ANTES de clicar INICIAR:         DEPOIS de clicar INICIAR:
+------------------+             +------------------+
| #1               |             | #1               |
| Pizza Calabresa  |             | Pizza Calabresa  |
| [INICIAR]        |             | [FORNO] [X]      |
+------------------+             +------------------+
| #2               |             | #2               |  <-- Mantém #2!
| Pizza Queijos    |             | Pizza Queijos    |
| [INICIAR]        |             | [INICIAR]        |
+------------------+             +------------------+
| #3               |             | #3               |  <-- Mantém #3!
| Pizza Margher    |             | Pizza Margher    |
| [INICIAR]        |             | [INICIAR]        |
+------------------+             +------------------+

Cards NÃO mudam de posição até ir para o FORNO
```

---

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `src/components/kds/SectorQueuePanel.tsx` | Posição baseada em todos os itens, não apenas pending |
| `src/components/kds/KDSItemCard.tsx` | Mostrar badge de posição em todos os status |
