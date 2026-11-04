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
      active_connections: {
        Row: {
          client_key: string
          ip: string | null
          last_seen: string
          line_id: string
          user_agent: string | null
        }
        Insert: {
          client_key: string
          ip?: string | null
          last_seen?: string
          line_id: string
          user_agent?: string | null
        }
        Update: {
          client_key?: string
          ip?: string | null
          last_seen?: string
          line_id?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "active_connections_line_id_fkey"
            columns: ["line_id"]
            isOneToOne: false
            referencedRelation: "lines"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
        Row: {
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      channels: {
        Row: {
          group_title: string | null
          id: string
          logo: string | null
          m3u_metadata: Json | null
          name: string
          playlist_id: string
          position: number
          referrer: string | null
          type: string | null
          url: string
          user_agent: string | null
        }
        Insert: {
          group_title?: string | null
          id?: string
          logo?: string | null
          m3u_metadata?: Json | null
          name: string
          playlist_id: string
          position?: number
          referrer?: string | null
          type?: string | null
          url: string
          user_agent?: string | null
        }
        Update: {
          group_title?: string | null
          id?: string
          logo?: string | null
          m3u_metadata?: Json | null
          name?: string
          playlist_id?: string
          position?: number
          referrer?: string | null
          type?: string | null
          url?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "channels_playlist_id_fkey"
            columns: ["playlist_id"]
            isOneToOne: false
            referencedRelation: "playlists"
            referencedColumns: ["id"]
          },
        ]
      }
      content_episodes: {
        Row: {
          created_at: string
          description: string
          episode_number: number
          id: string
          language_label: string
          original_url: string
          owner_id: string
          poster_url: string | null
          provider_shared: boolean
          published: boolean
          release_date: string | null
          season_id: string
          season_number: number
          series_id: string
          source_type: string
          title: string
          updated_at: string
          youtube_video_id: string
        }
        Insert: {
          created_at?: string
          description?: string
          episode_number: number
          id?: string
          language_label?: string
          original_url: string
          owner_id?: string
          poster_url?: string | null
          provider_shared?: boolean
          published?: boolean
          release_date?: string | null
          season_id: string
          season_number: number
          series_id: string
          source_type?: string
          title: string
          updated_at?: string
          youtube_video_id: string
        }
        Update: {
          created_at?: string
          description?: string
          episode_number?: number
          id?: string
          language_label?: string
          original_url?: string
          owner_id?: string
          poster_url?: string | null
          provider_shared?: boolean
          published?: boolean
          release_date?: string | null
          season_id?: string
          season_number?: number
          series_id?: string
          source_type?: string
          title?: string
          updated_at?: string
          youtube_video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_episodes_season_id_series_id_owner_id_season_numbe_fkey"
            columns: ["season_id", "series_id", "owner_id", "season_number"]
            isOneToOne: false
            referencedRelation: "content_seasons"
            referencedColumns: ["id", "series_id", "owner_id", "season_number"]
          },
        ]
      }
      content_seasons: {
        Row: {
          created_at: string
          id: string
          owner_id: string
          season_number: number
          series_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          owner_id?: string
          season_number: number
          series_id: string
        }
        Update: {
          created_at?: string
          id?: string
          owner_id?: string
          season_number?: number
          series_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_seasons_series_id_owner_id_fkey"
            columns: ["series_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "content_series"
            referencedColumns: ["id", "owner_id"]
          },
        ]
      }
      content_series: {
        Row: {
          category: string
          created_at: string
          description: string
          english_name: string | null
          id: string
          original_name: string | null
          owner_id: string
          poster_url: string | null
          provider_key: string
          source_identity: string | null
          title: string
          tmdb_id: number | null
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string
          english_name?: string | null
          id?: string
          original_name?: string | null
          owner_id?: string
          poster_url?: string | null
          provider_key?: string
          source_identity?: string | null
          title: string
          tmdb_id?: number | null
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string
          english_name?: string | null
          id?: string
          original_name?: string | null
          owner_id?: string
          poster_url?: string | null
          provider_key?: string
          source_identity?: string | null
          title?: string
          tmdb_id?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      credit_transactions: {
        Row: {
          actor_id: string | null
          amount: number
          created_at: string
          id: string
          reason: string
          reseller_id: string
        }
        Insert: {
          actor_id?: string | null
          amount: number
          created_at?: string
          id?: string
          reason: string
          reseller_id: string
        }
        Update: {
          actor_id?: string | null
          amount?: number
          created_at?: string
          id?: string
          reason?: string
          reseller_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_transactions_reseller_id_fkey"
            columns: ["reseller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      image_links: {
        Row: {
          created_at: string
          created_by: string
          format: string
          height: number
          id: string
          original_name: string
          path: string
          size_bytes: number
          url: string
          width: number
        }
        Insert: {
          created_at?: string
          created_by?: string
          format: string
          height: number
          id?: string
          original_name: string
          path: string
          size_bytes: number
          url: string
          width: number
        }
        Update: {
          created_at?: string
          created_by?: string
          format?: string
          height?: number
          id?: string
          original_name?: string
          path?: string
          size_bytes?: number
          url?: string
          width?: number
        }
        Relationships: []
      }
      lines: {
        Row: {
          created_at: string
          custom_host: string | null
          customer_contact: string | null
          expires_at: string
          id: string
          is_test: boolean
          max_connections: number
          panel_message: string | null
          panel_status: string
          password: string
          reseller_id: string
          username: string
        }
        Insert: {
          created_at?: string
          custom_host?: string | null
          customer_contact?: string | null
          expires_at: string
          id?: string
          is_test?: boolean
          max_connections?: number
          panel_message?: string | null
          panel_status?: string
          password: string
          reseller_id: string
          username: string
        }
        Update: {
          created_at?: string
          custom_host?: string | null
          customer_contact?: string | null
          expires_at?: string
          id?: string
          is_test?: boolean
          max_connections?: number
          panel_message?: string | null
          panel_status?: string
          password?: string
          reseller_id?: string
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "lines_reseller_id_fkey"
            columns: ["reseller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      playlists: {
        Row: {
          channel_count: number
          created_at: string
          id: string
          m3u_header: string
          m3u_newline: string
          name: string
        }
        Insert: {
          channel_count?: number
          created_at?: string
          id?: string
          m3u_header?: string
          m3u_newline?: string
          name: string
        }
        Update: {
          channel_count?: number
          created_at?: string
          id?: string
          m3u_header?: string
          m3u_newline?: string
          name?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          credits: number
          display_name: string | null
          email: string
          id: string
        }
        Insert: {
          created_at?: string
          credits?: number
          display_name?: string | null
          email: string
          id: string
        }
        Update: {
          created_at?: string
          credits?: number
          display_name?: string | null
          email?: string
          id?: string
        }
        Relationships: []
      }
      provider_catalog_cache: {
        Row: {
          catalog: Json
          checked_at: string
          etag: string | null
          key: string
          source_url: string
        }
        Insert: {
          catalog: Json
          checked_at?: string
          etag?: string | null
          key: string
          source_url: string
        }
        Update: {
          catalog?: Json
          checked_at?: string
          etag?: string | null
          key?: string
          source_url?: string
        }
        Relationships: []
      }
      provider_request_logs: {
        Row: {
          created_at: string
          duration_ms: number
          id: number
          request_type: string
          status: number
          timed_out: boolean
        }
        Insert: {
          created_at?: string
          duration_ms: number
          id?: never
          request_type: string
          status: number
          timed_out?: boolean
        }
        Update: {
          created_at?: string
          duration_ms?: number
          id?: never
          request_type?: string
          status?: number
          timed_out?: boolean
        }
        Relationships: []
      }
      test_claims: {
        Row: {
          created_at: string
          customer_key: string
          line_id: string | null
          reseller_id: string
        }
        Insert: {
          created_at?: string
          customer_key: string
          line_id?: string | null
          reseller_id: string
        }
        Update: {
          created_at?: string
          customer_key?: string
          line_id?: string | null
          reseller_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_provider_youtube_episode: {
        Args: {
          _english_name: string
          _episode_number: number
          _language_label: string
          _original_name: string
          _original_url: string
          _owner_id: string
          _poster_url: string
          _provider_key: string
          _season_number: number
          _tmdb_id: number
          _video_id: string
        }
        Returns: string
      }
      adjust_credits: {
        Args: { _amount: number; _reason: string; _reseller_id: string }
        Returns: number
      }
      check_stream_limit:
        | {
            Args: { _client_key: string; _line_id: string; _max: number }
            Returns: boolean
          }
        | {
            Args: {
              _client_key: string
              _ip?: string
              _line_id: string
              _max: number
              _user_agent?: string
            }
            Returns: boolean
          }
      connection_upgrade_cost: {
        Args: {
          _at: string
          _expires_at: string
          _new_connections: number
          _old_connections: number
        }
        Returns: number
      }
      create_line: {
        Args: { _months: number; _password: string; _username: string }
        Returns: {
          created_at: string
          custom_host: string | null
          customer_contact: string | null
          expires_at: string
          id: string
          is_test: boolean
          max_connections: number
          panel_message: string | null
          panel_status: string
          password: string
          reseller_id: string
          username: string
        }
        SetofOptions: {
          from: "*"
          to: "lines"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_test_line: {
        Args: { _customer: string; _password: string; _username: string }
        Returns: {
          created_at: string
          custom_host: string | null
          customer_contact: string | null
          expires_at: string
          id: string
          is_test: boolean
          max_connections: number
          panel_message: string | null
          panel_status: string
          password: string
          reseller_id: string
          username: string
        }
        SetofOptions: {
          from: "*"
          to: "lines"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      normalize_customer: { Args: { _c: string }; Returns: string }
      prune_provider_request_logs: { Args: never; Returns: undefined }
      public_video_path: { Args: { p_short: string }; Returns: string }
      renew_line: {
        Args: { _line_id: string; _months: number }
        Returns: {
          created_at: string
          custom_host: string | null
          customer_contact: string | null
          expires_at: string
          id: string
          is_test: boolean
          max_connections: number
          panel_message: string | null
          panel_status: string
          password: string
          reseller_id: string
          username: string
        }
        SetofOptions: {
          from: "*"
          to: "lines"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      swap_channel_positions: {
        Args: { _channel_id: string; _neighbor_id: string }
        Returns: undefined
      }
      test_used: { Args: { _customer: string }; Returns: Json }
      update_line: {
        Args: {
          _custom_host: string
          _expires_at?: string
          _line_id: string
          _max_connections: number
          _password: string
        }
        Returns: number
      }
    }
    Enums: {
      app_role: "admin" | "reseller"
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
      app_role: ["admin", "reseller"],
    },
  },
} as const
