'use client'

import { useState } from 'react'
import { ArrowDown, ArrowUp, ImagePlus, LoaderCircle, Plus, Save, Trash2, X } from 'lucide-react'
import { opsFetch } from '@/lib/api'
import { roleTagLabel } from '@/lib/labels'
import { normalizeStudentChatMessages } from '@/lib/student-chat'
import type { RoleDefinition, StudentAttachment, StudentChatMessage, StudentChatSender, StudentDetail } from '@/lib/types'

interface StudentEditPanelProps {
  student: StudentDetail
  roles: RoleDefinition[]
  onCancel: () => void
  onSaved: (student: StudentDetail) => void
  onChatSaved: (student: StudentDetail) => void
}

function toLocalInput(value?: string | null) {
  return value ? value.slice(0, 16) : ''
}

function chatMessagePayload(item: StudentChatMessage) {
  return {
    sender: item.sender,
    content: item.content.trim(),
    attachments: (item.attachments || []).map((attachment) => ({
      object_key: attachment.object_key,
      file_name: attachment.file_name,
      content_type: attachment.content_type,
      size_bytes: attachment.size_bytes,
    })),
  }
}

function chatStateSignature(messages: StudentChatMessage[]) {
  return JSON.stringify(messages.map((item) => ({
    id: item.id || null,
    ...chatMessagePayload(item),
  })))
}

