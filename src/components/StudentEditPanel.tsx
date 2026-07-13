'use client'

import { useState } from 'react'
import { Save, X } from 'lucide-react'
import { opsFetch } from '@/lib/api'
import { roleTagLabel } from '@/lib/labels'
import type { RoleDefinition, StudentDetail } from '@/lib/types'

interface StudentEditPanelProps {
  student: StudentDetail
  roles: RoleDefinition[]
  onCancel: () => void
  onSaved: (student: StudentDetail) => void
}

function toLocalInput(value?: string | null) {
  return value ? value.slice(0, 16) : ''
}

export function StudentEditPanel({ student, roles, onCancel, onSaved }: StudentEditPanelProps) {
  const { user, telegram_binding: telegram, role_permissions: permissions } = student
  const currentRoles = new Set(user.user_role.split('_').filter((tag) => tag && tag !== 'regular'))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    email: user.email,
    username: user.username || '',
    avatar: user.avatar || '',
    wechat_name: user.wechat_name || '',
    is_subscribed: Boolean(user.is_subscribed),
    note: user.note || '',
    planet_name: user.planet_name || '',
    planet_expires_at: toLocalInput(user.planet_expires_at),
    telegram_id: telegram?.telegram_id == null ? '' : String(telegram.telegram_id),
    telegram_username: telegram?.telegram_username || '',
    telegram_first_name: telegram?.telegram_first_name || '',
  })
  const [roleValues, setRoleValues] = useState(() => Object.fromEntries(roles.map((role) => {
    const permission = permissions.find((item) => item.role_tag === role.tag)
    return [role.tag, { granted: currentRoles.has(role.tag), expires_at: toLocalInput(permission?.expires_at) }]
  })))

  function update(name: string, value: string) {
    setForm((current) => ({ ...current, [name]: value }))
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const data = await opsFetch<{ student: StudentDetail }>(`/ops/students/${user.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          email: form.email,
          username: form.username,
          avatar: form.avatar,
          wechat_name: form.wechat_name,
          is_subscribed: form.is_subscribed,
          note: form.note,
          planet_name: form.planet_name,
          planet_expires_at: form.planet_expires_at ? new Date(form.planet_expires_at).toISOString() : null,
          telegram_id: form.telegram_id ? Number(form.telegram_id) : null,
          telegram_username: form.telegram_username,
          telegram_first_name: form.telegram_first_name,
          roles: roles.map((role) => ({
            role_tag: role.tag,
            granted: roleValues[role.tag]?.granted || false,
            expires_at: roleValues[role.tag]?.granted && roleValues[role.tag]?.expires_at
              ? new Date(roleValues[role.tag].expires_at).toISOString()
              : null,
          })),
        }),
      })
      onSaved(data.student)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : '用户资料保存失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="panel student-edit-panel" onSubmit={submit}>
      <div className="section-heading">
        <div>
          <h2>修改用户资料</h2>
          <p className="muted">角色和到期时间将同时更新线上实际权限。</p>
        </div>
      </div>
      {error && <div className="error-state">{error}</div>}
      <div className="form-grid">
        <div className="field"><label>邮箱</label><input className="input" type="email" value={form.email} onChange={(event) => update('email', event.target.value)} required /></div>
        <div className="field"><label>用户名</label><input className="input" value={form.username} onChange={(event) => update('username', event.target.value)} /></div>
        <div className="field"><label>头像地址</label><input className="input" value={form.avatar} onChange={(event) => update('avatar', event.target.value)} /></div>
        <div className="field"><label>微信名</label><input className="input" value={form.wechat_name} onChange={(event) => update('wechat_name', event.target.value)} /></div>
        <div className="field">
          <label>邮件订阅</label>
          <label className="binary-control"><input type="checkbox" checked={form.is_subscribed} onChange={(event) => setForm((current) => ({ ...current, is_subscribed: event.target.checked }))} /><span>订阅俱乐部邮件</span></label>
        </div>
        <div className="field"><label>星球名</label><input className="input" value={form.planet_name} onChange={(event) => update('planet_name', event.target.value)} /></div>
        <div className="field"><label>星球到期时间</label><input className="input" type="datetime-local" value={form.planet_expires_at} onChange={(event) => update('planet_expires_at', event.target.value)} /></div>
        <div className="field"><label>TG ID</label><input className="input" inputMode="numeric" value={form.telegram_id} onChange={(event) => update('telegram_id', event.target.value.replace(/\D/g, ''))} /></div>
        <div className="field"><label>TG 用户名</label><input className="input" value={form.telegram_username} onChange={(event) => update('telegram_username', event.target.value)} /></div>
        <div className="field"><label>TG 显示名</label><input className="input" value={form.telegram_first_name} onChange={(event) => update('telegram_first_name', event.target.value)} /></div>
        <div className="field full"><label>备注</label><textarea className="textarea" rows={4} value={form.note} onChange={(event) => update('note', event.target.value)} /></div>
      </div>

      <div className="role-editor">
        <h3>角色与到期时间</h3>
        <div className="role-editor-grid">
          {roles.map((role) => {
            const value = roleValues[role.tag] || { granted: false, expires_at: '' }
            return (
              <div className="role-editor-row" key={role.tag}>
                <label className="role-toggle">
                  <input
                    type="checkbox"
                    checked={value.granted}
                    onChange={(event) => setRoleValues((current) => ({ ...current, [role.tag]: { ...value, granted: event.target.checked } }))}
                  />
                  <span><strong>{roleTagLabel(role.tag, role.name)}</strong></span>
                </label>
                <input
                  className="input"
                  type="datetime-local"
                  value={value.expires_at}
                  disabled={!value.granted}
                  onChange={(event) => setRoleValues((current) => ({ ...current, [role.tag]: { ...value, expires_at: event.target.value } }))}
                  aria-label={`${roleTagLabel(role.tag, role.name)}到期时间`}
                />
              </div>
            )
          })}
        </div>
      </div>

      <div className="form-actions">
        <button className="secondary-button" type="button" onClick={onCancel} disabled={saving}><X size={17} />取消</button>
        <button className="button" disabled={saving}><Save size={17} />{saving ? '保存中...' : '保存全部修改'}</button>
      </div>
    </form>
  )
}
