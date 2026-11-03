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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      dogg_payout_lock: {
        Row: {
          id: number
          locked_until: string
        }
        Insert: {
          id: number
          locked_until?: string
        }
        Update: {
          id?: number
          locked_until?: string
        }
        Relationships: []
      }
      dogg_players: {
        Row: {
          ad_count: number
          ad_day: string | null
          ad_started_at: string | null
          balance: number
          claimed_shifts: number
          created_at: string
          last_checkin: string | null
          last_hold: number | null
          last_hold_at: string | null
          miner_id: string
          rate_changed_at: string | null
          shift_accrued: number
          shift_started_at: string | null
          streak: number
          telegram_id: number
          wallet_address: string | null
          wallet_verified_at: string | null
        }
        Insert: {
          ad_count?: number
          ad_day?: string | null
          ad_started_at?: string | null
          balance?: number
          claimed_shifts?: number
          created_at?: string
          last_checkin?: string | null
          last_hold?: number | null
          last_hold_at?: string | null
          miner_id?: string
          rate_changed_at?: string | null
          shift_accrued?: number
          shift_started_at?: string | null
          streak?: number
          telegram_id: number
          wallet_address?: string | null
          wallet_verified_at?: string | null
        }
        Update: {
          ad_count?: number
          ad_day?: string | null
          ad_started_at?: string | null
          balance?: number
          claimed_shifts?: number
          created_at?: string
          last_checkin?: string | null
          last_hold?: number | null
          last_hold_at?: string | null
          miner_id?: string
          rate_changed_at?: string | null
          shift_accrued?: number
          shift_started_at?: string | null
          streak?: number
          telegram_id?: number
          wallet_address?: string | null
          wallet_verified_at?: string | null
        }
        Relationships: []
      }
      dogg_withdrawals: {
        Row: {
          address: string
          amount: number
          created_at: string
          error: string | null
          fee: number
          id: string
          sent_at: string | null
          seqno: number | null
          status: string
          telegram_id: number
        }
        Insert: {
          address: string
          amount: number
          created_at?: string
          error?: string | null
          fee?: number
          id?: string
          sent_at?: string | null
          seqno?: number | null
          status?: string
          telegram_id: number
        }
        Update: {
          address?: string
          amount?: number
          created_at?: string
          error?: string | null
          fee?: number
          id?: string
          sent_at?: string | null
          seqno?: number | null
          status?: string
          telegram_id?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      dogg_ad: {
        Args: { p_action: string; p_telegram_id: number }
        Returns: Json
      }
      dogg_best_miner: { Args: { p_total: number }; Returns: string }
      dogg_miner_stats: {
        Args: { p_id: string }
        Returns: Record<string, unknown>
      }
      dogg_payout_acquire: { Args: never; Returns: boolean }
      dogg_payout_release: { Args: never; Returns: undefined }
      dogg_shift: {
        Args: { p_action: string; p_hold?: number; p_telegram_id: number }
        Returns: Json
      }
      dogg_withdraw: {
        Args: { p_amount: number; p_telegram_id: number }
        Returns: string
      }
      dogg_withdraw_fail: {
        Args: { p_error: string; p_id: string }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
