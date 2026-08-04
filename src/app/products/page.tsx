'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { BookOpen, CheckCircle2, Pencil, Plus, RefreshCw, Search, X } from 'lucide-react'
import { opsFetch } from '@/lib/api'
import { formatDate } from '@/lib/labels'
import type {
  Product,
  ProductBundleItem,
  ProductCategory,
  ProductCurriculumItem,
  ProductCurriculumSection,
  ProductEdition,
  ProductOffer,
  ProductPromotion,
  ProductStatus,
  ProductType,
} from '@/lib/types'

type EditorTab = 'base' | 'commerce' | 'curriculum' | 'policy'

interface ProductDraft {
  slug: string
  name: string
  product_type: ProductType
  instructor_name: string
  short_description: string
  long_description: string
  cover_image_url: string
  landing_path: string
  cta_label: string
  purchase_instructions: string
  benefits: string[]
  entitlement_role_tag: string
  status: ProductStatus
  is_featured: boolean
  featured_rank: number
  sort_order: number
  category_ids: number[]
  curriculum_sections: ProductCurriculumSection[]
  editions: ProductEdition[]
  offers: ProductOffer[]
  promotions: ProductPromotion[]
  bundle_items: ProductBundleItem[]
}

const productTypeLabels: Record<ProductType, string> = {
  community: '知识社区',
  course: '专题课程',
  membership: '实战陪跑',
  service: '咨询服务',
}

const statusLabels: Record<ProductStatus, string> = {
  draft: '草稿',
  published: '已发布',
  archived: '已归档',
}

const liveStatusLabels: Record<ProductEdition['live_status'], string> = {
  upcoming: '待直播',
  live: '直播中',
  paused: '已暂停',
  ended: '已结束',
  not_applicable: '不适用',
}

const emptyDraft = (): ProductDraft => ({
  slug: '',
  name: '',
  product_type: 'course',
  instructor_name: '',
  short_description: '',
  long_description: '',
  cover_image_url: '',
  landing_path: '',
  cta_label: '咨询助教',
  purchase_instructions: '',
  benefits: [],
  entitlement_role_tag: '',
  status: 'draft',
  is_featured: false,
  featured_rank: 0,
  sort_order: 0,
  category_ids: [],
  curriculum_sections: [],
  editions: [],
  offers: [],
  promotions: [],
  bundle_items: [],
})

function toDraft(product: Product): ProductDraft {
  return {
    slug: product.slug,
    name: product.name,
    product_type: product.product_type,
    instructor_name: product.instructor_name || '',
    short_description: product.short_description || '',
    long_description: product.long_description || '',
    cover_image_url: product.cover_image_url || '',
    landing_path: product.landing_path || '',
    cta_label: product.cta_label || '咨询助教',
    purchase_instructions: product.purchase_instructions || '',
    benefits: [...(product.benefits || [])],
    entitlement_role_tag: product.entitlement_role_tag || '',
    status: product.status,
    is_featured: product.is_featured,
    featured_rank: product.featured_rank,
    sort_order: product.sort_order,
    category_ids: [...product.category_ids],
    curriculum_sections: structuredClone(product.curriculum_sections || []),
    editions: structuredClone(product.editions || []),
    offers: structuredClone(product.offers || []),
    promotions: structuredClone(product.promotions || []),
    bundle_items: structuredClone(product.bundle_items || []),
  }
}

