
# Plano: Exibir Botões de Ação Sempre no Dashboard

## Problema Identificado

Os botões "Limpar Pedidos", "Sincronizar Status" e "Buscar novos pedidos" estão **condicionados** ao CardápioWeb estar habilitado. Como essa configuração está desativada, os botões não aparecem.

**Código atual** (`src/components/Dashboard.tsx`, linha 280):
```tsx
{pollingEnabled && (
  <div className="flex items-center justify-between ...">
    // Botões aqui - só aparecem se CardápioWeb estiver habilitado
  </div>
)}
```

---

## Solução

Separar os botões em duas categorias:
1. **Sempre visíveis**: "Limpar Pedidos" - funcionalidade independente do CardápioWeb
2. **Condicionais**: "Sincronizar Status" e "Buscar novos pedidos" - só fazem sentido com CardápioWeb

---

## Mudança Proposta

**Arquivo**: `src/components/Dashboard.tsx`

### Antes (linhas 279-336)
```tsx
{pollingEnabled && (
  <div className="flex items-center justify-between px-4 py-2 bg-muted/50 border-b border-border/50">
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <RefreshCw className={cn("h-4 w-4", isPolling && "animate-spin")} />
      <span>...</span>
    </div>
    <div className="flex items-center gap-2">
      {/* Todos os botões dentro da condição */}
      <Button>Limpar Pedidos</Button>
      <Button>Sincronizar Status</Button>
      <Button>Buscar novos pedidos</Button>
    </div>
  </div>
)}
```

### Depois
```tsx
{/* Barra de Ações - Sempre visível */}
<div className="flex items-center justify-between px-4 py-2 bg-muted/50 border-b border-border/50">
  <div className="flex items-center gap-2 text-sm text-muted-foreground">
    {pollingEnabled && (
      <>
        <RefreshCw className={cn("h-4 w-4", isPolling && "animate-spin")} />
        <span>
          {isPolling ? 'Sincronizando...' : lastSync 
            ? `Última sincronização: ${lastSync.toLocaleTimeString('pt-BR')}`
            : 'Aguardando sincronização...'}
        </span>
      </>
    )}
  </div>
  <div className="flex items-center gap-2">
    {/* Sempre visível */}
    <Button onClick={handleManualCleanup} disabled={manualCleanup.isPending} variant="ghost" size="sm">
      <Trash2 className={cn("h-4 w-4 mr-1", manualCleanup.isPending && "animate-pulse")} />
      {manualCleanup.isPending ? 'Limpando...' : 'Limpar Pedidos'}
    </Button>

    {/* Erros - sempre visível quando houver */}
    {ordersWithErrors.length > 0 && (
      <Button onClick={handleCleanupErrors} ...>
        Limpar {ordersWithErrors.length} com erro
      </Button>
    )}

    {/* Apenas se CardápioWeb estiver habilitado */}
    {pollingEnabled && (
      <>
        <Button onClick={handleSyncStatus} ...>
          Sincronizar Status
        </Button>
        <Button onClick={manualPoll} ...>
          Buscar novos pedidos
        </Button>
      </>
    )}
  </div>
</div>
```

---

## Comportamento Após Mudança

| Botão | CardápioWeb ON | CardápioWeb OFF |
|-------|----------------|-----------------|
| Limpar Pedidos | Visível | Visível |
| Limpar X com erro | Visível (se houver erros) | Visível (se houver erros) |
| Sincronizar Status | Visível | Oculto |
| Buscar novos pedidos | Visível | Oculto |

---

## Arquivo a Modificar

| Arquivo | Mudança |
|---------|---------|
| `src/components/Dashboard.tsx` | Mover barra de ações para fora da condição `pollingEnabled`, mantendo apenas botões específicos condicionais |

---

## Resultado Visual

Com CardápioWeb desativado:
```
┌──────────────────────────────────────────────────┐
│                                    [Limpar Pedidos] │
└──────────────────────────────────────────────────┘
```

Com CardápioWeb ativado:
```
┌──────────────────────────────────────────────────────────────────────────────────┐
│ 🔄 Última sincronização: 10:30:45   [Limpar Pedidos] [Sincronizar] [Buscar novos] │
└──────────────────────────────────────────────────────────────────────────────────┘
```
