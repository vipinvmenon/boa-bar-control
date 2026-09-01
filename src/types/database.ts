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
    PostgrestVersion: "14.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      boa_bar_count_line: {
        Row: {
          count_session_id: string
          evidence: Json
          full_containers: number
          gross_weight_g: number | null
          id: string
          partial_ml: number
          sku_id: string
        }
        Insert: {
          count_session_id: string
          evidence?: Json
          full_containers?: number
          gross_weight_g?: number | null
          id?: string
          partial_ml?: number
          sku_id: string
        }
        Update: {
          count_session_id?: string
          evidence?: Json
          full_containers?: number
          gross_weight_g?: number | null
          id?: string
          partial_ml?: number
          sku_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "boa_bar_count_line_count_session_id_fkey"
            columns: ["count_session_id"]
            isOneToOne: false
            referencedRelation: "boa_bar_count_session"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "boa_bar_count_line_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "boa_bar_sku"
            referencedColumns: ["id"]
          },
        ]
      }
      boa_bar_count_session: {
        Row: {
          assigned_to: string
          business_date: string | null
          count_kind: string
          created_at: string
          id: string
          idempotency_key: string | null
          location_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["boa_bar_count_status"]
          submitted_at: string | null
          supersede_reason: string | null
          superseded_by_session_id: string | null
          supersedes_session_id: string | null
          venue_id: string
        }
        Insert: {
          assigned_to: string
          business_date?: string | null
          count_kind: string
          created_at?: string
          id?: string
          idempotency_key?: string | null
          location_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["boa_bar_count_status"]
          submitted_at?: string | null
          supersede_reason?: string | null
          superseded_by_session_id?: string | null
          supersedes_session_id?: string | null
          venue_id: string
        }
        Update: {
          assigned_to?: string
          business_date?: string | null
          count_kind?: string
          created_at?: string
          id?: string
          idempotency_key?: string | null
          location_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["boa_bar_count_status"]
          submitted_at?: string | null
          supersede_reason?: string | null
          superseded_by_session_id?: string | null
          supersedes_session_id?: string | null
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "boa_bar_count_session_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "boa_bar_location"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "boa_bar_count_session_superseded_by_session_id_fkey"
            columns: ["superseded_by_session_id"]
            isOneToOne: false
            referencedRelation: "boa_bar_count_session"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "boa_bar_count_session_supersedes_session_id_fkey"
            columns: ["supersedes_session_id"]
            isOneToOne: false
            referencedRelation: "boa_bar_count_session"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "boa_bar_count_session_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "boa_bar_venue"
            referencedColumns: ["id"]
          },
        ]
      }
      boa_bar_docket: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          difference_reason: string | null
          docket_no: string
          from_location_id: string
          id: string
          issued_at: string
          issued_by: string
          status: Database["public"]["Enums"]["boa_bar_docket_status"]
          to_location_id: string
          token_expires_at: string
          token_hash: string
          venue_id: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          difference_reason?: string | null
          docket_no: string
          from_location_id: string
          id?: string
          issued_at?: string
          issued_by: string
          status?: Database["public"]["Enums"]["boa_bar_docket_status"]
          to_location_id: string
          token_expires_at: string
          token_hash: string
          venue_id: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          difference_reason?: string | null
          docket_no?: string
          from_location_id?: string
          id?: string
          issued_at?: string
          issued_by?: string
          status?: Database["public"]["Enums"]["boa_bar_docket_status"]
          to_location_id?: string
          token_expires_at?: string
          token_hash?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "boa_bar_docket_from_location_id_fkey"
            columns: ["from_location_id"]
            isOneToOne: false
            referencedRelation: "boa_bar_location"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "boa_bar_docket_to_location_id_fkey"
            columns: ["to_location_id"]
            isOneToOne: false
            referencedRelation: "boa_bar_location"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "boa_bar_docket_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "boa_bar_venue"
            referencedColumns: ["id"]
          },
        ]
      }
      boa_bar_docket_line: {
        Row: {
          accepted_containers: number | null
          accepted_ml: number | null
          docket_id: string
          id: string
          issued_containers: number
          issued_ml: number
          sku_id: string
        }
        Insert: {
          accepted_containers?: number | null
          accepted_ml?: number | null
          docket_id: string
          id?: string
          issued_containers: number
          issued_ml: number
          sku_id: string
        }
        Update: {
          accepted_containers?: number | null
          accepted_ml?: number | null
          docket_id?: string
          id?: string
          issued_containers?: number
          issued_ml?: number
          sku_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "boa_bar_docket_line_docket_id_fkey"
            columns: ["docket_id"]
            isOneToOne: false
            referencedRelation: "boa_bar_docket"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "boa_bar_docket_line_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "boa_bar_sku"
            referencedColumns: ["id"]
          },
        ]
      }
      boa_bar_excise_category: {
        Row: {
          active: boolean
          category_key: string
          created_at: string
          label: string
        }
        Insert: {
          active?: boolean
          category_key: string
          created_at?: string
          label: string
        }
        Update: {
          active?: boolean
          category_key?: string
          created_at?: string
          label?: string
        }
        Relationships: []
      }
      boa_bar_invite: {
        Row: {
          claimed_at: string | null
          claimed_by: string | null
          code: string
          created_at: string
          created_by: string
          display_name: string
          expires_at: string
          id: string
          location_id: string | null
          role: Database["public"]["Enums"]["boa_bar_role"]
          venue_id: string
        }
        Insert: {
          claimed_at?: string | null
          claimed_by?: string | null
          code: string
          created_at?: string
          created_by: string
          display_name: string
          expires_at: string
          id?: string
          location_id?: string | null
          role: Database["public"]["Enums"]["boa_bar_role"]
          venue_id: string
        }
        Update: {
          claimed_at?: string | null
          claimed_by?: string | null
          code?: string
          created_at?: string
          created_by?: string
          display_name?: string
          expires_at?: string
          id?: string
          location_id?: string | null
          role?: Database["public"]["Enums"]["boa_bar_role"]
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "boa_bar_invite_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "boa_bar_location"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "boa_bar_invite_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "boa_bar_venue"
            referencedColumns: ["id"]
          },
        ]
      }
      boa_bar_location: {
        Row: {
          active: boolean
          code: string
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["boa_bar_location_kind"]
          name: string
          parent_id: string | null
          venue_id: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["boa_bar_location_kind"]
          name: string
          parent_id?: string | null
          venue_id: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["boa_bar_location_kind"]
          name?: string
          parent_id?: string | null
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "boa_bar_location_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "boa_bar_location"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "boa_bar_location_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "boa_bar_venue"
            referencedColumns: ["id"]
          },
        ]
      }
      boa_bar_membership: {
        Row: {
          active: boolean
          created_at: string
          id: string
          location_id: string | null
          role: Database["public"]["Enums"]["boa_bar_role"]
          user_id: string
          venue_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          location_id?: string | null
          role: Database["public"]["Enums"]["boa_bar_role"]
          user_id: string
          venue_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          location_id?: string | null
          role?: Database["public"]["Enums"]["boa_bar_role"]
          user_id?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "boa_bar_membership_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "boa_bar_location"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "boa_bar_membership_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "boa_bar_venue"
            referencedColumns: ["id"]
          },
        ]
      }
      boa_bar_movement: {
        Row: {
          actor_id: string
          business_date: string
          docket_id: string | null
          id: string
          idempotency_key: string
          kind: Database["public"]["Enums"]["boa_bar_movement_kind"]
          metadata: Json
          occurred_at: string
          posted_at: string
          reason: string | null
          reverses_movement_id: string | null
          source: string
          venue_id: string
        }
        Insert: {
          actor_id: string
          business_date: string
          docket_id?: string | null
          id?: string
          idempotency_key: string
          kind: Database["public"]["Enums"]["boa_bar_movement_kind"]
          metadata?: Json
          occurred_at: string
          posted_at?: string
          reason?: string | null
          reverses_movement_id?: string | null
          source?: string
          venue_id: string
        }
        Update: {
          actor_id?: string
          business_date?: string
          docket_id?: string | null
          id?: string
          idempotency_key?: string
          kind?: Database["public"]["Enums"]["boa_bar_movement_kind"]
          metadata?: Json
          occurred_at?: string
          posted_at?: string
          reason?: string | null
          reverses_movement_id?: string | null
          source?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "boa_bar_movement_docket_id_fkey"
            columns: ["docket_id"]
            isOneToOne: false
            referencedRelation: "boa_bar_docket"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "boa_bar_movement_reverses_movement_id_fkey"
            columns: ["reverses_movement_id"]
            isOneToOne: false
            referencedRelation: "boa_bar_movement"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "boa_bar_movement_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "boa_bar_venue"
            referencedColumns: ["id"]
          },
        ]
      }
      boa_bar_movement_line: {
        Row: {
          container_delta: number
          evidence: Json
          id: string
          location_id: string
          ml_delta: number
          movement_id: string
          sku_id: string
          value_delta_minor: number
        }
        Insert: {
          container_delta: number
          evidence?: Json
          id?: string
          location_id: string
          ml_delta: number
          movement_id: string
          sku_id: string
          value_delta_minor?: number
        }
        Update: {
          container_delta?: number
          evidence?: Json
          id?: string
          location_id?: string
          ml_delta?: number
          movement_id?: string
          sku_id?: string
          value_delta_minor?: number
        }
        Relationships: [
          {
            foreignKeyName: "boa_bar_movement_line_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "boa_bar_location"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "boa_bar_movement_line_movement_id_fkey"
            columns: ["movement_id"]
            isOneToOne: false
            referencedRelation: "boa_bar_movement"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "boa_bar_movement_line_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "boa_bar_sku"
            referencedColumns: ["id"]
          },
        ]
      }
      boa_bar_person: {
        Row: {
          display_name: string
          short_name: string | null
          updated_at: string
          user_id: string
          venue_id: string
        }
        Insert: {
          display_name: string
          short_name?: string | null
          updated_at?: string
          user_id: string
          venue_id: string
        }
        Update: {
          display_name?: string
          short_name?: string | null
          updated_at?: string
          user_id?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "boa_bar_person_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "boa_bar_venue"
            referencedColumns: ["id"]
          },
        ]
      }
      boa_bar_person_name_history: {
        Row: {
          changed_at: string
          changed_by: string
          id: string
          new_name: string
          previous_name: string | null
          user_id: string
          venue_id: string
        }
        Insert: {
          changed_at?: string
          changed_by: string
          id?: string
          new_name: string
          previous_name?: string | null
          user_id: string
          venue_id: string
        }
        Update: {
          changed_at?: string
          changed_by?: string
          id?: string
          new_name?: string
          previous_name?: string | null
          user_id?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "boa_bar_person_name_history_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "boa_bar_venue"
            referencedColumns: ["id"]
          },
        ]
      }
      boa_bar_pos_import: {
        Row: {
          error_report: Json
          id: string
          imported_at: string
          imported_by: string
          raw_object_path: string
          sha256: string
          source_name: string
          status: string
          venue_id: string
        }
        Insert: {
          error_report?: Json
          id?: string
          imported_at?: string
          imported_by: string
          raw_object_path: string
          sha256: string
          source_name: string
          status?: string
          venue_id: string
        }
        Update: {
          error_report?: Json
          id?: string
          imported_at?: string
          imported_by?: string
          raw_object_path?: string
          sha256?: string
          source_name?: string
          status?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "boa_bar_pos_import_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "boa_bar_venue"
            referencedColumns: ["id"]
          },
        ]
      }
      boa_bar_pos_row: {
        Row: {
          hour_bucket: string
          id: string
          import_id: string
          pos_item_code: string
          quantity: number
          raw_row: Json
          sold_at: string
          stable_transaction_id: string
          venue_id: string
        }
        Insert: {
          hour_bucket: string
          id?: string
          import_id: string
          pos_item_code: string
          quantity: number
          raw_row: Json
          sold_at: string
          stable_transaction_id: string
          venue_id: string
        }
        Update: {
          hour_bucket?: string
          id?: string
          import_id?: string
          pos_item_code?: string
          quantity?: number
          raw_row?: Json
          sold_at?: string
          stable_transaction_id?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "boa_bar_pos_row_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "boa_bar_pos_import"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "boa_bar_pos_row_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "boa_bar_venue"
            referencedColumns: ["id"]
          },
        ]
      }
      boa_bar_serve_map: {
        Row: {
          active_from: string
          active_to: string | null
          id: string
          inventory_sku_id: string
          ml_per_sale: number
          pos_item_code: string
          venue_id: string
        }
        Insert: {
          active_from?: string
          active_to?: string | null
          id?: string
          inventory_sku_id: string
          ml_per_sale: number
          pos_item_code: string
          venue_id: string
        }
        Update: {
          active_from?: string
          active_to?: string | null
          id?: string
          inventory_sku_id?: string
          ml_per_sale?: number
          pos_item_code?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "boa_bar_serve_map_inventory_sku_id_fkey"
            columns: ["inventory_sku_id"]
            isOneToOne: false
            referencedRelation: "boa_bar_sku"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "boa_bar_serve_map_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "boa_bar_venue"
            referencedColumns: ["id"]
          },
        ]
      }
      boa_bar_sku: {
        Row: {
          active: boolean
          category_key: string
          code: string
          container_type: string
          created_at: string
          excise_category: string
          id: string
          is_supplied: boolean
          ml_per_container: number
          name: string
          tare_weight_g: number | null
          units_per_case: number
          venue_id: string
        }
        Insert: {
          active?: boolean
          category_key: string
          code: string
          container_type: string
          created_at?: string
          excise_category: string
          id?: string
          is_supplied?: boolean
          ml_per_container: number
          name: string
          tare_weight_g?: number | null
          units_per_case?: number
          venue_id: string
        }
        Update: {
          active?: boolean
          category_key?: string
          code?: string
          container_type?: string
          created_at?: string
          excise_category?: string
          id?: string
          is_supplied?: boolean
          ml_per_container?: number
          name?: string
          tare_weight_g?: number | null
          units_per_case?: number
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "boa_bar_sku_excise_category_fk"
            columns: ["excise_category"]
            isOneToOne: false
            referencedRelation: "boa_bar_excise_category"
            referencedColumns: ["category_key"]
          },
          {
            foreignKeyName: "boa_bar_sku_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "boa_bar_venue"
            referencedColumns: ["id"]
          },
        ]
      }
      boa_bar_tolerance_band: {
        Row: {
          amber_max_pct: number
          category_key: string
          effective_from: string
          green_max_pct: number
        }
        Insert: {
          amber_max_pct: number
          category_key: string
          effective_from: string
          green_max_pct: number
        }
        Update: {
          amber_max_pct?: number
          category_key?: string
          effective_from?: string
          green_max_pct?: number
        }
        Relationships: []
      }
      boa_bar_venue: {
        Row: {
          business_day_start_hour: number
          code: string
          created_at: string
          event_date: string
          id: string
          name: string
          timezone: string
        }
        Insert: {
          business_day_start_hour?: number
          code: string
          created_at?: string
          event_date: string
          id?: string
          name: string
          timezone?: string
        }
        Update: {
          business_day_start_hour?: number
          code?: string
          created_at?: string
          event_date?: string
          id?: string
          name?: string
          timezone?: string
        }
        Relationships: []
      }
    }
    Views: {
      boa_bar_v_position: {
        Row: {
          containers: number | null
          last_occurred_at: string | null
          location_id: string | null
          ml: number | null
          sku_id: string | null
          value_minor: number | null
          venue_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "boa_bar_movement_line_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "boa_bar_location"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "boa_bar_movement_line_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "boa_bar_sku"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "boa_bar_movement_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "boa_bar_venue"
            referencedColumns: ["id"]
          },
        ]
      }
      boa_bar_v_reconciliation: {
        Row: {
          ledger_containers: number | null
          ledger_ml: number | null
          ledger_value_minor: number | null
          location_id: string | null
          projection_containers: number | null
          projection_ml: number | null
          projection_value_minor: number | null
          sku_id: string | null
          venue_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      boa_bar_accept_docket: { Args: { p_payload: Json }; Returns: Json }
      boa_bar_can_invite: { Args: never; Returns: boolean }
      boa_bar_claim_invite: { Args: { p_code: string }; Returns: Json }
      boa_bar_claim_venue: {
        Args: { p_display_name: string; p_venue_code: string }
        Returns: Json
      }
      boa_bar_create_docket: { Args: { p_payload: Json }; Returns: Json }
      boa_bar_create_invite: { Args: { p_payload: Json }; Returns: Json }
      boa_bar_inventory_snapshot: {
        Args: { p_venue_id: string }
        Returns: {
          category_key: string
          container_type: string
          containers: number
          location_code: string
          location_id: string
          location_kind: Database["public"]["Enums"]["boa_bar_location_kind"]
          location_name: string
          ml: number
          ml_per_container: number
          sku_code: string
          sku_id: string
          sku_name: string
          updated_at: string
          value_minor: number
        }[]
      }
      boa_bar_open_count: { Args: { p_payload: Json }; Returns: Json }
      boa_bar_open_stock: { Args: { p_payload: Json }; Returns: Json }
      boa_bar_record_receipt: { Args: { p_payload: Json }; Returns: Json }
      boa_bar_record_waste: { Args: { p_payload: Json }; Returns: Json }
      boa_bar_set_membership: { Args: { p_payload: Json }; Returns: Json }
      boa_bar_set_person_name: {
        Args: { p_display_name: string; p_user_id?: string; p_venue_id: string }
        Returns: {
          display_name: string
          short_name: string | null
          updated_at: string
          user_id: string
          venue_id: string
        }
        SetofOptions: {
          from: "*"
          to: "boa_bar_person"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      boa_bar_submit_count: { Args: { p_payload: Json }; Returns: Json }
      boa_bar_submit_movement: { Args: { p_payload: Json }; Returns: string }
      boa_bar_sync_status: {
        Args: { p_venue_id: string }
        Returns: {
          latest_posted_at: string
          movement_count: number
          server_time: string
        }[]
      }
      boa_bar_tolerance_bands: {
        Args: never
        Returns: {
          amber_max_pct: number
          category_key: string
          effective_from: string
          green_max_pct: number
        }[]
      }
    }
    Enums: {
      boa_bar_count_status: "draft" | "submitted" | "reviewed"
      boa_bar_docket_status:
        | "awaiting"
        | "accepted"
        | "accepted_short"
        | "cancelled"
      boa_bar_location_kind:
        | "warehouse"
        | "bar"
        | "hospitality"
        | "lounge"
        | "in_transit"
      boa_bar_movement_kind:
        | "receipt"
        | "issue"
        | "transfer"
        | "return"
        | "sale"
        | "comp"
        | "waste"
        | "adjustment"
      boa_bar_role:
        | "crew"
        | "warehouse"
        | "bar_lead"
        | "manager"
        | "auditor"
        | "admin"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      boa_bar_count_status: ["draft", "submitted", "reviewed"],
      boa_bar_docket_status: [
        "awaiting",
        "accepted",
        "accepted_short",
        "cancelled",
      ],
      boa_bar_location_kind: [
        "warehouse",
        "bar",
        "hospitality",
        "lounge",
        "in_transit",
      ],
      boa_bar_movement_kind: [
        "receipt",
        "issue",
        "transfer",
        "return",
        "sale",
        "comp",
        "waste",
        "adjustment",
      ],
      boa_bar_role: [
        "crew",
        "warehouse",
        "bar_lead",
        "manager",
        "auditor",
        "admin",
      ],
    },
  },
} as const
