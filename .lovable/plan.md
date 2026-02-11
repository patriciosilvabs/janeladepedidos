

# Colar Mapeamentos em Lote (Bulk Paste)

## O que sera feito

Adicionar um botao "Colar em Lote" que abre um dialog onde voce pode colar texto com codigos e nomes, escolher o tipo (Borda/Sabor/Complemento) e salvar tudo de uma vez.

## Como funciona

1. Voce cola o texto no formato livre, uma linha por grupo. Cada linha deve ter o **codigo numerico** e o **nome**, separados por espaco, tab, ou ponto-e-virgula. Exemplos aceitos:

```text
944280 Massas & Bordas
944281;Sabores Pizza Grande
944282  Complementos
```

2. O sistema faz o parse automatico, identifica o numero (codigo) e o restante como nome
3. Voce escolhe o tipo padrao (Sabor/Borda/Complemento) que sera aplicado a todos — ou pode ajustar individualmente antes de salvar
4. Grupos ja mapeados sao ignorados automaticamente

## Detalhes Tecnicos

**Arquivo a modificar:** `src/components/StoreGroupMappings.tsx`

### Mudancas:
1. Adicionar botao "Colar em Lote" (icone ClipboardPaste) ao lado do botao "Importar da API"
2. Novo dialog com:
   - Um `Textarea` para colar o texto
   - Um `Select` para escolher o tipo padrao
   - Botao "Processar" que faz o parse das linhas
   - Preview das linhas parseadas (igual ao dialog de importacao da API) com opcao de ajustar tipo individual
   - Botao "Salvar" que usa o `bulkAddMappings` ja existente
3. Logica de parse: para cada linha nao vazia, extrair o primeiro numero como `option_group_id` e o restante como `group_name`
4. Reutilizar o hook `useStoreGroupMappings` (ja tem `bulkAddMappings`)

### Fluxo do usuario:
```text
Colar em Lote → Cola texto → Escolhe tipo → Processar → Revisa → Salvar
```

Nenhuma mudanca no banco de dados ou edge function — tudo reutiliza a infraestrutura existente.
