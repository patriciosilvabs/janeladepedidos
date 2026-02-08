
## Mover versao para o header

Adicionar o numero da versao (`v1.0.0`) ao lado do titulo "Buffer Logistico" no header, e remover o indicador fixo do canto inferior direito.

### Mudancas

1. **`src/components/Header.tsx`** (linha 73): Adicionar `v1.0.0` ao lado do titulo, em tamanho menor e cor mais suave:
   ```
   Buffer Logistico  v1.0.0
   ```

2. **`src/pages/Index.tsx`** (linhas 125-127): Remover o `<span>` fixo no canto inferior direito que exibe a versao, ja que sera exibida no header.
