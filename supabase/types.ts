export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      bowel_movements: {
        Row: {
          bristol_type: number | null
          completeness: number | null
          created_at: string
          difficulty: number | null
          id: string
          notes: string | null
          occurred_at: string
          straining: boolean | null
          urgency: number | null
          user_id: string
        }
        Insert: {
          bristol_type?: number | null
          completeness?: number | null
          created_at?: string
          difficulty?: number | null
          id?: string
          notes?: string | null
          occurred_at: string
          straining?: boolean | null
          urgency?: number | null
          user_id: string
        }
        Update: {
          bristol_type?: number | null
          completeness?: number | null
          created_at?: string
          difficulty?: number | null
          id?: string
          notes?: string | null
          occurred_at?: string
          straining?: boolean | null
          urgency?: number | null
          user_id?: string
        }
        Relationships: [{
          foreignKeyName: "bowel_movements_user_id_fkey"
          columns: ["user_id"]
          isOneToOne: false
          referencedRelation: "profiles"
          referencedColumns: ["id"]
        }]
      }
      daily_context: {
        Row: {
          alcohol_units: number | null
          caffeine_mg: number | null
          context_date: string
          created_at: string
          exercise_intensity: string | null
          exercise_minutes: number | null
          id: string
          notes: string | null
          sleep_hours: number | null
          sleep_quality: number | null
          stress_level: number | null
          updated_at: string
          user_id: string
          water_litres: number | null
        }
        Insert: {
          alcohol_units?: number | null
          caffeine_mg?: number | null
          context_date: string
          created_at?: string
          exercise_intensity?: string | null
          exercise_minutes?: number | null
          id?: string
          notes?: string | null
          sleep_hours?: number | null
          sleep_quality?: number | null
          stress_level?: number | null
          updated_at?: string
          user_id: string
          water_litres?: number | null
        }
        Update: {
          alcohol_units?: number | null
          caffeine_mg?: number | null
          context_date?: string
          created_at?: string
          exercise_intensity?: string | null
          exercise_minutes?: number | null
          id?: string
          notes?: string | null
          sleep_hours?: number | null
          sleep_quality?: number | null
          stress_level?: number | null
          updated_at?: string
          user_id?: string
          water_litres?: number | null
        }
        Relationships: [{
          foreignKeyName: "daily_context_user_id_fkey"
          columns: ["user_id"]
          isOneToOne: false
          referencedRelation: "profiles"
          referencedColumns: ["id"]
        }]
      }
      foods: {
        Row: {
          carbohydrate_per_100g: number | null
          created_at: string
          fibre_per_100g: number | null
          fodmap_category: string | null
          id: string
          name: string
          notes: string | null
        }
        Insert: {
          carbohydrate_per_100g?: number | null
          created_at?: string
          fibre_per_100g?: number | null
          fodmap_category?: string | null
          id?: string
          name: string
          notes?: string | null
        }
        Update: {
          carbohydrate_per_100g?: number | null
          created_at?: string
          fibre_per_100g?: number | null
          fodmap_category?: string | null
          id?: string
          name?: string
          notes?: string | null
        }
        Relationships: []
      }
      glucose_readings: {
        Row: {
          context: string | null
          created_at: string
          estimated_meal_carbs_g: number | null
          glucose_mmol_l: number
          id: string
          meal_id: string | null
          meal_relationship: string | null
          measured_at: string
          meter_name: string | null
          minutes_from_meal: number | null
          notes: string | null
          timing: string | null
          user_id: string
        }
        Insert: {
          context?: string | null
          created_at?: string
          estimated_meal_carbs_g?: number | null
          glucose_mmol_l?: never
          id?: string
          meal_id?: string | null
          meal_relationship?: string | null
          measured_at: string
          meter_name?: string | null
          minutes_from_meal?: number | null
          notes?: string | null
          timing?: string | null
          user_id: string
        }
        Update: {
          context?: string | null
          created_at?: string
          estimated_meal_carbs_g?: number | null
          glucose_mmol_l?: number
          id?: string
          meal_id?: string | null
          meal_relationship?: string | null
          measured_at?: string
          meter_name?: string | null
          minutes_from_meal?: number | null
          notes?: string | null
          timing?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "glucose_readings_meal_id_fkey"
            columns: ["meal_id"]
            isOneToOne: false
            referencedRelation: "meals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "glucose_readings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      gut_symptoms: {
        Row: {
          created_at: string
          duration_minutes: number | null
          id: string
          meal_id: string | null
          notes: string | null
          occurred_at: string
          severity: number | null
          symptom_type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          duration_minutes?: number | null
          id?: string
          meal_id?: string | null
          notes?: string | null
          occurred_at: string
          severity?: number | null
          symptom_type: string
          user_id: string
        }
        Update: {
          created_at?: string
          duration_minutes?: number | null
          id?: string
          meal_id?: string | null
          notes?: string | null
          occurred_at?: string
          severity?: number | null
          symptom_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gut_symptoms_meal_id_fkey"
            columns: ["meal_id"]
            isOneToOne: false
            referencedRelation: "meals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gut_symptoms_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      meal_foods: {
        Row: {
          created_at: string
          estimated_carbohydrate_g: number | null
          estimated_fibre_g: number | null
          food_id: string | null
          food_name: string
          id: string
          meal_id: string
          notes: string | null
          portion: number | null
          portion_unit: string | null
        }
        Insert: {
          created_at?: string
          estimated_carbohydrate_g?: number | null
          estimated_fibre_g?: number | null
          food_id?: string | null
          food_name: string
          id?: string
          meal_id: string
          notes?: string | null
          portion?: number | null
          portion_unit?: string | null
        }
        Update: {
          created_at?: string
          estimated_carbohydrate_g?: number | null
          estimated_fibre_g?: number | null
          food_id?: string | null
          food_name?: string
          id?: string
          meal_id?: string
          notes?: string | null
          portion?: number | null
          portion_unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meal_foods_food_id_fkey"
            columns: ["food_id"]
            isOneToOne: false
            referencedRelation: "foods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_foods_meal_id_fkey"
            columns: ["meal_id"]
            isOneToOne: false
            referencedRelation: "meals"
            referencedColumns: ["id"]
          }
        ]
      }
      meals: {
        Row: {
          created_at: string
          estimated_carbohydrate_g: number | null
          fibre_estimate_g: number | null
          id: string
          meal_time: string
          meal_type: string | null
          notes: string | null
          protein_estimate_g: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          estimated_carbohydrate_g?: number | null
          fibre_estimate_g?: number | null
          id?: string
          meal_time: string
          meal_type?: string | null
          notes?: string | null
          protein_estimate_g?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          estimated_carbohydrate_g?: number | null
          fibre_estimate_g?: number | null
          id?: string
          meal_time?: string
          meal_type?: string | null
          notes?: string | null
          protein_estimate_g?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [{
          foreignKeyName: "meals_user_id_fkey"
          columns: ["user_id"]
          isOneToOne: false
          referencedRelation: "profiles"
          referencedColumns: ["id"]
        }]
      }
      profiles: {
        Row: {
          created_at: string
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      weight_entries: {
        Row: {
          created_at: string
          id: string
          measured_at: string
          notes: string | null
          user_id: string
          weight_kg: number
        }
        Insert: {
          created_at?: string
          id?: string
          measured_at?: string
          notes?: string | null
          user_id: string
          weight_kg: number
        }
        Update: {
          created_at?: string
          id?: string
          measured_at?: string
          notes?: string | null
          user_id?: string
          weight_kg?: number
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
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Enums"][EnumName]
  : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
