export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          name: string | null
          phone: string | null
          avatar_url: string | null
          role: "traveler" | "agency_owner" | "agency_member" | "master"
          agency_id: string | null
          credits_balance: number
          settings: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          name?: string | null
          phone?: string | null
          avatar_url?: string | null
          role?: "traveler" | "agency_owner" | "agency_member" | "master"
          agency_id?: string | null
          credits_balance?: number
          settings?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          email?: string
          name?: string | null
          phone?: string | null
          avatar_url?: string | null
          role?: "traveler" | "agency_owner" | "agency_member" | "master"
          agency_id?: string | null
          credits_balance?: number
          settings?: Json
          updated_at?: string
        }
      }
      agencies: {
        Row: {
          id: string
          name: string
          slug: string
          logo_url: string | null
          owner_user_id: string | null
          plan: "starter" | "pro" | "enterprise"
          status: "pending" | "active" | "suspended" | "archived"
          credits_balance: number
          settings: Json
          branding: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          logo_url?: string | null
          owner_user_id?: string | null
          plan?: "starter" | "pro" | "enterprise"
          status?: "pending" | "active" | "suspended" | "archived"
          credits_balance?: number
          settings?: Json
          branding?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          name?: string
          slug?: string
          logo_url?: string | null
          owner_user_id?: string | null
          plan?: "starter" | "pro" | "enterprise"
          status?: "pending" | "active" | "suspended" | "archived"
          credits_balance?: number
          settings?: Json
          branding?: Json
          updated_at?: string
        }
      }
      agency_subscriptions: {
        Row: {
          id: string
          agency_id: string
          plan_code: "free" | "start" | "pro" | "business"
          status: "active" | "inactive" | "cancelled" | "incomplete" | "trialing" | "past_due" | "canceled" | "unpaid"
          started_at: string | null
          expires_at: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          stripe_price_id: string | null
          current_period_start: string | null
          current_period_end: string | null
          cancel_at_period_end: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          agency_id: string
          plan_code?: "free" | "start" | "pro" | "business"
          status?: "active" | "inactive" | "cancelled" | "incomplete" | "trialing" | "past_due" | "canceled" | "unpaid"
          started_at?: string | null
          expires_at?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          stripe_price_id?: string | null
          current_period_start?: string | null
          current_period_end?: string | null
          cancel_at_period_end?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          agency_id?: string
          plan_code?: "free" | "start" | "pro" | "business"
          status?: "active" | "inactive" | "cancelled" | "incomplete" | "trialing" | "past_due" | "canceled" | "unpaid"
          started_at?: string | null
          expires_at?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          stripe_price_id?: string | null
          current_period_start?: string | null
          current_period_end?: string | null
          cancel_at_period_end?: boolean
          updated_at?: string
        }
      }
      agency_plan_credit_cycles: {
        Row: {
          id: string
          agency_id: string
          subscription_id: string | null
          plan_code: "free" | "start" | "pro" | "business"
          period_start: string
          period_end: string
          granted_credits: number
          used_credits: number
          stripe_invoice_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          agency_id: string
          subscription_id?: string | null
          plan_code: "free" | "start" | "pro" | "business"
          period_start: string
          period_end: string
          granted_credits: number
          used_credits?: number
          stripe_invoice_id?: string | null
          created_at?: string
        }
        Update: {
          agency_id?: string
          subscription_id?: string | null
          plan_code?: "free" | "start" | "pro" | "business"
          period_start?: string
          period_end?: string
          granted_credits?: number
          used_credits?: number
          stripe_invoice_id?: string | null
        }
      }
      ai_conversations: {
        Row: {
          id: string
          trip_id: string | null
          client_id: string | null
          agency_id: string | null
          owner_user_id: string | null
          source: "concierge" | "itinerary" | "documents" | "ticket_reader"
          status: "open" | "closed" | "archived"
          title: string | null
          last_message: string | null
          last_message_at: string | null
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          trip_id?: string | null
          client_id?: string | null
          agency_id?: string | null
          owner_user_id?: string | null
          source: "concierge" | "itinerary" | "documents" | "ticket_reader"
          status?: "open" | "closed" | "archived"
          title?: string | null
          last_message?: string | null
          last_message_at?: string | null
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          trip_id?: string | null
          client_id?: string | null
          agency_id?: string | null
          owner_user_id?: string | null
          source?: "concierge" | "itinerary" | "documents" | "ticket_reader"
          status?: "open" | "closed" | "archived"
          title?: string | null
          last_message?: string | null
          last_message_at?: string | null
          metadata?: Json
          updated_at?: string
        }
      }
      ai_messages: {
        Row: {
          id: string
          conversation_id: string
          role: "user" | "assistant" | "agent" | "system"
          content: string
          metadata: Json
          created_at: string
        }
        Insert: {
          id?: string
          conversation_id: string
          role: "user" | "assistant" | "agent" | "system"
          content: string
          metadata?: Json
          created_at?: string
        }
        Update: {
          role?: "user" | "assistant" | "agent" | "system"
          content?: string
          metadata?: Json
        }
      }
      ai_usage_logs: {
        Row: {
          id: string
          owner_user_id: string | null
          trip_id: string | null
          agency_id: string | null
          conversation_id: string | null
          message_id: string | null
          feature: "concierge" | "flight_extraction" | "itinerary_generation" | "document_extraction"
          model: string | null
          input_tokens: number
          output_tokens: number
          total_tokens: number
          credit_amount: number
          status: "completed" | "failed" | "skipped"
          metadata: Json
          created_at: string
        }
        Insert: {
          id?: string
          owner_user_id?: string | null
          trip_id?: string | null
          agency_id?: string | null
          conversation_id?: string | null
          message_id?: string | null
          feature: "concierge" | "flight_extraction" | "itinerary_generation" | "document_extraction"
          model?: string | null
          input_tokens?: number
          output_tokens?: number
          total_tokens?: number
          credit_amount?: number
          status?: "completed" | "failed" | "skipped"
          metadata?: Json
          created_at?: string
        }
        Update: {
          owner_user_id?: string | null
          trip_id?: string | null
          agency_id?: string | null
          conversation_id?: string | null
          message_id?: string | null
          feature?: "concierge" | "flight_extraction" | "itinerary_generation" | "document_extraction"
          model?: string | null
          input_tokens?: number
          output_tokens?: number
          total_tokens?: number
          credit_amount?: number
          status?: "completed" | "failed" | "skipped"
          metadata?: Json
        }
      }
      ai_prompts: {
        Row: {
          id: string
          code: string
          name: string
          module: "concierge" | "itinerary" | "documents" | "ticket_reader" | "accommodation_reader" | "flight_reader" | "support_assistant"
          system_prompt: string
          user_prompt_template: string | null
          is_active: boolean
          version: number
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          code: string
          name: string
          module: "concierge" | "itinerary" | "documents" | "ticket_reader" | "accommodation_reader" | "flight_reader" | "support_assistant"
          system_prompt: string
          user_prompt_template?: string | null
          is_active?: boolean
          version?: number
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          code?: string
          name?: string
          module?: "concierge" | "itinerary" | "documents" | "ticket_reader" | "accommodation_reader" | "flight_reader" | "support_assistant"
          system_prompt?: string
          user_prompt_template?: string | null
          is_active?: boolean
          version?: number
          metadata?: Json
          updated_at?: string
        }
      }
      agency_members: {
        Row: {
          id: string
          agency_id: string
          profile_id: string
          role: "owner" | "admin" | "member" | "viewer"
          status: "pending" | "active" | "inactive"
          created_at: string
        }
        Insert: {
          id?: string
          agency_id: string
          profile_id: string
          role?: "owner" | "admin" | "member" | "viewer"
          status?: "pending" | "active" | "inactive"
          created_at?: string
        }
        Update: {
          role?: "owner" | "admin" | "member" | "viewer"
          status?: "pending" | "active" | "inactive"
        }
      }
      clients: {
        Row: {
          id: string
          agency_id: string
          name: string
          email: string | null
          phone: string | null
          document: string | null
          notes: string | null
          status: "lead" | "active" | "inactive" | "archived"
          credits_balance: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          agency_id: string
          name: string
          email?: string | null
          phone?: string | null
          document?: string | null
          notes?: string | null
          status?: "lead" | "active" | "inactive" | "archived"
          credits_balance?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          agency_id?: string
          name?: string
          email?: string | null
          phone?: string | null
          document?: string | null
          notes?: string | null
          status?: "lead" | "active" | "inactive" | "archived"
          credits_balance?: number
          updated_at?: string
        }
      }
      documents: {
        Row: {
          id: string
          trip_id: string | null
          client_id: string | null
          agency_id: string | null
          owner_user_id: string | null
          name: string
          type: string
          file_url: string | null
          file_path: string | null
          mime_type: string | null
          size_bytes: number | null
          is_private: boolean
          visibility: "private" | "public_trip" | "agency_only"
          ai_extracted_data: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          trip_id?: string | null
          client_id?: string | null
          agency_id?: string | null
          owner_user_id?: string | null
          name: string
          type: string
          file_url?: string | null
          file_path?: string | null
          mime_type?: string | null
          size_bytes?: number | null
          is_private?: boolean
          visibility?: "private" | "public_trip" | "agency_only"
          ai_extracted_data?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          trip_id?: string | null
          client_id?: string | null
          agency_id?: string | null
          owner_user_id?: string | null
          name?: string
          type?: string
          file_url?: string | null
          file_path?: string | null
          mime_type?: string | null
          size_bytes?: number | null
          is_private?: boolean
          visibility?: "private" | "public_trip" | "agency_only"
          ai_extracted_data?: Json
          updated_at?: string
        }
      }
      wallets: {
        Row: {
          id: string
          owner_type: "traveler" | "agency"
          owner_user_id: string | null
          agency_id: string | null
          status: "active" | "archived"
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          owner_type: "traveler" | "agency"
          owner_user_id?: string | null
          agency_id?: string | null
          status?: "active" | "archived"
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          owner_type?: "traveler" | "agency"
          owner_user_id?: string | null
          agency_id?: string | null
          status?: "active" | "archived"
          metadata?: Json
          updated_at?: string
        }
      }
      wallet_balances: {
        Row: {
          id: string
          wallet_id: string
          asset_type: "trip_link"
          balance: number
          starter_grant_applied: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          wallet_id: string
          asset_type: "trip_link"
          balance?: number
          starter_grant_applied?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          wallet_id?: string
          asset_type?: "trip_link"
          balance?: number
          starter_grant_applied?: boolean
          updated_at?: string
        }
      }
      wallet_products: {
        Row: {
          id: string
          code: string
          name: string
          asset_type: "trip_link"
          quantity: number
          active: boolean
          stripe_price_id: string | null
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          code: string
          name: string
          asset_type: "trip_link"
          quantity: number
          active?: boolean
          stripe_price_id?: string | null
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          code?: string
          name?: string
          asset_type?: "trip_link"
          quantity?: number
          active?: boolean
          stripe_price_id?: string | null
          metadata?: Json
          updated_at?: string
        }
      }
      wallet_transactions: {
        Row: {
          id: string
          wallet_id: string
          asset_type: "trip_link"
          transaction_type: "starter_grant" | "purchase" | "consume" | "refund" | "adjustment" | "migration_grant" | "expiration"
          amount: number
          balance_after: number
          reason: string
          source: string
          trip_id: string | null
          wallet_product_id: string | null
          stripe_checkout_session_id: string | null
          stripe_payment_intent_id: string | null
          idempotency_key: string | null
          metadata: Json
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          wallet_id: string
          asset_type: "trip_link"
          transaction_type: "starter_grant" | "purchase" | "consume" | "refund" | "adjustment" | "migration_grant" | "expiration"
          amount: number
          balance_after: number
          reason: string
          source: string
          trip_id?: string | null
          wallet_product_id?: string | null
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          idempotency_key?: string | null
          metadata?: Json
          created_by?: string | null
          created_at?: string
        }
        Update: {
          wallet_id?: string
          asset_type?: "trip_link"
          transaction_type?: "starter_grant" | "purchase" | "consume" | "refund" | "adjustment" | "migration_grant" | "expiration"
          amount?: number
          balance_after?: number
          reason?: string
          source?: string
          trip_id?: string | null
          wallet_product_id?: string | null
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          idempotency_key?: string | null
          metadata?: Json
          created_by?: string | null
        }
      }
      wallet_credit_lots: {
        Row: {
          id: string
          wallet_id: string
          asset_type: "trip_link"
          source_transaction_id: string | null
          wallet_product_id: string | null
          original_amount: number
          remaining_amount: number
          expires_at: string | null
          expired_at: string | null
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          wallet_id: string
          asset_type: "trip_link"
          source_transaction_id?: string | null
          wallet_product_id?: string | null
          original_amount: number
          remaining_amount: number
          expires_at?: string | null
          expired_at?: string | null
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          wallet_id?: string
          asset_type?: "trip_link"
          source_transaction_id?: string | null
          wallet_product_id?: string | null
          original_amount?: number
          remaining_amount?: number
          expires_at?: string | null
          expired_at?: string | null
          metadata?: Json
          updated_at?: string
        }
      }
      wallet_credit_lot_allocations: {
        Row: {
          id: string
          lot_id: string
          transaction_id: string
          amount: number
          created_at: string
        }
        Insert: {
          id?: string
          lot_id: string
          transaction_id: string
          amount: number
          created_at?: string
        }
        Update: {
          lot_id?: string
          transaction_id?: string
          amount?: number
        }
      }
      trip_itineraries: {
        Row: {
          id: string
          trip_id: string
          document_id: string | null
          title: string
          mode: "simple" | "complete_pdf" | "uploaded"
          status: "draft" | "generating" | "completed" | "failed" | "uploaded"
          content: Json
          pdf_url: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          trip_id: string
          document_id?: string | null
          title: string
          mode: "simple" | "complete_pdf" | "uploaded"
          status?: "draft" | "generating" | "completed" | "failed" | "uploaded"
          content?: Json
          pdf_url?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          trip_id?: string
          document_id?: string | null
          title?: string
          mode?: "simple" | "complete_pdf" | "uploaded"
          status?: "draft" | "generating" | "completed" | "failed" | "uploaded"
          content?: Json
          pdf_url?: string | null
          created_by?: string | null
          updated_at?: string
        }
      }
      credit_transactions: {
        Row: {
          id: string
          owner_type: "traveler" | "agency" | "client"
          owner_user_id: string | null
          agency_id: string | null
          client_id: string | null
          type: "grant" | "consume" | "refund" | "adjustment" | "purchase"
          amount: number
          balance_after: number | null
          reason: string | null
          source: string | null
          metadata: Json
          created_at: string
          created_by: string | null
        }
        Insert: {
          id?: string
          owner_type: "traveler" | "agency" | "client"
          owner_user_id?: string | null
          agency_id?: string | null
          client_id?: string | null
          type: "grant" | "consume" | "refund" | "adjustment" | "purchase"
          amount: number
          balance_after?: number | null
          reason?: string | null
          source?: string | null
          metadata?: Json
          created_at?: string
          created_by?: string | null
        }
        Update: {
          owner_type?: "traveler" | "agency" | "client"
          owner_user_id?: string | null
          agency_id?: string | null
          client_id?: string | null
          type?: "grant" | "consume" | "refund" | "adjustment" | "purchase"
          amount?: number
          balance_after?: number | null
          reason?: string | null
          source?: string | null
          metadata?: Json
          created_by?: string | null
        }
      }
      traveler_subscriptions: {
        Row: {
          id: string
          user_id: string
          plan_code: "free" | "premium"
          status: "free" | "incomplete" | "trialing" | "active" | "past_due" | "canceled" | "unpaid"
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          stripe_price_id: string | null
          current_period_start: string | null
          current_period_end: string | null
          cancel_at_period_end: boolean
          vuei_plus_status: "none" | "incomplete" | "trialing" | "active" | "past_due" | "canceled" | "unpaid"
          vuei_plus_stripe_subscription_id: string | null
          vuei_plus_stripe_price_id: string | null
          vuei_plus_current_period_start: string | null
          vuei_plus_current_period_end: string | null
          vuei_plus_cancel_at_period_end: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          plan_code?: "free" | "premium"
          status?: "free" | "incomplete" | "trialing" | "active" | "past_due" | "canceled" | "unpaid"
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          stripe_price_id?: string | null
          current_period_start?: string | null
          current_period_end?: string | null
          cancel_at_period_end?: boolean
          vuei_plus_status?: "none" | "incomplete" | "trialing" | "active" | "past_due" | "canceled" | "unpaid"
          vuei_plus_stripe_subscription_id?: string | null
          vuei_plus_stripe_price_id?: string | null
          vuei_plus_current_period_start?: string | null
          vuei_plus_current_period_end?: string | null
          vuei_plus_cancel_at_period_end?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          user_id?: string
          plan_code?: "free" | "premium"
          status?: "free" | "incomplete" | "trialing" | "active" | "past_due" | "canceled" | "unpaid"
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          stripe_price_id?: string | null
          current_period_start?: string | null
          current_period_end?: string | null
          cancel_at_period_end?: boolean
          vuei_plus_status?: "none" | "incomplete" | "trialing" | "active" | "past_due" | "canceled" | "unpaid"
          vuei_plus_stripe_subscription_id?: string | null
          vuei_plus_stripe_price_id?: string | null
          vuei_plus_current_period_start?: string | null
          vuei_plus_current_period_end?: string | null
          vuei_plus_cancel_at_period_end?: boolean
          updated_at?: string
        }
      }
      traveler_plan_credit_cycles: {
        Row: {
          id: string
          user_id: string
          subscription_id: string | null
          plan_code: "free" | "premium"
          period_start: string
          period_end: string
          granted_credits: number
          used_credits: number
          expired_credits: number
          stripe_invoice_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          subscription_id?: string | null
          plan_code: "free" | "premium"
          period_start: string
          period_end: string
          granted_credits: number
          used_credits?: number
          expired_credits?: number
          stripe_invoice_id?: string | null
          created_at?: string
        }
        Update: {
          user_id?: string
          subscription_id?: string | null
          plan_code?: "free" | "premium"
          period_start?: string
          period_end?: string
          granted_credits?: number
          used_credits?: number
          expired_credits?: number
          stripe_invoice_id?: string | null
        }
      }
      stripe_events: {
        Row: {
          id: string
          type: string
          processed_at: string
          created_at: string
        }
        Insert: {
          id: string
          type: string
          processed_at?: string
          created_at?: string
        }
        Update: {
          type?: string
          processed_at?: string
        }
      }
      support_tickets: {
        Row: {
          id: string
          user_id: string | null
          agency_id: string | null
          title: string
          category: "vuei_help" | "technical_issue" | "billing" | "credits" | "trip_link" | "other"
          priority: "normal" | "urgent"
          status: "open" | "in_progress" | "resolved"
          message: string
          context: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          agency_id?: string | null
          title: string
          category: "vuei_help" | "technical_issue" | "billing" | "credits" | "trip_link" | "other"
          priority?: "normal" | "urgent"
          status?: "open" | "in_progress" | "resolved"
          message: string
          context?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          user_id?: string | null
          agency_id?: string | null
          title?: string
          category?: "vuei_help" | "technical_issue" | "billing" | "credits" | "trip_link" | "other"
          priority?: "normal" | "urgent"
          status?: "open" | "in_progress" | "resolved"
          message?: string
          context?: Json
          updated_at?: string
        }
      }
      account_limit_overrides: {
        Row: {
          id: string
          owner_type: "agency" | "traveler"
          owner_id: string
          limit_type: "clients" | "active_trips"
          quantity: number
          reason: string | null
          ticket_id: string | null
          granted_by: string | null
          expires_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          owner_type: "agency" | "traveler"
          owner_id: string
          limit_type: "clients" | "active_trips"
          quantity: number
          reason?: string | null
          ticket_id?: string | null
          granted_by?: string | null
          expires_at?: string | null
          created_at?: string
        }
        Update: {
          owner_type?: "agency" | "traveler"
          owner_id?: string
          limit_type?: "clients" | "active_trips"
          quantity?: number
          reason?: string | null
          ticket_id?: string | null
          granted_by?: string | null
          expires_at?: string | null
        }
      }
      support_messages: {
        Row: {
          id: string
          ticket_id: string
          sender_id: string | null
          sender_role: "traveler" | "agency" | "master" | "system"
          body: string
          created_at: string
        }
        Insert: {
          id?: string
          ticket_id: string
          sender_id?: string | null
          sender_role: "traveler" | "agency" | "master" | "system"
          body: string
          created_at?: string
        }
        Update: {
          ticket_id?: string
          sender_id?: string | null
          sender_role?: "traveler" | "agency" | "master" | "system"
          body?: string
        }
      }
      trip_hotels: {
        Row: {
          id: string
          trip_id: string
          name: string | null
          hotel_name: string | null
          address: string | null
          check_in: string | null
          check_out: string | null
          confirmation_code: string | null
          confirmation_number: string | null
          document_id: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          trip_id: string
          name?: string | null
          hotel_name?: string | null
          address?: string | null
          check_in?: string | null
          check_out?: string | null
          confirmation_code?: string | null
          confirmation_number?: string | null
          document_id?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          trip_id?: string
          name?: string | null
          hotel_name?: string | null
          address?: string | null
          check_in?: string | null
          check_out?: string | null
          confirmation_code?: string | null
          confirmation_number?: string | null
          document_id?: string | null
          notes?: string | null
          updated_at?: string
        }
      }
      trip_flights: {
        Row: {
          id: string
          trip_id: string
          document_id: string | null
          airline: string | null
          flight_number: string | null
          booking_reference: string | null
          origin_airport: string | null
          destination_airport: string | null
          departure_at: string | null
          arrival_at: string | null
          passenger_name: string | null
          qr_code_payload: string | null
          baggage_info: string | null
          terminal: string | null
          gate: string | null
          seat: string | null
          extracted_data: Json
          extraction_status: "pending" | "processing" | "completed" | "failed" | "manual"
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          trip_id: string
          document_id?: string | null
          airline?: string | null
          flight_number?: string | null
          booking_reference?: string | null
          origin_airport?: string | null
          destination_airport?: string | null
          departure_at?: string | null
          arrival_at?: string | null
          passenger_name?: string | null
          qr_code_payload?: string | null
          baggage_info?: string | null
          terminal?: string | null
          gate?: string | null
          seat?: string | null
          extracted_data?: Json
          extraction_status?: "pending" | "processing" | "completed" | "failed" | "manual"
          created_at?: string
          updated_at?: string
        }
        Update: {
          trip_id?: string
          document_id?: string | null
          airline?: string | null
          flight_number?: string | null
          booking_reference?: string | null
          origin_airport?: string | null
          destination_airport?: string | null
          departure_at?: string | null
          arrival_at?: string | null
          passenger_name?: string | null
          qr_code_payload?: string | null
          baggage_info?: string | null
          terminal?: string | null
          gate?: string | null
          seat?: string | null
          extracted_data?: Json
          extraction_status?: "pending" | "processing" | "completed" | "failed" | "manual"
          updated_at?: string
        }
      }
      trip_travelers: {
        Row: {
          id: string
          trip_id: string
          name: string
          role: string
          is_primary: boolean
          avatar_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          trip_id: string
          name: string
          role?: string
          is_primary?: boolean
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          trip_id?: string
          name?: string
          role?: string
          is_primary?: boolean
          avatar_url?: string | null
          updated_at?: string
        }
      }
      traveler_trip_request_idempotency: {
        Row: {
          operation: "create" | "claim"
          owner_user_id: string
          idempotency_key: string
          trip_id: string
          created_at: string
        }
        Insert: {
          operation: "create" | "claim"
          owner_user_id: string
          idempotency_key: string
          trip_id: string
          created_at?: string
        }
        Update: {
          operation?: "create" | "claim"
          owner_user_id?: string
          idempotency_key?: string
          trip_id?: string
          created_at?: string
        }
      }
      trips: {
        Row: {
          id: string
          title: string
          slug: string
          destination: string
          country: string | null
          city: string | null
          start_date: string | null
          end_date: string | null
          status: "draft" | "upcoming" | "ongoing" | "completed" | "cancelled"
          style: string | null
          owner_type: "traveler" | "agency"
          owner_user_id: string | null
          agency_id: string | null
          client_id: string | null
          admin_token: string | null
          public_token: string | null
          admin_link: string | null
          public_link: string | null
          cover_image: string | null
          visibility: "private" | "public"
          travelers_count: number
          permissions: Json
          credits_summary: Json
          offline_enabled: boolean
          source: string
          claim_token_hash: string | null
          claim_token_expires_at: string | null
          claim_token_claimed_at: string | null
          link_activated_at: string | null
          link_access_until: string | null
          link_activation_transaction_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          slug: string
          destination: string
          country?: string | null
          city?: string | null
          start_date?: string | null
          end_date?: string | null
          status?: "draft" | "upcoming" | "ongoing" | "completed" | "cancelled"
          style?: string | null
          owner_type: "traveler" | "agency"
          owner_user_id?: string | null
          agency_id?: string | null
          client_id?: string | null
          admin_token?: string | null
          public_token?: string | null
          admin_link?: string | null
          public_link?: string | null
          cover_image?: string | null
          visibility?: "private" | "public"
          travelers_count?: number
          permissions?: Json
          credits_summary?: Json
          offline_enabled?: boolean
          source?: string
          claim_token_hash?: string | null
          claim_token_expires_at?: string | null
          claim_token_claimed_at?: string | null
          link_activated_at?: string | null
          link_access_until?: string | null
          link_activation_transaction_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          title?: string
          slug?: string
          destination?: string
          country?: string | null
          city?: string | null
          start_date?: string | null
          end_date?: string | null
          status?: "draft" | "upcoming" | "ongoing" | "completed" | "cancelled"
          style?: string | null
          owner_type?: "traveler" | "agency"
          owner_user_id?: string | null
          agency_id?: string | null
          client_id?: string | null
          admin_token?: string | null
          public_token?: string | null
          admin_link?: string | null
          public_link?: string | null
          cover_image?: string | null
          visibility?: "private" | "public"
          travelers_count?: number
          permissions?: Json
          credits_summary?: Json
          offline_enabled?: boolean
          source?: string
          claim_token_hash?: string | null
          claim_token_expires_at?: string | null
          claim_token_claimed_at?: string | null
          link_activated_at?: string | null
          link_access_until?: string | null
          link_activation_transaction_id?: string | null
          updated_at?: string
        }
      }
    }
    Functions: {
      activate_traveler_trip_with_wallet: {
        Args: {
          p_trip_id: string
        }
        Returns: Json
      }
    }
  }
}
