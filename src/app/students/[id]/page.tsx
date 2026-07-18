'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, FilePlus2, Pencil, ShieldPlus, Zap } from 'lucide-react'
import { getStoredAccount, opsFetch } from '@/lib/api'
import { formatDate, formatRoleExpiry, roleTagBadgeClass, roleTagLabel } from '@/lib/labels'
import { QuickStudentActionDialog } from '@/components/QuickStudentActionDialog'
import { StudentEditPanel } from '@/components/StudentEditPanel'
import type { PermissionTicket, RoleDefinition, StudentDetail } from '@/lib/types'

const statusLabels: Record<string, string> = {
  active: '有效',
  expired: '已到期',
  revoked: '已移除',
}

export default function StudentDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [student, setStudent] = useState<StudentDetail | null>(null)
  const [roles, setRoles] = useState<RoleDefinition[]>([])
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [editing, setEditing] = useState(searchParams.get('edit') === '1')
  const [quickMode, setQuickMode] = useState<'update_profile' | 'update_role' | null>(null)

  const loadStudent = useCallback(() => {
    setError('')
    return opsFetch<{ student: StudentDetail }>(`/ops/students/${params.id}`)
      .then((data) => {
        setStudent(data.student)
      })
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : '加载失败'))
  }, [params.id])

  useEffect(() => {
    if (getStoredAccount()?.role !== 'admin') {
      router.replace('/')
      return
    }

    loadStudent()
    opsFetch<{ roles: RoleDefinition[] }>('/ops/roles')
      .then((data) => setRoles(data.roles))
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : '角色列表加载失败'))
  }, [loadStudent, router])

  if (error) return <div className="error-state">{error}</div>
  if (!student) return <div className="empty-state">加载中...</div>

  const { user, role_permissions: rolePermissions, telegram_binding: telegramBinding } = student
  const encodedEmail = encodeURIComponent(user.email)

  return (
    <>
      <div className="page-header">
        <div>
          <Link className="auth-back" href="/students">
            <ArrowLeft size={16} />
            返回学员列表
          </Link>
          <h1>{user.email}</h1>
          <p>{user.wechat_name || user.username || '未填写学员名称'}</p>
        </div>
        <div className="toolbar">
          <button className="secondary-button" type="button" onClick={() => setEditing(true)}>
            <Pencil size={17} />
            修改
          </button>
          <button className="secondary-button" type="button" onClick={() => setQuickMode('update_profile')}>
            <Zap size={17} />
            快速修正资料
          </button>
          <button className="button" type="button" onClick={() => setQuickMode('update_role')}>
            <ShieldPlus size={17} />
            快速设置角色
          </button>
          <Link className="secondary-button" href={`/tickets/new?type=update_profile&email=${encodedEmail}`}>
            <Pencil size={17} />
            资料工单
          </Link>
          <Link className="secondary-button" href={`/tickets/new?type=update_role&email=${encodedEmail}`}>
            <FilePlus2 size={17} />
            角色工单
          </Link>
        </div>
      </div>

      {success && <div className="success-state">{success}</div>}
      <div className="panel detail-grid">
        <div className="detail-item"><span>邮箱</span><strong>{user.email}</strong></div>
        <div className="detail-item"><span>微信名</span><strong>{user.wechat_name || '-'}</strong></div>
        <div className="detail-item"><span>微信 ID</span><strong>{user.wechat_id || '-'}</strong></div>
        <div className="detail-item"><span>用户名</span><strong>{user.username || '-'}</strong></div>
        <div className="detail-item"><span>头像地址</span><strong className="detail-long-value">{user.avatar || '-'}</strong></div>
        <div className="detail-item"><span>邮件订阅</span><strong>{user.is_subscribed ? '已订阅' : '未订阅'}</strong></div>
        <div className="detail-item"><span>当前角色</span><strong>{user.user_role.split('_').filter((tag) => tag && tag !== 'regular').map((tag) => roleTagLabel(tag)).join('、') || roleTagLabel('regular')}</strong></div>
        <div className="detail-item"><span>TG username</span><strong>{telegramBinding?.telegram_username || '-'}</strong></div>
        <div className="detail-item"><span>TG 显示名</span><strong>{telegramBinding?.telegram_first_name || '-'}</strong></div>
        <div className="detail-item"><span>TG ID</span><strong className="mono">{telegramBinding?.telegram_id || '-'}</strong></div>
        <div className="detail-item"><span>星球名</span><strong>{user.planet_name || '-'}</strong></div>
        <div className="detail-item"><span>星球到期时间</span><strong>{formatDate(user.planet_expires_at)}</strong></div>
        <div className="detail-item"><span>注册时间</span><strong>{formatDate(user.created_at)}</strong></div>
        <div className="detail-item"><span>更新时间</span><strong>{formatDate(user.updated_at)}</strong></div>
      </div>

      {editing && roles.length > 0 && (
        <div className="section">
          <StudentEditPanel
            key={`${user.id}-${user.updated_at || ''}`}
            student={student}
            roles={roles}
            onCancel={() => setEditing(false)}
            onSaved={(updatedStudent) => {
              setStudent(updatedStudent)
              setEditing(false)
              setSuccess('用户全部资料已更新')
              router.replace(`/students/${user.id}`)
            }}
          />
        </div>
      )}

      <div className="section">
        <h2>用户备注</h2>
        <div className="panel student-note-panel"><p className={user.note ? 'student-note-content' : 'muted'}>{user.note || '暂无备注'}</p></div>
      </div>

      <div className="section">
        <h2>用户角色</h2>
        <div className="panel table-wrap">
          <table>
            <thead>
              <tr>
                <th>角色</th>
                <th>状态</th>
                <th>到期时间</th>
                <th>剩余天数</th>
                <th>来源工单</th>
                <th>备注</th>
              </tr>
            </thead>
            <tbody>
              {rolePermissions.map((permission) => (
                <tr key={permission.id}>
                  <td><span className={`badge ${roleTagBadgeClass(permission.role_tag)}`}>{roleTagLabel(permission.role_tag)}</span></td>
                  <td>{statusLabels[permission.effective_status || permission.status] || permission.effective_status || permission.status}</td>
                  <td>{formatRoleExpiry(permission.expires_at)}</td>
                  <td>{permission.remaining_days == null ? '长期' : permission.remaining_days}</td>
                  <td>{permission.source_ticket_id ? `#${permission.source_ticket_id}` : '历史数据'}</td>
                  <td>{permission.notes || '-'}</td>
                </tr>
              ))}
              {rolePermissions.length === 0 && <tr><td colSpan={6} className="muted">该学员当前没有角色权限</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {quickMode && (
        <QuickStudentActionDialog
          mode={quickMode}
          user={user}
          onClose={() => setQuickMode(null)}
          onDone={(ticket: PermissionTicket) => {
            setQuickMode(null)
            setSuccess(`已完成快速修正，并生成执行工单 ${ticket.ticket_no}`)
            loadStudent()
          }}
        />
      )}
    </>
  )
}
