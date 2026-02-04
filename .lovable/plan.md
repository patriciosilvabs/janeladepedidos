

# Corrigir Pedidos Existentes Sem Setor Atribuído

## Diagnóstico

Os pedidos em produção existem no banco de dados, mas todos os itens estão com `assigned_sector_id = NULL`:

| Produto | Setor Atribuído |
|---------|-----------------|
| Pizza Margherita | NULL |
| Pizza Quatro Queijos | NULL |
| Pizza Portuguesa | NULL |

Quando o operador da Bancada B faz login, o sistema filtra:
```
WHERE assigned_sector_id = 'uuid-bancada-b'
```

Como todos os itens têm NULL, **nenhum aparece**.

---

## Solução em Duas Partes

### Parte 1: Corrigir Itens Existentes (Migration SQL)

Atualizar os itens que estão com setor NULL para distribuí-los entre os setores existentes. Podemos atribuir todos à Bancada A ou distribuir proporcionalmente:

```sql
-- Opção 1: Atribuir todos os itens sem setor à BANCADA A
UPDATE order_items 
SET assigned_sector_id = '92e3f369-a599-4c7e-a0a0-29d8719c2161'
WHERE assigned_sector_id IS NULL;

-- OU Opção 2: Atribuir à BANCADA B
UPDATE order_items 
SET assigned_sector_id = 'bfbd6e97-509a-4597-94b8-84d907332472'
WHERE assigned_sector_id IS NULL;
```

### Parte 2: Testar com Novos Pedidos

Após a correção, o administrador pode usar o **Simulador de Pedidos** que agora tem o campo "Setor de Produção" para criar novos pedidos atribuídos ao setor correto.

---

## Setores Disponíveis

| Setor | ID |
|-------|-----|
| BANCADA A | 92e3f369-a599-4c7e-a0a0-29d8719c2161 |
| BANCADA B | bfbd6e97-509a-4597-94b8-84d907332472 |
| DESPACHO | d440ed0f-86b0-45cb-9c9a-f89d8141c23a |

---

## Próximos Passos

1. **Executar migration** para atribuir os itens existentes a um setor (escolha entre BANCADA A ou BANCADA B)
2. **Validar** que os operadores das bancadas agora veem os pedidos
3. **Testar** criando novos pedidos simulados com o seletor de setor

---

## Comportamento Final

| Antes | Depois |
|-------|--------|
| Operador Bancada A: 0 itens | Operador Bancada A: X itens |
| Operador Bancada B: 0 itens | Operador Bancada B: Y itens |
| Admin: Vê todos os itens | Admin: Vê todos os itens |

