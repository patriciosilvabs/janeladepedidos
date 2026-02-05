

# Plano: Resolver Duplicação de Itens nas Bancadas e Remover Pop-ups

## Diagnóstico

### Verificação do Banco de Dados

Os dados estão **corretos**:
```
order_items:
├── Pizza Calabresa → BANCADA B (bfbd6e97...)
├── Pizza Bacon → BANCADA A (92e3f369...)
├── Pizza Quatro Queijos → BANCADA B
├── Pizza Calabresa → BANCADA A
├── Pizza Bacon → BANCADA A
└── Pizza Bacon → BANCADA B
```

### Configuração de Usuários

```
user_roles:
├── f860dd9a... → BANCADA A (user)
├── 53dd952f... → BANCADA B (user)
├── 3d436c54... → DESPACHO (user)
└── 4a5ee05a... → SEM SETOR (owner) ← PROBLEMA!
```

### Causa Raiz

**Cenário 1**: Os tablets estão logados com a conta do **owner** (que não tem setor vinculado). Quando um owner acessa o KDS, ele vê abas para todos os setores. Se ambos os tablets estiverem na mesma aba, verão os mesmos itens.

**Cenário 2**: Os operadores estão logados corretamente, mas o sistema não está bloqueando a visualização de itens que já foram capturados por outro operador.

---

## Solução Completa

### 1. Remover Pop-ups (Toasts) do KDS

O usuário solicitou que não haja pop-ups nos tablets, pois distraem os funcionários.

**Arquivo**: `src/components/kds/SectorQueuePanel.tsx`

Remover todos os `toast()` calls nas funções:
- `handleClaim` (linha 53-57)
- `handleRelease` (linha 72-76)
- `handleSendToOven` (linha 95-99)
- `handleMarkReady` (linha 114-117)

### 2. Adicionar Indicador Visual Silencioso

Em vez de toasts, usar cores e animações sutis para feedback:
- Item capturado: borda verde pulsando brevemente
- Enviado ao forno: borda laranja
- Erro: borda vermelha sem interrupção

### 3. Garantir Filtragem Estrita por Setor

O código atual já filtra por setor quando o `sectorId` é fornecido. O problema está no **login incorreto**.

**Recomendação**: Adicionar um aviso visual quando o usuário não tem setor vinculado e acessa o KDS.

---

## Alterações de Código

### Arquivo 1: `src/components/kds/SectorQueuePanel.tsx`

```tsx
// ANTES (com toasts):
const handleClaim = async (itemId: string) => {
  setProcessingId(itemId);
  try {
    await claimItem.mutateAsync(itemId);
    toast({
      title: 'Item capturado!',
      description: 'Você pode iniciar o preparo.',
    });
  } catch (error: any) {
    toast({
      title: 'Não foi possível capturar',
      description: error.message,
      variant: 'destructive',
    });
  } finally {
    setProcessingId(null);
  }
};

// DEPOIS (sem toasts):
const handleClaim = async (itemId: string) => {
  setProcessingId(itemId);
  try {
    await claimItem.mutateAsync(itemId);
    // Feedback visual via estado do card (sem popup)
  } catch (error: any) {
    console.error('Erro ao capturar item:', error.message);
    // Item permanece na lista, operador tenta novamente
  } finally {
    setProcessingId(null);
  }
};
```

Aplicar o mesmo padrão para: `handleRelease`, `handleSendToOven`, `handleMarkReady`

---

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `src/components/kds/SectorQueuePanel.tsx` | Remover todos os toasts, manter apenas console.error para erros |

---

## Verificação de Login

Para que o sistema funcione corretamente, cada tablet **DEVE** estar logado com o operador correto:

| Tablet | Email | Setor |
|--------|-------|-------|
| Tablet 1 | (email do usuário f860dd9a...) | BANCADA A |
| Tablet 2 | (email do usuário 53dd952f...) | BANCADA B |

Se ambos tablets estiverem logados com a conta do owner, verão abas com todos os setores - e se estiverem na mesma aba, verão os mesmos itens.

---

## Resultado Esperado

1. **Sem pop-ups**: Nenhum toast aparecerá nos tablets
2. **Feedback visual**: Cards mudam de cor/estado para indicar ações
3. **Exclusividade**: Cada tablet vê apenas os itens do seu setor (quando logado corretamente)

