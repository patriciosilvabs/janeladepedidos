
# Plano: Roteamento Inteligente para Bordas Recheadas

## Problema
Pizzas com borda recheada vão diretamente para BANCADA A/B, mas o funcionário que recheia a borda fica distante. O item precisa passar primeiro pela **BANCADA - BORDAS** para recheio, e só depois ir para montagem.

## Fluxo Proposto

```text
                    ┌─────────────────┐
                    │  Novo Pedido    │
                    │  (com borda)    │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │ BANCADA BORDAS  │◄── Operador recheia a borda
                    │ (setor inicial) │
                    └────────┬────────┘
                             │ Marca "Pronto"
                             ▼
                    ┌─────────────────┐
                    │  BANCADA A/B    │◄── Operador monta a pizza
                    │ (setor destino) │
                    └────────┬────────┘
                             │ Envia ao Forno
                             ▼
                    ┌─────────────────┐
                    │    DESPACHO     │
                    └─────────────────┘
```

## Detalhes Técnicos

### 1. Nova Coluna na Tabela order_items

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `next_sector_id` | uuid (nullable) | Setor para onde o item vai após ficar pronto no setor atual |

### 2. Nova Configuracao em app_settings

| Coluna | Tipo | Default | Descrição |
|--------|------|---------|-----------|
| `kds_edge_sector_id` | uuid (nullable) | null | Setor que processa bordas recheadas primeiro |

### 3. Logica de Roteamento (funcao SQL)

A funcao `create_order_items_from_json` sera atualizada:

```text
Para cada item:
  SE tem edge_type (borda recheada):
    SE kds_edge_sector_id configurado:
      assigned_sector_id = kds_edge_sector_id (BANCADA BORDAS)
      next_sector_id = setor com menor carga (BANCADA A ou B)
    SENAO:
      Comportamento atual (vai direto para bancada)
  SENAO:
    Vai para bancada normal (sem next_sector_id)
```

### 4. Novo Comportamento ao Marcar "Pronto" na Bancada Bordas

Quando operador marca item como pronto na BANCADA BORDAS:

```text
SE item.next_sector_id existe:
  - Move item para next_sector_id
  - Reseta status para 'pending' (reaparece na nova bancada)
  - Limpa next_sector_id (para nao criar loop)
SENAO:
  - Comportamento atual (envia ao forno)
```

### 5. Interface nas Configuracoes

Nova opcao na aba KDS:

```text
┌─────────────────────────────────────────────────────────────┐
│  🎯 Roteamento de Bordas Recheadas                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ⚠️ Quando ativo, pizzas com borda recheada vao primeiro   │
│     para o setor selecionado antes de ir para producao.    │
│                                                             │
│  Setor de Bordas:                                           │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ [Dropdown] BANCADA - BORDAS                       ▼   │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  Desabilitar roteamento: Selecione "(Nenhum)"               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Mudancas por Arquivo

| Arquivo | Mudanca |
|---------|---------|
| Migracao SQL | Adicionar coluna `next_sector_id` em `order_items` |
| Migracao SQL | Adicionar coluna `kds_edge_sector_id` em `app_settings` |
| Migracao SQL | Atualizar `create_order_items_from_json` para roteamento |
| Migracao SQL | Criar funcao `complete_edge_preparation` para mover item |
| `src/hooks/useSettings.ts` | Adicionar `kds_edge_sector_id` na interface |
| `src/types/orderItems.ts` | Adicionar `next_sector_id` no tipo |
| `src/hooks/useOrderItems.ts` | Atualizar mutacao de "marcar pronto" |
| `src/components/SettingsDialog.tsx` | Adicionar dropdown de setor de bordas |
| `src/components/kds/KDSItemCard.tsx` | Mostrar botao "Enviar para Montagem" ao inves de "Forno" |

## Experiencia do Usuario

1. **Admin** configura o setor de bordas nas Configuracoes KDS
2. **Novo pedido** com borda recheada aparece na BANCADA BORDAS
3. **Operador bordas** prepara o recheio e clica "Enviar para Montagem"
4. **Item** reaparece automaticamente na BANCADA A ou B
5. **Operador bancada** monta a pizza e envia ao forno
6. **Fluxo normal** continua (forno, despacho)

## Diferenciacao Visual na Bancada Bordas

O card do item mostrara:

```text
┌─────────────────────────────────┐
│ #123 - Pizza Grande (G)         │
│                                 │
│ ┌─────────────────────────────┐ │
│ │ 🟠 # Borda de Cheddar       │ │◄── Tarja laranja (ja existe)
│ └─────────────────────────────┘ │
│                                 │
│ 🍕 Calabresa (G)               │
│                                 │
│ [▶ Iniciar]                    │◄── Inicia preparo da borda
└─────────────────────────────────┘

Apos iniciar:

┌─────────────────────────────────┐
│ #123 - Pizza Grande (G)         │
│                                 │
│ ┌─────────────────────────────┐ │
│ │ 🟠 # Borda de Cheddar       │ │
│ └─────────────────────────────┘ │
│                                 │
│ ┌─────────────────────────────┐ │
│ │  📦 Enviar para BANCADA A  │ │◄── Botao diferenciado
│ └─────────────────────────────┘ │
└─────────────────────────────────┘
```
