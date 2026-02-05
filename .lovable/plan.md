
# Plano: Palavras-chave Configuraveis para Classificacao KDS

## Problema Atual

As palavras-chave para identificar bordas e sabores estao fixas no codigo SQL:

| Categoria | Regra Fixa (SQL) |
|-----------|------------------|
| Bordas | Comeca com `#` OU contem "Borda" |
| Sabores | Contem `(G)`, `(M)`, `(P)` OU grupo contem "Sabor" |

Se a pizzaria usar outros termos (ex: "Recheio" ao inves de "Borda", ou "(GR)" ao inves de "(G)"), o sistema classifica errado.

---

## Solucao

Criar uma secao nas **Configuracoes KDS** para que o usuario defina suas proprias palavras-chave:

```text
┌─────────────────────────────────────────────────────────┐
│  🔤 Classificacao de Itens                              │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Palavras-chave para BORDAS (tarja laranja):           │
│  ┌─────────────────────────────────────────────────┐   │
│  │ #, Borda, Recheio                               │   │
│  └─────────────────────────────────────────────────┘   │
│  Separar por virgula. Ex: #, Borda, Recheio            │
│                                                         │
│  Palavras-chave para SABORES (fonte grande):            │
│  ┌─────────────────────────────────────────────────┐   │
│  │ (G), (M), (P), Sabor                            │   │
│  └─────────────────────────────────────────────────┘   │
│  Separar por virgula. Ex: (G), (M), (P), Sabor         │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## Mudancas Detalhadas

### 1. Migracao SQL - Novas Colunas

```sql
-- Adicionar colunas para palavras-chave configuraveis
ALTER TABLE app_settings 
ADD COLUMN IF NOT EXISTS kds_edge_keywords text DEFAULT '#, Borda',
ADD COLUMN IF NOT EXISTS kds_flavor_keywords text DEFAULT '(G), (M), (P), Sabor';
```

### 2. Atualizar Funcao SQL

A funcao `create_order_items_from_json` sera atualizada para:
- Buscar as palavras-chave da tabela `app_settings`
- Usar essas palavras para classificar cada option

```sql
-- Buscar keywords configuradas
SELECT kds_edge_keywords, kds_flavor_keywords 
INTO v_edge_keywords, v_flavor_keywords
FROM app_settings WHERE id = 'default';

-- Para cada option:
-- 1. Verificar se contem alguma keyword de borda
-- 2. Se nao, verificar se contem alguma keyword de sabor
-- 3. Se nao, vai para complementos
```

### 3. Atualizar Interface de Configuracoes

Adicionar nova secao na aba KDS do `SettingsDialog.tsx`:

```tsx
{/* Classificacao de Itens */}
<div className="border-t border-border/50 pt-4 mt-6">
  <div className="flex items-center gap-2 mb-4">
    <Tags className="h-4 w-4 text-primary" />
    <Label className="text-base font-medium">Classificacao de Itens</Label>
  </div>
  <p className="text-sm text-muted-foreground mb-4">
    Define como o sistema identifica bordas e sabores nos pedidos importados.
  </p>
  
  <div className="space-y-4">
    {/* Keywords para Bordas */}
    <div className="space-y-2">
      <Label htmlFor="edge-keywords" className="flex items-center gap-2">
        <span className="w-3 h-3 bg-orange-600 rounded-sm"></span>
        Palavras-chave para BORDAS
      </Label>
      <Input
        id="edge-keywords"
        value={formData.kds_edge_keywords || '#, Borda'}
        onChange={(e) => {
          setFormData({ ...formData, kds_edge_keywords: e.target.value });
          debouncedAutoSave({ kds_edge_keywords: e.target.value });
        }}
        placeholder="#, Borda, Recheio"
      />
      <p className="text-xs text-muted-foreground">
        Itens que contenham estas palavras aparecem com tarja laranja piscante
      </p>
    </div>
    
    {/* Keywords para Sabores */}
    <div className="space-y-2">
      <Label htmlFor="flavor-keywords" className="flex items-center gap-2">
        <span className="text-lg font-bold">A</span>
        Palavras-chave para SABORES
      </Label>
      <Input
        id="flavor-keywords"
        value={formData.kds_flavor_keywords || '(G), (M), (P), Sabor'}
        onChange={(e) => {
          setFormData({ ...formData, kds_flavor_keywords: e.target.value });
          debouncedAutoSave({ kds_flavor_keywords: e.target.value });
        }}
        placeholder="(G), (M), (P), Sabor"
      />
      <p className="text-xs text-muted-foreground">
        Itens que contenham estas palavras aparecem com fonte grande em destaque
      </p>
    </div>
  </div>
</div>
```

### 4. Atualizar Types

```typescript
// src/hooks/useSettings.ts
export interface AppSettings {
  // ... campos existentes
  kds_edge_keywords: string;    // "#, Borda"
  kds_flavor_keywords: string;  // "(G), (M), (P), Sabor"
}
```

---

## Logica de Classificacao Atualizada

A funcao SQL vai:

1. **Parsear keywords** (separar por virgula, remover espacos)
2. **Para cada option**:
   - Se o nome comeca com `#` → Borda (case especial mantido)
   - Se o nome contem qualquer keyword de borda → Borda
   - Se o nome contem qualquer keyword de sabor → Sabor
   - Se o grupo contem qualquer keyword de sabor → Sabor
   - Senao → Complemento

```sql
-- Exemplo de matching
v_option_name = 'CEARENSE (G)'
v_flavor_keywords = '(G), (M), (P), Sabor'

-- Resultado: Match em "(G)" → vai para flavors
```

---

## Arquivos a Modificar

| Arquivo | Mudanca |
|---------|---------|
| Migration SQL | Adicionar colunas `kds_edge_keywords` e `kds_flavor_keywords` |
| Migration SQL | Atualizar funcao para usar keywords dinamicas |
| `src/hooks/useSettings.ts` | Adicionar novos campos na interface |
| `src/components/SettingsDialog.tsx` | Adicionar inputs na aba KDS |

---

## Valores Padrao

Os valores padrao manterao o comportamento atual:

| Campo | Valor Padrao |
|-------|--------------|
| `kds_edge_keywords` | `#, Borda` |
| `kds_flavor_keywords` | `(G), (M), (P), Sabor` |

---

## Experiencia do Usuario

1. Usuario acessa **Configuracoes → KDS**
2. Encontra secao **Classificacao de Itens**
3. Edita palavras-chave conforme nomenclatura da sua API
4. Alteracoes salvam automaticamente (auto-save 800ms)
5. Novos pedidos importados usarao as novas regras
