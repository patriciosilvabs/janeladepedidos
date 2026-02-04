
# Plano: Remover Seletor de Setor do Simulador

## Problema

O simulador de pedidos atualmente mostra um dropdown "Setor de Produção" que permite escolher manualmente onde o pedido vai. Na vida real, o pedido chega e o sistema distribui automaticamente para o setor com menos demanda usando o algoritmo round-robin.

## Solução

Remover completamente o seletor de setor do simulador, deixando que a distribuição seja feita automaticamente pelo sistema (igual à integração real).

## Alterações

**Arquivo: `src/components/OrderSimulator.tsx`**

### 1. Remover Estado do Setor (linha 60)
Remover a variável de estado `sectorId` que não será mais necessária.

### 2. Remover Seção do Dropdown (linhas 289-305)
Remover todo o bloco de código que exibe o seletor "Setor de Produção".

### 3. Passar `null` para Distribuição Automática (linha 161)
Alterar o parâmetro `p_default_sector_id` de `sectorId` para `null`, ativando o balanceador de carga automático.

## Código Antes x Depois

```text
ANTES (linha 161):
  p_default_sector_id: sectorId,  // Manual

DEPOIS:
  p_default_sector_id: null,      // Automático (round-robin)
```

## Comportamento Final

1. Usuário cria pedido no simulador
2. Sistema chama `create_order_items_from_json` com `sector_id = null`
3. Função do banco distribui automaticamente entre bancadas:
   - Item 1 vai para Bancada A
   - Item 2 vai para Bancada B
   - Item 3 vai para Bancada A (round-robin)
4. Itens aparecem nas filas corretas de cada operador

## Benefícios

- Simulação reflete exatamente o comportamento real
- Interface mais simples sem opção desnecessária
- Testa o balanceador de carga automaticamente
