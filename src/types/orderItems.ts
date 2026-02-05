export type ItemStatus = 'pending' | 'in_prep' | 'in_oven' | 'ready';

export interface OrderItem {
  id: string;
  order_id: string;
  product_name: string;
  quantity: number;
  notes: string | null;
  complements: string | null;
  edge_type: string | null;
  flavors: string | null;
  status: ItemStatus;
  assigned_sector_id: string | null;
  claimed_by: string | null;
  claimed_at: string | null;
  oven_entry_at: string | null;
  estimated_exit_at: string | null;
  ready_at: string | null;
  created_at: string;
}

export interface OrderItemWithOrder extends OrderItem {
  orders?: {
    id: string;
    customer_name: string;
    cardapioweb_order_id: string | null;
    external_id: string | null;
    neighborhood: string | null;
    address: string;
    stores?: {
      id: string;
      name: string;
    } | null;
  } | null;
  sectors?: {
    id: string;
    name: string;
  } | null;
}

export interface ClaimResult {
  success: boolean;
  error?: string;
  message?: string;
  item_id?: string;
  claimed_at?: string;
  claimed_by?: string;
}

export interface OvenResult {
  success: boolean;
  error?: string;
  message?: string;
  item_id?: string;
  oven_entry_at?: string;
  estimated_exit_at?: string;
}
