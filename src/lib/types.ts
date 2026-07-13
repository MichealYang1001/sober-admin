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

export interface User {
  id: number
  email: string
  username?: string | null
  avatar?: string | null
  wechat_name?: string | null
  note?: string | null
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
