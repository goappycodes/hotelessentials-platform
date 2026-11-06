export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      customers: {
        Row: {
          id: string
          customer_type: Database["public"]["Enums"]["customer_type"]
          salutation: string | null
          first_name: string | null
          last_name: string | null
          company_name: string | null
          display_name: string
          email: string | null
          work_phone: string | null
          mobile: string | null
          language: string
          gst_treatment: Database["public"]["Enums"]["gst_treatment"] | null
          gstin: string | null
          place_of_supply: string | null
          pan: string | null
          tax_preference: Database["public"]["Enums"]["customer_tax_preference"]
          exemption_reason: string | null
          accounts_receivable: string
          opening_balance: number
          payment_terms: string
          price_list_id: string | null
          owner_id: string | null
          billing_attention: string | null
          billing_country: string | null
          billing_street1: string | null
          billing_street2: string | null
          billing_city: string | null
          billing_state: string | null
          billing_pin_code: string | null
          billing_phone: string | null
          billing_fax: string | null
          shipping_attention: string | null
          shipping_country: string | null
          shipping_street1: string | null
          shipping_street2: string | null
          shipping_city: string | null
          shipping_state: string | null
          shipping_pin_code: string | null
          shipping_phone: string | null
          shipping_fax: string | null
          remarks: string | null
          is_active: boolean
          // The customer's ID in the system it was imported from (Zoho "Contact ID").
          external_id: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        // Customers are saved through public.save_customer (imports insert directly).
        Insert: Partial<Database["public"]["Tables"]["customers"]["Row"]> & { display_name: string }
        Update: Partial<Database["public"]["Tables"]["customers"]["Row"]>
        Relationships: [
          {
            foreignKeyName: "customers_price_list_id_fkey"
            columns: ["price_list_id"]
            isOneToOne: false
            referencedRelation: "price_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_contacts: {
        Row: {
          id: string
          customer_id: string
          salutation: string | null
          first_name: string | null
          last_name: string | null
          email: string | null
          work_phone: string | null
          mobile: string | null
          sort_order: number
        }
        Insert: Partial<Database["public"]["Tables"]["customer_contacts"]["Row"]> & {
          customer_id: string
        }
        Update: Partial<Database["public"]["Tables"]["customer_contacts"]["Row"]>
        Relationships: [
          {
            foreignKeyName: "customer_contacts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_settings: {
        Row: {
          id: boolean
          // GST state code of the business, e.g. "19"; null until set.
          gst_state_code: string | null
          // Printed on quotations.
          company_name: string | null
          address: string | null
          phone: string | null
          email: string | null
          gstin: string | null
          bank_details: string | null
          // Files in the company-assets bucket.
          // A second address block in the quotation header.
          address_2: string | null
          pan: string | null
          logo_path: string | null
          signature_path: string | null
          updated_at: string
        }
        Insert: Partial<Database["public"]["Tables"]["organization_settings"]["Row"]>
        Update: Partial<Database["public"]["Tables"]["organization_settings"]["Row"]>
        Relationships: []
      }
      quotations: {
        Row: {
          id: string
          quote_number: string
          reference_number: string | null
          customer_id: string
          customer_name: string
          quote_date: string
          expiry_date: string | null
          salesperson_id: string | null
          subject: string | null
          price_list_id: string | null
          place_of_supply: string | null
          discount_level: Database["public"]["Enums"]["discount_level"]
          discount_value: number
          discount_is_percent: boolean
          is_discount_before_tax: boolean
          adjustment: number
          adjustment_description: string | null
          notes: string | null
          terms: string | null
          status: Database["public"]["Enums"]["quotation_status"]
          sub_total: number
          discount_total: number
          tax_total: number
          total: number
          // TDS comes off the total, TCS is added; name and rate are kept as picked.
          tax_deduction_type: Database["public"]["Enums"]["direct_tax_kind"]
          direct_tax_id: string | null
          direct_tax_name: string | null
          direct_tax_rate: number | null
          direct_tax_amount: number
          created_by: string | null
          created_at: string
          updated_at: string
        }
        // Saved through public.save_quotation.
        Insert: Partial<Database["public"]["Tables"]["quotations"]["Row"]> & {
          customer_id: string
          customer_name: string
        }
        Update: Partial<Database["public"]["Tables"]["quotations"]["Row"]>
        Relationships: [
          {
            foreignKeyName: "quotations_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotations_salesperson_id_fkey"
            columns: ["salesperson_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotations_price_list_id_fkey"
            columns: ["price_list_id"]
            isOneToOne: false
            referencedRelation: "price_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      direct_tax_rates: {
        Row: {
          id: string
          kind: Database["public"]["Enums"]["direct_tax_kind"]
          name: string
          rate: number
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: Partial<Database["public"]["Tables"]["direct_tax_rates"]["Row"]> & {
          kind: Database["public"]["Enums"]["direct_tax_kind"]
          name: string
          rate: number
        }
        Update: Partial<Database["public"]["Tables"]["direct_tax_rates"]["Row"]>
        Relationships: []
      }
      quotation_attachments: {
        Row: {
          id: string
          quotation_id: string
          storage_path: string
          file_name: string
          content_type: string | null
          file_size: number | null
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          quotation_id: string
          storage_path: string
          file_name: string
          content_type?: string | null
          file_size?: number | null
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          quotation_id?: string
          storage_path?: string
          file_name?: string
          content_type?: string | null
          file_size?: number | null
          created_by?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quotation_attachments_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "quotations"
            referencedColumns: ["id"]
          },
        ]
      }
      quotation_items: {
        Row: {
          id: string
          quotation_id: string
          item_id: string | null
          name: string
          description: string | null
          hsn_code: string | null
          unit: string | null
          quantity: number
          rate: number
          discount_value: number
          discount_is_percent: boolean
          // The sales price list the line is priced from (its discount comes from it).
          price_list_id: string | null
          tax_id: string | null
          tax_name: string | null
          tax_rate: number | null
          amount: number
          sort_order: number
        }
        Insert: Partial<Database["public"]["Tables"]["quotation_items"]["Row"]> & {
          quotation_id: string
          name: string
          quantity: number
          rate: number
        }
        Update: Partial<Database["public"]["Tables"]["quotation_items"]["Row"]>
        Relationships: [
          {
            foreignKeyName: "quotation_items_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "quotations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotation_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotation_items_tax_id_fkey"
            columns: ["tax_id"]
            isOneToOne: false
            referencedRelation: "tax_rates"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_orders: {
        Row: {
          id: string
          so_number: string
          // Null once the quotation is deleted; the order stays.
          quotation_id: string | null
          quote_number: string
          customer_id: string
          customer_name: string
          order_date: string
          reference_number: string | null
          subject: string | null
          salesperson_id: string | null
          place_of_supply: string | null
          status: Database["public"]["Enums"]["sales_order_status"]
          discount_level: Database["public"]["Enums"]["discount_level"]
          discount_value: number
          discount_is_percent: boolean
          is_discount_before_tax: boolean
          adjustment: number
          adjustment_description: string | null
          notes: string | null
          terms: string | null
          sub_total: number
          discount_total: number
          tax_total: number
          total: number
          created_at: string
          updated_at: string
        }
        // Orders are only created by the database, when a quotation is accepted.
        Insert: never
        Update: Partial<Database["public"]["Tables"]["sales_orders"]["Row"]>
        Relationships: [
          {
            foreignKeyName: "sales_orders_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: true
            referencedRelation: "quotations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_order_items: {
        Row: {
          id: string
          sales_order_id: string
          item_id: string | null
          name: string
          description: string | null
          hsn_code: string | null
          unit: string | null
          quantity: number
          rate: number
          discount_value: number
          discount_is_percent: boolean
          tax_id: string | null
          tax_name: string | null
          tax_rate: number | null
          amount: number
          sort_order: number
        }
        Insert: never
        Update: never
        Relationships: [
          {
            foreignKeyName: "sales_order_items_sales_order_id_fkey"
            columns: ["sales_order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_order_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_order_items_tax_id_fkey"
            columns: ["tax_id"]
            isOneToOne: false
            referencedRelation: "tax_rates"
            referencedColumns: ["id"]
          },
        ]
      }
      hsn_codes: {
        Row: {
          id: string
          code: string
          // Null for codes added by an import.
          description: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          code: string
          description?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          code?: string
          description?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      inventory_adjustments: {
        Row: {
          id: string
          mode: Database["public"]["Enums"]["adjustment_mode"]
          reference_number: string | null
          adjustment_date: string
          account: string
          reason: string
          description: string | null
          status: Database["public"]["Enums"]["adjustment_status"]
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          mode?: Database["public"]["Enums"]["adjustment_mode"]
          reference_number?: string | null
          adjustment_date?: string
          account?: string
          reason: string
          description?: string | null
          status?: Database["public"]["Enums"]["adjustment_status"]
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          mode?: Database["public"]["Enums"]["adjustment_mode"]
          reference_number?: string | null
          adjustment_date?: string
          account?: string
          reason?: string
          description?: string | null
          status?: Database["public"]["Enums"]["adjustment_status"]
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_adjustments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_adjustment_items: {
        Row: {
          id: string
          adjustment_id: string
          item_id: string
          quantity_adjusted: number
          sort_order: number
        }
        Insert: {
          id?: string
          adjustment_id: string
          item_id: string
          quantity_adjusted: number
          sort_order?: number
        }
        Update: {
          id?: string
          adjustment_id?: string
          item_id?: string
          quantity_adjusted?: number
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "inventory_adjustment_items_adjustment_id_fkey"
            columns: ["adjustment_id"]
            isOneToOne: false
            referencedRelation: "inventory_adjustments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_adjustment_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      item_images: {
        Row: {
          id: string
          item_id: string
          storage_path: string
          file_name: string
          content_type: string | null
          file_size: number | null
          sort_order: number
          created_at: string
        }
        Insert: {
          id?: string
          item_id: string
          storage_path: string
          file_name: string
          content_type?: string | null
          file_size?: number | null
          sort_order?: number
          created_at?: string
        }
        Update: {
          id?: string
          item_id?: string
          storage_path?: string
          file_name?: string
          content_type?: string | null
          file_size?: number | null
          sort_order?: number
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "item_images_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          // The same key seen through the item_list view (its id is items.id), so a list
          // query can embed each item's images.
          {
            foreignKeyName: "item_images_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "item_list"
            referencedColumns: ["id"]
          },
        ]
      }
      items: {
        Row: {
          id: string
          name: string
          type: Database["public"]["Enums"]["item_type"]
          unit: string | null
          sku: string | null
          hsn_code_id: string | null
          tax_preference: Database["public"]["Enums"]["tax_preference"]
          sales_enabled: boolean
          selling_price: number
          sales_account: string
          sales_description: string | null
          purchase_enabled: boolean
          cost_price: number
          purchase_account: string
          purchase_description: string | null
          preferred_vendor: string | null
          intra_state_tax_id: string | null
          inter_state_tax_id: string | null
          track_inventory: boolean
          inventory_account: string
          inventory_valuation_method: Database["public"]["Enums"]["inventory_valuation_method"]
          // The item's ID in the system it was imported from (Zoho "Item ID").
          external_id: string | null
          is_locked: boolean
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          type?: Database["public"]["Enums"]["item_type"]
          unit?: string | null
          sku?: string | null
          hsn_code_id?: string | null
          tax_preference?: Database["public"]["Enums"]["tax_preference"]
          sales_enabled?: boolean
          selling_price?: number
          sales_account?: string
          sales_description?: string | null
          purchase_enabled?: boolean
          cost_price?: number
          purchase_account?: string
          purchase_description?: string | null
          preferred_vendor?: string | null
          intra_state_tax_id?: string | null
          inter_state_tax_id?: string | null
          track_inventory?: boolean
          inventory_account?: string
          inventory_valuation_method?: Database["public"]["Enums"]["inventory_valuation_method"]
          external_id?: string | null
          is_locked?: boolean
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          type?: Database["public"]["Enums"]["item_type"]
          unit?: string | null
          sku?: string | null
          hsn_code_id?: string | null
          tax_preference?: Database["public"]["Enums"]["tax_preference"]
          sales_enabled?: boolean
          selling_price?: number
          sales_account?: string
          sales_description?: string | null
          purchase_enabled?: boolean
          cost_price?: number
          purchase_account?: string
          purchase_description?: string | null
          preferred_vendor?: string | null
          intra_state_tax_id?: string | null
          inter_state_tax_id?: string | null
          track_inventory?: boolean
          inventory_account?: string
          inventory_valuation_method?: Database["public"]["Enums"]["inventory_valuation_method"]
          external_id?: string | null
          is_locked?: boolean
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "items_hsn_code_id_fkey"
            columns: ["hsn_code_id"]
            isOneToOne: false
            referencedRelation: "hsn_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_intra_state_tax_id_fkey"
            columns: ["intra_state_tax_id"]
            isOneToOne: false
            referencedRelation: "tax_rates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_inter_state_tax_id_fkey"
            columns: ["inter_state_tax_id"]
            isOneToOne: false
            referencedRelation: "tax_rates"
            referencedColumns: ["id"]
          },
        ]
      }
      price_list_items: {
        Row: {
          id: string
          price_list_id: string
          item_id: string
          rate: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          price_list_id: string
          item_id: string
          rate?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          price_list_id?: string
          item_id?: string
          rate?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_list_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_list_items_price_list_id_fkey"
            columns: ["price_list_id"]
            isOneToOne: false
            referencedRelation: "price_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      price_lists: {
        Row: {
          id: string
          name: string
          transaction_type: Database["public"]["Enums"]["transaction_type"]
          price_list_type: Database["public"]["Enums"]["price_list_type"]
          description: string | null
          percentage_type: Database["public"]["Enums"]["percentage_type"] | null
          percentage_value: number | null
          round_off_to: Database["public"]["Enums"]["round_off_type"]
          decimal_places: number | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          transaction_type?: Database["public"]["Enums"]["transaction_type"]
          price_list_type?: Database["public"]["Enums"]["price_list_type"]
          description?: string | null
          percentage_type?: Database["public"]["Enums"]["percentage_type"] | null
          percentage_value?: number | null
          round_off_to?: Database["public"]["Enums"]["round_off_type"]
          decimal_places?: number | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          transaction_type?: Database["public"]["Enums"]["transaction_type"]
          price_list_type?: Database["public"]["Enums"]["price_list_type"]
          description?: string | null
          percentage_type?: Database["public"]["Enums"]["percentage_type"] | null
          percentage_value?: number | null
          round_off_to?: Database["public"]["Enums"]["round_off_type"]
          decimal_places?: number | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          first_name: string
          id: string
          is_active: boolean
          last_name: string | null
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          first_name: string
          id: string
          is_active?: boolean
          last_name?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          first_name?: string
          id?: string
          is_active?: boolean
          last_name?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Relationships: []
      }
      tax_rates: {
        Row: {
          id: string
          name: string
          tax_scope: Database["public"]["Enums"]["tax_scope"]
          cgst_rate: number | null
          sgst_rate: number | null
          igst_rate: number | null
          rate: number | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          tax_scope: Database["public"]["Enums"]["tax_scope"]
          cgst_rate?: number | null
          sgst_rate?: number | null
          igst_rate?: number | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          tax_scope?: Database["public"]["Enums"]["tax_scope"]
          cgst_rate?: number | null
          sgst_rate?: number | null
          igst_rate?: number | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_permissions: {
        Row: {
          can_create: boolean
          can_delete: boolean
          can_edit: boolean
          can_view: boolean
          created_at: string
          id: string
          module: string
          updated_at: string
          user_id: string
        }
        Insert: {
          can_create?: boolean
          can_delete?: boolean
          can_edit?: boolean
          can_view?: boolean
          created_at?: string
          id?: string
          module: string
          updated_at?: string
          user_id: string
        }
        Update: {
          can_create?: boolean
          can_delete?: boolean
          can_edit?: boolean
          can_view?: boolean
          created_at?: string
          id?: string
          module?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_permissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      // Items plus their HSN code, for lists and search (security_invoker view).
      item_list: {
        // stock_on_hand is null for items that don't track inventory.
        Row: Database["public"]["Tables"]["items"]["Row"] & {
          hsn_code: string | null
          stock_on_hand: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      // The number the next new quotation gets (null without quotations create access).
      next_quote_number: {
        Args: Record<PropertyKey, never>
        Returns: string | null
      }
      save_quotation: {
        Args: {
          target_id: string | null
          // quotations columns, totals included (see actions/quotations.ts)
          quotation: Json
          // [{ item_id, name, description, hsn_code, unit, quantity, rate, discount_value,
          //    discount_is_percent, tax_id, amount }]
          items: Json
        }
        Returns: string
      }
      save_customer: {
        Args: {
          target_id: string | null
          // customers columns (see lib/validations/customer.ts → toCustomerRow)
          customer: Json
          // [{ salutation, first_name, last_name, email, work_phone, mobile }]
          contacts: Json
        }
        Returns: string
      }
      save_inventory_adjustment: {
        Args: {
          target_id: string | null
          adjustment_date: string
          reference_number: string
          account: string
          reason: string
          description: string
          status: Database["public"]["Enums"]["adjustment_status"]
          // [{ item_id, quantity_adjusted }]
          items: Json
        }
        Returns: string
      }
      save_price_list: {
        Args: {
          target_id: string | null
          name: string
          transaction_type: Database["public"]["Enums"]["transaction_type"]
          price_list_type: Database["public"]["Enums"]["price_list_type"]
          description: string
          percentage_type: Database["public"]["Enums"]["percentage_type"] | null
          percentage_value: number | null
          round_off_to: Database["public"]["Enums"]["round_off_type"]
          decimal_places: number | null
          is_active: boolean
          item_rates: Json
        }
        Returns: string
      }
      save_user: {
        Args: {
          target_user_id: string
          first_name: string
          last_name: string
          phone: string
          role: Database["public"]["Enums"]["user_role"]
          is_active: boolean
          permissions: Json
        }
        Returns: undefined
      }
    }
    Enums: {
      adjustment_mode: "Quantity Adjustment" | "Value Adjustment"
      adjustment_status: "Draft" | "Adjusted"
      customer_tax_preference: "Taxable" | "Tax Exempt"
      discount_level: "Transaction" | "Line Item"
      quotation_status: "Draft" | "Sent" | "Accepted" | "Declined"
      sales_order_status: "Draft" | "Confirmed" | "Closed"
      direct_tax_kind: "TDS" | "TCS"
      customer_type: "Business" | "Individual"
      gst_treatment:
        | "Registered Business - Regular"
        | "Registered Business - Composition"
        | "Unregistered Business"
        | "Consumer"
        | "Overseas"
        | "Special Economic Zone"
        | "Deemed Export"
        | "Tax Deductor"
        | "SEZ Developer"
      inventory_valuation_method: "FIFO (First In, First Out)" | "WAC (Weighted Average Costing)"
      item_type: "Goods" | "Service"
      percentage_type: "Markup" | "Markdown"
      price_list_type: "All Items" | "Individual Items"
      round_off_type:
        | "Never mind"
        | "Nearest whole number"
        | "0.99"
        | "0.50"
        | "0.49"
        | "Decimal Places"
      tax_scope: "Intra-state" | "Inter-state"
      tax_preference: "Taxable" | "Non-Taxable" | "Out of Scope" | "Non-GST Supply"
      transaction_type: "Sales" | "Purchase"
      user_role: "owner" | "admin" | "manager" | "accountant" | "sales" | "staff"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database["public"]

export type Tables<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Row"]

export type TablesInsert<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Insert"]

export type Enums<T extends keyof PublicSchema["Enums"]> = PublicSchema["Enums"][T]
