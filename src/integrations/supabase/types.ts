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
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          actor_role: string | null
          created_at: string
          id: string
          ip_address: unknown
          metadata: Json
          resource_id: string | null
          resource_type: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_role?: string | null
          created_at?: string
          id?: string
          ip_address?: unknown
          metadata?: Json
          resource_id?: string | null
          resource_type?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_role?: string | null
          created_at?: string
          id?: string
          ip_address?: unknown
          metadata?: Json
          resource_id?: string | null
          resource_type?: string | null
          user_agent?: string | null
        }
        Relationships: []
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
      bonus_campaigns: {
        Row: {
          active: boolean
          bonus_type: string
          code: string
          created_at: string
          currency: string | null
          eligibility: Json
          expires_at: string | null
          id: string
          match_percent: number | null
          max_bonus_amount: number | null
          min_deposit: number | null
          name: string
          starts_at: string | null
          terms_summary: string
          terms_url: string | null
          updated_at: string
          wagering_multiplier: number
        }
        Insert: {
          active?: boolean
          bonus_type: string
          code: string
          created_at?: string
          currency?: string | null
          eligibility?: Json
          expires_at?: string | null
          id?: string
          match_percent?: number | null
          max_bonus_amount?: number | null
          min_deposit?: number | null
          name: string
          starts_at?: string | null
          terms_summary?: string
          terms_url?: string | null
          updated_at?: string
          wagering_multiplier?: number
        }
        Update: {
          active?: boolean
          bonus_type?: string
          code?: string
          created_at?: string
          currency?: string | null
          eligibility?: Json
          expires_at?: string | null
          id?: string
          match_percent?: number | null
          max_bonus_amount?: number | null
          min_deposit?: number | null
          name?: string
          starts_at?: string | null
          terms_summary?: string
          terms_url?: string | null
          updated_at?: string
          wagering_multiplier?: number
        }
        Relationships: [
          {
            foreignKeyName: "bonus_campaigns_currency_fkey"
            columns: ["currency"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
        ]
      }
      bonus_transactions: {
        Row: {
          amount: number
          campaign_id: string | null
          created_at: string
          currency: string
          expires_at: string | null
          id: string
          status: string
          updated_at: string
          user_id: string
          wagering_completed: number
          wagering_required: number
        }
        Insert: {
          amount: number
          campaign_id?: string | null
          created_at?: string
          currency: string
          expires_at?: string | null
          id?: string
          status?: string
          updated_at?: string
          user_id: string
          wagering_completed?: number
          wagering_required?: number
        }
        Update: {
          amount?: number
          campaign_id?: string | null
          created_at?: string
          currency?: string
          expires_at?: string | null
          id?: string
          status?: string
          updated_at?: string
          user_id?: string
          wagering_completed?: number
          wagering_required?: number
        }
        Relationships: [
          {
            foreignKeyName: "bonus_transactions_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "bonus_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bonus_transactions_currency_fkey"
            columns: ["currency"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "bonus_transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
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
      deposits: {
        Row: {
          confirmations: number
          confirmed_amount: number | null
          confirmed_at: string | null
          created_at: string
          credited_transaction_id: string | null
          currency: string
          deposit_address: string | null
          id: string
          metadata: Json
          network: string
          provider: string
          provider_transaction_id: string | null
          requested_amount: number | null
          required_confirmations: number
          status: Database["public"]["Enums"]["deposit_status"]
          updated_at: string
          user_id: string
          wallet_id: string | null
        }
        Insert: {
          confirmations?: number
          confirmed_amount?: number | null
          confirmed_at?: string | null
          created_at?: string
          credited_transaction_id?: string | null
          currency: string
          deposit_address?: string | null
          id?: string
          metadata?: Json
          network: string
          provider: string
          provider_transaction_id?: string | null
          requested_amount?: number | null
          required_confirmations?: number
          status?: Database["public"]["Enums"]["deposit_status"]
          updated_at?: string
          user_id: string
          wallet_id?: string | null
        }
        Update: {
          confirmations?: number
          confirmed_amount?: number | null
          confirmed_at?: string | null
          created_at?: string
          credited_transaction_id?: string | null
          currency?: string
          deposit_address?: string | null
          id?: string
          metadata?: Json
          network?: string
          provider?: string
          provider_transaction_id?: string | null
          requested_amount?: number | null
          required_confirmations?: number
          status?: Database["public"]["Enums"]["deposit_status"]
          updated_at?: string
          user_id?: string
          wallet_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deposits_currency_fkey"
            columns: ["currency"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "deposits_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deposits_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
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
      jurisdictions: {
        Row: {
          country_code: string
          licence_reference: string | null
          min_age: number
          name: string
          notes: string | null
          status: Database["public"]["Enums"]["jurisdiction_status"]
          updated_at: string
        }
        Insert: {
          country_code: string
          licence_reference?: string | null
          min_age?: number
          name: string
          notes?: string | null
          status?: Database["public"]["Enums"]["jurisdiction_status"]
          updated_at?: string
        }
        Update: {
          country_code?: string
          licence_reference?: string | null
          min_age?: number
          name?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["jurisdiction_status"]
          updated_at?: string
        }
        Relationships: []
      }
      kyc_cases: {
        Row: {
          created_at: string
          id: string
          provider: string
          provider_case_id: string | null
          rejection_reason: string | null
          reviewed_at: string | null
          reviewer_id: string | null
          risk_level: Database["public"]["Enums"]["risk_status"]
          status: Database["public"]["Enums"]["kyc_status"]
          submitted_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          provider: string
          provider_case_id?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewer_id?: string | null
          risk_level?: Database["public"]["Enums"]["risk_status"]
          status?: Database["public"]["Enums"]["kyc_status"]
          submitted_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          provider?: string
          provider_case_id?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewer_id?: string | null
          risk_level?: Database["public"]["Enums"]["risk_status"]
          status?: Database["public"]["Enums"]["kyc_status"]
          submitted_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kyc_cases_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      kyc_documents: {
        Row: {
          created_at: string
          doc_type: string
          file_name: string
          id: string
          kyc_case_id: string | null
          mime_type: string
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          size_bytes: number
          status: string
          storage_path: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          doc_type: string
          file_name: string
          id?: string
          kyc_case_id?: string | null
          mime_type: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          size_bytes: number
          status?: string
          storage_path: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          doc_type?: string
          file_name?: string
          id?: string
          kyc_case_id?: string | null
          mime_type?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          size_bytes?: number
          status?: string
          storage_path?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kyc_documents_kyc_case_id_fkey"
            columns: ["kyc_case_id"]
            isOneToOne: false
            referencedRelation: "kyc_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kyc_documents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
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
      manual_deposit_requests: {
        Row: {
          amount: number
          created_at: string
          credited_deposit_id: string | null
          currency: string
          id: string
          method: string
          proof_name: string | null
          proof_path: string | null
          reference: string | null
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          sender_number: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          credited_deposit_id?: string | null
          currency: string
          id?: string
          method: string
          proof_name?: string | null
          proof_path?: string | null
          reference?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          sender_number: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          credited_deposit_id?: string | null
          currency?: string
          id?: string
          method?: string
          proof_name?: string | null
          proof_path?: string | null
          reference?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          sender_number?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "manual_deposit_requests_credited_deposit_id_fkey"
            columns: ["credited_deposit_id"]
            isOneToOne: false
            referencedRelation: "deposits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manual_deposit_requests_currency_fkey"
            columns: ["currency"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "manual_deposit_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          event_type: string
          id: string
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string
          created_at?: string
          event_type: string
          id?: string
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          event_type?: string
          id?: string
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_transactions: {
        Row: {
          created_at: string
          direction: string
          id: string
          payload: Json
          processed_at: string | null
          provider: string
          provider_event_id: string
          reference_id: string | null
          reference_type: string | null
          signature_verified: boolean
        }
        Insert: {
          created_at?: string
          direction: string
          id?: string
          payload: Json
          processed_at?: string | null
          provider: string
          provider_event_id: string
          reference_id?: string | null
          reference_type?: string | null
          signature_verified?: boolean
        }
        Update: {
          created_at?: string
          direction?: string
          id?: string
          payload?: Json
          processed_at?: string | null
          provider?: string
          provider_event_id?: string
          reference_id?: string | null
          reference_type?: string | null
          signature_verified?: boolean
        }
        Relationships: []
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
      platform_settings: {
        Row: {
          house_edge_note: string
          id: boolean
          logo_url: string | null
          maintenance_mode: boolean
          site_name: string
          support_email: string
          tagline: string
          updated_at: string
        }
        Insert: {
          house_edge_note?: string
          id?: boolean
          logo_url?: string | null
          maintenance_mode?: boolean
          site_name?: string
          support_email?: string
          tagline?: string
          updated_at?: string
        }
        Update: {
          house_edge_note?: string
          id?: boolean
          logo_url?: string | null
          maintenance_mode?: boolean
          site_name?: string
          support_email?: string
          tagline?: string
          updated_at?: string
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
      rate_limits: {
        Row: {
          bucket_key: string
          hits: number
          updated_at: string
          window_started_at: string
        }
        Insert: {
          bucket_key: string
          hits?: number
          updated_at?: string
          window_started_at?: string
        }
        Update: {
          bucket_key?: string
          hits?: number
          updated_at?: string
          window_started_at?: string
        }
        Relationships: []
      }
      responsible_gambling_events: {
        Row: {
          created_at: string
          effective_at: string
          event_type: string
          id: string
          new_value: Json | null
          previous_value: Json | null
          user_id: string
        }
        Insert: {
          created_at?: string
          effective_at?: string
          event_type: string
          id?: string
          new_value?: Json | null
          previous_value?: Json | null
          user_id: string
        }
        Update: {
          created_at?: string
          effective_at?: string
          event_type?: string
          id?: string
          new_value?: Json | null
          previous_value?: Json | null
          user_id?: string
        }
        Relationships: []
      }
      responsible_gambling_limits: {
        Row: {
          cooling_off_until: string | null
          created_at: string
          deposit_daily_limit: number | null
          deposit_monthly_limit: number | null
          deposit_weekly_limit: number | null
          id: string
          loss_daily_limit: number | null
          loss_monthly_limit: number | null
          loss_weekly_limit: number | null
          self_exclusion_until: string | null
          session_limit_minutes: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          cooling_off_until?: string | null
          created_at?: string
          deposit_daily_limit?: number | null
          deposit_monthly_limit?: number | null
          deposit_weekly_limit?: number | null
          id?: string
          loss_daily_limit?: number | null
          loss_monthly_limit?: number | null
          loss_weekly_limit?: number | null
          self_exclusion_until?: string | null
          session_limit_minutes?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          cooling_off_until?: string | null
          created_at?: string
          deposit_daily_limit?: number | null
          deposit_monthly_limit?: number | null
          deposit_weekly_limit?: number | null
          id?: string
          loss_daily_limit?: number | null
          loss_monthly_limit?: number | null
          loss_weekly_limit?: number | null
          self_exclusion_until?: string | null
          session_limit_minutes?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "responsible_gambling_limits_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      risk_events: {
        Row: {
          created_at: string
          description: string | null
          event_type: string
          id: string
          metadata: Json
          resolved_at: string | null
          resolved_by: string | null
          risk_score: number
          severity: Database["public"]["Enums"]["risk_status"]
          source: string
          status: Database["public"]["Enums"]["risk_event_status"]
          user_id: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          event_type: string
          id?: string
          metadata?: Json
          resolved_at?: string | null
          resolved_by?: string | null
          risk_score?: number
          severity?: Database["public"]["Enums"]["risk_status"]
          source?: string
          status?: Database["public"]["Enums"]["risk_event_status"]
          user_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          event_type?: string
          id?: string
          metadata?: Json
          resolved_at?: string | null
          resolved_by?: string | null
          risk_score?: number
          severity?: Database["public"]["Enums"]["risk_status"]
          source?: string
          status?: Database["public"]["Enums"]["risk_event_status"]
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "risk_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
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
      support_messages: {
        Row: {
          author_id: string
          author_type: string
          body: string
          created_at: string
          id: string
          internal_note: boolean
          ticket_id: string
        }
        Insert: {
          author_id: string
          author_type?: string
          body: string
          created_at?: string
          id?: string
          internal_note?: boolean
          ticket_id: string
        }
        Update: {
          author_id?: string
          author_type?: string
          body?: string
          created_at?: string
          id?: string
          internal_note?: boolean
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          assigned_to: string | null
          category: string
          created_at: string
          id: string
          priority: string
          reference: string
          status: Database["public"]["Enums"]["ticket_status"]
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assigned_to?: string | null
          category: string
          created_at?: string
          id?: string
          priority?: string
          reference?: string
          status?: Database["public"]["Enums"]["ticket_status"]
          subject: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assigned_to?: string | null
          category?: string
          created_at?: string
          id?: string
          priority?: string
          reference?: string
          status?: Database["public"]["Enums"]["ticket_status"]
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
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
      user_sessions: {
        Row: {
          created_at: string
          device_label: string | null
          id: string
          ip_address: unknown
          last_seen_at: string
          revoked_at: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          device_label?: string | null
          id?: string
          ip_address?: unknown
          last_seen_at?: string
          revoked_at?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          device_label?: string | null
          id?: string
          ip_address?: unknown
          last_seen_at?: string
          revoked_at?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          account_number: string | null
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
          account_number?: string | null
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
          account_number?: string | null
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
      withdrawal_approvals: {
        Row: {
          approver_id: string
          created_at: string
          decision: string
          id: string
          note: string | null
          withdrawal_id: string
        }
        Insert: {
          approver_id: string
          created_at?: string
          decision: string
          id?: string
          note?: string | null
          withdrawal_id: string
        }
        Update: {
          approver_id?: string
          created_at?: string
          decision?: string
          id?: string
          note?: string | null
          withdrawal_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "withdrawal_approvals_withdrawal_id_fkey"
            columns: ["withdrawal_id"]
            isOneToOne: false
            referencedRelation: "withdrawals"
            referencedColumns: ["id"]
          },
        ]
      }
      withdrawals: {
        Row: {
          amount: number
          approvals_count: number
          approvals_required: number
          approved_at: string | null
          completed_at: string | null
          currency: string
          destination_address: string
          failure_reason: string | null
          fee_amount: number
          id: string
          metadata: Json
          network: string
          processed_at: string | null
          provider: string | null
          provider_transaction_id: string | null
          rejected_at: string | null
          requested_at: string
          risk_status: Database["public"]["Enums"]["risk_status"]
          status: Database["public"]["Enums"]["withdrawal_status"]
          updated_at: string
          user_id: string
          wallet_id: string
        }
        Insert: {
          amount: number
          approvals_count?: number
          approvals_required?: number
          approved_at?: string | null
          completed_at?: string | null
          currency: string
          destination_address: string
          failure_reason?: string | null
          fee_amount?: number
          id?: string
          metadata?: Json
          network: string
          processed_at?: string | null
          provider?: string | null
          provider_transaction_id?: string | null
          rejected_at?: string | null
          requested_at?: string
          risk_status?: Database["public"]["Enums"]["risk_status"]
          status?: Database["public"]["Enums"]["withdrawal_status"]
          updated_at?: string
          user_id: string
          wallet_id: string
        }
        Update: {
          amount?: number
          approvals_count?: number
          approvals_required?: number
          approved_at?: string | null
          completed_at?: string | null
          currency?: string
          destination_address?: string
          failure_reason?: string | null
          fee_amount?: number
          id?: string
          metadata?: Json
          network?: string
          processed_at?: string | null
          provider?: string | null
          provider_transaction_id?: string | null
          rejected_at?: string | null
          requested_at?: string
          risk_status?: Database["public"]["Enums"]["risk_status"]
          status?: Database["public"]["Enums"]["withdrawal_status"]
          updated_at?: string
          user_id?: string
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "withdrawals_currency_fkey"
            columns: ["currency"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "withdrawals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "withdrawals_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_bootstrap_super_admin: {
        Args: { _user_id: string }
        Returns: string
      }
      ensure_ledger_account: {
        Args: {
          _account_type: Database["public"]["Enums"]["ledger_account_type"]
          _currency: string
          _kind: Database["public"]["Enums"]["wallet_kind"]
          _owner_id: string
          _owner_type: Database["public"]["Enums"]["ledger_owner_type"]
        }
        Returns: string
      }
      game_cancel_round: { Args: { _round_id: string }; Returns: Json }
      game_cash_out: {
        Args: { _bet_id: string; _multiplier: number; _user_id: string }
        Returns: Json
      }
      game_place_bet: {
        Args: {
          _amount: number
          _auto_cashout?: number
          _round_id: string
          _user_id: string
        }
        Returns: string
      }
      game_settle_round: { Args: { _round_id: string }; Returns: Json }
      generate_account_number: { Args: never; Returns: string }
      get_public_game_config: {
        Args: never
        Returns: {
          max_bet: number
          max_crash_multiplier: number
          min_bet: number
        }[]
      }
      has_admin_role: {
        Args: { _role: string; _user_id: string }
        Returns: boolean
      }
      has_permission: {
        Args: { _permission: string; _user_id: string }
        Returns: boolean
      }
      move_wallet_lock: {
        Args: {
          _amount: number
          _entry_type: string
          _lock: boolean
          _reference_id?: string
          _reference_type?: string
          _wallet_id: string
        }
        Returns: string
      }
      post_wallet_transaction: {
        Args: {
          _amount: number
          _counter_account_type?: Database["public"]["Enums"]["ledger_account_type"]
          _direction: Database["public"]["Enums"]["ledger_direction"]
          _entry_type: string
          _metadata?: Json
          _reference_id?: string
          _reference_type?: string
          _wallet_id: string
        }
        Returns: string
      }
      rl_consume: {
        Args: { _key: string; _limit: number; _window_seconds: number }
        Returns: {
          allowed: boolean
          remaining: number
          retry_after_seconds: number
        }[]
      }
      wallet_ledger_drift: {
        Args: never
        Returns: {
          currency: string
          drift: number
          ledger_total: number
          user_id: string
          wallet_id: string
          wallet_total: number
        }[]
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
      deposit_status:
        | "CREATED"
        | "PENDING"
        | "CONFIRMING"
        | "CONFIRMED"
        | "FAILED"
        | "EXPIRED"
        | "CANCELLED"
      jurisdiction_status: "ALLOWED" | "REVIEW" | "BLOCKED"
      kyc_status:
        | "NOT_STARTED"
        | "PENDING"
        | "APPROVED"
        | "REJECTED"
        | "REQUIRES_INFORMATION"
      ledger_account_type:
        | "USER_WALLET"
        | "USER_LOCKED"
        | "HOUSE"
        | "BONUS_LIABILITY"
        | "EXTERNAL_PAYMENT"
        | "FEE"
      ledger_direction: "DEBIT" | "CREDIT"
      ledger_owner_type: "USER" | "SYSTEM" | "PROVIDER"
      risk_event_status:
        | "OPEN"
        | "IN_REVIEW"
        | "ESCALATED"
        | "RESOLVED"
        | "DISMISSED"
      risk_status: "LOW" | "MEDIUM" | "HIGH" | "REVIEW_REQUIRED"
      round_status:
        | "CREATED"
        | "BETTING"
        | "RUNNING"
        | "CRASHED"
        | "SETTLING"
        | "SETTLED"
        | "CANCELLED"
      ticket_status:
        | "OPEN"
        | "PENDING_USER"
        | "ESCALATED"
        | "RESOLVED"
        | "CLOSED"
      user_status:
        | "PENDING_VERIFICATION"
        | "ACTIVE"
        | "RESTRICTED"
        | "SUSPENDED"
        | "SELF_EXCLUDED"
        | "CLOSED"
      wallet_kind: "REAL" | "DEMO"
      wallet_status: "ACTIVE" | "FROZEN" | "CLOSED"
      withdrawal_status:
        | "REQUESTED"
        | "RISK_REVIEW"
        | "APPROVED"
        | "PROCESSING"
        | "BROADCAST"
        | "CONFIRMED"
        | "REJECTED"
        | "FAILED"
        | "CANCELLED"
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
      deposit_status: [
        "CREATED",
        "PENDING",
        "CONFIRMING",
        "CONFIRMED",
        "FAILED",
        "EXPIRED",
        "CANCELLED",
      ],
      jurisdiction_status: ["ALLOWED", "REVIEW", "BLOCKED"],
      kyc_status: [
        "NOT_STARTED",
        "PENDING",
        "APPROVED",
        "REJECTED",
        "REQUIRES_INFORMATION",
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
      risk_event_status: [
        "OPEN",
        "IN_REVIEW",
        "ESCALATED",
        "RESOLVED",
        "DISMISSED",
      ],
      risk_status: ["LOW", "MEDIUM", "HIGH", "REVIEW_REQUIRED"],
      round_status: [
        "CREATED",
        "BETTING",
        "RUNNING",
        "CRASHED",
        "SETTLING",
        "SETTLED",
        "CANCELLED",
      ],
      ticket_status: [
        "OPEN",
        "PENDING_USER",
        "ESCALATED",
        "RESOLVED",
        "CLOSED",
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
      withdrawal_status: [
        "REQUESTED",
        "RISK_REVIEW",
        "APPROVED",
        "PROCESSING",
        "BROADCAST",
        "CONFIRMED",
        "REJECTED",
        "FAILED",
        "CANCELLED",
      ],
    },
  },
} as const
