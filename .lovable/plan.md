

# Plano: Sistema Visual FIFO como Modo Opcional

## Objetivo

Criar o **Modo Visual FIFO** como uma funcionalidade configurável que pode ser ativada/desativada pelo administrador. O comportamento atual (simples) permanece como padrão.

---

## Configuração Principal

Nova coluna na tabela `app_settings`:

| Coluna | Tipo | Default | Descrição |
|--------|------|---------|-----------|
| `kds_fifo_visual_enabled` | `boolean` | `false` | Habilita o sistema visual de priorização FIFO |

---

## Comportamento por Modo

### Modo Atual (Padrão) - `kds_fifo_visual_enabled = false`

- Todos os cards têm aparência uniforme
- Cores de borda baseadas apenas no status (pendente, em preparo)
- Sem badges de sequência (#1, #2)
- Sem barra de progresso
- Qualquer item pode ser iniciado em qualquer ordem

### Modo FIFO Visual - `kds_fifo_visual_enabled = true`

- **Semáforo de urgência**: Bordas verde/amarela/vermelha baseadas no tempo
- **Badge de sequência**: #1, #2, #3 no canto do card
- **Barra de progresso**: Indica visualmente tempo decorrido
- **Destaque no primeiro item**: Card maior com botão em destaque
- Qualquer item ainda pode ser iniciado (sem bloqueio forçado)

---

## Configurações Adicionais (apenas quando FIFO está ativo)

| Coluna | Tipo | Default | Descrição |
|--------|------|---------|-----------|
| `fifo_warning_minutes` | `integer` | `3` | Tempo (min) para mudar de verde → amarelo |
| `fifo_critical_minutes` | `integer` | `5` | Tempo (min) para mudar de amarelo → vermelho |
| `fifo_lock_enabled` | `boolean` | `false` | Bloqueia início de itens fora da ordem |

---

## Interface nas Configurações (aba KDS)

```
┌─────────────────────────────────────────────────────────────┐
│ [Modo de Visualização KDS - seção existente...]            │
├─────────────────────────────────────────────────────────────┤
│ ──────────────────────────────────────────────────────────  │
│                                                             │
│ 🎯 Sistema Visual FIFO                                      │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Habilitar Priorização Visual FIFO               [OFF]  │ │
│ │ Destaca visualmente os itens por ordem de entrada,     │ │
│ │ com cores de urgência e badges de sequência.           │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ [Quando ativo, exibe configurações adicionais:]            │
│                                                             │
│   Tempo para alerta amarelo: [3] minutos                   │
│   Tempo para alerta vermelho: [5] minutos                  │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Bloquear seleção fora de ordem               [OFF]     │ │
│ │ Quando ativo, só permite iniciar o próximo item        │ │
│ │ após o anterior estar em preparo.                      │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Arquivos a Modificar

| Arquivo | Mudanças |
|---------|----------|
| **Migração SQL** | Adicionar colunas `kds_fifo_visual_enabled`, `fifo_warning_minutes`, `fifo_critical_minutes`, `fifo_lock_enabled` |
| `src/hooks/useSettings.ts` | Adicionar novos campos ao tipo `AppSettings` |
| `src/components/SettingsDialog.tsx` | Adicionar toggle FIFO na aba KDS com configurações condicionais |
| `src/components/kds/KDSItemCard.tsx` | Receber props de FIFO e aplicar estilos condicionalmente |
| `src/components/kds/SectorQueuePanel.tsx` | Passar configurações FIFO e posição para cada card |

---

## Migração do Banco de Dados

```sql
ALTER TABLE app_settings 
ADD COLUMN IF NOT EXISTS kds_fifo_visual_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS fifo_warning_minutes INTEGER DEFAULT 3,
ADD COLUMN IF NOT EXISTS fifo_critical_minutes INTEGER DEFAULT 5,
ADD COLUMN IF NOT EXISTS fifo_lock_enabled BOOLEAN DEFAULT false;
```

---

## Lógica no KDSItemCard

```tsx
interface KDSItemCardProps {
  // ... props existentes
  fifoSettings?: {
    enabled: boolean;
    warningMinutes: number;
    criticalMinutes: number;
    lockEnabled: boolean;
  };
  queuePosition?: number;
  canStartItem?: boolean;
}

// Dentro do componente:
const getCardStyles = () => {
  // Se FIFO desabilitado, usar estilos atuais
  if (!fifoSettings?.enabled) {
    return getStatusColor(); // lógica atual
  }
  
  // Se FIFO habilitado, usar semáforo de tempo
  return getUrgencyColor(elapsedTime, fifoSettings);
};
```

---

## Ordem de Implementação

1. **Migração SQL**: Adicionar colunas de configuração
2. **useSettings.ts**: Atualizar tipo TypeScript
3. **SettingsDialog.tsx**: Adicionar seção FIFO na aba KDS
4. **SectorQueuePanel.tsx**: Ler configurações e calcular posição na fila
5. **KDSItemCard.tsx**: Implementar renderização condicional

---

## Resultado

| Configuração | Comportamento |
|--------------|---------------|
| FIFO OFF (padrão) | Cards uniformes, como está hoje |
| FIFO ON | Semáforo, badges, destaque, barra de progresso |
| FIFO ON + Lock ON | Além do visual, só permite iniciar em ordem FIFO |