function cleanDraft(draft: ProductDraft) {
  const cleanText = (value: string) => value.trim() || null
  return {
    ...draft,
    slug: draft.slug.trim(),
    name: draft.name.trim(),
    instructor_name: cleanText(draft.instructor_name),
    short_description: cleanText(draft.short_description),
    long_description: cleanText(draft.long_description),
    cover_image_url: cleanText(draft.cover_image_url),
    landing_path: cleanText(draft.landing_path),
    cta_label: draft.cta_label.trim() || '咨询助教',
    purchase_instructions: cleanText(draft.purchase_instructions),
    benefits: draft.benefits.map((item) => item.trim()).filter(Boolean),
    entitlement_role_tag: cleanText(draft.entitlement_role_tag),
    editions: draft.editions.map(({ id: _id, ...edition }) => edition),
    offers: draft.offers.map(({ id: _id, edition_id: _editionId, ...offer }) => ({
      ...offer,
      price: offer.pricing_mode === 'fixed' && offer.price !== '' ? offer.price : null,
      display_text: offer.display_text?.trim() || null,
    })),
    curriculum_sections: draft.curriculum_sections.map(({ id: _id, ...section }) => ({
      ...section,
      items: section.items.map(({ id: _itemId, ...item }) => item),
    })),
    promotions: draft.promotions.map(({ id: _id, ...promotion }) => ({
      ...promotion,
      value: promotion.value || null,
      description: promotion.description?.trim() || null,
      policy_text: promotion.policy_text?.trim() || null,
    })),
    bundle_items: draft.bundle_items.map(({ id: _id, included_product_id: _includedId, included_product_name: _includedName, ...item }) => item),
  }
}

function getPrimaryPrice(product: Product, offerType: ProductOffer['offer_type']) {
  const offer = product.offers.find((item) => item.offer_type === offerType)
  if (!offer) return '—'
  return offer.display_text || (offer.price ? `${offer.price} ${offer.currency}` : '联系咨询')
}

