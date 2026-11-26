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
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          details: Json
          entity_id: string | null
          entity_type: string
          id: number
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          details?: Json
          entity_id?: string | null
          entity_type: string
          id?: never
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          details?: Json
          entity_id?: string | null
          entity_type?: string
          id?: never
        }
        Relationships: []
      }
      company_follows: {
        Row: {
          created_at: string
          startup_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          startup_id: string
          user_id?: string
        }
        Update: {
          created_at?: string
          startup_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_follows_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_follows_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      document_access_logs: {
        Row: {
          created_at: string
          document_id: string
          id: number
          user_id: string | null
        }
        Insert: {
          created_at?: string
          document_id: string
          id?: never
          user_id?: string | null
        }
        Update: {
          created_at?: string
          document_id?: string
          id?: never
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_access_logs_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "startup_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      due_diligence_requests: {
        Row: {
          asked_by: string | null
          assigned_to: string | null
          created_at: string
          id: string
          investor_org_id: string
          opportunity_id: string
          question: string
          status: Database["public"]["Enums"]["dd_status"]
          updated_at: string
        }
        Insert: {
          asked_by?: string | null
          assigned_to?: string | null
          created_at?: string
          id?: string
          investor_org_id: string
          opportunity_id: string
          question: string
          status?: Database["public"]["Enums"]["dd_status"]
          updated_at?: string
        }
        Update: {
          asked_by?: string | null
          assigned_to?: string | null
          created_at?: string
          id?: string
          investor_org_id?: string
          opportunity_id?: string
          question?: string
          status?: Database["public"]["Enums"]["dd_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "due_diligence_requests_asked_by_fkey"
            columns: ["asked_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "due_diligence_requests_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "due_diligence_requests_investor_org_id_fkey"
            columns: ["investor_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "due_diligence_requests_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "investment_opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      due_diligence_responses: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          approved_for_release: boolean
          author_id: string | null
          body: string
          created_at: string
          document_id: string | null
          id: string
          request_id: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          approved_for_release?: boolean
          author_id?: string | null
          body: string
          created_at?: string
          document_id?: string | null
          id?: string
          request_id: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          approved_for_release?: boolean
          author_id?: string | null
          body?: string
          created_at?: string
          document_id?: string | null
          id?: string
          request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "due_diligence_responses_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "due_diligence_responses_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "due_diligence_responses_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "startup_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "due_diligence_responses_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "due_diligence_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      follow_ups: {
        Row: {
          assigned_to: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          id: string
          investor_id: string | null
          is_done: boolean
          opportunity_id: string | null
          priority: Database["public"]["Enums"]["priority_level"]
          startup_id: string | null
          title: string
        }
        Insert: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          investor_id?: string | null
          is_done?: boolean
          opportunity_id?: string | null
          priority?: Database["public"]["Enums"]["priority_level"]
          startup_id?: string | null
          title: string
        }
        Update: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          investor_id?: string | null
          is_done?: boolean
          opportunity_id?: string | null
          priority?: Database["public"]["Enums"]["priority_level"]
          startup_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "follow_ups_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follow_ups_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follow_ups_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "investors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follow_ups_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "investment_opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follow_ups_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startups"
            referencedColumns: ["id"]
          },
        ]
      }
      funding_rounds: {
        Row: {
          added_by: string | null
          amount_usd: number | null
          announced_on: string | null
          created_at: string
          data_key: string | null
          id: string
          note: string | null
          round_type: string | null
          source_record_id: string
          startup_id: string
        }
        Insert: {
          added_by?: string | null
          amount_usd?: number | null
          announced_on?: string | null
          created_at?: string
          data_key?: string | null
          id?: string
          note?: string | null
          round_type?: string | null
          source_record_id: string
          startup_id: string
        }
        Update: {
          added_by?: string | null
          amount_usd?: number | null
          announced_on?: string | null
          created_at?: string
          data_key?: string | null
          id?: string
          note?: string | null
          round_type?: string | null
          source_record_id?: string
          startup_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "funding_rounds_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funding_rounds_source_record_id_fkey"
            columns: ["source_record_id"]
            isOneToOne: false
            referencedRelation: "startup_public_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funding_rounds_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startups"
            referencedColumns: ["id"]
          },
        ]
      }
      investment_opportunities: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          created_by: string | null
          id: string
          key_risks: string | null
          max_ticket: number | null
          memo: string | null
          min_ticket: number | null
          owner_id: string | null
          review_date: string | null
          sector: string | null
          shared_at: string | null
          stage: string | null
          startup_id: string
          status: Database["public"]["Enums"]["opportunity_status"]
          structure: string | null
          target_amount: number | null
          thesis: string | null
          title: string
          traction_highlights: string | null
          updated_at: string
          updated_by: string | null
          use_of_proceeds: string | null
          valuation: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          key_risks?: string | null
          max_ticket?: number | null
          memo?: string | null
          min_ticket?: number | null
          owner_id?: string | null
          review_date?: string | null
          sector?: string | null
          shared_at?: string | null
          stage?: string | null
          startup_id: string
          status?: Database["public"]["Enums"]["opportunity_status"]
          structure?: string | null
          target_amount?: number | null
          thesis?: string | null
          title: string
          traction_highlights?: string | null
          updated_at?: string
          updated_by?: string | null
          use_of_proceeds?: string | null
          valuation?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          key_risks?: string | null
          max_ticket?: number | null
          memo?: string | null
          min_ticket?: number | null
          owner_id?: string | null
          review_date?: string | null
          sector?: string | null
          shared_at?: string | null
          stage?: string | null
          startup_id?: string
          status?: Database["public"]["Enums"]["opportunity_status"]
          structure?: string | null
          target_amount?: number | null
          thesis?: string | null
          title?: string
          traction_highlights?: string | null
          updated_at?: string
          updated_by?: string | null
          use_of_proceeds?: string | null
          valuation?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "investment_opportunities_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investment_opportunities_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investment_opportunities_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investment_opportunities_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investment_opportunities_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      investor_contacts: {
        Row: {
          created_at: string
          email: string | null
          full_name: string
          id: string
          investor_id: string
          is_primary: boolean
          linkedin: string | null
          title: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          investor_id: string
          is_primary?: boolean
          linkedin?: string | null
          title?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          investor_id?: string
          is_primary?: boolean
          linkedin?: string | null
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "investor_contacts_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "investors"
            referencedColumns: ["id"]
          },
        ]
      }
      investor_interests: {
        Row: {
          created_at: string
          id: string
          indicative_amount: number | null
          investor_org_id: string
          level: Database["public"]["Enums"]["interest_level"]
          note: string | null
          opportunity_id: string
          submitted_by: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          indicative_amount?: number | null
          investor_org_id: string
          level: Database["public"]["Enums"]["interest_level"]
          note?: string | null
          opportunity_id: string
          submitted_by?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          indicative_amount?: number | null
          investor_org_id?: string
          level?: Database["public"]["Enums"]["interest_level"]
          note?: string | null
          opportunity_id?: string
          submitted_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "investor_interests_investor_org_id_fkey"
            columns: ["investor_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_interests_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "investment_opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_interests_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      investor_preferences: {
        Row: {
          central_asia_interest: boolean
          co_invest_appetite:
            | Database["public"]["Enums"]["priority_level"]
            | null
          fund_size: number | null
          fund_size_verified: boolean
          geographies: string[]
          investor_id: string
          max_check: number | null
          min_check: number | null
          sectors: string[]
          stages: string[]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          central_asia_interest?: boolean
          co_invest_appetite?:
            | Database["public"]["Enums"]["priority_level"]
            | null
          fund_size?: number | null
          fund_size_verified?: boolean
          geographies?: string[]
          investor_id: string
          max_check?: number | null
          min_check?: number | null
          sectors?: string[]
          stages?: string[]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          central_asia_interest?: boolean
          co_invest_appetite?:
            | Database["public"]["Enums"]["priority_level"]
            | null
          fund_size?: number | null
          fund_size_verified?: boolean
          geographies?: string[]
          investor_id?: string
          max_check?: number | null
          min_check?: number | null
          sectors?: string[]
          stages?: string[]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "investor_preferences_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: true
            referencedRelation: "investors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_preferences_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      investor_relationships: {
        Row: {
          investor_id: string
          last_contact_at: string | null
          next_follow_up_at: string | null
          owner_id: string | null
          priority: Database["public"]["Enums"]["priority_level"]
          status: Database["public"]["Enums"]["relationship_status"]
          tags: string[]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          investor_id: string
          last_contact_at?: string | null
          next_follow_up_at?: string | null
          owner_id?: string | null
          priority?: Database["public"]["Enums"]["priority_level"]
          status?: Database["public"]["Enums"]["relationship_status"]
          tags?: string[]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          investor_id?: string
          last_contact_at?: string | null
          next_follow_up_at?: string | null
          owner_id?: string | null
          priority?: Database["public"]["Enums"]["priority_level"]
          status?: Database["public"]["Enums"]["relationship_status"]
          tags?: string[]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "investor_relationships_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: true
            referencedRelation: "investors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_relationships_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_relationships_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      investors: {
        Row: {
          category: Database["public"]["Enums"]["investor_category"]
          created_at: string
          created_by: string | null
          description: string | null
          evidence_date: string | null
          evidence_summary: string | null
          evidence_type: string | null
          evidence_url: string | null
          headquarters: string | null
          id: string
          org_id: string
          portfolio_highlights: string | null
          thesis: string | null
          updated_at: string
          updated_by: string | null
          uzbek_companies: string[]
        }
        Insert: {
          category?: Database["public"]["Enums"]["investor_category"]
          created_at?: string
          created_by?: string | null
          description?: string | null
          evidence_date?: string | null
          evidence_summary?: string | null
          evidence_type?: string | null
          evidence_url?: string | null
          headquarters?: string | null
          id?: string
          org_id: string
          portfolio_highlights?: string | null
          thesis?: string | null
          updated_at?: string
          updated_by?: string | null
          uzbek_companies?: string[]
        }
        Update: {
          category?: Database["public"]["Enums"]["investor_category"]
          created_at?: string
          created_by?: string | null
          description?: string | null
          evidence_date?: string | null
          evidence_summary?: string | null
          evidence_type?: string | null
          evidence_url?: string | null
          headquarters?: string | null
          id?: string
          org_id?: string
          portfolio_highlights?: string | null
          thesis?: string | null
          updated_at?: string
          updated_by?: string | null
          uzbek_companies?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "investors_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investors_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investors_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_notes: {
        Row: {
          meeting_id: string
          notes: string | null
          outcome: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          meeting_id: string
          notes?: string | null
          outcome?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          meeting_id?: string
          notes?: string | null
          outcome?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meeting_notes_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: true
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_notes_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_participants: {
        Row: {
          email: string | null
          id: string
          meeting_id: string
          name: string
          user_id: string | null
        }
        Insert: {
          email?: string | null
          id?: string
          meeting_id: string
          name: string
          user_id?: string | null
        }
        Update: {
          email?: string | null
          id?: string
          meeting_id?: string
          name?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meeting_participants_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      meetings: {
        Row: {
          agenda: string | null
          created_at: string
          duration_min: number
          id: string
          investor_org_id: string | null
          location: string | null
          opportunity_id: string | null
          owner_id: string | null
          requested_by: string | null
          starts_at: string | null
          startup_id: string | null
          status: Database["public"]["Enums"]["meeting_status"]
          title: string
          updated_at: string
          visible_to_investor: boolean
          visible_to_startup: boolean
        }
        Insert: {
          agenda?: string | null
          created_at?: string
          duration_min?: number
          id?: string
          investor_org_id?: string | null
          location?: string | null
          opportunity_id?: string | null
          owner_id?: string | null
          requested_by?: string | null
          starts_at?: string | null
          startup_id?: string | null
          status?: Database["public"]["Enums"]["meeting_status"]
          title: string
          updated_at?: string
          visible_to_investor?: boolean
          visible_to_startup?: boolean
        }
        Update: {
          agenda?: string | null
          created_at?: string
          duration_min?: number
          id?: string
          investor_org_id?: string | null
          location?: string | null
          opportunity_id?: string | null
          owner_id?: string | null
          requested_by?: string | null
          starts_at?: string | null
          startup_id?: string | null
          status?: Database["public"]["Enums"]["meeting_status"]
          title?: string
          updated_at?: string
          visible_to_investor?: boolean
          visible_to_startup?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "meetings_investor_org_id_fkey"
            columns: ["investor_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "investment_opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startups"
            referencedColumns: ["id"]
          },
        ]
      }
      notes: {
        Row: {
          body: string
          created_at: string
          created_by: string | null
          entity_id: string
          entity_type: string
          id: string
          is_assessment: boolean
        }
        Insert: {
          body: string
          created_at?: string
          created_by?: string | null
          entity_id: string
          entity_type: string
          id?: string
          is_assessment?: boolean
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string | null
          entity_id?: string
          entity_type?: string
          id?: string
          is_assessment?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "notes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          kind: string | null
          link: string | null
          params: Json
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          kind?: string | null
          link?: string | null
          params?: Json
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          kind?: string | null
          link?: string | null
          params?: Json
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunity_access: {
        Row: {
          granted_at: string
          granted_by: string | null
          id: string
          investor_org_id: string
          opportunity_id: string
        }
        Insert: {
          granted_at?: string
          granted_by?: string | null
          id?: string
          investor_org_id: string
          opportunity_id: string
        }
        Update: {
          granted_at?: string
          granted_by?: string | null
          id?: string
          investor_org_id?: string
          opportunity_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "opportunity_access_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunity_access_investor_org_id_fkey"
            columns: ["investor_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunity_access_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "investment_opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunity_documents: {
        Row: {
          added_by: string | null
          created_at: string
          document_id: string
          id: string
          opportunity_id: string
        }
        Insert: {
          added_by?: string | null
          created_at?: string
          document_id: string
          id?: string
          opportunity_id: string
        }
        Update: {
          added_by?: string | null
          created_at?: string
          document_id?: string
          id?: string
          opportunity_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "opportunity_documents_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunity_documents_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "startup_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunity_documents_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "investment_opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunity_status_history: {
        Row: {
          changed_by: string | null
          created_at: string
          from_status: Database["public"]["Enums"]["opportunity_status"] | null
          id: string
          note: string | null
          opportunity_id: string
          to_status: Database["public"]["Enums"]["opportunity_status"]
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["opportunity_status"] | null
          id?: string
          note?: string | null
          opportunity_id: string
          to_status: Database["public"]["Enums"]["opportunity_status"]
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["opportunity_status"] | null
          id?: string
          note?: string | null
          opportunity_id?: string
          to_status?: Database["public"]["Enums"]["opportunity_status"]
        }
        Relationships: [
          {
            foreignKeyName: "opportunity_status_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunity_status_history_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "investment_opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          is_org_admin: boolean
          org_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          is_org_admin?: boolean
          org_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          is_org_admin?: boolean
          org_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          country: string | null
          created_at: string
          deleted_at: string | null
          id: string
          is_demo: boolean
          name: string
          type: Database["public"]["Enums"]["org_type"]
          updated_at: string
          website: string | null
        }
        Insert: {
          country?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_demo?: boolean
          name: string
          type: Database["public"]["Enums"]["org_type"]
          updated_at?: string
          website?: string | null
        }
        Update: {
          country?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_demo?: boolean
          name?: string
          type?: Database["public"]["Enums"]["org_type"]
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      program_kpi_targets: {
        Row: {
          data_source: string
          key: string
          label: string
          owner_id: string | null
          sort_order: number
          target: number
          target_max: number | null
          updated_at: string
        }
        Insert: {
          data_source: string
          key: string
          label: string
          owner_id?: string | null
          sort_order?: number
          target: number
          target_max?: number | null
          updated_at?: string
        }
        Update: {
          data_source?: string
          key?: string
          label?: string
          owner_id?: string | null
          sort_order?: number
          target?: number
          target_max?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "program_kpi_targets_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          description: string
          key: Database["public"]["Enums"]["user_type"]
          label: string
        }
        Insert: {
          description: string
          key: Database["public"]["Enums"]["user_type"]
          label: string
        }
        Update: {
          description?: string
          key?: Database["public"]["Enums"]["user_type"]
          label?: string
        }
        Relationships: []
      }
      round_participants: {
        Row: {
          amount_usd: number | null
          id: string
          is_lead: boolean
          name: string
          round_id: string
        }
        Insert: {
          amount_usd?: number | null
          id?: string
          is_lead?: boolean
          name: string
          round_id: string
        }
        Update: {
          amount_usd?: number | null
          id?: string
          is_lead?: boolean
          name?: string
          round_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "round_participants_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "funding_rounds"
            referencedColumns: ["id"]
          },
        ]
      }
      startup_documents: {
        Row: {
          classification: Database["public"]["Enums"]["classification"]
          created_at: string
          doc_type: string
          id: string
          mime_type: string
          review_note: string | null
          reviewed_by: string | null
          size_bytes: number
          startup_id: string
          status: Database["public"]["Enums"]["doc_status"]
          storage_path: string
          title: string
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          classification?: Database["public"]["Enums"]["classification"]
          created_at?: string
          doc_type: string
          id?: string
          mime_type: string
          review_note?: string | null
          reviewed_by?: string | null
          size_bytes: number
          startup_id: string
          status?: Database["public"]["Enums"]["doc_status"]
          storage_path: string
          title: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          classification?: Database["public"]["Enums"]["classification"]
          created_at?: string
          doc_type?: string
          id?: string
          mime_type?: string
          review_note?: string | null
          reviewed_by?: string | null
          size_bytes?: number
          startup_id?: string
          status?: Database["public"]["Enums"]["doc_status"]
          storage_path?: string
          title?: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "startup_documents_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "startup_documents_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "startup_documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      startup_founders: {
        Row: {
          bio: string | null
          created_at: string
          full_name: string
          id: string
          linkedin: string | null
          role: string | null
          startup_id: string
        }
        Insert: {
          bio?: string | null
          created_at?: string
          full_name: string
          id?: string
          linkedin?: string | null
          role?: string | null
          startup_id: string
        }
        Update: {
          bio?: string | null
          created_at?: string
          full_name?: string
          id?: string
          linkedin?: string | null
          role?: string | null
          startup_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "startup_founders_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startups"
            referencedColumns: ["id"]
          },
        ]
      }
      startup_fundraising: {
        Row: {
          created_at: string
          created_by: string | null
          current_investors: string | null
          id: string
          max_ticket: number | null
          min_ticket: number | null
          previous_funding: string | null
          round_type: string
          startup_id: string
          target_amount: number | null
          use_of_funds: string | null
          valuation_expectation: number | null
          verification: Database["public"]["Enums"]["verification_status"]
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          current_investors?: string | null
          id?: string
          max_ticket?: number | null
          min_ticket?: number | null
          previous_funding?: string | null
          round_type: string
          startup_id: string
          target_amount?: number | null
          use_of_funds?: string | null
          valuation_expectation?: number | null
          verification?: Database["public"]["Enums"]["verification_status"]
        }
        Update: {
          created_at?: string
          created_by?: string | null
          current_investors?: string | null
          id?: string
          max_ticket?: number | null
          min_ticket?: number | null
          previous_funding?: string | null
          round_type?: string
          startup_id?: string
          target_amount?: number | null
          use_of_funds?: string | null
          valuation_expectation?: number | null
          verification?: Database["public"]["Enums"]["verification_status"]
        }
        Relationships: [
          {
            foreignKeyName: "startup_fundraising_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "startup_fundraising_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startups"
            referencedColumns: ["id"]
          },
        ]
      }
      startup_metrics: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          metric_key: string
          period: string
          source: string
          startup_id: string
          unit: string
          value: number
          verification: Database["public"]["Enums"]["verification_status"]
          verified_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          metric_key: string
          period: string
          source: string
          startup_id: string
          unit?: string
          value: number
          verification?: Database["public"]["Enums"]["verification_status"]
          verified_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          metric_key?: string
          period?: string
          source?: string
          startup_id?: string
          unit?: string
          value?: number
          verification?: Database["public"]["Enums"]["verification_status"]
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "startup_metrics_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "startup_metrics_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "startup_metrics_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      startup_public_records: {
        Row: {
          added_by: string | null
          amount_usd: number | null
          co_investors: string[]
          created_at: string
          id: string
          kind: string
          published_on: string | null
          publisher: string
          startup_id: string
          summary: string
          title: string
          url: string
        }
        Insert: {
          added_by?: string | null
          amount_usd?: number | null
          co_investors?: string[]
          created_at?: string
          id?: string
          kind: string
          published_on?: string | null
          publisher: string
          startup_id: string
          summary: string
          title: string
          url: string
        }
        Update: {
          added_by?: string | null
          amount_usd?: number | null
          co_investors?: string[]
          created_at?: string
          id?: string
          kind?: string
          published_on?: string | null
          publisher?: string
          startup_id?: string
          summary?: string
          title?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "startup_public_records_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "startup_public_records_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startups"
            referencedColumns: ["id"]
          },
        ]
      }
      startup_readiness_tasks: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          id: string
          is_done: boolean
          sort_order: number
          startup_id: string
          title: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          is_done?: boolean
          sort_order?: number
          startup_id: string
          title: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          is_done?: boolean
          sort_order?: number
          startup_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "startup_readiness_tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "startup_readiness_tasks_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startups"
            referencedColumns: ["id"]
          },
        ]
      }
      startup_request_responses: {
        Row: {
          author_id: string | null
          body: string
          created_at: string
          document_id: string | null
          id: string
          request_id: string
        }
        Insert: {
          author_id?: string | null
          body: string
          created_at?: string
          document_id?: string | null
          id?: string
          request_id: string
        }
        Update: {
          author_id?: string | null
          body?: string
          created_at?: string
          document_id?: string | null
          id?: string
          request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "startup_request_responses_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "startup_request_responses_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "startup_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "startup_request_responses_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "startup_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      startup_requests: {
        Row: {
          body: string | null
          created_at: string
          created_by: string | null
          dd_request_id: string | null
          due_date: string | null
          id: string
          startup_id: string
          status: Database["public"]["Enums"]["request_status"]
          title: string
          updated_at: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          created_by?: string | null
          dd_request_id?: string | null
          due_date?: string | null
          id?: string
          startup_id: string
          status?: Database["public"]["Enums"]["request_status"]
          title: string
          updated_at?: string
        }
        Update: {
          body?: string | null
          created_at?: string
          created_by?: string | null
          dd_request_id?: string | null
          due_date?: string | null
          id?: string
          startup_id?: string
          status?: Database["public"]["Enums"]["request_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "startup_requests_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "startup_requests_dd_fk"
            columns: ["dd_request_id"]
            isOneToOne: false
            referencedRelation: "due_diligence_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "startup_requests_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startups"
            referencedColumns: ["id"]
          },
        ]
      }
      startup_round_outlook: {
        Row: {
          assessed_at: string
          assessed_by: string | null
          expected_window: string | null
          likelihood: Database["public"]["Enums"]["round_likelihood"]
          rationale: string
          signals: string[]
          startup_id: string
        }
        Insert: {
          assessed_at?: string
          assessed_by?: string | null
          expected_window?: string | null
          likelihood: Database["public"]["Enums"]["round_likelihood"]
          rationale: string
          signals?: string[]
          startup_id: string
        }
        Update: {
          assessed_at?: string
          assessed_by?: string | null
          expected_window?: string | null
          likelihood?: Database["public"]["Enums"]["round_likelihood"]
          rationale?: string
          signals?: string[]
          startup_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "startup_round_outlook_assessed_by_fkey"
            columns: ["assessed_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "startup_round_outlook_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: true
            referencedRelation: "startups"
            referencedColumns: ["id"]
          },
        ]
      }
      startup_status_history: {
        Row: {
          changed_by: string | null
          created_at: string
          from_stage: Database["public"]["Enums"]["pipeline_stage"] | null
          id: string
          note: string | null
          startup_id: string
          to_stage: Database["public"]["Enums"]["pipeline_stage"]
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          from_stage?: Database["public"]["Enums"]["pipeline_stage"] | null
          id?: string
          note?: string | null
          startup_id: string
          to_stage: Database["public"]["Enums"]["pipeline_stage"]
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          from_stage?: Database["public"]["Enums"]["pipeline_stage"] | null
          id?: string
          note?: string | null
          startup_id?: string
          to_stage?: Database["public"]["Enums"]["pipeline_stage"]
        }
        Relationships: [
          {
            foreignKeyName: "startup_status_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "startup_status_history_startup_id_fkey"
            columns: ["startup_id"]
            isOneToOne: false
            referencedRelation: "startups"
            referencedColumns: ["id"]
          },
        ]
      }
      startups: {
        Row: {
          business_model: string | null
          country: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          description: string | null
          founded_year: number | null
          funding_stage: string | null
          headquarters: string | null
          id: string
          is_portfolio: boolean
          logo_url: string | null
          name: string
          one_liner: string | null
          org_id: string
          owner_id: string | null
          problem: string | null
          sector: string | null
          solution: string | null
          source: string | null
          stage: Database["public"]["Enums"]["pipeline_stage"]
          target_market: string | null
          team_size: number | null
          updated_at: string
          updated_by: string | null
          website: string | null
          yv_check_source: string | null
          yv_check_usd: number | null
        }
        Insert: {
          business_model?: string | null
          country?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          founded_year?: number | null
          funding_stage?: string | null
          headquarters?: string | null
          id?: string
          is_portfolio?: boolean
          logo_url?: string | null
          name: string
          one_liner?: string | null
          org_id: string
          owner_id?: string | null
          problem?: string | null
          sector?: string | null
          solution?: string | null
          source?: string | null
          stage?: Database["public"]["Enums"]["pipeline_stage"]
          target_market?: string | null
          team_size?: number | null
          updated_at?: string
          updated_by?: string | null
          website?: string | null
          yv_check_source?: string | null
          yv_check_usd?: number | null
        }
        Update: {
          business_model?: string | null
          country?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          founded_year?: number | null
          funding_stage?: string | null
          headquarters?: string | null
          id?: string
          is_portfolio?: boolean
          logo_url?: string | null
          name?: string
          one_liner?: string | null
          org_id?: string
          owner_id?: string | null
          problem?: string | null
          sector?: string | null
          solution?: string | null
          source?: string | null
          stage?: Database["public"]["Enums"]["pipeline_stage"]
          target_market?: string | null
          team_size?: number | null
          updated_at?: string
          updated_by?: string | null
          website?: string | null
          yv_check_source?: string | null
          yv_check_usd?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "startups_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "startups_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "startups_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "startups_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string
          id: string
          title: string | null
          updated_at: string
          user_type: Database["public"]["Enums"]["user_type"]
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string
          id: string
          title?: string | null
          updated_at?: string
          user_type: Database["public"]["Enums"]["user_type"]
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          title?: string | null
          updated_at?: string
          user_type?: Database["public"]["Enums"]["user_type"]
        }
        Relationships: [
          {
            foreignKeyName: "user_profiles_user_type_fkey"
            columns: ["user_type"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["key"]
          },
        ]
      }
    }
    Views: {
      program_kpis: {
        Row: {
          diligence_processes: number | null
          indicative_interest_usd: number | null
          investment_ready_startups: number | null
          potential_interest_usd: number | null
          priority_relationships: number | null
          qualified_investors: number | null
          signed_partnerships: number | null
          substantive_meetings: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      can_access_document: { Args: { p_document: string }; Returns: boolean }
      document_storage_path: { Args: { p_document: string }; Returns: string }
      investor_opportunity_documents: {
        Args: { p_opportunity: string }
        Returns: {
          added_at: string
          doc_type: string
          id: string
          mime_type: string
          size_bytes: number
          title: string
        }[]
      }
      investor_startup_card: {
        Args: { p_opportunity: string }
        Returns: {
          country: string
          founded_year: number
          logo_url: string
          name: string
          one_liner: string
          sector: string
          team_size: number
          website: string
        }[]
      }
      log_audit: {
        Args: {
          p_action: string
          p_details?: Json
          p_entity_id: string
          p_entity_type: string
        }
        Returns: undefined
      }
      log_document_access: { Args: { p_document: string }; Returns: boolean }
      notify_org_kind: {
        Args: { p_kind: string; p_link: string; p_org: string; p_params: Json }
        Returns: undefined
      }
      portfolio_directory: {
        Args: never
        Returns: {
          country: string
          disclosed_usd: number
          founded_year: number
          funding_stage: string
          id: string
          last_record_on: string
          last_round_on: string
          last_round_type: string
          logo_url: string
          name: string
          one_liner: string
          record_count: number
          round_count: number
          sector: string
          team_size: number
          website: string
        }[]
      }
      whoami: {
        Args: never
        Returns: {
          email: string
          full_name: string
          is_org_admin: boolean
          org_id: string
          org_name: string
          org_type: Database["public"]["Enums"]["org_type"]
          user_id: string
          user_type: Database["public"]["Enums"]["user_type"]
        }[]
      }
    }
    Enums: {
      classification:
        | "public"
        | "shared"
        | "confidential"
        | "highly_confidential"
      dd_status: "open" | "with_startup" | "answered" | "released" | "closed"
      doc_status:
        | "submitted"
        | "under_review"
        | "info_required"
        | "verified"
        | "rejected"
      interest_level:
        | "interested"
        | "info_requested"
        | "indicative"
        | "declined"
      investor_category:
        | "vc_fund"
        | "family_office"
        | "cvc"
        | "fund_of_funds"
        | "dfi"
        | "institutional"
        | "angel_network"
        | "strategic"
        | "other"
      meeting_status: "requested" | "scheduled" | "completed" | "cancelled"
      opportunity_status:
        | "draft"
        | "internal_review"
        | "approved"
        | "shared"
        | "paused"
        | "closed"
        | "withdrawn"
      org_type: "yv" | "investor" | "startup"
      pipeline_stage:
        | "submitted"
        | "initial_screening"
        | "research"
        | "evaluation"
        | "founder_meeting"
        | "due_diligence"
        | "investment_readiness"
        | "internal_approval"
        | "approved_for_sharing"
        | "investor_outreach"
        | "active_investor_interest"
        | "co_investment_dd"
        | "negotiation"
        | "closed"
        | "rejected"
        | "on_hold"
      priority_level: "low" | "medium" | "high"
      relationship_status:
        | "identified"
        | "researched"
        | "qualified"
        | "contacted"
        | "meeting_scheduled"
        | "meeting_completed"
        | "interested"
        | "due_diligence"
        | "negotiation"
        | "partnership_signed"
        | "inactive"
        | "rejected"
      request_status: "open" | "answered" | "closed"
      round_likelihood: "high" | "medium" | "low" | "insufficient_data"
      user_type: "yv_admin" | "yv_team" | "investor" | "founder"
      verification_status:
        | "founder_submitted"
        | "yv_verified"
        | "public_source"
        | "rejected"
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
      classification: [
        "public",
        "shared",
        "confidential",
        "highly_confidential",
      ],
      dd_status: ["open", "with_startup", "answered", "released", "closed"],
      doc_status: [
        "submitted",
        "under_review",
        "info_required",
        "verified",
        "rejected",
      ],
      interest_level: [
        "interested",
        "info_requested",
        "indicative",
        "declined",
      ],
      investor_category: [
        "vc_fund",
        "family_office",
        "cvc",
        "fund_of_funds",
        "dfi",
        "institutional",
        "angel_network",
        "strategic",
        "other",
      ],
      meeting_status: ["requested", "scheduled", "completed", "cancelled"],
      opportunity_status: [
        "draft",
        "internal_review",
        "approved",
        "shared",
        "paused",
        "closed",
        "withdrawn",
      ],
      org_type: ["yv", "investor", "startup"],
      pipeline_stage: [
        "submitted",
        "initial_screening",
        "research",
        "evaluation",
        "founder_meeting",
        "due_diligence",
        "investment_readiness",
        "internal_approval",
        "approved_for_sharing",
        "investor_outreach",
        "active_investor_interest",
        "co_investment_dd",
        "negotiation",
        "closed",
        "rejected",
        "on_hold",
      ],
      priority_level: ["low", "medium", "high"],
      relationship_status: [
        "identified",
        "researched",
        "qualified",
        "contacted",
        "meeting_scheduled",
        "meeting_completed",
        "interested",
        "due_diligence",
        "negotiation",
        "partnership_signed",
        "inactive",
        "rejected",
      ],
      request_status: ["open", "answered", "closed"],
      round_likelihood: ["high", "medium", "low", "insufficient_data"],
      user_type: ["yv_admin", "yv_team", "investor", "founder"],
      verification_status: [
        "founder_submitted",
        "yv_verified",
        "public_source",
        "rejected",
      ],
    },
  },
} as const
