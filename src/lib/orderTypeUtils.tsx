import { Badge } from '@/components/ui/badge';

const ORDER_TYPE_CONFIG: Record<string, { label: string; className: string }> = {
  delivery:     { label: 'Delivery',      className: 'bg-blue-600 text-white' },
  takeout:      { label: 'Retirada',      className: 'bg-orange-500 text-white' },
  takeaway:     { label: 'Retirada',      className: 'bg-orange-500 text-white' },
  dine_in:      { label: 'Mesa',          className: 'bg-green-600 text-white' },
  closed_table: { label: 'Mesa Fechada',  className: 'bg-green-600 text-white' },
  counter:      { label: 'Balcão',        className: 'bg-purple-600 text-white' },
};

export function OrderTypeBadge({ orderType, className = '' }: { orderType: string | null | undefined; className?: string }) {
  if (!orderType) return null;
  const config = ORDER_TYPE_CONFIG[orderType];
  if (!config) return null;

  return (
    <Badge className={`${config.className} font-bold ${className}`}>
      {config.label}
    </Badge>
  );
}
