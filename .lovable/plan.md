
# Corrigir desmembramento de pizzas meio a meio

## Problema

O sistema esta separando sabores "1/2" (meio a meio) em itens individuais. Uma pizza com "1/2 Mussarela + 1/2 Bauru" vira 2 registros no KDS, quando deveria ser 1 unico item com os dois sabores listados.

## Causa raiz

Na funcao `create_order_items_from_json`, quando ha mais de 1 sabor (`v_flavor_count > 1`), o sistema cria um registro separado para cada sabor. Essa logica nao diferencia pizzas meio a meio (que sao 1 produto) de situacoes onde realmente seriam itens separados.

## Solucao

Detectar quando TODOS os sabores possuem o prefixo "1/2" (ou variantes como "½", "meia"). Nesse caso, manter todos os sabores juntos em um unico registro, pois representam uma unica pizza meio a meio. O split so deve ocorrer quando os sabores NAO indicam fracionamento.

## Detalhe tecnico

**Arquivo:** Migration SQL (funcao `create_order_items_from_json`)

Antes do bloco de split por sabor (linha 171), adicionar verificacao:

```text
-- Verificar se todos os sabores sao "meio a meio" (1/2, ½, meia)
v_all_half := true;
FOR v_flavor_idx IN 1..v_flavor_count
LOOP
  v_single_flavor := v_flavor_array[v_flavor_idx];
  -- Remove o bullet "• " do inicio
  v_clean_flavor := regexp_replace(v_single_flavor, '^[•*\-]\s*', '');
  IF v_clean_flavor !~* '^\s*(1/2|½|meia)\s' THEN
    v_all_half := false;
    EXIT;
  END IF;
END LOOP;
```

Depois, a condicao de split muda de:

```text
IF v_flavor_count > 1 THEN
  -- split cada sabor em item separado
```

Para:

```text
IF v_flavor_count > 1 AND NOT v_all_half THEN
  -- split cada sabor em item separado (so quando NAO sao metades da mesma pizza)
```

Quando `v_all_half = true`, o fluxo cai no bloco `ELSE` (linhas 263-337) que cria um unico registro com todos os sabores juntos, respeitando o `quantity` para duplicar apenas se houver mais de 1 unidade.

## Resultado esperado

- Pizza meio a meio (1/2 Mussarela + 1/2 Bauru): 1 item no KDS com ambos os sabores
- Pizza sabor unico: 1 item no KDS (sem mudanca)
- 2x Pizza sabor unico: 2 itens no KDS (sem mudanca)
- Combo com sabores sem "1/2": continua separando normalmente

## Variavel adicional

Sera declarada a variavel `v_all_half boolean` e `v_clean_flavor text` no bloco DECLARE da funcao.
