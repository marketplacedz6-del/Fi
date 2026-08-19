import { FormEvent, ReactNode, useEffect, useMemo, useState } from 'react'
import {
  BarChart3,
  Bell,
  Boxes,
  BrainCircuit,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  ClipboardList,
  Code2,
  Copy,
  Crown,
  Database,
  ExternalLink,
  Eye,
  FileSpreadsheet,
  Globe2,
  Headphones,
  KeyRound,
  Languages,
  LayoutDashboard,
  Link2,
  LogOut,
  Megaphone,
  Menu,
  MoreHorizontal,
  PackageCheck,
  PanelTop,
  Plus,
  Radio,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Store,
  Target,
  Trash2,
  TrendingUp,
  Truck,
  UserPlus,
  UsersRound,
  WandSparkles,
  X,
  Zap,
} from 'lucide-react'
import { registerRuntimePixel } from './lib/analytics'
import type { StoreOrder } from './lib/integrations'

export type DashboardProduct = {
  id: number
  name: { ar: string; fr: string }
  image: string
  price: number
  category: string
}

type ProductDraft = {
  name: string
  price: number
  category: 'decor' | 'lighting' | 'textiles' | 'fragrance'
  image: string
}

type AdminDashboardProps = {
  lang: 'ar' | 'fr'
  logo: string
  products: DashboardProduct[]
  orders: StoreOrder[]
  money: (value: number) => string
  onClose: () => void
  onLogout: () => void
  onOpenStore: () => void
  onAddProduct: (product: ProductDraft) => void
  onDeleteProduct: (id: number) => void
  onRestoreProducts: () => void
}

type Tab = 'overview' | 'products' | 'orders' | 'crm' | 'pages' | 'marketing' | 'integrations' | 'team' | 'settings'
type PixelProvider = 'Meta' | 'TikTok' | 'Google' | 'Pinterest' | 'Snapchat'

type LandingPage = { id: number; title: string; slug: string; published: boolean; views: number }
type Pixel = { id: number; provider: PixelProvider; pixelId: string; active: boolean }
type TeamMember = { id: number; name: string; email: string; role: string; active: boolean }
type Sheet = { id: number; name: string; url: string; active: boolean }

const readLocal = <T,>(key: string, fallback: T): T => {
  try {
    const value = localStorage.getItem(key)
    return value ? JSON.parse(value) as T : fallback
  } catch {
    return fallback
  }
}

const readLocalText = (key: string, fallback = '') => {
  try { return localStorage.getItem(key) ?? fallback } catch { return fallback }
}

const writeLocal = (key: string, value: string) => {
  try { localStorage.setItem(key, value) } catch { /* Storage may be disabled by the browser. */ }
}

const createApiKey = () => {
  try {
    const bytes = new Uint8Array(16)
    globalThis.crypto?.getRandomValues?.(bytes)
    const token = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
    if (token && !/^0+$/.test(token)) return `ehs_live_${token.slice(0, 24)}`
  } catch {
    // Fall through to a compatibility-safe identifier.
  }
  return `ehs_live_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 14)}`
}

const initialPages: LandingPage[] = [
  { id: 1, title: 'مجموعة البيت الهادئ', slug: 'calm-home', published: true, views: 1240 },
  { id: 2, title: 'عروض نهاية الأسبوع', slug: 'weekend-offer', published: false, views: 0 },
]

const initialTeam: TeamMember[] = [
  { id: 1, name: 'Walid', email: 'walid@gmail.com', role: 'المالك', active: true },
]

const providerClass: Record<PixelProvider, string> = {
  Meta: 'meta', TikTok: 'tiktok', Google: 'google', Pinterest: 'pinterest', Snapchat: 'snapchat',
}

