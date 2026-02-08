

# Desmembrar Pedido #6592 Existente

## Situacao

A migracao aplicada anteriormente ja resolve o problema para **novos pedidos**. Porem, o pedido #6592 foi criado antes da correcao e continua com o formato antigo: 1 unico registro contendo 3 sabores, 3 bordas e 2 complementos agrupados.

## O que sera feito

Executar uma operacao de dados (INSERT + DELETE) para substituir o registro agrupado por 3 registros individuais:

```text
REGISTRO ATUAL (sera deletado):
ID: 75ca7673-...
Sabores: BAURU (G), CALABRESA ACEBOLADA (G), CALABRESA (G)
Bordas: Cheddar, Cream Cheese, Catupiry
Complementos: 2x Refri 1L
Setor: BORDAS -> next: PRODUCAO A

REGISTROS NOVOS (serao criados):
1. Sabor: BAURU (G) | Borda: Cheddar | Complementos: 2x Refri 1L | BORDAS -> PRODUCAO A
2. Sabor: CALABRESA ACEBOLADA (G) | Borda: Cream Cheese | Sem complementos | BORDAS -> PRODUCAO A  
3. Sabor: CALABRESA (G) | Borda: Catupiry | Sem complementos | BORDAS -> PRODUCAO B (balanceamento)
```

## Detalhes Tecnicos

- Usar operacao de dados (INSERT/DELETE) para criar 3 novos `order_items` e remover o antigo
- Manter o mesmo `order_id`, `product_name`, `assigned_sector_id` (BORDAS) e `next_sector_id`
- Distribuir o `next_sector_id` entre PRODUCAO A e B para balanceamento
- Complementos e observacoes apenas no primeiro registro
- Nenhuma alteracao de schema necessaria, apenas dados

