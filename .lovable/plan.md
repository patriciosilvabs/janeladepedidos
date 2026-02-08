
# Remover timer numerico e manter apenas a barra de progresso

## O que muda

No componente `OvenItemRow`, o timer numerico (ex: "0:00", "1:30") que aparece no lado esquerdo do card sera removido. A barra de progresso que ja existe (o fundo que vai preenchendo) continuara funcionando normalmente como indicador visual do tempo restante.

## Detalhes

**Arquivo:** `src/components/kds/OvenItemRow.tsx`

1. **Remover o bloco do timer numerico** (linhas 97-111) - o `div` com `formatTime(countdown)` e o icone de alerta triangular serao removidos
2. **Remover o bloco "OK" de itens prontos** (linhas 98-102) - o indicador verde com "OK" no lado esquerdo tambem sera removido (o badge "PRONTO" verde no lado direito ja cumpre essa funcao)
3. **Remover a funcao `formatTime`** (linhas 59-63) que nao sera mais utilizada
4. **Remover import do `AlertTriangle`** que nao sera mais necessario
5. **Manter toda a logica do countdown** internamente, pois ela alimenta a barra de progresso, as cores de urgencia e o alerta sonoro
6. **Manter a barra de fundo** (linhas 86-94) que preenche visualmente conforme o tempo passa

O mesmo se aplica ao `OrderOvenBlock.tsx` onde itens "ready" exibem "OK" no lado esquerdo (linhas 147-149) - esse indicador tambem sera removido pois o badge "PRONTO" ja indica o status.

## Resultado visual

Antes: `[0:00] [#6609] [Retirada] Pizza Grande... [PRONTO]`
Depois: `[#6609] [Retirada] Pizza Grande... [PRONTO]`

Mais espaco horizontal para as informacoes do produto, e a barra de fundo continua indicando o progresso do tempo.
