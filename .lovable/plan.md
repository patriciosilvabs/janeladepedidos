

# Distribuicao Automatica de Itens Entre Bancadas

## ✅ IMPLEMENTADO

### Funções SQL Criadas

1. **`distribute_unassigned_items()`** - Redistribui itens existentes sem setor entre bancadas KDS usando round-robin
2. **`create_order_items_from_json()`** - Atualizada para distribuir automaticamente novos itens quando nenhum setor é especificado

### Dados Corrigidos

- Itens existentes redistribuídos: metade na Bancada A, metade na Bancada B

### Fluxo Implementado

```
Novo pedido chega (webhook ou simulador)
        |
        v
Setor especificado? ----SIM----> Atribuir ao setor escolhido
        |
       NAO
        |
        v
Distribuir itens em round-robin:
  Item 1 -> BANCADA A
  Item 2 -> BANCADA B
  Item 3 -> BANCADA A
  ...
```

### Próximos Passos

- [x] Criar função SQL para distribuição
- [x] Atualizar função de criação de itens
- [x] Redistribuir itens existentes
- [ ] Testar com novos pedidos simulados
