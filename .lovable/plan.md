

# Reduzir fonte da categoria (nome do produto) em 50%

## O que muda

No card KDS (`KDSItemCard.tsx`), o nome do produto (ex: "Pizza Grande - Meio a Meio") atualmente usa `text-sm`. Sera reduzido para `text-xs`, que corresponde a aproximadamente metade do tamanho.

## Detalhe tecnico

**Arquivo:** `src/components/kds/KDSItemCard.tsx`

Alterar a linha do produto de `text-sm` para `text-xs`:

```
<span className="text-xs text-muted-foreground">
```

Apenas essa unica alteracao.

