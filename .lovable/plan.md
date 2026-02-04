

# Correção: Erro 406 ao Salvar Configurações

## Problema Identificado

O erro ocorre porque as tabelas `app_settings` e `dynamic_buffer_settings` estão **vazias**. O código tenta fazer `UPDATE` em uma linha com `id='default'` que não existe.

**Erro**: `PGRST116 - The result contains 0 rows`

## Causa Raiz

Ambos os hooks usam `.update()` para salvar:
- `useSettings.ts` → linha 50: `.update(newSettings).eq('id', 'default')`  
- `useDynamicBufferSettings.ts` → linha 50: `.update({ ...updates }).eq('id', 'default')`

Como não existe linha com `id='default'`, o UPDATE não afeta nenhum registro e o `.single()` falha.

## Solução

**Duas partes:**

### Parte 1: Inserir Dados Iniciais no Banco

Executar SQL migration para criar as linhas padrão:

```sql
-- Inserir configurações padrão se não existirem
INSERT INTO app_settings (id)
VALUES ('default')
ON CONFLICT (id) DO NOTHING;

INSERT INTO dynamic_buffer_settings (id)
VALUES ('default')
ON CONFLICT (id) DO NOTHING;
```

### Parte 2: Modificar Hooks para Usar Upsert

Para evitar o problema no futuro, alterar os hooks para usar **upsert** (insert ou update):

**Arquivo: `src/hooks/useSettings.ts`**

```typescript
// ANTES (linha 46-57):
const saveSettings = useMutation({
  mutationFn: async (newSettings: Partial<AppSettings>) => {
    const { data, error } = await supabase
      .from('app_settings')
      .update(newSettings)
      .eq('id', 'default')
      .select()
      .single();
    if (error) throw error;
    return data;
  },
  // ...
});

// DEPOIS:
const saveSettings = useMutation({
  mutationFn: async (newSettings: Partial<AppSettings>) => {
    const { data, error } = await supabase
      .from('app_settings')
      .upsert({ id: 'default', ...newSettings })
      .select()
      .single();
    if (error) throw error;
    return data;
  },
  // ...
});
```

**Arquivo: `src/hooks/useDynamicBufferSettings.ts`**

```typescript
// ANTES (linha 46-57):
const updateSettings = useMutation({
  mutationFn: async (updates: Partial<DynamicBufferSettings>) => {
    const { data, error } = await supabase
      .from('dynamic_buffer_settings')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', 'default')
      .select()
      .single();
    if (error) throw error;
    return data;
  },
  // ...
});

// DEPOIS:
const updateSettings = useMutation({
  mutationFn: async (updates: Partial<DynamicBufferSettings>) => {
    const { data, error } = await supabase
      .from('dynamic_buffer_settings')
      .upsert({ 
        id: 'default', 
        ...updates, 
        updated_at: new Date().toISOString() 
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  },
  // ...
});
```

## Resumo das Mudanças

| Componente | Ação |
|------------|------|
| Database Migration | Inserir linhas `id='default'` nas tabelas |
| `useSettings.ts` | Trocar `.update()` por `.upsert()` |
| `useDynamicBufferSettings.ts` | Trocar `.update()` por `.upsert()` |

## Benefícios

- Erro 406 corrigido imediatamente após migration
- Sistema resiliente: upsert cria o registro automaticamente se não existir
- Configurações funcionam corretamente para novos deployments

