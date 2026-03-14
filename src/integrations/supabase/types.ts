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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      ad_creative_enhancements: {
        Row: {
          adapt_to_placement: boolean
          created_at: string
          enhance_cta: boolean
          id: string
          image_animation: boolean
          image_expansion: boolean
          image_touchups: boolean
          inline_comment: boolean
          music_generation: boolean
          reveal_details_over_time: boolean
          show_spotlights: boolean
          show_summary: boolean
          site_extensions: boolean
          text_generation: boolean
          translate_text: boolean
          translate_voiceover: boolean
          updated_at: string
          user_id: string
          video_filters: boolean
        }
        Insert: {
          adapt_to_placement?: boolean
          created_at?: string
          enhance_cta?: boolean
          id?: string
          image_animation?: boolean
          image_expansion?: boolean
          image_touchups?: boolean
          inline_comment?: boolean
          music_generation?: boolean
          reveal_details_over_time?: boolean
          show_spotlights?: boolean
          show_summary?: boolean
          site_extensions?: boolean
          text_generation?: boolean
          translate_text?: boolean
          translate_voiceover?: boolean
          updated_at?: string
          user_id: string
          video_filters?: boolean
        }
        Update: {
          adapt_to_placement?: boolean
          created_at?: string
          enhance_cta?: boolean
          id?: string
          image_animation?: boolean
          image_expansion?: boolean
          image_touchups?: boolean
          inline_comment?: boolean
          music_generation?: boolean
          reveal_details_over_time?: boolean
          show_spotlights?: boolean
          show_summary?: boolean
          site_extensions?: boolean
          text_generation?: boolean
          translate_text?: boolean
          translate_voiceover?: boolean
          updated_at?: string
          user_id?: string
          video_filters?: boolean
        }
        Relationships: []
      }
      ad_defaults: {
        Row: {
          call_to_action: string | null
          created_at: string
          description: string | null
          destination_url: string | null
          headline: string | null
          headlines: string[] | null
          id: string
          primary_text: string | null
          primary_texts: string[] | null
          updated_at: string
          url_parameters: string | null
          user_id: string
        }
        Insert: {
          call_to_action?: string | null
          created_at?: string
          description?: string | null
          destination_url?: string | null
          headline?: string | null
          headlines?: string[] | null
          id?: string
          primary_text?: string | null
          primary_texts?: string[] | null
          updated_at?: string
          url_parameters?: string | null
          user_id: string
        }
        Update: {
          call_to_action?: string | null
          created_at?: string
          description?: string | null
          destination_url?: string | null
          headline?: string | null
          headlines?: string[] | null
          id?: string
          primary_text?: string | null
          primary_texts?: string[] | null
          updated_at?: string
          url_parameters?: string | null
          user_id?: string
        }
        Relationships: []
      }
      ad_drafts: {
        Row: {
          adset_ids: string[] | null
          call_to_action: string | null
          campaign_id: string | null
          created_at: string
          description: string | null
          destination_url: string | null
          error_message: string | null
          headline: string | null
          headlines: string[] | null
          id: string
          media_urls: string[] | null
          meta_ad_ids: string[] | null
          name: string
          primary_text: string | null
          primary_texts: string[] | null
          status: string
          updated_at: string
          url_parameters: string | null
          user_id: string
        }
        Insert: {
          adset_ids?: string[] | null
          call_to_action?: string | null
          campaign_id?: string | null
          created_at?: string
          description?: string | null
          destination_url?: string | null
          error_message?: string | null
          headline?: string | null
          headlines?: string[] | null
          id?: string
          media_urls?: string[] | null
          meta_ad_ids?: string[] | null
          name: string
          primary_text?: string | null
          primary_texts?: string[] | null
          status?: string
          updated_at?: string
          url_parameters?: string | null
          user_id: string
        }
        Update: {
          adset_ids?: string[] | null
          call_to_action?: string | null
          campaign_id?: string | null
          created_at?: string
          description?: string | null
          destination_url?: string | null
          error_message?: string | null
          headline?: string | null
          headlines?: string[] | null
          id?: string
          media_urls?: string[] | null
          meta_ad_ids?: string[] | null
          name?: string
          primary_text?: string | null
          primary_texts?: string[] | null
          status?: string
          updated_at?: string
          url_parameters?: string | null
          user_id?: string
        }
        Relationships: []
      }
      ad_launch_history: {
        Row: {
          ad_name: string
          ads_count: number
          adset_ids: string[]
          adset_names: string[]
          adsets_count: number
          call_to_action: string | null
          campaign_name: string | null
          campaign_names: string[] | null
          created_at: string
          duration_ms: number | null
          error_message: string | null
          headline: string | null
          id: string
          media_urls: string[]
          meta_ad_ids: string[] | null
          moloco_creative_group_id: string | null
          moloco_creative_ids: string[] | null
          platform: string
          primary_text: string | null
          status: string
          tracking_link_id: string | null
          user_id: string
        }
        Insert: {
          ad_name: string
          ads_count?: number
          adset_ids?: string[]
          adset_names?: string[]
          adsets_count?: number
          call_to_action?: string | null
          campaign_name?: string | null
          campaign_names?: string[] | null
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          headline?: string | null
          id?: string
          media_urls?: string[]
          meta_ad_ids?: string[] | null
          moloco_creative_group_id?: string | null
          moloco_creative_ids?: string[] | null
          platform?: string
          primary_text?: string | null
          status?: string
          tracking_link_id?: string | null
          user_id: string
        }
        Update: {
          ad_name?: string
          ads_count?: number
          adset_ids?: string[]
          adset_names?: string[]
          adsets_count?: number
          call_to_action?: string | null
          campaign_name?: string | null
          campaign_names?: string[] | null
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          headline?: string | null
          id?: string
          media_urls?: string[]
          meta_ad_ids?: string[] | null
          moloco_creative_group_id?: string | null
          moloco_creative_ids?: string[] | null
          platform?: string
          primary_text?: string | null
          status?: string
          tracking_link_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      ad_templates: {
        Row: {
          background_image_url: string | null
          created_at: string | null
          created_by: string | null
          cta_text: string | null
          destination_url: string | null
          elements: Json
          height: number | null
          id: string
          is_active: boolean | null
          name: string
          terms_text: string | null
          updated_at: string | null
          width: number | null
        }
        Insert: {
          background_image_url?: string | null
          created_at?: string | null
          created_by?: string | null
          cta_text?: string | null
          destination_url?: string | null
          elements?: Json
          height?: number | null
          id?: string
          is_active?: boolean | null
          name: string
          terms_text?: string | null
          updated_at?: string | null
          width?: number | null
        }
        Update: {
          background_image_url?: string | null
          created_at?: string | null
          created_by?: string | null
          cta_text?: string | null
          destination_url?: string | null
          elements?: Json
          height?: number | null
          id?: string
          is_active?: boolean | null
          name?: string
          terms_text?: string | null
          updated_at?: string | null
          width?: number | null
        }
        Relationships: []
      }
      affiliate_links: {
        Row: {
          affiliate_id: string
          campaign_name: string
          created_at: string
          created_by: string
          id: string
          long_url: string | null
          short_url: string
        }
        Insert: {
          affiliate_id: string
          campaign_name: string
          created_at?: string
          created_by: string
          id?: string
          long_url?: string | null
          short_url: string
        }
        Update: {
          affiliate_id?: string
          campaign_name?: string
          created_at?: string
          created_by?: string
          id?: string
          long_url?: string | null
          short_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_links_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliate_user_access: {
        Row: {
          affiliate_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          affiliate_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          affiliate_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_user_access_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliates: {
        Row: {
          channel: string
          contact_email: string | null
          cpa: number
          created_at: string
          ftds: number
          id: string
          monthly_cap: number | null
          name: string
          notes: string | null
          status: Database["public"]["Enums"]["affiliate_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          channel: string
          contact_email?: string | null
          cpa?: number
          created_at?: string
          ftds?: number
          id?: string
          monthly_cap?: number | null
          name: string
          notes?: string | null
          status?: Database["public"]["Enums"]["affiliate_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          channel?: string
          contact_email?: string | null
          cpa?: number
          created_at?: string
          ftds?: number
          id?: string
          monthly_cap?: number | null
          name?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["affiliate_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliates_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      ai_budget_recommendations: {
        Row: {
          action_type: string
          channel: string
          confidence: number
          created_at: string
          current_spend: number | null
          entity_id: string
          entity_name: string
          entity_type: string
          id: string
          metrics_snapshot: Json | null
          reasoning: string
          recommended_action: string | null
          status: string
          suggested_change: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          action_type: string
          channel: string
          confidence: number
          created_at?: string
          current_spend?: number | null
          entity_id: string
          entity_name: string
          entity_type: string
          id?: string
          metrics_snapshot?: Json | null
          reasoning: string
          recommended_action?: string | null
          status?: string
          suggested_change?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          action_type?: string
          channel?: string
          confidence?: number
          created_at?: string
          current_spend?: number | null
          entity_id?: string
          entity_name?: string
          entity_type?: string
          id?: string
          metrics_snapshot?: Json | null
          reasoning?: string
          recommended_action?: string | null
          status?: string
          suggested_change?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_creative_fatigue_predictions: {
        Row: {
          confidence: number
          created_at: string
          creative_id: string
          creative_name: string
          days_until_fatigue: number | null
          fatigue_status: string
          id: string
          metrics_snapshot: Json | null
          platform: string
          reasoning: string
          recommended_action: string | null
          status: string
          trend_data: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          confidence: number
          created_at?: string
          creative_id: string
          creative_name: string
          days_until_fatigue?: number | null
          fatigue_status: string
          id?: string
          metrics_snapshot?: Json | null
          platform: string
          reasoning: string
          recommended_action?: string | null
          status?: string
          trend_data?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          confidence?: number
          created_at?: string
          creative_id?: string
          creative_name?: string
          days_until_fatigue?: number | null
          fatigue_status?: string
          id?: string
          metrics_snapshot?: Json | null
          platform?: string
          reasoning?: string
          recommended_action?: string | null
          status?: string
          trend_data?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_keyword_recommendations: {
        Row: {
          confidence: number
          created_at: string
          id: string
          keyword_id: string | null
          keyword_text: string
          metrics_snapshot: Json | null
          reasoning: string
          recommendation_type: string
          status: string
          suggested_action: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          confidence: number
          created_at?: string
          id?: string
          keyword_id?: string | null
          keyword_text: string
          metrics_snapshot?: Json | null
          reasoning: string
          recommendation_type: string
          status?: string
          suggested_action?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          confidence?: number
          created_at?: string
          id?: string
          keyword_id?: string | null
          keyword_text?: string
          metrics_snapshot?: Json | null
          reasoning?: string
          recommendation_type?: string
          status?: string
          suggested_action?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      app_store_reviews: {
        Row: {
          app_version: string | null
          author_name: string | null
          created_at: string
          id: string
          responded_at: string | null
          response_id: string | null
          response_text: string | null
          review_id: string
          stars: number
          synced_at: string
          territory: string | null
          text: string | null
          title: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          app_version?: string | null
          author_name?: string | null
          created_at: string
          id?: string
          responded_at?: string | null
          response_id?: string | null
          response_text?: string | null
          review_id: string
          stars: number
          synced_at?: string
          territory?: string | null
          text?: string | null
          title?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          app_version?: string | null
          author_name?: string | null
          created_at?: string
          id?: string
          responded_at?: string | null
          response_id?: string | null
          response_text?: string | null
          review_id?: string
          stars?: number
          synced_at?: string
          territory?: string | null
          text?: string | null
          title?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      apple_campaigns: {
        Row: {
          avg_cpa: number | null
          avg_cpt: number | null
          budget_amount: number | null
          campaign_id: string
          campaign_name: string
          conversions: number
          created_at: string
          daily_budget: number | null
          end_date: string | null
          id: string
          impressions: number
          spend: number
          start_date: string | null
          status: string | null
          synced_at: string
          taps: number
          updated_at: string
          user_id: string
        }
        Insert: {
          avg_cpa?: number | null
          avg_cpt?: number | null
          budget_amount?: number | null
          campaign_id: string
          campaign_name: string
          conversions?: number
          created_at?: string
          daily_budget?: number | null
          end_date?: string | null
          id?: string
          impressions?: number
          spend?: number
          start_date?: string | null
          status?: string | null
          synced_at?: string
          taps?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          avg_cpa?: number | null
          avg_cpt?: number | null
          budget_amount?: number | null
          campaign_id?: string
          campaign_name?: string
          conversions?: number
          created_at?: string
          daily_budget?: number | null
          end_date?: string | null
          id?: string
          impressions?: number
          spend?: number
          start_date?: string | null
          status?: string | null
          synced_at?: string
          taps?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      apple_keywords: {
        Row: {
          adgroup_id: string | null
          adgroup_name: string | null
          avg_cpa: number | null
          avg_cpt: number | null
          bid_amount: number | null
          campaign_id: string | null
          campaign_name: string | null
          created_at: string
          id: string
          impression_rank: number | null
          impression_share_high: number | null
          impression_share_low: number | null
          impressions: number | null
          installs: number | null
          keyword_id: string
          keyword_text: string
          match_type: string | null
          search_popularity: number | null
          spend: number | null
          status: string | null
          synced_at: string
          taps: number | null
          ttr: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          adgroup_id?: string | null
          adgroup_name?: string | null
          avg_cpa?: number | null
          avg_cpt?: number | null
          bid_amount?: number | null
          campaign_id?: string | null
          campaign_name?: string | null
          created_at?: string
          id?: string
          impression_rank?: number | null
          impression_share_high?: number | null
          impression_share_low?: number | null
          impressions?: number | null
          installs?: number | null
          keyword_id: string
          keyword_text: string
          match_type?: string | null
          search_popularity?: number | null
          spend?: number | null
          status?: string | null
          synced_at?: string
          taps?: number | null
          ttr?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          adgroup_id?: string | null
          adgroup_name?: string | null
          avg_cpa?: number | null
          avg_cpt?: number | null
          bid_amount?: number | null
          campaign_id?: string | null
          campaign_name?: string | null
          created_at?: string
          id?: string
          impression_rank?: number | null
          impression_share_high?: number | null
          impression_share_low?: number | null
          impressions?: number | null
          installs?: number | null
          keyword_id?: string
          keyword_text?: string
          match_type?: string | null
          search_popularity?: number | null
          spend?: number | null
          status?: string | null
          synced_at?: string
          taps?: number | null
          ttr?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      apple_search_terms: {
        Row: {
          created_at: string
          date: string
          id: string
          impression_rank: number | null
          impression_share_high: number | null
          impression_share_low: number | null
          impressions: number | null
          installs: number | null
          keyword_id: string
          match_type: string | null
          search_popularity: number | null
          search_term_source: string | null
          search_term_text: string
          spend: number | null
          synced_at: string
          taps: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          impression_rank?: number | null
          impression_share_high?: number | null
          impression_share_low?: number | null
          impressions?: number | null
          installs?: number | null
          keyword_id: string
          match_type?: string | null
          search_popularity?: number | null
          search_term_source?: string | null
          search_term_text: string
          spend?: number | null
          synced_at?: string
          taps?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          impression_rank?: number | null
          impression_share_high?: number | null
          impression_share_low?: number | null
          impressions?: number | null
          installs?: number | null
          keyword_id?: string
          match_type?: string | null
          search_popularity?: number | null
          search_term_source?: string | null
          search_term_text?: string
          spend?: number | null
          synced_at?: string
          taps?: number | null
          user_id?: string
        }
        Relationships: []
      }
      appsflyer_campaigns: {
        Row: {
          arpu: number | null
          campaign_name: string
          clicks: number
          cpc: number | null
          cpi: number | null
          created_at: string
          date_end: string | null
          date_start: string | null
          id: string
          impressions: number
          installs: number
          media_source: string
          platform: string
          revenue: number
          roi: number | null
          spend: number
          synced_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          arpu?: number | null
          campaign_name: string
          clicks?: number
          cpc?: number | null
          cpi?: number | null
          created_at?: string
          date_end?: string | null
          date_start?: string | null
          id?: string
          impressions?: number
          installs?: number
          media_source: string
          platform: string
          revenue?: number
          roi?: number | null
          spend?: number
          synced_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          arpu?: number | null
          campaign_name?: string
          clicks?: number
          cpc?: number | null
          cpi?: number | null
          created_at?: string
          date_end?: string | null
          date_start?: string | null
          id?: string
          impressions?: number
          installs?: number
          media_source?: string
          platform?: string
          revenue?: number
          roi?: number | null
          spend?: number
          synced_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      appsflyer_events: {
        Row: {
          campaign_name: string
          created_at: string
          event_count: number
          event_date: string
          event_name: string
          event_revenue: number | null
          id: string
          media_source: string
          platform: string
          synced_at: string
          user_id: string
        }
        Insert: {
          campaign_name: string
          created_at?: string
          event_count?: number
          event_date: string
          event_name: string
          event_revenue?: number | null
          id?: string
          media_source: string
          platform: string
          synced_at?: string
          user_id: string
        }
        Update: {
          campaign_name?: string
          created_at?: string
          event_count?: number
          event_date?: string
          event_name?: string
          event_revenue?: number | null
          id?: string
          media_source?: string
          platform?: string
          synced_at?: string
          user_id?: string
        }
        Relationships: []
      }
      appsflyer_keyword_events: {
        Row: {
          created_at: string
          event_count: number
          event_date: string
          event_name: string
          id: string
          keyword_id: string
          platform: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          event_count?: number
          event_date: string
          event_name: string
          id?: string
          keyword_id: string
          platform?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          event_count?: number
          event_date?: string
          event_name?: string
          id?: string
          keyword_id?: string
          platform?: string
          updated_at?: string
        }
        Relationships: []
      }
      appstore_organic_metrics: {
        Row: {
          date: string
          downloads: number
          first_time_downloads: number | null
          id: string
          redownloads: number | null
          source_type: string
          synced_at: string | null
        }
        Insert: {
          date: string
          downloads?: number
          first_time_downloads?: number | null
          id?: string
          redownloads?: number | null
          source_type: string
          synced_at?: string | null
        }
        Update: {
          date?: string
          downloads?: number
          first_time_downloads?: number | null
          id?: string
          redownloads?: number | null
          source_type?: string
          synced_at?: string | null
        }
        Relationships: []
      }
      attributed_users: {
        Row: {
          ad_name: string | null
          adset_name: string | null
          appsflyer_id: string
          campaign_id: string | null
          campaign_name: string | null
          country_code: string | null
          created_at: string
          device_type: string | null
          id: string
          install_time: string
          is_retargeting: boolean | null
          media_source: string
          platform: string
          synced_at: string
          user_id: string
        }
        Insert: {
          ad_name?: string | null
          adset_name?: string | null
          appsflyer_id: string
          campaign_id?: string | null
          campaign_name?: string | null
          country_code?: string | null
          created_at?: string
          device_type?: string | null
          id?: string
          install_time: string
          is_retargeting?: boolean | null
          media_source: string
          platform: string
          synced_at?: string
          user_id: string
        }
        Update: {
          ad_name?: string | null
          adset_name?: string | null
          appsflyer_id?: string
          campaign_id?: string | null
          campaign_name?: string | null
          country_code?: string | null
          created_at?: string
          device_type?: string | null
          id?: string
          install_time?: string
          is_retargeting?: boolean | null
          media_source?: string
          platform?: string
          synced_at?: string
          user_id?: string
        }
        Relationships: []
      }
      auto_response_settings: {
        Row: {
          auto_post_threshold: number
          created_at: string
          enabled: boolean
          id: string
          platform: string
          updated_at: string
        }
        Insert: {
          auto_post_threshold?: number
          created_at?: string
          enabled?: boolean
          id?: string
          platform: string
          updated_at?: string
        }
        Update: {
          auto_post_threshold?: number
          created_at?: string
          enabled?: boolean
          id?: string
          platform?: string
          updated_at?: string
        }
        Relationships: []
      }
      compliance_checks: {
        Row: {
          ai_name: string | null
          content_type: string
          created_at: string
          id: string
          input_data: Json
          overall_status: string
          results: Json
          thumbnail_path: string | null
          user_id: string
        }
        Insert: {
          ai_name?: string | null
          content_type: string
          created_at?: string
          id?: string
          input_data?: Json
          overall_status?: string
          results?: Json
          thumbnail_path?: string | null
          user_id: string
        }
        Update: {
          ai_name?: string | null
          content_type?: string
          created_at?: string
          id?: string
          input_data?: Json
          overall_status?: string
          results?: Json
          thumbnail_path?: string | null
          user_id?: string
        }
        Relationships: []
      }
      compliance_rules: {
        Row: {
          content_types: string[]
          created_at: string
          description: string
          enabled: boolean
          id: string
          label: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          content_types?: string[]
          created_at?: string
          description?: string
          enabled?: boolean
          id?: string
          label: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          content_types?: string[]
          created_at?: string
          description?: string
          enabled?: boolean
          id?: string
          label?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      conversion_events: {
        Row: {
          created_at: string
          event_label: string
          event_name: string
          id: string
          is_primary: boolean
          org_id: string
          source_provider: Database["public"]["Enums"]["provider_type"] | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          event_label: string
          event_name: string
          id?: string
          is_primary?: boolean
          org_id: string
          source_provider?: Database["public"]["Enums"]["provider_type"] | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          event_label?: string
          event_name?: string
          id?: string
          is_primary?: boolean
          org_id?: string
          source_provider?: Database["public"]["Enums"]["provider_type"] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversion_events_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      cpa_threshold_settings: {
        Row: {
          created_at: string
          green_threshold: number
          id: string
          max_cpa: number
          min_cpa: number
          orange_threshold: number
          target_cpa: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          green_threshold?: number
          id?: string
          max_cpa?: number
          min_cpa?: number
          orange_threshold?: number
          target_cpa?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          green_threshold?: number
          id?: string
          max_cpa?: number
          min_cpa?: number
          orange_threshold?: number
          target_cpa?: number
          updated_at?: string
        }
        Relationships: []
      }
      daily_ad_spend: {
        Row: {
          campaign_id: string
          campaign_name: string
          clicks: number
          created_at: string
          date: string
          id: string
          impressions: number
          installs: number
          platform: string
          spend: number
          synced_at: string
          user_id: string
        }
        Insert: {
          campaign_id: string
          campaign_name: string
          clicks?: number
          created_at?: string
          date: string
          id?: string
          impressions?: number
          installs?: number
          platform: string
          spend?: number
          synced_at?: string
          user_id: string
        }
        Update: {
          campaign_id?: string
          campaign_name?: string
          clicks?: number
          created_at?: string
          date?: string
          id?: string
          impressions?: number
          installs?: number
          platform?: string
          spend?: number
          synced_at?: string
          user_id?: string
        }
        Relationships: []
      }
      daily_affiliate_spend: {
        Row: {
          affiliate_id: string
          created_at: string
          date: string
          ftds: number
          id: string
          spend: number
          synced_at: string
          user_id: string
        }
        Insert: {
          affiliate_id: string
          created_at?: string
          date: string
          ftds?: number
          id?: string
          spend?: number
          synced_at?: string
          user_id: string
        }
        Update: {
          affiliate_id?: string
          created_at?: string
          date?: string
          ftds?: number
          id?: string
          spend?: number
          synced_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_affiliate_spend_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_apple_keyword_spend: {
        Row: {
          campaign_id: string | null
          campaign_name: string | null
          created_at: string
          date: string
          id: string
          impression_rank: number | null
          impression_share_high: number | null
          impression_share_low: number | null
          impressions: number | null
          installs: number | null
          keyword_id: string
          keyword_text: string
          match_type: string | null
          search_popularity: number | null
          spend: number | null
          synced_at: string
          taps: number | null
          user_id: string
        }
        Insert: {
          campaign_id?: string | null
          campaign_name?: string | null
          created_at?: string
          date: string
          id?: string
          impression_rank?: number | null
          impression_share_high?: number | null
          impression_share_low?: number | null
          impressions?: number | null
          installs?: number | null
          keyword_id: string
          keyword_text: string
          match_type?: string | null
          search_popularity?: number | null
          spend?: number | null
          synced_at?: string
          taps?: number | null
          user_id: string
        }
        Update: {
          campaign_id?: string | null
          campaign_name?: string | null
          created_at?: string
          date?: string
          id?: string
          impression_rank?: number | null
          impression_share_high?: number | null
          impression_share_low?: number | null
          impressions?: number | null
          installs?: number | null
          keyword_id?: string
          keyword_text?: string
          match_type?: string | null
          search_popularity?: number | null
          spend?: number | null
          synced_at?: string
          taps?: number | null
          user_id?: string
        }
        Relationships: []
      }
      daily_appsflyer_clicks: {
        Row: {
          campaign_name: string
          clicks: number
          created_at: string
          date: string
          id: string
          media_source: string
          platform: string
          synced_at: string
          user_id: string
        }
        Insert: {
          campaign_name: string
          clicks?: number
          created_at?: string
          date: string
          id?: string
          media_source: string
          platform: string
          synced_at?: string
          user_id: string
        }
        Update: {
          campaign_name?: string
          clicks?: number
          created_at?: string
          date?: string
          id?: string
          media_source?: string
          platform?: string
          synced_at?: string
          user_id?: string
        }
        Relationships: []
      }
      daily_appsflyer_installs: {
        Row: {
          campaign_name: string
          created_at: string
          date: string
          id: string
          installs: number
          media_source: string
          platform: string
          synced_at: string
          user_id: string
        }
        Insert: {
          campaign_name: string
          created_at?: string
          date: string
          id?: string
          installs?: number
          media_source: string
          platform: string
          synced_at?: string
          user_id: string
        }
        Update: {
          campaign_name?: string
          created_at?: string
          date?: string
          id?: string
          installs?: number
          media_source?: string
          platform?: string
          synced_at?: string
          user_id?: string
        }
        Relationships: []
      }
      daily_meta_ad_spend: {
        Row: {
          ad_id: string
          ad_name: string
          add_to_cart: number | null
          campaign_id: string | null
          campaign_name: string | null
          clicks: number | null
          conversions: number | null
          cpc: number | null
          cpm: number | null
          created_at: string
          ctr: number | null
          date: string
          frequency: number | null
          id: string
          impressions: number | null
          landing_page_views: number | null
          link_clicks: number | null
          purchases: number | null
          purchases_cost: number | null
          purchases_value: number | null
          reach: number | null
          registrations: number | null
          registrations_cost: number | null
          spend: number | null
          synced_at: string
          user_id: string
          video_views_100: number | null
          video_views_25: number | null
          video_views_3s: number | null
          video_views_50: number | null
          video_views_75: number | null
        }
        Insert: {
          ad_id: string
          ad_name: string
          add_to_cart?: number | null
          campaign_id?: string | null
          campaign_name?: string | null
          clicks?: number | null
          conversions?: number | null
          cpc?: number | null
          cpm?: number | null
          created_at?: string
          ctr?: number | null
          date: string
          frequency?: number | null
          id?: string
          impressions?: number | null
          landing_page_views?: number | null
          link_clicks?: number | null
          purchases?: number | null
          purchases_cost?: number | null
          purchases_value?: number | null
          reach?: number | null
          registrations?: number | null
          registrations_cost?: number | null
          spend?: number | null
          synced_at?: string
          user_id: string
          video_views_100?: number | null
          video_views_25?: number | null
          video_views_3s?: number | null
          video_views_50?: number | null
          video_views_75?: number | null
        }
        Update: {
          ad_id?: string
          ad_name?: string
          add_to_cart?: number | null
          campaign_id?: string | null
          campaign_name?: string | null
          clicks?: number | null
          conversions?: number | null
          cpc?: number | null
          cpm?: number | null
          created_at?: string
          ctr?: number | null
          date?: string
          frequency?: number | null
          id?: string
          impressions?: number | null
          landing_page_views?: number | null
          link_clicks?: number | null
          purchases?: number | null
          purchases_cost?: number | null
          purchases_value?: number | null
          reach?: number | null
          registrations?: number | null
          registrations_cost?: number | null
          spend?: number | null
          synced_at?: string
          user_id?: string
          video_views_100?: number | null
          video_views_25?: number | null
          video_views_3s?: number | null
          video_views_50?: number | null
          video_views_75?: number | null
        }
        Relationships: []
      }
      daily_moloco_creative_spend: {
        Row: {
          clicks: number
          created_at: string
          creative_id: string
          creative_name: string
          date: string
          id: string
          impressions: number
          installs: number
          revenue: number | null
          spend: number
          synced_at: string
          user_id: string
        }
        Insert: {
          clicks?: number
          created_at?: string
          creative_id: string
          creative_name: string
          date: string
          id?: string
          impressions?: number
          installs?: number
          revenue?: number | null
          spend?: number
          synced_at?: string
          user_id: string
        }
        Update: {
          clicks?: number
          created_at?: string
          creative_id?: string
          creative_name?: string
          date?: string
          id?: string
          impressions?: number
          installs?: number
          revenue?: number | null
          spend?: number
          synced_at?: string
          user_id?: string
        }
        Relationships: []
      }
      dashboard_configs: {
        Row: {
          created_at: string
          dashboard_slug: string
          description: string | null
          display_order: number | null
          icon: string | null
          id: string
          is_deletable: boolean | null
          name: string | null
          report_slugs: string[]
          updated_at: string
        }
        Insert: {
          created_at?: string
          dashboard_slug: string
          description?: string | null
          display_order?: number | null
          icon?: string | null
          id?: string
          is_deletable?: boolean | null
          name?: string | null
          report_slugs?: string[]
          updated_at?: string
        }
        Update: {
          created_at?: string
          dashboard_slug?: string
          description?: string | null
          display_order?: number | null
          icon?: string | null
          id?: string
          is_deletable?: boolean | null
          name?: string | null
          report_slugs?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      funnel_metric_alerts: {
        Row: {
          alert_date: string
          auto_fixed: boolean | null
          detected_at: string | null
          error_message: string | null
          id: string
          resolved_at: string | null
        }
        Insert: {
          alert_date: string
          auto_fixed?: boolean | null
          detected_at?: string | null
          error_message?: string | null
          id?: string
          resolved_at?: string | null
        }
        Update: {
          alert_date?: string
          auto_fixed?: boolean | null
          detected_at?: string | null
          error_message?: string | null
          id?: string
          resolved_at?: string | null
        }
        Relationships: []
      }
      google_play_reviews: {
        Row: {
          app_version_code: string | null
          app_version_name: string | null
          author_name: string | null
          developer_reply_at: string | null
          developer_reply_text: string | null
          device: string | null
          id: string
          language: string | null
          responded_at: string | null
          response_text: string | null
          review_created_at: string
          review_id: string
          review_updated_at: string | null
          stars: number
          synced_at: string
          text: string | null
          thumbs_up_count: number | null
          title: string | null
          user_id: string
        }
        Insert: {
          app_version_code?: string | null
          app_version_name?: string | null
          author_name?: string | null
          developer_reply_at?: string | null
          developer_reply_text?: string | null
          device?: string | null
          id?: string
          language?: string | null
          responded_at?: string | null
          response_text?: string | null
          review_created_at: string
          review_id: string
          review_updated_at?: string | null
          stars: number
          synced_at?: string
          text?: string | null
          thumbs_up_count?: number | null
          title?: string | null
          user_id: string
        }
        Update: {
          app_version_code?: string | null
          app_version_name?: string | null
          author_name?: string | null
          developer_reply_at?: string | null
          developer_reply_text?: string | null
          device?: string | null
          id?: string
          language?: string | null
          responded_at?: string | null
          response_text?: string | null
          review_created_at?: string
          review_id?: string
          review_updated_at?: string | null
          stars?: number
          synced_at?: string
          text?: string | null
          thumbs_up_count?: number | null
          title?: string | null
          user_id?: string
        }
        Relationships: []
      }
      google_search_console_metrics: {
        Row: {
          clicks: number
          ctr: number | null
          date: string
          id: string
          impressions: number
          position: number | null
          synced_at: string | null
        }
        Insert: {
          clicks?: number
          ctr?: number | null
          date: string
          id?: string
          impressions?: number
          position?: number | null
          synced_at?: string | null
        }
        Update: {
          clicks?: number
          ctr?: number | null
          date?: string
          id?: string
          impressions?: number
          position?: number | null
          synced_at?: string | null
        }
        Relationships: []
      }
      keyword_automation_rules: {
        Row: {
          action_type: string
          action_value: Json | null
          conditions: Json
          created_at: string
          created_by: string | null
          description: string | null
          frequency: string
          id: string
          is_active: boolean
          keyword_targeting: Json | null
          last_run_at: string | null
          lookback_days: number
          min_impressions_threshold: number | null
          min_spend_threshold: number | null
          name: string
          platform: string
          priority: number
          updated_at: string
        }
        Insert: {
          action_type: string
          action_value?: Json | null
          conditions?: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          frequency?: string
          id?: string
          is_active?: boolean
          keyword_targeting?: Json | null
          last_run_at?: string | null
          lookback_days?: number
          min_impressions_threshold?: number | null
          min_spend_threshold?: number | null
          name: string
          platform?: string
          priority?: number
          updated_at?: string
        }
        Update: {
          action_type?: string
          action_value?: Json | null
          conditions?: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          frequency?: string
          id?: string
          is_active?: boolean
          keyword_targeting?: Json | null
          last_run_at?: string | null
          lookback_days?: number
          min_impressions_threshold?: number | null
          min_spend_threshold?: number | null
          name?: string
          platform?: string
          priority?: number
          updated_at?: string
        }
        Relationships: []
      }
      meta_ad_rules: {
        Row: {
          account_id: string | null
          created_at: string
          created_by_name: string | null
          created_time: string | null
          evaluation_spec: Json
          execution_spec: Json
          id: string
          meta_rule_id: string
          name: string
          schedule_spec: Json | null
          status: string
          synced_at: string
          updated_at: string
          updated_time: string | null
        }
        Insert: {
          account_id?: string | null
          created_at?: string
          created_by_name?: string | null
          created_time?: string | null
          evaluation_spec: Json
          execution_spec: Json
          id?: string
          meta_rule_id: string
          name: string
          schedule_spec?: Json | null
          status?: string
          synced_at?: string
          updated_at?: string
          updated_time?: string | null
        }
        Update: {
          account_id?: string | null
          created_at?: string
          created_by_name?: string | null
          created_time?: string | null
          evaluation_spec?: Json
          execution_spec?: Json
          id?: string
          meta_rule_id?: string
          name?: string
          schedule_spec?: Json | null
          status?: string
          synced_at?: string
          updated_at?: string
          updated_time?: string | null
        }
        Relationships: []
      }
      meta_ads: {
        Row: {
          ad_id: string
          ad_name: string
          adset_id: string | null
          adset_name: string | null
          campaign_id: string | null
          campaign_name: string | null
          clicks: number | null
          conversions: number | null
          created_at: string
          created_time: string | null
          creative_type: string | null
          date_start: string | null
          date_stop: string | null
          id: string
          impressions: number | null
          preview_url: string | null
          spend: number | null
          status: string | null
          synced_at: string
          thumbnail_url: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          ad_id: string
          ad_name: string
          adset_id?: string | null
          adset_name?: string | null
          campaign_id?: string | null
          campaign_name?: string | null
          clicks?: number | null
          conversions?: number | null
          created_at?: string
          created_time?: string | null
          creative_type?: string | null
          date_start?: string | null
          date_stop?: string | null
          id?: string
          impressions?: number | null
          preview_url?: string | null
          spend?: number | null
          status?: string | null
          synced_at?: string
          thumbnail_url?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          ad_id?: string
          ad_name?: string
          adset_id?: string | null
          adset_name?: string | null
          campaign_id?: string | null
          campaign_name?: string | null
          clicks?: number | null
          conversions?: number | null
          created_at?: string
          created_time?: string | null
          creative_type?: string | null
          date_start?: string | null
          date_stop?: string | null
          id?: string
          impressions?: number | null
          preview_url?: string | null
          spend?: number | null
          status?: string | null
          synced_at?: string
          thumbnail_url?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      meta_campaigns: {
        Row: {
          campaign_id: string
          campaign_name: string
          clicks: number
          cpa: number | null
          cpc: number | null
          cpm: number | null
          created_at: string
          daily_budget: number | null
          date_start: string | null
          date_stop: string | null
          id: string
          impressions: number
          installs: number
          lifetime_budget: number | null
          objective: string | null
          spend: number
          status: string | null
          synced_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          campaign_id: string
          campaign_name: string
          clicks?: number
          cpa?: number | null
          cpc?: number | null
          cpm?: number | null
          created_at?: string
          daily_budget?: number | null
          date_start?: string | null
          date_stop?: string | null
          id?: string
          impressions?: number
          installs?: number
          lifetime_budget?: number | null
          objective?: string | null
          spend?: number
          status?: string | null
          synced_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          campaign_id?: string
          campaign_name?: string
          clicks?: number
          cpa?: number | null
          cpc?: number | null
          cpm?: number | null
          created_at?: string
          daily_budget?: number | null
          date_start?: string | null
          date_stop?: string | null
          id?: string
          impressions?: number
          installs?: number
          lifetime_budget?: number | null
          objective?: string | null
          spend?: number
          status?: string | null
          synced_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      mixpanel_events: {
        Row: {
          amount: number | null
          appsflyer_id: string | null
          created_at: string
          distinct_id: string
          event_name: string
          event_time: string
          id: string
          insert_id: string | null
          mixpanel_user_id: string | null
          platform: string | null
          properties: Json | null
          revenue: number | null
          synced_at: string
        }
        Insert: {
          amount?: number | null
          appsflyer_id?: string | null
          created_at?: string
          distinct_id: string
          event_name: string
          event_time: string
          id?: string
          insert_id?: string | null
          mixpanel_user_id?: string | null
          platform?: string | null
          properties?: Json | null
          revenue?: number | null
          synced_at?: string
        }
        Update: {
          amount?: number | null
          appsflyer_id?: string | null
          created_at?: string
          distinct_id?: string
          event_name?: string
          event_time?: string
          id?: string
          insert_id?: string | null
          mixpanel_user_id?: string | null
          platform?: string | null
          properties?: Json | null
          revenue?: number | null
          synced_at?: string
        }
        Relationships: []
      }
      moloco_campaigns: {
        Row: {
          campaign_id: string
          campaign_name: string
          clicks: number
          cpa: number | null
          cpc: number | null
          cpm: number | null
          created_at: string
          daily_budget: number | null
          end_date: string | null
          id: string
          impressions: number
          installs: number
          spend: number
          start_date: string | null
          status: string | null
          synced_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          campaign_id: string
          campaign_name: string
          clicks?: number
          cpa?: number | null
          cpc?: number | null
          cpm?: number | null
          created_at?: string
          daily_budget?: number | null
          end_date?: string | null
          id?: string
          impressions?: number
          installs?: number
          spend?: number
          start_date?: string | null
          status?: string | null
          synced_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          campaign_id?: string
          campaign_name?: string
          clicks?: number
          cpa?: number | null
          cpc?: number | null
          cpm?: number | null
          created_at?: string
          daily_budget?: number | null
          end_date?: string | null
          id?: string
          impressions?: number
          installs?: number
          spend?: number
          start_date?: string | null
          status?: string | null
          synced_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      moloco_creatives: {
        Row: {
          ad_group_id: string | null
          ad_group_name: string | null
          campaign_id: string | null
          campaign_name: string | null
          created_at: string
          creative_id: string
          creative_name: string
          creative_type: string | null
          id: string
          main_asset_url: string | null
          status: string | null
          synced_at: string
          total_clicks: number | null
          total_impressions: number | null
          total_installs: number | null
          total_spend: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          ad_group_id?: string | null
          ad_group_name?: string | null
          campaign_id?: string | null
          campaign_name?: string | null
          created_at?: string
          creative_id: string
          creative_name: string
          creative_type?: string | null
          id?: string
          main_asset_url?: string | null
          status?: string | null
          synced_at?: string
          total_clicks?: number | null
          total_impressions?: number | null
          total_installs?: number | null
          total_spend?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          ad_group_id?: string | null
          ad_group_name?: string | null
          campaign_id?: string | null
          campaign_name?: string | null
          created_at?: string
          creative_id?: string
          creative_name?: string
          creative_type?: string | null
          id?: string
          main_asset_url?: string | null
          status?: string | null
          synced_at?: string
          total_clicks?: number | null
          total_impressions?: number | null
          total_installs?: number | null
          total_spend?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      monthly_metrics: {
        Row: {
          ad_spend_per_1k_deposit: number | null
          affiliate_metrics: Json | null
          avg_deposit_per_ftd: number | null
          avg_rating: number | null
          blended_cac: number | null
          blended_cpa: number | null
          clicks_by_channel: Json | null
          cpa_by_channel: Json | null
          created_at: string
          cvr_ftd_to_std: number | null
          cvr_install_to_signup: number | null
          cvr_install_to_std: number | null
          cvr_signup_to_ftd: number | null
          ftd_cohort_deposits: number | null
          ftds_by_channel: Json | null
          id: string
          is_locked: boolean
          month_start: string
          net_deposits_new_users: number | null
          new_users_net_deposits: number | null
          roas: number | null
          spend_by_channel: Json | null
          total_ad_spend: number
          total_affiliate_spend: number
          total_ftds: number
          total_installs: number
          total_signups: number
          total_spend: number
          total_stds: number
          updated_at: string
        }
        Insert: {
          ad_spend_per_1k_deposit?: number | null
          affiliate_metrics?: Json | null
          avg_deposit_per_ftd?: number | null
          avg_rating?: number | null
          blended_cac?: number | null
          blended_cpa?: number | null
          clicks_by_channel?: Json | null
          cpa_by_channel?: Json | null
          created_at?: string
          cvr_ftd_to_std?: number | null
          cvr_install_to_signup?: number | null
          cvr_install_to_std?: number | null
          cvr_signup_to_ftd?: number | null
          ftd_cohort_deposits?: number | null
          ftds_by_channel?: Json | null
          id?: string
          is_locked?: boolean
          month_start: string
          net_deposits_new_users?: number | null
          new_users_net_deposits?: number | null
          roas?: number | null
          spend_by_channel?: Json | null
          total_ad_spend?: number
          total_affiliate_spend?: number
          total_ftds?: number
          total_installs?: number
          total_signups?: number
          total_spend?: number
          total_stds?: number
          updated_at?: string
        }
        Update: {
          ad_spend_per_1k_deposit?: number | null
          affiliate_metrics?: Json | null
          avg_deposit_per_ftd?: number | null
          avg_rating?: number | null
          blended_cac?: number | null
          blended_cpa?: number | null
          clicks_by_channel?: Json | null
          cpa_by_channel?: Json | null
          created_at?: string
          cvr_ftd_to_std?: number | null
          cvr_install_to_signup?: number | null
          cvr_install_to_std?: number | null
          cvr_signup_to_ftd?: number | null
          ftd_cohort_deposits?: number | null
          ftds_by_channel?: Json | null
          id?: string
          is_locked?: boolean
          month_start?: string
          net_deposits_new_users?: number | null
          new_users_net_deposits?: number | null
          roas?: number | null
          spend_by_channel?: Json | null
          total_ad_spend?: number
          total_affiliate_spend?: number
          total_ftds?: number
          total_installs?: number
          total_signups?: number
          total_spend?: number
          total_stds?: number
          updated_at?: string
        }
        Relationships: []
      }
      organization_members: {
        Row: {
          created_at: string
          id: string
          org_id: string
          role: Database["public"]["Enums"]["org_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          org_id: string
          role?: Database["public"]["Enums"]["org_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          org_id?: string
          role?: Database["public"]["Enums"]["org_role"]
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
        ]
      }
      organizations: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      pending_responses: {
        Row: {
          ai_response: string
          created_at: string
          id: string
          platform: string
          posted_at: string | null
          rejected_at: string | null
          review_author: string | null
          review_db_id: string
          review_id: string
          review_stars: number
          review_text: string | null
          review_title: string | null
          reviewed_at: string | null
          status: string
        }
        Insert: {
          ai_response: string
          created_at?: string
          id?: string
          platform: string
          posted_at?: string | null
          rejected_at?: string | null
          review_author?: string | null
          review_db_id: string
          review_id: string
          review_stars: number
          review_text?: string | null
          review_title?: string | null
          reviewed_at?: string | null
          status?: string
        }
        Update: {
          ai_response?: string
          created_at?: string
          id?: string
          platform?: string
          posted_at?: string | null
          rejected_at?: string | null
          review_author?: string | null
          review_db_id?: string
          review_id?: string
          review_stars?: number
          review_text?: string | null
          review_title?: string | null
          reviewed_at?: string | null
          status?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string | null
          id: string
          last_login_at: string | null
          onboarding_completed: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string | null
          id?: string
          last_login_at?: string | null
          onboarding_completed?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          last_login_at?: string | null
          onboarding_completed?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      provider_connections: {
        Row: {
          auth_method: Database["public"]["Enums"]["auth_method"]
          connected_at: string | null
          created_at: string
          credentials: Json
          display_name: string | null
          error_message: string | null
          id: string
          last_synced_at: string | null
          org_id: string
          provider: Database["public"]["Enums"]["provider_type"]
          status: Database["public"]["Enums"]["connection_status"]
          updated_at: string
        }
        Insert: {
          auth_method: Database["public"]["Enums"]["auth_method"]
          connected_at?: string | null
          created_at?: string
          credentials?: Json
          display_name?: string | null
          error_message?: string | null
          id?: string
          last_synced_at?: string | null
          org_id: string
          provider: Database["public"]["Enums"]["provider_type"]
          status?: Database["public"]["Enums"]["connection_status"]
          updated_at?: string
        }
        Update: {
          auth_method?: Database["public"]["Enums"]["auth_method"]
          connected_at?: string | null
          created_at?: string
          credentials?: Json
          display_name?: string | null
          error_message?: string | null
          id?: string
          last_synced_at?: string | null
          org_id?: string
          provider?: Database["public"]["Enums"]["provider_type"]
          status?: Database["public"]["Enums"]["connection_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "provider_connections_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      report_definitions: {
        Row: {
          category: string
          config: Json
          created_at: string
          data_source: string
          description: string | null
          id: string
          name: string
          report_type: string
          slug: string
          updated_at: string
        }
        Insert: {
          category: string
          config?: Json
          created_at?: string
          data_source: string
          description?: string | null
          id?: string
          name: string
          report_type: string
          slug: string
          updated_at?: string
        }
        Update: {
          category?: string
          config?: Json
          created_at?: string
          data_source?: string
          description?: string | null
          id?: string
          name?: string
          report_type?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      review_settings: {
        Row: {
          ai_prompt: string
          braze_canvas_id: string | null
          created_at: string
          email_copy_prompt: string | null
          id: string
          insights_prompt: string | null
          push_notification_prompt: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_prompt?: string
          braze_canvas_id?: string | null
          created_at?: string
          email_copy_prompt?: string | null
          id?: string
          insights_prompt?: string | null
          push_notification_prompt?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_prompt?: string
          braze_canvas_id?: string | null
          created_at?: string
          email_copy_prompt?: string | null
          id?: string
          insights_prompt?: string | null
          push_notification_prompt?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      rule_execution_logs: {
        Row: {
          actions_taken: Json | null
          created_at: string
          errors: Json | null
          executed_at: string
          id: string
          keywords_evaluated: number
          keywords_matched: number
          rule_id: string
          status: string
        }
        Insert: {
          actions_taken?: Json | null
          created_at?: string
          errors?: Json | null
          executed_at?: string
          id?: string
          keywords_evaluated?: number
          keywords_matched?: number
          rule_id: string
          status?: string
        }
        Update: {
          actions_taken?: Json | null
          created_at?: string
          errors?: Json | null
          executed_at?: string
          id?: string
          keywords_evaluated?: number
          keywords_matched?: number
          rule_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "rule_execution_logs_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "keyword_automation_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_competitor_ads: {
        Row: {
          ad_archive_id: string
          ad_creative_body: string | null
          ad_delivery_start_time: string | null
          ad_snapshot_url: string | null
          eu_total_reach: number | null
          id: string
          media_type: string | null
          notes: string | null
          page_id: string | null
          page_name: string | null
          publisher_platforms: string[] | null
          saved_at: string
          user_id: string
        }
        Insert: {
          ad_archive_id: string
          ad_creative_body?: string | null
          ad_delivery_start_time?: string | null
          ad_snapshot_url?: string | null
          eu_total_reach?: number | null
          id?: string
          media_type?: string | null
          notes?: string | null
          page_id?: string | null
          page_name?: string | null
          publisher_platforms?: string[] | null
          saved_at?: string
          user_id: string
        }
        Update: {
          ad_archive_id?: string
          ad_creative_body?: string | null
          ad_delivery_start_time?: string | null
          ad_snapshot_url?: string | null
          eu_total_reach?: number | null
          id?: string
          media_type?: string | null
          notes?: string | null
          page_id?: string | null
          page_name?: string | null
          publisher_platforms?: string[] | null
          saved_at?: string
          user_id?: string
        }
        Relationships: []
      }
      sync_function_logs: {
        Row: {
          completed_at: string | null
          created_at: string
          duration_ms: number | null
          error_message: string | null
          function_name: string
          id: string
          started_at: string
          status: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          function_name: string
          id?: string
          started_at?: string
          status?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          function_name?: string
          id?: string
          started_at?: string
          status?: string
        }
        Relationships: []
      }
      tracker_metric_config: {
        Row: {
          created_at: string
          data_source: string | null
          display_order: number
          id: string
          is_visible: boolean
          metric_key: string
          metric_label: string
          org_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          data_source?: string | null
          display_order?: number
          id?: string
          is_visible?: boolean
          metric_key: string
          metric_label: string
          org_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          data_source?: string | null
          display_order?: number
          id?: string
          is_visible?: boolean
          metric_key?: string
          metric_label?: string
          org_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tracker_metric_config_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      trustpilot_reviews: {
        Row: {
          consumer_country_code: string | null
          consumer_display_name: string | null
          created_at: string
          id: string
          is_verified: boolean | null
          language: string | null
          responded_at: string | null
          response_text: string | null
          review_id: string
          stars: number
          synced_at: string
          text: string | null
          title: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          consumer_country_code?: string | null
          consumer_display_name?: string | null
          created_at: string
          id?: string
          is_verified?: boolean | null
          language?: string | null
          responded_at?: string | null
          response_text?: string | null
          review_id: string
          stars: number
          synced_at?: string
          text?: string | null
          title?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          consumer_country_code?: string | null
          consumer_display_name?: string | null
          created_at?: string
          id?: string
          is_verified?: boolean | null
          language?: string | null
          responded_at?: string | null
          response_text?: string | null
          review_id?: string
          stars?: number
          synced_at?: string
          text?: string | null
          title?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      typeform_surveys: {
        Row: {
          acquisition_source: string | null
          created_at: string
          disappointment_score: number | null
          email: string | null
          feedback_text: string | null
          has_invited_friends: boolean | null
          id: string
          nps_score: number | null
          primary_benefit: string | null
          rating: number
          response_id: string
          submitted_at: string
          synced_at: string
        }
        Insert: {
          acquisition_source?: string | null
          created_at?: string
          disappointment_score?: number | null
          email?: string | null
          feedback_text?: string | null
          has_invited_friends?: boolean | null
          id?: string
          nps_score?: number | null
          primary_benefit?: string | null
          rating: number
          response_id: string
          submitted_at: string
          synced_at?: string
        }
        Update: {
          acquisition_source?: string | null
          created_at?: string
          disappointment_score?: number | null
          email?: string | null
          feedback_text?: string | null
          has_invited_friends?: boolean | null
          id?: string
          nps_score?: number | null
          primary_benefit?: string | null
          rating?: number
          response_id?: string
          submitted_at?: string
          synced_at?: string
        }
        Relationships: []
      }
      user_invitations: {
        Row: {
          accepted_at: string | null
          affiliate_id: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          accepted_at?: string | null
          affiliate_id?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          role?: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          accepted_at?: string | null
          affiliate_id?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: [
          {
            foreignKeyName: "user_invitations_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
        ]
      }
      user_preferences: {
        Row: {
          created_at: string
          id: string
          preference_key: string
          preference_value: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          preference_key: string
          preference_value: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          preference_key?: string
          preference_value?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      weekly_metrics: {
        Row: {
          ad_spend_per_1k_deposit: number | null
          affiliate_metrics: Json | null
          avg_deposit_per_ftd: number | null
          avg_rating: number | null
          blended_cac: number | null
          blended_cpa: number | null
          clicks_by_channel: Json | null
          cost_per_hvp: number | null
          cpa_by_channel: Json | null
          created_at: string
          cvr_ftd_to_std: number | null
          cvr_install_to_signup: number | null
          cvr_install_to_std: number | null
          cvr_signup_to_ftd: number | null
          ftd_cohort_deposits: number | null
          ftds_by_channel: Json | null
          id: string
          is_locked: boolean
          net_deposits_new_users: number | null
          new_users_net_deposits: number | null
          roas: number | null
          spend_by_channel: Json | null
          total_ad_spend: number
          total_affiliate_spend: number
          total_ftds: number
          total_hvps: number | null
          total_installs: number
          total_signups: number
          total_spend: number
          total_stds: number
          updated_at: string
          week_start: string
        }
        Insert: {
          ad_spend_per_1k_deposit?: number | null
          affiliate_metrics?: Json | null
          avg_deposit_per_ftd?: number | null
          avg_rating?: number | null
          blended_cac?: number | null
          blended_cpa?: number | null
          clicks_by_channel?: Json | null
          cost_per_hvp?: number | null
          cpa_by_channel?: Json | null
          created_at?: string
          cvr_ftd_to_std?: number | null
          cvr_install_to_signup?: number | null
          cvr_install_to_std?: number | null
          cvr_signup_to_ftd?: number | null
          ftd_cohort_deposits?: number | null
          ftds_by_channel?: Json | null
          id?: string
          is_locked?: boolean
          net_deposits_new_users?: number | null
          new_users_net_deposits?: number | null
          roas?: number | null
          spend_by_channel?: Json | null
          total_ad_spend?: number
          total_affiliate_spend?: number
          total_ftds?: number
          total_hvps?: number | null
          total_installs?: number
          total_signups?: number
          total_spend?: number
          total_stds?: number
          updated_at?: string
          week_start: string
        }
        Update: {
          ad_spend_per_1k_deposit?: number | null
          affiliate_metrics?: Json | null
          avg_deposit_per_ftd?: number | null
          avg_rating?: number | null
          blended_cac?: number | null
          blended_cpa?: number | null
          clicks_by_channel?: Json | null
          cost_per_hvp?: number | null
          cpa_by_channel?: Json | null
          created_at?: string
          cvr_ftd_to_std?: number | null
          cvr_install_to_signup?: number | null
          cvr_install_to_std?: number | null
          cvr_signup_to_ftd?: number | null
          ftd_cohort_deposits?: number | null
          ftds_by_channel?: Json | null
          id?: string
          is_locked?: boolean
          net_deposits_new_users?: number | null
          new_users_net_deposits?: number | null
          roas?: number | null
          spend_by_channel?: Json | null
          total_ad_spend?: number
          total_affiliate_spend?: number
          total_ftds?: number
          total_hvps?: number | null
          total_installs?: number
          total_signups?: number
          total_spend?: number
          total_stds?: number
          updated_at?: string
          week_start?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_report_avg_rating_app_store: {
        Args: { end_date: string; start_date: string }
        Returns: {
          previous_value: number
          value: number
        }[]
      }
      get_report_avg_rating_blended: {
        Args: { end_date: string; start_date: string }
        Returns: {
          previous_value: number
          value: number
        }[]
      }
      get_report_avg_rating_google_play: {
        Args: { end_date: string; start_date: string }
        Returns: {
          previous_value: number
          value: number
        }[]
      }
      get_report_avg_rating_trustpilot: {
        Args: { end_date: string; start_date: string }
        Returns: {
          previous_value: number
          value: number
        }[]
      }
      get_report_avg_rating_typeform: {
        Args: { end_date: string; start_date: string }
        Returns: {
          previous_value: number
          value: number
        }[]
      }
      get_report_payback_period: {
        Args: { end_date: string; start_date: string }
        Returns: {
          previous_value: number
          value: number
        }[]
      }
      get_report_spend_by_channel: {
        Args: { end_date: string; start_date: string }
        Returns: {
          channel: string
          channel_type: string
          value: number
        }[]
      }
      get_report_top_funnel: {
        Args: { end_date: string; start_date: string }
        Returns: {
          clicks: number
          ctr: number
          impressions: number
          install_rate: number
          installs: number
        }[]
      }
      get_report_total_installs: {
        Args: { end_date: string; start_date: string }
        Returns: {
          previous_value: number
          value: number
        }[]
      }
      get_report_total_spend: {
        Args: { end_date: string; start_date: string }
        Returns: {
          previous_value: number
          value: number
        }[]
      }
      get_unique_ftd_count: {
        Args: { end_ts: string; start_ts: string }
        Returns: number
      }
      get_user_affiliate_channels: {
        Args: { _user_id: string }
        Returns: string[]
      }
      get_user_affiliate_ids: { Args: { _user_id: string }; Returns: string[] }
      get_user_org_ids: { Args: { _user_id: string }; Returns: string[] }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_affiliate_only: { Args: { _user_id: string }; Returns: boolean }
      is_org_admin: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      is_org_member: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      populate_daily_funnel_metrics: {
        Args: { end_dt?: string; start_dt?: string }
        Returns: Json
      }
      populate_daily_funnel_metrics_single_day: {
        Args: { target_date: string }
        Returns: Json
      }
      populate_daily_revenue_metrics:
        | { Args: never; Returns: undefined }
        | { Args: { batch_limit?: number }; Returns: number }
    }
    Enums: {
      affiliate_status: "active" | "paused" | "inactive"
      app_role: "admin" | "editor" | "viewer" | "user" | "affiliate"
      auth_method: "oauth" | "api_key"
      connection_status: "connected" | "disconnected" | "error"
      org_role: "owner" | "admin" | "member"
      provider_type:
        | "meta_ads"
        | "apple_search_ads"
        | "moloco"
        | "appsflyer"
        | "mixpanel"
        | "google_play"
        | "app_store"
        | "trustpilot"
        | "google_search_console"
        | "typeform"
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
    Enums: {
      affiliate_status: ["active", "paused", "inactive"],
      app_role: ["admin", "editor", "viewer", "user", "affiliate"],
      auth_method: ["oauth", "api_key"],
      connection_status: ["connected", "disconnected", "error"],
      org_role: ["owner", "admin", "member"],
      provider_type: [
        "meta_ads",
        "apple_search_ads",
        "moloco",
        "appsflyer",
        "mixpanel",
        "google_play",
        "app_store",
        "trustpilot",
        "google_search_console",
        "typeform",
      ],
    },
  },
} as const
