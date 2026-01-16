export interface Store {
  id: string;
  name: string;
}

export interface Order {
  id: string;
  external_id: string | null;
  cardapioweb_order_id: string | null;
  cardapioweb_created_at: string | null;
  customer_name: string;
  customer_phone: string | null;
  address: string;
  neighborhood: string | null;
  lat: number;
  lng: number;
  status: 'pending' | 'waiting_buffer' | 'ready' | 'dispatched';
  group_id: string | null;
  store_id: string | null;
  items: any;
  total_amount: number | null;
  notes: string | null;
  created_at: string;
  ready_at: string | null;
  dispatched_at: string | null;
  notification_error: string | null;
  foody_uid: string | null;
  foody_status: string | null;
  foody_error: string | null;
  cardapioweb_notified: boolean | null;
  cardapioweb_notified_at: string | null;
  is_urgent: boolean | null;
}

export interface DeliveryGroup {
  id: string;
  center_lat: number;
  center_lng: number;
  order_count: number;
  max_orders: number;
  created_at: string;
  dispatched_at: string | null;
  status: 'waiting' | 'dispatched';
}

export interface OrderWithGroup extends Order {
  delivery_groups?: DeliveryGroup | null;
  stores?: Store | null;
}
