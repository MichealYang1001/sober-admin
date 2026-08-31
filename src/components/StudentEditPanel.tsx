'use client'

import { useState } from 'react'
import { ImagePlus, LoaderCircle, Plus, Save, Trash2, X } from 'lucide-react'
import { opsFetch } from '@/lib/api'
import { roleTagLabel } from '@/lib/labels'
import type { RoleDefinition, StudentAttachment, StudentDetail, StudentQuestionAnswer } from '@/lib/types'

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
  const [uploadingQaIndex, setUploadingQaIndex] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    email: user.email,
    username: user.username || '',
    avatar: user.avatar || '',
    wechat_name: user.wechat_name || '',
    wechat_id: user.wechat_id || '',
    is_subscribed: Boolean(user.is_subscribed),
    note: user.note || '',
    background_profile: user.background_profile || '',
    planet_name: user.planet_name || '',
    planet_expires_at: toLocalInput(user.planet_expires_at),
    telegram_id: telegram?.telegram_id == null ? '' : String(telegram.telegram_id),
    telegram_username: telegram?.telegram_username || '',
    telegram_first_name: telegram?.telegram_first_name || '',
  })
  const [studentQa, setStudentQa] = useState<StudentQuestionAnswer[]>(() =>
    (user.student_qa || []).map((item) => ({
      question: item.question,
      answer: item.answer,
      attachments: item.attachments || [],
    })),
  )
  const [roleValues, setRoleValues] = useState(() => Object.fromEntries(roles.map((role) => {
    const permission = permissions.find((item) => item.role_tag === role.tag)
    return [role.tag, { granted: currentRoles.has(role.tag), expires_at: toLocalInput(permission?.expires_at) }]
  })))

  function update(name: string, value: string) {
    setForm((current) => ({ ...current, [name]: value }))
  }

  function updateStudentQa(index: number, field: 'question' | 'answer', value: string) {
    setStudentQa((current) => current.map((item, itemIndex) => (
      itemIndex === index ? { ...item, [field]: value } : item
    )))
  }

  function removeStudentQa(index: number) {
    setStudentQa((current) => current.filter((_, itemIndex) => itemIndex !== index))
  }

  function removeAttachment(qaIndex: number, objectKey: string) {
    setStudentQa((current) => current.map((item, itemIndex) => (
      itemIndex === qaIndex
        ? { ...item, attachments: (item.attachments || []).filter((attachment) => attachment.object_key !== objectKey) }
        : item
    )))
  }

  async function uploadAttachments(qaIndex: number, files: FileList | null) {
    if (!files?.length) return
    setUploadingQaIndex(qaIndex)
    setError('')
    try {
      for (const file of Array.from(files)) {
        const request = await opsFetch<{
          attachment: StudentAttachment
          upload: { url: string; method: 'PUT'; headers: Record<string, string> }
        }>(`/ops/students/${user.id}/assets/upload-request`, {
          method: 'POST',
          body: JSON.stringify({
            file_name: file.name,
            content_type: file.type,
            size_bytes: file.size,
          }),
        })
        const uploadResponse = await fetch(request.upload.url, {
          method: request.upload.method,
          headers: request.upload.headers,
          body: file,
        })
        if (!uploadResponse.ok) {
          throw new Error(`图片上传失败（${uploadResponse.status}）`)
        }
        setStudentQa((current) => current.map((item, itemIndex) => (
          itemIndex === qaIndex
            ? { ...item, attachments: [...(item.attachments || []), request.attachment] }
            : item
        )))
      }
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : '图片上传失败')
    } finally {
      setUploadingQaIndex(null)
    }
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
          wechat_id: form.wechat_id,
          is_subscribed: form.is_subscribed,
          note: form.note,
          background_profile: form.background_profile,
          student_qa: studentQa.map((item) => ({
            question: item.question.trim(),
            answer: item.answer.trim(),
            attachments: (item.attachments || []).map((attachment) => ({
              object_key: attachment.object_key,
              file_name: attachment.file_name,
              content_type: attachment.content_type,
              size_bytes: attachment.size_bytes,
            })),
          })),
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
        <div className="field"><label>微信 ID</label><input className="input" value={form.wechat_id} onChange={(event) => update('wechat_id', event.target.value)} /></div>
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
        <div className="field full">
          <label>背景画像</label>
          <textarea
            className="textarea"
            rows={7}
            value={form.background_profile}
            onChange={(event) => update('background_profile', event.target.value)}
            placeholder="例如：职业与行业背景、投资经验、资产与风险偏好、学习目标等"
          />
          <span className="muted">仅供内部管理使用，不会展示给学员。</span>
        </div>
      </div>

      <div className="student-qa-editor">
        <div className="student-qa-heading">
          <div>
            <h3>学员问答</h3>
            <p className="muted">记录微信群或私聊访谈；一次可添加多组问题与回答。</p>
          </div>
          <button
            className="secondary-button"
            type="button"
            disabled={uploadingQaIndex !== null}
            onClick={() => setStudentQa((current) => [...current, { question: '', answer: '', attachments: [] }])}
          >
            <Plus size={16} />添加问答
          </button>
        </div>
        {studentQa.length > 0 ? (
          <div className="student-qa-editor-list">
            {studentQa.map((item, index) => (
              <div className="student-qa-editor-row" key={index}>
                <div className="student-qa-row-heading">
                  <strong>问答 {index + 1}</strong>
                  <button
                    className="icon-button student-qa-remove"
                    type="button"
                    disabled={uploadingQaIndex !== null}
                    onClick={() => removeStudentQa(index)}
                    aria-label={`删除问答 ${index + 1}`}
                    title="删除这组问答"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                <div className="field">
                  <label htmlFor={`student-question-${index}`}>Question</label>
                  <textarea
                    id={`student-question-${index}`}
                    className="textarea"
                    rows={2}
                    value={item.question}
                    onChange={(event) => updateStudentQa(index, 'question', event.target.value)}
                    placeholder="向学员提出的问题"
                    required
                  />
                </div>
                <div className="field">
                  <label htmlFor={`student-answer-${index}`}>Answer</label>
                  <textarea
                    id={`student-answer-${index}`}
                    className="textarea"
                    rows={4}
                    value={item.answer}
                    onChange={(event) => updateStudentQa(index, 'answer', event.target.value)}
                    placeholder="学员的原始回答或整理后的回答"
                    required
                  />
                </div>
                <div className="student-qa-attachments">
                  <div className="student-qa-attachment-heading">
                    <div>
                      <strong>聊天截图</strong>
                      <span>支持 JPEG、PNG、WebP、GIF、HEIC，单张不超过 15 MB</span>
                    </div>
                    <label className={`secondary-button student-image-upload ${uploadingQaIndex === index ? 'disabled' : ''}`}>
                      {uploadingQaIndex === index
                        ? <LoaderCircle className="student-upload-spinner" size={16} />
                        : <ImagePlus size={16} />}
                      {uploadingQaIndex === index ? '上传中...' : '添加图片'}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif"
                        multiple
                        disabled={uploadingQaIndex !== null}
                        onChange={(event) => {
                          void uploadAttachments(index, event.target.files)
                          event.currentTarget.value = ''
                        }}
                      />
                    </label>
                  </div>
                  {(item.attachments || []).length > 0 && (
                    <div className="student-attachment-grid">
                      {(item.attachments || []).map((attachment) => (
                        <div className="student-attachment-card" key={attachment.object_key}>
                          {attachment.url && !['image/heic', 'image/heif'].includes(attachment.content_type) ? (
                            <a href={attachment.url} target="_blank" rel="noreferrer">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={attachment.url} alt={attachment.file_name} />
                            </a>
                          ) : (
                            <div className="student-attachment-placeholder"><ImagePlus size={24} /></div>
                          )}
                          <div className="student-attachment-meta">
                            <span title={attachment.file_name}>{attachment.file_name}</span>
                            <button
                              type="button"
                              onClick={() => removeAttachment(index, attachment.object_key)}
                              aria-label={`移除 ${attachment.file_name}`}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="student-qa-empty">暂无学员问答，点击“添加问答”开始记录。</div>
        )}
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
        <button className="secondary-button" type="button" onClick={onCancel} disabled={saving || uploadingQaIndex !== null}><X size={17} />取消</button>
        <button className="button" disabled={saving || uploadingQaIndex !== null}><Save size={17} />{saving ? '保存中...' : '保存全部修改'}</button>
      </div>
    </form>
  )
}
