
# Plano: Garantir que Item Some da Bancada ao Ir para o Forno

## Situacao Atual

A implementacao ja esta quase correta:

| Componente | Status Filter | Itens Visiveis |
|------------|---------------|----------------|
| SectorQueuePanel (Bancada) | `['pending', 'in_prep']` | Pendentes e em preparo |
| OvenTimerPanel (Despacho) | `['in_oven']` | Apenas itens no forno |

O item JA some da bancada quando vai pro forno porque o filtro exclui `in_oven`.

## Problema Identificado

O `KDSItemCard` ainda contem logica desnecessaria para renderizar itens `in_oven`:
- Countdown do forno (linhas 62-84)
- Botao "PRONTO" para status in_oven (linhas 159-175)
- Estilos visuais para in_oven (linhas 98-101)

Isso cria codigo morto e pode causar bugs se alguem usar `showAllStatuses=true`.

---

## Mudancas Necessarias

### 1. Simplificar KDSItemCard

Remover toda logica relacionada a `in_oven` e `ready` do card das bancadas:

```text
ANTES (KDSItemCard):
- Countdown de forno
- Estilos para in_oven/ready
- Botoes PRONTO para forno
- Auto-complete quando timer = 0

DEPOIS (KDSItemCard):
- Apenas pending e in_prep
- Botao INICIAR (pending)
- Botao FORNO + LIBERAR (in_prep)
- Sem logica de countdown
```

### 2. Garantir Update em Tempo Real

O realtime ja esta configurado com debounce de 50ms:

```text
┌─────────────────┐     WebSocket      ┌─────────────────┐
│   BANCADA A     │◄──────────────────►│    DESPACHO     │
│                 │                    │                 │
│  [Click FORNO]  │                    │                 │
│       │         │                    │                 │
│       ▼         │                    │                 │
│  Item muda para │───► Broadcast ────►│  OvenTimerPanel │
│  status=in_oven │      (50ms)        │  recebe item    │
│       │         │                    │       │         │
│       ▼         │                    │       ▼         │
│  Item SOME da   │                    │  Timer inicia   │
│  lista (filtro) │                    │  contagem       │
└─────────────────┘                    └─────────────────┘
```

---

## Arquivos a Modificar

| Arquivo | Alteracao |
|---------|-----------|
| `src/components/kds/KDSItemCard.tsx` | Remover logica de in_oven/ready, simplificar para apenas pending/in_prep |

---

## Fluxo Esperado

1. Funcionario na Bancada A ve item com status `in_prep`
2. Clica no botao "FORNO"
3. Item atualiza para `status = 'in_oven'` no banco
4. Realtime dispara broadcast
5. Bancada: item SAI da lista (filtro nao inclui in_oven)
6. Despacho: OvenTimerPanel RECEBE o item e inicia timer
7. Tudo acontece em ~100ms

---

## Codigo Simplificado do KDSItemCard

O card ficara focado apenas em:

```typescript
// Apenas estes status sao tratados
switch (item.status) {
  case 'pending':
    // Botao INICIAR
    break;
  case 'in_prep':
    // Botao FORNO + LIBERAR
    break;
  default:
    // Nao renderiza nada (item nao deveria estar aqui)
    return null;
}
```

---

## Beneficios

- Codigo mais limpo e focado
- Sem logica duplicada entre bancada e despacho
- Comportamento claro: bancada = producao, despacho = forno + entrega
- Update em tempo real ja funciona (50ms debounce)
