'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import * as XLSX from 'xlsx'
import { Columns3, Download, RefreshCw, RotateCcw, Zap } from 'lucide-react'
import { getStoredAccount, opsFetch } from '@/lib/api'
import { formatDate, formatRoleExpiry, formatShortDate, roleTagBadgeClass, roleTagLabel } from '@/lib/labels'
import { QuickStudentActionDialog } from '@/components/QuickStudentActionDialog'
import { SelectControl } from '@/components/SelectControl'
import type { PermissionTicket, RoleDefinition, StudentListItem } from '@/lib/types'

const DEFAULT_PAGE_SIZE = 30
const COLUMN_STORAGE_KEY = 'sober_admin_student_columns_v1'
const OPTIONAL_COLUMNS = [
  { key: 'wechat', label: '微信名' },
  { key: 'telegram', label: 'TG' },
  { key: 'planet', label: '星球名' },
  { key: 'planet_expiry', label: '星球到期' },
  { key: 'note', label: '备注' },
  { key: 'roles', label: '当前角色' },
  { key: 'role_expiry', label: '角色到期时间' },
  { key: 'updated_at', label: '更新时间' },
] as const
type OptionalColumnKey = typeof OPTIONAL_COLUMNS[number]['key']
const DEFAULT_COLUMNS = OPTIONAL_COLUMNS.map((column) => column.key)

const EXPORT_HEADERS = ['邮箱', '用户名', '微信名', 'TG 昵称', 'TG 用户名', 'TG ID', '星球名', '星球到期', '备注', '当前角色', '角色到期时间', '更新时间']

function safeExportValue(value?: string | null) {
  const text = value || ''
  return /^[=+\-@]/.test(text) ? `'${text}` : text
}

function currentRoleTags(userRole: string) {
  const tags = userRole.split('_').map((tag) => tag.trim()).filter(Boolean)
  return tags.filter((tag) => tag !== 'regular')
}

