import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useStores } from '@/hooks/useStores';
import { Plus, Trash2, Loader2, Beaker, Pizza } from 'lucide-react';

interface SimulatedItem {
  name: string;
  quantity: number;
  notes?: string;
}

const PIZZA_PRESETS = [
  { name: 'Pizza Margherita', notes: 'Sem cebola' },
  { name: 'Pizza Calabresa', notes: '' },
  { name: 'Pizza Quatro Queijos', notes: 'Borda recheada' },
  { name: 'Pizza Frango c/ Catupiry', notes: '' },
  { name: 'Pizza Portuguesa', notes: 'Sem azeitona' },
  { name: 'Pizza Pepperoni', notes: '' },
  { name: 'Pizza Napolitana', notes: 'Massa fina' },
  { name: 'Pizza Bacon', notes: '' },
];

const CUSTOMER_NAMES = [
  'João Silva', 'Maria Santos', 'Pedro Oliveira', 'Ana Costa',
  'Carlos Souza', 'Fernanda Lima', 'Roberto Alves', 'Juliana Pereira',
];

const NEIGHBORHOODS = [
  'Manaíra', 'Tambaú', 'Bessa', 'Cabo Branco', 'Bancários',
  'Mangabeira', 'Cristo Redentor', 'Centro', 'Torre', 'Valentina',
];

