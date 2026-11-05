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
      activities: {
        Row: {
          action: string
          created_at: string
          file_name: string
          id: string
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          file_name: string
          id?: string
          user_id?: string
        }
        Update: {
          action?: string
          created_at?: string
          file_name?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      agent_actions_log: {
        Row: {
          args: Json | null
          attempt: number
          created_at: string
          error_detail: string | null
          id: string
          plan: Json | null
          result: Json | null
          source: string
          stage: string
          status: string
          task_id: string | null
          tool_name: string
          user_id: string
          verification_url: string | null
        }
        Insert: {
          args?: Json | null
          attempt?: number
          created_at?: string
          error_detail?: string | null
          id?: string
          plan?: Json | null
          result?: Json | null
          source?: string
          stage?: string
          status?: string
          task_id?: string | null
          tool_name: string
          user_id: string
          verification_url?: string | null
        }
        Update: {
          args?: Json | null
          attempt?: number
          created_at?: string
          error_detail?: string | null
          id?: string
          plan?: Json | null
          result?: Json | null
          source?: string
          stage?: string
          status?: string
          task_id?: string | null
          tool_name?: string
          user_id?: string
          verification_url?: string | null
        }
        Relationships: []
      }
      agent_conversations: {
        Row: {
          created_at: string
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      agent_messages: {
        Row: {
          conversation_id: string
          created_at: string
          id: string
          parts: Json
          role: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          id?: string
          parts: Json
          role: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          id?: string
          parts?: Json
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "agent_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_tools: {
        Row: {
          body_template: string | null
          created_at: string
          description: string
          enabled: boolean
          headers: Json
          http_method: string
          id: string
          input_schema: Json
          name: string
          updated_at: string
          url: string
          user_id: string
        }
        Insert: {
          body_template?: string | null
          created_at?: string
          description: string
          enabled?: boolean
          headers?: Json
          http_method?: string
          id?: string
          input_schema?: Json
          name: string
          updated_at?: string
          url: string
          user_id: string
        }
        Update: {
          body_template?: string | null
          created_at?: string
          description?: string
          enabled?: boolean
          headers?: Json
          http_method?: string
          id?: string
          input_schema?: Json
          name?: string
          updated_at?: string
          url?: string
          user_id?: string
        }
        Relationships: []
      }
      agents: {
        Row: {
          automation_id: string
          created_at: string
          id: string
          instructions: string
          model: string
          name: string
          order: number
          role: string | null
          services: string[]
          tools: Json
        }
        Insert: {
          automation_id: string
          created_at?: string
          id?: string
          instructions: string
          model?: string
          name: string
          order?: number
          role?: string | null
          services?: string[]
          tools?: Json
        }
        Update: {
          automation_id?: string
          created_at?: string
          id?: string
          instructions?: string
          model?: string
          name?: string
          order?: number
          role?: string | null
          services?: string[]
          tools?: Json
        }
        Relationships: [
          {
            foreignKeyName: "agents_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "automations"
            referencedColumns: ["id"]
          },
        ]
      }
      angelo_settings: {
        Row: {
          agent_name: string
          attach_pdf: boolean
          auto_send: boolean
          cc_emails: string
          company_name: string | null
          excluded_partners: string
          extra_instructions: string
          language: string
          legal_text: string
          min_amount: number
          min_days_between_reminders: number
          signature: string
          tone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          agent_name?: string
          attach_pdf?: boolean
          auto_send?: boolean
          cc_emails?: string
          company_name?: string | null
          excluded_partners?: string
          extra_instructions?: string
          language?: string
          legal_text?: string
          min_amount?: number
          min_days_between_reminders?: number
          signature?: string
          tone?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          agent_name?: string
          attach_pdf?: boolean
          auto_send?: boolean
          cc_emails?: string
          company_name?: string | null
          excluded_partners?: string
          extra_instructions?: string
          language?: string
          legal_text?: string
          min_amount?: number
          min_days_between_reminders?: number
          signature?: string
          tone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      appointments: {
        Row: {
          buffer_min: number
          category: string
          client: string | null
          created_at: string
          end_at: string
          id: string
          location: string | null
          notes: string | null
          start_at: string
          status: string
          title: string
          user_id: string
        }
        Insert: {
          buffer_min?: number
          category?: string
          client?: string | null
          created_at?: string
          end_at: string
          id?: string
          location?: string | null
          notes?: string | null
          start_at: string
          status?: string
          title: string
          user_id?: string
        }
        Update: {
          buffer_min?: number
          category?: string
          client?: string | null
          created_at?: string
          end_at?: string
          id?: string
          location?: string | null
          notes?: string | null
          start_at?: string
          status?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      assistant_logs: {
        Row: {
          action_type: string
          app: string
          created_at: string
          detail: string
          id: string
          reply: string
          request: string
          sources: string[]
          status: string
          target: string | null
          user_id: string
          value: string | null
        }
        Insert: {
          action_type?: string
          app?: string
          created_at?: string
          detail?: string
          id?: string
          reply?: string
          request?: string
          sources?: string[]
          status?: string
          target?: string | null
          user_id?: string
          value?: string | null
        }
        Update: {
          action_type?: string
          app?: string
          created_at?: string
          detail?: string
          id?: string
          reply?: string
          request?: string
          sources?: string[]
          status?: string
          target?: string | null
          user_id?: string
          value?: string | null
        }
        Relationships: []
      }
      automations: {
        Row: {
          created_at: string
          description: string | null
          id: string
          model: string
          name: string
          prompt: string | null
          state: Json
          status: Database["public"]["Enums"]["automation_status"]
          timezone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          model?: string
          name: string
          prompt?: string | null
          state?: Json
          status?: Database["public"]["Enums"]["automation_status"]
          timezone?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          model?: string
          name?: string
          prompt?: string | null
          state?: Json
          status?: Database["public"]["Enums"]["automation_status"]
          timezone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      chat_link_codes: {
        Row: {
          code: string
          consumed_at: string | null
          created_at: string
          expires_at: string
          user_id: string
        }
        Insert: {
          code: string
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          user_id: string
        }
        Update: {
          code?: string
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          user_id?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          created_at: string
          id: string
          parts: Json
          role: string
          thread_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          parts: Json
          role: string
          thread_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          parts?: Json
          role?: string
          thread_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "chat_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_threads: {
        Row: {
          created_at: string
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      cron_logs: {
        Row: {
          created_at: string
          duration_ms: number
          frequency: string | null
          id: string
          invoices_found: number
          overdue_found: number
          reason: string | null
          reminders_sent: number
          status: string
          trigger: string
          user_id: string
        }
        Insert: {
          created_at?: string
          duration_ms?: number
          frequency?: string | null
          id?: string
          invoices_found?: number
          overdue_found?: number
          reason?: string | null
          reminders_sent?: number
          status?: string
          trigger?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          duration_ms?: number
          frequency?: string | null
          id?: string
          invoices_found?: number
          overdue_found?: number
          reason?: string | null
          reminders_sent?: number
          status?: string
          trigger?: string
          user_id?: string
        }
        Relationships: []
      }
      cron_tokens: {
        Row: {
          id: number
          token: string
        }
        Insert: {
          id?: number
          token: string
        }
        Update: {
          id?: number
          token?: string
        }
        Relationships: []
      }
      debug_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          payload: Json | null
          role: string
          session_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          payload?: Json | null
          role: string
          session_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          payload?: Json | null
          role?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "debug_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "debug_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      debug_sessions: {
        Row: {
          attempts: Json
          automation_id: string
          created_at: string
          ended_at: string | null
          id: string
          issue: string
          plan: Json | null
          status: string
          summary: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          attempts?: Json
          automation_id: string
          created_at?: string
          ended_at?: string | null
          id?: string
          issue: string
          plan?: Json | null
          status?: string
          summary?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          attempts?: Json
          automation_id?: string
          created_at?: string
          ended_at?: string | null
          id?: string
          issue?: string
          plan?: Json | null
          status?: string
          summary?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "debug_sessions_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "automations"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          content: string
          created_at: string
          id: string
          status: string
          title: string
          updated_at: string
          user_id: string
          version: number
        }
        Insert: {
          content?: string
          created_at?: string
          id?: string
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
          version?: number
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
          version?: number
        }
        Relationships: []
      }
      execution_actions: {
        Row: {
          agent_name: string | null
          attempts: number | null
          duration_ms: number | null
          error: string | null
          execution_id: string
          finished_at: string | null
          id: string
          input: Json | null
          label: string
          output: Json | null
          started_at: string
          status: string
          tool: string | null
        }
        Insert: {
          agent_name?: string | null
          attempts?: number | null
          duration_ms?: number | null
          error?: string | null
          execution_id: string
          finished_at?: string | null
          id?: string
          input?: Json | null
          label: string
          output?: Json | null
          started_at?: string
          status?: string
          tool?: string | null
        }
        Update: {
          agent_name?: string | null
          attempts?: number | null
          duration_ms?: number | null
          error?: string | null
          execution_id?: string
          finished_at?: string | null
          id?: string
          input?: Json | null
          label?: string
          output?: Json | null
          started_at?: string
          status?: string
          tool?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "execution_actions_execution_id_fkey"
            columns: ["execution_id"]
            isOneToOne: false
            referencedRelation: "executions"
            referencedColumns: ["id"]
          },
        ]
      }
      execution_costs: {
        Row: {
          automation_id: string
          cost_usd: number | null
          created_at: string
          execution_id: string
          id: string
          input_tokens: number | null
          model: string | null
          output_tokens: number | null
          provider: string | null
          user_id: string
        }
        Insert: {
          automation_id: string
          cost_usd?: number | null
          created_at?: string
          execution_id: string
          id?: string
          input_tokens?: number | null
          model?: string | null
          output_tokens?: number | null
          provider?: string | null
          user_id: string
        }
        Update: {
          automation_id?: string
          cost_usd?: number | null
          created_at?: string
          execution_id?: string
          id?: string
          input_tokens?: number | null
          model?: string | null
          output_tokens?: number | null
          provider?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "execution_costs_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "automations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "execution_costs_execution_id_fkey"
            columns: ["execution_id"]
            isOneToOne: false
            referencedRelation: "executions"
            referencedColumns: ["id"]
          },
        ]
      }
      execution_logs: {
        Row: {
          agent_id: string | null
          created_at: string
          execution_id: string
          id: string
          level: string
          message: string
          payload: Json | null
          step: number
        }
        Insert: {
          agent_id?: string | null
          created_at?: string
          execution_id: string
          id?: string
          level?: string
          message: string
          payload?: Json | null
          step?: number
        }
        Update: {
          agent_id?: string | null
          created_at?: string
          execution_id?: string
          id?: string
          level?: string
          message?: string
          payload?: Json | null
          step?: number
        }
        Relationships: [
          {
            foreignKeyName: "execution_logs_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "execution_logs_execution_id_fkey"
            columns: ["execution_id"]
            isOneToOne: false
            referencedRelation: "executions"
            referencedColumns: ["id"]
          },
        ]
      }
      executions: {
        Row: {
          automation_id: string
          error: string | null
          finished_at: string | null
          id: string
          input: Json
          output: Json | null
          started_at: string
          status: Database["public"]["Enums"]["execution_status"]
          trigger_id: string | null
        }
        Insert: {
          automation_id: string
          error?: string | null
          finished_at?: string | null
          id?: string
          input?: Json
          output?: Json | null
          started_at?: string
          status?: Database["public"]["Enums"]["execution_status"]
          trigger_id?: string | null
        }
        Update: {
          automation_id?: string
          error?: string | null
          finished_at?: string | null
          id?: string
          input?: Json
          output?: Json | null
          started_at?: string
          status?: Database["public"]["Enums"]["execution_status"]
          trigger_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "executions_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "automations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "executions_trigger_id_fkey"
            columns: ["trigger_id"]
            isOneToOne: false
            referencedRelation: "triggers"
            referencedColumns: ["id"]
          },
        ]
      }
      files: {
        Row: {
          created_at: string
          deleted_at: string | null
          encrypted: boolean
          favorite: boolean
          folder_id: string | null
          id: string
          mime_type: string
          name: string
          size: number
          storage_path: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          encrypted?: boolean
          favorite?: boolean
          folder_id?: string | null
          id?: string
          mime_type?: string
          name: string
          size?: number
          storage_path: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          encrypted?: boolean
          favorite?: boolean
          folder_id?: string | null
          id?: string
          mime_type?: string
          name?: string
          size?: number
          storage_path?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "files_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "folders"
            referencedColumns: ["id"]
          },
        ]
      }
      folders: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
          user_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          name: string
          user_id?: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      gmail_credentials: {
        Row: {
          access_token: string
          created_at: string
          expires_at: string
          google_email: string | null
          refresh_token: string
          scopes: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          created_at?: string
          expires_at: string
          google_email?: string | null
          refresh_token: string
          scopes?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string
          expires_at?: string
          google_email?: string | null
          refresh_token?: string
          scopes?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      google_chat_links: {
        Row: {
          display_name: string | null
          linked_at: string
          space_id: string
          user_id: string
        }
        Insert: {
          display_name?: string | null
          linked_at?: string
          space_id: string
          user_id: string
        }
        Update: {
          display_name?: string | null
          linked_at?: string
          space_id?: string
          user_id?: string
        }
        Relationships: []
      }
      google_chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          role: string
          space_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          role: string
          space_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          role?: string
          space_id?: string
          user_id?: string
        }
        Relationships: []
      }
      google_connections: {
        Row: {
          access_token: string
          created_at: string
          expires_at: string
          google_email: string | null
          refresh_token: string
          scope: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          created_at?: string
          expires_at: string
          google_email?: string | null
          refresh_token: string
          scope: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string
          expires_at?: string
          google_email?: string | null
          refresh_token?: string
          scope?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ideas: {
        Row: {
          created_at: string
          description: string
          id: string
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string
          id?: string
          title: string
          user_id?: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      invoices_cache: {
        Row: {
          amount_residual: number
          amount_total: number
          currency: string | null
          due_date: string | null
          id: string
          invoice_date: string | null
          last_reminder_at: string | null
          last_reminder_level: number | null
          name: string
          odoo_id: number
          partner_email: string | null
          partner_id: number | null
          partner_name: string | null
          payment_state: string | null
          reminder_count: number
          sale_orders: string | null
          synced_at: string
          user_id: string
        }
        Insert: {
          amount_residual?: number
          amount_total?: number
          currency?: string | null
          due_date?: string | null
          id?: string
          invoice_date?: string | null
          last_reminder_at?: string | null
          last_reminder_level?: number | null
          name: string
          odoo_id: number
          partner_email?: string | null
          partner_id?: number | null
          partner_name?: string | null
          payment_state?: string | null
          reminder_count?: number
          sale_orders?: string | null
          synced_at?: string
          user_id?: string
        }
        Update: {
          amount_residual?: number
          amount_total?: number
          currency?: string | null
          due_date?: string | null
          id?: string
          invoice_date?: string | null
          last_reminder_at?: string | null
          last_reminder_level?: number | null
          name?: string
          odoo_id?: number
          partner_email?: string | null
          partner_id?: number | null
          partner_name?: string | null
          payment_state?: string | null
          reminder_count?: number
          sale_orders?: string | null
          synced_at?: string
          user_id?: string
        }
        Relationships: []
      }
      lab_activity: {
        Row: {
          app_key: string | null
          created_at: string
          id: string
          kind: string
          seconds_saved: number
          user_id: string
        }
        Insert: {
          app_key?: string | null
          created_at?: string
          id?: string
          kind: string
          seconds_saved?: number
          user_id?: string
        }
        Update: {
          app_key?: string | null
          created_at?: string
          id?: string
          kind?: string
          seconds_saved?: number
          user_id?: string
        }
        Relationships: []
      }
      mail_attachments: {
        Row: {
          content_type: string | null
          created_at: string
          filename: string
          id: string
          message_id: string
          size_bytes: number | null
          storage_path: string
          user_id: string
        }
        Insert: {
          content_type?: string | null
          created_at?: string
          filename: string
          id?: string
          message_id: string
          size_bytes?: number | null
          storage_path: string
          user_id: string
        }
        Update: {
          content_type?: string | null
          created_at?: string
          filename?: string
          id?: string
          message_id?: string
          size_bytes?: number | null
          storage_path?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mail_attachments_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "mail_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      mail_messages: {
        Row: {
          body_html: string | null
          body_text: string | null
          cc_addresses: string | null
          created_at: string
          folder: string
          from_address: string
          from_name: string | null
          id: string
          is_priority: boolean
          is_read: boolean
          is_starred: boolean
          provider_message_id: string | null
          raw_mime: string | null
          subject: string
          to_addresses: string
          user_id: string
        }
        Insert: {
          body_html?: string | null
          body_text?: string | null
          cc_addresses?: string | null
          created_at?: string
          folder?: string
          from_address?: string
          from_name?: string | null
          id?: string
          is_priority?: boolean
          is_read?: boolean
          is_starred?: boolean
          provider_message_id?: string | null
          raw_mime?: string | null
          subject?: string
          to_addresses?: string
          user_id: string
        }
        Update: {
          body_html?: string | null
          body_text?: string | null
          cc_addresses?: string | null
          created_at?: string
          folder?: string
          from_address?: string
          from_name?: string | null
          id?: string
          is_priority?: boolean
          is_read?: boolean
          is_starred?: boolean
          provider_message_id?: string | null
          raw_mime?: string | null
          subject?: string
          to_addresses?: string
          user_id?: string
        }
        Relationships: []
      }
      mailboxes: {
        Row: {
          created_at: string
          display_name: string
          local_part: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name: string
          local_part: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string
          local_part?: string
          user_id?: string
        }
        Relationships: []
      }
      meetings: {
        Row: {
          actions: Json
          category: string
          created_at: string
          decisions: Json
          duration_min: number
          id: string
          meeting_date: string
          next_steps: Json
          participants: Json
          risks: Json
          score_clarity: number
          score_decision: number
          score_efficiency: number
          score_engagement: number
          score_global: number
          sentiment: string
          summary: string
          title: string
          topics: Json
          transcript: string
          user_id: string
        }
        Insert: {
          actions?: Json
          category?: string
          created_at?: string
          decisions?: Json
          duration_min?: number
          id?: string
          meeting_date?: string
          next_steps?: Json
          participants?: Json
          risks?: Json
          score_clarity?: number
          score_decision?: number
          score_efficiency?: number
          score_engagement?: number
          score_global?: number
          sentiment?: string
          summary?: string
          title?: string
          topics?: Json
          transcript?: string
          user_id?: string
        }
        Update: {
          actions?: Json
          category?: string
          created_at?: string
          decisions?: Json
          duration_min?: number
          id?: string
          meeting_date?: string
          next_steps?: Json
          participants?: Json
          risks?: Json
          score_clarity?: number
          score_decision?: number
          score_efficiency?: number
          score_engagement?: number
          score_global?: number
          sentiment?: string
          summary?: string
          title?: string
          topics?: Json
          transcript?: string
          user_id?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          board: Json | null
          content: string
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          board?: Json | null
          content: string
          created_at?: string
          id?: string
          role: string
          user_id?: string
        }
        Update: {
          board?: Json | null
          content?: string
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      notes: {
        Row: {
          content: string
          created_at: string
          id: string
          pinned: boolean
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content?: string
          created_at?: string
          id?: string
          pinned?: boolean
          title?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          pinned?: boolean
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      odoo_connections: {
        Row: {
          api_key: string
          db: string
          last_tested_at: string | null
          modules: Json
          status: string
          status_message: string | null
          uid: number | null
          updated_at: string
          url: string
          user_id: string
          username: string
        }
        Insert: {
          api_key: string
          db: string
          last_tested_at?: string | null
          modules?: Json
          status?: string
          status_message?: string | null
          uid?: number | null
          updated_at?: string
          url: string
          user_id: string
          username: string
        }
        Update: {
          api_key?: string
          db?: string
          last_tested_at?: string | null
          modules?: Json
          status?: string
          status_message?: string | null
          uid?: number | null
          updated_at?: string
          url?: string
          user_id?: string
          username?: string
        }
        Relationships: []
      }
      planner_notes: {
        Row: {
          color: string
          content: string
          created_at: string
          day: string
          done: boolean
          id: string
          kind: string
          user_id: string
        }
        Insert: {
          color?: string
          content?: string
          created_at?: string
          day?: string
          done?: boolean
          id?: string
          kind?: string
          user_id: string
        }
        Update: {
          color?: string
          content?: string
          created_at?: string
          day?: string
          done?: boolean
          id?: string
          kind?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string | null
          full_name: string | null
          id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      projects: {
        Row: {
          created_at: string
          current_index: number
          data_text: string | null
          history: Json
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_index?: number
          data_text?: string | null
          history?: Json
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          current_index?: number
          data_text?: string | null
          history?: Json
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      reminder_logs: {
        Row: {
          amount_residual: number | null
          body: string | null
          created_at: string
          days_overdue: number | null
          error: string | null
          id: string
          invoice_name: string | null
          invoice_odoo_id: number | null
          level: number | null
          partner_email: string | null
          partner_name: string | null
          status: string
          subject: string | null
          user_id: string
        }
        Insert: {
          amount_residual?: number | null
          body?: string | null
          created_at?: string
          days_overdue?: number | null
          error?: string | null
          id?: string
          invoice_name?: string | null
          invoice_odoo_id?: number | null
          level?: number | null
          partner_email?: string | null
          partner_name?: string | null
          status?: string
          subject?: string | null
          user_id?: string
        }
        Update: {
          amount_residual?: number | null
          body?: string | null
          created_at?: string
          days_overdue?: number | null
          error?: string | null
          id?: string
          invoice_name?: string | null
          invoice_odoo_id?: number | null
          level?: number | null
          partner_email?: string | null
          partner_name?: string | null
          status?: string
          subject?: string | null
          user_id?: string
        }
        Relationships: []
      }
      reminder_rules: {
        Row: {
          active: boolean
          created_at: string
          days_overdue: number
          firmness: string
          id: string
          instructions: string
          level: number
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          days_overdue: number
          firmness?: string
          id?: string
          instructions?: string
          level: number
          user_id?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          days_overdue?: number
          firmness?: string
          id?: string
          instructions?: string
          level?: number
          user_id?: string
        }
        Relationships: []
      }
      run_logs: {
        Row: {
          finished_at: string | null
          id: string
          invoices_found: number
          message: string | null
          overdue_found: number
          reminders_sent: number
          started_at: string
          status: string
          trigger: string
          user_id: string
        }
        Insert: {
          finished_at?: string | null
          id?: string
          invoices_found?: number
          message?: string | null
          overdue_found?: number
          reminders_sent?: number
          started_at?: string
          status?: string
          trigger?: string
          user_id?: string
        }
        Update: {
          finished_at?: string | null
          id?: string
          invoices_found?: number
          message?: string | null
          overdue_found?: number
          reminders_sent?: number
          started_at?: string
          status?: string
          trigger?: string
          user_id?: string
        }
        Relationships: []
      }
      schedules: {
        Row: {
          day_of_month: number
          enabled: boolean
          frequency: string
          hour_utc: number
          interval_minutes: number
          last_run_at: string | null
          minute_utc: number
          updated_at: string
          user_id: string
          weekday: number
        }
        Insert: {
          day_of_month?: number
          enabled?: boolean
          frequency?: string
          hour_utc?: number
          interval_minutes?: number
          last_run_at?: string | null
          minute_utc?: number
          updated_at?: string
          user_id?: string
          weekday?: number
        }
        Update: {
          day_of_month?: number
          enabled?: boolean
          frequency?: string
          hour_utc?: number
          interval_minutes?: number
          last_run_at?: string | null
          minute_utc?: number
          updated_at?: string
          user_id?: string
          weekday?: number
        }
        Relationships: []
      }
      shares: {
        Row: {
          created_at: string
          expires_at: string | null
          file_id: string
          id: string
          permission: string
          token: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          file_id: string
          id?: string
          permission?: string
          token?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          file_id?: string
          id?: string
          permission?: string
          token?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shares_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "files"
            referencedColumns: ["id"]
          },
        ]
      }
      sky_messages: {
        Row: {
          content: string
          created_at: string
          document_id: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          document_id: string
          id?: string
          role: string
          user_id?: string
        }
        Update: {
          content?: string
          created_at?: string
          document_id?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sky_messages_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      sky_user_settings: {
        Row: {
          accent: string
          compact: boolean
          daily_goal: number
          display_name: string | null
          notifications: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          accent?: string
          compact?: boolean
          daily_goal?: number
          display_name?: string | null
          notifications?: boolean
          updated_at?: string
          user_id?: string
        }
        Update: {
          accent?: string
          compact?: boolean
          daily_goal?: number
          display_name?: string | null
          notifications?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      st_agents: {
        Row: {
          color: string
          created_at: string
          department: string
          id: string
          is_chief: boolean
          lab_apps: string[]
          model: string
          name: string
          pos_x: number
          pos_y: number
          role: string
          skills: string
          status: string
          system_prompt: string
          team_id: string | null
          temperature: number
          tone: string
          user_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          department: string
          id?: string
          is_chief?: boolean
          lab_apps?: string[]
          model?: string
          name: string
          pos_x?: number
          pos_y?: number
          role?: string
          skills?: string
          status?: string
          system_prompt?: string
          team_id?: string | null
          temperature?: number
          tone?: string
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string
          department?: string
          id?: string
          is_chief?: boolean
          lab_apps?: string[]
          model?: string
          name?: string
          pos_x?: number
          pos_y?: number
          role?: string
          skills?: string
          status?: string
          system_prompt?: string
          team_id?: string | null
          temperature?: number
          tone?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "st_agents_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "st_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      st_custom_departments: {
        Row: {
          blurb: string
          created_at: string
          default_team: string
          id: string
          key: string
          label: string
          user_id: string
        }
        Insert: {
          blurb?: string
          created_at?: string
          default_team?: string
          id?: string
          key: string
          label: string
          user_id: string
        }
        Update: {
          blurb?: string
          created_at?: string
          default_team?: string
          id?: string
          key?: string
          label?: string
          user_id?: string
        }
        Relationships: []
      }
      st_department_modules: {
        Row: {
          created_at: string
          department: string
          id: string
          modules: string[]
          user_id: string
        }
        Insert: {
          created_at?: string
          department: string
          id?: string
          modules?: string[]
          user_id: string
        }
        Update: {
          created_at?: string
          department?: string
          id?: string
          modules?: string[]
          user_id?: string
        }
        Relationships: []
      }
      st_missions: {
        Row: {
          created_at: string
          id: string
          objective: string
          status: string
          summary: string | null
          team_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          objective: string
          status?: string
          summary?: string | null
          team_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          objective?: string
          status?: string
          summary?: string | null
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "st_missions_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "st_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      st_tasks: {
        Row: {
          agent_id: string | null
          brief: string
          created_at: string
          id: string
          mission_id: string | null
          result: string | null
          status: string
          team_id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          agent_id?: string | null
          brief?: string
          created_at?: string
          id?: string
          mission_id?: string | null
          result?: string | null
          status?: string
          team_id: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          agent_id?: string | null
          brief?: string
          created_at?: string
          id?: string
          mission_id?: string | null
          result?: string | null
          status?: string
          team_id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "st_tasks_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "st_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "st_tasks_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "st_missions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "st_tasks_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "st_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      st_teams: {
        Row: {
          created_at: string
          department: string
          id: string
          mission: string | null
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          department: string
          id?: string
          mission?: string | null
          name: string
          user_id: string
        }
        Update: {
          created_at?: string
          department?: string
          id?: string
          mission?: string | null
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      task_lists: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
          user_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          name: string
          user_id?: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          completed_at: string | null
          created_at: string
          description: string | null
          due_at: string | null
          id: string
          list_id: string | null
          priority: string
          status: string
          title: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_at?: string | null
          id?: string
          list_id?: string | null
          priority?: string
          status?: string
          title: string
          user_id?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_at?: string | null
          id?: string
          list_id?: string | null
          priority?: string
          status?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "task_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      tep_agents: {
        Row: {
          color: string
          created_at: string
          department: string
          id: string
          is_chief: boolean
          model: string
          name: string
          pos_x: number
          pos_y: number
          project_id: string | null
          role: string
          skills: string
          status: string
          system_prompt: string
          team_id: string | null
          temperature: number
          tone: string
          user_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          department: string
          id?: string
          is_chief?: boolean
          model?: string
          name: string
          pos_x?: number
          pos_y?: number
          project_id?: string | null
          role?: string
          skills?: string
          status?: string
          system_prompt?: string
          team_id?: string | null
          temperature?: number
          tone?: string
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string
          department?: string
          id?: string
          is_chief?: boolean
          model?: string
          name?: string
          pos_x?: number
          pos_y?: number
          project_id?: string | null
          role?: string
          skills?: string
          status?: string
          system_prompt?: string
          team_id?: string | null
          temperature?: number
          tone?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tep_agents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "tep_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tep_agents_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "tep_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      tep_board_items: {
        Row: {
          ai_result: string | null
          color: string
          content: string
          created_at: string
          done: boolean
          due_at: string | null
          end_at: string | null
          google_event_id: string | null
          google_task_id: string | null
          h: number
          id: string
          kind: string
          mail_sent_at: string | null
          mail_subject: string | null
          mail_to: string | null
          project_id: string | null
          updated_at: string
          user_id: string
          w: number
          x: number
          y: number
        }
        Insert: {
          ai_result?: string | null
          color?: string
          content?: string
          created_at?: string
          done?: boolean
          due_at?: string | null
          end_at?: string | null
          google_event_id?: string | null
          google_task_id?: string | null
          h?: number
          id?: string
          kind?: string
          mail_sent_at?: string | null
          mail_subject?: string | null
          mail_to?: string | null
          project_id?: string | null
          updated_at?: string
          user_id: string
          w?: number
          x?: number
          y?: number
        }
        Update: {
          ai_result?: string | null
          color?: string
          content?: string
          created_at?: string
          done?: boolean
          due_at?: string | null
          end_at?: string | null
          google_event_id?: string | null
          google_task_id?: string | null
          h?: number
          id?: string
          kind?: string
          mail_sent_at?: string | null
          mail_subject?: string | null
          mail_to?: string | null
          project_id?: string | null
          updated_at?: string
          user_id?: string
          w?: number
          x?: number
          y?: number
        }
        Relationships: [
          {
            foreignKeyName: "tep_board_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "tep_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      tep_boards: {
        Row: {
          created_at: string
          id: string
          problem: string
          progress: number
          project_id: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          problem?: string
          progress?: number
          project_id?: string | null
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          problem?: string
          progress?: number
          project_id?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tep_boards_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "tep_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      tep_brands: {
        Row: {
          audience: string
          created_at: string
          description: string
          font: string
          hashtags: string
          id: string
          name: string
          pillars: string
          primary_color: string
          project_id: string | null
          secondary_color: string
          tone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          audience?: string
          created_at?: string
          description?: string
          font?: string
          hashtags?: string
          id?: string
          name?: string
          pillars?: string
          primary_color?: string
          project_id?: string | null
          secondary_color?: string
          tone?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          audience?: string
          created_at?: string
          description?: string
          font?: string
          hashtags?: string
          id?: string
          name?: string
          pillars?: string
          primary_color?: string
          project_id?: string | null
          secondary_color?: string
          tone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tep_brands_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "tep_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      tep_bubbles: {
        Row: {
          board_id: string
          content: string
          created_at: string
          done: boolean
          id: string
          kind: string
          mission: string
          objective: string
          status: string
          title: string
          updated_at: string
          user_id: string
          x: number
          y: number
        }
        Insert: {
          board_id: string
          content?: string
          created_at?: string
          done?: boolean
          id?: string
          kind?: string
          mission?: string
          objective?: string
          status?: string
          title?: string
          updated_at?: string
          user_id: string
          x?: number
          y?: number
        }
        Update: {
          board_id?: string
          content?: string
          created_at?: string
          done?: boolean
          id?: string
          kind?: string
          mission?: string
          objective?: string
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
          x?: number
          y?: number
        }
        Relationships: [
          {
            foreignKeyName: "tep_bubbles_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "tep_boards"
            referencedColumns: ["id"]
          },
        ]
      }
      tep_cards: {
        Row: {
          body: string
          color: string
          created_at: string
          data: Json
          h: number
          id: string
          parent_id: string | null
          project_id: string | null
          title: string
          type: string
          updated_at: string
          user_id: string
          w: number
          x: number
          y: number
        }
        Insert: {
          body?: string
          color?: string
          created_at?: string
          data?: Json
          h?: number
          id?: string
          parent_id?: string | null
          project_id?: string | null
          title?: string
          type?: string
          updated_at?: string
          user_id?: string
          w?: number
          x?: number
          y?: number
        }
        Update: {
          body?: string
          color?: string
          created_at?: string
          data?: Json
          h?: number
          id?: string
          parent_id?: string | null
          project_id?: string | null
          title?: string
          type?: string
          updated_at?: string
          user_id?: string
          w?: number
          x?: number
          y?: number
        }
        Relationships: [
          {
            foreignKeyName: "tep_cards_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "tep_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tep_cards_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "tep_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      tep_content_boards: {
        Row: {
          created_at: string
          id: string
          name: string
          project_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name?: string
          project_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          project_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tep_content_boards_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "tep_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      tep_content_notes: {
        Row: {
          board_id: string
          body: string
          caption: string
          color: string
          created_at: string
          data: Json
          hashtags: string
          height: number
          id: string
          image_url: string | null
          kind: string
          network: string | null
          scheduled_at: string | null
          status: string
          title: string
          updated_at: string
          user_id: string
          width: number
          x: number
          y: number
        }
        Insert: {
          board_id: string
          body?: string
          caption?: string
          color?: string
          created_at?: string
          data?: Json
          hashtags?: string
          height?: number
          id?: string
          image_url?: string | null
          kind?: string
          network?: string | null
          scheduled_at?: string | null
          status?: string
          title?: string
          updated_at?: string
          user_id: string
          width?: number
          x?: number
          y?: number
        }
        Update: {
          board_id?: string
          body?: string
          caption?: string
          color?: string
          created_at?: string
          data?: Json
          hashtags?: string
          height?: number
          id?: string
          image_url?: string | null
          kind?: string
          network?: string | null
          scheduled_at?: string | null
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
          width?: number
          x?: number
          y?: number
        }
        Relationships: [
          {
            foreignKeyName: "tep_content_notes_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "tep_content_boards"
            referencedColumns: ["id"]
          },
        ]
      }
      tep_custom_departments: {
        Row: {
          blurb: string
          created_at: string
          default_team: string
          id: string
          key: string
          label: string
          project_id: string | null
          user_id: string
        }
        Insert: {
          blurb?: string
          created_at?: string
          default_team?: string
          id?: string
          key: string
          label: string
          project_id?: string | null
          user_id: string
        }
        Update: {
          blurb?: string
          created_at?: string
          default_team?: string
          id?: string
          key?: string
          label?: string
          project_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tep_custom_departments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "tep_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      tep_department_modules: {
        Row: {
          created_at: string
          department: string
          id: string
          modules: string[]
          user_id: string
        }
        Insert: {
          created_at?: string
          department: string
          id?: string
          modules?: string[]
          user_id: string
        }
        Update: {
          created_at?: string
          department?: string
          id?: string
          modules?: string[]
          user_id?: string
        }
        Relationships: []
      }
      tep_google_connections: {
        Row: {
          created_at: string
          google_email: string | null
          refresh_token: string
          scope: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          google_email?: string | null
          refresh_token: string
          scope?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          google_email?: string | null
          refresh_token?: string
          scope?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      tep_google_oauth_states: {
        Row: {
          created_at: string
          state: string
          user_id: string
        }
        Insert: {
          created_at?: string
          state: string
          user_id: string
        }
        Update: {
          created_at?: string
          state?: string
          user_id?: string
        }
        Relationships: []
      }
      tep_links: {
        Row: {
          created_at: string
          id: string
          label: string
          project_id: string | null
          source_id: string
          target_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          label?: string
          project_id?: string | null
          source_id: string
          target_id: string
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          project_id?: string | null
          source_id?: string
          target_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tep_links_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "tep_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tep_links_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "tep_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tep_links_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "tep_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      tep_missions: {
        Row: {
          created_at: string
          id: string
          objective: string
          status: string
          summary: string | null
          team_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          objective: string
          status?: string
          summary?: string | null
          team_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          objective?: string
          status?: string
          summary?: string | null
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tep_missions_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "tep_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      tep_notes: {
        Row: {
          color: string
          content: string
          created_at: string
          data: Json
          h: number
          id: string
          parent_id: string | null
          project_id: string | null
          status: string
          title: string
          type: string
          updated_at: string
          user_id: string
          w: number
          x: number
          y: number
        }
        Insert: {
          color?: string
          content?: string
          created_at?: string
          data?: Json
          h?: number
          id?: string
          parent_id?: string | null
          project_id?: string | null
          status?: string
          title?: string
          type?: string
          updated_at?: string
          user_id: string
          w?: number
          x?: number
          y?: number
        }
        Update: {
          color?: string
          content?: string
          created_at?: string
          data?: Json
          h?: number
          id?: string
          parent_id?: string | null
          project_id?: string | null
          status?: string
          title?: string
          type?: string
          updated_at?: string
          user_id?: string
          w?: number
          x?: number
          y?: number
        }
        Relationships: [
          {
            foreignKeyName: "tep_notes_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "tep_notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tep_notes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "tep_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      tep_odoo_connections: {
        Row: {
          api_key: string
          connected: boolean
          created_at: string
          database: string
          id: string
          uid: number | null
          url: string
          user_id: string
          username: string
        }
        Insert: {
          api_key: string
          connected?: boolean
          created_at?: string
          database: string
          id?: string
          uid?: number | null
          url: string
          user_id: string
          username: string
        }
        Update: {
          api_key?: string
          connected?: boolean
          created_at?: string
          database?: string
          id?: string
          uid?: number | null
          url?: string
          user_id?: string
          username?: string
        }
        Relationships: []
      }
      tep_planning_google_connections: {
        Row: {
          access_token_ciphertext: string | null
          access_token_expires_at: string | null
          created_at: string
          google_email: string | null
          refresh_token_ciphertext: string
          scopes: string
          tasklist_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token_ciphertext?: string | null
          access_token_expires_at?: string | null
          created_at?: string
          google_email?: string | null
          refresh_token_ciphertext: string
          scopes?: string
          tasklist_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token_ciphertext?: string | null
          access_token_expires_at?: string | null
          created_at?: string
          google_email?: string | null
          refresh_token_ciphertext?: string
          scopes?: string
          tasklist_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      tep_planning_google_oauth_states: {
        Row: {
          created_at: string
          redirect_uri: string
          state: string
          user_id: string
        }
        Insert: {
          created_at?: string
          redirect_uri: string
          state: string
          user_id: string
        }
        Update: {
          created_at?: string
          redirect_uri?: string
          state?: string
          user_id?: string
        }
        Relationships: []
      }
      tep_projects: {
        Row: {
          board_type: string
          created_at: string
          id: string
          parent_board_id: string | null
          ref_id: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          board_type: string
          created_at?: string
          id?: string
          parent_board_id?: string | null
          ref_id?: string | null
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          board_type?: string
          created_at?: string
          id?: string
          parent_board_id?: string | null
          ref_id?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tep_projects_parent_board_id_fkey"
            columns: ["parent_board_id"]
            isOneToOne: false
            referencedRelation: "tep_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      tep_sketch_boards: {
        Row: {
          created_at: string
          elements: Json
          id: string
          notes: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          elements?: Json
          id?: string
          notes?: string | null
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          elements?: Json
          id?: string
          notes?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      tep_stickies: {
        Row: {
          color: string
          content: string
          created_at: string
          day: string
          done: boolean
          duration_min: number | null
          email_sent: boolean
          email_to: string | null
          google_id: string | null
          google_list_id: string | null
          id: string
          kind: string
          project_id: string | null
          start_time: string | null
          synced_at: string | null
          title: string
          updated_at: string
          user_id: string
          x: number
          y: number
        }
        Insert: {
          color?: string
          content?: string
          created_at?: string
          day: string
          done?: boolean
          duration_min?: number | null
          email_sent?: boolean
          email_to?: string | null
          google_id?: string | null
          google_list_id?: string | null
          id?: string
          kind?: string
          project_id?: string | null
          start_time?: string | null
          synced_at?: string | null
          title?: string
          updated_at?: string
          user_id: string
          x?: number
          y?: number
        }
        Update: {
          color?: string
          content?: string
          created_at?: string
          day?: string
          done?: boolean
          duration_min?: number | null
          email_sent?: boolean
          email_to?: string | null
          google_id?: string | null
          google_list_id?: string | null
          id?: string
          kind?: string
          project_id?: string | null
          start_time?: string | null
          synced_at?: string | null
          title?: string
          updated_at?: string
          user_id?: string
          x?: number
          y?: number
        }
        Relationships: [
          {
            foreignKeyName: "tep_stickies_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "tep_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      tep_tasks: {
        Row: {
          agent_id: string | null
          brief: string
          created_at: string
          id: string
          mission_id: string | null
          result: string | null
          status: string
          team_id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          agent_id?: string | null
          brief?: string
          created_at?: string
          id?: string
          mission_id?: string | null
          result?: string | null
          status?: string
          team_id: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          agent_id?: string | null
          brief?: string
          created_at?: string
          id?: string
          mission_id?: string | null
          result?: string | null
          status?: string
          team_id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tep_tasks_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "tep_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tep_tasks_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "tep_missions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tep_tasks_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "tep_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      tep_teams: {
        Row: {
          created_at: string
          department: string
          id: string
          mission: string | null
          name: string
          project_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          department: string
          id?: string
          mission?: string | null
          name: string
          project_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          department?: string
          id?: string
          mission?: string | null
          name?: string
          project_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tep_teams_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "tep_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      tep_user_settings: {
        Row: {
          ai_model: string
          board_theme: string
          created_at: string
          default_calendar_id: string
          default_tasklist_id: string | null
          display_name: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_model?: string
          board_theme?: string
          created_at?: string
          default_calendar_id?: string
          default_tasklist_id?: string | null
          display_name?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_model?: string
          board_theme?: string
          created_at?: string
          default_calendar_id?: string
          default_tasklist_id?: string | null
          display_name?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      tick_logs: {
        Row: {
          duration_ms: number
          error: string | null
          id: string
          launched_count: number
          ran_at: string
          results: Json
        }
        Insert: {
          duration_ms?: number
          error?: string | null
          id?: string
          launched_count?: number
          ran_at?: string
          results?: Json
        }
        Update: {
          duration_ms?: number
          error?: string | null
          id?: string
          launched_count?: number
          ran_at?: string
          results?: Json
        }
        Relationships: []
      }
      triggers: {
        Row: {
          automation_id: string
          config: Json
          consecutive_failures: number | null
          created_at: string
          cron_expr: string | null
          enabled: boolean
          id: string
          last_error: string | null
          last_run_at: string | null
          next_run_at: string | null
          type: Database["public"]["Enums"]["trigger_type"]
        }
        Insert: {
          automation_id: string
          config?: Json
          consecutive_failures?: number | null
          created_at?: string
          cron_expr?: string | null
          enabled?: boolean
          id?: string
          last_error?: string | null
          last_run_at?: string | null
          next_run_at?: string | null
          type: Database["public"]["Enums"]["trigger_type"]
        }
        Update: {
          automation_id?: string
          config?: Json
          consecutive_failures?: number | null
          created_at?: string
          cron_expr?: string | null
          enabled?: boolean
          id?: string
          last_error?: string | null
          last_run_at?: string | null
          next_run_at?: string | null
          type?: Database["public"]["Enums"]["trigger_type"]
        }
        Relationships: [
          {
            foreignKeyName: "triggers_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "automations"
            referencedColumns: ["id"]
          },
        ]
      }
      ui_preferences: {
        Row: {
          background_opacity: number
          background_url: string | null
          created_at: string
          sidebar_collapsed: boolean
          timezone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          background_opacity?: number
          background_url?: string | null
          created_at?: string
          sidebar_collapsed?: boolean
          timezone?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          background_opacity?: number
          background_url?: string | null
          created_at?: string
          sidebar_collapsed?: boolean
          timezone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_ai_keys: {
        Row: {
          created_at: string
          gemini_key: string | null
          openai_key: string | null
          preferred_provider: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          gemini_key?: string | null
          openai_key?: string | null
          preferred_provider?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          gemini_key?: string | null
          openai_key?: string | null
          preferred_provider?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_app_models: {
        Row: {
          app_key: string
          created_at: string
          id: string
          model_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          app_key: string
          created_at?: string
          id?: string
          model_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          app_key?: string
          created_at?: string
          id?: string
          model_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          ai_model: string
          chat_memory_size: number
          created_at: string
          email_greeting: string
          email_signature: string
          email_tone: string
          timezone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_model?: string
          chat_memory_size?: number
          created_at?: string
          email_greeting?: string
          email_signature?: string
          email_tone?: string
          timezone?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_model?: string
          chat_memory_size?: number
          created_at?: string
          email_greeting?: string
          email_signature?: string
          email_tone?: string
          timezone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      gmail_connection_status: {
        Row: {
          expires_at: string | null
          google_email: string | null
          scopes: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          expires_at?: string | null
          google_email?: string | null
          scopes?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          expires_at?: string | null
          google_email?: string | null
          scopes?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      angelo_init_user: { Args: { _uid: string }; Returns: undefined }
      is_address_available: { Args: { _local: string }; Returns: boolean }
      meets_mfa_requirement: { Args: never; Returns: boolean }
    }
    Enums: {
      automation_status: "draft" | "active" | "paused"
      execution_status: "pending" | "running" | "success" | "error"
      trigger_type: "cron" | "new_email" | "new_event" | "new_task"
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
    Enums: {
      automation_status: ["draft", "active", "paused"],
      execution_status: ["pending", "running", "success", "error"],
      trigger_type: ["cron", "new_email", "new_event", "new_task"],
    },
  },
} as const