export default function StudentsPage() {
  const router = useRouter()
  const [q, setQ] = useState('')
  const [appliedQ, setAppliedQ] = useState('')
  const [role, setRole] = useState('club')
  const [roles, setRoles] = useState<RoleDefinition[]>([])
  const [allStudents, setAllStudents] = useState<StudentListItem[]>([])
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(String(DEFAULT_PAGE_SIZE))
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [quickCreateOpen, setQuickCreateOpen] = useState(false)
  const [success, setSuccess] = useState('')
  const [columnMenuOpen, setColumnMenuOpen] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [visibleColumns, setVisibleColumns] = useState<OptionalColumnKey[]>(() => {
    if (typeof window === 'undefined') return DEFAULT_COLUMNS
    try {
      const stored = localStorage.getItem(COLUMN_STORAGE_KEY)
      if (stored === null) return DEFAULT_COLUMNS
      const saved = JSON.parse(stored)
      if (!Array.isArray(saved)) return DEFAULT_COLUMNS
      const valid = saved.filter((key): key is OptionalColumnKey => DEFAULT_COLUMNS.includes(key))
      return valid
    } catch {
      return DEFAULT_COLUMNS
    }
  })

  function setColumns(columns: OptionalColumnKey[]) {
    setVisibleColumns(columns)
    localStorage.setItem(COLUMN_STORAGE_KEY, JSON.stringify(columns))
  }

  function toggleColumn(key: OptionalColumnKey) {
    setColumns(visibleColumns.includes(key)
      ? visibleColumns.filter((column) => column !== key)
      : [...visibleColumns, key])
  }

  function columnVisible(key: OptionalColumnKey) {
    return visibleColumns.includes(key)
  }

  const loadStudents = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await opsFetch<{ students: StudentListItem[] }>('/ops/students')
      setAllStudents(data.students)
      setPage(1)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (getStoredAccount()?.role !== 'admin') {
      router.replace('/')
      return
    }

    loadStudents()
    opsFetch<{ roles: RoleDefinition[] }>('/ops/roles')
      .then((data) => setRoles(data.roles))
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : '角色列表加载失败'))
  }, [loadStudents, router])

  const filteredStudents = useMemo(() => {
    const needle = appliedQ.trim().toLowerCase()
    const roleNames = new Map(roles.map((item) => [item.tag, item.name.toLowerCase()]))

    return allStudents.filter((student) => {
      const activeRoles = currentRoleTags(student.user_role)
      const matchesRole = !role
        || (role === 'regular' ? activeRoles.length === 0 : activeRoles.includes(role))
      if (!matchesRole) return false
      if (!needle) return true

      const searchableValues = [
        student.email,
        student.username,
        student.wechat_name,
        student.note,
        student.planet_name,
        student.telegram_username,
        student.telegram_first_name,
        student.telegram_id,
        student.user_role,
        ...student.role_permissions.flatMap((permission) => [permission.role_tag, roleNames.get(permission.role_tag)]),
      ]
      return searchableValues.some((value) => value != null && String(value).toLowerCase().includes(needle))
    })
  }, [allStudents, appliedQ, role, roles])

  const total = filteredStudents.length
  const effectivePageSize = pageSize === 'all' ? Math.max(total, 1) : Number(pageSize)
  const totalPages = pageSize === 'all' ? 1 : Math.max(1, Math.ceil(total / effectivePageSize))
  const students = pageSize === 'all'
    ? filteredStudents
    : filteredStudents.slice((page - 1) * effectivePageSize, page * effectivePageSize)

  function exportStudents() {
    setExporting(true)
    try {
      const rows = filteredStudents.map((student) => {
        const roles = currentRoleTags(student.user_role)
        const roleExpiry = roles.map((roleTag) => {
          const permission = student.role_permissions.find((item) => item.role_tag === roleTag && item.status === 'active')
          return `${roleTagLabel(roleTag)}：${formatRoleExpiry(permission?.expires_at)}`
        }).join('\n')

        return [
          safeExportValue(student.email),
          safeExportValue(student.username),
          safeExportValue(student.wechat_name),
          safeExportValue(student.telegram_first_name),
          safeExportValue(student.telegram_username ? `@${student.telegram_username.replace(/^@/, '')}` : ''),
          safeExportValue(student.telegram_id == null ? '' : String(student.telegram_id)),
          safeExportValue(student.planet_name),
          formatShortDate(student.planet_expires_at),
          safeExportValue(student.note),
          roles.length > 0 ? roles.map((roleTag) => roleTagLabel(roleTag)).join('、') : roleTagLabel('regular'),
          roleExpiry || '-',
          formatDate(student.updated_at),
        ]
      })
      const sheet = XLSX.utils.aoa_to_sheet([EXPORT_HEADERS, ...rows])
      sheet['!cols'] = [
        { wch: 32 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 22 }, { wch: 16 },
        { wch: 20 }, { wch: 14 }, { wch: 30 }, { wch: 30 }, { wch: 44 }, { wch: 20 },
      ]
      sheet['!autofilter'] = { ref: `A1:L${Math.max(rows.length + 1, 1)}` }

      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, sheet, '学员数据')
      const date = new Date().toISOString().slice(0, 10)
      XLSX.writeFile(workbook, `学员数据_${date}.xlsx`, { compression: true })
    } finally {
      setExporting(false)
    }
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1>学员管理</h1>
          <p>共 {total} 位学员</p>
        </div>
        <div className="toolbar">
          <button className="button" type="button" onClick={() => setQuickCreateOpen(true)}>
            <Zap size={18} />
            快速新增
          </button>
        </div>
      </div>

      <form
        className="toolbar filter-bar"
        onSubmit={(event) => {
          event.preventDefault()
          setAppliedQ(q)
          setPage(1)
        }}
      >
        <input
          className="input search-input search-input-wide"
          placeholder="搜索邮箱、微信名、TG、星球名、备注或角色"
          value={q}
          onChange={(event) => setQ(event.target.value)}
        />
        <button className="secondary-button" disabled={loading}>
          <RefreshCw size={17} />
          查询
        </button>
        <button className="secondary-button" type="button" onClick={exportStudents} disabled={loading || exporting}>
          <Download size={17} />
          {exporting ? '正在导出' : '下载 Excel'}
        </button>
        <div className="column-settings">
          <button className="secondary-button" type="button" onClick={() => setColumnMenuOpen((open) => !open)} aria-expanded={columnMenuOpen}>
            <Columns3 size={17} />
            列设置
          </button>
          {columnMenuOpen && (
            <div className="column-settings-menu">
              <div className="column-settings-title"><strong>显示列</strong><span>学员和操作固定显示</span></div>
              {OPTIONAL_COLUMNS.map((column) => (
                <label className="column-option" key={column.key}>
                  <input type="checkbox" checked={columnVisible(column.key)} onChange={() => toggleColumn(column.key)} />
                  <span>{column.label}</span>
                </label>
              ))}
              <div className="column-settings-actions">
                <button className="text-button" type="button" onClick={() => setColumns(DEFAULT_COLUMNS)}><RotateCcw size={15} />恢复默认</button>
                <button className="button compact-button" type="button" onClick={() => setColumnMenuOpen(false)}>完成</button>
              </div>
            </div>
          )}
        </div>
      </form>

      {success && <div className="success-state">{success}</div>}
      {error && <div className="error-state">{error}</div>}
      <div className="student-list">
        <div className="tabs student-role-tabs" role="tablist" aria-label="角色筛选">
          {[
            { value: '', label: '全部角色' },
            { value: 'regular', label: '普通用户' },
            ...roles.map((item) => ({ value: item.tag, label: item.name })),
          ].map((item) => (
            <button
              key={item.value}
              type="button"
              role="tab"
              aria-selected={role === item.value}
              className={role === item.value ? 'tab active' : 'tab'}
              onClick={() => {
                setRole(item.value)
                setPage(1)
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="panel table-wrap student-list-table">
          <table>
          <thead>
            <tr>
              <th className="student-name-column">学员</th>
              {columnVisible('wechat') && <th>微信名</th>}
              {columnVisible('telegram') && <th>TG</th>}
              {columnVisible('planet') && <th>星球名</th>}
              {columnVisible('planet_expiry') && <th>星球到期</th>}
              {columnVisible('note') && <th>备注</th>}
              {columnVisible('roles') && <th className="student-roles-column">当前角色</th>}
              {columnVisible('role_expiry') && <th className="student-role-expiry-column">角色到期时间</th>}
              {columnVisible('updated_at') && <th>更新时间</th>}
              <th className="student-actions-column">操作</th>
            </tr>
          </thead>
          <tbody>
            {students.map((student) => {
              const currentRoles = currentRoleTags(student.user_role)
              return (
                <tr key={student.id}>
                  <td className="student-name-column">
                    <strong>{student.email}</strong>
                    {student.username && <div className="muted">{student.username}</div>}
                  </td>
                  {columnVisible('wechat') && <td>{student.wechat_name || '-'}</td>}
                  {columnVisible('telegram') && <td>
                    <strong>{student.telegram_first_name || '-'}</strong>
                    {student.telegram_username && <div className="muted">@{student.telegram_username.replace(/^@/, '')}</div>}
                  </td>}
                  {columnVisible('planet') && <td>{student.planet_name || '-'}</td>}
                  {columnVisible('planet_expiry') && <td>{formatShortDate(student.planet_expires_at)}</td>}
                  {columnVisible('note') && <td className="student-note-cell">{student.note || '-'}</td>}
                  {columnVisible('roles') && <td className="student-roles-column">
                    {currentRoles.length > 0
                      ? <div className="student-role-badges">
                        {currentRoles.map((roleTag) => (
                          <span key={roleTag} className={`badge ${roleTagBadgeClass(roleTag)}`}>{roleTagLabel(roleTag)}</span>
                        ))}
                      </div>
                      : <span className="badge gray">{roleTagLabel('regular')}</span>}
                  </td>}
                  {columnVisible('role_expiry') && <td className="student-role-expiry-column">
                    {currentRoles.length > 0
                      ? <div className="student-role-expiries">
                        {currentRoles.map((roleTag) => {
                          const permission = student.role_permissions.find((item) => item.role_tag === roleTag && item.status === 'active')
                          const fullExpiry = formatRoleExpiry(permission?.expires_at)
                          return (
                            <div className="student-role-expiry" key={roleTag} title={`${roleTagLabel(roleTag)}：${fullExpiry}`}>
                              <span className={`badge ${roleTagBadgeClass(roleTag)}`}>{roleTagLabel(roleTag)}</span>
                              <span>{permission?.expires_at ? formatShortDate(permission.expires_at) : '长期'}</span>
                            </div>
                          )
                        })}
                      </div>
                      : '-'}
                  </td>}
                  {columnVisible('updated_at') && <td>{formatShortDate(student.updated_at)}</td>}
                  <td className="student-actions-column">
                    <div className="row-actions student-row-actions">
                      <Link className="secondary-button student-view-button" href={`/students/${student.id}`}>查看详情</Link>
                      <Link className="button student-edit-button" href={`/students/${student.id}?edit=1`}>修改资料</Link>
                    </div>
                  </td>
                </tr>
              )
            })}
            {!loading && students.length === 0 && <tr><td colSpan={visibleColumns.length + 2} className="muted">暂无匹配学员</td></tr>}
          </tbody>
          </table>
        </div>
      </div>

      <div className="pagination-bar">
        <div className="pagination-summary">共 <strong>{total}</strong> 条</div>
        <div className="pagination-controls">
          <span className="muted">每页</span>
          <SelectControl
            containerClassName="page-size-select"
            ariaLabel="每页显示条数"
            value={pageSize}
            options={[
              { value: '10', label: '10 条' },
              { value: '20', label: '20 条' },
              { value: '30', label: '30 条' },
              { value: '50', label: '50 条' },
              { value: '100', label: '100 条' },
              { value: 'all', label: '全部' },
            ]}
            onValueChange={(value) => {
              setPageSize(value)
              setPage(1)
            }}
          />
          <span className="pagination-divider" aria-hidden="true" />
          <button type="button" className="secondary-button" onClick={() => setPage((current) => current - 1)} disabled={loading || page <= 1}>上一页</button>
          <span className="pagination-page">第 {page} / {totalPages} 页</span>
          <button type="button" className="secondary-button" onClick={() => setPage((current) => current + 1)} disabled={loading || page >= totalPages}>下一页</button>
        </div>
      </div>

      {quickCreateOpen && (
        <QuickStudentActionDialog
          mode="create_user"
          onClose={() => setQuickCreateOpen(false)}
          onDone={(ticket: PermissionTicket) => {
            setQuickCreateOpen(false)
            setSuccess(`已快速新增用户，并生成执行工单 ${ticket.ticket_no}`)
            loadStudents()
          }}
        />
      )}
    </>
  )
}
