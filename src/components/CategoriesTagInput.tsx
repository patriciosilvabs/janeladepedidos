import { useState } from 'react';
import { X, Tag, Plus } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const SUGGESTED_CATEGORIES = ['Pizza', 'Bebida', 'Sobremesa', 'Lanche', 'Porção', 'Combo', 'Açaí', 'Salgado', 'Doce', 'Pastel'];

interface CategoriesTagInputProps {
  categories: string[] | null;
  onChange: (categories: string[] | null) => void;
}

export function CategoriesTagInput({ categories, onChange }: CategoriesTagInputProps) {
  const [inputValue, setInputValue] = useState('');

  const currentCategories = categories || [];

  const addCategory = (cat: string) => {
    const trimmed = cat.trim();
    if (!trimmed) return;
    if (currentCategories.some(c => c.toLowerCase() === trimmed.toLowerCase())) return;
    onChange([...currentCategories, trimmed]);
    setInputValue('');
  };

  const removeCategory = (index: number) => {
    const updated = currentCategories.filter((_, i) => i !== index);
    onChange(updated.length > 0 ? updated : null);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addCategory(inputValue);
    }
  };

  const availableSuggestions = SUGGESTED_CATEGORIES.filter(
    s => !currentCategories.some(c => c.toLowerCase() === s.toLowerCase())
  );

  return (
    <div className="space-y-2">
      <Label className="text-xs font-medium flex items-center gap-1">
        <Tag className="h-3 w-3" />
        Categorias Exibidas no Tablet
      </Label>
      <p className="text-xs text-muted-foreground">
        {currentCategories.length === 0
          ? 'Todas as categorias serão aceitas (nenhum filtro ativo)'
          : 'Apenas itens das categorias abaixo serão importados'}
      </p>

      {/* Current tags */}
      {currentCategories.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {currentCategories.map((cat, idx) => (
            <Badge
              key={idx}
              variant="secondary"
              className="gap-1 pr-1"
            >
              {cat}
              <button
                type="button"
                onClick={() => removeCategory(idx)}
                className="ml-0.5 rounded-full p-0.5 hover:bg-muted"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* Input + add */}
      <div className="flex gap-2">
        <Input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Digitar categoria e Enter"
          className="text-sm"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => addCategory(inputValue)}
          disabled={!inputValue.trim()}
          className="shrink-0"
        >
          <Plus className="h-3 w-3 mr-1" />
          Adicionar
        </Button>
      </div>

      {/* Suggestions */}
      {availableSuggestions.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {availableSuggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => addCategory(s)}
              className="text-xs px-2 py-0.5 rounded-full border border-border/50 bg-muted/30 text-muted-foreground hover:bg-primary/10 hover:text-primary hover:border-primary/30 transition-colors"
            >
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
