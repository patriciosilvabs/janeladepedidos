
# Plano: Badge "FILA" Aparece Imediatamente no Próximo Item Pendente

## Problema Identificado

Ao clicar em INICIAR, o badge "FILA" não aparece no próximo item pendente porque:

1. A condição `isFirstInQueue` verifica se é o primeiro da lista geral (que agora está em preparo)
2. O próximo item pendente não recebe o badge automaticamente

---

## Solução

Criar uma nova propriedade `isFirstPending` que identifica o **primeiro item com status pendente**, independente da posição geral na fila.

---

## Mudanças Propostas

### Arquivo 1: `src/components/kds/SectorQueuePanel.tsx`

**Adicionar função para encontrar primeiro pendente**:

```tsx
// NOVA função - identifica o primeiro item pendente
const getFirstPendingId = useMemo(() => {
  // Encontrar o primeiro item com status 'pending' na ordem de criação
  const firstPending = displayItems.find(i => i.status === 'pending');
  return firstPending?.id ?? null;
}, [displayItems]);
```

**Passar nova prop para KDSItemCard**:

```tsx
<KDSItemCard
  key={item.id}
  item={item}
  // ... outras props
  isFirstPending={item.id === getFirstPendingId}  // NOVA PROP
/>
```

---

### Arquivo 2: `src/components/kds/KDSItemCard.tsx`

**Atualizar interface para receber `isFirstPending`**:

```tsx
interface KDSItemCardProps {
  // ... outras props
  isFirstPending?: boolean;  // NOVA
}
```

**Mudar condição do badge**:

```tsx
// ANTES - Usava isFirstInQueue (posição geral)
{isFifoEnabled && isFirstInQueue && item.status === 'pending' && (

// DEPOIS - Usa isFirstPending (primeiro pendente)
{isFifoEnabled && isFirstPending && item.status === 'pending' && (
```

---

## Comportamento Após Mudança

| Ação | Badge "FILA" |
|------|--------------|
| 3 itens pendentes, nenhum iniciado | Aparece no 1º item |
| Clica INICIAR no 1º item | Aparece IMEDIATAMENTE no 2º item (agora é o 1º pendente) |
| Clica INICIAR no 2º item | Aparece IMEDIATAMENTE no 3º item |
| Não há mais pendentes | Sem badge |

---

## Fluxo Visual

```text
ANTES de clicar:                 DEPOIS de clicar INICIAR:
+------------------+             +------------------+
| FILA             |             |                  |
| Pizza Calabresa  |             | Pizza Calabresa  |
| [INICIAR]        |             | [FORNO] [X]      |  <- Em preparo (azul)
+------------------+             +------------------+
|                  |             | FILA             |  <- Badge aparece!
| Pizza Queijos    |             | Pizza Queijos    |
| [INICIAR]        |             | [INICIAR]        |
+------------------+             +------------------+
|                  |             |                  |
| Pizza Margher    |             | Pizza Margher    |
| [INICIAR]        |             | [INICIAR]        |
+------------------+             +------------------+

Outro funcionário vê IMEDIATAMENTE qual é o próximo!
```

---

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `src/components/kds/SectorQueuePanel.tsx` | Calcular `getFirstPendingId` e passar como prop |
| `src/components/kds/KDSItemCard.tsx` | Receber `isFirstPending` e usar na condição do badge |

---

## Por que funciona imediatamente

A atualização otimística no `useOrderItems.ts` já muda o status do item para `in_prep` **antes** da resposta do servidor. Isso faz o `useMemo` recalcular `getFirstPendingId` instantaneamente, exibindo o badge no próximo item pendente.
