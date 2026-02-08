

# Ajustes de fonte e correcao de cores no painel do Forno

## 1. Ajustar tamanhos de fonte (OvenItemRow.tsx)

**Categoria (nome do produto):** Reduzir de `text-2xl` para `text-base` (linha 101)

**Sabores:** Aumentar de `text-base` para `text-2xl font-bold` (linha 110)

Resultado visual:
```text
[#6623] [Retirada]
Pizza Grande - 1 Sabor        <-- text-base (menor)
AMERICANA (G)                 <-- text-2xl bold (maior)
```

## 2. Corrigir cores do botao PRONTO no tablet (OvenItemRow.tsx)

O problema e que o Tailwind pode nao aplicar `bg-blue-600` e `bg-green-600` corretamente dentro de `cn()` com condicoes, pois classes conflitantes do `className` base podem ter prioridade.

**Correcao:** Usar `!bg-blue-600` e `!bg-green-600` (important) para garantir que as cores sejam aplicadas, ou reestruturar para que as classes de cor nao compitam entre si. A abordagem mais segura e separar a cor de fundo da string base e coloca-la apenas nas condicionais.

Linha 142-148 atual:
```tsx
className={cn(
  "text-white shrink-0 text-lg px-4 py-2",
  isProcessing 
    ? "bg-gray-500"
    : isUrgent 
    ? "bg-red-600 hover:bg-red-700" 
    : "bg-blue-600 hover:bg-blue-700"
)}
```

O Badge verde (linha 134) tambem sera reforçado com `!important`:
```tsx
className="!bg-green-600 text-white shrink-0 text-lg px-4 py-1.5"
```

## Resumo de alteracoes

**Arquivo unico:** `src/components/kds/OvenItemRow.tsx`

- Linha 101: `text-2xl` -> `text-base` (categoria menor)
- Linha 110: `text-base` -> `text-2xl font-bold` (sabores maiores)
- Linha 134: Adicionar `!` prefix no `bg-green-600` do Badge PRONTO
- Linha 142-148: Adicionar `!` prefix nas classes de cor do Button para forcar aplicacao no tablet

