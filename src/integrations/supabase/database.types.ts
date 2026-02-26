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
          action_type: string
          actor_user_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          metadata: Json | null
          scope: string
          scope_id: string | null
          tenant_id: string
        }
        Insert: {
          action_type: string
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          metadata?: Json | null
          scope: string
          scope_id?: string | null
          tenant_id: string
        }
        Update: {
          action_type?: string
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata?: Json | null
          scope?: string
          scope_id?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      auto_replies: {
        Row: {
          created_at: string
          deleted_at: string | null
          group_id: string | null
          id: string
          is_active: boolean
          reply_template: string
          tenant_id: string
          trigger_type: string
          trigger_value: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          group_id?: string | null
          id?: string
          is_active?: boolean
          reply_template: string
          tenant_id: string
          trigger_type: string
          trigger_value?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          group_id?: string | null
          id?: string
          is_active?: boolean
          reply_template?: string
          tenant_id?: string
          trigger_type?: string
          trigger_value?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "auto_replies_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "group_admin_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auto_replies_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auto_replies_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      bulk_campaigns: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by_user_id: string
          deleted_at: string | null
          failed_count: number
          gateway_id: string
          group_id: string
          id: string
          message_template: string
          name: string
          scheduled_at: string | null
          sent_count: number
          started_at: string | null
          status: string
          tenant_id: string
          total_recipients: number
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by_user_id: string
          deleted_at?: string | null
          failed_count?: number
          gateway_id: string
          group_id: string
          id?: string
          message_template: string
          name: string
          scheduled_at?: string | null
          sent_count?: number
          started_at?: string | null
          status?: string
          tenant_id: string
          total_recipients?: number
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by_user_id?: string
          deleted_at?: string | null
          failed_count?: number
          gateway_id?: string
          group_id?: string
          id?: string
          message_template?: string
          name?: string
          scheduled_at?: string | null
          sent_count?: number
          started_at?: string | null
          status?: string
          tenant_id?: string
          total_recipients?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bulk_campaigns_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bulk_campaigns_gateway_id_fkey"
            columns: ["gateway_id"]
            isOneToOne: false
            referencedRelation: "sms_gateways"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bulk_campaigns_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "group_admin_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bulk_campaigns_group_id_fkey"
            columns: ["group_id"]
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
          contact_id: string
          created_at: string
          delivered_at: string | null
          error_message: string | null
          failed_at: string | null
          id: string
          message_id: string | null
          phone_number: string
          sent_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          campaign_id: string
          contact_id: string
          created_at?: string
          delivered_at?: string | null
          error_message?: string | null
          failed_at?: string | null
          id?: string
          message_id?: string | null
          phone_number: string
          sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          campaign_id?: string
          contact_id?: string
          created_at?: string
          delivered_at?: string | null
          error_message?: string | null
          failed_at?: string | null
          id?: string
          message_id?: string | null
          phone_number?: string
          sent_at?: string | null
          status?: string
          updated_at?: string
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
            foreignKeyName: "bulk_recipients_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bulk_recipients_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_phones: {
        Row: {
          contact_id: string
          created_at: string
          deleted_at: string | null
          id: string
          is_primary: boolean
          phone_number: string
          updated_at: string
        }
        Insert: {
          contact_id: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_primary?: boolean
          phone_number: string
          updated_at?: string
        }
        Update: {
          contact_id?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_primary?: boolean
          phone_number?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_phones_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          created_at: string
          deleted_at: string | null
          email: string | null
          first_name: string | null
          id: string
          last_name: string | null
          metadata: Json | null
          notes: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          metadata?: Json | null
          notes?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          metadata?: Json | null
          notes?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_status_events: {
        Row: {
          created_at: string
          event_type: string
          external_id: string
          gateway_id: string | null
          id: string
          message_id: string | null
          processed: boolean
          raw_payload: Json
          status: string
        }
        Insert: {
          created_at?: string
          event_type: string
          external_id: string
          gateway_id?: string | null
          id?: string
          message_id?: string | null
          processed?: boolean
          raw_payload: Json
          status: string
        }
        Update: {
          created_at?: string
          event_type?: string
          external_id?: string
          gateway_id?: string | null
          id?: string
          message_id?: string | null
          processed?: boolean
          raw_payload?: Json
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_status_events_gateway_id_fkey"
            columns: ["gateway_id"]
            isOneToOne: false
            referencedRelation: "sms_gateways"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_status_events_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      escalation_events: {
        Row: {
          created_at: string
          escalated_to_group_id: string | null
          escalated_to_user_ids: string[] | null
          escalation_level: number
          id: string
          message_id: string
          reason: string
        }
        Insert: {
          created_at?: string
          escalated_to_group_id?: string | null
          escalated_to_user_ids?: string[] | null
          escalation_level: number
          id?: string
          message_id: string
          reason: string
        }
        Update: {
          created_at?: string
          escalated_to_group_id?: string | null
          escalated_to_user_ids?: string[] | null
          escalation_level?: number
          id?: string
          message_id?: string
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "escalation_events_escalated_to_group_id_fkey"
            columns: ["escalated_to_group_id"]
            isOneToOne: false
            referencedRelation: "group_admin_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escalation_events_escalated_to_group_id_fkey"
            columns: ["escalated_to_group_id"]
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
      gateway_fallback_inboxes: {
        Row: {
          created_at: string
          gateway_id: string
          group_id: string
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          gateway_id: string
          group_id: string
          id?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          gateway_id?: string
          group_id?: string
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gateway_fallback_inboxes_gateway_id_fkey"
            columns: ["gateway_id"]
            isOneToOne: true
            referencedRelation: "sms_gateways"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gateway_fallback_inboxes_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "group_admin_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gateway_fallback_inboxes_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      group_contacts: {
        Row: {
          contact_id: string
          created_at: string
          deleted_at: string | null
          group_id: string
          id: string
          updated_at: string
        }
        Insert: {
          contact_id: string
          created_at?: string
          deleted_at?: string | null
          group_id: string
          id?: string
          updated_at?: string
        }
        Update: {
          contact_id?: string
          created_at?: string
          deleted_at?: string | null
          group_id?: string
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_contacts_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_contacts_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "group_admin_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_contacts_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      group_memberships: {
        Row: {
          created_at: string
          deleted_at: string | null
          group_id: string
          id: string
          is_admin: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          group_id: string
          id?: string
          is_admin?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          group_id?: string
          id?: string
          is_admin?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_memberships_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "group_admin_view"
            referencedColumns: ["id"]
          },
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
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          created_at: string
          deleted_at: string | null
          depth: number
          description: string | null
          escalation_enabled: boolean
          escalation_timeout_minutes: number
          id: string
          kind: string
          min_on_duty_count: number
          name: string
          parent_group_id: string | null
          path: string[] | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          depth?: number
          description?: string | null
          escalation_enabled?: boolean
          escalation_timeout_minutes?: number
          id?: string
          kind: string
          min_on_duty_count?: number
          name: string
          parent_group_id?: string | null
          path?: string[] | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          depth?: number
          description?: string | null
          escalation_enabled?: boolean
          escalation_timeout_minutes?: number
          id?: string
          kind?: string
          min_on_duty_count?: number
          name?: string
          parent_group_id?: string | null
          path?: string[] | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "groups_parent_group_id_fkey"
            columns: ["parent_group_id"]
            isOneToOne: false
            referencedRelation: "group_admin_view"
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
            foreignKeyName: "groups_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      import_jobs: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by_user_id: string
          error_count: number
          errors: Json | null
          file_path: string | null
          group_id: string | null
          id: string
          import_type: string
          processed_rows: number
          started_at: string | null
          status: string
          success_count: number
          tenant_id: string
          total_rows: number | null
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by_user_id: string
          error_count?: number
          errors?: Json | null
          file_path?: string | null
          group_id?: string | null
          id?: string
          import_type: string
          processed_rows?: number
          started_at?: string | null
          status?: string
          success_count?: number
          tenant_id: string
          total_rows?: number | null
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by_user_id?: string
          error_count?: number
          errors?: Json | null
          file_path?: string | null
          group_id?: string | null
          id?: string
          import_type?: string
          processed_rows?: number
          started_at?: string | null
          status?: string
          success_count?: number
          tenant_id?: string
          total_rows?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_jobs_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_jobs_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "group_admin_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_jobs_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_jobs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      message_threads: {
        Row: {
          created_at: string
          deleted_at: string | null
          external_number: string
          gateway_id: string
          group_id: string
          id: string
          last_auto_reply_at: string | null
          last_message_at: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          external_number: string
          gateway_id: string
          group_id: string
          id?: string
          last_auto_reply_at?: string | null
          last_message_at?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          external_number?: string
          gateway_id?: string
          group_id?: string
          id?: string
          last_auto_reply_at?: string | null
          last_message_at?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_threads_gateway_id_fkey"
            columns: ["gateway_id"]
            isOneToOne: false
            referencedRelation: "sms_gateways"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_threads_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "group_admin_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_threads_group_id_fkey"
            columns: ["group_id"]
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
          content: string | null
          created_at: string
          deleted_at: string | null
          delivered_at: string | null
          direction: string
          error_message: string | null
          escalated_at: string | null
          escalation_level: number
          external_id: string | null
          failed_at: string | null
          from_number: string
          gateway_id: string
          id: string
          idempotency_key: string | null
          mms_media_urls: string[] | null
          received_at: string | null
          resolved_group_id: string
          sent_at: string | null
          sent_by_user_id: string | null
          status: string
          tenant_id: string
          thread_id: string
          to_number: string
          updated_at: string
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by_user_id?: string | null
          content?: string | null
          created_at?: string
          deleted_at?: string | null
          delivered_at?: string | null
          direction: string
          error_message?: string | null
          escalated_at?: string | null
          escalation_level?: number
          external_id?: string | null
          failed_at?: string | null
          from_number: string
          gateway_id: string
          id?: string
          idempotency_key?: string | null
          mms_media_urls?: string[] | null
          received_at?: string | null
          resolved_group_id: string
          sent_at?: string | null
          sent_by_user_id?: string | null
          status?: string
          tenant_id: string
          thread_id: string
          to_number: string
          updated_at?: string
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by_user_id?: string | null
          content?: string | null
          created_at?: string
          deleted_at?: string | null
          delivered_at?: string | null
          direction?: string
          error_message?: string | null
          escalated_at?: string | null
          escalation_level?: number
          external_id?: string | null
          failed_at?: string | null
          from_number?: string
          gateway_id?: string
          id?: string
          idempotency_key?: string | null
          mms_media_urls?: string[] | null
          received_at?: string | null
          resolved_group_id?: string
          sent_at?: string | null
          sent_by_user_id?: string | null
          status?: string
          tenant_id?: string
          thread_id?: string
          to_number?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_acknowledged_by_user_id_fkey"
            columns: ["acknowledged_by_user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_gateway_id_fkey"
            columns: ["gateway_id"]
            isOneToOne: false
            referencedRelation: "sms_gateways"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_resolved_group_id_fkey"
            columns: ["resolved_group_id"]
            isOneToOne: false
            referencedRelation: "group_admin_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_resolved_group_id_fkey"
            columns: ["resolved_group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sent_by_user_id_fkey"
            columns: ["sent_by_user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
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
          created_at: string
          group_id: string | null
          id: string
          is_enabled: boolean
          notification_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          group_id?: string | null
          id?: string
          is_enabled?: boolean
          notification_type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          group_id?: string | null
          id?: string
          is_enabled?: boolean
          notification_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "group_admin_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_preferences_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_queue: {
        Row: {
          channel: string
          content: string
          created_at: string
          id: string
          max_retries: number
          metadata: Json | null
          next_retry_at: string | null
          priority: string
          recipient: string
          retry_count: number
          status: string
          subject: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          channel: string
          content: string
          created_at?: string
          id?: string
          max_retries?: number
          metadata?: Json | null
          next_retry_at?: string | null
          priority?: string
          recipient: string
          retry_count?: number
          status?: string
          subject?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          channel?: string
          content?: string
          created_at?: string
          id?: string
          max_retries?: number
          metadata?: Json | null
          next_retry_at?: string | null
          priority?: string
          recipient?: string
          retry_count?: number
          status?: string
          subject?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_queue_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      on_duty_state: {
        Row: {
          created_at: string
          group_id: string
          id: string
          is_on_duty: boolean
          last_toggled_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          is_on_duty?: boolean
          last_toggled_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          is_on_duty?: boolean
          last_toggled_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "on_duty_state_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "group_admin_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "on_duty_state_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "on_duty_state_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      opening_hour_exceptions: {
        Row: {
          close_time: string | null
          created_at: string
          deleted_at: string | null
          exception_date: string
          group_id: string
          id: string
          is_closed: boolean
          label: string | null
          open_time: string | null
          updated_at: string
        }
        Insert: {
          close_time?: string | null
          created_at?: string
          deleted_at?: string | null
          exception_date: string
          group_id: string
          id?: string
          is_closed?: boolean
          label?: string | null
          open_time?: string | null
          updated_at?: string
        }
        Update: {
          close_time?: string | null
          created_at?: string
          deleted_at?: string | null
          exception_date?: string
          group_id?: string
          id?: string
          is_closed?: boolean
          label?: string | null
          open_time?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "opening_hour_exceptions_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "group_admin_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opening_hour_exceptions_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      opening_hours: {
        Row: {
          close_time: string
          created_at: string
          day_of_week: number
          deleted_at: string | null
          group_id: string
          id: string
          open_time: string
          updated_at: string
        }
        Insert: {
          close_time: string
          created_at?: string
          day_of_week: number
          deleted_at?: string | null
          group_id: string
          id?: string
          open_time: string
          updated_at?: string
        }
        Update: {
          close_time?: string
          created_at?: string
          day_of_week?: number
          deleted_at?: string | null
          group_id?: string
          id?: string
          open_time?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "opening_hours_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "group_admin_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opening_hours_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      routing_rules: {
        Row: {
          created_at: string
          deleted_at: string | null
          gateway_id: string | null
          id: string
          is_active: boolean
          match_type: string
          match_value: string
          name: string
          priority: number
          target_group_id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          gateway_id?: string | null
          id?: string
          is_active?: boolean
          match_type: string
          match_value: string
          name: string
          priority?: number
          target_group_id: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          gateway_id?: string | null
          id?: string
          is_active?: boolean
          match_type?: string
          match_value?: string
          name?: string
          priority?: number
          target_group_id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "routing_rules_gateway_id_fkey"
            columns: ["gateway_id"]
            isOneToOne: false
            referencedRelation: "sms_gateways"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "routing_rules_target_group_id_fkey"
            columns: ["target_group_id"]
            isOneToOne: false
            referencedRelation: "group_admin_view"
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
          content: string | null
          created_at: string
          delay_seconds: number
          event_type: string
          executed_at: string | null
          from_number: string
          id: string
          scenario_id: string
          to_number: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          delay_seconds?: number
          event_type: string
          executed_at?: string | null
          from_number: string
          id?: string
          scenario_id: string
          to_number: string
        }
        Update: {
          content?: string | null
          created_at?: string
          delay_seconds?: number
          event_type?: string
          executed_at?: string | null
          from_number?: string
          id?: string
          scenario_id?: string
          to_number?: string
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
          config: Json
          created_at: string
          created_by_user_id: string
          deleted_at: string | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          config?: Json
          created_at?: string
          created_by_user_id: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          created_by_user_id?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "simulation_scenarios_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "simulation_scenarios_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_gateways: {
        Row: {
          api_key_encrypted: string
          base_url: string | null
          config: Json | null
          created_at: string
          deleted_at: string | null
          id: string
          name: string
          phone_number: string
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          api_key_encrypted: string
          base_url?: string | null
          config?: Json | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          name: string
          phone_number: string
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          api_key_encrypted?: string
          base_url?: string | null
          config?: Json | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          name?: string
          phone_number?: string
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gateways_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_settings: {
        Row: {
          business_hours_enabled: boolean
          created_at: string
          default_country_code: string
          deleted_at: string | null
          id: string
          max_retry_attempts: number
          message_retention_days: number
          settings: Json
          tenant_id: string
          timezone: string
          updated_at: string
        }
        Insert: {
          business_hours_enabled?: boolean
          created_at?: string
          default_country_code?: string
          deleted_at?: string | null
          id?: string
          max_retry_attempts?: number
          message_retention_days?: number
          settings?: Json
          tenant_id: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          business_hours_enabled?: boolean
          created_at?: string
          default_country_code?: string
          deleted_at?: string | null
          id?: string
          max_retry_attempts?: number
          message_retention_days?: number
          settings?: Json
          tenant_id?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          name: string
          slug: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          name: string
          slug: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          name?: string
          slug?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          created_at: string
          deleted_at: string | null
          email: string
          full_name: string | null
          id: string
          phone_number: string | null
          role: string
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          email: string
          full_name?: string | null
          id: string
          phone_number?: string | null
          role?: string
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          email?: string
          full_name?: string | null
          id?: string
          phone_number?: string | null
          role?: string
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      whitelisted_number_group_links: {
        Row: {
          created_at: string
          group_id: string
          id: string
          priority: number
          whitelisted_number_id: string
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          priority?: number
          whitelisted_number_id: string
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          priority?: number
          whitelisted_number_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whitelisted_number_group_links_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "group_admin_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whitelisted_number_group_links_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whitelisted_number_group_links_whitelisted_number_id_fkey"
            columns: ["whitelisted_number_id"]
            isOneToOne: false
            referencedRelation: "whitelisted_numbers"
            referencedColumns: ["id"]
          },
        ]
      }
      whitelisted_numbers: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          identifier: string
          label: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          identifier: string
          label?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          identifier?: string
          label?: string | null
          tenant_id?: string
          updated_at?: string
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
      group_admin_view: {
        Row: {
          created_at: string | null
          deleted_at: string | null
          depth: number | null
          description: string | null
          escalation_enabled: boolean | null
          escalation_timeout_minutes: number | null
          id: string | null
          kind: string | null
          member_count: number | null
          min_on_duty_count: number | null
          name: string | null
          parent_group_id: string | null
          parent_name: string | null
          path: string[] | null
          tenant_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          deleted_at?: string | null
          depth?: number | null
          description?: string | null
          escalation_enabled?: boolean | null
          escalation_timeout_minutes?: number | null
          id?: string | null
          kind?: string | null
          member_count?: never
          min_on_duty_count?: number | null
          name?: string | null
          parent_group_id?: string | null
          parent_name?: never
          path?: string[] | null
          tenant_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          deleted_at?: string | null
          depth?: number | null
          description?: string | null
          escalation_enabled?: boolean | null
          escalation_timeout_minutes?: number | null
          id?: string | null
          kind?: string | null
          member_count?: never
          min_on_duty_count?: number | null
          name?: string | null
          parent_group_id?: string | null
          parent_name?: never
          path?: string[] | null
          tenant_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "groups_parent_group_id_fkey"
            columns: ["parent_group_id"]
            isOneToOne: false
            referencedRelation: "group_admin_view"
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
            foreignKeyName: "groups_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      export_contact_data: { Args: { p_phone_number: string }; Returns: Json }
      find_or_create_contact: {
        Args: {
          p_first_name?: string
          p_last_name?: string
          p_phone_number: string
          p_tenant_id: string
        }
        Returns: string
      }
      get_entity_audit_trail: {
        Args: { p_entity_id: string; p_entity_type: string; p_limit?: number }
        Returns: {
          action_type: string
          actor_email: string
          actor_user_id: string
          created_at: string
          id: string
          metadata: Json
          scope: string
        }[]
      }
      get_on_duty_users: {
        Args: { p_group_id: string }
        Returns: {
          email: string
          full_name: string
          user_id: string
        }[]
      }
      get_or_create_thread: {
        Args: {
          p_external_number: string
          p_gateway_id: string
          p_group_id: string
          p_tenant_id: string
        }
        Returns: string
      }
      get_user_accessible_groups: {
        Args: { p_user_id: string }
        Returns: {
          depth: number
          group_id: string
          group_kind: string
          group_name: string
          is_member: boolean
        }[]
      }
      hard_delete_tenant_data: {
        Args: { p_tenant_id: string }
        Returns: undefined
      }
      is_group_admin: { Args: { p_group_id: string }; Returns: boolean }
      is_group_admin_of_subtree: {
        Args: { p_target_group_id: string }
        Returns: boolean
      }
      is_number_whitelisted: {
        Args: {
          p_group_id?: string
          p_phone_number: string
          p_tenant_id: string
        }
        Returns: boolean
      }
      is_tenant_admin: { Args: never; Returns: boolean }
      is_tenant_admin_safe: { Args: never; Returns: boolean }
      log_audit_event: {
        Args: {
          p_action_type: string
          p_actor_user_id: string
          p_entity_id: string
          p_entity_type: string
          p_metadata?: Json
          p_scope: string
          p_scope_id?: string
          p_tenant_id: string
        }
        Returns: string
      }
      soft_delete_entity: {
        Args: { p_entity_id: string; p_table_name: string }
        Returns: boolean
      }
      user_group_ids: { Args: never; Returns: string[] }
      user_tenant_id: { Args: never; Returns: string }
      validate_e164_phone: { Args: { p_phone: string }; Returns: boolean }
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
