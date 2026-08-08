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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      admin_roles: {
        Row: {
          created_at: string
          description: string
          id: string
          key: string
        }
        Insert: {
          created_at?: string
          description?: string
          id?: string
          key: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          key?: string
        }
        Relationships: []
      }
      admin_users: {
        Row: {
          active: boolean
          created_at: string
          id: string
          role_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          role_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          role_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_users_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "admin_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      bets: {
        Row: {
          amount: number
          auto_cashout_multiplier: number | null
          cashout_at: string | null
          cashout_multiplier: number | null
          created_at: string
          currency: string
          id: string
          kind: Database["public"]["Enums"]["wallet_kind"]
          payout_amount: number | null
          placed_at: string
          round_id: string
          status: Database["public"]["Enums"]["bet_status"]
          updated_at: string
          user_id: string
          wallet_id: string
        }
        Insert: {
          amount: number
          auto_cashout_multiplier?: number | null
          cashout_at?: string | null
          cashout_multiplier?: number | null
          created_at?: string
          currency: string
          id?: string
          kind?: Database["public"]["Enums"]["wallet_kind"]
          payout_amount?: number | null
          placed_at?: string
          round_id: string
          status?: Database["public"]["Enums"]["bet_status"]
          updated_at?: string
          user_id: string
          wallet_id: string
        }
        Update: {
          amount?: number
          auto_cashout_multiplier?: number | null
          cashout_at?: string | null
          cashout_multiplier?: number | null
          created_at?: string
          currency?: string
          id?: string
          kind?: Database["public"]["Enums"]["wallet_kind"]
          payout_amount?: number | null
          placed_at?: string
          round_id?: string
          status?: Database["public"]["Enums"]["bet_status"]
          updated_at?: string
          user_id?: string
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bets_currency_fkey"
            columns: ["currency"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "bets_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "game_rounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bets_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      cashouts: {
        Row: {
          bet_id: string
          currency: string
          id: string
          multiplier: number
          payout_amount: number
          round_id: string
          settled_at: string
          user_id: string
        }
        Insert: {
          bet_id: string
          currency: string
          id?: string
          multiplier: number
          payout_amount: number
          round_id: string
          settled_at?: string
          user_id: string
        }
        Update: {
          bet_id?: string
          currency?: string
          id?: string
          multiplier?: number
          payout_amount?: number
          round_id?: string
          settled_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cashouts_bet_id_fkey"
            columns: ["bet_id"]
            isOneToOne: true
            referencedRelation: "bets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cashouts_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "game_rounds"
            referencedColumns: ["id"]
          },
        ]
      }
      currencies: {
        Row: {
          code: string
          created_at: string
          decimals: number
          display_name: string
          enabled: boolean
          is_crypto: boolean
        }
        Insert: {
          code: string
          created_at?: string
          decimals?: number
          display_name: string
          enabled?: boolean
          is_crypto?: boolean
        }
        Update: {
          code?: string
          created_at?: string
          decimals?: number
          display_name?: string
          enabled?: boolean
          is_crypto?: boolean
        }
        Relationships: []
      }
      currency_networks: {
        Row: {
          created_at: string
          currency_code: string
          enabled: boolean
          id: string
          min_deposit: number
          min_withdrawal: number
          network: string
          required_confirmations: number
        }
        Insert: {
          created_at?: string
          currency_code: string
          enabled?: boolean
          id?: string
          min_deposit?: number
          min_withdrawal?: number
          network: string
          required_confirmations?: number
        }
        Update: {
          created_at?: string
          currency_code?: string
          enabled?: boolean
          id?: string
          min_deposit?: number
          min_withdrawal?: number
          network?: string
          required_confirmations?: number
        }
        Relationships: [
          {
            foreignKeyName: "currency_networks_currency_code_fkey"
            columns: ["currency_code"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
        ]
      }
      game_configurations: {
        Row: {
          active: boolean
          algorithm_version: string
          betting_duration_ms: number
          crash_growth_rate: number
          created_at: string
          created_by: string | null
          house_edge_bps: number
          id: string
          max_bet: number
          max_crash_multiplier: number
          max_exposure: number
          max_payout: number
          min_bet: number
          version: number
        }
        Insert: {
          active?: boolean
          algorithm_version?: string
          betting_duration_ms?: number
          crash_growth_rate?: number
          created_at?: string
          created_by?: string | null
          house_edge_bps?: number
          id?: string
          max_bet: number
          max_crash_multiplier?: number
          max_exposure: number
          max_payout: number
          min_bet: number
          version: number
        }
        Update: {
          active?: boolean
          algorithm_version?: string
          betting_duration_ms?: number
          crash_growth_rate?: number
          created_at?: string
          created_by?: string | null
          house_edge_bps?: number
          id?: string
          max_bet?: number
          max_crash_multiplier?: number
          max_exposure?: number
          max_payout?: number
          min_bet?: number
          version?: number
        }
        Relationships: []
      }
      game_results: {
        Row: {
          crash_multiplier: number
          created_at: string
          id: string
          players: number
          round_id: string
          total_payout: number
          total_wagered: number
        }
        Insert: {
          crash_multiplier: number
          created_at?: string
          id?: string
          players?: number
          round_id: string
          total_payout?: number
          total_wagered?: number
        }
        Update: {
          crash_multiplier?: number
          created_at?: string
          id?: string
          players?: number
          round_id?: string
          total_payout?: number
          total_wagered?: number
        }
        Relationships: [
          {
            foreignKeyName: "game_results_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: true
            referencedRelation: "game_rounds"
            referencedColumns: ["id"]
          },
        ]
      }
      game_rounds: {
        Row: {
          betting_closed_at: string | null
          betting_open_at: string | null
          config_version: number
          crash_multiplier: number | null
          crashed_at: string | null
          created_at: string
          id: string
          round_number: string
          settled_at: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["round_status"]
          total_payout: number
          total_wagered: number
        }
        Insert: {
          betting_closed_at?: string | null
          betting_open_at?: string | null
          config_version: number
          crash_multiplier?: number | null
          crashed_at?: string | null
          created_at?: string
          id?: string
          round_number: string
          settled_at?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["round_status"]
          total_payout?: number
          total_wagered?: number
        }
        Update: {
          betting_closed_at?: string | null
          betting_open_at?: string | null
          config_version?: number
          crash_multiplier?: number | null
          crashed_at?: string | null
          created_at?: string
          id?: string
          round_number?: string
          settled_at?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["round_status"]
          total_payout?: number
          total_wagered?: number
        }
        Relationships: [
          {
            foreignKeyName: "game_rounds_config_version_fkey"
            columns: ["config_version"]
            isOneToOne: false
            referencedRelation: "game_configurations"
            referencedColumns: ["version"]
          },
        ]
      }
      idempotency_keys: {
        Row: {
          completed_at: string | null
          created_at: string
          endpoint: string
          id: string
          idempotency_key: string
          request_hash: string
          response: Json | null
          status: string
          user_id: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          endpoint: string
          id?: string
          idempotency_key: string
          request_hash: string
          response?: Json | null
          status?: string
          user_id?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          endpoint?: string
          id?: string
          idempotency_key?: string
          request_hash?: string
          response?: Json | null
          status?: string
          user_id?: string | null
        }
        Relationships: []
      }
      ledger_accounts: {
        Row: {
          account_type: Database["public"]["Enums"]["ledger_account_type"]
          created_at: string
          currency: string
          id: string
          kind: Database["public"]["Enums"]["wallet_kind"]
          owner_id: string | null
          owner_type: Database["public"]["Enums"]["ledger_owner_type"]
        }
        Insert: {
          account_type: Database["public"]["Enums"]["ledger_account_type"]
          created_at?: string
          currency: string
          id?: string
          kind?: Database["public"]["Enums"]["wallet_kind"]
          owner_id?: string | null
          owner_type: Database["public"]["Enums"]["ledger_owner_type"]
        }
        Update: {
          account_type?: Database["public"]["Enums"]["ledger_account_type"]
          created_at?: string
          currency?: string
          id?: string
          kind?: Database["public"]["Enums"]["wallet_kind"]
          owner_id?: string | null
          owner_type?: Database["public"]["Enums"]["ledger_owner_type"]
        }
        Relationships: [
          {
            foreignKeyName: "ledger_accounts_currency_fkey"
            columns: ["currency"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
        ]
      }
      ledger_entries: {
        Row: {
          account_id: string
          amount: number
          created_at: string
          currency: string
          direction: Database["public"]["Enums"]["ledger_direction"]
          entry_type: string
          id: string
          metadata: Json
          reference_id: string | null
          reference_type: string | null
          transaction_id: string
        }
        Insert: {
          account_id: string
          amount: number
          created_at?: string
          currency: string
          direction: Database["public"]["Enums"]["ledger_direction"]
          entry_type: string
          id?: string
          metadata?: Json
          reference_id?: string | null
          reference_type?: string | null
          transaction_id: string
        }
        Update: {
          account_id?: string
          amount?: number
          created_at?: string
          currency?: string
          direction?: Database["public"]["Enums"]["ledger_direction"]
          entry_type?: string
          id?: string
          metadata?: Json
          reference_id?: string | null
          reference_type?: string | null
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ledger_entries_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "ledger_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_entries_currency_fkey"
            columns: ["currency"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
        ]
      }
      permissions: {
        Row: {
          created_at: string
          description: string
          id: string
          key: string
        }
        Insert: {
          created_at?: string
          description?: string
          id?: string
          key: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          key?: string
        }
        Relationships: []
      }
      provably_fair_secrets: {
        Row: {
          created_at: string
          round_id: string
          server_seed_encrypted: string
        }
        Insert: {
          created_at?: string
          round_id: string
          server_seed_encrypted: string
        }
        Update: {
          created_at?: string
          round_id?: string
          server_seed_encrypted?: string
        }
        Relationships: [
          {
            foreignKeyName: "provably_fair_secrets_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: true
            referencedRelation: "game_rounds"
            referencedColumns: ["id"]
          },
        ]
      }
      provably_fair_seeds: {
        Row: {
          algorithm_version: string
          client_seed: string
          created_at: string
          id: string
          nonce: number
          revealed_at: string | null
          round_id: string
          server_seed_hash: string
          server_seed_revealed: string | null
        }
        Insert: {
          algorithm_version?: string
          client_seed: string
          created_at?: string
          id?: string
          nonce: number
          revealed_at?: string | null
          round_id: string
          server_seed_hash: string
          server_seed_revealed?: string | null
        }
        Update: {
          algorithm_version?: string
          client_seed?: string
          created_at?: string
          id?: string
          nonce?: number
          revealed_at?: string | null
          round_id?: string
          server_seed_hash?: string
          server_seed_revealed?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "provably_fair_seeds_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: true
            referencedRelation: "game_rounds"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          permission_id: string
          role_id: string
        }
        Insert: {
          permission_id: string
          role_id: string
        }
        Update: {
          permission_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "admin_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          address_line_1: string | null
          address_line_2: string | null
          city: string | null
          created_at: string
          first_name: string | null
          id: string
          last_name: string | null
          phone: string | null
          postal_code: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address_line_1?: string | null
          address_line_2?: string | null
          city?: string | null
          created_at?: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          phone?: string | null
          postal_code?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address_line_1?: string | null
          address_line_2?: string | null
          city?: string | null
          created_at?: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          phone?: string | null
          postal_code?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          country_code: string | null
          created_at: string
          date_of_birth: string | null
          demo_mode: boolean
          email: string
          email_verified_at: string | null
          id: string
          last_login_at: string | null
          mfa_enabled: boolean
          phone_verified_at: string | null
          status: Database["public"]["Enums"]["user_status"]
          updated_at: string
        }
        Insert: {
          country_code?: string | null
          created_at?: string
          date_of_birth?: string | null
          demo_mode?: boolean
          email: string
          email_verified_at?: string | null
          id: string
          last_login_at?: string | null
          mfa_enabled?: boolean
          phone_verified_at?: string | null
          status?: Database["public"]["Enums"]["user_status"]
          updated_at?: string
        }
        Update: {
          country_code?: string | null
          created_at?: string
          date_of_birth?: string | null
          demo_mode?: boolean
          email?: string
          email_verified_at?: string | null
          id?: string
          last_login_at?: string | null
          mfa_enabled?: boolean
          phone_verified_at?: string | null
          status?: Database["public"]["Enums"]["user_status"]
          updated_at?: string
        }
        Relationships: []
      }
      wallets: {
        Row: {
          available_amount: number
          created_at: string
          currency: string
          id: string
          kind: Database["public"]["Enums"]["wallet_kind"]
          locked_amount: number
          status: Database["public"]["Enums"]["wallet_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          available_amount?: number
          created_at?: string
          currency: string
          id?: string
          kind?: Database["public"]["Enums"]["wallet_kind"]
          locked_amount?: number
          status?: Database["public"]["Enums"]["wallet_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          available_amount?: number
          created_at?: string
          currency?: string
          id?: string
          kind?: Database["public"]["Enums"]["wallet_kind"]
          locked_amount?: number
          status?: Database["public"]["Enums"]["wallet_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallets_currency_fkey"
            columns: ["currency"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "wallets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_admin_role: {
        Args: { _role: string; _user_id: string }
        Returns: boolean
      }
      has_permission: {
        Args: { _permission: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      bet_status:
        | "PENDING"
        | "ACCEPTED"
        | "ACTIVE"
        | "CASHED_OUT"
        | "LOST"
        | "REFUNDED"
        | "CANCELLED"
      ledger_account_type:
        | "USER_WALLET"
        | "USER_LOCKED"
        | "HOUSE"
        | "BONUS_LIABILITY"
        | "EXTERNAL_PAYMENT"
        | "FEE"
      ledger_direction: "DEBIT" | "CREDIT"
      ledger_owner_type: "USER" | "SYSTEM" | "PROVIDER"
      round_status:
        | "CREATED"
        | "BETTING"
        | "RUNNING"
        | "CRASHED"
        | "SETTLING"
        | "SETTLED"
        | "CANCELLED"
      user_status:
        | "PENDING_VERIFICATION"
        | "ACTIVE"
        | "RESTRICTED"
        | "SUSPENDED"
        | "SELF_EXCLUDED"
        | "CLOSED"
      wallet_kind: "REAL" | "DEMO"
      wallet_status: "ACTIVE" | "FROZEN" | "CLOSED"
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
      bet_status: [
        "PENDING",
        "ACCEPTED",
        "ACTIVE",
        "CASHED_OUT",
        "LOST",
        "REFUNDED",
        "CANCELLED",
      ],
      ledger_account_type: [
        "USER_WALLET",
        "USER_LOCKED",
        "HOUSE",
        "BONUS_LIABILITY",
        "EXTERNAL_PAYMENT",
        "FEE",
      ],
      ledger_direction: ["DEBIT", "CREDIT"],
      ledger_owner_type: ["USER", "SYSTEM", "PROVIDER"],
      round_status: [
        "CREATED",
        "BETTING",
        "RUNNING",
        "CRASHED",
        "SETTLING",
        "SETTLED",
        "CANCELLED",
      ],
      user_status: [
        "PENDING_VERIFICATION",
        "ACTIVE",
        "RESTRICTED",
        "SUSPENDED",
        "SELF_EXCLUDED",
        "CLOSED",
      ],
      wallet_kind: ["REAL", "DEMO"],
      wallet_status: ["ACTIVE", "FROZEN", "CLOSED"],
    },
  },
} as const
