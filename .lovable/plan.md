

## Plano: Remover bloqueio de sabores no botao PRONTO do Forno

### Problema

O botao "PRONTO" no painel do forno fica inativo quando o item possui sabores (campo `flavors`). O sistema exige que o operador clique manualmente em cada chip de sabor antes de liberar o botao -- isso causa confusao e trava a operacao.

### Solucao

Remover a logica de verificacao obrigatoria de sabores no componente `OvenItemRow`. Os sabores continuam sendo exibidos como informacao visual, mas **nao bloqueiam mais o botao**.

### Alteracoes

**Arquivo:** `src/components/kds/OvenTimerPanel.tsx`

1. Remover o estado `confirmedFlavors` e a funcao `toggleFlavor`
2. Remover a variavel `allFlavorsConfirmed`
3. Remover a condicao `!allFlavorsConfirmed` do `disabled` do botao
4. Manter a exibicao dos sabores como texto informativo (sem interacao de clique)
5. Remover classes condicionais de opacidade ligadas a `allFlavorsConfirmed`

### Resultado

- O botao "PRONTO" ficara habilitado assim que o timer zerar (ou a qualquer momento)
- Os sabores continuam visiveis no card para referencia do operador
- Nenhum bloqueio por falta de confirmacao de sabor

### Detalhes Tecnicos

A unica alteracao e no componente `OvenItemRow` dentro de `src/components/kds/OvenTimerPanel.tsx`:

```text
Antes (linha 169):
  disabled={isProcessing || isAnyProcessing || !allFlavorsConfirmed}

Depois:
  disabled={isProcessing || isAnyProcessing}
```

Os chips de sabor passam de botoes clicaveis para badges estaticas de leitura.

