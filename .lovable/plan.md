
# Plano: Configuracao do Tempo de Forno + Mover Timer para Despacho

## Resumo

Adicionar uma configuracao global para o tempo do forno (atualmente fixo em 120 segundos) e mover o painel de timer do forno das bancadas de producao (KDS) para o painel de despacho.

---

## Mudancas Necessarias

### 1. Banco de Dados

Adicionar nova coluna na tabela `app_settings`:

```sql
ALTER TABLE app_settings 
ADD COLUMN oven_time_seconds integer DEFAULT 120;
```

### 2. Interface de Configuracao

Adicionar campo de configuracao na aba "KDS" do SettingsDialog:

| Campo | Descricao |
|-------|-----------|
| Tempo do Forno (segundos) | Duracao da esteira do forno (padrao: 120s = 2 minutos) |

```text
┌─────────────────────────────────────────┐
│ Tempo do Forno                          │
├─────────────────────────────────────────┤
│ Label: "Tempo do forno (segundos)"      │
│ Input: [120]                            │
│ Desc: "Tempo da esteira ate saida"      │
└─────────────────────────────────────────┘
```

### 3. Mover OvenTimerPanel

**Remover de:** `KDSItemsDashboard.tsx` (bancadas de producao)

**Adicionar em:** `Dashboard.tsx` (painel de despacho)

Logica de exibicao:
- Aparece quando houver itens com status `in_oven`
- Posicionado acima das colunas de pedidos
- Busca TODOS os itens no forno (sem filtro de setor)

### 4. Usar Configuracao no Codigo

**Arquivos a modificar:**

| Arquivo | Mudanca |
|---------|---------|
| `useOrderItems.ts` | Receber `ovenTimeSeconds` como parametro |
| `SectorQueuePanel.tsx` | Passar tempo configurado ao enviar para forno |
| `OvenTimerPanel.tsx` | Usar tempo configurado para calculo de progresso |
| `useSettings.ts` | Adicionar tipo `oven_time_seconds` |

---

## Arquitetura Final

```text
┌─────────────────────────────────────────────────────────────────┐
│                     PAINEL DE DESPACHO                          │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │              🔥 FORNO (Timer Global)                      │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │ [1:45] #1234 Pizza Calabresa      [PRONTO]         │  │  │
│  │  │ [0:32] #1235 Pizza Frango         [PRONTO]         │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│  │Em Prod   │ │Buffer    │ │Pronto    │ │Despachado│           │
│  │          │ │          │ │          │ │          │           │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘           │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    BANCADA A / BANCADA B                        │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │              Fila de Producao (sem timer forno)           │  │
│  │  • Itens pendentes                                        │  │
│  │  • Itens em preparo                                       │  │
│  │  • Botao "Enviar ao Forno"                                │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Detalhes Tecnicos

### Tipo AppSettings Atualizado

```typescript
export interface AppSettings {
  // ... campos existentes ...
  oven_time_seconds: number; // NOVO - padrao 120
}
```

### Uso do Tempo Configurado

```typescript
// SectorQueuePanel.tsx - ao enviar para forno
const { settings } = useSettings();
const ovenTimeSeconds = settings?.oven_time_seconds ?? 120;

sendToOven.mutateAsync({ 
  itemId, 
  ovenTimeSeconds  // Usa valor das configuracoes
});
```

```typescript
// OvenTimerPanel.tsx - calculo de progresso
const { settings } = useSettings();
const ovenTimeSeconds = settings?.oven_time_seconds ?? 120;

// Calcula porcentagem baseado no tempo configurado
const progressPercent = Math.max(0, Math.min(100, (countdown / ovenTimeSeconds) * 100));
```

---

## Arquivos a Modificar

| Tipo | Arquivo | Alteracao |
|------|---------|-----------|
| SQL | Migration | Adicionar coluna `oven_time_seconds` |
| Hook | `src/hooks/useSettings.ts` | Adicionar tipo da nova coluna |
| UI | `src/components/SettingsDialog.tsx` | Campo de input na aba KDS |
| Componente | `src/components/Dashboard.tsx` | Importar e exibir OvenTimerPanel |
| Componente | `src/components/kds/KDSItemsDashboard.tsx` | Remover OvenTimerPanel |
| Componente | `src/components/kds/OvenTimerPanel.tsx` | Usar tempo configurado |
| Componente | `src/components/kds/SectorQueuePanel.tsx` | Passar tempo ao enviar forno |

---

## Beneficios

- Tempo de forno configuravel (nao mais fixo em 120s)
- Timer visivel apenas para quem precisa (despacho)
- Bancadas focam apenas em producao
- Sincronizado em tempo real entre todos os dispositivos
