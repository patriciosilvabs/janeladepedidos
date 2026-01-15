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
          foody_api_token: string | null
          foody_api_url: string | null
          foody_enabled: boolean | null
          grouping_radius_km: number | null
          id: string
          max_order_age_hours: number | null
          max_orders_per_group: number | null
          updated_at: string | null
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
          foody_api_token?: string | null
          foody_api_url?: string | null
          foody_enabled?: boolean | null
          grouping_radius_km?: number | null
          id?: string
          max_order_age_hours?: number | null
          max_orders_per_group?: number | null
          updated_at?: string | null
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
          foody_api_token?: string | null
          foody_api_url?: string | null
          foody_enabled?: boolean | null
          grouping_radius_km?: number | null
          id?: string
          max_order_age_hours?: number | null
          max_orders_per_group?: number | null
          updated_at?: string | null
        }
        Relationships: []
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
      orders: {
        Row: {
          address: string
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
          items: Json | null
          lat: number
          lng: number
          neighborhood: string | null
          notes: string | null
          notification_error: string | null
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
          items?: Json | null
          lat: number
          lng: number
          neighborhood?: string | null
          notes?: string | null
          notification_error?: string | null
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
          items?: Json | null
          lat?: number
          lng?: number
          neighborhood?: string | null
          notes?: string | null
          notification_error?: string | null
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
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_users_with_roles: {
        Args: never
        Returns: {
          created_at: string
          email: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
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
    },
  },
} as const
