'use client'

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { BookOpenText, Pencil, Plus, Search, Trash2, X } from 'lucide-react'
import { opsFetch } from '@/lib/api'
import type { AiKnowledgeEntry } from '@/lib/types'

type Draft = {
  category: string
  title: string
  content: string
  public_url: string
  keywords: string
  is_active: boolean
  sort_order: number
}

const EMPTY_DRAFT: Draft = { category: '产品与课程', title: '', content: '', public_url: '', keywords: '', is_active: true, sort_order: 0 }

export default function AiKnowledgePage() {
  const [items, setItems] = useState<AiKnowledgeEntry[]>([])
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<AiKnowledgeEntry | null | undefined>(undefined)
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await opsFetch<{ knowledge_entries: AiKnowledgeEntry[] }>('/ops/ai-customer-service/knowledge')
      setItems(data.knowledge_entries)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '知识库加载失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase()
    if (!term) return items
    return items.filter((item) => [item.title, item.category, item.content, ...item.keywords].some((value) => value.toLowerCase().includes(term)))
  }, [items, query])

  const openCreate = () => { setEditing(null); setDraft(EMPTY_DRAFT); setError('') }
  const openEdit = (item: AiKnowledgeEntry) => {
    setEditing(item)
    setDraft({ category: item.category, title: item.title, content: item.content, public_url: item.public_url || '', keywords: item.keywords.join('，'), is_active: item.is_active, sort_order: item.sort_order })
    setError('')
  }

  const save = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    const payload = { ...draft, public_url: draft.public_url.trim() || null, keywords: draft.keywords.split(/[,，\n]/).map((item) => item.trim()).filter(Boolean) }
    try {
      if (editing) {
        const data = await opsFetch<{ knowledge_entry: AiKnowledgeEntry }>(`/ops/ai-customer-service/knowledge/${editing.id}`, { method: 'PATCH', body: JSON.stringify(payload) })
        setItems((current) => current.map((item) => item.id === editing.id ? data.knowledge_entry : item))
      } else {
        const data = await opsFetch<{ knowledge_entry: AiKnowledgeEntry }>('/ops/ai-customer-service/knowledge', { method: 'POST', body: JSON.stringify(payload) })
        setItems((current) => [...current, data.knowledge_entry].sort((a, b) => a.sort_order - b.sort_order || a.id - b.id))
      }
      setEditing(undefined)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (item: AiKnowledgeEntry) => {
    try {
      const data = await opsFetch<{ knowledge_entry: AiKnowledgeEntry }>(`/ops/ai-customer-service/knowledge/${item.id}`, { method: 'PATCH', body: JSON.stringify({ is_active: !item.is_active }) })
      setItems((current) => current.map((entry) => entry.id === item.id ? data.knowledge_entry : entry))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '状态更新失败')
    }
  }

  const remove = async (item: AiKnowledgeEntry) => {
    if (!window.confirm(`确定删除“${item.title}”吗？删除后无法恢复。`)) return
    try {
      await opsFetch(`/ops/ai-customer-service/knowledge/${item.id}`, { method: 'DELETE' })
      setItems((current) => current.filter((entry) => entry.id !== item.id))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '删除失败')
    }
  }

  return <>
    <header className="page-header">
      <div><h1>AI 知识库</h1><p>维护已审核的产品资料与标准答案；只有启用内容会提供给 AI 客服。</p></div>
      <button className="button" onClick={openCreate}><Plus size={16} />新增知识</button>
    </header>
    {error ? <div className="error-banner">{error}</div> : null}
    <div className="filter-bar toolbar ai-knowledge-toolbar">
      <label className="search-input"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索标题、分类、内容或关键词" /></label>
      <span className="muted">共 {items.length} 条 · 已启用 {items.filter((item) => item.is_active).length} 条</span>
    </div>
    {loading ? <div className="empty-state">正在加载知识库...</div> : null}
    {!loading && !filtered.length ? <div className="empty-state"><BookOpenText size={24} />暂无匹配的知识条目。</div> : null}
    {!loading && filtered.length ? <div className="ai-knowledge-grid">{filtered.map((item) => <article className={`ai-knowledge-card ${item.is_active ? '' : 'inactive'}`} key={item.id}>
      <div className="ai-knowledge-card-head"><div><span className="badge teal">{item.category}</span><span className={`badge ${item.is_active ? 'green' : 'gray'}`}>{item.is_active ? '已启用' : '已停用'}</span></div><small>排序 {item.sort_order}</small></div>
      <h2>{item.title}</h2><p>{item.content}</p>
      {item.keywords.length ? <div className="ai-keywords">{item.keywords.map((keyword) => <span key={keyword}>{keyword}</span>)}</div> : null}
      {item.public_url ? <small className="ai-public-url">公开链接：{item.public_url}</small> : null}
      <footer><button className="secondary-button" onClick={() => void toggleActive(item)}>{item.is_active ? '停用' : '启用'}</button><button className="secondary-button" onClick={() => openEdit(item)}><Pencil size={14} />编辑</button><button className="icon-button ai-delete-button" onClick={() => void remove(item)} title="删除"><Trash2 size={15} /></button></footer>
    </article>)}</div> : null}
    {editing !== undefined ? <div className="modal-backdrop" onMouseDown={() => setEditing(undefined)}><form className="modal-panel" onSubmit={save} onMouseDown={(event) => event.stopPropagation()}>
      <div className="modal-header"><div><h2>{editing ? '编辑知识' : '新增知识'}</h2><p>内容保存并启用后，会自动进入 AI 客服的回答资料。</p></div><button type="button" className="icon-button" onClick={() => setEditing(undefined)}><X size={17} /></button></div>
      <div className="form-grid">
        <label className="field"><span>分类</span><input className="input" required maxLength={80} value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })} /></label>
        <label className="field"><span>排序</span><input className="input" type="number" value={draft.sort_order} onChange={(event) => setDraft({ ...draft, sort_order: Number(event.target.value) })} /></label>
        <label className="field full"><span>标题 / 问题</span><input className="input" required maxLength={200} value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="例如：期权入门实战课多少钱？" /></label>
        <label className="field full"><span>标准答案 / 已审核资料</span><textarea className="textarea ai-knowledge-content" required maxLength={12000} value={draft.content} onChange={(event) => setDraft({ ...draft, content: event.target.value })} placeholder="填写 AI 可以引用的准确内容" /></label>
        <label className="field full"><span>关键词</span><input className="input" value={draft.keywords} onChange={(event) => setDraft({ ...draft, keywords: event.target.value })} placeholder="用逗号分隔，例如：入门课，价格，零基础" /></label>
        <label className="field full"><span>公开页面链接（可选）</span><input className="input" maxLength={500} value={draft.public_url} onChange={(event) => setDraft({ ...draft, public_url: event.target.value })} placeholder="例如：/products 或 /club" /></label>
        <label className="ai-active-check"><input type="checkbox" checked={draft.is_active} onChange={(event) => setDraft({ ...draft, is_active: event.target.checked })} /><span>保存后立即提供给 AI 客服</span></label>
      </div>
      <div className="form-actions"><button type="button" className="secondary-button" onClick={() => setEditing(undefined)}>取消</button><button className="button" disabled={saving}>{saving ? '保存中...' : '保存知识'}</button></div>
    </form></div> : null}
  </>
}
