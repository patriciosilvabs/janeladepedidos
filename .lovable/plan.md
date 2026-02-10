
## Correção: Roteamento de Bordas e Reparo do Pedido #9733

### Problema Identificado

O pedido #9733 (Liliane, UNIDADE CACHOEIRINHA) foi importado corretamente pelo polling com smart grouping funcionando (1 item com 2 sabores meio-a-meio). Porém, o roteamento de bordas FALHOU:

- Item tem `edge_type: # Massa Tradicional` (borda detectada corretamente)
- `assigned_sector_id` = PRODUCAO A (errado - deveria ser BORDAS)
- `next_sector_id` = NULL (errado - deveria ser PRODUCAO A)

Isso indica que a correcao anterior da RPC `create_order_items_from_json` pode nao ter sido aplicada ao banco de dados, ou foi sobrescrita.

### Plano de Correcao

#### 1. Re-aplicar a RPC com roteamento correto (Migration SQL)

Recriar a funcao `create_order_items_from_json` via nova migration para garantir que o roteamento de bordas esteja correto:

```text
Logica correta:
  IF item tem borda AND setor de bordas esta configurado THEN
    next_sector_id = setor de producao (calculado por balanceamento)
    assigned_sector_id = setor de BORDAS
  END IF
```

Isso garante que o item COMECE em BORDAS e DEPOIS va para PRODUCAO.

#### 2. Reparar o pedido #9733

Executar UPDATE direto para corrigir o item atual:

```text
UPDATE order_items
SET assigned_sector_id = BORDAS, next_sector_id = PRODUCAO_A
WHERE id = '98f5ccca-...'
```

Isso faz o item aparecer imediatamente no tablet de BORDAS.

#### 3. Atualizar versao para v1.0.21

### Detalhes Tecnicos

**Arquivos modificados:**
- Nova migration SQL para recriar `create_order_items_from_json` (garantir que a versao correta esta no banco)
- `src/lib/version.ts` - bump para v1.0.21

**Validacao:** Apos aplicar, verificar que novos pedidos com borda aparecem primeiro no tablet de BORDAS.
