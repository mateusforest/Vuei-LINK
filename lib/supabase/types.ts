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
          owner_type: "traveler" | "agency"
          owner_user_id: string | null
          agency_id: string | null
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
          owner_type: "traveler" | "agency"
          owner_user_id?: string | null
          agency_id?: string | null
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
          owner_type?: "traveler" | "agency"
          owner_user_id?: string | null
          agency_id?: string | null
          type?: "grant" | "consume" | "refund" | "adjustment" | "purchase"
          amount?: number
          balance_after?: number | null
          reason?: string | null
          source?: string | null
          metadata?: Json
          created_by?: string | null
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
          updated_at?: string
        }
      }
    }
  }
}