export function StudentEditPanel({ student, roles, onCancel, onSaved, onChatSaved }: StudentEditPanelProps) {
  const { user, telegram_binding: telegram, role_permissions: permissions } = student
  const currentRoles = new Set(user.user_role.split('_').filter((tag) => tag && tag !== 'regular'))
  const [saving, setSaving] = useState(false)
  const [savingChat, setSavingChat] = useState(false)
  const [uploadingMessageIndex, setUploadingMessageIndex] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [chatSuccess, setChatSuccess] = useState('')
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
  const [studentChat, setStudentChat] = useState<StudentChatMessage[]>(() =>
    normalizeStudentChatMessages(user.student_chat || user.student_qa),
  )
  const [savedStudentChat, setSavedStudentChat] = useState<StudentChatMessage[]>(() =>
    normalizeStudentChatMessages(user.student_chat || user.student_qa),
  )
  const [roleValues, setRoleValues] = useState(() => Object.fromEntries(roles.map((role) => {
    const permission = permissions.find((item) => item.role_tag === role.tag)
    return [role.tag, { granted: currentRoles.has(role.tag), expires_at: toLocalInput(permission?.expires_at) }]
  })))
  const hasChatChanges = chatStateSignature(studentChat) !== chatStateSignature(savedStudentChat)

  function update(name: string, value: string) {
    setForm((current) => ({ ...current, [name]: value }))
  }

  function updateChatSender(index: number, sender: StudentChatSender) {
    setChatSuccess('')
    setStudentChat((current) => current.map((item, itemIndex) => (
      itemIndex === index ? { ...item, sender } : item
    )))
  }

  function updateChatContent(index: number, content: string) {
    setChatSuccess('')
    setStudentChat((current) => current.map((item, itemIndex) => (
      itemIndex === index ? { ...item, content } : item
    )))
  }

  function addChatMessage(sender: StudentChatSender) {
    setChatSuccess('')
    setStudentChat((current) => [...current, { sender, content: '', attachments: [] }])
  }

  function removeChatMessage(index: number) {
    setChatSuccess('')
    setStudentChat((current) => current.filter((_, itemIndex) => itemIndex !== index))
  }

  function moveChatMessage(index: number, direction: -1 | 1) {
    setChatSuccess('')
    setStudentChat((current) => {
      const targetIndex = index + direction
      if (targetIndex < 0 || targetIndex >= current.length) return current
      const reordered = [...current]
      const movedMessage = reordered[index]
      reordered[index] = reordered[targetIndex]
      reordered[targetIndex] = movedMessage
      return reordered
    })
  }

  function removeAttachment(messageIndex: number, objectKey: string) {
    setChatSuccess('')
    setStudentChat((current) => current.map((item, itemIndex) => (
      itemIndex === messageIndex
        ? { ...item, attachments: (item.attachments || []).filter((attachment) => attachment.object_key !== objectKey) }
        : item
    )))
  }

  async function uploadAttachments(messageIndex: number, files: FileList | null) {
    if (!files?.length) return
    setUploadingMessageIndex(messageIndex)
    setError('')
    setChatSuccess('')
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
        setStudentChat((current) => current.map((item, itemIndex) => (
          itemIndex === messageIndex
            ? { ...item, attachments: [...(item.attachments || []), request.attachment] }
            : item
        )))
      }
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : '图片上传失败')
    } finally {
      setUploadingMessageIndex(null)
    }
  }

  async function saveStudentChat() {
    setError('')
    setChatSuccess('')
    const emptyMessageIndex = studentChat.findIndex((item) => !item.content.trim() && !(item.attachments || []).length)
    if (emptyMessageIndex >= 0) {
      setError(`第 ${emptyMessageIndex + 1} 条聊天消息没有文字或图片`)
      return
    }

    setSavingChat(true)
    try {
      const savedById = new Map(
        savedStudentChat.filter((item) => item.id).map((item) => [item.id as string, item]),
      )
      const currentIds = new Set(studentChat.flatMap((item) => item.id ? [item.id] : []))

      for (const savedMessage of savedStudentChat) {
        if (savedMessage.id && !currentIds.has(savedMessage.id)) {
          await opsFetch(`/ops/students/${user.id}/chat-messages/${savedMessage.id}`, {
            method: 'DELETE',
          })
        }
      }

      const persistedMessages: StudentChatMessage[] = []
      for (const message of studentChat) {
        if (!message.id) {
          const created = await opsFetch<{ message: StudentChatMessage }>(
            `/ops/students/${user.id}/chat-messages`,
            { method: 'POST', body: JSON.stringify(chatMessagePayload(message)) },
          )
          persistedMessages.push(created.message)
          continue
        }

        const savedMessage = savedById.get(message.id)
        if (!savedMessage || chatStateSignature([savedMessage]) !== chatStateSignature([message])) {
          const updated = await opsFetch<{ message: StudentChatMessage }>(
            `/ops/students/${user.id}/chat-messages/${message.id}`,
            { method: 'PATCH', body: JSON.stringify(chatMessagePayload(message)) },
          )
          persistedMessages.push(updated.message)
        } else {
          persistedMessages.push(message)
        }
      }

      const orderedMessageIds = persistedMessages.flatMap((item) => item.id ? [item.id] : [])
      const reordered = await opsFetch<{ student: StudentDetail }>(
        `/ops/students/${user.id}/chat-messages/order`,
        { method: 'PATCH', body: JSON.stringify({ message_ids: orderedMessageIds }) },
      )
      const refreshedChat = normalizeStudentChatMessages(
        reordered.student.user.student_chat || reordered.student.user.student_qa,
      )
      setStudentChat(refreshedChat)
      setSavedStudentChat(refreshedChat)
      setChatSuccess('聊天记录已增量保存')
      onChatSaved(reordered.student)
    } catch (chatError) {
      try {
        const latest = await opsFetch<{ student: StudentDetail }>(`/ops/students/${user.id}`)
        const latestChat = normalizeStudentChatMessages(
          latest.student.user.student_chat || latest.student.user.student_qa,
        )
        setStudentChat(latestChat)
        setSavedStudentChat(latestChat)
        onChatSaved(latest.student)
      } catch {
        // Keep the local draft when the latest server state cannot be reloaded.
      }
      setError(`${chatError instanceof Error ? chatError.message : '聊天记录保存失败'}；已尝试重新加载最新记录`)
    } finally {
      setSavingChat(false)
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    setSaving(true)
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

      <div className="student-chat-editor">
        <div className="student-chat-heading">
          <div>
            <h3>学员聊天记录</h3>
            <p className="muted">按微信聊天顺序记录；左侧是学员，右侧是老师，每条消息都可以附图片。</p>
          </div>
          <div className="student-chat-add-actions">
            <button
              className="secondary-button"
              type="button"
              disabled={uploadingMessageIndex !== null || savingChat}
              onClick={() => addChatMessage('student')}
            >
              <Plus size={16} />学员消息
            </button>
            <button
              className="secondary-button"
              type="button"
              disabled={uploadingMessageIndex !== null || savingChat}
              onClick={() => addChatMessage('teacher')}
            >
              <Plus size={16} />老师消息
            </button>
            <button
              className="button"
              type="button"
              disabled={!hasChatChanges || uploadingMessageIndex !== null || savingChat}
              onClick={() => void saveStudentChat()}
            >
              {savingChat ? <LoaderCircle className="student-upload-spinner" size={16} /> : <Save size={16} />}
              {savingChat ? '保存中...' : '保存聊天记录'}
            </button>
          </div>
        </div>
        {chatSuccess && <div className="student-chat-save-status">{chatSuccess}</div>}
        {hasChatChanges && !chatSuccess && <div className="student-chat-unsaved-status">聊天记录有未保存的修改</div>}
        {studentChat.length > 0 ? (
          <div className="student-chat-editor-list">
            {studentChat.map((item, index) => (
              <div className={`student-chat-editor-row ${item.sender}`} key={index}>
                <div className="student-chat-row-heading">
                  <div className="student-chat-sender-toggle" aria-label={`第 ${index + 1} 条消息发送方`}>
                    <button
                      className={item.sender === 'student' ? 'active' : ''}
                      type="button"
                      disabled={savingChat}
                      onClick={() => updateChatSender(index, 'student')}
                    >
                      学员
                    </button>
                    <button
                      className={item.sender === 'teacher' ? 'active' : ''}
                      type="button"
                      disabled={savingChat}
                      onClick={() => updateChatSender(index, 'teacher')}
                    >
                      老师
                    </button>
                  </div>
                  <div className="student-chat-message-actions">
                    <button
                      className="icon-button"
                      type="button"
                      disabled={index === 0 || uploadingMessageIndex !== null || savingChat}
                      onClick={() => moveChatMessage(index, -1)}
                      aria-label={`上移第 ${index + 1} 条消息`}
                      title="上移"
                    >
                      <ArrowUp size={15} />
                    </button>
                    <button
                      className="icon-button"
                      type="button"
                      disabled={index === studentChat.length - 1 || uploadingMessageIndex !== null || savingChat}
                      onClick={() => moveChatMessage(index, 1)}
                      aria-label={`下移第 ${index + 1} 条消息`}
                      title="下移"
                    >
                      <ArrowDown size={15} />
                    </button>
                    <button
                      className="icon-button student-chat-remove"
                      type="button"
                      disabled={uploadingMessageIndex !== null || savingChat}
                      onClick={() => removeChatMessage(index)}
                      aria-label={`删除第 ${index + 1} 条消息`}
                      title="删除这条消息"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                <div className="field">
                  <label htmlFor={`student-chat-message-${index}`}>
                    {item.sender === 'student' ? '学员消息' : '老师消息'}
                  </label>
                  <textarea
                    id={`student-chat-message-${index}`}
                    className="textarea"
                    rows={3}
                    value={item.content}
                    disabled={savingChat}
                    onChange={(event) => updateChatContent(index, event.target.value)}
                    placeholder={item.sender === 'student' ? '记录学员发来的原话' : '记录老师回复的原话'}
                  />
                </div>
                <div className="student-chat-attachments">
                  <div className="student-chat-attachment-heading">
                    <div>
                      <strong>消息图片</strong>
                      <span>可只传图片；支持 JPEG、PNG、WebP、GIF、HEIC，单张不超过 15 MB</span>
                    </div>
                    <label className={`secondary-button student-image-upload ${uploadingMessageIndex === index || savingChat ? 'disabled' : ''}`}>
                      {uploadingMessageIndex === index
                        ? <LoaderCircle className="student-upload-spinner" size={16} />
                        : <ImagePlus size={16} />}
                      {uploadingMessageIndex === index ? '上传中...' : '添加图片'}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif"
                        multiple
                        disabled={uploadingMessageIndex !== null || savingChat}
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
                              disabled={savingChat}
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
          <div className="student-chat-empty">暂无聊天记录，可从“学员消息”或“老师消息”开始添加。</div>
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
        <button className="secondary-button" type="button" onClick={onCancel} disabled={saving || savingChat || uploadingMessageIndex !== null}><X size={17} />取消</button>
        <button
          className="button"
          disabled={saving || savingChat || uploadingMessageIndex !== null || hasChatChanges}
          title={hasChatChanges ? '请先保存或撤销聊天记录修改' : undefined}
        >
          <Save size={17} />{saving ? '保存中...' : '保存基础资料'}
        </button>
      </div>
    </form>
  )
}
