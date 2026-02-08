
# Exibir informacoes completas nos itens do Forno/Despacho

## Problema

O painel do Forno (`OvenItemRow` e `OrderOvenBlock`) mostra apenas o nome do produto e sabores. Faltam informacoes essenciais que aparecem nas bancadas (`KDSItemCard`):

- **Borda** (`edge_type`) -- tarja laranja piscante
- **Complementos** (`complements`) -- lista de massas, adicionais
- **Observacoes** (`notes`) -- tarja vermelha piscante com aviso

## Solucao

Adicionar as mesmas informacoes visuais do `KDSItemCard` nos componentes do Forno, mantendo o mesmo padrao visual (tarjas laranja e vermelha piscantes).

## Detalhes Tecnicos

### Arquivo: `src/components/kds/OvenItemRow.tsx`

Dentro da div de "Item info" (apos o nome do produto e antes do fechamento da div flex-1), adicionar:

1. **Borda** -- tarja laranja piscante (igual ao KDSItemCard):
```tsx
{item.edge_type && (
  <div className="mt-1 p-1.5 bg-orange-600 rounded-md animate-[pulse_0.8s_ease-in-out_infinite]">
    <p className="text-sm text-white font-bold whitespace-pre-line">
      {item.edge_type}
    </p>
  </div>
)}
```

2. **Complementos** -- texto secundario:
```tsx
{item.complements && (
  <p className="mt-1 text-sm text-muted-foreground whitespace-pre-line">
    {item.complements}
  </p>
)}
```

3. **Observacoes** -- tarja vermelha piscante:
```tsx
{item.notes && (
  <div className="mt-1 p-1.5 bg-red-600 rounded-md animate-[pulse_0.8s_ease-in-out_infinite]">
    <p className="text-sm text-white font-bold uppercase">
      OBS: {item.notes}
    </p>
  </div>
)}
```

### Arquivo: `src/components/kds/OrderOvenBlock.tsx`

Aplicar as mesmas alteracoes em tres lugares:

1. **Itens do forno** (dentro do map de `sortedOvenItems`) -- ja usa `OvenItemRow`, entao herda automaticamente.

2. **Itens ja prontos** (`dbReadyItems` map, por volta da linha 119) -- apos o nome do produto, adicionar borda, complementos e observacoes com o mesmo padrao.

3. **Itens aguardando** (`waitingItems` map, por volta da linha 146) -- apos os sabores, adicionar complementos e observacoes (com opacidade reduzida coerente com o estilo existente).

### Resultado

| Informacao | Bancada | Forno (antes) | Forno (depois) |
|------------|---------|---------------|----------------|
| Nome produto | Sim | Sim | Sim |
| Sabores | Sim | Sim | Sim |
| Borda (laranja) | Sim | Nao | Sim |
| Complementos | Sim | Nao | Sim |
| Observacoes (vermelha) | Sim | Nao | Sim |
