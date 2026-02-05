
# Plano: Corrigir Salvamento do Tempo do Forno

## Problema Identificado

O usuário reporta que o **tempo do forno** não está sendo salvo e perde as configurações após um novo deploy.

### Análise do Banco de Dados

```
app_settings:
- id: 'default'
- oven_time_seconds: 120 (valor padrão)
- updated_at: 2026-02-04 19:28:24 (mais de 8 horas atrás)
```

O valor está no padrão (120 segundos), indicando que ou:
1. Nunca foi alterado
2. Foi resetado em algum momento
3. A alteração não está sendo salva

### Análise do Código

O fluxo de salvamento atual é:

```
SettingsDialog.tsx
├── formData (estado local) ← usuário altera campos
├── handleSave() ← chamado ao clicar "Salvar"
│   └── saveSettings.mutateAsync(formData)
│       └── supabase.upsert({ id: 'default', ...formData })
```

**Problema 1**: O usuário precisa clicar em "Salvar" para persistir. Se fechar o dialog sem salvar, perde tudo.

**Problema 2**: A interface `AppSettings` inclui `oven_time_seconds`, mas em alguns lugares usa `(formData as any)` com type casting, podendo haver inconsistências.

---

## Causa Raiz Provável

O salvamento **depende do clique no botão "Salvar"**. Se o usuário:
1. Altera o tempo do forno
2. Fecha o dialog (sem clicar em Salvar)
3. Faz refresh ou deploy

→ As configurações são perdidas.

Isso é diferente de outros campos como o **Buffer Dinâmico** que usa **auto-save com debounce**.

---

## Solução

Implementar **auto-save com debounce** para as configurações do KDS (incluindo tempo do forno), similar ao que já existe para `DynamicBufferSettings`.

### Alterações no SettingsDialog.tsx

1. **Adicionar auto-save debounced para campos da aba KDS**
2. **Feedback visual de salvamento automático**
3. **Manter botão "Salvar" como confirmação geral**

### Código Proposto

```typescript
// Hook de auto-save para configurações críticas
const debouncedSaveSettings = useDebouncedCallback(
  useCallback((updates: Partial<AppSettings>) => {
    saveSettings.mutate(updates, {
      onError: () => toast.error('Erro ao salvar configuração'),
      onSuccess: () => toast.success('Configuração salva automaticamente', { duration: 2000 }),
    });
  }, [saveSettings]),
  800 // 800ms debounce
);

// No onChange do campo oven_time_seconds:
onChange={(e) => {
  const value = parseInt(e.target.value) || 120;
  setFormData({ ...formData, oven_time_seconds: value });
  debouncedSaveSettings({ oven_time_seconds: value }); // Auto-save!
}}
```

---

## Campos que receberão Auto-Save

| Campo | Tab | Comportamento Atual | Novo |
|-------|-----|---------------------|------|
| `oven_time_seconds` | KDS | Requer clique em Salvar | Auto-save |
| `kds_default_mode` | KDS | Requer clique em Salvar | Auto-save |
| `urgent_bypass_enabled` | Buffer | Requer clique em Salvar | Auto-save |
| `urgent_production_timeout_minutes` | Buffer | Requer clique em Salvar | Auto-save |

---

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `src/components/SettingsDialog.tsx` | Adicionar auto-save com debounce para campos críticos |

---

## Resultado Esperado

1. Usuário altera tempo do forno: **salvo automaticamente em 800ms**
2. Toast de confirmação: "Configuração salva automaticamente"
3. Deploy ou refresh: **configurações persistem**
4. Botão "Salvar" continua funcionando para confirmar todas as alterações de uma vez

---

## Nota Importante

As configurações são salvas no banco de dados **Test**. Quando o usuário publica (deploy), apenas o **código** vai para produção - os **dados do banco (incluindo configurações)** permanecem intactos. O problema reportado provavelmente é causado por não clicar em "Salvar" antes de fechar o dialog.
