'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Search, X } from 'lucide-react'
import { opsFetch } from '@/lib/api'
import { auditActionLabels, formatDate, labelOf } from '@/lib/labels'
import type { OpsAccount, PermissionTicket, StudentAuditLog } from '@/lib/types'

export default function AuditsPage() {
  const [email, setEmail] = useState('')
  const [ticketId, setTicketId] = useState('')
  const [logs, setLogs] = useState<StudentAuditLog[]>([])
  const [error, setError] = useState('')
  const [selectedLog, setSelectedLog] = useState<StudentAuditLog | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  async function load() {
    setError('')
    try {
      const params = new URLSearchParams()
      if (email.trim()) params.set('email', email.trim())
      if (ticketId.trim()) params.set('ticket_id', ticketId.trim())
      const data = await opsFetch<{ logs: StudentAuditLog[] }>(`/ops/student-audit-logs?${params}`)
      // 兼容尚未部署后端更新的环境：查看详情记录不在审计页面展示。
      setLogs(data.logs.filter((log) => log.action !== 'view_student_detail'))
    } catch (error) {
      setError(error instanceof Error ? error.message : '加载失败')
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function openDetail(log: StudentAuditLog) {
    setSelectedLog(log)
    setDetailLoading(true)
    try {
      const detail = { ...log }
      if (!detail.actor && detail.actor_account_id) {
        const accounts = await opsFetch<{ accounts: OpsAccount[] }>('/ops/accounts')
        detail.actor = accounts.accounts.find((account) => account.id === detail.actor_account_id) || null
      }
      if (!detail.ticket && detail.ticket_id) {
        const ticket = await opsFetch<{ ticket: PermissionTicket }>(`/ops/tickets/${detail.ticket_id}`)
        detail.ticket = ticket.ticket
      }
      setSelectedLog((current) => current?.id === log.id ? detail : current)
    } catch (detailError) {
      setError(detailError instanceof Error ? detailError.message : '审计详情加载失败')
    } finally {
      setDetailLoading(false)
    }
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1>学员审计</h1>
          <p>只记录学员资料与权限的实际变更，便于追溯操作责任。</p>
        </div>
      </div>
      <div className="toolbar filter-bar">
        <input className="input search-input" placeholder="邮箱" value={email} onChange={(event) => setEmail(event.target.value)} />
        <input className="input compact-input" placeholder="工单 ID" value={ticketId} onChange={(event) => setTicketId(event.target.value)} />
        <button className="secondary-button" onClick={load}><Search size={17} />查询</button>
      </div>
      {error && <div className="error-state">{error}</div>}
      <div className="panel table-wrap">
        <table>
          <thead>
            <tr>
              <th>动作</th>
              <th>学员</th>
              <th>工单</th>
              <th>原因</th>
              <th>时间（本地时区）</th>
              <th>详情</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id}>
                <td><span className="badge yellow">{labelOf(auditActionLabels, log.action)}</span></td>
                <td>{log.target_email || log.target_user_id || '-'}</td>
                <td>{log.ticket_id ? `#${log.ticket_id}` : '-'}</td>
                <td>{log.reason || '-'}</td>
                <td>{formatDate(log.created_at)}</td>
                <td><button className="secondary-button" type="button" onClick={() => openDetail(log)}>查看详情</button></td>
              </tr>
            ))}
            {logs.length === 0 && <tr><td colSpan={6} className="muted">暂无审计记录</td></tr>}
          </tbody>
        </table>
      </div>

      {selectedLog && (
        <div className="modal-backdrop" role="presentation">
          <div className="modal-panel audit-detail-modal" role="dialog" aria-modal="true" aria-labelledby="audit-detail-title">
            <div className="section-heading">
              <div>
                <h2 id="audit-detail-title">审计详情</h2>
                <p className="muted">{labelOf(auditActionLabels, selectedLog.action)} · {formatDate(selectedLog.created_at)}</p>
              </div>
              <button className="icon-button" type="button" onClick={() => setSelectedLog(null)} aria-label="关闭"><X size={18} /></button>
            </div>
            <div className="detail-grid audit-detail-grid">
              <div className="detail-item"><span>学员</span><strong>{selectedLog.target_email || selectedLog.target_user_id || '-'}</strong></div>
              <div className="detail-item"><span>操作人</span><strong>{selectedLog.actor?.display_name || selectedLog.actor?.email || '历史记录未保存操作人'}</strong></div>
              <div className="detail-item"><span>关联工单</span><strong>{selectedLog.ticket_id ? <Link href={`/tickets/${selectedLog.ticket_id}`}>{selectedLog.ticket?.ticket_no || `#${selectedLog.ticket_id}`}</Link> : '非工单操作'}</strong></div>
              <div className="detail-item"><span>审批人</span><strong>{selectedLog.ticket?.reviewer?.display_name || selectedLog.ticket?.reviewer?.email || '-'}</strong></div>
              <div className="detail-item"><span>执行人</span><strong>{selectedLog.ticket?.executor?.display_name || selectedLog.ticket?.executor?.email || '-'}</strong></div>
              <div className="detail-item"><span>审批时间</span><strong>{formatDate(selectedLog.ticket?.reviewed_at)}</strong></div>
              <div className="detail-item"><span>审批备注</span><strong>{selectedLog.ticket?.review_note || '-'}</strong></div>
              <div className="detail-item"><span>执行备注</span><strong>{selectedLog.ticket?.execution_note || '-'}</strong></div>
            </div>
            <div className="audit-snapshots">
              <div><h3>变更前</h3><pre className="snapshot">{JSON.stringify(selectedLog.before_json, null, 2) || '无变更前快照'}</pre></div>
              <div><h3>变更后</h3><pre className="snapshot">{JSON.stringify(selectedLog.after_json, null, 2) || '无变更后快照'}</pre></div>
            </div>
            {detailLoading && <p className="muted">正在补充关联工单和操作人信息...</p>}
          </div>
        </div>
      )}
    </>
  )
}