export function OrderSimulator() {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [storeId, setStoreId] = useState<string | null>(null);
  const [items, setItems] = useState<SimulatedItem[]>([
    { name: 'Pizza Margherita', quantity: 1, notes: '' },
  ]);
  const { toast } = useToast();
  const { stores } = useStores();

  const addItem = () => {
    const randomPizza = PIZZA_PRESETS[Math.floor(Math.random() * PIZZA_PRESETS.length)];
    setItems([...items, { name: randomPizza.name, quantity: 1, notes: randomPizza.notes }]);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof SimulatedItem, value: string | number) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    setItems(updated);
  };

  const generateRandomOrder = () => {
    const randomCustomer = CUSTOMER_NAMES[Math.floor(Math.random() * CUSTOMER_NAMES.length)];
    const randomNeighborhood = NEIGHBORHOODS[Math.floor(Math.random() * NEIGHBORHOODS.length)];
    const itemCount = Math.floor(Math.random() * 3) + 1; // 1-3 items
    
    const randomItems: SimulatedItem[] = [];
    for (let i = 0; i < itemCount; i++) {
      const pizza = PIZZA_PRESETS[Math.floor(Math.random() * PIZZA_PRESETS.length)];
      randomItems.push({
        name: pizza.name,
        quantity: Math.floor(Math.random() * 2) + 1,
        notes: pizza.notes,
      });
    }

    setCustomerName(randomCustomer);
    setNeighborhood(randomNeighborhood);
    setItems(randomItems);
  };

  const handleSubmit = async () => {
    if (!customerName.trim() || items.length === 0) {
      toast({
        title: 'Dados incompletos',
        description: 'Preencha o nome do cliente e adicione pelo menos um item.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Generate random coordinates in João Pessoa area
      const lat = -7.1 + (Math.random() * 0.1);
      const lng = -34.85 + (Math.random() * 0.1);

      // Convert items to JSON-compatible format
      const itemsJson = items.map(item => ({
        name: item.name,
        quantity: item.quantity,
        notes: item.notes || '',
      }));

      // Create order directly in the database
      const orderData = {
        customer_name: customerName,
        customer_phone: `(83) 9${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`,
        address: `Rua ${neighborhood}, ${Math.floor(Math.random() * 500) + 1}`,
        neighborhood: neighborhood,
        city: 'João Pessoa',
        region: 'PB',
        country: 'BR',
        lat,
        lng,
        items: itemsJson as unknown,
        total_amount: items.reduce((acc, item) => acc + (item.quantity * 45), 0),
        status: 'pending',
        store_id: storeId,
        cardapioweb_order_id: `SIM-${Date.now().toString(36).toUpperCase()}`,
        external_id: `sim-${Date.now()}`,
      };

      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert(orderData as any)
        .select()
        .single();

      if (orderError) throw orderError;

      // Create order items
      const { error: itemsError } = await supabase.rpc(
        'create_order_items_from_json',
        {
          p_order_id: order.id,
          p_items: itemsJson,
          p_default_sector_id: null,
        }
      );

      if (itemsError) {
        console.error('Error creating items:', itemsError);
      }

      toast({
        title: '✅ Pedido simulado criado!',
        description: `Pedido para ${customerName} com ${items.length} item(s) criado.`,
      });

      // Reset form
      setCustomerName('');
      setNeighborhood('');
      setItems([{ name: 'Pizza Margherita', quantity: 1, notes: '' }]);
      setOpen(false);

    } catch (error: any) {
      console.error('Simulation error:', error);
      toast({
        title: 'Erro ao criar pedido',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickSimulate = async () => {
    generateRandomOrder();
    // Small delay to let state update
    setTimeout(() => {
      handleSubmit();
    }, 100);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          className="gap-2 border-dashed border-primary/50 text-primary hover:bg-primary/10"
        >
          <Beaker className="h-4 w-4" />
          Simular Pedido
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Beaker className="h-5 w-5 text-primary" />
            Simulador de Pedidos
          </DialogTitle>
          <DialogDescription>
            Crie pedidos de teste para verificar o fluxo do KDS.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Quick Actions */}
          <div className="flex gap-2">
            <Button 
              variant="secondary" 
              size="sm" 
              onClick={generateRandomOrder}
              className="flex-1"
            >
              🎲 Gerar Aleatório
            </Button>
            <Button 
              variant="default" 
              size="sm" 
              onClick={handleQuickSimulate}
              disabled={isSubmitting}
              className="flex-1"
            >
              ⚡ Simular Rápido
            </Button>
          </div>

          {/* Customer Info */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="customer">Cliente</Label>
              <Input
                id="customer"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Nome do cliente"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="neighborhood">Bairro</Label>
              <Select value={neighborhood} onValueChange={setNeighborhood}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {NEIGHBORHOODS.map((n) => (
                    <SelectItem key={n} value={n}>{n}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Store Selection */}
          {stores.length > 0 && (
            <div className="space-y-2">
              <Label>Loja (opcional)</Label>
              <Select value={storeId || ''} onValueChange={(v) => setStoreId(v || null)}>
                <SelectTrigger>
                  <SelectValue placeholder="Sem loja específica" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Sem loja específica</SelectItem>
                  {stores.map((store) => (
                    <SelectItem key={store.id} value={store.id}>{store.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Items */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Itens do Pedido</Label>
              <Badge variant="secondary">{items.length} item(s)</Badge>
            </div>
            
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {items.map((item, index) => (
                <div 
                  key={index} 
                  className="flex items-center gap-2 p-2 rounded-lg border bg-muted/30"
                >
                  <Pizza className="h-4 w-4 text-primary shrink-0" />
                  <div className="flex-1 grid grid-cols-3 gap-2">
                    <Select 
                      value={item.name} 
                      onValueChange={(v) => updateItem(index, 'name', v)}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PIZZA_PRESETS.map((p) => (
                          <SelectItem key={p.name} value={p.name}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      min={1}
                      max={10}
                      value={item.quantity}
                      onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 1)}
                      className="h-8 text-xs"
                    />
                    <Input
                      value={item.notes || ''}
                      onChange={(e) => updateItem(index, 'notes', e.target.value)}
                      placeholder="Obs..."
                      className="h-8 text-xs"
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-destructive hover:text-destructive"
                    onClick={() => removeItem(index)}
                    disabled={items.length === 1}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={addItem}
              className="w-full gap-1"
            >
              <Plus className="h-3 w-3" />
              Adicionar Item
            </Button>
          </div>

          {/* Submit */}
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !customerName.trim() || items.length === 0}
            className="w-full"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Criando...
              </>
            ) : (
              <>
                <Beaker className="h-4 w-4 mr-2" />
                Criar Pedido de Teste
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
