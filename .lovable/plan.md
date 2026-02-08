
# Classificar produto como borda quando o nome do produto contém palavra-chave de borda

## Problema

Atualmente, o sistema só verifica as **opções** (options) de um item contra as palavras-chave de borda. Se o próprio **nome do produto** contiver uma palavra-chave (ex: "Borda de Chocolate", "Domzitos"), o sistema não reconhece como borda e o item não aparece com a tarja laranja nem é roteado para o setor de bordas.

## Solução

Adicionar uma verificação do **nome do produto** contra as palavras-chave de borda na função `create_order_items_from_json`. Se o nome do produto contiver alguma palavra-chave de borda, o próprio nome do produto será classificado como `edge_type`.

## Detalhes Técnicos

### Arquivo: Migração SQL (nova)

Atualizar a função `create_order_items_from_json` para, **após processar as options**, verificar se o nome do produto (`v_item->>'name'`) contém alguma palavra-chave de borda. Se sim e se `v_edge_type` ainda estiver vazio (ou seja, nenhuma option já foi classificada como borda), setar o nome do produto como `edge_type` e marcar `v_has_edge := true`.

A lógica será inserida logo após o bloco de processamento de options (depois da linha 153 atual), antes da lógica de splitting por sabores:

```sql
-- Se nenhuma option foi classificada como borda,
-- verificar se o NOME DO PRODUTO contém keyword de borda
IF NOT v_has_edge AND v_edge_arr IS NOT NULL THEN
  FOREACH v_keyword IN ARRAY v_edge_arr
  LOOP
    IF v_keyword = '#' THEN
      IF (v_item->>'name') LIKE '#%' THEN
        v_has_edge := true;
        v_edge_type := COALESCE(v_item->>'name', '');
        EXIT;
      END IF;
    ELSIF (v_item->>'name') ILIKE '%' || v_keyword || '%' THEN
      v_has_edge := true;
      v_edge_type := COALESCE(v_item->>'name', '');
      EXIT;
    END IF;
  END LOOP;
END IF;
```

### Resultado esperado

| Cenário | Antes | Depois |
|---------|-------|--------|
| Produto "Borda de Chocolate" com keyword "Borda" | Aparece como item normal | Aparece com tarja laranja + roteado para setor de bordas |
| Produto "Domzitos" com keyword "Domzitos" | Aparece como item normal | Aparece com tarja laranja + roteado para setor de bordas |
| Produto "Pizza Calabresa" com option "Borda Catupiry" | Já funciona | Continua funcionando igual |

Nenhuma mudança no frontend -- apenas a função SQL de classificação precisa ser atualizada.
