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
  public: {
    Tables: {
      instruments: {
        Row: {
          created_at: string
          id: string
          item_type: string
          location_id: string | null
          maker: string
          management_code: string
          model_id: string | null
          name_id: string
          optimal_quantity: number
          serial_number: string
          status: string
          stock_quantity: number
          storage_location: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_type?: string
          location_id?: string | null
          maker?: string
          management_code: string
          model_id?: string | null
          name_id: string
          optimal_quantity?: number
          serial_number?: string
          status?: string
          stock_quantity?: number
          storage_location?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          item_type?: string
          location_id?: string | null
          maker?: string
          management_code?: string
          model_id?: string | null
          name_id?: string
          optimal_quantity?: number
          serial_number?: string
          status?: string
          stock_quantity?: number
          storage_location?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "instruments_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "measurement_models"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instruments_name_id_fkey"
            columns: ["name_id"]
            isOneToOne: false
            referencedRelation: "measurement_names"
            referencedColumns: ["id"]
          },
        ]
      }
      measurement_models: {
        Row: {
          created_at: string
          id: string
          model: string
          name_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          model: string
          name_id: string
        }
        Update: {
          created_at?: string
          id?: string
          model?: string
          name_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "measurement_models_name_id_fkey"
            columns: ["name_id"]
            isOneToOne: false
            referencedRelation: "measurement_names"
            referencedColumns: ["id"]
          },
        ]
      }
      calibration_records: {
        Row: {
          id: string
          instrument_id: string
          calibration_type: string
          calibrated_at: string
          next_due_at: string
          vendor: string | null
          cert_no: string | null
          cert_url: string | null
          result: string
          note: string | null
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          instrument_id: string
          calibration_type: string
          calibrated_at: string
          next_due_at: string
          vendor?: string | null
          cert_no?: string | null
          cert_url?: string | null
          result?: string
          note?: string | null
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          instrument_id?: string
          calibration_type?: string
          calibrated_at?: string
          next_due_at?: string
          vendor?: string | null
          cert_no?: string | null
          cert_url?: string | null
          result?: string
          note?: string | null
          created_by?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "calibration_records_instrument_id_fkey"
            columns: ["instrument_id"]
            isOneToOne: false
            referencedRelation: "instruments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calibration_records_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          id: string
          name: string
          location_type: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          location_type?: string
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          location_type?: string
          created_at?: string
        }
        Relationships: []
      }
      measurement_names: {
        Row: {
          created_at: string
          id: string
          name: string
          internal_cycle_months: number
          external_cycle_months: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          internal_cycle_months?: number
          external_cycle_months?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          internal_cycle_months?: number
          external_cycle_months?: number | null
        }
        Relationships: []
      }
      stock_transactions: {
        Row: {
          created_at: string
          id: string
          instrument_id: string
          note: string
          quantity: number
          transacted_at: string
          transaction_type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          instrument_id: string
          note?: string
          quantity: number
          transacted_at?: string
          transaction_type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          instrument_id?: string
          note?: string
          quantity?: number
          transacted_at?: string
          transaction_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_transactions_instrument_id_fkey"
            columns: ["instrument_id"]
            isOneToOne: false
            referencedRelation: "instruments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: string
          system_name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: string
          system_name: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: string
          system_name?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string
          email: string
          hired_date: string | null
          id: string
          is_active: boolean
          name: string
          retirement_date: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          hired_date?: string | null
          id?: string
          is_active?: boolean
          name: string
          retirement_date?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          hired_date?: string | null
          id?: string
          is_active?: boolean
          name?: string
          retirement_date?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
    Enums: {},
  },
} as const

// 便利型エイリアス
export type Instrument          = Tables<'instruments'>
export type MeasurementName     = Tables<'measurement_names'>
export type MeasurementModel    = Tables<'measurement_models'>
export type StockTransaction    = Tables<'stock_transactions'>
export type User                = Tables<'users'>
export type UserRoleRecord      = Tables<'user_roles'>
export type CalibrationRecord   = Tables<'calibration_records'>
export type Location            = Tables<'locations'>
export type UserRole            = 'admin' | 'worker'
export type InstrumentStatus    = 'in_stock' | 'repairing' | 'disposed'
export type ItemType            = 'new' | 'used'
export type TransactionType     = 'in' | 'out'
export type CalibrationType     = 'internal' | 'external'
export type CalibrationResult   = 'pass' | 'fail'
export type LocationType        = 'warehouse' | 'field' | 'repair'

export interface AuthUser {
  id: string
  name: string
  email: string
  role: UserRole
}

// 校正管理 API レスポンス型
export interface CalibrationSummary {
  total_field: number
  calibrated: number
  expired: number
  due_soon: number
  calibration_rate: number
}

export interface LocationCalibrationStat {
  location_id: string
  location_name: string
  total: number
  calibrated: number
  expired: number
  due_soon: number
  calibration_rate: number
}

export interface InstrumentCalibrationStat {
  name_id: string
  name: string
  internal_cycle_months: number
  external_cycle_months: number | null
  total_field: number
  calibrated: number
  expired: number
  due_soon: number
  calibration_rate: number
}

export interface PendingCalibrationItem {
  instrument_id: string
  management_code: string
  name: string
  model: string | null
  maker: string
  location_name: string
  calibration_type: string
  calibrated_at: string | null
  next_due_at: string | null
  days_until_due: number | null
}

export interface FieldInstrumentItem {
  instrument_id: string
  management_code: string
  name: string
  model: string | null
  maker: string
  location_name: string
  calibration_type: string | null
  calibrated_at: string | null
  next_due_at: string | null
  days_until_due: number | null
  calibration_status: 'ok' | 'due_soon' | 'expired'
}

export interface CalibrationRecordWithRelations extends CalibrationRecord {
  instrument: {
    management_code: string
    name_id: string
    maker: string
    measurement_names: { name: string } | null
    measurement_models: { model: string } | null
  }
  users: { name: string } | null
}
