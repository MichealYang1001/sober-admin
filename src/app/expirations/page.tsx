'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw, X } from 'lucide-react'
import { getStoredAccount, opsFetch } from '@/lib/api'
import { formatShortDate, roleTagBadgeClass, roleTagLabel } from '@/lib/labels'
import type { StudentListItem, UserRolePermission } from '@/lib/types'

const DEFAULT_DAYS = 7
const DAY_OPTIONS = [3, 7, 14, 30]
const DAY_MS = 24 * 60 * 60 * 1000

function expiryTime(value?: string | null) {
  if (!value) return Number.NaN
  const normalized = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value) ? value : `${value}Z`
  return new Date(normalized).getTime()
}

export default function ExpirationsPage() {
  const router = useRouter()
  const [students, setStudents] = useState<StudentListItem[]>([])
  const [days, setDays] = useState(String(DEFAULT_DAYS))
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [pendingStudent, setPendingStudent] = useState<StudentListItem | null>(null)
  const [removing, setRemoving] = useState(false)

  const loadStudents = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await opsFetch<{ students: StudentListItem[] }>('/ops/students')
      setStudents(data.students)
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
  }, [loadStudents, router])

  const expiringStudents = useMemo(() => {
    const parsedDays = Number(days)
    const effectiveDays = Number.isFinite(parsedDays) && parsedDays >= 0 ? parsedDays : DEFAULT_DAYS
    const now = Date.now()
    const deadline = now + effectiveDays * DAY_MS

    return students
      .flatMap((student) => student.role_permissions
        .filter((permission) => permission.role_tag === 'club' && permission.status === 'active' && permission.expires_at)
        .map((permission) => ({ student, permission })))
      .filter(({ permission }) => {
        const expiry = expiryTime(permission.expires_at)
        return Number.isFinite(expiry) && expiry >= now && expiry <= deadline
      })
      .sort((a, b) => expiryTime(a.permission.expires_at) - expiryTime(b.permission.expires_at))
  }, [days, students])

  function remainingDays(permission: UserRolePermission) {
    const expiry = expiryTime(permission.expires_at)
    return Math.max(0, Math.ceil((expiry - Date.now()) / DAY_MS))
  }

  async function removeClubPermission() {
    if (!pendingStudent) return
    setRemoving(true)
    setError('')
    try {
      const result = await opsFetch<{ telegram_removal?: { status: string; reason?: string } }>(`/ops/students/${pendingStudent.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          roles: [{ role_tag: 'club', granted: false, expires_at: null }],
          is_subscribed: false,
          remove_from_telegram: true,
        }),
      })
      setSuccess(result.telegram_removal?.status === 'skipped'
        ? `已移除 ${pendingStudent.email} 的俱乐部权限；该学员没有已绑定的 Telegram 账号。`
        : `已移除 ${pendingStudent.email} 的俱乐部权限，并已从 TG VIP 群移除。`)
      setPendingStudent(null)
      await loadStudents()
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : '移除俱乐部权限失败')
    } finally {
      setRemoving(false)
    }
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1>到期管理</h1>
          <p>未来 {Number(days) || DEFAULT_DAYS} 天内共有 {expiringStudents.length} 位俱乐部学员即将到期</p>
        </div>
      </div>

      <div className="toolbar filter-bar">
        <div className="expiry-days-control">
          <span>离到期</span>
          <input
            className="input"
            type="number"
            min="0"
            inputMode="numeric"
            value={days}
            onChange={(event) => setDays(event.target.value)}
            aria-label="离到期天数"
          />
          <span>天内</span>
        </div>
        <div className="quick-day-options" aria-label="快捷天数">
          {DAY_OPTIONS.map((option) => (
            <button key={option} type="button" className={days === String(option) ? 'tab active' : 'tab'} onClick={() => setDays(String(option))}>{option} 天</button>
          ))}
        </div>
        <button className="secondary-button" type="button" onClick={loadStudents} disabled={loading}>
          <RefreshCw size={17} />刷新
        </button>
      </div>

      {error && <div className="error-state">{error}</div>}
      {success && <div className="success-state">{success}</div>}
      <div className="panel table-wrap">
        <table>
          <thead>
            <tr>
              <th>学员</th>
              <th>微信名</th>
              <th>TG</th>
              <th>角色</th>
              <th>到期时间</th>
              <th>剩余天数</th>
              <th>备注</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {expiringStudents.map(({ student, permission }) => (
              <tr key={`${student.id}-${permission.id}`}>
                <td><strong>{student.email}</strong>{student.username && <div className="muted">{student.username}</div>}</td>
                <td>{student.wechat_name || '-'}</td>
                <td>{student.telegram_username ? `@${student.telegram_username.replace(/^@/, '')}` : student.telegram_first_name || '-'}</td>
                <td><span className={`badge ${roleTagBadgeClass('club')}`}>{roleTagLabel('club')}</span></td>
                <td>{formatShortDate(permission.expires_at)}</td>
                <td><span className="badge yellow">{remainingDays(permission)} 天</span></td>
                <td className="student-note-cell">{student.note || '-'}</td>
                <td><button className="secondary-button" type="button" onClick={() => setPendingStudent(student)}>处理到期</button></td>
              </tr>
            ))}
            {!loading && expiringStudents.length === 0 && <tr><td colSpan={8} className="muted">未来 {Number(days) || DEFAULT_DAYS} 天内没有即将到期的俱乐部学员</td></tr>}
          </tbody>
        </table>
      </div>

      {pendingStudent && (
        <div className="modal-backdrop" role="presentation">
          <div className="modal-panel expiry-confirm-modal" role="dialog" aria-modal="true" aria-labelledby="expiry-confirm-title">
            <div className="modal-header">
              <div>
                <h2 id="expiry-confirm-title">确认处理到期</h2>
                <p className="muted">俱乐部权限到期处理</p>
              </div>
              <button className="icon-button" type="button" onClick={() => setPendingStudent(null)} disabled={removing} aria-label="关闭"><X size={18} /></button>
            </div>
            <p>确认后，将移除 <strong>{pendingStudent.email}</strong> 的俱乐部权限，并从用户角色中移除“俱乐部”。</p>
            <p className="expiry-tg-notice">若该学员已绑定 Telegram，系统将自动从 TG VIP 群移除，但不会封禁；之后可通过有效邀请链接重新加入。</p>
            <div className="form-actions">
              <button className="secondary-button" type="button" onClick={() => setPendingStudent(null)} disabled={removing}>取消</button>
              <button className="danger-button" type="button" onClick={removeClubPermission} disabled={removing}>{removing ? '正在移除...' : '确认移除俱乐部权限'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
