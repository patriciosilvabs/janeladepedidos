
## Plano: Adicionar barra de rolagem na tela principal do Dashboard

### Problema

O painel do Forno ocupa muito espaco vertical quando ha varios itens. As colunas abaixo (Em Producao, Buffer de Espera, Pedido Pronto, Despachados) ficam cortadas e inacessiveis porque o container pai tem altura fixa sem overflow.

### Alteracao

**Arquivo: `src/components/Dashboard.tsx` (linha 278)**

Adicionar `overflow-y-auto` ao container principal para permitir rolagem vertical quando o conteudo excede a altura da tela.

De:
```text
<div className="flex flex-col h-[calc(100vh-5rem)]">
```

Para:
```text
<div className="flex flex-col h-[calc(100vh-5rem)] overflow-y-auto">
```

### Resultado

- Quando o painel do Forno estiver cheio, o usuario podera rolar a pagina para baixo e ver as quatro colunas normalmente
- Quando houver poucos itens no forno, o layout continua igual ao atual
- Nenhuma outra alteracao necessaria