function ProductEditor({
  product,
  categories,
  products,
  onClose,
  onSaved,
}: {
  product: Product | null
  categories: ProductCategory[]
  products: Product[]
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const [draft, setDraft] = useState<ProductDraft>(() => product ? toDraft(product) : emptyDraft())
  const [tab, setTab] = useState<EditorTab>('base')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const setField = <K extends keyof ProductDraft>(key: K, value: ProductDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    if (!draft.name.trim() || !draft.slug.trim()) {
      setError('产品名称和 slug 为必填项。')
      setTab('base')
      return
    }
    setSaving(true)
    try {
      await opsFetch(product ? `/ops/products/${product.id}` : '/ops/products', {
        method: product ? 'PATCH' : 'POST',
        body: JSON.stringify(cleanDraft(draft)),
      })
      await onSaved()
      onClose()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const addEdition = () => setField('editions', [
    ...draft.editions,
    {
      code: `edition-${draft.editions.length + 1}`,
      name: `第 ${draft.editions.length + 1} 期`,
      live_status: 'ended',
      enrollment_status: 'closed',
      status: 'published',
      sort_order: (draft.editions.length + 1) * 10,
    },
  ])

  const addOffer = () => setField('offers', [
    ...draft.offers,
    {
      edition_code: draft.editions[0]?.code || null,
      offer_code: `offer-${draft.offers.length + 1}`,
      offer_type: 'replay',
      label: '录播课',
      pricing_mode: 'fixed',
      price: '',
      currency: 'USDT',
      billing_unit: 'course',
      display_text: '',
      sale_status: 'active',
      is_primary: draft.offers.length === 0,
      sort_order: (draft.offers.length + 1) * 10,
    },
  ])

  const addSection = () => setField('curriculum_sections', [
    ...draft.curriculum_sections,
    {
      code: `section-${draft.curriculum_sections.length + 1}`,
      title: `第 ${draft.curriculum_sections.length + 1} 章`,
      description: '',
      sort_order: (draft.curriculum_sections.length + 1) * 10,
      items: [],
    },
  ])

  const addPromotion = () => setField('promotions', [
    ...draft.promotions,
    {
      name: '优惠政策',
      description: '',
      policy_text: '',
      promotion_type: 'policy',
      value: null,
      status: 'draft',
      sort_order: (draft.promotions.length + 1) * 10,
      offer_codes: [],
    },
  ])

  return (
    <div className="product-editor-backdrop" role="presentation">
      <form className="product-editor" onSubmit={save}>
        <header className="product-editor-header">
          <div>
            <span className="product-editor-eyebrow">{product ? `PRODUCT #${product.id}` : 'NEW PRODUCT'}</span>
            <h2>{product ? `编辑「${product.name}」` : '新增产品'}</h2>
            <p>产品详情、价格状态和课程目录保存后统一由后端 API 提供。</p>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="关闭"><X size={19} /></button>
        </header>

        <div className="product-editor-tabs" role="tablist">
          {([
            ['base', '基本信息'],
            ['commerce', '价格与直播'],
            ['curriculum', '课程目录'],
            ['policy', '优惠与包含内容'],
          ] as Array<[EditorTab, string]>).map(([value, label]) => (
            <button key={value} type="button" className={tab === value ? 'active' : ''} onClick={() => setTab(value)}>{label}</button>
          ))}
        </div>

        <div className="product-editor-body">
          {error && <div className="error-state">{error}</div>}

          {tab === 'base' && (
            <div className="form-grid product-form-grid">
              <div className="field"><label>产品名称 *</label><input className="input" value={draft.name} onChange={(event) => setField('name', event.target.value)} /></div>
              <div className="field"><label>唯一 slug *</label><input className="input mono" value={draft.slug} onChange={(event) => setField('slug', event.target.value)} placeholder="options-entry-practice" /></div>
              <div className="field"><label>产品类型</label><select className="input" value={draft.product_type} onChange={(event) => setField('product_type', event.target.value as ProductType)}>{Object.entries(productTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
              <div className="field"><label>发布状态</label><select className="input" value={draft.status} onChange={(event) => setField('status', event.target.value as ProductStatus)}>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
              <div className="field"><label>讲师 / 主理人</label><input className="input" value={draft.instructor_name} onChange={(event) => setField('instructor_name', event.target.value)} /></div>
              <div className="field"><label>权限角色标记</label><input className="input mono" value={draft.entitlement_role_tag} onChange={(event) => setField('entitlement_role_tag', event.target.value)} placeholder="entry / club" /></div>
              <div className="field full"><label>所属分类</label><div className="product-check-grid">{categories.map((category) => <label key={category.id} className={draft.category_ids.includes(category.id) ? 'product-check active' : 'product-check'}><input type="checkbox" checked={draft.category_ids.includes(category.id)} onChange={() => setField('category_ids', draft.category_ids.includes(category.id) ? draft.category_ids.filter((id) => id !== category.id) : [...draft.category_ids, category.id])} /><span>{category.name}</span></label>)}</div></div>
              <div className="field full"><label>卡片短介绍</label><textarea className="textarea" value={draft.short_description} onChange={(event) => setField('short_description', event.target.value)} /></div>
              <div className="field full"><label>详细介绍</label><textarea className="textarea product-long-text" value={draft.long_description} onChange={(event) => setField('long_description', event.target.value)} /></div>
              <div className="field full"><label>核心权益（每行一条）</label><textarea className="textarea" value={draft.benefits.join('\n')} onChange={(event) => setField('benefits', event.target.value.split('\n'))} placeholder={'实盘操作实时分享\n双周直播与提问互动'} /></div>
              <div className="field full"><label>购买 / 加入说明</label><textarea className="textarea" value={draft.purchase_instructions} onChange={(event) => setField('purchase_instructions', event.target.value)} /></div>
              <div className="field"><label>封面图片 URL</label><input className="input" value={draft.cover_image_url} onChange={(event) => setField('cover_image_url', event.target.value)} /></div>
              <div className="field"><label>详情页路径</label><input className="input" value={draft.landing_path} onChange={(event) => setField('landing_path', event.target.value)} /></div>
              <div className="field"><label>按钮文案</label><input className="input" value={draft.cta_label} onChange={(event) => setField('cta_label', event.target.value)} /></div>
              <div className="field"><label>列表排序</label><input className="input" type="number" value={draft.sort_order} onChange={(event) => setField('sort_order', Number(event.target.value))} /></div>
              <label className="product-toggle"><input type="checkbox" checked={draft.is_featured} onChange={(event) => setField('is_featured', event.target.checked)} /><span>设为重点展示产品</span></label>
            </div>
          )}

          {tab === 'commerce' && (
            <div className="product-editor-stack">
              <section className="product-editor-section">
                <div className="product-section-title"><div><h3>课程期次与直播状态</h3><p>“直播已结束”属于课程状态，不是优惠信息。</p></div><button type="button" className="secondary-button" onClick={addEdition}><Plus size={15} />新增期次</button></div>
                {draft.editions.length === 0 && <div className="product-inline-empty">社区、会员或咨询产品可以不设置课程期次。</div>}
                {draft.editions.map((edition, index) => (
                  <div className="product-subcard" key={`${edition.code}-${index}`}>
                    <div className="product-subcard-head"><strong>期次 {index + 1}</strong><button type="button" onClick={() => setField('editions', draft.editions.filter((_, itemIndex) => itemIndex !== index))}>移除</button></div>
                    <div className="product-compact-grid">
                      <div className="field"><label>期次代码</label><input className="input mono" value={edition.code} onChange={(event) => setField('editions', draft.editions.map((item, itemIndex) => itemIndex === index ? { ...item, code: event.target.value } : item))} /></div>
                      <div className="field"><label>期次名称</label><input className="input" value={edition.name} onChange={(event) => setField('editions', draft.editions.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item))} /></div>
                      <div className="field"><label>直播状态</label><select className="input" value={edition.live_status} onChange={(event) => setField('editions', draft.editions.map((item, itemIndex) => itemIndex === index ? { ...item, live_status: event.target.value as ProductEdition['live_status'] } : item))}>{Object.entries(liveStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
                      <div className="field"><label>报名状态</label><select className="input" value={edition.enrollment_status} onChange={(event) => setField('editions', draft.editions.map((item, itemIndex) => itemIndex === index ? { ...item, enrollment_status: event.target.value as ProductEdition['enrollment_status'] } : item))}><option value="open">开放</option><option value="waitlist">候补</option><option value="closed">关闭</option><option value="not_applicable">不适用</option></select></div>
                      {(['live_start_at', 'live_end_at', 'replay_available_at', 'replay_expires_at'] as const).map((field) => <div className="field" key={field}><label>{{ live_start_at: '直播开始', live_end_at: '直播结束', replay_available_at: '录播开放', replay_expires_at: '录播截止' }[field]}</label><input className="input" type="datetime-local" value={(edition[field] || '').slice(0, 16)} onChange={(event) => setField('editions', draft.editions.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: event.target.value || null } : item))} /></div>)}
                    </div>
                  </div>
                ))}
              </section>

              <section className="product-editor-section">
                <div className="product-section-title"><div><h3>销售方案与价格</h3><p>直播价、录播价、年费和咨询费分别建方案；停售信息仍可展示。</p></div><button type="button" className="secondary-button" onClick={addOffer}><Plus size={15} />新增方案</button></div>
                {draft.offers.map((offer, index) => (
                  <div className="product-subcard" key={`${offer.offer_code}-${index}`}>
                    <div className="product-subcard-head"><strong>{offer.label || `方案 ${index + 1}`}</strong><button type="button" onClick={() => setField('offers', draft.offers.filter((_, itemIndex) => itemIndex !== index))}>移除</button></div>
                    <div className="product-compact-grid product-offer-grid">
                      <div className="field"><label>方案代码</label><input className="input mono" value={offer.offer_code} onChange={(event) => setField('offers', draft.offers.map((item, itemIndex) => itemIndex === index ? { ...item, offer_code: event.target.value } : item))} /></div>
                      <div className="field"><label>名称</label><input className="input" value={offer.label} onChange={(event) => setField('offers', draft.offers.map((item, itemIndex) => itemIndex === index ? { ...item, label: event.target.value } : item))} /></div>
                      <div className="field"><label>方案类型</label><select className="input" value={offer.offer_type} onChange={(event) => setField('offers', draft.offers.map((item, itemIndex) => itemIndex === index ? { ...item, offer_type: event.target.value as ProductOffer['offer_type'] } : item))}><option value="live">直播</option><option value="replay">录播</option><option value="subscription">订阅</option><option value="bundle">组合会员</option><option value="consultation">咨询</option></select></div>
                      <div className="field"><label>关联期次</label><select className="input" value={offer.edition_code || ''} onChange={(event) => setField('offers', draft.offers.map((item, itemIndex) => itemIndex === index ? { ...item, edition_code: event.target.value || null } : item))}><option value="">无</option>{draft.editions.map((edition) => <option value={edition.code} key={edition.code}>{edition.name}</option>)}</select></div>
                      <div className="field"><label>定价方式</label><select className="input" value={offer.pricing_mode} onChange={(event) => setField('offers', draft.offers.map((item, itemIndex) => itemIndex === index ? { ...item, pricing_mode: event.target.value as ProductOffer['pricing_mode'] } : item))}><option value="fixed">固定价格</option><option value="contact">联系咨询</option><option value="included">已包含</option></select></div>
                      <div className="field"><label>价格</label><input className="input" type="number" min="0" step="0.01" disabled={offer.pricing_mode !== 'fixed'} value={offer.price || ''} onChange={(event) => setField('offers', draft.offers.map((item, itemIndex) => itemIndex === index ? { ...item, price: event.target.value } : item))} /></div>
                      <div className="field"><label>币种</label><input className="input" value={offer.currency} onChange={(event) => setField('offers', draft.offers.map((item, itemIndex) => itemIndex === index ? { ...item, currency: event.target.value.toUpperCase() } : item))} /></div>
                      <div className="field"><label>计费单位</label><select className="input" value={offer.billing_unit} onChange={(event) => setField('offers', draft.offers.map((item, itemIndex) => itemIndex === index ? { ...item, billing_unit: event.target.value } : item))}><option value="course">整门课</option><option value="once">一次性</option><option value="year">每年</option><option value="month">每月</option><option value="session">每次</option></select></div>
                      <div className="field"><label>展示文案</label><input className="input" value={offer.display_text || ''} onChange={(event) => setField('offers', draft.offers.map((item, itemIndex) => itemIndex === index ? { ...item, display_text: event.target.value } : item))} placeholder="300U / 899元/年" /></div>
                      <div className="field"><label>销售状态</label><select className="input" value={offer.sale_status} onChange={(event) => setField('offers', draft.offers.map((item, itemIndex) => itemIndex === index ? { ...item, sale_status: event.target.value as ProductOffer['sale_status'] } : item))}><option value="active">销售中</option><option value="inactive">已停售</option><option value="sold_out">已售罄</option></select></div>
                    </div>
                  </div>
                ))}
              </section>
            </div>
          )}

          {tab === 'curriculum' && (
            <div className="product-editor-section">
              <div className="product-section-title"><div><h3>课程目录</h3><p>章节和课时会随产品详情 API 一起返回，前台不再写死目录。</p></div><button type="button" className="secondary-button" onClick={addSection}><Plus size={15} />新增章节</button></div>
              {draft.curriculum_sections.length === 0 && <div className="product-inline-empty"><BookOpen size={20} />当前产品没有课程目录。</div>}
              {draft.curriculum_sections.map((section, sectionIndex) => (
                <div className="product-curriculum-card" key={`${section.code}-${sectionIndex}`}>
                  <div className="product-subcard-head"><strong>章节 {sectionIndex + 1}</strong><button type="button" onClick={() => setField('curriculum_sections', draft.curriculum_sections.filter((_, index) => index !== sectionIndex))}>移除章节</button></div>
                  <div className="product-compact-grid">
                    <div className="field"><label>章节代码</label><input className="input mono" value={section.code} onChange={(event) => setField('curriculum_sections', draft.curriculum_sections.map((item, index) => index === sectionIndex ? { ...item, code: event.target.value } : item))} /></div>
                    <div className="field"><label>章节名称</label><input className="input" value={section.title} onChange={(event) => setField('curriculum_sections', draft.curriculum_sections.map((item, index) => index === sectionIndex ? { ...item, title: event.target.value } : item))} /></div>
                  </div>
                  <div className="product-lessons">
                    {section.items.map((item, itemIndex) => (
                      <div className="product-lesson-row" key={`${item.title}-${itemIndex}`}>
                        <span>{itemIndex + 1}</span>
                        <input className="input" value={item.title} onChange={(event) => setField('curriculum_sections', draft.curriculum_sections.map((currentSection, currentSectionIndex) => currentSectionIndex === sectionIndex ? { ...currentSection, items: currentSection.items.map((currentItem, currentItemIndex) => currentItemIndex === itemIndex ? { ...currentItem, title: event.target.value, lesson_number: itemIndex + 1, sort_order: (itemIndex + 1) * 10 } : currentItem) } : currentSection))} />
                        <button type="button" onClick={() => setField('curriculum_sections', draft.curriculum_sections.map((currentSection, currentSectionIndex) => currentSectionIndex === sectionIndex ? { ...currentSection, items: currentSection.items.filter((_, currentItemIndex) => currentItemIndex !== itemIndex) } : currentSection))}><X size={16} /></button>
                      </div>
                    ))}
                    <button type="button" className="product-add-lesson" onClick={() => {
                      const lesson: ProductCurriculumItem = { lesson_number: section.items.length + 1, title: '', summary: '', duration_minutes: null, is_preview: false, status: 'published', sort_order: (section.items.length + 1) * 10 }
                      setField('curriculum_sections', draft.curriculum_sections.map((currentSection, currentSectionIndex) => currentSectionIndex === sectionIndex ? { ...currentSection, items: [...currentSection.items, lesson] } : currentSection))
                    }}><Plus size={15} />添加课时</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === 'policy' && (
            <div className="product-editor-stack">
              <section className="product-editor-section">
                <div className="product-section-title"><div><h3>优惠政策</h3><p>这里仅录入真实优惠。直播价和录播价请在“价格与直播”维护。</p></div><button type="button" className="secondary-button" onClick={addPromotion}><Plus size={15} />新增政策</button></div>
                {draft.promotions.length === 0 && <div className="product-inline-empty">当前没有优惠政策。</div>}
                {draft.promotions.map((promotion, index) => (
                  <div className="product-subcard" key={`${promotion.name}-${index}`}>
                    <div className="product-subcard-head"><strong>{promotion.name || `政策 ${index + 1}`}</strong><button type="button" onClick={() => setField('promotions', draft.promotions.filter((_, itemIndex) => itemIndex !== index))}>移除</button></div>
                    <div className="product-compact-grid">
                      <div className="field"><label>政策名称</label><input className="input" value={promotion.name} onChange={(event) => setField('promotions', draft.promotions.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item))} /></div>
                      <div className="field"><label>状态</label><select className="input" value={promotion.status} onChange={(event) => setField('promotions', draft.promotions.map((item, itemIndex) => itemIndex === index ? { ...item, status: event.target.value as ProductPromotion['status'] } : item))}><option value="draft">草稿</option><option value="active">生效中</option><option value="ended">已结束</option><option value="archived">已归档</option></select></div>
                      <div className="field full"><label>政策说明</label><textarea className="textarea" value={promotion.policy_text || ''} onChange={(event) => setField('promotions', draft.promotions.map((item, itemIndex) => itemIndex === index ? { ...item, policy_text: event.target.value } : item))} /></div>
                      <div className="field full"><label>适用销售方案</label><div className="product-check-grid">{draft.offers.map((offer) => <label className={promotion.offer_codes.includes(offer.offer_code) ? 'product-check active' : 'product-check'} key={offer.offer_code}><input type="checkbox" checked={promotion.offer_codes.includes(offer.offer_code)} onChange={() => setField('promotions', draft.promotions.map((item, itemIndex) => itemIndex === index ? { ...item, offer_codes: item.offer_codes.includes(offer.offer_code) ? item.offer_codes.filter((code) => code !== offer.offer_code) : [...item.offer_codes, offer.offer_code] } : item))} /><span>{offer.label}（{offer.offer_code}）</span></label>)}</div></div>
                    </div>
                  </div>
                ))}
              </section>

              <section className="product-editor-section">
                <div className="product-section-title"><div><h3>包含的产品</h3><p>用于俱乐部等组合产品，明确它包含哪些单独课程。</p></div><button type="button" className="secondary-button" onClick={() => setField('bundle_items', [...draft.bundle_items, { included_product_slug: '', note: '', sort_order: (draft.bundle_items.length + 1) * 10 }])}><Plus size={15} />添加产品</button></div>
                {draft.bundle_items.map((bundle, index) => (
                  <div className="product-bundle-row" key={`${bundle.included_product_slug}-${index}`}>
                    <select className="input" value={bundle.included_product_slug} onChange={(event) => setField('bundle_items', draft.bundle_items.map((item, itemIndex) => itemIndex === index ? { ...item, included_product_slug: event.target.value } : item))}><option value="">请选择产品</option>{products.filter((item) => item.id !== product?.id).map((item) => <option value={item.slug} key={item.id}>{item.name}</option>)}</select>
                    <input className="input" value={bundle.note || ''} onChange={(event) => setField('bundle_items', draft.bundle_items.map((item, itemIndex) => itemIndex === index ? { ...item, note: event.target.value } : item))} placeholder="包含说明" />
                    <button type="button" className="icon-button" onClick={() => setField('bundle_items', draft.bundle_items.filter((_, itemIndex) => itemIndex !== index))}><X size={16} /></button>
                  </div>
                ))}
              </section>
            </div>
          )}
        </div>

        <footer className="product-editor-footer">
          <span>{product ? `最后更新：${formatDate(product.updated_at)}` : '新产品默认保存为草稿'}</span>
          <div className="toolbar"><button type="button" className="secondary-button" onClick={onClose}>取消</button><button className="button" disabled={saving}>{saving ? '正在保存…' : '保存产品'}</button></div>
        </footer>
      </form>
    </div>
  )
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<ProductCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | ProductStatus>('all')
  const [categoryFilter, setCategoryFilter] = useState<number | 'all'>('all')
  const [editing, setEditing] = useState<Product | null | undefined>(undefined)

  const load = useCallback(async () => {
    setError('')
    setLoading(true)
    try {
      const data = await opsFetch<{ products: Product[]; categories: ProductCategory[] }>('/ops/products')
      setProducts(data.products)
      setCategories(data.categories)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '产品数据加载失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => products.filter((product) => {
    const keyword = search.trim().toLowerCase()
    const matchesSearch = !keyword || product.name.toLowerCase().includes(keyword) || product.slug.toLowerCase().includes(keyword)
    const matchesStatus = statusFilter === 'all' || product.status === statusFilter
    const matchesCategory = categoryFilter === 'all' || product.category_ids.includes(categoryFilter)
    return matchesSearch && matchesStatus && matchesCategory
  }), [products, search, statusFilter, categoryFilter])

  const stats = {
    total: products.length,
    published: products.filter((product) => product.status === 'published').length,
    replay: products.filter((product) => product.offers.some((offer) => offer.offer_type === 'replay' && offer.sale_status === 'active')).length,
    liveEnded: products.filter((product) => product.editions.some((edition) => edition.live_status === 'ended')).length,
  }

  return (
    <>
      <div className="page-header">
        <div><h1>产品管理</h1><p>维护官网与 AI 客服共用的产品事实、课程目录、直播/录播价格和优惠政策。</p></div>
        <div className="toolbar"><button className="secondary-button" onClick={load} disabled={loading}><RefreshCw size={16} />刷新</button><button className="button" onClick={() => setEditing(null)}><Plus size={17} />新增产品</button></div>
      </div>

      <div className="product-stat-grid">
        <div className="product-stat"><span>产品总数</span><strong>{stats.total}</strong><small>4 个业务分类</small></div>
        <div className="product-stat"><span>已发布</span><strong>{stats.published}</strong><small><CheckCircle2 size={13} />前台可读取</small></div>
        <div className="product-stat"><span>录播销售中</span><strong>{stats.replay}</strong><small>独立于直播价格</small></div>
        <div className="product-stat"><span>直播已结束</span><strong>{stats.liveEnded}</strong><small>保留历史直播价</small></div>
      </div>

      <div className="filter-bar toolbar product-filter-bar">
        <label className="product-search"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索产品名称或 slug" /></label>
        <select className="input compact-input" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as 'all' | ProductStatus)}><option value="all">全部状态</option>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        <select className="input product-category-filter" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value === 'all' ? 'all' : Number(event.target.value))}><option value="all">全部分类</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select>
        <span className="muted">共 {filtered.length} 条</span>
      </div>

      {error && <div className="error-state">{error}</div>}
      <div className="panel table-wrap product-table-wrap">
        <table className="product-table">
          <thead><tr><th>产品</th><th>分类</th><th>状态</th><th>直播</th><th>录播 / 主价格</th><th>课程目录</th><th>更新时间</th><th>操作</th></tr></thead>
          <tbody>
            {loading && <tr><td colSpan={8}>正在加载产品目录…</td></tr>}
            {!loading && filtered.length === 0 && <tr><td colSpan={8}>没有符合条件的产品。</td></tr>}
            {filtered.map((product) => {
              const edition = product.editions[0]
              const livePrice = getPrimaryPrice(product, 'live')
              const primaryOffer = product.offers.find((offer) => offer.is_primary) || product.offers.find((offer) => offer.sale_status === 'active')
              return (
                <tr key={product.id}>
                  <td><div className="product-name-cell"><span className={`product-type-mark ${product.product_type}`}>{product.name.slice(0, 1)}</span><div><strong>{product.name}</strong><span>{product.slug}</span></div></div></td>
                  <td><div className="product-category-badges">{product.categories.map((category) => <span className="badge gray" key={category.id}>{category.name}</span>)}</div></td>
                  <td><span className={product.status === 'published' ? 'badge green' : product.status === 'draft' ? 'badge yellow' : 'badge gray'}>{statusLabels[product.status]}</span></td>
                  <td>{edition ? <div><span className={edition.live_status === 'live' ? 'badge red' : 'badge gray'}>{liveStatusLabels[edition.live_status]}</span><div className="muted product-price-sub">{livePrice}</div></div> : <span className="muted">不适用</span>}</td>
                  <td><strong>{primaryOffer?.display_text || (primaryOffer?.price ? `${primaryOffer.price} ${primaryOffer.currency}` : '—')}</strong><div className="muted product-price-sub">{primaryOffer?.label || '未设置方案'}</div></td>
                  <td>{product.curriculum_sections.reduce((total, section) => total + section.items.length, 0)} 节</td>
                  <td>{formatDate(product.updated_at)}</td>
                  <td><button className="secondary-button" onClick={() => setEditing(product)}><Pencil size={14} />编辑</button></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {editing !== undefined && <ProductEditor product={editing} categories={categories} products={products} onClose={() => setEditing(undefined)} onSaved={load} />}
    </>
  )
}
