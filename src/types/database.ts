export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
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
      activity_log: {
        Row: {
          action: string
          application_id: string | null
          created_at: string
          customer_id: string | null
          id: string
          is_read: boolean
          performed_by: string
          performed_by_staff_id: string | null
          type: string
        }
        Insert: {
          action: string
          application_id?: string | null
          created_at?: string
          customer_id?: string | null
          id?: string
          is_read?: boolean
          performed_by?: string
          performed_by_staff_id?: string | null
          type?: string
        }
        Update: {
          action?: string
          application_id?: string | null
          created_at?: string
          customer_id?: string | null
          id?: string
          is_read?: boolean
          performed_by?: string
          performed_by_staff_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_log_actor_fk"
            columns: ["performed_by_staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_log_application_fk"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_log_customer_fk"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      applications: {
        Row: {
          appointment_date: string | null
          appointment_location: string | null
          assigned_staff_id: string | null
          consulate_fee: number
          country: string
          created_at: string
          customer_id: string
          id: string
          rejection_reason: string | null
          service_fee: number
          status: string
          total_fee: number
          updated_at: string
          visa_type: string
        }
        Insert: {
          appointment_date?: string | null
          appointment_location?: string | null
          assigned_staff_id?: string | null
          consulate_fee?: number
          country: string
          created_at?: string
          customer_id: string
          id?: string
          rejection_reason?: string | null
          service_fee?: number
          status?: string
          total_fee?: number
          updated_at?: string
          visa_type?: string
        }
        Update: {
          appointment_date?: string | null
          appointment_location?: string | null
          assigned_staff_id?: string | null
          consulate_fee?: number
          country?: string
          created_at?: string
          customer_id?: string
          id?: string
          rejection_reason?: string | null
          service_fee?: number
          status?: string
          total_fee?: number
          updated_at?: string
          visa_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "applications_assigned_staff_fk"
            columns: ["assigned_staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_customer_fk"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      communications: {
        Row: {
          application_id: string | null
          content: string | null
          created_at: string
          customer_id: string | null
          direction: string
          id: string
          performed_by: string | null
          performed_by_staff_id: string | null
          subject: string | null
          type: string
        }
        Insert: {
          application_id?: string | null
          content?: string | null
          created_at?: string
          customer_id?: string | null
          direction?: string
          id?: string
          performed_by?: string | null
          performed_by_staff_id?: string | null
          subject?: string | null
          type: string
        }
        Update: {
          application_id?: string | null
          content?: string | null
          created_at?: string
          customer_id?: string | null
          direction?: string
          id?: string
          performed_by?: string | null
          performed_by_staff_id?: string | null
          subject?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "communications_actor_fk"
            columns: ["performed_by_staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communications_application_fk"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communications_customer_fk"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      countries: {
        Row: {
          active: boolean
          appointment_system: string | null
          base_fee_service: number
          base_fee_visa: number
          created_at: string
          id: string
          name: string
          notes: string | null
          updated_at: string
          visa_system: string | null
        }
        Insert: {
          active?: boolean
          appointment_system?: string | null
          base_fee_service?: number
          base_fee_visa?: number
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          updated_at?: string
          visa_system?: string | null
        }
        Update: {
          active?: boolean
          appointment_system?: string | null
          base_fee_service?: number
          base_fee_visa?: number
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          updated_at?: string
          visa_system?: string | null
        }
        Relationships: []
      }
      country_visa_rules: {
        Row: {
          accommodation: string | null
          country_id: string
          created_at: string
          documents: Json
          id: string
          max_stay: string | null
          multiple_entry: boolean
          nationality: string | null
          notes: string | null
          occupation: string | null
          processing_time: string | null
          travel_method: string | null
          updated_at: string
          validity: string | null
          visa_category: string
          with_children: boolean | null
        }
        Insert: {
          accommodation?: string | null
          country_id: string
          created_at?: string
          documents?: Json
          id?: string
          max_stay?: string | null
          multiple_entry?: boolean
          nationality?: string | null
          notes?: string | null
          occupation?: string | null
          processing_time?: string | null
          travel_method?: string | null
          updated_at?: string
          validity?: string | null
          visa_category?: string
          with_children?: boolean | null
        }
        Update: {
          accommodation?: string | null
          country_id?: string
          created_at?: string
          documents?: Json
          id?: string
          max_stay?: string | null
          multiple_entry?: boolean
          nationality?: string | null
          notes?: string | null
          occupation?: string | null
          processing_time?: string | null
          travel_method?: string | null
          updated_at?: string
          validity?: string | null
          visa_category?: string
          with_children?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "rules_country_fk"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          assigned_staff_id: string | null
          created_at: string
          deleted_at: string | null
          email: string | null
          financial_status: string | null
          first_name: string
          id: string
          is_deleted: boolean
          last_name: string
          monthly_income: number | null
          notes: string | null
          passport_expiry: string | null
          passport_issuing_country: string | null
          passport_no: string | null
          phone: string | null
          portal_token: string | null
          profile_score: number
          updated_at: string
        }
        Insert: {
          assigned_staff_id?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          financial_status?: string | null
          first_name: string
          id?: string
          is_deleted?: boolean
          last_name: string
          monthly_income?: number | null
          notes?: string | null
          passport_expiry?: string | null
          passport_issuing_country?: string | null
          passport_no?: string | null
          phone?: string | null
          portal_token?: string | null
          profile_score?: number
          updated_at?: string
        }
        Update: {
          assigned_staff_id?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          financial_status?: string | null
          first_name?: string
          id?: string
          is_deleted?: boolean
          last_name?: string
          monthly_income?: number | null
          notes?: string | null
          passport_expiry?: string | null
          passport_issuing_country?: string | null
          passport_no?: string | null
          phone?: string | null
          portal_token?: string | null
          profile_score?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_assigned_staff_fk"
            columns: ["assigned_staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          application_id: string
          category: string
          created_at: string
          description: string | null
          document_type: string
          file_url: string | null
          id: string
          is_required: boolean
          requested_at: string
          status: string
          updated_at: string
        }
        Insert: {
          application_id: string
          category?: string
          created_at?: string
          description?: string | null
          document_type: string
          file_url?: string | null
          id?: string
          is_required?: boolean
          requested_at?: string
          status?: string
          updated_at?: string
        }
        Update: {
          application_id?: string
          category?: string
          created_at?: string
          description?: string | null
          document_type?: string
          file_url?: string | null
          id?: string
          is_required?: boolean
          requested_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_application_fk"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
        ]
      }
      family_members: {
        Row: {
          birth_date: string | null
          created_at: string
          customer_id: string
          full_name: string
          id: string
          passport_no: string | null
          relationship: string | null
        }
        Insert: {
          birth_date?: string | null
          created_at?: string
          customer_id: string
          full_name: string
          id?: string
          passport_no?: string | null
          relationship?: string | null
        }
        Update: {
          birth_date?: string | null
          created_at?: string
          customer_id?: string
          full_name?: string
          id?: string
          passport_no?: string | null
          relationship?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "family_members_customer_fk"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      notes: {
        Row: {
          application_id: string
          author: string | null
          content: string
          created_at: string
          created_by: string | null
          id: string
        }
        Insert: {
          application_id: string
          author?: string | null
          content: string
          created_at?: string
          created_by?: string | null
          id?: string
        }
        Update: {
          application_id?: string
          author?: string | null
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notes_application_fk"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_created_by_fk"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          application_id: string | null
          created_at: string
          customer_id: string | null
          href: string | null
          id: string
          idempotency_key: string | null
          is_read: boolean
          message: string | null
          read_at: string | null
          recipient_staff_id: string
          task_id: string | null
          title: string
          type: string
        }
        Insert: {
          application_id?: string | null
          created_at?: string
          customer_id?: string | null
          href?: string | null
          id?: string
          idempotency_key?: string | null
          is_read?: boolean
          message?: string | null
          read_at?: string | null
          recipient_staff_id: string
          task_id?: string | null
          title: string
          type?: string
        }
        Update: {
          application_id?: string | null
          created_at?: string
          customer_id?: string | null
          href?: string | null
          id?: string
          idempotency_key?: string | null
          is_read?: boolean
          message?: string | null
          read_at?: string | null
          recipient_staff_id?: string
          task_id?: string | null
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_application_fk"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_customer_fk"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_recipient_staff_fk"
            columns: ["recipient_staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_task_fk"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          application_id: string
          created_at: string
          currency: string
          id: string
          method: string | null
          note: string | null
          status: string | null
          type: string
        }
        Insert: {
          amount: number
          application_id: string
          created_at?: string
          currency?: string
          id?: string
          method?: string | null
          note?: string | null
          status?: string | null
          type?: string
        }
        Update: {
          amount?: number
          application_id?: string
          created_at?: string
          currency?: string
          id?: string
          method?: string | null
          note?: string | null
          status?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_application_fk"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
        ]
      }
      staff: {
        Row: {
          created_at: string
          email: string
          full_name: string
          id: string
          is_active: boolean
          phone: string | null
          role: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          full_name: string
          id?: string
          is_active?: boolean
          phone?: string | null
          role?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean
          phone?: string | null
          role?: string
          user_id?: string | null
        }
        Relationships: []
      }
      tasks: {
        Row: {
          application_id: string | null
          assigned_staff_id: string
          completed_at: string | null
          created_at: string
          created_by_staff_id: string | null
          customer_id: string | null
          description: string | null
          due_at: string
          id: string
          idempotency_key: string | null
          priority: string
          source_id: string | null
          source_type: string
          status: string
          task_type: string
          title: string
          updated_at: string
        }
        Insert: {
          application_id?: string | null
          assigned_staff_id: string
          completed_at?: string | null
          created_at?: string
          created_by_staff_id?: string | null
          customer_id?: string | null
          description?: string | null
          due_at: string
          id?: string
          idempotency_key?: string | null
          priority?: string
          source_id?: string | null
          source_type?: string
          status?: string
          task_type?: string
          title: string
          updated_at?: string
        }
        Update: {
          application_id?: string | null
          assigned_staff_id?: string
          completed_at?: string | null
          created_at?: string
          created_by_staff_id?: string | null
          customer_id?: string | null
          description?: string | null
          due_at?: string
          id?: string
          idempotency_key?: string | null
          priority?: string
          source_id?: string | null
          source_type?: string
          status?: string
          task_type?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_application_fk"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_assigned_staff_fk"
            columns: ["assigned_staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_created_by_staff_fk"
            columns: ["created_by_staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_customer_fk"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          company_name: string
          created_at: string
          email: string | null
          id: string
          phone: string | null
        }
        Insert: {
          company_name?: string
          created_at?: string
          email?: string | null
          id?: string
          phone?: string | null
        }
        Update: {
          company_name?: string
          created_at?: string
          email?: string | null
          id?: string
          phone?: string | null
        }
        Relationships: []
      }
      visa_history: {
        Row: {
          application_date: string | null
          country: string | null
          created_at: string
          customer_id: string
          expiry_date: string | null
          id: string
          notes: string | null
          result: string | null
          visa_type: string | null
        }
        Insert: {
          application_date?: string | null
          country?: string | null
          created_at?: string
          customer_id: string
          expiry_date?: string | null
          id?: string
          notes?: string | null
          result?: string | null
          visa_type?: string | null
        }
        Update: {
          application_date?: string | null
          country?: string | null
          created_at?: string
          customer_id?: string
          expiry_date?: string | null
          id?: string
          notes?: string | null
          result?: string | null
          visa_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "visa_history_customer_fk"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_events: {
        Row: {
          event_id: string
          processed_at: string | null
          received_at: string
          source: string
          status: string
        }
        Insert: {
          event_id: string
          processed_at?: string | null
          received_at?: string
          source: string
          status?: string
        }
        Update: {
          event_id?: string
          processed_at?: string | null
          received_at?: string
          source?: string
          status?: string
        }
        Relationships: []
      }
    }
    Views: {
      country_visa_requirements: {
        Row: {
          country_id: string | null
          created_at: string | null
          documents: Json | null
          id: string | null
          max_stay: string | null
          multiple_entry: boolean | null
          notes: string | null
          processing_time: string | null
          validity: string | null
          visa_type: string | null
        }
        Insert: {
          country_id?: string | null
          created_at?: string | null
          documents?: Json | null
          id?: string | null
          max_stay?: string | null
          multiple_entry?: boolean | null
          notes?: string | null
          processing_time?: string | null
          validity?: string | null
          visa_type?: string | null
        }
        Update: {
          country_id?: string | null
          created_at?: string | null
          documents?: Json | null
          id?: string | null
          max_stay?: string | null
          multiple_entry?: boolean | null
          notes?: string | null
          processing_time?: string | null
          validity?: string | null
          visa_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rules_country_fk"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      archive_customers_v1: {
        Args: { p_customer_ids: string[] }
        Returns: number
      }
      can_access_application: {
        Args: { target_application_id: string }
        Returns: boolean
      }
      can_access_customer: {
        Args: { target_customer_id: string }
        Returns: boolean
      }
      can_access_document: {
        Args: { target_document_id: string }
        Returns: boolean
      }
      create_customer_application_v1: {
        Args: { p_payload: Json }
        Returns: Json
      }
      create_task_v1: { Args: { p_payload: Json }; Returns: string }
      current_staff_id: { Args: never; Returns: string }
      is_admin: { Args: never; Returns: boolean }
      list_archived_customers_v1: {
        Args: never
        Returns: {
          assigned_staff_id: string
          deleted_at: string
          email: string
          first_name: string
          id: string
          last_name: string
          phone: string
          purge_eligible: boolean
        }[]
      }
      mark_all_notifications_read_v1: { Args: never; Returns: number }
      mark_notification_read_v1: {
        Args: { p_notification_id: string }
        Returns: boolean
      }
      purge_deleted_customers_v1: {
        Args: { p_customer_ids: string[] }
        Returns: number
      }
      restore_backup_v2: { Args: { p_backup: Json }; Returns: Json }
      restore_customers_v1: {
        Args: { p_customer_ids: string[] }
        Returns: number
      }
      set_task_status_v1: {
        Args: { p_status: string; p_task_id: string }
        Returns: boolean
      }
      storage_document_id: { Args: { object_name: string }; Returns: string }
      sync_operational_tasks_v1: { Args: never; Returns: number }
      update_application_status_v1: {
        Args: {
          p_action?: string
          p_application_id: string
          p_rejection_reason?: string
          p_status: string
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
    Enums: {},
  },
} as const
