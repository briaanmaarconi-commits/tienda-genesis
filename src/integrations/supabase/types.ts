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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      banners: {
        Row: {
          active: boolean
          bg_color: string | null
          created_at: string
          cta_href: string | null
          cta_text: string | null
          fit: string
          focal_x: number
          focal_y: number
          hide_text_mobile: boolean
          id: string
          image_url: string | null
          sort_order: number
          subtitle: string | null
          title: string
          updated_at: string
          zoom: number
        }
        Insert: {
          active?: boolean
          bg_color?: string | null
          created_at?: string
          cta_href?: string | null
          cta_text?: string | null
          fit?: string
          focal_x?: number
          focal_y?: number
          hide_text_mobile?: boolean
          id?: string
          image_url?: string | null
          sort_order?: number
          subtitle?: string | null
          title?: string
          updated_at?: string
          zoom?: number
        }
        Update: {
          active?: boolean
          bg_color?: string | null
          created_at?: string
          cta_href?: string | null
          cta_text?: string | null
          fit?: string
          focal_x?: number
          focal_y?: number
          hide_text_mobile?: boolean
          id?: string
          image_url?: string | null
          sort_order?: number
          subtitle?: string | null
          title?: string
          updated_at?: string
          zoom?: number
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          name: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          name: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          name?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      coupons: {
        Row: {
          active: boolean
          code: string
          created_at: string
          discount_type: Database["public"]["Enums"]["discount_type"]
          discount_value: number
          ends_at: string | null
          id: string
          min_order_total: number | null
          starts_at: string | null
          times_used: number
          updated_at: string
          usage_limit: number | null
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          discount_type?: Database["public"]["Enums"]["discount_type"]
          discount_value?: number
          ends_at?: string | null
          id?: string
          min_order_total?: number | null
          starts_at?: string | null
          times_used?: number
          updated_at?: string
          usage_limit?: number | null
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          discount_type?: Database["public"]["Enums"]["discount_type"]
          discount_value?: number
          ends_at?: string | null
          id?: string
          min_order_total?: number | null
          starts_at?: string | null
          times_used?: number
          updated_at?: string
          usage_limit?: number | null
        }
        Relationships: []
      }
      customers: {
        Row: {
          address: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      free_shipping_rules: {
        Row: {
          active: boolean
          created_at: string
          id: string
          min_amount: number
          postal_code_from: string | null
          postal_code_to: string | null
          province: string | null
          shipping_method_id: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          min_amount?: number
          postal_code_from?: string | null
          postal_code_to?: string | null
          province?: string | null
          shipping_method_id?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          min_amount?: number
          postal_code_from?: string | null
          postal_code_to?: string | null
          province?: string | null
          shipping_method_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "free_shipping_rules_shipping_method_id_fkey"
            columns: ["shipping_method_id"]
            isOneToOne: false
            referencedRelation: "shipping_methods"
            referencedColumns: ["id"]
          },
        ]
      }
      local_delivery_zones: {
        Row: {
          active: boolean
          cost: number
          created_at: string
          estimated_time: string | null
          id: string
          name: string
          postal_codes: string[]
          shipping_method_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          cost?: number
          created_at?: string
          estimated_time?: string | null
          id?: string
          name: string
          postal_codes?: string[]
          shipping_method_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          cost?: number
          created_at?: string
          estimated_time?: string | null
          id?: string
          name?: string
          postal_codes?: string[]
          shipping_method_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "local_delivery_zones_shipping_method_id_fkey"
            columns: ["shipping_method_id"]
            isOneToOne: false
            referencedRelation: "shipping_methods"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_methods: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
          provider: string
          sort_order: number
          surcharge_pct: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
          provider?: string
          sort_order?: number
          surcharge_pct?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          provider?: string
          sort_order?: number
          surcharge_pct?: number
          updated_at?: string
        }
        Relationships: []
      }
      product_addon_groups: {
        Row: {
          active: boolean
          created_at: string
          id: string
          is_multiplier: boolean
          name: string
          per_unit: boolean
          product_id: string
          required: boolean
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          is_multiplier?: boolean
          name: string
          per_unit?: boolean
          product_id: string
          required?: boolean
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          is_multiplier?: boolean
          name?: string
          per_unit?: boolean
          product_id?: string
          required?: boolean
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_addon_groups_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_addon_options: {
        Row: {
          active: boolean
          created_at: string
          extra_price: number
          group_id: string
          id: string
          name: string
          price_multiplier: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          extra_price?: number
          group_id: string
          id?: string
          name: string
          price_multiplier?: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          extra_price?: number
          group_id?: string
          id?: string
          name?: string
          price_multiplier?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_addon_options_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "product_addon_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      product_images: {
        Row: {
          created_at: string
          fit: string
          focal_x: number
          focal_y: number
          id: string
          product_id: string
          sort_order: number
          url: string
          zoom: number
        }
        Insert: {
          created_at?: string
          fit?: string
          focal_x?: number
          focal_y?: number
          id?: string
          product_id: string
          sort_order?: number
          url: string
          zoom?: number
        }
        Update: {
          created_at?: string
          fit?: string
          focal_x?: number
          focal_y?: number
          id?: string
          product_id?: string
          sort_order?: number
          url?: string
          zoom?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_packs: {
        Row: {
          compare_at_price: number | null
          created_at: string
          id: string
          label: string | null
          photos_required: number | null
          price: number
          product_id: string
          sale_ends_at: string | null
          sale_starts_at: string | null
          sort_order: number
          units: number | null
        }
        Insert: {
          compare_at_price?: number | null
          created_at?: string
          id?: string
          label?: string | null
          photos_required?: number | null
          price?: number
          product_id: string
          sale_ends_at?: string | null
          sale_starts_at?: string | null
          sort_order?: number
          units?: number | null
        }
        Update: {
          compare_at_price?: number | null
          created_at?: string
          id?: string
          label?: string | null
          photos_required?: number | null
          price?: number
          product_id?: string
          sale_ends_at?: string | null
          sale_starts_at?: string | null
          sort_order?: number
          units?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_packs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_sticker_folders: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
          product_id: string
          slug: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
          product_id: string
          slug?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          product_id?: string
          slug?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_sticker_folders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_stickers: {
        Row: {
          active: boolean
          created_at: string
          folder_id: string
          id: string
          image_url: string | null
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          folder_id: string
          id?: string
          image_url?: string | null
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          folder_id?: string
          id?: string
          image_url?: string | null
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_stickers_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "product_sticker_folders"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          active: boolean
          category_id: string | null
          compare_at_price: number | null
          cost: number
          created_at: string
          description: string | null
          featured: boolean
          height_cm: number
          id: string
          length_cm: number
          name: string
          price: number
          product_type: string
          sale_ends_at: string | null
          sale_starts_at: string | null
          slug: string
          stock: number
          updated_at: string
          weight_kg: number
          width_cm: number
        }
        Insert: {
          active?: boolean
          category_id?: string | null
          compare_at_price?: number | null
          cost?: number
          created_at?: string
          description?: string | null
          featured?: boolean
          height_cm?: number
          id?: string
          length_cm?: number
          name: string
          price?: number
          product_type?: string
          sale_ends_at?: string | null
          sale_starts_at?: string | null
          slug: string
          stock?: number
          updated_at?: string
          weight_kg?: number
          width_cm?: number
        }
        Update: {
          active?: boolean
          category_id?: string | null
          compare_at_price?: number | null
          cost?: number
          created_at?: string
          description?: string | null
          featured?: boolean
          height_cm?: number
          id?: string
          length_cm?: number
          name?: string
          price?: number
          product_type?: string
          sale_ends_at?: string | null
          sale_starts_at?: string | null
          slug?: string
          stock?: number
          updated_at?: string
          weight_kg?: number
          width_cm?: number
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_items: {
        Row: {
          addons: Json | null
          created_at: string
          custom_sticker_config: Json | null
          id: string
          photos: Json | null
          product_id: string | null
          product_name: string
          quantity: number
          sale_id: string
          subtotal: number
          unit_cost: number
          unit_price: number
        }
        Insert: {
          addons?: Json | null
          created_at?: string
          custom_sticker_config?: Json | null
          id?: string
          photos?: Json | null
          product_id?: string | null
          product_name: string
          quantity?: number
          sale_id: string
          subtotal?: number
          unit_cost?: number
          unit_price?: number
        }
        Update: {
          addons?: Json | null
          created_at?: string
          custom_sticker_config?: Json | null
          id?: string
          photos?: Json | null
          product_id?: string | null
          product_name?: string
          quantity?: number
          sale_id?: string
          subtotal?: number
          unit_cost?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          andreani_branch_id: string | null
          andreani_label_url: string | null
          andreani_status: string | null
          andreani_tracking_number: string | null
          coupon_code: string | null
          created_at: string
          customer_id: string | null
          discount_amount: number
          id: string
          mp_payment_id: string | null
          mp_preference_id: string | null
          mp_status: string | null
          notes: string | null
          order_number: number
          payment_method_id: string | null
          shipping_address_extra: string | null
          shipping_branch_id: string | null
          shipping_branch_name: string | null
          shipping_cost: number
          shipping_locality: string | null
          shipping_method_id: string | null
          shipping_postal_code: string | null
          shipping_province: string | null
          source: Database["public"]["Enums"]["sale_source"]
          status: Database["public"]["Enums"]["sale_status"]
          subtotal: number
          surcharge: number
          total: number
          tracking_carrier: string | null
          tracking_code: string | null
          updated_at: string
        }
        Insert: {
          andreani_branch_id?: string | null
          andreani_label_url?: string | null
          andreani_status?: string | null
          andreani_tracking_number?: string | null
          coupon_code?: string | null
          created_at?: string
          customer_id?: string | null
          discount_amount?: number
          id?: string
          mp_payment_id?: string | null
          mp_preference_id?: string | null
          mp_status?: string | null
          notes?: string | null
          order_number?: number
          payment_method_id?: string | null
          shipping_address_extra?: string | null
          shipping_branch_id?: string | null
          shipping_branch_name?: string | null
          shipping_cost?: number
          shipping_locality?: string | null
          shipping_method_id?: string | null
          shipping_postal_code?: string | null
          shipping_province?: string | null
          source?: Database["public"]["Enums"]["sale_source"]
          status?: Database["public"]["Enums"]["sale_status"]
          subtotal?: number
          surcharge?: number
          total?: number
          tracking_carrier?: string | null
          tracking_code?: string | null
          updated_at?: string
        }
        Update: {
          andreani_branch_id?: string | null
          andreani_label_url?: string | null
          andreani_status?: string | null
          andreani_tracking_number?: string | null
          coupon_code?: string | null
          created_at?: string
          customer_id?: string | null
          discount_amount?: number
          id?: string
          mp_payment_id?: string | null
          mp_preference_id?: string | null
          mp_status?: string | null
          notes?: string | null
          order_number?: number
          payment_method_id?: string | null
          shipping_address_extra?: string | null
          shipping_branch_id?: string | null
          shipping_branch_name?: string | null
          shipping_cost?: number
          shipping_locality?: string | null
          shipping_method_id?: string | null
          shipping_postal_code?: string | null
          shipping_province?: string | null
          source?: Database["public"]["Enums"]["sale_source"]
          status?: Database["public"]["Enums"]["sale_status"]
          subtotal?: number
          surcharge?: number
          total?: number
          tracking_carrier?: string | null
          tracking_code?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_payment_method_id_fkey"
            columns: ["payment_method_id"]
            isOneToOne: false
            referencedRelation: "payment_methods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_shipping_method_id_fkey"
            columns: ["shipping_method_id"]
            isOneToOne: false
            referencedRelation: "shipping_methods"
            referencedColumns: ["id"]
          },
        ]
      }
      shipping_methods: {
        Row: {
          active: boolean
          cost: number
          created_at: string
          delivery_type: string
          estimated_time: string | null
          id: string
          name: string
          pickup_hours: string | null
          provider: string
          rate_mode: string
          sort_order: number
          tipo: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          cost?: number
          created_at?: string
          delivery_type?: string
          estimated_time?: string | null
          id?: string
          name: string
          pickup_hours?: string | null
          provider?: string
          rate_mode?: string
          sort_order?: number
          tipo?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          cost?: number
          created_at?: string
          delivery_type?: string
          estimated_time?: string | null
          id?: string
          name?: string
          pickup_hours?: string | null
          provider?: string
          rate_mode?: string
          sort_order?: number
          tipo?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      shipping_rates: {
        Row: {
          active: boolean
          cost: number
          created_at: string
          free_from_amount: number | null
          id: string
          postal_code_from: string | null
          postal_code_to: string | null
          province: string | null
          shipping_method_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          cost?: number
          created_at?: string
          free_from_amount?: number | null
          id?: string
          postal_code_from?: string | null
          postal_code_to?: string | null
          province?: string | null
          shipping_method_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          cost?: number
          created_at?: string
          free_from_amount?: number | null
          id?: string
          postal_code_from?: string | null
          postal_code_to?: string | null
          province?: string | null
          shipping_method_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipping_rates_shipping_method_id_fkey"
            columns: ["shipping_method_id"]
            isOneToOne: false
            referencedRelation: "shipping_methods"
            referencedColumns: ["id"]
          },
        ]
      }
      site_settings: {
        Row: {
          about_content: string | null
          address: string | null
          admin_notify_email: string | null
          email: string | null
          employee_profit_pct: number
          facebook_url: string | null
          id: string
          info_content: string | null
          info_faqs: Json | null
          instagram_url: string | null
          logo_url: string | null
          phone: string | null
          shipping_origin_postal_code: string | null
          site_name: string
          transfer_alias: string | null
          transfer_bank: string | null
          transfer_cbu: string | null
          transfer_holder: string | null
          transfer_notes: string | null
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          about_content?: string | null
          address?: string | null
          admin_notify_email?: string | null
          email?: string | null
          employee_profit_pct?: number
          facebook_url?: string | null
          id?: string
          info_content?: string | null
          info_faqs?: Json | null
          instagram_url?: string | null
          logo_url?: string | null
          phone?: string | null
          shipping_origin_postal_code?: string | null
          site_name?: string
          transfer_alias?: string | null
          transfer_bank?: string | null
          transfer_cbu?: string | null
          transfer_holder?: string | null
          transfer_notes?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          about_content?: string | null
          address?: string | null
          admin_notify_email?: string | null
          email?: string | null
          employee_profit_pct?: number
          facebook_url?: string | null
          id?: string
          info_content?: string | null
          info_faqs?: Json | null
          instagram_url?: string | null
          logo_url?: string | null
          phone?: string | null
          shipping_origin_postal_code?: string | null
          site_name?: string
          transfer_alias?: string | null
          transfer_bank?: string | null
          transfer_cbu?: string | null
          transfer_holder?: string | null
          transfer_notes?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          category: string
          created_at: string
          description: string | null
          expense_date: string
          id: string
        }
        Insert: {
          amount: number
          category: string
          created_at?: string
          description?: string | null
          expense_date?: string
          id?: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          description?: string | null
          expense_date?: string
          id?: string
        }
        Relationships: []
      }
      sticker_finishes: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
          sort_order: number
          surcharge: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
          sort_order?: number
          surcharge?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
          surcharge?: number
          updated_at?: string
        }
        Relationships: []
      }
      sticker_materials: {
        Row: {
          active: boolean
          base_price: number
          created_at: string
          id: string
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          base_price?: number
          created_at?: string
          id?: string
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          base_price?: number
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      sticker_quantities: {
        Row: {
          active: boolean
          created_at: string
          discount_pct: number
          id: string
          quantity: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          discount_pct?: number
          id?: string
          quantity: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          discount_pct?: number
          id?: string
          quantity?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      sticker_shapes: {
        Row: {
          active: boolean
          created_at: string
          icon: string | null
          id: string
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          icon?: string | null
          id?: string
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          icon?: string | null
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      sticker_sizes: {
        Row: {
          active: boolean
          created_at: string
          height_cm: number
          id: string
          label: string
          price_multiplier: number
          sort_order: number
          updated_at: string
          width_cm: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          height_cm?: number
          id?: string
          label: string
          price_multiplier?: number
          sort_order?: number
          updated_at?: string
          width_cm?: number
        }
        Update: {
          active?: boolean
          created_at?: string
          height_cm?: number
          id?: string
          label?: string
          price_multiplier?: number
          sort_order?: number
          updated_at?: string
          width_cm?: number
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
          role: Database["public"]["Enums"]["app_role"]
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
    }
    Views: {
      site_settings_public: {
        Row: {
          about_content: string | null
          address: string | null
          email: string | null
          facebook_url: string | null
          id: string | null
          info_content: string | null
          info_faqs: Json | null
          instagram_url: string | null
          logo_url: string | null
          phone: string | null
          shipping_origin_postal_code: string | null
          site_name: string | null
          updated_at: string | null
          whatsapp: string | null
        }
        Insert: {
          about_content?: string | null
          address?: string | null
          email?: string | null
          facebook_url?: string | null
          id?: string | null
          info_content?: string | null
          info_faqs?: Json | null
          instagram_url?: string | null
          logo_url?: string | null
          phone?: string | null
          shipping_origin_postal_code?: string | null
          site_name?: string | null
          updated_at?: string | null
          whatsapp?: string | null
        }
        Update: {
          about_content?: string | null
          address?: string | null
          email?: string | null
          facebook_url?: string | null
          id?: string | null
          info_content?: string | null
          info_faqs?: Json | null
          instagram_url?: string | null
          logo_url?: string | null
          phone?: string | null
          shipping_origin_postal_code?: string | null
          site_name?: string | null
          updated_at?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      apply_coupon: { Args: { _code: string }; Returns: undefined }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
      discount_type: "percentage" | "fixed"
      sale_source: "admin" | "public"
      sale_status:
        | "pendiente"
        | "confirmada"
        | "enviada"
        | "entregada"
        | "cancelada"
        | "abonado"
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
      app_role: ["admin", "user"],
      discount_type: ["percentage", "fixed"],
      sale_source: ["admin", "public"],
      sale_status: [
        "pendiente",
        "confirmada",
        "enviada",
        "entregada",
        "cancelada",
        "abonado",
      ],
    },
  },
} as const
