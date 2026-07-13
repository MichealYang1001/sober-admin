'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { CheckCircle, HelpCircle, MessageSquare, XCircle } from 'lucide-react'
import { getStoredAccount, opsFetch } from '@/lib/api'
import { formatRoleExpiry, labelOf, reasonCategoryLabels, roleTagLabel, ticketStatusLabels, ticketTypeLabels } from '@/lib/labels'
import type { PermissionTicket } from '@/lib/types'

export default function TicketDetailPage() {
  const params = useParams<{ id: string }>()
  const account = getStoredAccount()
  const [ticket, setTicket] = useState<PermissionTicket | null>(null)
  const [note, setNote] = useState('')
  const [comment, setComment] = useState('')
  const [error, setError] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  async function load() {
    setError('')
    try {
      const data = await opsFetch<{ ticket: PermissionTicket }>(`/ops/tickets/${params.id}`)
      setTicket(data.ticket)
    } catch (error) {
      setError(error instanceof Error ? error.message : '加载失败')
    }
  }

  useEffect(() => {
    load()
  }, [params.id])

  async function action(path: string) {
    setError('')
    setActionLoading(true)
    try {
      await opsFetch(`/ops/tickets/${params.id}/${path}`, {
        method: 'POST',
        body: JSON.stringify({ note }),
      })
      setNote('')
      load()
    } catch (error) {
      setError(error instanceof Error ? error.message : '操作失败')
    } finally {
      setActionLoading(false)
    }
  }

  async function approveAndExecute() {
    setError('')
    setActionLoading(true)
    try {
      const approved = await opsFetch<{ ticket: PermissionTicket }>(`/ops/tickets/${params.id}/approve`, {
        method: 'POST',
        body: JSON.stringify({ note }),
      })
      // 兼容尚未更新的后端：旧接口会先返回 approved，再补一次执行请求。
      if (approved.ticket.status === 'approved') {
        await opsFetch(`/ops/tickets/${params.id}/execute`, {
          method: 'POST',
          body: JSON.stringify({ note }),
        })
      }
      setNote('')
      load()
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : '审批执行失败')
    } finally {
      setActionLoading(false)
    }
  }

  async function addComment() {
    setError('')
    try {
      await opsFetch(`/ops/tickets/${params.id}/comments`, {
        method: 'POST',
        body: JSON.stringify({ body: comment }),
      })
      setComment('')
      load()
    } catch (error) {
      setError(error instanceof Error ? error.message : '提交失败')
    }
  }

  if (error) return <div className="error-state">{error}</div>
  if (!ticket) return <div className="empty-state">加载中...</div>

  const isAdmin = account?.role === 'admin'

  return (
    <>
      <div className="page-header">
        <div>
          <h1>{ticket.ticket_no}</h1>
          <p>{labelOf(ticketTypeLabels, ticket.type)} · {labelOf(ticketStatusLabels, ticket.status)}</p>
        </div>
        <span className="badge green">{labelOf(ticketStatusLabels, ticket.status)}</span>
      </div>

      <div className="panel detail-grid">
        <div className="detail-item"><span>当前邮箱</span><strong>{ticket.current_email || '-'}</strong></div>
        <div className="detail-item"><span>新邮箱</span><strong>{ticket.new_email || '-'}</strong></div>
        <div className="detail-item"><span>微信名</span><strong>{ticket.wechat_name || '-'}</strong></div>
        <div className="detail-item"><span>TG</span><strong>{ticket.tg_username || ticket.tg_display_name || '-'}</strong></div>
        <div className="detail-item"><span>用户角色</span><strong>{roleTagLabel(ticket.role_tag)}</strong></div>
        <div className="detail-item"><span>目标状态</span><strong>{ticket.role_granted == null ? '-' : ticket.role_granted ? '拥有该角色' : '移除该角色'}</strong></div>
        <div className="detail-item"><span>角色到期时间</span><strong>{ticket.type === 'update_role' && ticket.role_granted ? formatRoleExpiry(ticket.role_expires_at) : '-'}</strong></div>
        <div className="detail-item"><span>原因分类</span><strong>{labelOf(reasonCategoryLabels, ticket.reason_category)}</strong></div>
        <div className="detail-item"><span>申请人</span><strong>{ticket.requester?.display_name || ticket.requester?.email || '-'}</strong></div>
        <div className="detail-item"><span>审批备注</span><strong>{ticket.review_note || '-'}</strong></div>
        <div className="detail-item"><span>执行备注</span><strong>{ticket.execution_note || '-'}</strong></div>
      </div>

      <div className="section panel section-panel">
        <h2>原因和证据</h2>
        <p>{ticket.reason}</p>
        {ticket.evidence_text && <p className="muted">{ticket.evidence_text}</p>}
      </div>

      <div className="section panel section-panel">
        <h2>补充资料</h2>
        {ticket.comments?.map((item) => (
          <p key={item.id}><strong>{item.author?.display_name || item.author?.email || '同事'}：</strong>{item.body}</p>
        ))}
        <div className="toolbar">
          <input className="input" placeholder="补充资料或沟通记录" value={comment} onChange={(event) => setComment(event.target.value)} />
          <button className="secondary-button" onClick={addComment} disabled={!comment.trim()}>
            <MessageSquare size={17} />
            发送
          </button>
        </div>
      </div>

      {isAdmin && (
        <div className="section panel section-panel">
          <h2>管理员操作</h2>
          <textarea className="textarea" placeholder="审批备注，必填；通过后将立即执行" value={note} onChange={(event) => setNote(event.target.value)} />
          <div className="form-actions">
            <button className="secondary-button" onClick={() => action('request-info')} disabled={!note.trim() || actionLoading}>
              <HelpCircle size={17} />
              要求补资料
            </button>
            <button className="button" onClick={approveAndExecute} disabled={!note.trim() || ticket.status !== 'submitted' || actionLoading}>
              <CheckCircle size={17} />
              {actionLoading ? '处理中...' : '通过并执行'}
            </button>
            <button className="danger-button" onClick={() => action('reject')} disabled={!note.trim() || ticket.status === 'executed' || actionLoading}>
              <XCircle size={17} />
              拒绝
            </button>
            {ticket.status === 'approved' && (
              <button className="button" onClick={() => action('execute')} disabled={!note.trim() || actionLoading}>
                <CheckCircle size={17} />
                {actionLoading ? '处理中...' : '完成执行（历史工单）'}
              </button>
            )}
          </div>
        </div>
      )}

      {Boolean(ticket.before_snapshot || ticket.after_snapshot) && (
        <div className="section">
          <h2>执行快照</h2>
          <pre className="snapshot">{JSON.stringify({ before: ticket.before_snapshot, after: ticket.after_snapshot }, null, 2)}</pre>
        </div>
      )}
    </>
  )
}
