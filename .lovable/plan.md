

# Dobrar altura do botao PRONTO

Aumentar o tamanho do botao "PRONTO" nos cards do KDS para facilitar o toque em tablets.

## Arquivos alterados

### 1. `src/components/kds/OvenItemRow.tsx`

- Botao PRONTO (linha ~120): aumentar padding vertical de `py-2` para `py-6` e adicionar `min-h-[64px]`
- Badge PRONTO (estado ja pronto): mesmo ajuste de `py-1.5` para `py-4`

### 2. `src/components/OrderCard.tsx`

- Botao PRONTO (linha ~104): aumentar de `py-2` para `py-6` e `min-h-[28px]` para `min-h-[64px]`

