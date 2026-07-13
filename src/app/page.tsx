'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Plus, RefreshCw } from 'lucide-react'
import { opsFetch } from '@/lib/api'
import { formatDate, labelOf, roleTagLabel, ticketStatusLabels, ticketTypeLabels } from '@/lib/labels'
import type { PermissionTicket } from '@/lib/types'

const statuses = ['submitted', 'needs_info', 'rejected', 'executed']

export default function TicketsPage() {
  const [status, setStatus] = useState('submitted')
  const [q, setQ] = useState('')
  const [tickets, setTickets] = useState<PermissionTicket[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function loadTickets() {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({ status })
      if (q.trim()) params.set('q', q.trim())
      const data = await opsFetch<{ tickets: PermissionTicket[] }>(`/ops/tickets?${params}`)
      setTickets(data.tickets)
    } catch (error) {
      setError(error instanceof Error ? error.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTickets()
  }, [status])

  return (
    <>
      <div className="page-header">
        <div>
          <h1>用户变更工单</h1>
          <p>用户资料和角色变更审批通过后立即执行。</p>
        </div>
        <Link className="button" href="/tickets/new">
          <Plus size={18} />
          新建工单
        </Link>
      </div>

      <div className="toolbar filter-bar">
        <div className="tabs">
          {statuses.map((item) => (
            <button key={item} className={status === item ? 'tab active' : 'tab'} onClick={() => setStatus(item)}>
              {ticketStatusLabels[item]}
            </button>
          ))}
        </div>
        <input className="input search-input" placeholder="邮箱、微信、工单号" value={q} onChange={(event) => setQ(event.target.value)} />
        <button className="secondary-button" onClick={loadTickets}>
          <RefreshCw size={17} />
          刷新
        </button>
      </div>

      {error && <div className="error-state">{error}</div>}
      <div className="panel table-wrap">
        <table>
          <thead>
            <tr>
              <th>工单号</th>
              <th>类型</th>
              <th>学员</th>
              <th>用户角色</th>
              <th>申请人</th>
              <th>时间</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {tickets.map((ticket) => (
              <tr key={ticket.id}>
                <td className="mono">{ticket.ticket_no}</td>
                <td><span className="badge">{labelOf(ticketTypeLabels, ticket.type)}</span></td>
                <td>
                  <strong>{ticket.current_email || '-'}</strong>
                  {ticket.wechat_name && <div className="muted">{ticket.wechat_name}</div>}
                </td>
                <td>{roleTagLabel(ticket.role_tag)}</td>
                <td>{ticket.requester?.display_name || ticket.requester?.email || '-'}</td>
                <td>{formatDate(ticket.created_at)}</td>
                <td><Link className="secondary-button" href={`/tickets/${ticket.id}`}>查看</Link></td>
              </tr>
            ))}
            {!loading && tickets.length === 0 && (
              <tr><td colSpan={7} className="muted">暂无工单</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}
