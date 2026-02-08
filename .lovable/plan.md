
# Ajustar tarjas de Borda e Observacoes para tamanho do conteudo

## Problema

As tarjas de borda (laranja) e observacoes (vermelha) atualmente ocupam toda a largura do card. O usuario quer que elas tenham apenas o tamanho necessario para o texto.

## Solucao

Trocar o `div` wrapper de bloco (`block`) para `inline-flex` (ou `w-fit`) nas tarjas de `edge_type` e `notes`, em todos os arquivos onde aparecem:

- `src/components/kds/OvenItemRow.tsx` (linhas 118 e 126)
- `src/components/kds/OrderOvenBlock.tsx` (linhas 153 e 203 para edge_type; notes onde houver)
- `src/components/kds/KDSItemCard.tsx` (linha 249)

## Detalhe tecnico

Em cada ocorrencia, adicionar a classe `w-fit` ao `div` da tarja para que ele ocupe apenas o tamanho do conteudo.

Antes:
```tsx
<div className="mt-1 p-1.5 bg-orange-600 rounded-md animate-pulse">
```

Depois:
```tsx
<div className="mt-1 p-1.5 bg-orange-600 rounded-md animate-pulse w-fit">
```

A mesma mudanca sera aplicada nas tarjas de observacoes (`bg-red-600`) e nas tarjas de borda em todos os 3 arquivos.
