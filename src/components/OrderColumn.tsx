import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface OrderColumnProps {
  title: string;
  count: number;
  icon: ReactNode;
  children: ReactNode;
  variant?: 'pending' | 'buffer' | 'dispatched';
}

export function OrderColumn({
  title,
  count,
  icon,
  children,
  variant = 'pending',
}: OrderColumnProps) {
  const variantStyles = {
    pending: 'border-yellow-500/30 bg-yellow-500/5',
    buffer: 'border-blue-500/30 bg-blue-500/5',
    dispatched: 'border-green-500/30 bg-green-500/5',
  };

  const headerStyles = {
    pending: 'bg-yellow-500/10 text-yellow-400',
    buffer: 'bg-blue-500/10 text-blue-400',
    dispatched: 'bg-green-500/10 text-green-400',
  };

  return (
    <div
      className={cn(
        'flex h-full flex-col rounded-xl border',
        variantStyles[variant]
      )}
    >
      <div
        className={cn(
          'flex items-center justify-between rounded-t-xl px-4 py-3',
          headerStyles[variant]
        )}
      >
        <div className="flex items-center gap-2">
          {icon}
          <h2 className="font-semibold">{title}</h2>
        </div>
        <span className="rounded-full bg-background/20 px-3 py-1 text-sm font-medium">
          {count}
        </span>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto p-4">{children}</div>
    </div>
  );
}
