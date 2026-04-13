export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          full_name: string | null
          onboarding_complete: boolean
          plan: 'trial' | 'starter' | 'pro' | 'business'
          evisitor_username: string | null
          evisitor_password: string | null
          evisitor_connected: boolean
          evisitor_auto_checkin: boolean
          created_at: string
        }
        Insert: {
          id: string
          full_name?: string | null
          onboarding_complete?: boolean
          plan?: 'trial' | 'starter' | 'pro' | 'business'
          evisitor_username?: string | null
          evisitor_password?: string | null
          evisitor_connected?: boolean
          evisitor_auto_checkin?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          full_name?: string | null
          onboarding_complete?: boolean
          plan?: 'trial' | 'starter' | 'pro' | 'business'
          evisitor_username?: string | null
          evisitor_password?: string | null
          evisitor_connected?: boolean
          evisitor_auto_checkin?: boolean
          created_at?: string
        }
      }
      messages: {
        Row: {
          id: string
          user_id: string
          role: 'user' | 'bot'
          content: string
          type: 'text' | 'card' | 'quick_actions'
          metadata: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          role: 'user' | 'bot'
          content: string
          type?: 'text' | 'card' | 'quick_actions'
          metadata?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          role?: 'user' | 'bot'
          content?: string
          type?: 'text' | 'card' | 'quick_actions'
          metadata?: Json | null
          created_at?: string
        }
      }
      apartments: {
        Row: {
          id: string
          user_id: string
          name: string
          wifi_ssid: string | null
          wifi_password: string | null
          parking: string | null
          rules: string | null
          checkin_instructions: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          wifi_ssid?: string | null
          wifi_password?: string | null
          parking?: string | null
          rules?: string | null
          checkin_instructions?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          wifi_ssid?: string | null
          wifi_password?: string | null
          parking?: string | null
          rules?: string | null
          checkin_instructions?: string | null
          created_at?: string
        }
      }
      contacts: {
        Row: {
          id: string
          user_id: string
          name: string
          role: 'cleaner' | 'cohost' | 'maintenance'
          phone: string | null
          email: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          role: 'cleaner' | 'cohost' | 'maintenance'
          phone?: string | null
          email?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          role?: 'cleaner' | 'cohost' | 'maintenance'
          phone?: string | null
          email?: string | null
          created_at?: string
        }
      }
      evisitor_log: {
        Row: {
          id: string
          user_id: string
          action: 'checkin' | 'checkout' | 'cancel'
          guest_name: string
          apartment_name: string
          evisitor_id: string | null
          status: 'success' | 'error'
          error_message: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          action: 'checkin' | 'checkout' | 'cancel'
          guest_name: string
          apartment_name: string
          evisitor_id?: string | null
          status: 'success' | 'error'
          error_message?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          action?: 'checkin' | 'checkout' | 'cancel'
          guest_name?: string
          apartment_name?: string
          evisitor_id?: string | null
          status?: 'success' | 'error'
          error_message?: string | null
          created_at?: string
        }
      }
      waitlist: {
        Row: {
          id: string
          email: string
          apartments: string
          location: string | null
          created_at: string
        }
        Insert: {
          id?: string
          email: string
          apartments: string
          location?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          email?: string
          apartments?: string
          location?: string | null
          created_at?: string
        }
      }
    }
  }
}
