/* eslint-disable @typescript-eslint/no-empty-object-type */
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
      audit_log: {
        Row: {
          action: string
          changes: Json | null
          created_at: string | null
          entity_id: string | null
          entity_type: string
          id: string
          ip_address: unknown
          tenant_id: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          changes?: Json | null
          created_at?: string | null
          entity_id?: string | null
          entity_type: string
          id?: string
          ip_address?: unknown
          tenant_id: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          changes?: Json | null
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: unknown
          tenant_id?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      auto_reply_log: {
        Row: {
          auto_reply_id: string | null
          created_at: string | null
          id: string
          reason: string | null
          sent_message_id: string | null
          triggering_message_id: string
          was_sent: boolean
        }
        Insert: {
          auto_reply_id?: string | null
          created_at?: string | null
          id?: string
          reason?: string | null
          sent_message_id?: string | null
          triggering_message_id: string
          was_sent: boolean
        }
        Update: {
          auto_reply_id?: string | null
          created_at?: string | null
          id?: string
          reason?: string | null
          sent_message_id?: string | null
          triggering_message_id?: string
          was_sent?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "auto_reply_log_auto_reply_id_fkey"
            columns: ["auto_reply_id"]
            isOneToOne: false
            referencedRelation: "automatic_replies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auto_reply_log_sent_message_id_fkey"
            columns: ["sent_message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auto_reply_log_triggering_message_id_fkey"
            columns: ["triggering_message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      automatic_replies: {
        Row: {
          cooldown_minutes: number | null
          created_at: string | null
          group_id: string
          id: string
          is_active: boolean | null
          message_template: string
          trigger_pattern: string | null
          trigger_type: string
          updated_at: string | null
        }
        Insert: {
          cooldown_minutes?: number | null
          created_at?: string | null
          group_id: string
          id?: string
          is_active?: boolean | null
          message_template: string
          trigger_pattern?: string | null
          trigger_type: string
          updated_at?: string | null
        }
        Update: {
          cooldown_minutes?: number | null
          created_at?: string | null
          group_id?: string
          id?: string
          is_active?: boolean | null
          message_template?: string
          trigger_pattern?: string | null
          trigger_type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "automatic_replies_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      bulk_campaigns: {
        Row: {
          completed_at: string | null
          created_at: string | null
          created_by_user_id: string
          failed_count: number | null
          id: string
          message_template: string
          name: string
          scheduled_at: string | null
          sent_count: number | null
          source_group_id: string | null
          status: string
          tenant_id: string
          total_recipients: number | null
          updated_at: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          created_by_user_id: string
          failed_count?: number | null
          id?: string
          message_template: string
          name: string
          scheduled_at?: string | null
          sent_count?: number | null
          source_group_id?: string | null
          status?: string
          tenant_id: string
          total_recipients?: number | null
          updated_at?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          created_by_user_id?: string
          failed_count?: number | null
          id?: string
          message_template?: string
          name?: string
          scheduled_at?: string | null
          sent_count?: number | null
          source_group_id?: string | null
          status?: string
          tenant_id?: string
          total_recipients?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bulk_campaigns_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bulk_campaigns_source_group_id_fkey"
            columns: ["source_group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bulk_campaigns_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      bulk_recipients: {
        Row: {
          campaign_id: string
          created_at: string | null
          error_message: string | null
          id: string
          metadata: Json | null
          phone_number: string
          responded_at: string | null
          response_message_id: string | null
          sent_at: string | null
          sent_message_id: string | null
          status: string
        }
        Insert: {
          campaign_id: string
          created_at?: string | null
          error_message?: string | null
          id?: string
          metadata?: Json | null
          phone_number: string
          responded_at?: string | null
          response_message_id?: string | null
          sent_at?: string | null
          sent_message_id?: string | null
          status?: string
        }
        Update: {
          campaign_id?: string
          created_at?: string | null
          error_message?: string | null
          id?: string
          metadata?: Json | null
          phone_number?: string
          responded_at?: string | null
          response_message_id?: string | null
          sent_at?: string | null
          sent_message_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "bulk_recipients_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "bulk_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bulk_recipients_response_message_id_fkey"
            columns: ["response_message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bulk_recipients_sent_message_id_fkey"
            columns: ["sent_message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_relationships: {
        Row: {
          created_at: string | null
          id: string
          priority: number | null
          related_contact_id: string
          relationship_type: string
          subject_contact_id: string
          tenant_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          priority?: number | null
          related_contact_id: string
          relationship_type: string
          subject_contact_id: string
          tenant_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          priority?: number | null
          related_contact_id?: string
          relationship_type?: string
          subject_contact_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_relationships_related_contact_id_fkey"
            columns: ["related_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_relationships_subject_contact_id_fkey"
            columns: ["subject_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_relationships_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          created_at: string | null
          email: string | null
          external_id: string | null
          group_id: string | null
          id: string
          metadata: Json | null
          name: string
          phone_number: string | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          external_id?: string | null
          group_id?: string | null
          id?: string
          metadata?: Json | null
          name: string
          phone_number?: string | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          external_id?: string | null
          group_id?: string | null
          id?: string
          metadata?: Json | null
          name?: string
          phone_number?: string | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contacts_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      csv_import_jobs: {
        Row: {
          created_at: string | null
          created_by_user_id: string
          error_count: number | null
          error_details: Json | null
          id: string
          import_type: string
          processed_rows: number | null
          status: string
          success_count: number | null
          tenant_id: string
          total_rows: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by_user_id: string
          error_count?: number | null
          error_details?: Json | null
          id?: string
          import_type: string
          processed_rows?: number | null
          status?: string
          success_count?: number | null
          tenant_id: string
          total_rows?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by_user_id?: string
          error_count?: number | null
          error_details?: Json | null
          id?: string
          import_type?: string
          processed_rows?: number | null
          status?: string
          success_count?: number | null
          tenant_id?: string
          total_rows?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "csv_import_jobs_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "csv_import_jobs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      escalation_events: {
        Row: {
          created_at: string | null
          escalated_to_user_id: string | null
          escalation_type: string
          group_id: string
          id: string
          message_id: string
          resolved_at: string | null
        }
        Insert: {
          created_at?: string | null
          escalated_to_user_id?: string | null
          escalation_type: string
          group_id: string
          id?: string
          message_id: string
          resolved_at?: string | null
        }
        Update: {
          created_at?: string | null
          escalated_to_user_id?: string | null
          escalation_type?: string
          group_id?: string
          id?: string
          message_id?: string
          resolved_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "escalation_events_escalated_to_user_id_fkey"
            columns: ["escalated_to_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escalation_events_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escalation_events_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      gateways: {
        Row: {
          api_key: string | null
          base_url: string | null
          created_at: string | null
          fallback_group_id: string | null
          id: string
          is_default: boolean | null
          name: string
          phone_number: string
          status: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          api_key?: string | null
          base_url?: string | null
          created_at?: string | null
          fallback_group_id?: string | null
          id?: string
          is_default?: boolean | null
          name: string
          phone_number: string
          status?: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          api_key?: string | null
          base_url?: string | null
          created_at?: string | null
          fallback_group_id?: string | null
          id?: string
          is_default?: boolean | null
          name?: string
          phone_number?: string
          status?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gateways_fallback_group_id_fkey"
            columns: ["fallback_group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gateways_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      group_memberships: {
        Row: {
          group_id: string
          id: string
          joined_at: string | null
          user_id: string
        }
        Insert: {
          group_id: string
          id?: string
          joined_at?: string | null
          user_id: string
        }
        Update: {
          group_id?: string
          id?: string
          joined_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_memberships_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_memberships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          created_at: string | null
          description: string | null
          escalation_enabled: boolean | null
          escalation_timeout_minutes: number | null
          gateway_id: string | null
          id: string
          is_fallback: boolean | null
          kind: string
          name: string
          parent_group_id: string | null
          parent_id: string | null
          tenant_id: string
          timezone: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          escalation_enabled?: boolean | null
          escalation_timeout_minutes?: number | null
          gateway_id?: string | null
          id?: string
          is_fallback?: boolean | null
          kind: string
          name: string
          parent_group_id?: string | null
          parent_id?: string | null
          tenant_id: string
          timezone?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          escalation_enabled?: boolean | null
          escalation_timeout_minutes?: number | null
          gateway_id?: string | null
          id?: string
          is_fallback?: boolean | null
          kind?: string
          name?: string
          parent_group_id?: string | null
          parent_id?: string | null
          tenant_id?: string
          timezone?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "groups_gateway_id_fkey"
            columns: ["gateway_id"]
            isOneToOne: false
            referencedRelation: "gateways"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "groups_parent_group_id_fkey"
            columns: ["parent_group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "groups_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "groups_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      message_threads: {
        Row: {
          contact_phone: string
          created_at: string
          gateway_id: string
          id: string
          is_resolved: boolean
          last_message_at: string
          resolved_at: string | null
          resolved_group_id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          contact_phone: string
          created_at?: string
          gateway_id: string
          id?: string
          is_resolved?: boolean
          last_message_at?: string
          resolved_at?: string | null
          resolved_group_id: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          contact_phone?: string
          created_at?: string
          gateway_id?: string
          id?: string
          is_resolved?: boolean
          last_message_at?: string
          resolved_at?: string | null
          resolved_group_id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_threads_gateway_id_fkey"
            columns: ["gateway_id"]
            isOneToOne: false
            referencedRelation: "gateways"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_threads_resolved_group_id_fkey"
            columns: ["resolved_group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_threads_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by_user_id: string | null
          campaign_id: string | null
          content: string
          created_at: string | null
          direction: string
          external_message_id: string | null
          from_number: string
          gateway_id: string | null
          group_id: string | null
          id: string
          is_fallback: boolean
          media_urls: string[] | null
          status: string | null
          tenant_id: string
          thread_id: string | null
          thread_key: string
          to_number: string
          updated_at: string | null
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by_user_id?: string | null
          campaign_id?: string | null
          content: string
          created_at?: string | null
          direction: string
          external_message_id?: string | null
          from_number: string
          gateway_id?: string | null
          group_id?: string | null
          id?: string
          is_fallback?: boolean
          media_urls?: string[] | null
          status?: string | null
          tenant_id: string
          thread_id?: string | null
          thread_key: string
          to_number: string
          updated_at?: string | null
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by_user_id?: string | null
          campaign_id?: string | null
          content?: string
          created_at?: string | null
          direction?: string
          external_message_id?: string | null
          from_number?: string
          gateway_id?: string | null
          group_id?: string | null
          id?: string
          is_fallback?: boolean
          media_urls?: string[] | null
          status?: string | null
          tenant_id?: string
          thread_id?: string | null
          thread_key?: string
          to_number?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_acknowledged_by_user_id_fkey"
            columns: ["acknowledged_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "bulk_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_gateway_id_fkey"
            columns: ["gateway_id"]
            isOneToOne: false
            referencedRelation: "gateways"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "message_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          created_at: string | null
          email_enabled: boolean | null
          id: string
          only_when_on_duty: boolean | null
          push_enabled: boolean | null
          sms_enabled: boolean | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          email_enabled?: boolean | null
          id?: string
          only_when_on_duty?: boolean | null
          push_enabled?: boolean | null
          sms_enabled?: boolean | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          email_enabled?: boolean | null
          id?: string
          only_when_on_duty?: boolean | null
          push_enabled?: boolean | null
          sms_enabled?: boolean | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      on_duty_status: {
        Row: {
          group_id: string
          id: string
          is_on_duty: boolean
          last_toggled_at: string | null
          user_id: string
        }
        Insert: {
          group_id: string
          id?: string
          is_on_duty?: boolean
          last_toggled_at?: string | null
          user_id: string
        }
        Update: {
          group_id?: string
          id?: string
          is_on_duty?: boolean
          last_toggled_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "on_duty_status_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "on_duty_status_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      opening_hours: {
        Row: {
          close_time: string | null
          day_of_week: number
          group_id: string
          id: string
          is_open: boolean | null
          open_time: string | null
        }
        Insert: {
          close_time?: string | null
          day_of_week: number
          group_id: string
          id?: string
          is_open?: boolean | null
          open_time?: string | null
        }
        Update: {
          close_time?: string | null
          day_of_week?: number
          group_id?: string
          id?: string
          is_open?: boolean | null
          open_time?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "opening_hours_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      opening_hours_exceptions: {
        Row: {
          close_time: string | null
          description: string | null
          exception_date: string
          group_id: string
          id: string
          is_open: boolean | null
          open_time: string | null
        }
        Insert: {
          close_time?: string | null
          description?: string | null
          exception_date: string
          group_id: string
          id?: string
          is_open?: boolean | null
          open_time?: string | null
        }
        Update: {
          close_time?: string | null
          description?: string | null
          exception_date?: string
          group_id?: string
          id?: string
          is_open?: boolean | null
          open_time?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "opening_hours_exceptions_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string | null
          full_name: string | null
          id: string
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      routing_rules: {
        Row: {
          created_at: string | null
          gateway_id: string | null
          id: string
          is_active: boolean | null
          pattern: string | null
          priority: number
          rule_type: string
          target_group_id: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          gateway_id?: string | null
          id?: string
          is_active?: boolean | null
          pattern?: string | null
          priority: number
          rule_type: string
          target_group_id: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          gateway_id?: string | null
          id?: string
          is_active?: boolean | null
          pattern?: string | null
          priority?: number
          rule_type?: string
          target_group_id?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "routing_rules_gateway_id_fkey"
            columns: ["gateway_id"]
            isOneToOne: false
            referencedRelation: "gateways"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "routing_rules_target_group_id_fkey"
            columns: ["target_group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "routing_rules_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      simulation_events: {
        Row: {
          actual_outcome: Json | null
          created_at: string | null
          event_data: Json
          event_type: string
          executed_at: string | null
          expected_outcome: Json | null
          id: string
          scenario_id: string
        }
        Insert: {
          actual_outcome?: Json | null
          created_at?: string | null
          event_data: Json
          event_type: string
          executed_at?: string | null
          expected_outcome?: Json | null
          id?: string
          scenario_id: string
        }
        Update: {
          actual_outcome?: Json | null
          created_at?: string | null
          event_data?: Json
          event_type?: string
          executed_at?: string | null
          expected_outcome?: Json | null
          id?: string
          scenario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "simulation_events_scenario_id_fkey"
            columns: ["scenario_id"]
            isOneToOne: false
            referencedRelation: "simulation_scenarios"
            referencedColumns: ["id"]
          },
        ]
      }
      simulation_scenarios: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "simulation_scenarios_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          created_at: string | null
          id: string
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      users: {
        Row: {
          auth_user_id: string | null
          created_at: string | null
          email: string | null
          id: string
          name: string
          phone_number: string | null
          role: string
          status: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          auth_user_id?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          name: string
          phone_number?: string | null
          role: string
          status?: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          auth_user_id?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          name?: string
          phone_number?: string | null
          role?: string
          status?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "users_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      whitelist_group_links: {
        Row: {
          created_at: string | null
          group_id: string
          id: string
          whitelisted_number_id: string
        }
        Insert: {
          created_at?: string | null
          group_id: string
          id?: string
          whitelisted_number_id: string
        }
        Update: {
          created_at?: string | null
          group_id?: string
          id?: string
          whitelisted_number_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whitelist_group_links_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whitelist_group_links_whitelisted_number_id_fkey"
            columns: ["whitelisted_number_id"]
            isOneToOne: false
            referencedRelation: "whitelisted_numbers"
            referencedColumns: ["id"]
          },
        ]
      }
      whitelisted_numbers: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          phone_number: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          phone_number: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          phone_number?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whitelisted_numbers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cleanup_old_audit_logs: { Args: never; Returns: undefined }
      current_user_id: { Args: never; Returns: string }
      find_or_create_thread: {
        Args: {
          p_contact_phone: string
          p_gateway_id: string
          p_is_fallback?: boolean
          p_resolved_group_id: string
          p_tenant_id: string
        }
        Returns: string
      }
      get_entity_audit_trail: {
        Args: { p_entity_id: string; p_entity_type: string; p_limit?: number }
        Returns: {
          action: string
          changes: Json
          created_at: string
          id: string
          user_email: string
          user_name: string
        }[]
      }
      get_tenant_audit_activity: {
        Args: { p_limit?: number; p_tenant_id: string }
        Returns: {
          action: string
          changes: Json
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          user_name: string
        }[]
      }
      is_group_admin_for: { Args: { group_uuid: string }; Returns: boolean }
      is_tenant_admin: { Args: never; Returns: boolean }
      user_tenant_id: { Args: never; Returns: string }
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
