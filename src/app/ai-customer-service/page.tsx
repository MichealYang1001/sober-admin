'use client'

import { useCallback, useEffect, useState } from 'react'
import { Bot, CircleHelp, MessageSquareText, RefreshCw, Target, X } from 'lucide-react'
import { opsFetch } from '@/lib/api'
import { SelectControl } from '@/components/SelectControl'
import type { AiConversation, AiCustomerOverview, AiKnowledgeGap, AiLead, AiMessage } from '@/lib/types'

type Tab = 'conversations' | 'leads' | 'gaps'
type ConversationDetail = { conversation: AiConversation; messages: AiMessage[]; leads: AiLead[] }

const conversationStatus: Record<string, string> = { open: '对话中', lead: '已留资', handoff: '待人工', resolved: '已解决', closed: '已关闭' }
const leadStatus: Record<string, string> = { new: '新线索', contacted: '已联系', qualified: '有意向', converted: '已转化', closed: '已关闭' }
const leadStatusOptions = Object.entries(leadStatus).map(([value, label]) => ({ value, label }))

export default function AiCustomerServiceAdminPage() {
  const [tab, setTab] = useState<Tab>('conversations')
  const [overview, setOverview] = useState<AiCustomerOverview | null>(null)
  const [conversations, setConversations] = useState<AiConversation[]>([])
  const [leads, setLeads] = useState<AiLead[]>([])
  const [gaps, setGaps] = useState<AiKnowledgeGap[]>([])
  const [detail, setDetail] = useState<ConversationDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [overviewData, conversationsData, leadsData, gapsData] = await Promise.all([
        opsFetch<{ overview: AiCustomerOverview }>('/ops/ai-customer-service/overview'),
        opsFetch<{ conversations: AiConversation[] }>('/ops/ai-customer-service/conversations'),
        opsFetch<{ leads: AiLead[] }>('/ops/ai-customer-service/leads'),
        opsFetch<{ knowledge_gaps: AiKnowledgeGap[] }>('/ops/ai-customer-service/knowledge-gaps'),
      ])
      setOverview(overviewData.overview)
      setConversations(conversationsData.conversations)
      setLeads(leadsData.leads)
      setGaps(gapsData.knowledge_gaps)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'AI 客服数据加载失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const openConversation = async (id: number) => {
    try {
      setDetail(await opsFetch<ConversationDetail>(`/ops/ai-customer-service/conversations/${id}`))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '会话详情加载失败')
    }
  }

  const updateLead = async (lead: AiLead, status: AiLead['status']) => {
    const data = await opsFetch<{ lead: AiLead }>(`/ops/ai-customer-service/leads/${lead.id}`, { method: 'PATCH', body: JSON.stringify({ status }) })
    setLeads((current) => current.map((item) => item.id === lead.id ? data.lead : item))
  }

  const resolveGap = async (gap: AiKnowledgeGap, status: AiKnowledgeGap['status']) => {
    const data = await opsFetch<{ knowledge_gap: AiKnowledgeGap }>(`/ops/ai-customer-service/knowledge-gaps/${gap.id}`, { method: 'PATCH', body: JSON.stringify({ status }) })
    setGaps((current) => current.map((item) => item.id === gap.id ? data.knowledge_gap : item))
  }

  return (
    <>
      <header className="page-header">
        <div><h1>AI 客服</h1><p>集中查看访客对话、销售线索与知识缺口。</p></div>
        <button className="secondary-button" onClick={() => void load()} disabled={loading}><RefreshCw size={16} className={loading ? 'spin' : ''} />刷新</button>
      </header>

      {error ? <div className="error-banner">{error}</div> : null}
      <section className="ai-metric-grid">
        <Metric icon={<MessageSquareText size={18} />} label="近 7 天会话" value={overview?.conversations_7d ?? 0} />
        <Metric icon={<Target size={18} />} label="近 7 天线索" value={overview?.leads_7d ?? 0} />
        <Metric icon={<CircleHelp size={18} />} label="待处理知识缺口" value={overview?.open_gaps ?? 0} />
        <Metric icon={<Bot size={18} />} label="累计留资率" value={`${overview?.lead_rate ?? 0}%`} />
      </section>

      <div className="filter-bar toolbar">
        <div className="tabs">
          <button className={tab === 'conversations' ? 'tab active' : 'tab'} onClick={() => setTab('conversations')}>会话记录 <span>{conversations.length}</span></button>
          <button className={tab === 'leads' ? 'tab active' : 'tab'} onClick={() => setTab('leads')}>销售线索 <span>{leads.length}</span></button>
          <button className={tab === 'gaps' ? 'tab active' : 'tab'} onClick={() => setTab('gaps')}>知识缺口 <span>{gaps.filter((item) => item.status === 'open').length}</span></button>
        </div>
      </div>

      {loading ? <div className="empty-state">正在加载 AI 客服数据...</div> : null}
      {!loading && tab === 'conversations' ? <ConversationTable items={conversations} onOpen={openConversation} /> : null}
      {!loading && tab === 'leads' ? <LeadTable items={leads} onStatus={updateLead} /> : null}
      {!loading && tab === 'gaps' ? <GapTable items={gaps} onStatus={resolveGap} /> : null}
      {detail ? <ConversationDrawer detail={detail} onClose={() => setDetail(null)} /> : null}
    </>
  )
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return <article className="ai-metric"><span className="ai-metric-icon">{icon}</span><div><span>{label}</span><strong>{value}</strong></div></article>
}

