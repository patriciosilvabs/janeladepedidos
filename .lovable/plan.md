

# Plano: Ajustar Hierarquia Visual do Card KDS

## Estrutura Visual Desejada (Baseado na Imagem)

```
Pizza Grande por 35,00 - 2 Sabores     (texto pequeno, secundario)

┌─────────────────────────────────────────────┐
│ # Borda de Chocolate Preto                  │  ← Tarja LARANJA piscante
└─────────────────────────────────────────────┘

- CEARENSE (G)                                   ← FONTE GRANDE, destaque principal
- PEPPERONI E CATUPIRY (G)

- Pizza Chocolate Pequena 25cm por R$ 19,90    ← Lista simples (itens adicionais)

┌─────────────────────────────────────────────┐
│ SEM CEBOLA                                  │  ← Tarja VERMELHA piscante
└─────────────────────────────────────────────┘
```

---

## Solucao em 2 Partes

### Parte 1: Separar Dados no Banco de Dados

Atualizar a funcao `create_order_items_from_json` para identificar e separar:

| Categoria | Identificador | Campo Destino | Exibicao |
|-----------|---------------|---------------|----------|
| **Bordas** | Comeca com `#` ou contem "Borda" | `edge_type` (novo) | Tarja laranja piscante |
| **Sabores** | Contem `(G)`, `(M)`, `(P)` ou grupo "Sabor" | `flavors` (novo) | Fonte grande, destaque |
| **Outros** | Demais itens (massas, adicionais) | `complements` | Lista simples |
| **Observacao** | Campo `observation` da API | `notes` | Tarja vermelha piscante |

### Parte 2: Atualizar Interface do Card

Modificar `KDSItemCard.tsx` para exibir na ordem correta com os estilos apropriados.

---

## Mudancas Detalhadas

### 1. Migracao SQL - Novos Campos

```sql
-- Adicionar colunas para separar tipos de dados
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS edge_type text;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS flavors text;
```

### 2. Atualizar Funcao SQL

A funcao vai processar cada `option` e classificar:

```sql
-- Para cada option:
v_option_name := v_option->>'name';

-- 1. Bordas: comecam com # ou contem "Borda"
IF v_option_name LIKE '#%' OR v_option_name ILIKE '%borda%' THEN
  -- Adicionar a v_edge_type
  
-- 2. Sabores: contem (G), (M), (P) ou grupo "Sabor"
ELSIF v_option_name ~ '\([GMP]\)' OR v_option_group ILIKE '%sabor%' THEN
  -- Adicionar a v_flavors (com quebra de linha)
  
-- 3. Outros: massas, adicionais, etc
ELSE
  -- Adicionar a v_complements
END IF;

-- Salvar separadamente
INSERT INTO order_items (..., notes, complements, edge_type, flavors)
VALUES (..., v_observation, v_complements, v_edge_type, v_flavors);
```

### 3. Atualizar Types

```typescript
// src/types/orderItems.ts
export interface OrderItem {
  // ... campos existentes
  edge_type: string | null;   // Borda (tarja laranja)
  flavors: string | null;     // Sabores (fonte grande)
  complements: string | null; // Outros itens (lista simples)
}
```

### 4. Atualizar KDSItemCard

```tsx
{/* Nome do produto - texto menor, secundario */}
<div className="mb-2">
  <span className="text-sm text-muted-foreground">
    {item.quantity > 1 && `${item.quantity}x `}
    {item.product_name}
  </span>
</div>

{/* Borda - Tarja LARANJA piscante */}
{item.edge_type && (
  <div className="mb-2 p-2 bg-orange-600 rounded-md animate-[pulse_0.8s_ease-in-out_infinite]">
    <p className="text-sm text-white font-bold">
      {item.edge_type}
    </p>
  </div>
)}

{/* Sabores - FONTE GRANDE, destaque principal */}
{item.flavors && (
  <div className="mb-3">
    <div className="text-2xl font-bold text-foreground whitespace-pre-line leading-tight">
      {item.flavors}
    </div>
  </div>
)}

{/* Complementos - Lista simples (massas, adicionais) */}
{item.complements && (
  <div className="mb-2 text-sm text-muted-foreground whitespace-pre-line">
    {item.complements}
  </div>
)}

{/* Observacao do cliente - Tarja VERMELHA piscante */}
{item.notes && (
  <div className="mb-2 p-2 bg-red-600 rounded-md animate-[pulse_0.8s_ease-in-out_infinite]">
    <p className="text-sm text-white font-bold uppercase">
      OBS: {item.notes}
    </p>
  </div>
)}
```

---

## Resultado Visual Final

```
#1234                                    0:45

Pizza Grande por 35,00 - 2 Sabores      (pequeno, cinza)

┌─────────────────────────────────────────────┐
│ # Borda de Chocolate Preto                  │  LARANJA PISCANTE
└─────────────────────────────────────────────┘

- CEARENSE (G)                                   FONTE GRANDE
- PEPPERONI E CATUPIRY (G)                       DESTAQUE

- Massa Tradicional                              (lista simples)
- Pizza Chocolate Pequena 25cm

┌─────────────────────────────────────────────┐
│ OBS: SEM CEBOLA                             │  VERMELHA PISCANTE
└─────────────────────────────────────────────┘

Pizzaria Central • Bancada 1
Joao Silva • Centro

         [ INICIAR ]
```

---

## Arquivos a Modificar

| Arquivo | Mudanca |
|---------|---------|
| Migration SQL | Adicionar colunas `edge_type` e `flavors`, atualizar funcao |
| `src/types/orderItems.ts` | Adicionar campos `edge_type` e `flavors` |
| `src/components/kds/KDSItemCard.tsx` | Reorganizar layout com nova hierarquia visual |

---

## Impacto

- Sabores em destaque (fonte grande) para facilitar visualizacao
- Bordas com tarja laranja piscante para atencao especial
- Observacoes com tarja vermelha piscante (apenas cliente)
- Nome do produto em segundo plano (texto menor)
- Estrutura mais organizada e legivel para operadores

