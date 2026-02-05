
# Plano: Remover Completamente QZ Tray do Projeto

## Visão Geral
Remoção total de todos os arquivos, hooks, componentes, edge functions e referências relacionados à impressão silenciosa via QZ Tray.

---

## Arquivos para Deletar

| Arquivo | Descrição |
|---------|-----------|
| `src/lib/qzTray.ts` | Serviço principal de conexão QZ Tray |
| `public/qz-tray.js` | Biblioteca JavaScript do QZ Tray |
| `src/hooks/useQZTray.ts` | Hook de conexão e impressão |
| `src/hooks/usePrintJobQueue.ts` | Hook da fila de impressão remota |
| `src/components/PrinterSettings.tsx` | Componente de configurações de impressora |
| `supabase/functions/sign-qz/index.ts` | Edge function de assinatura |

---

## Arquivos para Modificar

### 1. `src/components/SettingsDialog.tsx`
- Remover import do `PrinterSettings`
- Remover ícone `Printer` do lucide-react
- Remover tab "Impressão" do TabsList
- Remover TabsContent "printer"

### 2. `src/pages/Index.tsx`
- Remover imports de `useQZTray` e `usePrintJobQueue`
- Remover inicialização da fila de impressão

### 3. `src/components/kds/OvenTimerPanel.tsx`
- Remover import e uso do `useQZTray`
- Remover chamada `printOrQueue`

### 4. `src/hooks/useSettings.ts`
- Remover campos da interface `AppSettings`:
  - `qz_printer_name`
  - `qz_print_enabled`
  - `print_receiver_enabled`

---

## Banco de Dados (migração SQL)

```text
-- Remover tabela print_jobs
DROP TABLE IF EXISTS print_jobs;

-- Remover colunas da tabela app_settings
ALTER TABLE app_settings 
  DROP COLUMN IF EXISTS qz_printer_name,
  DROP COLUMN IF EXISTS qz_print_enabled,
  DROP COLUMN IF EXISTS print_receiver_enabled;
```

---

## Secrets para Remover
- `QZ_PRIVATE_KEY` (no painel de Secrets do backend)

---

## Sequência de Implementação

1. Modificar componentes que usam QZ Tray (SettingsDialog, Index, OvenTimerPanel)
2. Modificar hook useSettings
3. Deletar arquivos de QZ Tray
4. Deletar edge function sign-qz
5. Executar migração SQL para limpar banco de dados
6. Remover secret QZ_PRIVATE_KEY

---

## Resultado
Após a execução, o projeto estará completamente limpo de qualquer código relacionado ao QZ Tray, pronto para deploy e posterior reimplementação se necessário.
