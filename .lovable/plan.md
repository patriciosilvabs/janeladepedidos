
# Plano: Substituir Números por "FILA"

## Objetivo

Remover os números de posição (#1, #2, #3...) que confundem os funcionários e mostrar apenas a palavra **"FILA"** no próximo item a ser produzido.

---

## Mudança Proposta

**Arquivo**: `src/components/kds/KDSItemCard.tsx`

### Mudança no Badge de Posição (linhas 191-196)

```tsx
// ANTES - Mostra números em todos os cards
{isFifoEnabled && queuePosition && (
  <div className="absolute -top-3 -left-3 w-8 h-8 rounded-full flex items-center justify-center text-sm font-extrabold bg-primary text-primary-foreground shadow-lg">
    #{queuePosition}
  </div>
)}

// DEPOIS - Mostra "FILA" apenas no primeiro item pendente
{isFifoEnabled && isFirstInQueue && item.status === 'pending' && (
  <div className="absolute -top-3 -left-3 px-2 py-1 rounded-md flex items-center justify-center text-xs font-extrabold bg-primary text-primary-foreground shadow-lg">
    FILA
  </div>
)}
```

---

## Comportamento Visual

| Situação | Antes | Depois |
|----------|-------|--------|
| Item #1 pendente | Badge "#1" | Badge "FILA" |
| Item #2 pendente | Badge "#2" | Sem badge |
| Item #3 pendente | Badge "#3" | Sem badge |
| Item em preparo | Badge com número | Sem badge |

---

## Fluxo do Funcionário

```text
ANTES (confuso):                 DEPOIS (claro):
+------------------+             +------------------+
| #1               |             | FILA             |
| Pizza Calabresa  |             | Pizza Calabresa  |
| [INICIAR]        |             | [INICIAR]        |
+------------------+             +------------------+
| #2               |             |                  |
| Pizza Queijos    |             | Pizza Queijos    |
| [INICIAR]        |             | [INICIAR]        |
+------------------+             +------------------+
| #3               |             |                  |
| Pizza Margher    |             | Pizza Margher    |
| [INICIAR]        |             | [INICIAR]        |
+------------------+             +------------------+

Funcionário só precisa ver: "Qual tem FILA? Esse é o próximo!"
```

---

## Detalhes Técnicos

| Elemento | Valor |
|----------|-------|
| Arquivo | `src/components/kds/KDSItemCard.tsx` |
| Condição | `isFirstInQueue && item.status === 'pending'` |
| Texto | "FILA" (em vez de `#{queuePosition}`) |
| Formato | Retângulo arredondado (melhor para texto) |
| Cor | `bg-primary` (mesma cor atual) |

---

## Resumo

- **Remove**: Todos os números de posição (#1, #2, #3...)
- **Adiciona**: Badge "FILA" apenas no primeiro item pendente
- **Resultado**: Interface mais simples e clara para os funcionários
