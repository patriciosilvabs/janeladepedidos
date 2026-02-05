

# Plano: Observações com Tarja Vermelha Piscando

## Problema

As observações dos itens (campo `notes`) estão sendo exibidas como texto simples cinza, passando despercebidas pelos operadores. Isso é crítico pois observações como "SEM CEBOLA" precisam de destaque visual.

## Localização no Código

**Arquivo**: `src/components/kds/KDSItemCard.tsx` (linhas 149-153)

**Código atual**:
```tsx
{item.notes && (
  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
    📝 {item.notes}
  </p>
)}
```

## Solução

Transformar a exibição das observações em uma **tarja vermelha com animação piscante**:

```tsx
{item.notes && (
  <div className="mt-2 p-2 bg-red-600 rounded-md animate-[pulse_0.8s_ease-in-out_infinite]">
    <p className="text-xs text-white font-bold uppercase">
      ⚠️ {item.notes}
    </p>
  </div>
)}
```

## Características Visuais

| Elemento | Valor |
|----------|-------|
| Fundo | Vermelho (`bg-red-600`) |
| Texto | Branco, negrito, maiúsculas |
| Animação | Pulse 0.8s infinito (pisca) |
| Ícone | ⚠️ (alerta) substituindo 📝 |
| Padding | 8px (p-2) |
| Borda | Arredondada (`rounded-md`) |

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `src/components/kds/KDSItemCard.tsx` | Estilizar observações com tarja vermelha piscante |

## Resultado Visual Esperado

```
+----------------------------------+
| #ML8XC6PX                  2:45  |
|                                  |
| Pizza Margherita                 |
|                                  |
| ⚠️ SEM CEBOLA                    |  ← TARJA VERMELHA PISCANDO
|                                  |
| DOM HELDER                       |
| João • Centro                    |
|                                  |
| [      INICIAR      ]            |
+----------------------------------+
```