export default function AdminDashboard({
  lang, logo, products, orders, money, onClose, onLogout, onOpenStore, onAddProduct, onDeleteProduct, onRestoreProducts,
}: AdminDashboardProps) {
  const ar = lang === 'ar'
  const l = (arabic: string, french: string) => ar ? arabic : french
  const [tab, setTab] = useState<Tab>('overview')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [productSearch, setProductSearch] = useState('')
  const [orderSearch, setOrderSearch] = useState('')
  const [addProductOpen, setAddProductOpen] = useState(false)
  const [notice, setNotice] = useState('')
  const [pages, setPages] = useState<LandingPage[]>(() => readLocal('ehs-landing-pages', initialPages))
  const [pixels, setPixels] = useState<Pixel[]>(() => readLocal('ehs-dashboard-pixels', []))
  const [team, setTeam] = useState<TeamMember[]>(() => readLocal('ehs-team', initialTeam))
  const [sheets, setSheets] = useState<Sheet[]>(() => readLocal('ehs-sheets', []))
  const [delivery, setDelivery] = useState<Record<string, boolean>>(() => readLocal('ehs-delivery', { Yalidine: true, 'ZR Express': false, Maystro: false, Guepex: false }))
  const [domain, setDomain] = useState(() => readLocalText('ehs-domain'))
  const [apiKey, setApiKey] = useState(() => readLocalText('ehs-api-key', createApiKey()))
  const [showApi, setShowApi] = useState(false)
  const [newPage, setNewPage] = useState('')
  const [pixelProvider, setPixelProvider] = useState<PixelProvider>('Meta')
  const [pixelId, setPixelId] = useState('')
  const [sheetName, setSheetName] = useState('')
  const [sheetUrl, setSheetUrl] = useState('')
  const [memberName, setMemberName] = useState('')
  const [memberEmail, setMemberEmail] = useState('')

  useEffect(() => writeLocal('ehs-landing-pages', JSON.stringify(pages)), [pages])
  useEffect(() => writeLocal('ehs-dashboard-pixels', JSON.stringify(pixels)), [pixels])
  useEffect(() => writeLocal('ehs-team', JSON.stringify(team)), [team])
  useEffect(() => writeLocal('ehs-sheets', JSON.stringify(sheets)), [sheets])
  useEffect(() => writeLocal('ehs-delivery', JSON.stringify(delivery)), [delivery])
  useEffect(() => writeLocal('ehs-api-key', apiKey), [apiKey])

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(''), 2800)
    return () => window.clearTimeout(timer)
  }, [notice])

  const revenue = orders.reduce((sum, order) => sum + order.total, 0)
  const customers = useMemo(() => {
    const unique = new Map<string, { name: string; phone: string; orders: number; spent: number }>()
    orders.forEach(order => {
      const phone = String(order.customer.phone ?? order.customer.email ?? order.id)
      const previous = unique.get(phone)
      unique.set(phone, {
        name: String(order.customer.name ?? l('زبون', 'Client')),
        phone,
        orders: (previous?.orders ?? 0) + 1,
        spent: (previous?.spent ?? 0) + order.total,
      })
    })
    return Array.from(unique.values())
  }, [orders, lang]) // eslint-disable-line react-hooks/exhaustive-deps

  const filteredProducts = products.filter(product => product.name[lang].toLowerCase().includes(productSearch.toLowerCase()))
  const filteredOrders = orders.filter(order => `${order.id} ${String(order.customer.name ?? '')} ${String(order.customer.phone ?? '')}`.toLowerCase().includes(orderSearch.toLowerCase()))
  const extraStaffCost = Math.max(0, team.length - 25) * 200

  const notify = (message: string) => setNotice(message)

  const navGroups: { label: string; items: { id: Tab; label: string; icon: ReactNode; badge?: string | number }[] }[] = [
    {
      label: l('الرئيسية', 'Principal'),
      items: [
        { id: 'overview', label: l('نظرة عامة', 'Vue générale'), icon: <LayoutDashboard /> },
        { id: 'products', label: l('المنتجات', 'Produits'), icon: <ShoppingBag />, badge: `${products.length} · ∞` },
        { id: 'orders', label: l('الطلبات', 'Commandes'), icon: <PackageCheck />, badge: `${orders.length} · ∞` },
        { id: 'crm', label: 'CRM', icon: <UsersRound />, badge: customers.length },
      ],
    },
    {
      label: l('النمو والتسويق', 'Croissance'),
      items: [
        { id: 'pages', label: l('صفحات الهبوط', 'Landing pages'), icon: <PanelTop />, badge: `${pages.length} · ∞` },
        { id: 'marketing', label: l('البيكسلات والتسويق', 'Pixels & marketing'), icon: <Target />, badge: `${pixels.length} · ∞` },
      ],
    },
    {
      label: l('إدارة المتجر', 'Gestion'),
      items: [
        { id: 'integrations', label: l('التكاملات', 'Intégrations'), icon: <Boxes /> },
        { id: 'team', label: l('الموظفون', 'Équipe'), icon: <UserPlus />, badge: `${team.length}/25` },
        { id: 'settings', label: l('الإعدادات و API', 'Paramètres & API'), icon: <Settings /> },
      ],
    },
  ]

  const switchTab = (next: Tab) => {
    setTab(next)
    setSidebarOpen(false)
  }

  const addLandingPage = (event: FormEvent) => {
    event.preventDefault()
    if (!newPage.trim()) return
    const slug = newPage.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || `page-${Date.now()}`
    setPages(current => [...current, { id: Date.now(), title: newPage.trim(), slug, published: false, views: 0 }])
    setNewPage('')
    notify(l('تم إنشاء صفحة هبوط جديدة', 'Nouvelle landing page créée'))
  }

  const addPixel = (event: FormEvent) => {
    event.preventDefault()
    if (!pixelId.trim()) return
    const value = pixelId.trim()
    setPixels(current => [...current, { id: Date.now(), provider: pixelProvider, pixelId: value, active: true }])
    registerRuntimePixel(pixelProvider, value)
    setPixelId('')
    notify(l('تمت إضافة البيكسل بنجاح', 'Pixel ajouté avec succès'))
  }

  const addSheet = (event: FormEvent) => {
    event.preventDefault()
    if (!sheetName.trim() || !sheetUrl.trim() || sheets.length >= 30) return
    setSheets(current => [...current, { id: Date.now(), name: sheetName.trim(), url: sheetUrl.trim(), active: true }])
    setSheetName('')
    setSheetUrl('')
    notify(l('تم ربط Google Sheet', 'Google Sheet connecté'))
  }

  const addMember = (event: FormEvent) => {
    event.preventDefault()
    if (!memberName.trim() || !memberEmail.trim()) return
    setTeam(current => [...current, { id: Date.now(), name: memberName.trim(), email: memberEmail.trim(), role: l('موظف', 'Employé'), active: true }])
    setMemberName('')
    setMemberEmail('')
    notify(l('تمت إضافة الموظف', 'Membre ajouté'))
  }

  const regenerateKey = () => {
    setApiKey(createApiKey())
    notify(l('تم إنشاء مفتاح API جديد', 'Nouvelle clé API créée'))
  }

  const renderOverview = () => (
    <>
      <div className="smart-welcome">
        <div>
          <p><Sparkles /> {l('مركز Elegance الذكي', 'Centre intelligent Elegance')}</p>
          <h1>{l('صباح الأناقة، وليد', 'Bonjour Walid')}</h1>
          <span>{l('كل شيء تحت السيطرة. إليك ما يحدث في متجرك اليوم.', 'Tout est sous contrôle. Voici ce qui se passe dans votre boutique.')}</span>
        </div>
        <div className="store-health"><div className="health-ring"><b>99.9%</b><span>SLA</span></div><p><CircleCheck /> {l('جميع الأنظمة تعمل', 'Tous les systèmes opérationnels')}</p></div>
      </div>

      <div className="smart-stat-grid">
        <SmartStat icon={<ShoppingBag />} label={l('إجمالي المنتجات', 'Total produits')} value={products.length.toString()} trend="+12%" color="gold" hint={l('غير محدود', 'Illimité')} />
        <SmartStat icon={<ClipboardList />} label={l('إجمالي الطلبات', 'Total commandes')} value={orders.length.toString()} trend="+8.4%" color="blue" hint={l('غير محدود', 'Illimité')} />
        <SmartStat icon={<TrendingUp />} label={l('إجمالي المبيعات', 'Chiffre d’affaires')} value={money(revenue)} trend="+18%" color="green" hint={l('هذا الشهر', 'Ce mois')} />
        <SmartStat icon={<UsersRound />} label={l('عملاء CRM', 'Clients CRM')} value={customers.length.toString()} trend="+5.2%" color="purple" hint={l('ملفات موحدة', 'Profils unifiés')} />
      </div>

      <div className="smart-overview-grid">
        <section className="dashboard-card revenue-card">
          <CardHead title={l('أداء المبيعات', 'Performance des ventes')} subtitle={l('آخر 7 أيام', '7 derniers jours')} action={<button><MoreHorizontal /></button>} />
          <div className="revenue-summary"><p><span>{l('المبيعات', 'Ventes')}</span><b>{money(revenue || 148500)}</b></p><em><TrendingUp /> 18.6%</em></div>
          <div className="smart-chart">
            {[32, 48, 39, 68, 54, 81, 72].map((height, index) => <div key={index}><span style={{ height: `${height}%` }} className={index === 5 ? 'peak' : ''} /><small>{['S', 'M', 'T', 'W', 'T', 'F', 'S'][index]}</small></div>)}
            <svg viewBox="0 0 700 170" preserveAspectRatio="none"><path d="M0,135 C75,115 85,130 145,105 S240,125 285,75 S370,95 430,55 S530,82 575,28 S650,55 700,35" /></svg>
          </div>
        </section>

        <section className="dashboard-card ai-card">
          <CardHead title={l('مساعد Elegance الذكي', 'Assistant intelligent')} subtitle="AI INSIGHTS" action={<BrainCircuit />} />
          <div className="ai-score"><div><Sparkles /><b>3</b></div><p><strong>{l('فرص نمو مكتشفة', 'Opportunités détectées')}</strong><span>{l('بناءً على أداء متجرك', 'Basé sur vos performances')}</span></p></div>
          <div className="insight-list">
            <Insight icon={<CircleAlert />} title={l('سلات تحتاج للاسترداد', 'Paniers à récupérer')} text={l('فعّل رسالة تذكير لرفع التحويل.', 'Activez un rappel pour convertir plus.')} action={() => switchTab('marketing')} />
            <Insight icon={<TrendingUp />} title={l('منتجك الأقوى', 'Votre produit vedette')} text={l('صينية أوريانا تحقق أعلى اهتمام.', 'Le plateau Oriana attire le plus.')} action={() => switchTab('products')} />
            <Insight icon={<Truck />} title={l('تحسين التوصيل', 'Optimiser la livraison')} text={l('اربط شركة توصيل إضافية.', 'Connectez un second transporteur.')} action={() => switchTab('integrations')} />
          </div>
        </section>
      </div>

      <div className="smart-bottom-grid">
        <section className="dashboard-card latest-orders-card">
          <CardHead title={l('أحدث الطلبات', 'Commandes récentes')} subtitle={`${orders.length} ${l('طلب', 'commandes')}`} action={<button onClick={() => switchTab('orders')}>{l('عرض الكل', 'Tout voir')} {ar ? <ChevronLeft /> : <ChevronRight />}</button>} />
          <OrderTable orders={orders.slice(-4).reverse()} ar={ar} money={money} emptyText={l('ستظهر الطلبات الجديدة هنا.', 'Les nouvelles commandes apparaîtront ici.')} />
        </section>
        <section className="dashboard-card usage-card">
          <CardHead title={l('استخدام باقتك', 'Utilisation du forfait')} subtitle={l('باقة Elite', 'Forfait Elite')} action={<Crown />} />
          <Usage label={l('الموظفون', 'Équipe')} value={team.length} total={25} />
          <Usage label="Google Sheets" value={sheets.length} total={30} />
          <Usage label={l('المنتجات', 'Produits')} value={products.length} unlimited />
          <Usage label={l('الطلبات', 'Commandes')} value={orders.length} unlimited />
        </section>
      </div>
    </>
  )

  const renderProducts = () => (
    <section className="dashboard-page">
      <PageTitle icon={<ShoppingBag />} title={l('إدارة المنتجات', 'Gestion des produits')} text={l('أضف وعدّل منتجاتك دون أي حدود. الرقم في القائمة هو العدد الحالي وليس الحد الأقصى.', 'Ajoutez vos produits sans limites. Le nombre affiché est le total actuel, pas une limite.')} action={<div className="page-action-buttons"><button className="smart-secondary" onClick={() => { onRestoreProducts(); notify(l('تمت استعادة المنتجات الأصلية', 'Produits d’origine restaurés')) }}><RefreshCw /> {l('استعادة الأصلية', 'Restaurer')}</button><button className="smart-primary" onClick={() => setAddProductOpen(true)}><Plus /> {l('منتج جديد', 'Nouveau produit')}</button></div>} />
      <div className="metric-strip"><Metric label={l('كل المنتجات', 'Tous les produits')} value={products.length} /><Metric label={l('متوفر', 'En stock')} value={products.length} green /><Metric label={l('مخزون منخفض', 'Stock faible')} value={2} warning /><Metric label={l('الحد الأقصى', 'Limite')} value={l('غير محدود', 'Illimité')} /></div>
      <div className="dashboard-card data-card">
        <div className="table-tools"><label><Search /><input value={productSearch} onChange={e => setProductSearch(e.target.value)} placeholder={l('ابحث في المنتجات...', 'Rechercher un produit...')} /></label><span>{filteredProducts.length} {l('منتج', 'produits')}</span></div>
        <div className="admin-product-table">
          <div className="table-header"><span>{l('المنتج', 'Produit')}</span><span>{l('القسم', 'Catégorie')}</span><span>{l('السعر', 'Prix')}</span><span>{l('الحالة', 'Statut')}</span><span /></div>
          {filteredProducts.map(product => <div className="product-table-row" key={product.id}><div><img src={product.image} alt="" /><p><b>{product.name[lang]}</b><small>SKU-{String(product.id).padStart(4, '0')}</small></p></div><span>{product.category}</span><strong>{money(product.price)}</strong><em><CircleCheck /> {l('متوفر', 'En stock')}</em><button onClick={() => onDeleteProduct(product.id)} title={l('حذف', 'Supprimer')}><Trash2 /></button></div>)}
        </div>
      </div>
    </section>
  )

  const renderOrders = () => (
    <section className="dashboard-page">
      <PageTitle icon={<PackageCheck />} title={l('إدارة الطلبات', 'Gestion des commandes')} text={l('طلبات غير محدودة ومتابعة كاملة من التأكيد حتى التسليم.', 'Commandes illimitées, du suivi à la livraison.')} />
      <div className="metric-strip"><Metric label={l('كل الطلبات', 'Toutes')} value={orders.length} /><Metric label={l('جديدة', 'Nouvelles')} value={orders.length} warning /><Metric label={l('قيد التوصيل', 'En livraison')} value={0} /><Metric label={l('الإيرادات', 'Revenus')} value={money(revenue)} green /></div>
      <div className="dashboard-card data-card">
        <div className="table-tools"><label><Search /><input value={orderSearch} onChange={e => setOrderSearch(e.target.value)} placeholder={l('رقم الطلب، الزبون أو الهاتف...', 'Commande, client ou téléphone...')} /></label><button className="smart-secondary"><RefreshCw /> {l('تحديث', 'Actualiser')}</button></div>
        <OrderTable orders={filteredOrders.slice().reverse()} ar={ar} money={money} emptyText={l('لا توجد طلبات مطابقة.', 'Aucune commande correspondante.')} expanded />
      </div>
    </section>
  )

  const renderCrm = () => (
    <section className="dashboard-page">
      <PageTitle icon={<UsersRound />} title={l('CRM العملاء الذكي', 'CRM clients intelligent')} text={l('ملف موحد لكل عميل مع سجل الطلبات وقيمة العميل.', 'Une fiche unifiée par client avec historique et valeur.')} action={<button className="smart-primary"><Plus /> {l('عميل جديد', 'Nouveau client')}</button>} />
      <div className="metric-strip"><Metric label={l('إجمالي العملاء', 'Total clients')} value={customers.length} /><Metric label={l('عملاء متكررون', 'Fidèles')} value={customers.filter(c => c.orders > 1).length} green /><Metric label={l('متوسط القيمة', 'Panier moyen')} value={money(customers.length ? revenue / customers.length : 0)} /><Metric label={l('شرائح ذكية', 'Segments')} value={4} /></div>
      <div className="crm-layout">
        <div className="dashboard-card crm-list"><CardHead title={l('قاعدة العملاء', 'Base clients')} subtitle={l('تتحدث تلقائياً', 'Mise à jour automatique')} />{customers.length ? customers.map((customer, index) => <div className="customer-row" key={customer.phone}><div className={`customer-avatar c${index % 4}`}>{customer.name.charAt(0)}</div><p><b>{customer.name}</b><span dir="ltr">{customer.phone}</span></p><small>{customer.orders} {l('طلبات', 'cmd.')}</small><strong>{money(customer.spent)}</strong><button><MoreHorizontal /></button></div>) : <DashboardEmpty icon={<UsersRound />} text={l('سيتم إنشاء ملفات العملاء تلقائياً مع أول طلب.', 'Les profils clients seront créés avec la première commande.')} />}</div>
        <div className="dashboard-card crm-segments"><CardHead title={l('شرائح ذكية', 'Segments intelligents')} subtitle="CRM" /><Segment color="gold" title={l('عملاء VIP', 'Clients VIP')} value={customers.filter(c => c.spent >= 15000).length} /><Segment color="green" title={l('عملاء متكررون', 'Clients fidèles')} value={customers.filter(c => c.orders > 1).length} /><Segment color="blue" title={l('عملاء جدد', 'Nouveaux clients')} value={customers.length} /><Segment color="rose" title={l('بحاجة لإعادة تفاعل', 'À réactiver')} value={0} /></div>
      </div>
    </section>
  )

  const renderPages = () => (
    <section className="dashboard-page">
      <PageTitle icon={<PanelTop />} title={l('صفحات الهبوط', 'Landing pages')} text={l('أنشئ صفحات حملات غير محدودة بدون كود.', 'Créez des pages de campagne illimitées, sans code.')} />
      <form className="inline-creator" onSubmit={addLandingPage}><div><WandSparkles /><input value={newPage} onChange={e => setNewPage(e.target.value)} placeholder={l('اسم الصفحة الجديدة...', 'Nom de la nouvelle page...')} /></div><button className="smart-primary"><Plus /> {l('إنشاء الصفحة', 'Créer la page')}</button></form>
      <div className="landing-grid">
        {pages.map(page => <article className="landing-card dashboard-card" key={page.id}><div className="landing-preview"><div className="preview-browser"><i /><i /><i /></div><PanelTop /><span>{page.title}</span></div><div className="landing-info"><div><em className={page.published ? 'published' : 'draft'}>{page.published ? l('منشورة', 'Publiée') : l('مسودة', 'Brouillon')}</em><h3>{page.title}</h3><p dir="ltr">/pages/{page.slug}</p></div><button><MoreHorizontal /></button></div><div className="landing-stats"><span><Eye /> {page.views}</span><button onClick={() => setPages(current => current.map(item => item.id === page.id ? { ...item, published: !item.published } : item))}>{page.published ? l('إيقاف', 'Dépublier') : l('نشر', 'Publier')}</button><button onClick={() => setPages(current => current.filter(item => item.id !== page.id))}><Trash2 /></button></div></article>)}
        <button className="new-landing-card" onClick={() => document.querySelector<HTMLInputElement>('.inline-creator input')?.focus()}><Plus /><b>{l('صفحة جديدة', 'Nouvelle page')}</b><span>{l('غير محدود', 'Illimité')}</span></button>
      </div>
    </section>
  )

  const renderMarketing = () => (
    <section className="dashboard-page">
      <PageTitle icon={<Target />} title={l('البيكسلات والتسويق', 'Pixels & marketing')} text={l('أضف عدداً غير محدود من بيكسلات التتبع لكل المنصات.', 'Ajoutez un nombre illimité de pixels pour chaque plateforme.')} />
      <div className="provider-grid">{(['Meta', 'TikTok', 'Google', 'Pinterest', 'Snapchat'] as PixelProvider[]).map(provider => <div className={`provider-card ${providerClass[provider]}`} key={provider}><div>{provider.charAt(0)}</div><p><b>{provider}</b><span>{pixels.filter(pixel => pixel.provider === provider).length} Pixels</span></p><CircleCheck /></div>)}</div>
      <div className="marketing-layout">
        <div className="dashboard-card pixel-manager"><CardHead title={l('مدير البيكسلات', 'Gestionnaire de pixels')} subtitle={l('غير محدود', 'Illimité')} /><form onSubmit={addPixel}><select value={pixelProvider} onChange={e => setPixelProvider(e.target.value as PixelProvider)}>{(['Meta', 'TikTok', 'Google', 'Pinterest', 'Snapchat'] as PixelProvider[]).map(provider => <option key={provider}>{provider}</option>)}</select><input value={pixelId} onChange={e => setPixelId(e.target.value)} placeholder="Pixel ID" dir="ltr" /><button className="smart-primary"><Plus /> {l('إضافة', 'Ajouter')}</button></form><div className="pixel-list">{pixels.length ? pixels.map(pixel => <div key={pixel.id}><span className={providerClass[pixel.provider]}>{pixel.provider.charAt(0)}</span><p><b>{pixel.provider}</b><small dir="ltr">{pixel.pixelId}</small></p><button className={`smart-toggle ${pixel.active ? 'on' : ''}`} onClick={() => setPixels(current => current.map(item => item.id === pixel.id ? { ...item, active: !item.active } : item))}><i /></button><button onClick={() => setPixels(current => current.filter(item => item.id !== pixel.id))}><Trash2 /></button></div>) : <DashboardEmpty icon={<Target />} text={l('أضف أول بيكسل لبدء التتبع.', 'Ajoutez votre premier pixel.')} />}</div></div>
        <div className="dashboard-card recovery-card"><CardHead title={l('استرداد السلات المتروكة', 'Paniers abandonnés')} subtitle={l('أتمتة ذكية', 'Automatisation')} action={<Zap />} /><div className="recovery-visual"><div className="recovery-ring"><b>0</b><span>{l('سلة', 'panier')}</span></div><p>{l('قيمة قابلة للاسترداد', 'Valeur récupérable')}<strong>{money(0)}</strong></p></div><div className="automation-row"><div><MessageIcon /><p><b>WhatsApp</b><span>{l('بعد 30 دقيقة', 'Après 30 min')}</span></p></div><button className="smart-toggle on"><i /></button></div><div className="automation-row"><div><Megaphone /><p><b>{l('إعلان إعادة الاستهداف', 'Retargeting')}</b><span>Meta + TikTok</span></p></div><button className="smart-toggle on"><i /></button></div></div>
      </div>
    </section>
  )

  const renderIntegrations = () => (
    <section className="dashboard-page">
      <PageTitle icon={<Boxes />} title={l('مركز التكاملات', 'Centre d’intégrations')} text={l('اربط التوصيل، Google Sheets، وكل إضافاتك من مكان واحد.', 'Connectez livraison, Google Sheets et toutes vos extensions.')} />
      <div className="integration-layout">
        <div className="dashboard-card"><CardHead title={l('شركات التوصيل', 'Sociétés de livraison')} subtitle={l('تكامل متقدم', 'Intégration avancée')} action={<Truck />} /><div className="delivery-grid">{Object.entries(delivery).map(([name, active]) => <div className="delivery-row" key={name}><div><Truck /><p><b>{name}</b><span>{active ? l('متصل ويعمل', 'Connecté') : l('غير متصل', 'Non connecté')}</span></p></div><button className={`smart-toggle ${active ? 'on' : ''}`} onClick={() => setDelivery(current => ({ ...current, [name]: !active }))}><i /></button></div>)}</div></div>
        <div className="dashboard-card sheets-card"><CardHead title="Google Sheets" subtitle={`${sheets.length} / 30`} action={<FileSpreadsheet />} /><div className="sheet-progress"><span style={{ width: `${sheets.length / 30 * 100}%` }} /></div><form onSubmit={addSheet}><input value={sheetName} onChange={e => setSheetName(e.target.value)} placeholder={l('اسم الجدول', 'Nom de la feuille')} /><input value={sheetUrl} onChange={e => setSheetUrl(e.target.value)} placeholder="Webhook URL" dir="ltr" /><button className="smart-primary" disabled={sheets.length >= 30}><Plus /> {l('ربط', 'Connecter')}</button></form><div className="sheet-list">{sheets.map(sheet => <div key={sheet.id}><FileSpreadsheet /><p><b>{sheet.name}</b><span>{l('مزامنة فورية', 'Synchronisation directe')}</span></p><CircleCheck /><button onClick={() => setSheets(current => current.filter(item => item.id !== sheet.id))}><X /></button></div>)}</div></div>
      </div>
      <div className="extensions-grid"><Extension icon={<Database />} title="CRM" status={l('مدمج', 'Intégré')} /><Extension icon={<Code2 />} title="Advanced API" status={l('متاح', 'Disponible')} /><Extension icon={<Globe2 />} title={l('نطاق مخصص', 'Domaine personnalisé')} status={domain || l('جاهز للربط', 'Prêt')} /><Extension icon={<Languages />} title={l('متعدد اللغات', 'Multilingue')} status="AR · FR" /><Extension icon={<Headphones />} title={l('دعم مباشر', 'Support direct')} status="24/7" /><Extension icon={<Sparkles />} title={l('جميع الإضافات', 'Toutes les extensions')} status="12 / 12" /></div>
    </section>
  )

  const renderTeam = () => (
    <section className="dashboard-page">
      <PageTitle icon={<UserPlus />} title={l('إدارة الموظفين', 'Gestion de l’équipe')} text={l('25 موظفاً مضمنون، مع صلاحيات وأدوار منفصلة.', '25 membres inclus, avec rôles et permissions.')} />
      <div className="team-plan"><div><Crown /><p><b>{team.length} / 25</b><span>{l('ضمن الباقة', 'Inclus dans le forfait')}</span></p></div><div><span>{l('تكلفة إضافية حالية', 'Coût supplémentaire')}</span><b>{money(extraStaffCost)} / {l('شهر', 'mois')}</b><small>+200 {ar ? 'د.ج' : 'DA'} / {l('موظف إضافي', 'membre supplémentaire')}</small></div></div>
      <form className="inline-creator team-creator" onSubmit={addMember}><div><UserPlus /><input value={memberName} onChange={e => setMemberName(e.target.value)} placeholder={l('اسم الموظف', 'Nom du membre')} /></div><div><Globe2 /><input value={memberEmail} onChange={e => setMemberEmail(e.target.value)} type="email" placeholder="email@example.com" dir="ltr" /></div><button className="smart-primary"><Plus /> {l('إضافة موظف', 'Ajouter')}</button></form>
      <div className="dashboard-card team-table"><div className="table-header"><span>{l('الموظف', 'Membre')}</span><span>{l('الدور', 'Rôle')}</span><span>{l('الحالة', 'Statut')}</span><span>{l('آخر نشاط', 'Dernière activité')}</span><span /></div>{team.map((member, index) => <div className="team-row" key={member.id}><div><span className={`customer-avatar c${index % 4}`}>{member.name.charAt(0)}</span><p><b>{member.name}</b><small dir="ltr">{member.email}</small></p></div><span>{index === 0 ? l('مالك المتجر', 'Propriétaire') : member.role}</span><em><i /> {l('نشط', 'Actif')}</em><small>{l('الآن', 'Maintenant')}</small>{index === 0 ? <Crown /> : <button onClick={() => setTeam(current => current.filter(item => item.id !== member.id))}><Trash2 /></button>}</div>)}</div>
    </section>
  )

  const renderSettings = () => (
    <section className="dashboard-page">
      <PageTitle icon={<Settings />} title={l('الإعدادات المتقدمة', 'Paramètres avancés')} text={l('النطاق، API، اللغات، الأمان وتطوير الميزات.', 'Domaine, API, langues, sécurité et développements.')} />
      <div className="settings-grid">
        <div className="dashboard-card settings-card"><CardHead title={l('النطاق المخصص', 'Domaine personnalisé')} subtitle={l('بدون علامة DZBuild', 'Sans marque DZBuild')} action={<Globe2 />} /><label>{l('اسم النطاق', 'Nom de domaine')}</label><div className="domain-input"><span>https://</span><input value={domain} onChange={e => setDomain(e.target.value)} placeholder="elegance-home.dz" dir="ltr" /><button onClick={() => { writeLocal('ehs-domain', domain); notify(l('تم حفظ النطاق', 'Domaine enregistré')) }}><Check /></button></div><p className="setting-help"><CircleCheck /> {l('SSL مجاني وتفعيل تلقائي بعد ربط DNS.', 'SSL gratuit après connexion DNS.')}</p></div>
        <div className="dashboard-card settings-card"><CardHead title={l('الوصول المتقدم إلى API', 'Accès API avancé')} subtitle="REST API · v1" action={<Code2 />} /><label>Live API Key</label><div className="api-key"><code dir="ltr">{showApi ? apiKey : `${apiKey.slice(0, 10)}••••••••••••••`}</code><button onClick={() => setShowApi(value => !value)}><Eye /></button><button onClick={() => { navigator.clipboard?.writeText(apiKey); notify(l('تم نسخ المفتاح', 'Clé copiée')) }}><Copy /></button></div><button className="regenerate-key" onClick={regenerateKey}><RefreshCw /> {l('إنشاء مفتاح جديد', 'Régénérer la clé')}</button></div>
        <div className="dashboard-card settings-card"><CardHead title={l('اللغات', 'Langues')} subtitle={l('متجر متعدد اللغات', 'Boutique multilingue')} action={<Languages />} /><div className="language-setting"><div><span>ع</span><p><b>العربية</b><small>RTL · {l('افتراضية', 'Par défaut')}</small></p></div><CircleCheck /></div><div className="language-setting"><div><span>FR</span><p><b>Français</b><small>LTR · Active</small></p></div><CircleCheck /></div></div>
        <div className="dashboard-card settings-card sla-card"><CardHead title={l('حالة الخدمة', 'État du service')} subtitle="SLA 99.9%" action={<ShieldCheck />} /><div className="uptime"><div><b>99.98%</b><span>{l('وقت التشغيل', 'Disponibilité')}</span></div><Radio /></div><ul><li><i /> Storefront API <span>Operational</span></li><li><i /> Orders & CRM <span>Operational</span></li><li><i /> Delivery webhooks <span>Operational</span></li></ul></div>
      </div>
      <div className="custom-feature-banner"><div><WandSparkles /><p><b>{l('تحتاج ميزة خاصة؟', 'Besoin d’une fonctionnalité sur mesure ?')}</b><span>{l('تطوير ميزات مخصصة مضمن في باقتك. أرسل طلبك مباشرة للفريق.', 'Le développement sur mesure est inclus. Envoyez votre demande.')}</span></p></div><button onClick={() => notify(l('تم فتح طلب تطوير مخصص', 'Demande de développement créée'))}>{l('طلب ميزة مخصصة', 'Demander une fonctionnalité')} <ExternalLink /></button></div>
    </section>
  )

  const tabContent: Record<Tab, () => ReactNode> = {
    overview: renderOverview,
    products: renderProducts,
    orders: renderOrders,
    crm: renderCrm,
    pages: renderPages,
    marketing: renderMarketing,
    integrations: renderIntegrations,
    team: renderTeam,
    settings: renderSettings,
  }

  return (
    <div className="smart-dashboard" dir={ar ? 'rtl' : 'ltr'}>
      <aside className={`smart-sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="smart-logo"><img src={logo} alt="Elegance Home & Style" /><div><b>Elegance</b><span>CONTROL CENTER</span></div></div>
        <button className="sidebar-mobile-close" onClick={() => setSidebarOpen(false)}><X /></button>
        <div className="plan-badge"><Crown /><div><b>Elite Plan</b><span>{l('كل المميزات مفعلة', 'Toutes les fonctions actives')}</span></div><CircleCheck /></div>
        <nav>{navGroups.map(group => <div className="nav-group" key={group.label}><p>{group.label}</p>{group.items.map(item => <button key={item.id} className={tab === item.id ? 'active' : ''} onClick={() => switchTab(item.id)}>{item.icon}<span>{item.label}</span>{item.badge !== undefined && <em>{item.badge}</em>}</button>)}</div>)}</nav>
        <button className="smart-support" onClick={() => window.open('https://wa.me/213555000000', '_blank')}><Headphones /><div><b>{l('دعم مباشر', 'Support direct')}</b><span>24/7 · Online</span></div><i /></button>
        <button className="smart-logout" onClick={onLogout}><LogOut /> {l('تسجيل الخروج', 'Déconnexion')}</button>
      </aside>
      {sidebarOpen && <div className="sidebar-scrim" onClick={() => setSidebarOpen(false)} />}

      <main className="smart-main">
        <header className="smart-topbar">
          <div className="topbar-start"><button className="dashboard-menu" onClick={() => setSidebarOpen(true)}><Menu /></button><div className="global-search"><Search /><input placeholder={l('ابحث في متجرك...', 'Rechercher dans la boutique...')} /><kbd>⌘ K</kbd></div></div>
          <div className="topbar-actions">
            <button className="visit-store" onClick={onOpenStore}><Store /> {l('عرض المتجر', 'Voir la boutique')} <ExternalLink /></button>
            <div className="notification-wrap"><button className="notification-button" onClick={() => setNotificationsOpen(value => !value)}><Bell /><i>3</i></button>{notificationsOpen && <div className="notification-popover"><h3>{l('الإشعارات', 'Notifications')} <span>3</span></h3><Notification icon={<PackageCheck />} title={l('طلب جديد', 'Nouvelle commande')} text={l('تم تسجيل طلب جديد في المتجر.', 'Une commande a été enregistrée.')} /><Notification icon={<CircleAlert />} title={l('تنبيه ذكي', 'Alerte intelligente')} text={l('اربط شركة توصيل ثانية لتحسين الأداء.', 'Connectez un second transporteur.')} /><Notification icon={<ShieldCheck />} title="SLA 99.9%" text={l('جميع الأنظمة تعمل بشكل طبيعي.', 'Tous les systèmes sont opérationnels.')} /></div>}</div>
            <div className="admin-profile"><div>W</div><p><b>Walid</b><span>{l('مالك المتجر', 'Propriétaire')}</span></p><ChevronDownIcon /></div>
            <button className="dashboard-close" onClick={onClose}><X /></button>
          </div>
        </header>
        <div className="smart-scroll">{tabContent[tab]()}</div>
      </main>

      {addProductOpen && <AddProductModal ar={ar} products={products} onClose={() => setAddProductOpen(false)} onAdd={product => { onAddProduct(product); setAddProductOpen(false); notify(l('تمت إضافة المنتج بنجاح', 'Produit ajouté avec succès')) }} />}
      {notice && <div className="dashboard-toast"><CircleCheck /> {notice}</div>}
    </div>
  )
}

function SmartStat({ icon, label, value, trend, color, hint }: { icon: ReactNode; label: string; value: string; trend: string; color: string; hint: string }) {
  return <article className="smart-stat dashboard-card"><div className={`stat-icon ${color}`}>{icon}</div><div><span>{label}</span><b>{value}</b><small>{hint}</small></div><em><TrendingUp /> {trend}</em></article>
}

function CardHead({ title, subtitle, action }: { title: string; subtitle: string; action?: ReactNode }) {
  return <div className="card-head"><div><h3>{title}</h3><span>{subtitle}</span></div>{action && <div className="card-head-action">{action}</div>}</div>
}

function Insight({ icon, title, text, action }: { icon: ReactNode; title: string; text: string; action: () => void }) {
  return <button className="insight" onClick={action}><div>{icon}</div><p><b>{title}</b><span>{text}</span></p><ChevronLeft /></button>
}

function Usage({ label, value, total, unlimited = false }: { label: string; value: number; total?: number; unlimited?: boolean }) {
  return <div className="usage-row"><div><span>{label}</span><b>{unlimited ? `${value} · ∞` : `${value} / ${total}`}</b></div><div><i style={{ width: unlimited ? '22%' : `${Math.min(100, value / (total || 1) * 100)}%` }} /></div></div>
}

function PageTitle({ icon, title, text, action }: { icon: ReactNode; title: string; text: string; action?: ReactNode }) {
  return <div className="dashboard-page-title"><div className="page-title-icon">{icon}</div><div><h1>{title}</h1><p>{text}</p></div>{action && <div className="page-title-action">{action}</div>}</div>
}

function Metric({ label, value, green = false, warning = false }: { label: string; value: string | number; green?: boolean; warning?: boolean }) {
  return <div><span>{label}</span><b className={green ? 'green' : warning ? 'warning' : ''}>{value}</b></div>
}

function OrderTable({ orders, ar, money, emptyText, expanded = false }: { orders: StoreOrder[]; ar: boolean; money: (v: number) => string; emptyText: string; expanded?: boolean }) {
  if (!orders.length) return <DashboardEmpty icon={<PackageCheck />} text={emptyText} />
  return <div className={`smart-order-list ${expanded ? 'expanded' : ''}`}>{orders.map((order, index) => <div className="smart-order-row" key={order.id}><div className={`order-customer-avatar c${index % 4}`}>{String(order.customer.name ?? 'C').charAt(0)}</div><p><b>{String(order.customer.name ?? (ar ? 'زبون' : 'Client'))}</b><span dir="ltr">{order.id}</span></p>{expanded && <small dir="ltr">{String(order.customer.phone ?? '—')}</small>}<strong>{money(order.total)}</strong><em>{ar ? 'طلب جديد' : 'Nouvelle'}</em><button><MoreHorizontal /></button></div>)}</div>
}

function DashboardEmpty({ icon, text }: { icon: ReactNode; text: string }) {
  return <div className="smart-empty">{icon}<p>{text}</p></div>
}

function Segment({ color, title, value }: { color: string; title: string; value: number }) {
  return <div className="segment-row"><i className={color} /><p><b>{title}</b><span>Smart segment</span></p><strong>{value}</strong><ChevronLeft /></div>
}

function Extension({ icon, title, status }: { icon: ReactNode; title: string; status: string }) {
  return <div className="extension-card dashboard-card"><div>{icon}</div><p><b>{title}</b><span>{status}</span></p><CircleCheck /></div>
}

function Notification({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return <div className="notification-item"><div>{icon}</div><p><b>{title}</b><span>{text}</span></p><i /></div>
}

function ChevronDownIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6" /></svg>
}

function MessageIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z" /><path d="M8 9h8M8 13h5" /></svg>
}

function AddProductModal({ ar, products, onClose, onAdd }: { ar: boolean; products: DashboardProduct[]; onClose: () => void; onAdd: (product: ProductDraft) => void }) {
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    onAdd({
      name: String(data.get('name')),
      price: Number(data.get('price')),
      category: String(data.get('category')) as ProductDraft['category'],
      image: String(data.get('image')),
    })
  }
  return <div className="dashboard-inner-overlay" onMouseDown={onClose}><form className="add-product-modal" onSubmit={submit} onMouseDown={e => e.stopPropagation()}><div className="add-modal-head"><div><Sparkles /><p><b>{ar ? 'إضافة منتج جديد' : 'Nouveau produit'}</b><span>{ar ? 'يمكنك إضافة عدد غير محدود' : 'Ajoutez des produits sans limites'}</span></p></div><button type="button" onClick={onClose}><X /></button></div><label><span>{ar ? 'اسم المنتج' : 'Nom du produit'}</span><input name="name" required /></label><div className="add-form-grid"><label><span>{ar ? 'السعر (د.ج)' : 'Prix (DA)'}</span><input name="price" type="number" min="0" required /></label><label><span>{ar ? 'القسم' : 'Catégorie'}</span><select name="category"><option value="decor">Décor</option><option value="lighting">Éclairage</option><option value="textiles">Textile</option><option value="fragrance">Parfum</option></select></label></div><label><span>{ar ? 'صورة المنتج المميزة بالشعار' : 'Image produit avec logo'}</span><select name="image">{products.slice(0, 6).map(product => <option key={product.id} value={product.image}>{product.name[ar ? 'ar' : 'fr']}</option>)}</select></label><div className="add-product-note"><ShieldCheck /> {ar ? 'سيُحفظ المنتج مباشرة في كتالوج المتجر.' : 'Le produit sera enregistré dans votre catalogue.'}</div><button className="smart-primary full-add" type="submit"><Plus /> {ar ? 'إضافة المنتج' : 'Ajouter le produit'}</button></form></div>
}
