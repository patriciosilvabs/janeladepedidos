

# Plano: Cards Fixos na Posicao (Sem Reordenacao ao Iniciar)

## Objetivo

Garantir que os cards **mantenham sua posicao na tela** quando o usuario clica em INICIAR. O card so deve sair da tela quando o usuario clicar em **FORNO**.

---

## Problema Atual

A ordenacao atual no `SectorQueuePanel.tsx` (linha 104-115) ordena por **status primeiro**:
- `pending` = posicao 0
- `in_prep` = posicao 1

Isso faz com que quando um item muda de `pending` para `in_prep`, ele seja movido para o final da lista de pendentes.

---

## Solucao

Remover a ordenacao por status e ordenar **apenas por `created_at`**. Isso mantem os cards na mesma posicao independente do status.

---

## Mudanca Proposta

**Arquivo**: `src/components/kds/SectorQueuePanel.tsx`

```tsx
// ANTES (linhas 104-115)
const displayItems = useMemo(() => {
  return [...items].sort((a, b) => {
    const statusOrder = { pending: 0, in_prep: 1, in_oven: 2, ready: 3 };
    const orderA = statusOrder[a.status] ?? 99;
    const orderB = statusOrder[b.status] ?? 99;
    if (orderA !== orderB) return orderA - orderB;
    // Then by created_at
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });
}, [items]);

// DEPOIS
const displayItems = useMemo(() => {
  // Ordenar APENAS por created_at para manter posicao fixa
  // Cards so saem da tela ao ir para o forno (status muda para 'in_oven')
  return [...items].sort((a, b) => {
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });
}, [items]);
```

---

## Comportamento Apos Mudanca

| Acao | Comportamento |
|------|---------------|
| Clica INICIAR | Card fica na mesma posicao, muda visual (borda azul, botao FORNO) |
| Clica FORNO | Card sai da tela (status muda para `in_oven`), os de baixo sobem |

---

## Fluxo Visual

```text
ANTES de clicar INICIAR:         DEPOIS de clicar INICIAR:
+------------------+             +------------------+
| #1 Pizza Calabr  |             | #1 Pizza Calabr  |
| [INICIAR]        |   -->       | [FORNO] [X]      |  <-- Mesmo lugar!
+------------------+             +------------------+
| #2 Pizza Queijos |             | #2 Pizza Queijos |
| [INICIAR]        |             | [INICIAR]        |
+------------------+             +------------------+
| #3 Pizza Margher |             | #3 Pizza Margher |
| [INICIAR]        |             | [INICIAR]        |
+------------------+             +------------------+

DEPOIS de clicar FORNO no #1:
+------------------+
| #2 Pizza Queijos |  <-- Subiu para cima!
| [INICIAR]        |
+------------------+
| #3 Pizza Margher |
| [INICIAR]        |
+------------------+
```

---

## Arquivo a Modificar

| Arquivo | Mudanca |
|---------|---------|
| `src/components/kds/SectorQueuePanel.tsx` | Remover ordenacao por status, ordenar apenas por `created_at` |

