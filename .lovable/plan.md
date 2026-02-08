
# Diferenciar visualmente item PRONTO de item ainda no forno

## Problema

Ambos os estados (item com timer ativo e item ja marcado como PRONTO) usam o botao verde "PRONTO", causando confusao visual. O operador nao consegue distinguir rapidamente o que ja foi concluido do que ainda precisa de acao.

## Solucao

Mudar a cor do botao "PRONTO" do item que ainda esta no forno (acao pendente) para **azul**, mantendo o badge "PRONTO" do item ja concluido em **verde**. Isso cria uma distincao clara:

- **Azul** = botao de acao ("clique aqui para marcar como pronto")
- **Verde** = status confirmado ("este item ja esta pronto")

## Detalhes Tecnicos

### Arquivo: `src/components/kds/OvenItemRow.tsx`

Alterar as classes do `Button` de acao (linha ~107-118):

- De: `bg-green-600 hover:bg-green-700` (estado normal)
- Para: `bg-blue-600 hover:bg-blue-700`

O estado urgente (`isUrgent`) continua vermelho, e o badge de status "PRONTO" (ja marcado) permanece verde (`bg-green-600`).

### Arquivo: `src/components/kds/OrderOvenBlock.tsx`

Se o botao "DESPACHAR" tambem usar verde, verificar e ajustar para manter consistencia. O botao DESPACHAR deve permanecer com sua cor atual (provavelmente ja esta diferenciado).

### Resultado visual esperado

| Estado | Cor |
|--------|-----|
| Botao PRONTO (acao pendente) | Azul |
| Botao PRONTO (urgente/timer < 10s) | Vermelho |
| Badge PRONTO (item concluido) | Verde |
| Borda do item concluido | Verde |
