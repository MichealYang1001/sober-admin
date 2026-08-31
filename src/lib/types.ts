export type OpsRole = 'admin' | 'normal'

export interface OpsAccount {
  id: number
  email: string
  display_name: string
  role: OpsRole
  status: 'active' | 'disabled'
  created_at?: string
  updated_at?: string
}

export interface AiCustomerOverview {
  conversations_7d: number
  leads_7d: number
  open_gaps: number
  total_conversations: number
  total_leads: number
  lead_rate: number
}

export interface AiConversation {
  id: number
  public_id: string
  visitor_id: string
  status: 'open' | 'lead' | 'handoff' | 'resolved' | 'closed'
  model_id: string
  source_page?: string | null
  summary?: string | null
  recommended_products: string[]
  message_count: number
  started_at: string
  last_message_at: string
}

export interface AiMessage {
  id: number
  role: 'user' | 'assistant'
  content: string
  model_id?: string | null
  safety_category?: string | null
  created_at: string
}

export interface AiLead {
  id: number
  conversation_id?: number | null
  name: string
  contact_type: 'wechat' | 'phone'
  contact_value: string
  question?: string | null
  intended_product?: string | null
  status: 'new' | 'contacted' | 'qualified' | 'converted' | 'closed'
  assignee_account_id?: number | null
  follow_up_note?: string | null
  created_at: string
  updated_at: string
}

export interface AiKnowledgeGap {
  id: number
  conversation_id?: number | null
  message_id?: number | null
  question: string
  reason: string
  status: 'open' | 'resolved' | 'dismissed'
  resolution_note?: string | null
  resolved_at?: string | null
  created_at: string
}

