export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          buffer_timeout_minutes: number | null
          cardapioweb_api_token: string | null
          cardapioweb_api_url: string | null
          cardapioweb_enabled: boolean | null
          cardapioweb_webhook_token: string | null
          created_at: string | null
          default_city: string | null
          default_country: string | null
          default_region: string | null
          dispatched_order_sort_desc: boolean | null
          dispatched_visibility_minutes: number | null
          fifo_critical_minutes: number | null
          fifo_lock_enabled: boolean | null
          fifo_warning_minutes: number | null
          foody_api_token: string | null
          foody_api_url: string | null
          foody_enabled: boolean | null
          grouping_radius_km: number | null
          id: string
          kds_default_mode: string | null
          kds_edge_keywords: string | null
          kds_edge_sector_id: string | null
          kds_fifo_visual_enabled: boolean | null
          kds_flavor_keywords: string | null
          max_order_age_hours: number | null
          max_orders_per_group: number | null
          oven_time_seconds: number | null
          updated_at: string | null
          urgent_bypass_enabled: boolean | null
          urgent_production_timeout_minutes: number | null
        }
        Insert: {
          buffer_timeout_minutes?: number | null
          cardapioweb_api_token?: string | null
          cardapioweb_api_url?: string | null
          cardapioweb_enabled?: boolean | null
          cardapioweb_webhook_token?: string | null
          created_at?: string | null
          default_city?: string | null
          default_country?: string | null
          default_region?: string | null
          dispatched_order_sort_desc?: boolean | null
          dispatched_visibility_minutes?: number | null
          fifo_critical_minutes?: number | null
          fifo_lock_enabled?: boolean | null
          fifo_warning_minutes?: number | null
          foody_api_token?: string | null
          foody_api_url?: string | null
          foody_enabled?: boolean | null
          grouping_radius_km?: number | null
          id?: string
          kds_default_mode?: string | null
          kds_edge_keywords?: string | null
          kds_edge_sector_id?: string | null
          kds_fifo_visual_enabled?: boolean | null
          kds_flavor_keywords?: string | null
          max_order_age_hours?: number | null
          max_orders_per_group?: number | null
          oven_time_seconds?: number | null
          updated_at?: string | null
          urgent_bypass_enabled?: boolean | null
          urgent_production_timeout_minutes?: number | null
        }
        Update: {
          buffer_timeout_minutes?: number | null
          cardapioweb_api_token?: string | null
          cardapioweb_api_url?: string | null
          cardapioweb_enabled?: boolean | null
          cardapioweb_webhook_token?: string | null
          created_at?: string | null
          default_city?: string | null
          default_country?: string | null
          default_region?: string | null
          dispatched_order_sort_desc?: boolean | null
          dispatched_visibility_minutes?: number | null
          fifo_critical_minutes?: number | null
          fifo_lock_enabled?: boolean | null
          fifo_warning_minutes?: number | null
          foody_api_token?: string | null
          foody_api_url?: string | null
          foody_enabled?: boolean | null
          grouping_radius_km?: number | null
          id?: string
          kds_default_mode?: string | null
          kds_edge_keywords?: string | null
          kds_edge_sector_id?: string | null
          kds_fifo_visual_enabled?: boolean | null
          kds_flavor_keywords?: string | null
          max_order_age_hours?: number | null
          max_orders_per_group?: number | null
          oven_time_seconds?: number | null
          updated_at?: string | null
          urgent_bypass_enabled?: boolean | null
          urgent_production_timeout_minutes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "app_settings_kds_edge_sector_id_fkey"
            columns: ["kds_edge_sector_id"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["id"]
          },
        ]
      }
      buffer_settings_by_day: {
        Row: {
          buffer_timeout_minutes: number
          created_at: string | null
          day_of_week: number
          enabled: boolean | null
          id: string
          updated_at: string | null
        }
        Insert: {
          buffer_timeout_minutes?: number
          created_at?: string | null
          day_of_week: number
          enabled?: boolean | null
          id: string
          updated_at?: string | null
        }
        Update: {
          buffer_timeout_minutes?: number
          created_at?: string | null
          day_of_week?: number
          enabled?: boolean | null
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      delivery_groups: {
        Row: {
          center_lat: number
          center_lng: number
          created_at: string
          dispatched_at: string | null
          id: string
          max_orders: number
          order_count: number
          status: string
        }
        Insert: {
          center_lat: number
          center_lng: number
          created_at?: string
          dispatched_at?: string | null
          id?: string
          max_orders?: number
          order_count?: number
          status?: string
        }
        Update: {
          center_lat?: number
          center_lng?: number
          created_at?: string
          dispatched_at?: string | null
          id?: string
          max_orders?: number
          order_count?: number
          status?: string
        }
        Relationships: []
      }
      dynamic_buffer_settings: {
        Row: {
          created_at: string | null
          enabled: boolean | null
          high_volume_min_orders: number | null
          high_volume_timer_minutes: number | null
          id: string
          low_volume_max_orders: number | null
          low_volume_min_orders: number | null
          low_volume_timer_minutes: number | null
          max_buffer_time_minutes: number | null
          medium_volume_max_orders: number | null
          medium_volume_min_orders: number | null
          medium_volume_timer_minutes: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          enabled?: boolean | null
          high_volume_min_orders?: number | null
          high_volume_timer_minutes?: number | null
          id?: string
          low_volume_max_orders?: number | null
          low_volume_min_orders?: number | null
          low_volume_timer_minutes?: number | null
          max_buffer_time_minutes?: number | null
          medium_volume_max_orders?: number | null
          medium_volume_min_orders?: number | null
          medium_volume_timer_minutes?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          enabled?: boolean | null
          high_volume_min_orders?: number | null
          high_volume_timer_minutes?: number | null
          id?: string
          low_volume_max_orders?: number | null
          low_volume_min_orders?: number | null
          low_volume_timer_minutes?: number | null
          max_buffer_time_minutes?: number | null
          medium_volume_max_orders?: number | null
          medium_volume_min_orders?: number | null
          medium_volume_timer_minutes?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      invitations: {
        Row: {
          created_at: string | null
          email: string
          expires_at: string | null
          id: string
          invited_by: string | null
          role: Database["public"]["Enums"]["app_role"]
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          expires_at?: string | null
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          token?: string
          used_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          expires_at?: string | null
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      order_items: {
        Row: {
          assigned_sector_id: string | null
          claimed_at: string | null
          claimed_by: string | null
          complements: string | null
          created_at: string
          edge_type: string | null
          estimated_exit_at: string | null
          flavors: string | null
          id: string
          next_sector_id: string | null
          notes: string | null
          order_id: string
          oven_entry_at: string | null
          product_name: string
          quantity: number
          ready_at: string | null
          status: Database["public"]["Enums"]["item_status"]
        }
        Insert: {
          assigned_sector_id?: string | null
          claimed_at?: string | null
          claimed_by?: string | null
          complements?: string | null
          created_at?: string
          edge_type?: string | null
          estimated_exit_at?: string | null
          flavors?: string | null
          id?: string
          next_sector_id?: string | null
          notes?: string | null
          order_id: string
          oven_entry_at?: string | null
          product_name: string
          quantity?: number
          ready_at?: string | null
          status?: Database["public"]["Enums"]["item_status"]
        }
        Update: {
          assigned_sector_id?: string | null
          claimed_at?: string | null
          claimed_by?: string | null
          complements?: string | null
          created_at?: string
          edge_type?: string | null
          estimated_exit_at?: string | null
          flavors?: string | null
          id?: string
          next_sector_id?: string | null
          notes?: string | null
          order_id?: string
          oven_entry_at?: string | null
          product_name?: string
          quantity?: number
          ready_at?: string | null
          status?: Database["public"]["Enums"]["item_status"]
        }
        Relationships: [
          {
            foreignKeyName: "order_items_assigned_sector_id_fkey"
            columns: ["assigned_sector_id"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_next_sector_id_fkey"
            columns: ["next_sector_id"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          address: string
          all_items_ready: boolean | null
          cardapioweb_created_at: string | null
          cardapioweb_notified: boolean | null
          cardapioweb_notified_at: string | null
          cardapioweb_order_id: string | null
          city: string | null
          country: string | null
          created_at: string
          customer_name: string
          customer_phone: string | null
          delivery_fee: number | null
          dispatched_at: string | null
          external_id: string | null
          foody_error: string | null
          foody_status: string | null
          foody_uid: string | null
          group_id: string | null
          house_number: string | null
          id: string
          is_urgent: boolean | null
          items: Json | null
          lat: number
          lng: number
          mixed_origin: boolean | null
          neighborhood: string | null
          notes: string | null
          notification_error: string | null
          order_type: string | null
          payment_method: string | null
          postal_code: string | null
          ready_at: string | null
          region: string | null
          status: string
          store_id: string | null
          street: string | null
          total_amount: number | null
        }
        Insert: {
          address: string
          all_items_ready?: boolean | null
          cardapioweb_created_at?: string | null
          cardapioweb_notified?: boolean | null
          cardapioweb_notified_at?: string | null
          cardapioweb_order_id?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          customer_name: string
          customer_phone?: string | null
          delivery_fee?: number | null
          dispatched_at?: string | null
          external_id?: string | null
          foody_error?: string | null
          foody_status?: string | null
          foody_uid?: string | null
          group_id?: string | null
          house_number?: string | null
          id?: string
          is_urgent?: boolean | null
          items?: Json | null
          lat: number
          lng: number
          mixed_origin?: boolean | null
          neighborhood?: string | null
          notes?: string | null
          notification_error?: string | null
          order_type?: string | null
          payment_method?: string | null
          postal_code?: string | null
          ready_at?: string | null
          region?: string | null
          status?: string
          store_id?: string | null
          street?: string | null
          total_amount?: number | null
        }
        Update: {
          address?: string
          all_items_ready?: boolean | null
          cardapioweb_created_at?: string | null
          cardapioweb_notified?: boolean | null
          cardapioweb_notified_at?: string | null
          cardapioweb_order_id?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          customer_name?: string
          customer_phone?: string | null
          delivery_fee?: number | null
          dispatched_at?: string | null
          external_id?: string | null
          foody_error?: string | null
          foody_status?: string | null
          foody_uid?: string | null
          group_id?: string | null
          house_number?: string | null
          id?: string
          is_urgent?: boolean | null
          items?: Json | null
          lat?: number
          lng?: number
          mixed_origin?: boolean | null
          neighborhood?: string | null
          notes?: string | null
          notification_error?: string | null
          order_type?: string | null
          payment_method?: string | null
          postal_code?: string | null
          ready_at?: string | null
          region?: string | null
          status?: string
          store_id?: string | null
          street?: string | null
          total_amount?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "delivery_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      sector_presence: {
        Row: {
          created_at: string
          id: string
          is_online: boolean
          last_seen_at: string
          sector_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_online?: boolean
          last_seen_at?: string
          sector_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_online?: boolean
          last_seen_at?: string
          sector_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sector_presence_sector_id_fkey"
            columns: ["sector_id"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["id"]
          },
        ]
      }
      sectors: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_oven_sector: boolean | null
          name: string
          updated_at: string | null
          view_type: string
          weight_limit: number | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_oven_sector?: boolean | null
          name: string
          updated_at?: string | null
          view_type?: string
          weight_limit?: number | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_oven_sector?: boolean | null
          name?: string
          updated_at?: string | null
          view_type?: string
          weight_limit?: number | null
        }
        Relationships: []
      }
      stores: {
        Row: {
          cardapioweb_api_token: string | null
          cardapioweb_api_url: string | null
          cardapioweb_enabled: boolean | null
          created_at: string
          default_city: string | null
          default_country: string | null
          default_region: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          cardapioweb_api_token?: string | null
          cardapioweb_api_url?: string | null
          cardapioweb_enabled?: boolean | null
          created_at?: string
          default_city?: string | null
          default_country?: string | null
          default_region?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          cardapioweb_api_token?: string | null
          cardapioweb_api_url?: string | null
          cardapioweb_enabled?: boolean | null
          created_at?: string
          default_city?: string | null
          default_country?: string | null
          default_region?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          sector_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          sector_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          sector_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_sector_id_fkey"
            columns: ["sector_id"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_order_completion: { Args: { p_order_id: string }; Returns: boolean }
      claim_order_item: {
        Args: { p_item_id: string; p_user_id: string }
        Returns: Json
      }
      cleanup_stale_presence: { Args: never; Returns: number }
      complete_edge_preparation: {
        Args: { p_item_id: string; p_user_id: string }
        Returns: Json
      }
      create_order_items_from_json: {
        Args: {
          p_default_sector_id?: string
          p_items: Json
          p_order_id: string
        }
        Returns: number
      }
      distribute_unassigned_items: { Args: never; Returns: number }
      get_available_sectors: { Args: never; Returns: string[] }
      get_least_loaded_sector: {
        Args: { p_available_sectors: string[] }
        Returns: string
      }
      get_users_with_roles: {
        Args: never
        Returns: {
          created_at: string
          email: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          sector_id: string
          user_id: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      mark_item_ready: { Args: { p_item_id: string }; Returns: Json }
      mark_order_items_ready: { Args: { p_order_id: string }; Returns: Json }
      mark_order_ready: { Args: { order_id: string }; Returns: undefined }
      redistribute_offline_sector_items: {
        Args: { p_offline_sector_id: string }
        Returns: number
      }
      release_item_claim: {
        Args: { p_item_id: string; p_user_id: string }
        Returns: Json
      }
      remove_sector_presence: {
        Args: { p_sector_id: string; p_user_id: string }
        Returns: undefined
      }
      send_to_oven: {
        Args: {
          p_item_id: string
          p_oven_time_seconds?: number
          p_user_id: string
        }
        Returns: Json
      }
      set_order_dispatched: { Args: { p_order_id: string }; Returns: undefined }
      upsert_sector_presence: {
        Args: { p_sector_id: string; p_user_id: string }
        Returns: undefined
      }
      use_invitation: {
        Args: { invitation_token: string; new_user_id: string }
        Returns: boolean
      }
      validate_invitation_token: {
        Args: { invitation_token: string }
        Returns: {
          email: string
          is_valid: boolean
          role: Database["public"]["Enums"]["app_role"]
        }[]
      }
    }
    Enums: {
      app_role: "owner" | "admin" | "user"
      item_status: "pending" | "in_prep" | "in_oven" | "ready"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["owner", "admin", "user"],
      item_status: ["pending", "in_prep", "in_oven", "ready"],
    },
  },
} as const
