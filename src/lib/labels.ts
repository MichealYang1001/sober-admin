export const ticketTypeLabels: Record<string, string> = {
  create_user: '新增用户',
  update_profile: '修改用户资料',
  update_role: '设置用户角色',
  other: '其他',
}

export const reasonCategoryLabels: Record<string, string> = {
  new_permission: '新增权限',
  extension: '延期',
  gift: '赠送',
  correction: '修正误加',
  staff: '工作人员',
  boss_gift: '送老板',
  other: '其他',
}

export const ticketStatusLabels: Record<string, string> = {
  submitted: '待审批',
  needs_info: '待补资料',
  approved: '已通过（待执行）',
  rejected: '已拒绝',
  executed: '已审批并执行',
}

export const auditActionLabels: Record<string, string> = {
  create_student: '新增学员',
  update_student: '更新学员',
  delete_student: '删除学员',
  view_student_detail: '查看学员详情',
  change_email: '改邮箱',
  set_role: '设置用户角色',
  sync_user_role: '同步用户角色',
  expire_role: '角色到期',
}

// 角色 tag 是后端存储值，前台一律通过这里转换为面向学员和运营的中文文案。
export const roleTagLabels: Record<string, string> = {
  regular: '普通用户',
  club: '俱乐部',
  arbitrage: '套利课程',
  entry: '实战入门课',
  beginner: '栗坤小白课',
  tangying: '躺赢君课程',
  advanced: '进阶实战班',
  wenge: '温格老师课程',
}

export const roleTagBadgeClasses: Record<string, string> = {
  regular: 'gray',
  club: 'green',
  arbitrage: 'yellow',
  entry: 'blue',
  beginner: 'purple',
  tangying: 'orange',
  advanced: 'red',
  wenge: 'teal',
}

export function roleTagLabel(tag?: string | null, fallback?: string | null) {
  if (!tag) return '-'
  return roleTagLabels[tag] || fallback || tag
}

export function roleTagBadgeClass(tag?: string | null) {
  return roleTagBadgeClasses[tag || ''] || 'gray'
}

export function labelOf(map: Record<string, string>, value?: string | null) {
  if (!value) return '-'
  return map[value] || value
}

function parseBackendDate(value: string) {
  // 后端历史时间以 UTC 写入但未附带时区；补上 Z 后按浏览器本地时区展示。
  const normalizedValue = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value) ? value : `${value}Z`
  return new Date(normalizedValue)
}

export function formatDate(value?: string | null) {
  if (!value) return '未录入到期时间'
  const date = parseBackendDate(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('zh-CN', { hour12: false })
}

export function formatShortDate(value?: string | null) {
  if (!value) return '-'
  const date = parseBackendDate(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('zh-CN')
}

export function formatRoleExpiry(value?: string | null) {
  return value ? formatDate(value) : '长期有效'
}
