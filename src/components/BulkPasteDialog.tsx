import { useState } from 'react';
import { ClipboardPaste, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

interface ParsedLine {
  option_group_id: number;
  group_name: string;
  option_type: string;
  already_mapped: boolean;
}

interface BulkPasteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingIds: Set<number>;
  onSave: (items: Array<{ store_id: string; option_group_id: number; option_type: string; group_name?: string }>) => Promise<void>;
  storeId: string;
}

function parsePastedText(text: string): Array<{ id: number; name: string }> {
  const results: Array<{ id: number; name: string }> = [];
  const lines = text.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Split by semicolon, tab, or first whitespace block
    const match = trimmed.match(/^(\d+)\s*[;\t]\s*(.*)$/) || trimmed.match(/^(\d+)\s+(.*)$/);
    if (match) {
      const id = parseInt(match[1]);
      const name = match[2].trim();
      if (!isNaN(id)) {
        results.push({ id, name });
      }
    } else {
      // Try just a number alone
      const num = parseInt(trimmed);
      if (!isNaN(num) && String(num) === trimmed) {
        results.push({ id: num, name: '' });
      }
    }
  }

  return results;
}

export function BulkPasteDialog({ open, onOpenChange, existingIds, onSave, storeId }: BulkPasteDialogProps) {
  const [rawText, setRawText] = useState('');
  const [defaultType, setDefaultType] = useState('flavor');
  const [parsed, setParsed] = useState<ParsedLine[]>([]);
  const [step, setStep] = useState<'paste' | 'review'>('paste');
  const [saving, setSaving] = useState(false);

  const handleProcess = () => {
    const items = parsePastedText(rawText);
    if (items.length === 0) {
      toast.error('Nenhum código válido encontrado. Use o formato: 944280 Nome do Grupo');
      return;
    }

    const lines: ParsedLine[] = items.map((item) => ({
      option_group_id: item.id,
      group_name: item.name,
      option_type: defaultType,
      already_mapped: existingIds.has(item.id),
    }));

    setParsed(lines);
    setStep('review');
    const newCount = lines.filter((l) => !l.already_mapped).length;
    toast.success(`${lines.length} linhas processadas (${newCount} novos)`);
  };

  const handleChangeType = (index: number, type: string) => {
    setParsed((prev) => prev.map((g, i) => (i === index ? { ...g, option_type: type } : g)));
  };

  const handleSave = async () => {
    const toSave = parsed.filter((g) => !g.already_mapped);
    if (toSave.length === 0) {
      toast.info('Todos os grupos já estão mapeados');
      handleClose();
      return;
    }

    setSaving(true);
    try {
      await onSave(
        toSave.map((g) => ({
          store_id: storeId,
          option_group_id: g.option_group_id,
          option_type: g.option_type,
          group_name: g.group_name || undefined,
        }))
      );
      toast.success(`${toSave.length} mapeamentos criados`);
      handleClose();
    } catch {
      toast.error('Erro ao salvar mapeamentos');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    setRawText('');
    setParsed([]);
    setStep('paste');
  };

  const TYPE_CONFIG: Record<string, { label: string; variant: 'destructive' | 'default' | 'secondary' | 'outline' }> = {
    edge: { label: 'Borda', variant: 'destructive' },
    flavor: { label: 'Sabor', variant: 'default' },
    complement: { label: 'Complemento', variant: 'secondary' },
  };

  const newCount = parsed.filter((g) => !g.already_mapped).length;

  return (
    <Dialog open={open} onOpenChange={handleClose} modal>
      <DialogContent className="max-h-[85vh] flex flex-col sm:max-w-[550px] z-[60]">
        <DialogHeader>
          <DialogTitle className="text-base flex items-center gap-2">
            <ClipboardPaste className="h-4 w-4" />
            Colar em Lote
          </DialogTitle>
          <DialogDescription className="text-xs">
            {step === 'paste'
              ? 'Cole o texto com códigos e nomes (um por linha). Ex: 944280 Massas & Bordas'
              : 'Revise os grupos e ajuste o tipo antes de salvar.'}
          </DialogDescription>
        </DialogHeader>

        {step === 'paste' ? (
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Tipo padrão</Label>
              <Select value={defaultType} onValueChange={setDefaultType}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-[70]">
                  <SelectItem value="edge">Borda</SelectItem>
                  <SelectItem value="flavor">Sabor</SelectItem>
                  <SelectItem value="complement">Complemento</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Dados (código + nome por linha)</Label>
              <Textarea
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder={`944280 Massas & Bordas\n944281;Sabores Pizza Grande\n944282\tComplementos`}
                className="text-xs min-h-[180px] font-mono"
              />
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto pr-1 space-y-1.5">
            {parsed.map((g, idx) => {
              const config = TYPE_CONFIG[g.option_type] || TYPE_CONFIG.complement;
              return (
                <div
                  key={g.option_group_id}
                  className={`flex items-center gap-2 text-xs p-2 rounded border ${
                    g.already_mapped ? 'opacity-50 bg-muted/20' : 'bg-muted/30'
                  }`}
                >
                  <span className="font-mono text-muted-foreground w-16 shrink-0">
                    {g.option_group_id}
                  </span>
                  <span className="flex-1 truncate">{g.group_name || '—'}</span>
                  {g.already_mapped ? (
                    <Badge variant="outline" className="text-[10px]">
                      Já mapeado
                    </Badge>
                  ) : (
                    <Select value={g.option_type} onValueChange={(v) => handleChangeType(idx, v)}>
                      <SelectTrigger className="h-7 w-28 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="z-[70]">
                        <SelectItem value="edge">Borda</SelectItem>
                        <SelectItem value="flavor">Sabor</SelectItem>
                        <SelectItem value="complement">Complemento</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <DialogFooter>
          {step === 'review' && (
            <Button variant="outline" size="sm" onClick={() => setStep('paste')} className="mr-auto">
              Voltar
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={handleClose}>
            Cancelar
          </Button>
          {step === 'paste' ? (
            <Button size="sm" onClick={handleProcess} disabled={!rawText.trim()}>
              Processar
            </Button>
          ) : (
            <Button size="sm" onClick={handleSave} disabled={saving || newCount === 0}>
              {saving && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
              Salvar {newCount} mapeamentos
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