function ConversationTable({ items, onOpen }: { items: AiConversation[]; onOpen: (id: number) => void }) {
  if (!items.length) return <div className="empty-state">还没有 AI 客服会话。</div>
  return <div className="table-wrap"><table><thead><tr><th>会话</th><th>状态</th><th>模型</th><th>消息数</th><th>来源页面</th><th>最后对话</th><th /></tr></thead><tbody>{items.map((item) => <tr key={item.id}><td><strong>#{item.id}</strong><small className="table-subtext">{item.public_id.slice(0, 8)}</small></td><td><span className={`status-badge status-${item.status}`}>{conversationStatus[item.status] || item.status}</span></td><td>{item.model_id}</td><td>{item.message_count}</td><td className="truncate-cell">{item.source_page || '—'}</td><td>{formatTime(item.last_message_at)}</td><td><button className="secondary-button compact-button" onClick={() => onOpen(item.id)}>查看</button></td></tr>)}</tbody></table></div>
}

function LeadTable({ items, onStatus }: { items: AiLead[]; onStatus: (item: AiLead, status: AiLead['status']) => void }) {
  if (!items.length) return <div className="empty-state">还没有销售线索。</div>
  return <div className="table-wrap ai-lead-table-wrap"><table><thead><tr><th>客户</th><th>联系方式</th><th>咨询内容</th><th>状态</th><th>提交时间</th></tr></thead><tbody>{items.map((item) => <tr key={item.id}><td><strong>{item.name}</strong></td><td>{item.contact_type === 'wechat' ? '微信' : '手机'} · {item.contact_value}</td><td className="lead-question">{item.question || item.intended_product || '—'}</td><td><SelectControl value={item.status} options={leadStatusOptions} onValueChange={(value) => void onStatus(item, value as AiLead['status'])} ariaLabel={`更新 ${item.name} 的线索状态`} containerClassName={`ai-lead-status-select lead-status-${item.status}`} /></td><td>{formatTime(item.created_at)}</td></tr>)}</tbody></table></div>
}

function GapTable({ items, onStatus }: { items: AiKnowledgeGap[]; onStatus: (item: AiKnowledgeGap, status: AiKnowledgeGap['status']) => void }) {
  if (!items.length) return <div className="empty-state">目前没有知识缺口。</div>
  return <div className="ai-gap-list">{items.map((item) => <article key={item.id} className="ai-gap-card"><div><span className={`status-badge status-${item.status}`}>{item.status === 'open' ? '待处理' : item.status === 'resolved' ? '已解决' : '已忽略'}</span><p>{item.question}</p><small>{formatTime(item.created_at)} · {item.reason}</small></div>{item.status === 'open' ? <div className="toolbar"><button className="secondary-button" onClick={() => void onStatus(item, 'dismissed')}>忽略</button><button className="button" onClick={() => void onStatus(item, 'resolved')}>标记已解决</button></div> : null}</article>)}</div>
}

function ConversationDrawer({ detail, onClose }: { detail: ConversationDetail; onClose: () => void }) {
  return <div className="ai-drawer-backdrop" onClick={onClose}><aside className="ai-drawer" onClick={(event) => event.stopPropagation()}><header><div><span>会话 #{detail.conversation.id}</span><h2>完整对话记录</h2></div><button className="icon-button" onClick={onClose}><X size={18} /></button></header><div className="ai-message-list">{detail.messages.map((message) => <div key={message.id} className={`ai-admin-message ${message.role}`}><strong>{message.role === 'user' ? '访客' : 'AI 客服'}</strong><p>{message.content}</p><small>{formatTime(message.created_at)}{message.model_id ? ` · ${message.model_id}` : ''}</small></div>)}</div></aside></div>
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(value))
}
