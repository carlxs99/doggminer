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
      dogg_ad_views: {
        Row: {
          created_at: string
          estimated_price: number | null
          event_type: string | null
          paid_at: string | null
          postbacks: number
          reward_event_type: string | null
          status: string
          telegram_id: number
          ymid: string
        }
        Insert: {
          created_at?: string
          estimated_price?: number | null
          event_type?: string | null
          paid_at?: string | null
          postbacks?: number
          reward_event_type?: string | null
          status?: string
          telegram_id: number
          ymid?: string
        }
        Update: {
          created_at?: string
          estimated_price?: number | null
          event_type?: string | null
          paid_at?: string | null
          postbacks?: number
          reward_event_type?: string | null
          status?: string
          telegram_id?: number
          ymid?: string
        }
        Relationships: []
      }
      dogg_admin_log: {
        Row: {
          action: string
          admin_id: number
          created_at: string
          details: Json | null
          id: number
        }
        Insert: {
          action: string
          admin_id: number
          created_at?: string
          details?: Json | null
          id?: number
        }
        Update: {
          action?: string
          admin_id?: number
          created_at?: string
          details?: Json | null
          id?: number
        }
        Relationships: []
      }
      dogg_admins: {
        Row: {
          created_at: string
          telegram_id: number
        }
        Insert: {
          created_at?: string
          telegram_id: number
        }
        Update: {
          created_at?: string
          telegram_id?: number
        }
        Relationships: []
      }
      dogg_channel_posts: {
        Row: {
          angle: string | null
          attempts: number
          button_text: string | null
          caption: string | null
          chat: string
          created_at: string
          error: string | null
          image_headline: string | null
          image_scene: string | null
          image_subline: string | null
          kind: string
          lease_until: string | null
          message_id: number | null
          post_index: number | null
          sent_at: string | null
          status: string
          title: string | null
          updated_at: string
          week_key: string
        }
        Insert: {
          angle?: string | null
          attempts?: number
          button_text?: string | null
          caption?: string | null
          chat: string
          created_at?: string
          error?: string | null
          image_headline?: string | null
          image_scene?: string | null
          image_subline?: string | null
          kind?: string
          lease_until?: string | null
          message_id?: number | null
          post_index?: number | null
          sent_at?: string | null
          status?: string
          title?: string | null
          updated_at?: string
          week_key: string
        }
        Update: {
          angle?: string | null
          attempts?: number
          button_text?: string | null
          caption?: string | null
          chat?: string
          created_at?: string
          error?: string | null
          image_headline?: string | null
          image_scene?: string | null
          image_subline?: string | null
          kind?: string
          lease_until?: string | null
          message_id?: number | null
          post_index?: number | null
          sent_at?: string | null
          status?: string
          title?: string | null
          updated_at?: string
          week_key?: string
        }
        Relationships: []
      }
      dogg_ledger: {
        Row: {
          amount: number
          created_at: string
          id: number
          kind: string
          label: string
          ref: string | null
          telegram_id: number
        }
        Insert: {
          amount: number
          created_at?: string
          id?: number
          kind: string
          label: string
          ref?: string | null
          telegram_id: number
        }
        Update: {
          amount?: number
          created_at?: string
          id?: number
          kind?: string
          label?: string
          ref?: string | null
          telegram_id?: number
        }
        Relationships: []
      }
      dogg_multi_reviews: {
        Row: {
          admin_id: number
          note: string | null
          score: number
          status: string
          telegram_id: number
          updated_at: string
        }
        Insert: {
          admin_id: number
          note?: string | null
          score?: number
          status: string
          telegram_id: number
          updated_at?: string
        }
        Update: {
          admin_id?: number
          note?: string | null
          score?: number
          status?: string
          telegram_id?: number
          updated_at?: string
        }
        Relationships: []
      }
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
          bot_blocked_at: string | null
          claimed_shifts: number
          created_at: string
          first_name: string | null
          last_checkin: string | null
          last_hold: number | null
          last_hold_at: string | null
          miner_id: string
          multi_alerted_at: string | null
          rate_changed_at: string | null
          ref_earned: number
          ref_given: number
          ref_join_notified_at: string | null
          ref_pending: number
          ref_qualified_notified_at: string | null
          referral_qualified_at: string | null
          referred_by: number | null
          reminder_sent_at: string | null
          reminders_off: boolean
          shift_accrued: number
          shift_started_at: string | null
          streak: number
          telegram_id: number
          username: string | null
          wallet_address: string | null
          wallet_verified_at: string | null
          withdraw_verified_amount: number | null
          withdraw_verified_at: string | null
          withdraw_verified_wallet: string | null
        }
        Insert: {
          ad_count?: number
          ad_day?: string | null
          ad_started_at?: string | null
          balance?: number
          bot_blocked_at?: string | null
          claimed_shifts?: number
          created_at?: string
          first_name?: string | null
          last_checkin?: string | null
          last_hold?: number | null
          last_hold_at?: string | null
          miner_id?: string
          multi_alerted_at?: string | null
          rate_changed_at?: string | null
          ref_earned?: number
          ref_given?: number
          ref_join_notified_at?: string | null
          ref_pending?: number
          ref_qualified_notified_at?: string | null
          referral_qualified_at?: string | null
          referred_by?: number | null
          reminder_sent_at?: string | null
          reminders_off?: boolean
          shift_accrued?: number
          shift_started_at?: string | null
          streak?: number
          telegram_id: number
          username?: string | null
          wallet_address?: string | null
          wallet_verified_at?: string | null
          withdraw_verified_amount?: number | null
          withdraw_verified_at?: string | null
          withdraw_verified_wallet?: string | null
        }
        Update: {
          ad_count?: number
          ad_day?: string | null
          ad_started_at?: string | null
          balance?: number
          bot_blocked_at?: string | null
          claimed_shifts?: number
          created_at?: string
          first_name?: string | null
          last_checkin?: string | null
          last_hold?: number | null
          last_hold_at?: string | null
          miner_id?: string
          multi_alerted_at?: string | null
          rate_changed_at?: string | null
          ref_earned?: number
          ref_given?: number
          ref_join_notified_at?: string | null
          ref_pending?: number
          ref_qualified_notified_at?: string | null
          referral_qualified_at?: string | null
          referred_by?: number | null
          reminder_sent_at?: string | null
          reminders_off?: boolean
          shift_accrued?: number
          shift_started_at?: string | null
          streak?: number
          telegram_id?: number
          username?: string | null
          wallet_address?: string | null
          wallet_verified_at?: string | null
          withdraw_verified_amount?: number | null
          withdraw_verified_at?: string | null
          withdraw_verified_wallet?: string | null
        }
        Relationships: []
      }
      dogg_referral_wallets: {
        Row: {
          created_at: string
          referrer_id: number
          telegram_id: number
          wallet_address: string
        }
        Insert: {
          created_at?: string
          referrer_id: number
          telegram_id: number
          wallet_address: string
        }
        Update: {
          created_at?: string
          referrer_id?: number
          telegram_id?: number
          wallet_address?: string
        }
        Relationships: []
      }
      dogg_signals: {
        Row: {
          country: string | null
          first_seen: string
          hits: number
          kind: string
          last_seen: string
          telegram_id: number
          value: string
        }
        Insert: {
          country?: string | null
          first_seen?: string
          hits?: number
          kind: string
          last_seen?: string
          telegram_id: number
          value: string
        }
        Update: {
          country?: string | null
          first_seen?: string
          hits?: number
          kind?: string
          last_seen?: string
          telegram_id?: number
          value?: string
        }
        Relationships: []
      }
      dogg_task_claims: {
        Row: {
          claimed_at: string | null
          reward: number | null
          started_at: string
          task_id: string
          telegram_id: number
        }
        Insert: {
          claimed_at?: string | null
          reward?: number | null
          started_at?: string
          task_id: string
          telegram_id: number
        }
        Update: {
          claimed_at?: string | null
          reward?: number | null
          started_at?: string
          task_id?: string
          telegram_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "dogg_task_claims_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "dogg_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      dogg_tasks: {
        Row: {
          active: boolean
          chat_id: string | null
          claims: number
          created_at: string
          created_by: number | null
          description: string | null
          id: string
          kind: string
          reward: number
          sort: number
          title: string
          updated_at: string
          url: string
        }
        Insert: {
          active?: boolean
          chat_id?: string | null
          claims?: number
          created_at?: string
          created_by?: number | null
          description?: string | null
          id?: string
          kind: string
          reward: number
          sort?: number
          title: string
          updated_at?: string
          url: string
        }
        Update: {
          active?: boolean
          chat_id?: string | null
          claims?: number
          created_at?: string
          created_by?: number | null
          description?: string | null
          id?: string
          kind?: string
          reward?: number
          sort?: number
          title?: string
          updated_at?: string
          url?: string
        }
        Relationships: []
      }
      dogg_wallet_links: {
        Row: {
          first_at: string
          telegram_id: number
          wallet_address: string
        }
        Insert: {
          first_at?: string
          telegram_id: number
          wallet_address: string
        }
        Update: {
          first_at?: string
          telegram_id?: number
          wallet_address?: string
        }
        Relationships: []
      }
      dogg_withdrawals: {
        Row: {
          address: string
          amount: number
          attempted_at: string | null
          attempts: number
          channel_notified_at: string | null
          created_at: string
          error: string | null
          fee: number
          id: string
          notified_at: string | null
          query_id: string | null
          sent_at: string | null
          seqno: number | null
          status: string
          telegram_id: number
          tx_hash: string | null
        }
        Insert: {
          address: string
          amount: number
          attempted_at?: string | null
          attempts?: number
          channel_notified_at?: string | null
          created_at?: string
          error?: string | null
          fee?: number
          id?: string
          notified_at?: string | null
          query_id?: string | null
          sent_at?: string | null
          seqno?: number | null
          status?: string
          telegram_id: number
          tx_hash?: string | null
        }
        Update: {
          address?: string
          amount?: number
          attempted_at?: string | null
          attempts?: number
          channel_notified_at?: string | null
          created_at?: string
          error?: string | null
          fee?: number
          id?: string
          notified_at?: string | null
          query_id?: string | null
          sent_at?: string | null
          seqno?: number | null
          status?: string
          telegram_id?: number
          tx_hash?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      dogg_ad: {
        Args: { p_action: string; p_telegram_id: number; p_ymid?: string }
        Returns: Json
      }
      dogg_ad_postback: {
        Args: {
          p_event: string
          p_price: number
          p_reward: string
          p_telegram_id: number
          p_ymid: string
        }
        Returns: string
      }
      dogg_admin_adjust: {
        Args: {
          p_admin: number
          p_delta: number
          p_reason: string
          p_telegram_id: number
        }
        Returns: number
      }
      dogg_admin_stats: { Args: never; Returns: Json }
      dogg_best_miner: { Args: { p_total: number }; Returns: string }
      dogg_claim_reminders: {
        Args: { p_limit: number }
        Returns: {
          ad_count: number
          ad_day: string | null
          ad_started_at: string | null
          balance: number
          bot_blocked_at: string | null
          claimed_shifts: number
          created_at: string
          first_name: string | null
          last_checkin: string | null
          last_hold: number | null
          last_hold_at: string | null
          miner_id: string
          multi_alerted_at: string | null
          rate_changed_at: string | null
          ref_earned: number
          ref_given: number
          ref_join_notified_at: string | null
          ref_pending: number
          ref_qualified_notified_at: string | null
          referral_qualified_at: string | null
          referred_by: number | null
          reminder_sent_at: string | null
          reminders_off: boolean
          shift_accrued: number
          shift_started_at: string | null
          streak: number
          telegram_id: number
          username: string | null
          wallet_address: string | null
          wallet_verified_at: string | null
          withdraw_verified_amount: number | null
          withdraw_verified_at: string | null
          withdraw_verified_wallet: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "dogg_players"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      dogg_miner_stats: {
        Args: { p_id: string }
        Returns: Record<string, unknown>
      }
      dogg_multi_peers: {
        Args: { p_telegram_id: number }
        Returns: {
          kind: string
          peer: number
        }[]
      }
      dogg_multi_report: { Args: { p_min_score?: number }; Returns: Json }
      dogg_multi_score: { Args: { p_telegram_id: number }; Returns: Json }
      dogg_payout_acquire: { Args: never; Returns: boolean }
      dogg_payout_release: { Args: never; Returns: undefined }
      dogg_record_signals: {
        Args: { p_country: string; p_signals: Json; p_telegram_id: number }
        Returns: Json
      }
      dogg_referral: {
        Args: { p_action: string; p_telegram_id: number }
        Returns: Json
      }
      dogg_referral_qualify: {
        Args: { p_telegram_id: number }
        Returns: boolean
      }
      dogg_register: {
        Args: {
          p_first_name: string
          p_referrer: number
          p_telegram_id: number
          p_username: string
        }
        Returns: undefined
      }
      dogg_shift: {
        Args: { p_action: string; p_hold?: number; p_telegram_id: number }
        Returns: Json
      }
      dogg_task_claim: {
        Args: { p_member: boolean; p_task: string; p_telegram_id: number }
        Returns: Json
      }
      dogg_task_start: {
        Args: { p_task: string; p_telegram_id: number }
        Returns: string
      }
      dogg_verify_withdraw: {
        Args: { p_bought: number; p_telegram_id: number; p_wallet: string }
        Returns: boolean
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
