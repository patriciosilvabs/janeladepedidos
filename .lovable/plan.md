
# Correcao: Pedidos nao aparecem no tablet do forno/despacho

## Problema
A query de itens do forno busca TODOS os itens com status `in_oven` e `ready` sem filtro de data. Com o acumulo de centenas de itens antigos que nunca foram limpos, a lista de `ovenOrderIds` (IDs de pedidos para buscar itens "irmaos") gera uma URL tao longa que o banco de dados rejeita com erro **400 Bad Request**. Isso quebra a query de itens irmaos e o painel do forno fica vazio.

Os demais tablets (producao) funcionam porque filtram por `sectorId` e status `pending`/`in_prep`, que retornam poucos resultados.

## Solucao
Adicionar um filtro temporal na query principal do `useOrderItems` quando o status inclui `in_oven`/`ready` (usado pelo forno). Itens com mais de 48 horas serao ignorados, mantendo a lista de `ovenOrderIds` pequena e evitando o estouro de URL.

## Detalhes Tecnicos

### Arquivo: `src/hooks/useOrderItems.ts`

1. Na query principal (`queryFn`), quando o filtro de status inclui `in_oven` ou `ready`, adicionar um filtro `.gte('created_at', ...)` limitando aos ultimos 2 dias (48h). Isso reduz drasticamente o numero de resultados sem afetar a operacao normal (itens no forno ficam la por minutos, nao dias).

2. Limitar o array `ovenOrderIds` a no maximo 50 pedidos (seguranca extra contra URLs longas). Se por algum motivo ainda houver muitos, a query de siblings continuara funcionando.

3. Na query de siblings, adicionar o mesmo filtro temporal como seguranca adicional.

### Resultado
- A URL da query de siblings volta a ter tamanho aceitavel
- Pedidos ativos aparecem normalmente no tablet do forno
- Itens antigos/orfaos sao ignorados sem precisar limpa-los do banco
- Nenhum impacto nos demais tablets
