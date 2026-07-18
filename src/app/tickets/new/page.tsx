'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Save } from 'lucide-react'
import { opsFetch } from '@/lib/api'
import { roleTagLabel } from '@/lib/labels'
import { reasonCategoryLabels, ticketTypeLabels } from '@/lib/labels'
import { SelectControl } from '@/components/SelectControl'
import type { RoleDefinition } from '@/lib/types'

const ticketTypes = Object.keys(ticketTypeLabels)

export default function NewTicketPage() {
  const router = useRouter()
  const [roles, setRoles] = useState<RoleDefinition[]>([])
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    type: 'update_role',
    current_email: '',
    new_email: '',
    wechat_name: '',
    wechat_id: '',
    tg_username: '',
    tg_display_name: '',
    role_tag: 'club',
    role_granted: 'true',
    role_expires_at: '',
    reason_category: 'new_permission',
    reason: '',
    evidence_text: '',
  })

  useEffect(() => {
    opsFetch<{ roles: RoleDefinition[] }>('/ops/roles')
      .then((data) => setRoles(data.roles))
      .catch(() => undefined)

    const params = new URLSearchParams(window.location.search)
    const requestedType = params.get('type')
    const requestedEmail = params.get('email') || ''
    if (requestedType && ticketTypes.includes(requestedType)) {
      setForm((current) => ({
        ...current,
        type: requestedType,
        current_email: requestedEmail,
        reason_category: requestedType === 'create_user' || requestedType === 'update_role' ? 'new_permission' : 'other',
      }))
    } else if (requestedEmail) {
      setForm((current) => ({ ...current, current_email: requestedEmail }))
    }
  }, [])

  function update(name: string, value: string) {
    setForm((current) => ({ ...current, [name]: value }))
  }

  function changeType(type: string) {
    setForm((current) => ({
      ...current,
      type,
      reason_category: type === 'create_user' || type === 'update_role' ? 'new_permission' : 'other',
    }))
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    try {
      const payload = {
        type: form.type,
        current_email: form.current_email,
        new_email: form.type === 'update_profile' && form.new_email ? form.new_email : null,
        wechat_name: form.wechat_name || null,
        wechat_id: form.wechat_id || null,
        tg_username: form.tg_username || null,
        tg_display_name: form.tg_display_name || null,
        role_tag: form.type === 'create_user' || form.type === 'update_role' ? form.role_tag : null,
        role_granted: form.type === 'create_user' ? true : form.type === 'update_role' ? form.role_granted === 'true' : null,
        role_expires_at:
          (form.type === 'create_user' || (form.type === 'update_role' && form.role_granted === 'true')) && form.role_expires_at
            ? new Date(form.role_expires_at).toISOString()
            : null,
        reason_category: form.type === 'create_user' || form.type === 'update_role' ? form.reason_category : 'other',
        reason: form.reason,
        evidence_text: form.evidence_text || null,
      }
      const data = await opsFetch<{ ticket: { id: number } }>('/ops/tickets', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      router.push(`/tickets/${data.ticket.id}`)
    } catch (error) {
      setError(error instanceof Error ? error.message : '创建失败')
    }
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1>新建工单</h1>
          <p>提交用户资料或角色的最终变更状态。</p>
        </div>
      </div>
      {error && <div className="error-state">{error}</div>}
      <form className="panel form-panel" onSubmit={submit}>
        <div className="form-grid">
          <div className="field">
            <label>工单类型</label>
            <SelectControl
              ariaLabel="工单类型"
              value={form.type}
              options={ticketTypes.map((type) => ({ value: type, label: ticketTypeLabels[type] }))}
              onValueChange={changeType}
            />
          </div>
          <div className="field">
            <label>{form.type === 'create_user' ? '用户邮箱' : '用户当前邮箱'}</label>
            <input className="input" type="email" value={form.current_email} onChange={(event) => update('current_email', event.target.value)} required />
          </div>

          {(form.type === 'create_user' || form.type === 'update_profile') && (
            <>
              {form.type === 'update_profile' && (
                <div className="field">
                  <label>新邮箱</label>
                  <input className="input" type="email" value={form.new_email} onChange={(event) => update('new_email', event.target.value)} />
                </div>
              )}
              <div className="field">
                <label>微信名</label>
                <input className="input" value={form.wechat_name} onChange={(event) => update('wechat_name', event.target.value)} />
              </div>
              <div className="field">
                <label>微信 ID</label>
                <input className="input" value={form.wechat_id} onChange={(event) => update('wechat_id', event.target.value)} />
              </div>
            </>
          )}

          {(form.type === 'create_user' || form.type === 'update_role') && (
            <>
              <div className="field">
                <label>{form.type === 'create_user' ? '初始角色' : '用户角色'}</label>
                <SelectControl
                  ariaLabel="用户角色"
                  value={form.role_tag}
                  options={roles.map((role) => ({ value: role.tag, label: roleTagLabel(role.tag, role.name) }))}
                  onValueChange={(value) => update('role_tag', value)}
                />
              </div>
              {form.type === 'update_role' && (
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
              {(form.type === 'create_user' || form.role_granted === 'true') && (
                <div className="field">
                  <label>新的到期时间</label>
                  <input className="input" type="datetime-local" value={form.role_expires_at} onChange={(event) => update('role_expires_at', event.target.value)} />
                  <span className="muted">留空表示长期有效</span>
                </div>
              )}
              <div className="field">
                <label>变更原因分类</label>
                <SelectControl
                  ariaLabel="变更原因分类"
                  value={form.reason_category}
                  options={Object.entries(reasonCategoryLabels).map(([value, label]) => ({ value, label }))}
                  onValueChange={(value) => update('reason_category', value)}
                />
              </div>
            </>
          )}

          <div className="field">
            <label>TG username</label>
            <input className="input" value={form.tg_username} onChange={(event) => update('tg_username', event.target.value)} />
          </div>
          <div className="field">
            <label>TG 显示名</label>
            <input className="input" value={form.tg_display_name} onChange={(event) => update('tg_display_name', event.target.value)} />
          </div>
          <div className="field full">
            <label>具体原因</label>
            <textarea className="textarea" value={form.reason} onChange={(event) => update('reason', event.target.value)} required />
          </div>
          <div className="field full">
            <label>证据/备注</label>
            <textarea className="textarea" value={form.evidence_text} onChange={(event) => update('evidence_text', event.target.value)} />
          </div>
        </div>
        <div className="form-actions">
          <button className="button">
            <Save size={17} />
            提交工单
          </button>
        </div>
      </form>
    </>
  )
}
