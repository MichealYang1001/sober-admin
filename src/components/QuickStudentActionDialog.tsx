'use client'

import { useEffect, useState } from 'react'
import { Save, X } from 'lucide-react'
import { opsFetch } from '@/lib/api'
import { roleTagLabel } from '@/lib/labels'
import { reasonCategoryLabels } from '@/lib/labels'
import { SelectControl } from '@/components/SelectControl'
import type { PermissionTicket, RoleDefinition, User } from '@/lib/types'

type QuickActionType = 'create_user' | 'update_profile' | 'update_role'

interface QuickStudentActionDialogProps {
  mode: QuickActionType
  user?: User | null
  onClose: () => void
  onDone: (ticket: PermissionTicket) => void
}

const modeTitles: Record<QuickActionType, string> = {
  create_user: '快速新增用户',
  update_profile: '快速修正资料',
  update_role: '快速设置角色',
}

export function QuickStudentActionDialog({ mode, user, onClose, onDone }: QuickStudentActionDialogProps) {
  const [roles, setRoles] = useState<RoleDefinition[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    current_email: user?.email || '',
    new_email: '',
    wechat_name: user?.wechat_name || '',
    tg_username: '',
    tg_display_name: user?.username || '',
    role_tag: 'club',
    role_granted: 'true',
    role_expires_at: '',
    reason_category: mode === 'update_profile' ? 'other' : 'correction',
    reason: '',
    evidence_text: '',
    note: '',
  })
  const needsRole = mode === 'create_user' || mode === 'update_role'

  useEffect(() => {
    opsFetch<{ roles: RoleDefinition[] }>('/ops/roles')
      .then((data) => setRoles(data.roles))
      .catch(() => undefined)
  }, [])

  function update(name: string, value: string) {
    setForm((current) => ({ ...current, [name]: value }))
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      if (needsRole && roles.length === 0) {
        setError('角色列表还没有加载完成')
        return
      }
      const grantsRole = mode === 'create_user' || (mode === 'update_role' && form.role_granted === 'true')
      const payload = {
        type: mode,
        target_user_id: user?.id || null,
        current_email: form.current_email,
        new_email: mode === 'update_profile' && form.new_email ? form.new_email : null,
        wechat_name: mode !== 'update_role' ? form.wechat_name || null : null,
        tg_username: mode === 'create_user' ? form.tg_username || null : null,
        tg_display_name: mode === 'create_user' ? form.tg_display_name || null : null,
        role_tag: mode === 'create_user' || mode === 'update_role' ? form.role_tag : null,
        role_granted: mode === 'create_user' ? true : mode === 'update_role' ? form.role_granted === 'true' : null,
        role_expires_at: grantsRole && form.role_expires_at ? new Date(form.role_expires_at).toISOString() : null,
        reason_category: mode === 'update_profile' ? 'other' : form.reason_category,
        reason: form.reason,
        evidence_text: form.evidence_text || null,
        note: form.note,
      }
      const data = await opsFetch<{ ticket: PermissionTicket }>('/ops/students/quick-action', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      onDone(data.ticket)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : '快速操作失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <div className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="quick-action-title">
        <div className="modal-header">
          <div>
            <h2 id="quick-action-title">{modeTitles[mode]}</h2>
            <p>系统会自动生成已执行工单并写入学员审计。</p>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="关闭">
            <X size={18} />
          </button>
        </div>

        {error && <div className="error-state">{error}</div>}
        <form onSubmit={submit}>
          <div className="form-grid">
            <div className="field">
              <label>{mode === 'create_user' ? '用户邮箱' : '当前邮箱'}</label>
              <input className="input" type="email" value={form.current_email} onChange={(event) => update('current_email', event.target.value)} required />
            </div>

            {mode === 'update_profile' && (
              <div className="field">
                <label>新邮箱</label>
                <input className="input" type="email" value={form.new_email} onChange={(event) => update('new_email', event.target.value)} />
              </div>
            )}

            {(mode === 'create_user' || mode === 'update_profile') && (
              <div className="field">
                <label>微信名</label>
                <input className="input" value={form.wechat_name} onChange={(event) => update('wechat_name', event.target.value)} />
              </div>
            )}

            {mode === 'create_user' && (
              <>
                <div className="field">
                  <label>TG username</label>
                  <input className="input" value={form.tg_username} onChange={(event) => update('tg_username', event.target.value)} />
                </div>
                <div className="field">
                  <label>TG 显示名</label>
                  <input className="input" value={form.tg_display_name} onChange={(event) => update('tg_display_name', event.target.value)} />
                </div>
              </>
            )}

            {(mode === 'create_user' || mode === 'update_role') && (
              <>
                <div className="field">
                  <label>{mode === 'create_user' ? '初始角色' : '用户角色'}</label>
                  <SelectControl
                    ariaLabel={mode === 'create_user' ? '初始角色' : '用户角色'}
                    value={form.role_tag}
                    options={roles.map((role) => ({ value: role.tag, label: roleTagLabel(role.tag, role.name) }))}
                    onValueChange={(value) => update('role_tag', value)}
                  />
                </div>
                {mode === 'update_role' && (
                  <div className="field">
                    <label>目标状态</label>
                    <SelectControl
                      ariaLabel="目标状态"
                      value={form.role_granted}
                      options={[
                        { value: 'true', label: '拥有该角色' },
                        { value: 'false', label: '移除该角色' },
                      ]}
                      onValueChange={(value) => update('role_granted', value)}
                    />
                  </div>
                )}
                {(mode === 'create_user' || form.role_granted === 'true') && (
                  <div className="field">
                    <label>到期时间</label>
                    <input className="input" type="datetime-local" value={form.role_expires_at} onChange={(event) => update('role_expires_at', event.target.value)} />
                    <span className="muted">留空表示长期有效</span>
                  </div>
                )}
                <div className="field">
                  <label>原因分类</label>
                  <SelectControl
                    ariaLabel="原因分类"
                    value={form.reason_category}
                    options={Object.entries(reasonCategoryLabels).map(([value, label]) => ({ value, label }))}
                    onValueChange={(value) => update('reason_category', value)}
                  />
                </div>
              </>
            )}

            <div className="field full">
              <label>变更原因</label>
              <textarea className="textarea" value={form.reason} onChange={(event) => update('reason', event.target.value)} required />
            </div>
            <div className="field full">
              <label>执行备注</label>
              <textarea className="textarea" value={form.note} onChange={(event) => update('note', event.target.value)} required />
            </div>
            <div className="field full">
              <label>证据/补充说明</label>
              <textarea className="textarea" value={form.evidence_text} onChange={(event) => update('evidence_text', event.target.value)} />
            </div>
          </div>
          <div className="form-actions">
            <button className="secondary-button" type="button" onClick={onClose}>取消</button>
            <button className="button" disabled={saving || (needsRole && roles.length === 0)}>
              <Save size={17} />
              {saving ? '执行中...' : '生成并执行工单'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
