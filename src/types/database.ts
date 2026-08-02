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
          accommodation: string | null
          appointment_date: string | null
          appointment_duration_minutes: number
          appointment_location: string | null
          appointment_status: string | null
          appointment_timezone: string
          assigned_staff_id: string | null
          consulate_fee: number
          country: string
          country_id: string | null
          created_at: string
          customer_id: string
          id: string
          nationality: string | null
          occupation: string | null
          rejection_reason: string | null
          service_fee: number
          status: string
          total_fee: number
          travel_method: string | null
          updated_at: string
          visa_type: string
          with_children: boolean | null
        }
        Insert: {
          accommodation?: string | null
          appointment_date?: string | null
          appointment_duration_minutes?: number
          appointment_location?: string | null
          appointment_status?: string | null
          appointment_timezone?: string
          assigned_staff_id?: string | null
          consulate_fee?: number
          country: string
          country_id?: string | null
          created_at?: string
          customer_id: string
          id?: string
          nationality?: string | null
          occupation?: string | null
          rejection_reason?: string | null
          service_fee?: number
          status?: string
          total_fee?: number
          travel_method?: string | null
          updated_at?: string
          visa_type?: string
          with_children?: boolean | null
        }
        Update: {
          accommodation?: string | null
          appointment_date?: string | null
          appointment_duration_minutes?: number
          appointment_location?: string | null
          appointment_status?: string | null
          appointment_timezone?: string
          assigned_staff_id?: string | null
          consulate_fee?: number
          country?: string
          country_id?: string | null
          created_at?: string
          customer_id?: string
          id?: string
          nationality?: string | null
          occupation?: string | null
          rejection_reason?: string | null
          service_fee?: number
          status?: string
          total_fee?: number
          travel_method?: string | null
          updated_at?: string
          visa_type?: string
          with_children?: boolean | null
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
            foreignKeyName: "applications_country_id_fk"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
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
      appointment_events: {
        Row: {
          actor_staff_id: string | null
          application_id: string
          appointment_date: string | null
          created_at: string
          customer_id: string
          duration_minutes: number | null
          event_type: string
          id: string
          location: string | null
          note: string | null
          previous_date: string | null
        }
        Insert: {
          actor_staff_id?: string | null
          application_id: string
          appointment_date?: string | null
          created_at?: string
          customer_id: string
          duration_minutes?: number | null
          event_type: string
          id?: string
          location?: string | null
          note?: string | null
          previous_date?: string | null
        }
        Update: {
          actor_staff_id?: string | null
          application_id?: string
          appointment_date?: string | null
          created_at?: string
          customer_id?: string
          duration_minutes?: number | null
          event_type?: string
          id?: string
          location?: string | null
          note?: string | null
          previous_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointment_events_actor_staff_id_fkey"
            columns: ["actor_staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_events_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_events_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      auth_login_attempts: {
        Row: {
          failure_count: number
          key_hash: string
          last_attempt_at: string
          locked_until: string | null
          window_started_at: string
        }
        Insert: {
          failure_count?: number
          key_hash: string
          last_attempt_at?: string
          locked_until?: string | null
          window_started_at?: string
        }
        Update: {
          failure_count?: number
          key_hash?: string
          last_attempt_at?: string
          locked_until?: string | null
          window_started_at?: string
        }
        Relationships: []
      }
      backup_runs: {
        Row: {
          artifact_label: string
          backup_kind: string
          checksum_sha256: string | null
          completed_at: string | null
          created_by_staff_id: string | null
          database_row_count: number | null
          database_table_count: number | null
          error_code: string | null
          format_version: string
          id: string
          started_at: string
          status: string
          storage_bytes: number | null
          storage_object_count: number | null
          trigger_type: string
          verified_at: string | null
          verified_by_staff_id: string | null
        }
        Insert: {
          artifact_label: string
          backup_kind: string
          checksum_sha256?: string | null
          completed_at?: string | null
          created_by_staff_id?: string | null
          database_row_count?: number | null
          database_table_count?: number | null
          error_code?: string | null
          format_version?: string
          id?: string
          started_at?: string
          status?: string
          storage_bytes?: number | null
          storage_object_count?: number | null
          trigger_type?: string
          verified_at?: string | null
          verified_by_staff_id?: string | null
        }
        Update: {
          artifact_label?: string
          backup_kind?: string
          checksum_sha256?: string | null
          completed_at?: string | null
          created_by_staff_id?: string | null
          database_row_count?: number | null
          database_table_count?: number | null
          error_code?: string | null
          format_version?: string
          id?: string
          started_at?: string
          status?: string
          storage_bytes?: number | null
          storage_object_count?: number | null
          trigger_type?: string
          verified_at?: string | null
          verified_by_staff_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "backup_runs_created_by_staff_fk"
            columns: ["created_by_staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "backup_runs_verified_by_staff_fk"
            columns: ["verified_by_staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      communication_preferences: {
        Row: {
          allowed: boolean
          channel: string
          customer_id: string
          evidence_note: string | null
          purpose: string
          recorded_at: string
          recorded_by_staff_id: string | null
        }
        Insert: {
          allowed?: boolean
          channel: string
          customer_id: string
          evidence_note?: string | null
          purpose?: string
          recorded_at?: string
          recorded_by_staff_id?: string | null
        }
        Update: {
          allowed?: boolean
          channel?: string
          customer_id?: string
          evidence_note?: string | null
          purpose?: string
          recorded_at?: string
          recorded_by_staff_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "communication_preferences_customer_fk"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_preferences_staff_fk"
            columns: ["recorded_by_staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
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
          failure_reason: string | null
          id: string
          performed_by: string | null
          performed_by_staff_id: string | null
          recipient: string | null
          sent_at: string | null
          status: string
          subject: string | null
          template_id: string | null
          type: string
        }
        Insert: {
          application_id?: string | null
          content?: string | null
          created_at?: string
          customer_id?: string | null
          direction?: string
          failure_reason?: string | null
          id?: string
          performed_by?: string | null
          performed_by_staff_id?: string | null
          recipient?: string | null
          sent_at?: string | null
          status?: string
          subject?: string | null
          template_id?: string | null
          type: string
        }
        Update: {
          application_id?: string | null
          content?: string | null
          created_at?: string
          customer_id?: string | null
          direction?: string
          failure_reason?: string | null
          id?: string
          performed_by?: string | null
          performed_by_staff_id?: string | null
          recipient?: string | null
          sent_at?: string | null
          status?: string
          subject?: string | null
          template_id?: string | null
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
          {
            foreignKeyName: "communications_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "message_templates"
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
      customer_consents: {
        Row: {
          consent_type: string
          created_at: string
          customer_id: string
          decision: string
          decision_at: string
          evidence_note: string | null
          id: string
          notice_version_id: string | null
          recorded_by_staff_id: string | null
          source: string
        }
        Insert: {
          consent_type: string
          created_at?: string
          customer_id: string
          decision: string
          decision_at?: string
          evidence_note?: string | null
          id?: string
          notice_version_id?: string | null
          recorded_by_staff_id?: string | null
          source: string
        }
        Update: {
          consent_type?: string
          created_at?: string
          customer_id?: string
          decision?: string
          decision_at?: string
          evidence_note?: string | null
          id?: string
          notice_version_id?: string | null
          recorded_by_staff_id?: string | null
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_consents_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_consents_notice_version_id_fkey"
            columns: ["notice_version_id"]
            isOneToOne: false
            referencedRelation: "privacy_notice_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_consents_recorded_by_staff_id_fkey"
            columns: ["recorded_by_staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_privacy_notices: {
        Row: {
          acknowledged_at: string | null
          created_at: string
          customer_id: string
          delivered_at: string
          delivery_method: string
          evidence_note: string | null
          id: string
          notice_version_id: string
          recorded_by_staff_id: string | null
        }
        Insert: {
          acknowledged_at?: string | null
          created_at?: string
          customer_id: string
          delivered_at?: string
          delivery_method: string
          evidence_note?: string | null
          id?: string
          notice_version_id: string
          recorded_by_staff_id?: string | null
        }
        Update: {
          acknowledged_at?: string | null
          created_at?: string
          customer_id?: string
          delivered_at?: string
          delivery_method?: string
          evidence_note?: string | null
          id?: string
          notice_version_id?: string
          recorded_by_staff_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_privacy_notices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_privacy_notices_notice_version_id_fkey"
            columns: ["notice_version_id"]
            isOneToOne: false
            referencedRelation: "privacy_notice_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_privacy_notices_recorded_by_staff_id_fkey"
            columns: ["recorded_by_staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_tags: {
        Row: {
          created_at: string
          created_by: string | null
          customer_id: string
          tag_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          customer_id: string
          tag_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          customer_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_tags_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_tags_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          anonymized_at: string | null
          anonymized_by_staff_id: string | null
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
          portal_access_enabled: boolean
          portal_last_accessed_at: string | null
          portal_token: string | null
          portal_token_expires_at: string | null
          retention_hold_reason: string | null
          retention_hold_until: string | null
          updated_at: string
        }
        Insert: {
          anonymized_at?: string | null
          anonymized_by_staff_id?: string | null
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
          portal_access_enabled?: boolean
          portal_last_accessed_at?: string | null
          portal_token?: string | null
          portal_token_expires_at?: string | null
          retention_hold_reason?: string | null
          retention_hold_until?: string | null
          updated_at?: string
        }
        Update: {
          anonymized_at?: string | null
          anonymized_by_staff_id?: string | null
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
          portal_access_enabled?: boolean
          portal_last_accessed_at?: string | null
          portal_token?: string | null
          portal_token_expires_at?: string | null
          retention_hold_reason?: string | null
          retention_hold_until?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_anonymized_by_staff_id_fkey"
            columns: ["anonymized_by_staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_assigned_staff_fk"
            columns: ["assigned_staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      data_subject_requests: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by_staff_id: string | null
          customer_id: string
          due_at: string | null
          handled_by_staff_id: string | null
          id: string
          notes: string | null
          request_type: string
          requested_at: string
          requested_via: string
          resolution_note: string | null
          status: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by_staff_id?: string | null
          customer_id: string
          due_at?: string | null
          handled_by_staff_id?: string | null
          id?: string
          notes?: string | null
          request_type: string
          requested_at?: string
          requested_via: string
          resolution_note?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by_staff_id?: string | null
          customer_id?: string
          due_at?: string | null
          handled_by_staff_id?: string | null
          id?: string
          notes?: string | null
          request_type?: string
          requested_at?: string
          requested_via?: string
          resolution_note?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "data_subject_requests_created_by_staff_id_fkey"
            columns: ["created_by_staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "data_subject_requests_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "data_subject_requests_handled_by_staff_id_fkey"
            columns: ["handled_by_staff_id"]
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
          storage_deleted_at: string | null
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
          storage_deleted_at?: string | null
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
          storage_deleted_at?: string | null
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
      lead_events: {
        Row: {
          actor_staff_id: string | null
          created_at: string
          event_type: string
          from_status: string | null
          id: string
          lead_id: string
          note: string | null
          to_status: string | null
        }
        Insert: {
          actor_staff_id?: string | null
          created_at?: string
          event_type: string
          from_status?: string | null
          id?: string
          lead_id: string
          note?: string | null
          to_status?: string | null
        }
        Update: {
          actor_staff_id?: string | null
          created_at?: string
          event_type?: string
          from_status?: string | null
          id?: string
          lead_id?: string
          note?: string | null
          to_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_events_actor_staff_id_fkey"
            columns: ["actor_staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_events_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          assigned_staff_id: string
          campaign: string | null
          converted_application_id: string | null
          converted_at: string | null
          converted_customer_id: string | null
          created_at: string
          created_by_staff_id: string
          email: string | null
          email_normalized: string | null
          first_name: string
          follow_up_due_at: string | null
          id: string
          last_contacted_at: string | null
          last_name: string
          notes: string | null
          passport_no: string | null
          passport_normalized: string | null
          phone: string | null
          phone_normalized: string | null
          referral: string | null
          source: string
          status: string
          target_country: string | null
          updated_at: string
          visa_type: string
        }
        Insert: {
          assigned_staff_id: string
          campaign?: string | null
          converted_application_id?: string | null
          converted_at?: string | null
          converted_customer_id?: string | null
          created_at?: string
          created_by_staff_id: string
          email?: string | null
          email_normalized?: string | null
          first_name: string
          follow_up_due_at?: string | null
          id?: string
          last_contacted_at?: string | null
          last_name: string
          notes?: string | null
          passport_no?: string | null
          passport_normalized?: string | null
          phone?: string | null
          phone_normalized?: string | null
          referral?: string | null
          source?: string
          status?: string
          target_country?: string | null
          updated_at?: string
          visa_type?: string
        }
        Update: {
          assigned_staff_id?: string
          campaign?: string | null
          converted_application_id?: string | null
          converted_at?: string | null
          converted_customer_id?: string | null
          created_at?: string
          created_by_staff_id?: string
          email?: string | null
          email_normalized?: string | null
          first_name?: string
          follow_up_due_at?: string | null
          id?: string
          last_contacted_at?: string | null
          last_name?: string
          notes?: string | null
          passport_no?: string | null
          passport_normalized?: string | null
          phone?: string | null
          phone_normalized?: string | null
          referral?: string | null
          source?: string
          status?: string
          target_country?: string | null
          updated_at?: string
          visa_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_assigned_staff_id_fkey"
            columns: ["assigned_staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_converted_application_id_fkey"
            columns: ["converted_application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_converted_customer_id_fkey"
            columns: ["converted_customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_created_by_staff_id_fkey"
            columns: ["created_by_staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      message_outbox: {
        Row: {
          accepted_at: string | null
          application_id: string | null
          attempt_count: number
          body: string
          channel: string
          communication_id: string
          created_by_staff_id: string | null
          customer_id: string
          delivered_at: string | null
          failed_at: string | null
          id: string
          idempotency_key: string
          last_error_code: string | null
          next_attempt_at: string
          processing_started_at: string | null
          provider_message_id: string | null
          provider_name: string | null
          purpose: string
          queued_at: string
          recipient: string
          status: string
          subject: string | null
          template_id: string | null
        }
        Insert: {
          accepted_at?: string | null
          application_id?: string | null
          attempt_count?: number
          body: string
          channel: string
          communication_id: string
          created_by_staff_id?: string | null
          customer_id: string
          delivered_at?: string | null
          failed_at?: string | null
          id?: string
          idempotency_key: string
          last_error_code?: string | null
          next_attempt_at?: string
          processing_started_at?: string | null
          provider_message_id?: string | null
          provider_name?: string | null
          purpose?: string
          queued_at?: string
          recipient: string
          status?: string
          subject?: string | null
          template_id?: string | null
        }
        Update: {
          accepted_at?: string | null
          application_id?: string | null
          attempt_count?: number
          body?: string
          channel?: string
          communication_id?: string
          created_by_staff_id?: string | null
          customer_id?: string
          delivered_at?: string | null
          failed_at?: string | null
          id?: string
          idempotency_key?: string
          last_error_code?: string | null
          next_attempt_at?: string
          processing_started_at?: string | null
          provider_message_id?: string | null
          provider_name?: string | null
          purpose?: string
          queued_at?: string
          recipient?: string
          status?: string
          subject?: string | null
          template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "message_outbox_application_fk"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_outbox_communication_fk"
            columns: ["communication_id"]
            isOneToOne: true
            referencedRelation: "communications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_outbox_created_by_staff_fk"
            columns: ["created_by_staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_outbox_customer_fk"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_outbox_template_fk"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "message_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      message_templates: {
        Row: {
          body_template: string
          channel: string
          created_at: string
          created_by_staff_id: string | null
          id: string
          is_active: boolean
          name: string
          subject_template: string | null
          system_key: string | null
          updated_at: string
        }
        Insert: {
          body_template: string
          channel: string
          created_at?: string
          created_by_staff_id?: string | null
          id?: string
          is_active?: boolean
          name: string
          subject_template?: string | null
          system_key?: string | null
          updated_at?: string
        }
        Update: {
          body_template?: string
          channel?: string
          created_at?: string
          created_by_staff_id?: string | null
          id?: string
          is_active?: boolean
          name?: string
          subject_template?: string | null
          system_key?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_templates_created_by_staff_id_fkey"
            columns: ["created_by_staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
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
      operational_events: {
        Row: {
          error_code: string | null
          event_key: string
          first_seen_at: string
          id: string
          last_seen_at: string
          occurrence_count: number
          request_id: string | null
          resolved_at: string | null
          resolved_by_staff_id: string | null
          route: string | null
          severity: string
          source: string
          status: string
          summary: string
        }
        Insert: {
          error_code?: string | null
          event_key: string
          first_seen_at?: string
          id?: string
          last_seen_at?: string
          occurrence_count?: number
          request_id?: string | null
          resolved_at?: string | null
          resolved_by_staff_id?: string | null
          route?: string | null
          severity: string
          source: string
          status?: string
          summary: string
        }
        Update: {
          error_code?: string | null
          event_key?: string
          first_seen_at?: string
          id?: string
          last_seen_at?: string
          occurrence_count?: number
          request_id?: string | null
          resolved_at?: string | null
          resolved_by_staff_id?: string | null
          route?: string | null
          severity?: string
          source?: string
          status?: string
          summary?: string
        }
        Relationships: [
          {
            foreignKeyName: "operational_events_resolved_by_staff_fk"
            columns: ["resolved_by_staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
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
      privacy_action_approvals: {
        Row: {
          action_id: string
          created_at: string
          id: string
          reason: string
          staff_id: string
        }
        Insert: {
          action_id: string
          created_at?: string
          id?: string
          reason: string
          staff_id: string
        }
        Update: {
          action_id?: string
          created_at?: string
          id?: string
          reason?: string
          staff_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "privacy_action_approvals_action_id_fkey"
            columns: ["action_id"]
            isOneToOne: false
            referencedRelation: "privacy_action_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "privacy_action_approvals_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      privacy_action_queue: {
        Row: {
          action_type: string
          approved_at: string | null
          completed_at: string | null
          created_at: string
          customer_id: string | null
          failure_code: string | null
          id: string
          reason: string
          request_id: string | null
          requested_by_staff_id: string
          required_approvals: number
          status: string
          updated_at: string
        }
        Insert: {
          action_type: string
          approved_at?: string | null
          completed_at?: string | null
          created_at?: string
          customer_id?: string | null
          failure_code?: string | null
          id?: string
          reason: string
          request_id?: string | null
          requested_by_staff_id: string
          required_approvals: number
          status?: string
          updated_at?: string
        }
        Update: {
          action_type?: string
          approved_at?: string | null
          completed_at?: string | null
          created_at?: string
          customer_id?: string | null
          failure_code?: string | null
          id?: string
          reason?: string
          request_id?: string | null
          requested_by_staff_id?: string
          required_approvals?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "privacy_action_queue_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "privacy_action_queue_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "data_subject_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "privacy_action_queue_requested_by_staff_id_fkey"
            columns: ["requested_by_staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      privacy_audit_log: {
        Row: {
          action_id: string | null
          actor_staff_id: string | null
          created_at: string
          customer_id: string | null
          event_type: string
          id: string
          metadata: Json
          reason: string | null
        }
        Insert: {
          action_id?: string | null
          actor_staff_id?: string | null
          created_at?: string
          customer_id?: string | null
          event_type: string
          id?: string
          metadata?: Json
          reason?: string | null
        }
        Update: {
          action_id?: string | null
          actor_staff_id?: string | null
          created_at?: string
          customer_id?: string | null
          event_type?: string
          id?: string
          metadata?: Json
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "privacy_audit_log_action_id_fkey"
            columns: ["action_id"]
            isOneToOne: false
            referencedRelation: "privacy_action_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "privacy_audit_log_actor_staff_id_fkey"
            columns: ["actor_staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "privacy_audit_log_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      privacy_notice_versions: {
        Row: {
          content: string
          created_at: string
          created_by_staff_id: string | null
          effective_at: string
          id: string
          is_active: boolean
          title: string
          updated_at: string
          version: string
        }
        Insert: {
          content: string
          created_at?: string
          created_by_staff_id?: string | null
          effective_at: string
          id?: string
          is_active?: boolean
          title: string
          updated_at?: string
          version: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by_staff_id?: string | null
          effective_at?: string
          id?: string
          is_active?: boolean
          title?: string
          updated_at?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "privacy_notice_versions_created_by_staff_id_fkey"
            columns: ["created_by_staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      privacy_settings: {
        Row: {
          archive_grace_days: number
          automatic_actions_enabled: boolean
          created_at: string
          customer_retention_days: number | null
          document_retention_days: number | null
          id: string
          updated_at: string
          updated_by_staff_id: string | null
        }
        Insert: {
          archive_grace_days?: number
          automatic_actions_enabled?: boolean
          created_at?: string
          customer_retention_days?: number | null
          document_retention_days?: number | null
          id: string
          updated_at?: string
          updated_by_staff_id?: string | null
        }
        Update: {
          archive_grace_days?: number
          automatic_actions_enabled?: boolean
          created_at?: string
          customer_retention_days?: number | null
          document_retention_days?: number | null
          id?: string
          updated_at?: string
          updated_by_staff_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "privacy_settings_updated_by_staff_id_fkey"
            columns: ["updated_by_staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_job_runs: {
        Row: {
          completed_at: string | null
          error_code: string | null
          id: string
          inserted_count: number
          job_name: string
          started_at: string
          status: string
          window_key: string
        }
        Insert: {
          completed_at?: string | null
          error_code?: string | null
          id?: string
          inserted_count?: number
          job_name: string
          started_at?: string
          status?: string
          window_key: string
        }
        Update: {
          completed_at?: string | null
          error_code?: string | null
          id?: string
          inserted_count?: number
          job_name?: string
          started_at?: string
          status?: string
          window_key?: string
        }
        Relationships: []
      }
      security_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          metadata: Json
          outcome: string
          session_id: string | null
          staff_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json
          outcome: string
          session_id?: string | null
          staff_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json
          outcome?: string
          session_id?: string | null
          staff_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "security_events_staff_fk"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
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
      tags: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
        }
        Insert: {
          color: string
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
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
          admin_mfa_required: boolean
          company_name: string
          consultant_mfa_required: boolean
          contact_source_url: string | null
          contact_verified_at: string | null
          contact_verified_by_staff_id: string | null
          created_at: string
          email: string | null
          id: string
          phone: string | null
        }
        Insert: {
          admin_mfa_required?: boolean
          company_name?: string
          consultant_mfa_required?: boolean
          contact_source_url?: string | null
          contact_verified_at?: string | null
          contact_verified_by_staff_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          phone?: string | null
        }
        Update: {
          admin_mfa_required?: boolean
          company_name?: string
          consultant_mfa_required?: boolean
          contact_source_url?: string | null
          contact_verified_at?: string | null
          contact_verified_by_staff_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenants_contact_verified_by_staff_fk"
            columns: ["contact_verified_by_staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
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
      add_customer_quick_note_v1: {
        Args: { p_content: string; p_customer_id: string }
        Returns: string
      }
      anonymize_customer_v1: {
        Args: { p_customer_id: string; p_request_id: string }
        Returns: boolean
      }
      application_status_transition_allowed: {
        Args: { p_from: string; p_to: string }
        Returns: boolean
      }
      apply_message_delivery_event_v1: {
        Args: {
          p_error_code?: string
          p_outbox_id: string
          p_provider_message_id?: string
          p_status: string
        }
        Returns: boolean
      }
      approve_privacy_action_v1: {
        Args: { p_action_id: string; p_reason: string }
        Returns: boolean
      }
      archive_customers_v1: {
        Args: { p_customer_ids: string[] }
        Returns: number
      }
      bulk_update_application_status_v1: {
        Args: {
          p_action?: string
          p_application_ids: string[]
          p_status: string
        }
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
      check_login_rate_limit_v1: { Args: { p_key_hash: string }; Returns: Json }
      complete_backup_run_v1: {
        Args: {
          p_checksum_sha256: string
          p_database_row_count: number
          p_database_table_count: number
          p_run_id: string
          p_storage_bytes: number
          p_storage_object_count: number
        }
        Returns: boolean
      }
      convert_lead_v1: {
        Args: { p_lead_id: string; p_payload: Json }
        Returns: Json
      }
      create_customer_application_v1: {
        Args: { p_payload: Json }
        Returns: Json
      }
      create_customer_application_v1_core: {
        Args: { p_payload: Json }
        Returns: Json
      }
      create_data_subject_request_v1: {
        Args: { p_payload: Json }
        Returns: string
      }
      create_lead_v1: { Args: { p_payload: Json }; Returns: string }
      create_task_v1: { Args: { p_payload: Json }; Returns: string }
      current_staff_id: { Args: never; Returns: string }
      enqueue_message_v1: { Args: { p_payload: Json }; Returns: string }
      execute_privacy_action_v1: {
        Args: { p_action_id: string }
        Returns: Json
      }
      fail_backup_run_v1: {
        Args: { p_error_code: string; p_run_id: string }
        Returns: boolean
      }
      find_lead_duplicates_v1: {
        Args: { p_lead_id: string }
        Returns: {
          display_name: string
          entity_id: string
          entity_type: string
          match_reason: string
        }[]
      }
      is_admin: { Args: never; Returns: boolean }
      list_appointment_conflicts_v1: {
        Args: {
          p_application_id: string
          p_appointment_date: string
          p_duration_minutes?: number
        }
        Returns: {
          application_id: string
          appointment_date: string
          appointment_location: string
          customer_name: string
        }[]
      }
      list_archived_customer_privacy_v1: {
        Args: never
        Returns: {
          anonymized_at: string
          customer_id: string
          grace_eligible: boolean
          request_id: string
          request_status: string
          retention_hold_active: boolean
          storage_file_count: number
        }[]
      }
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
      list_current_user_sessions_v1: { Args: never; Returns: Json }
      list_privacy_lifecycle_candidates_v1: {
        Args: never
        Returns: {
          blocked_reasons: string[]
          customer_id: string
          customer_name: string
          deleted_at: string
          grace_eligible: boolean
          hold_active: boolean
          proposed_action: string
          request_id: string
          storage_file_count: number
        }[]
      }
      mark_all_notifications_read_v1: { Args: never; Returns: number }
      mark_customer_documents_deleted_v1: {
        Args: { p_customer_id: string; p_document_ids: string[] }
        Returns: number
      }
      mark_notification_read_v1: {
        Args: { p_notification_id: string }
        Returns: boolean
      }
      purge_deleted_customers_v1: {
        Args: { p_customer_ids: string[] }
        Returns: number
      }
      queue_privacy_action_v1: {
        Args: {
          p_action_type: string
          p_customer_id: string
          p_reason: string
          p_request_id: string
        }
        Returns: string
      }
      record_communication_v1: { Args: { p_payload: Json }; Returns: string }
      record_customer_consent_v1: { Args: { p_payload: Json }; Returns: string }
      record_customer_export_v1: {
        Args: { p_customer_id: string }
        Returns: boolean
      }
      record_customer_privacy_notice_v1: {
        Args: { p_payload: Json }
        Returns: string
      }
      record_login_attempt_v1: {
        Args: {
          p_key_hash: string
          p_staff_id?: string
          p_success: boolean
          p_user_id?: string
        }
        Returns: Json
      }
      record_operational_event_v1: {
        Args: {
          p_error_code?: string
          p_event_key: string
          p_request_id?: string
          p_route?: string
          p_severity: string
          p_source: string
        }
        Returns: string
      }
      record_own_security_event_v1: {
        Args: { p_event_type: string; p_outcome?: string }
        Returns: string
      }
      reject_privacy_action_v1: {
        Args: { p_action_id: string; p_reason: string }
        Returns: boolean
      }
      resolve_operational_event_v1: {
        Args: { p_event_id: string }
        Returns: boolean
      }
      restore_backup_v2: { Args: { p_backup: Json }; Returns: Json }
      restore_backup_v2_core_phase411: {
        Args: { p_backup: Json }
        Returns: Json
      }
      restore_backup_v2_core_phase45: {
        Args: { p_backup: Json }
        Returns: Json
      }
      restore_customers_v1: {
        Args: { p_customer_ids: string[] }
        Returns: number
      }
      rotate_customer_portal_token_v1: {
        Args: { p_customer_id: string; p_valid_days?: number }
        Returns: Json
      }
      run_scheduled_operations_v1: {
        Args: { p_window_key: string }
        Returns: Json
      }
      set_application_appointment_v1: {
        Args: {
          p_application_id: string
          p_appointment_date: string
          p_location: string
          p_system?: string
        }
        Returns: Json
      }
      set_appointment_status_v1: {
        Args: { p_application_id: string; p_note?: string; p_status: string }
        Returns: boolean
      }
      set_communication_delivery_v1: {
        Args: {
          p_communication_id: string
          p_failure_reason?: string
          p_status: string
        }
        Returns: undefined
      }
      set_communication_preference_v1: {
        Args: { p_payload: Json }
        Returns: boolean
      }
      set_customer_portal_access_v1: {
        Args: { p_customer_id: string; p_enabled: boolean }
        Returns: Json
      }
      set_customer_retention_hold_v1: {
        Args: { p_customer_id: string; p_hold_until: string; p_reason: string }
        Returns: boolean
      }
      set_customer_tags_v1: {
        Args: { p_customer_id: string; p_tag_ids: string[] }
        Returns: number
      }
      set_data_subject_request_status_v1: {
        Args: {
          p_request_id: string
          p_resolution_note?: string
          p_status: string
        }
        Returns: boolean
      }
      set_task_assignee_v1: {
        Args: { p_assigned_staff_id: string; p_task_id: string }
        Returns: boolean
      }
      set_task_status_v1: {
        Args: { p_status: string; p_task_id: string }
        Returns: boolean
      }
      start_backup_run_v1: {
        Args: {
          p_artifact_label: string
          p_backup_kind: string
          p_trigger_type: string
        }
        Returns: string
      }
      storage_document_id: { Args: { object_name: string }; Returns: string }
      sync_data_quality_tasks_v1: { Args: never; Returns: Json }
      sync_lead_followup_tasks_v1: { Args: never; Returns: number }
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
      update_customer_application_v1: {
        Args: {
          p_application_id: string
          p_customer_id: string
          p_payload: Json
        }
        Returns: Json
      }
      update_lead_v1: {
        Args: { p_lead_id: string; p_payload: Json }
        Returns: boolean
      }
      update_privacy_settings_v1: {
        Args: { p_payload: Json }
        Returns: boolean
      }
      update_tenant_security_settings_v1: {
        Args: { p_consultant_mfa_required: boolean }
        Returns: boolean
      }
      upsert_data_quality_task_v1: {
        Args: {
          p_application_id: string
          p_assigned_staff_id: string
          p_customer_id: string
          p_description: string
          p_due_at: string
          p_idempotency_key: string
          p_priority: string
          p_source_id: string
          p_title: string
        }
        Returns: string
      }
      upsert_message_template_v1: {
        Args: { p_payload: Json; p_template_id: string }
        Returns: string
      }
      upsert_privacy_notice_v1: {
        Args: { p_notice_id: string; p_payload: Json }
        Returns: string
      }
      verify_backup_run_v1: {
        Args: { p_checksum_sha256: string; p_run_id: string }
        Returns: boolean
      }
      verify_company_contact_v1: {
        Args: {
          p_company_name: string
          p_email: string
          p_phone: string
          p_source_url: string
        }
        Returns: {
          company_name: string
          contact_source_url: string
          contact_verified_at: string
          email: string
          phone: string
        }[]
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
