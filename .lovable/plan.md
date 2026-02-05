

# Plano: Ajustar Layout do Card KDS

## Problema Atual

O sistema está juntando sabores e observações no mesmo campo `notes`, e exibindo **tudo** com tarja vermelha piscante. O modelo de referência mostra que:

- **Complementos/Sabores**: Lista simples com bullets (sem destaque)
- **Observação do cliente**: Apenas esta deve ter tarja vermelha piscante

## Solução em 2 Partes

### Parte 1: Separar Dados no Banco

Atualizar a função `create_order_items_from_json` para armazenar separadamente:

| Campo | Conteúdo | Destino |
|-------|----------|---------|
| `notes` | Observação do cliente (`observation`) | Campo existente (tarja vermelha) |
| `complements` | Sabores/bordas/opções (`options[]`) | **Novo campo** (lista simples) |

### Parte 2: Atualizar Interface do Card

Modificar `KDSItemCard.tsx` para:

1. Exibir complementos como lista com bullets (texto normal)
2. Exibir observação com tarja vermelha piscante (apenas se existir)

## Mudanças Detalhadas

### 1. Migração SQL - Novo Campo

```sql
-- Adicionar coluna para complementos
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS complements text;

-- Atualizar função para separar dados
-- notes = apenas observação do cliente
-- complements = sabores, bordas, opções
```

### 2. Atualizar Função SQL

```sql
-- Extrair observation para notes
v_observation := v_item->>'observation';

-- Extrair options para complements (lista separada por linha)
v_complements := '';
FOR v_option IN SELECT * FROM jsonb_array_elements(v_item->'options')
LOOP
  v_option_name := v_option->>'name';
  IF v_complements != '' THEN
    v_complements := v_complements || E'\n';
  END IF;
  v_complements := v_complements || '- ' || v_option_name;
END LOOP;

-- Salvar separadamente
INSERT INTO order_items (..., notes, complements)
VALUES (..., NULLIF(v_observation, ''), NULLIF(v_complements, ''));
```

### 3. Atualizar Types

```typescript
// src/types/orderItems.ts
export interface OrderItem {
  // ... campos existentes
  complements: string | null; // NOVO
}
```

### 4. Atualizar KDSItemCard

```tsx
{/* Complementos - Lista simples (sem destaque) */}
{item.complements && (
  <div className="mb-2 text-sm text-muted-foreground whitespace-pre-line">
    {item.complements}
  </div>
)}

{/* Observação - Tarja vermelha piscante */}
{item.notes && (
  <div className="mb-2 p-2 bg-red-600 rounded-md animate-[pulse_0.8s_ease-in-out_infinite]">
    <p className="text-xs text-white font-bold uppercase">
      ⚠️ OBS: {item.notes}
    </p>
  </div>
)}
```

## Resultado Visual

```
#1234                    0:45

Pizza Grande por 35,00 - 2 Sabores

- # Borda de Chocolate Preto
- CEARENSE (G)
- PEPPERONI E CATUPIRY (G)

┌────────────────────────────┐
│ ⚠️ OBS: SEM CEBOLA         │  ← Apenas isso pisca em vermelho
└────────────────────────────┘

Pizzaria Central • Bancada 1
João Silva • Centro

[ INICIAR ]
```

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| Migration SQL | Adicionar coluna `complements` e atualizar função |
| `src/types/orderItems.ts` | Adicionar campo `complements` |
| `src/components/kds/KDSItemCard.tsx` | Separar exibição de complementos e observação |

## Impacto

- Complementos/sabores aparecem como lista legível
- Somente observações do cliente têm destaque visual
- Melhor legibilidade para operadores
- Novo campo `complements` disponível para futuras features