export interface AiKnowledgeEntry {
  id: number
  category: string
  title: string
  content: string
  public_url?: string | null
  keywords: string[]
  is_active: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export interface StudentQuestionAnswer {
  question: string
  answer: string
  attachments?: StudentAttachment[]
}

export interface StudentAttachment {
  object_key: string
  file_name: string
  content_type: string
  size_bytes: number
  url?: string | null
  url_expires_in?: number | null
}

export interface User {
  id: number
  email: string
  username?: string | null
  avatar?: string | null
  wechat_name?: string | null
  wechat_id?: string | null
  note?: string | null
  background_profile?: string | null
  student_qa?: StudentQuestionAnswer[]
  planet_name?: string | null
  planet_expires_at?: string | null
  is_subscribed?: boolean
  user_role: string
  created_at?: string
  updated_at?: string
}

export interface RoleDefinition {
  tag: string
  name: string
}

export interface TicketComment {
  id: number
  ticket_id: number
  author_account_id: number
  author?: OpsAccount | null
  body: string
  created_at: string
}

export interface PermissionTicket {
  id: number
  ticket_no: string
  type: string
  status: string
  requester_account_id: number
  requester?: OpsAccount | null
  reviewer?: OpsAccount | null
  executor?: OpsAccount | null
  target_user_id?: number | null
  target_user?: User | null
  current_email?: string | null
  new_email?: string | null
  wechat_name?: string | null
  wechat_id?: string | null
  tg_username?: string | null
  tg_display_name?: string | null
  role_tag?: string | null
  role_granted?: boolean | null
  role_expires_at?: string | null
  reason_category: string
  reason: string
  evidence_text?: string | null
  review_note?: string | null
  reviewed_at?: string | null
  execution_note?: string | null
  executed_at?: string | null
  before_snapshot?: unknown
  after_snapshot?: unknown
  comments?: TicketComment[]
  created_at: string
  updated_at?: string
}

export interface UserRolePermission {
  id: number
  user_id: number
  email?: string | null
  role_tag: string
  status: string
  effective_status?: string
  expires_at?: string | null
  remaining_days?: number | null
  source_ticket_id?: number | null
  notes?: string | null
  user?: User | null
}

export interface StudentListItem extends User {
  role_permissions: UserRolePermission[]
  telegram_id?: string | number | null
  telegram_username?: string | null
  telegram_first_name?: string | null
}

export interface TelegramBinding {
  telegram_id?: string | number | null
  telegram_username?: string | null
  telegram_first_name?: string | null
}

export interface StudentDetail {
  user: User
  role_permissions: UserRolePermission[]
  telegram_binding?: TelegramBinding | null
}

export interface StudentAuditLog {
  id: number
  actor_account_id?: number | null
  action: string
  target_user_id?: number | null
  target_email?: string | null
  ticket_id?: number | null
  before_json?: unknown
  after_json?: unknown
  reason?: string | null
  created_at: string
  actor?: OpsAccount | null
  ticket?: {
    ticket_no: string
    status: string
    reviewer?: OpsAccount | null
    executor?: OpsAccount | null
    review_note?: string | null
    execution_note?: string | null
    reviewed_at?: string | null
    executed_at?: string | null
  } | null
}

export type ProductType = 'community' | 'course' | 'membership' | 'service'
export type ProductStatus = 'draft' | 'published' | 'archived'
export type ProductLiveStatus = 'upcoming' | 'live' | 'paused' | 'ended' | 'not_applicable'

export interface ProductCategory {
  id: number
  slug: string
  name: string
  description?: string | null
  status: ProductStatus
  sort_order: number
  created_at?: string
  updated_at?: string
}

export interface ProductCurriculumItem {
  id?: number
  lesson_number?: number | null
  title: string
  summary?: string | null
  duration_minutes?: number | null
  video_file_id?: string | null
  pdf_url?: string | null
  course_category?: string | null
  is_preview: boolean
  status: string
  sort_order: number
}

export interface ProductCurriculumSection {
  id?: number
  code: string
  title: string
  description?: string | null
  sort_order: number
  items: ProductCurriculumItem[]
}

export interface ProductEdition {
  id?: number
  code: string
  name: string
  live_status: ProductLiveStatus
  enrollment_status: 'open' | 'waitlist' | 'closed' | 'not_applicable'
  live_start_at?: string | null
  live_end_at?: string | null
  replay_available_at?: string | null
  replay_expires_at?: string | null
  status: string
  sort_order: number
}

export interface ProductOffer {
  id?: number
  edition_id?: number | null
  edition_code?: string | null
  offer_code: string
  offer_type: 'live' | 'replay' | 'subscription' | 'bundle' | 'consultation'
  label: string
  pricing_mode: 'fixed' | 'included' | 'contact'
  price?: string | null
  currency: string
  billing_unit: string
  display_text?: string | null
  sale_status: 'active' | 'inactive' | 'sold_out'
  is_primary: boolean
  sort_order: number
}

export interface ProductPromotion {
  id?: number
  name: string
  description?: string | null
  policy_text?: string | null
  promotion_type: string
  value?: string | null
  starts_at?: string | null
  ends_at?: string | null
  status: 'draft' | 'active' | 'ended' | 'archived'
  sort_order: number
  offer_codes: string[]
}

export interface ProductBundleItem {
  id?: number
  included_product_id?: number
  included_product_slug: string
  included_product_name?: string
  note?: string | null
  sort_order: number
}

export interface Product {
  id: number
  slug: string
  name: string
  product_type: ProductType
  instructor_name?: string | null
  short_description?: string | null
  long_description?: string | null
  cover_image_url?: string | null
  landing_path?: string | null
  cta_label: string
  purchase_instructions?: string | null
  benefits: string[]
  entitlement_role_tag?: string | null
  status: ProductStatus
  is_featured: boolean
  featured_rank: number
  sort_order: number
  category_ids: number[]
  categories: Array<ProductCategory & { display_badge?: string | null; item_sort_order?: number }>
  curriculum_sections: ProductCurriculumSection[]
  editions: ProductEdition[]
  offers: ProductOffer[]
  promotions: ProductPromotion[]
  bundle_items: ProductBundleItem[]
  created_at?: string
  updated_at?: string
}
