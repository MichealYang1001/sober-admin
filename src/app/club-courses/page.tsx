'use client'

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { BookOpen, FileText, Pencil, Plus, RefreshCw, Upload, X } from 'lucide-react'
import { opsFetch } from '@/lib/api'
import type { Product, ProductCurriculumItem, ProductCurriculumSection } from '@/lib/types'

const CLUB_SLUG = 'global-options-club'
const CLUB_SECTION_CODE = 'club-lessons'
const STATIC_LESSON_COUNT = 57
const MAX_PDF_BYTES = 50 * 1024 * 1024

type LessonDraft = {
  title: string
  summary: string
  durationMinutes: string
  videoFileId: string
  pdfUrl: string
  category: string
  status: 'draft' | 'published'
}

const emptyDraft = (): LessonDraft => ({
  title: '',
  summary: '',
  durationMinutes: '',
  videoFileId: '',
  pdfUrl: '',
  category: '九、末日期权系列',
  status: 'published',
})

function cleanSections(sections: ProductCurriculumSection[]) {
  return sections.map(({ id: _id, ...section }) => ({
    ...section,
    items: section.items.map(({ id: _itemId, ...item }) => item),
  }))
}

export default function ClubCoursesPage() {
  const [product, setProduct] = useState<Product | null>(null)
  const [draft, setDraft] = useState<LessonDraft>(emptyDraft)
  const [editingLesson, setEditingLesson] = useState<ProductCurriculumItem | null>(null)
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [pdfInputKey, setPdfInputKey] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savePhase, setSavePhase] = useState<'uploading' | 'saving' | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await opsFetch<{ products: Product[] }>('/ops/products')
      const club = data.products.find((item) => item.slug === CLUB_SLUG)
      if (!club) throw new Error('没有找到“全球华人期权精英俱乐部”产品，请先在产品管理中创建。')
      setProduct(club)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '俱乐部课程加载失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const lessons = useMemo(() => product?.curriculum_sections
    .find((section) => section.code === CLUB_SECTION_CODE)?.items || [], [product])

  const nextLessonNumber = Math.max(
    STATIC_LESSON_COUNT,
    ...lessons.map((lesson) => lesson.lesson_number || 0),
  ) + 1

  function startEditing(lesson: ProductCurriculumItem) {
    setEditingLesson(lesson)
    setPdfFile(null)
    setPdfInputKey((current) => current + 1)
    setDraft({
      title: lesson.title,
      summary: lesson.summary || '',
      durationMinutes: lesson.duration_minutes ? String(lesson.duration_minutes) : '',
      videoFileId: lesson.video_file_id || '',
      pdfUrl: lesson.pdf_url || '',
      category: lesson.course_category || '九、末日期权系列',
      status: lesson.status === 'draft' ? 'draft' : 'published',
    })
    setError('')
    setSuccess('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function cancelEditing() {
    setEditingLesson(null)
    setDraft(emptyDraft())
    setPdfFile(null)
    setPdfInputKey((current) => current + 1)
  }

  function choosePdf(files: FileList | null) {
    const file = files?.[0]
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.pdf') || (file.type && file.type !== 'application/pdf')) {
      setError('请选择 PDF 格式的课件。')
      setPdfFile(null)
      setPdfInputKey((current) => current + 1)
      return
    }
    if (file.size === 0 || file.size > MAX_PDF_BYTES) {
      setError(file.size === 0 ? 'PDF 文件不能为空。' : 'PDF 文件不能超过 50 MB。')
      setPdfFile(null)
      setPdfInputKey((current) => current + 1)
      return
    }
    setPdfFile(file)
    setError('')
    setSuccess('')
  }

  function clearPdf() {
    if (pdfFile) {
      setPdfFile(null)
      setPdfInputKey((current) => current + 1)
      return
    }
    setPdfFile(null)
    setDraft((current) => ({ ...current, pdfUrl: '' }))
    setPdfInputKey((current) => current + 1)
  }

  async function uploadPdf(file: File, lessonNumber: number) {
    if (!product) throw new Error('课程产品尚未加载')
    const request = await opsFetch<{
      file: { path: string }
      upload: { url: string; method: 'PUT'; headers: Record<string, string> }
    }>(`/ops/products/${product.id}/club-lessons/${lessonNumber}/pdf-upload-request`, {
      method: 'POST',
      body: JSON.stringify({
        file_name: file.name,
        content_type: 'application/pdf',
        size_bytes: file.size,
      }),
    })
    const uploadResponse = await fetch(request.upload.url, {
      method: request.upload.method,
      headers: request.upload.headers,
      body: file,
    })
    if (!uploadResponse.ok) throw new Error(`PDF 上传失败（${uploadResponse.status}）`)
    return request.file.path
  }

  async function saveLesson(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!product || !draft.title.trim()) return

    setSaving(true)
    const uploadedPdf = Boolean(pdfFile)
    setSavePhase(pdfFile ? 'uploading' : 'saving')
    setError('')
    setSuccess('')
    try {
      const lessonNumber = editingLesson?.lesson_number || nextLessonNumber
      let pdfUrl = draft.pdfUrl.trim() || null
      if (pdfFile) {
        pdfUrl = await uploadPdf(pdfFile, lessonNumber)
        setDraft((current) => ({ ...current, pdfUrl: pdfUrl || '' }))
        setPdfFile(null)
        setPdfInputKey((current) => current + 1)
        setSavePhase('saving')
      }
      const nextLesson: ProductCurriculumItem = {
        lesson_number: lessonNumber,
        title: draft.title.trim(),
        summary: draft.summary.trim() || null,
        duration_minutes: draft.durationMinutes ? Number(draft.durationMinutes) : null,
        video_file_id: draft.videoFileId.trim(),
        pdf_url: pdfUrl,
        course_category: draft.category,
        is_preview: false,
        status: draft.status,
        sort_order: editingLesson?.sort_order || lessonNumber * 10,
      }

      const existingSection = product.curriculum_sections.find((section) => section.code === CLUB_SECTION_CODE)
      const sections = existingSection
        ? product.curriculum_sections.map((section) => section.code === CLUB_SECTION_CODE
          ? {
              ...section,
              items: editingLesson
                ? section.items.map((item) => item.lesson_number === editingLesson.lesson_number ? nextLesson : item)
                : [...section.items, nextLesson],
            }
          : section)
        : [...product.curriculum_sections, {
            code: CLUB_SECTION_CODE,
            title: '俱乐部课程',
            description: '全球华人期权精英俱乐部持续更新课程',
            sort_order: 100,
            items: [nextLesson],
          }]

      await opsFetch(`/ops/products/${product.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ curriculum_sections: cleanSections(sections) }),
      })
      setDraft(emptyDraft())
      setEditingLesson(null)
      setSuccess(`第 ${lessonNumber} 课已${editingLesson ? '更新' : '新增'}并${draft.status === 'published' ? '发布' : '保存为草稿'}${uploadedPdf ? '，PDF 课件已上传' : ''}。`)
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : `${editingLesson ? '更新' : '新增'}课程失败`)
    } finally {
      setSaving(false)
      setSavePhase(null)
    }
  }

  return (
    <>
      <div className="page-header">
        <div><h1>俱乐部课程</h1><p>单独维护全球华人期权精英俱乐部的课程目录。</p></div>
        <button className="secondary-button" type="button" onClick={load} disabled={loading}><RefreshCw size={16} />刷新</button>
      </div>

      {error && <div className="error-state">{error}</div>}
      {success && <div className="success-state">{success}</div>}

      <div className="club-course-layout">
        <form className="panel club-course-form" onSubmit={saveLesson}>
          <div className="product-section-title">
            <div><h3>{editingLesson ? <Pencil size={17} /> : <Plus size={17} />}{editingLesson ? `编辑第 ${editingLesson.lesson_number} 课` : `新增第 ${nextLessonNumber} 课`}</h3><p>{editingLesson ? '保存后前台会读取最新课程信息。' : '课程编号会根据现有课程自动递增。'}</p></div>
            {editingLesson && <button className="icon-button" type="button" onClick={cancelEditing} title="取消编辑"><X size={17} /></button>}
          </div>
          <div className="field"><label>课程标题 *</label><input className="input" value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} placeholder="请输入课程标题" required /></div>
          <div className="field"><label>腾讯云点播 FileId *</label><input className="input mono" inputMode="numeric" pattern="[0-9]+" value={draft.videoFileId} onChange={(event) => setDraft((current) => ({ ...current, videoFileId: event.target.value.trim() }))} placeholder="例如 5001834815204651977" required /><small className="muted">在腾讯云点播的视频详情中复制 FileId，发布后前台凭此播放。</small></div>
          <div className="field"><label>课程简介</label><textarea className="textarea" value={draft.summary} onChange={(event) => setDraft((current) => ({ ...current, summary: event.target.value }))} placeholder="可选，简要说明本课内容" /></div>
          <div className="product-compact-grid">
            <div className="field"><label>时长（分钟）</label><input className="input" type="number" min="1" value={draft.durationMinutes} onChange={(event) => setDraft((current) => ({ ...current, durationMinutes: event.target.value }))} placeholder="可选" /></div>
            <div className="field"><label>课程分类</label><select className="input" value={draft.category} onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value }))}><option value="九、末日期权系列">末日期权系列</option><option value="六、A股实盘 | 指数增强类">A股实盘系列</option><option value="七、数字资产实盘 | BTC指数增强">数字资产实盘系列</option><option value="八、期权套利系列课">期权套利系列</option><option value="一、期权基础课">期权基础课</option></select></div>
            <div className="field club-course-pdf-field">
              <label>PDF 课件</label>
              <label className={`club-course-pdf-upload${pdfFile || draft.pdfUrl ? ' selected' : ''}${saving ? ' disabled' : ''}`}>
                <input key={pdfInputKey} type="file" accept=".pdf,application/pdf" onChange={(event) => choosePdf(event.target.files)} disabled={saving} />
                <span className="club-course-pdf-icon">{pdfFile || draft.pdfUrl ? <FileText size={20} /> : <Upload size={20} />}</span>
                <span className="club-course-pdf-copy">
                  <strong>{pdfFile?.name || draft.pdfUrl || '选择 PDF 课件'}</strong>
                  <small>{pdfFile ? `发布时保存为 lesson${editingLesson?.lesson_number || nextLessonNumber}.pdf` : draft.pdfUrl ? '当前已配置，选择新文件即可替换' : '上传到私有 Cloudflare R2，最大 50 MB'}</small>
                </span>
                <span className="club-course-pdf-action">{pdfFile || draft.pdfUrl ? '更换' : '浏览'}</span>
              </label>
              {(pdfFile || draft.pdfUrl) && <div className="club-course-pdf-meta"><span>{pdfFile ? `${(pdfFile.size / 1024 / 1024).toFixed(2)} MB · 待上传` : '会员下载时由后端生成临时链接'}</span><button type="button" onClick={clearPdf} disabled={saving}>{pdfFile ? '取消选择' : '移除课件'}</button></div>}
            </div>
            <div className="field"><label>发布状态</label><select className="input" value={draft.status} onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value as LessonDraft['status'] }))}><option value="published">立即发布</option><option value="draft">保存为草稿</option></select></div>
          </div>
          <button className="button club-course-submit" type="submit" disabled={saving || loading || !product || !draft.videoFileId.trim()}>{savePhase === 'uploading' ? '正在上传 PDF…' : savePhase === 'saving' ? '正在保存课程…' : editingLesson ? '保存课程修改' : '新增并发布到前台'}</button>
        </form>

        <section className="panel club-course-list">
          <div className="product-section-title"><div><h3><BookOpen size={17} />后台新增记录</h3><p>前 57 课仍由会员前台现有课程数据提供。</p></div><span className="badge green">{lessons.length} 节</span></div>
          {loading && <div className="muted">正在加载课程…</div>}
          {!loading && lessons.length === 0 && <div className="empty-state">还没有从后台新增的俱乐部课程。</div>}
          <div className="club-course-items">
            {[...lessons].sort((a, b) => (b.lesson_number || 0) - (a.lesson_number || 0)).map((lesson) => (
              <article className="club-course-item" key={lesson.id || `${lesson.lesson_number}-${lesson.title}`}>
                <span className="club-course-number">{lesson.lesson_number}</span>
                <div><strong>{lesson.title}</strong>{lesson.summary && <p>{lesson.summary}</p>}<small>{lesson.duration_minutes ? `${lesson.duration_minutes} 分钟 · ` : ''}{lesson.course_category ? `${lesson.course_category} · ` : ''}{lesson.status === 'published' ? '已发布' : '草稿'}{lesson.video_file_id ? ' · 视频已绑定' : ' · 未绑定视频'}{lesson.pdf_url ? ` · ${lesson.pdf_url}` : ' · 未配置 PDF'}</small></div>
                <button className="secondary-button" type="button" onClick={() => startEditing(lesson)}><Pencil size={14} />编辑</button>
              </article>
            ))}
          </div>
        </section>
      </div>
    </>
  )
}
