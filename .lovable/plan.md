
# Plano: Melhorar Cadastro de Lojas com Código e URL do Webhook

## Problema Identificado

1. **Falta o campo "Código da Loja"** (ex: 8268) na tabela e no formulário
2. **Usuário não sabe qual URL configurar no CardápioWeb** para receber webhooks

## Arquitetura Atual vs Necessária

A boa notícia: o sistema já suporta múltiplas lojas com tokens individuais. Cada loja cadastrada pode usar o mesmo URL de webhook porque a identificação é feita pelo token no header.

```text
┌─────────────────────────────────────────────────────────────────────┐
│                    FLUXO DE WEBHOOK POR LOJA                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  CardápioWeb (Loja A)                 CardápioWeb (Loja B)          │
│  Token: abc123...                     Token: xyz789...              │
│         │                                    │                      │
│         ▼                                    ▼                      │
│  ┌──────────────────────────────────────────────────────────┐      │
│  │          /functions/v1/webhook-orders                     │      │
│  │                                                           │      │
│  │  1. Lê header X-API-KEY                                   │      │
│  │  2. Busca loja pelo token na tabela stores                │      │
│  │  3. Processa pedido vinculado à loja correta              │      │
│  └──────────────────────────────────────────────────────────┘      │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## Alterações Necessárias

| Local | Alteração | Descrição |
|-------|-----------|-----------|
| Banco de dados | Adicionar coluna | `cardapioweb_store_code` (texto, para armazenar "8268") |
| `StoresManager.tsx` | Adicionar campo | Input para "Código da Loja" |
| `StoresManager.tsx` | Mostrar URL webhook | Exibir a URL que o usuário deve configurar no CardápioWeb |
| `useStores.ts` | Atualizar tipagem | Incluir novo campo no tipo Store |

## Implementação

### 1. Migração do Banco

```sql
ALTER TABLE stores 
ADD COLUMN cardapioweb_store_code text;

COMMENT ON COLUMN stores.cardapioweb_store_code IS 
  'Código da loja no CardápioWeb (ex: 8268)';
```

### 2. Atualizar Formulário

Adicionar novo campo "Código da Loja" e exibir a URL do webhook:

```text
┌─────────────────────────────────────────────────────────────────┐
│  Editar Loja                                                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Nome da Loja *                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ Loja Centro                                                │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  Código da Loja           Token API (X-API-KEY)                │
│  ┌─────────────┐          ┌───────────────────────────────────┐│
│  │ 8268        │          │ ••••••••••••••••••••••           ││
│  └─────────────┘          └───────────────────────────────────┘│
│                                                                 │
│  URL da API                                                     │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ https://integracao.cardapioweb.com                        │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ URL do Webhook (configure no CardápioWeb):                │ │
│  │ https://cpxuluerkzpynlcdnxcq.supabase.co/functions/v1/   │ │
│  │ webhook-orders                                            │ │
│  │                                              [📋 Copiar]  │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 3. Instruções para o Usuário

Ao cadastrar cada loja, o sistema mostrará:

**Passos para configurar no CardápioWeb:**
1. Acesse o painel do CardápioWeb da loja
2. Vá em Configurações de Integração
3. No campo "URL do Webhook", cole a URL exibida
4. Configure o header `X-API-KEY` com o mesmo token cadastrado aqui
5. Salve as configurações

## Resultado Esperado

- Cada loja terá seu código identificador armazenado
- O usuário saberá exatamente qual URL configurar no CardápioWeb
- O botão "Copiar" facilitará a configuração
- Instruções claras sobre como vincular o webhook
