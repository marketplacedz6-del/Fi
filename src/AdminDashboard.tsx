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
  Clock3,
  CircleCheck,
  ClipboardList,
  Code2,
  Copy,
  Crown,
  Database,
  Download,
  ExternalLink,
  Eye,
  FileSpreadsheet,
  Globe2,
  Grid3X3,
  Headphones,
  ImagePlus,
  KeyRound,
  Languages,
  LayoutDashboard,
  Link2,
  List,
  LogOut,
  Megaphone,
  Menu,
  MoreHorizontal,
  PackageCheck,
  PanelTop,
  Pencil,
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
import StoredImage from './StoredImage'
import { registerRuntimePixel } from './lib/analytics'
import { storeProductImage } from './lib/imageStore'
import type { StoreOrder } from './lib/integrations'

export type DashboardProduct = {
  id: number
  name: { ar: string; fr: string }
  description?: { ar: string; fr: string }
  image: string
  price: number
  oldPrice?: number
  category: string
  rating?: number
  reviews?: number
  stock?: number
  active?: boolean
  images?: string[]
  cost?: number
  sku?: string
  featured?: boolean
  tags?: string[]
}

type ProductDraft = {
  nameAr: string
  nameFr: string
  descriptionAr: string
  price: number
  oldPrice?: number
  stock: number
  active: boolean
  category: 'decor' | 'lighting' | 'textiles' | 'fragrance' | 'tableware' | 'kitchen' | 'organization' | 'gifts'
  image: string
  images: string[]
  cost?: number
  sku?: string
  featured: boolean
  tags: string[]
}

type AdminDashboardProps = {
  lang: 'ar' | 'fr'
  logo: string
  products: DashboardProduct[]
  orders: StoreOrder[]
  cartCount: number
  cartValue: number
  money: (value: number) => string
  onClose: () => void
  onLogout: () => void
  onOpenStore: () => void
  onAddProduct: (product: ProductDraft) => void
  onUpdateProduct: (id: number, product: ProductDraft) => void
  onDuplicateProduct: (id: number) => void
  onDeleteProducts: (ids: number[]) => void
  onSetProductsStatus: (ids: number[], active: boolean) => void
  onRestoreProducts: () => void
}

type Tab = 'overview' | 'products' | 'orders' | 'crm' | 'pages' | 'marketing' | 'integrations' | 'team' | 'settings'
type PixelProvider = 'Meta' | 'TikTok' | 'Google' | 'Pinterest' | 'Snapchat'

type LandingPage = { id: number; title: string; slug: string; published: boolean; views: number }
type Pixel = { id: number; provider: PixelProvider; pixelId: string; active: boolean }
type TeamMember = { id: number; name: string; email: string; role: string; active: boolean }
type Sheet = { id: number; name: string; url: string; active: boolean }
type ManualCustomer = { id: number; name: string; phone: string; email: string }

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

const productSku = (product: DashboardProduct) => product.sku?.trim() || `SKU-${String(product.id).padStart(4, '0')}`

const providerClass: Record<PixelProvider, string> = {
  Meta: 'meta', TikTok: 'tiktok', Google: 'google', Pinterest: 'pinterest', Snapchat: 'snapchat',
}

export default function AdminDashboard({
  lang, logo, products, orders, cartCount, cartValue, money, onClose, onLogout, onOpenStore, onAddProduct, onUpdateProduct, onDuplicateProduct, onDeleteProducts, onSetProductsStatus, onRestoreProducts,
}: AdminDashboardProps) {
  const ar = lang === 'ar'
  const l = (arabic: string, french: string) => ar ? arabic : french
  const categoryNames: Record<string, string> = {
    decor: l('ديكور', 'Décoration'), lighting: l('إضاءة', 'Éclairage'), textiles: l('مفروشات', 'Textile'), fragrance: l('عطور منزلية', 'Parfums'),
    tableware: l('أناقة المائدة', 'Art de table'), kitchen: l('المطبخ', 'Cuisine'), organization: l('تنظيم المنزل', 'Rangement'), gifts: l('هدايا', 'Cadeaux'),
  }
  const [tab, setTab] = useState<Tab>('overview')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [globalSearch, setGlobalSearch] = useState('')
  const [productSearch, setProductSearch] = useState('')
  const [productCategory, setProductCategory] = useState('all')
  const [productStatus, setProductStatus] = useState('all')
  const [productSort, setProductSort] = useState('newest')
  const [productView, setProductView] = useState<'table' | 'grid'>('table')
  const [selectedProductIds, setSelectedProductIds] = useState<number[]>([])
  const [editingProduct, setEditingProduct] = useState<DashboardProduct | null>(null)
  const [orderSearch, setOrderSearch] = useState('')
  const [addProductOpen, setAddProductOpen] = useState(false)
  const [notice, setNotice] = useState('')
  const [pages, setPages] = useState<LandingPage[]>(() => readLocal('ehs-landing-pages', initialPages))
  const [pixels, setPixels] = useState<Pixel[]>(() => readLocal('ehs-dashboard-pixels', []))
  const [team, setTeam] = useState<TeamMember[]>(() => readLocal('ehs-team', initialTeam))
  const [manualCustomers, setManualCustomers] = useState<ManualCustomer[]>(() => readLocal('ehs-manual-customers', []))
  const [crmAddOpen, setCrmAddOpen] = useState(false)
  const [sheets, setSheets] = useState<Sheet[]>(() => readLocal('ehs-sheets', []))
  const [delivery, setDelivery] = useState<Record<string, boolean>>(() => readLocal('ehs-delivery', { Yalidine: true, 'ZR Express': false, Maystro: false, Guepex: false }))
  const [automation, setAutomation] = useState(() => readLocal('ehs-automation', { whatsapp: true, retargeting: true }))
  const [domain, setDomain] = useState(() => readLocalText('ehs-domain'))
  const [apiKey, setApiKey] = useState(() => readLocalText('ehs-api-key', createApiKey()))
  const [showApi, setShowApi] = useState(false)
  const [newPage, setNewPage] = useState('')
  const [previewPage, setPreviewPage] = useState<LandingPage | null>(null)
  const [pixelProvider, setPixelProvider] = useState<PixelProvider>('Meta')
  const [pixelId, setPixelId] = useState('')
  const [sheetName, setSheetName] = useState('')
  const [sheetUrl, setSheetUrl] = useState('')
  const [memberName, setMemberName] = useState('')
  const [memberEmail, setMemberEmail] = useState('')

  useEffect(() => writeLocal('ehs-landing-pages', JSON.stringify(pages)), [pages])
  useEffect(() => writeLocal('ehs-dashboard-pixels', JSON.stringify(pixels)), [pixels])
  useEffect(() => writeLocal('ehs-team', JSON.stringify(team)), [team])
  useEffect(() => writeLocal('ehs-manual-customers', JSON.stringify(manualCustomers)), [manualCustomers])
  useEffect(() => writeLocal('ehs-sheets', JSON.stringify(sheets)), [sheets])
  useEffect(() => writeLocal('ehs-delivery', JSON.stringify(delivery)), [delivery])
  useEffect(() => writeLocal('ehs-automation', JSON.stringify(automation)), [automation])
  useEffect(() => writeLocal('ehs-api-key', apiKey), [apiKey])

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(''), 2800)
    return () => window.clearTimeout(timer)
  }, [notice])

  const revenue = orders.reduce((sum, order) => sum + (Number(order.total) || 0), 0)
  const now = new Date()
  const validOrderDate = (value: string) => {
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? now : parsed
  }
  const dailySales = useMemo(() => Array.from({ length: 7 }, (_, index) => {
    const day = new Date()
    day.setHours(0, 0, 0, 0)
    day.setDate(day.getDate() - (6 - index))
    const next = new Date(day)
    next.setDate(next.getDate() + 1)
    const dayOrders = orders.filter(order => {
      const date = validOrderDate(order.date)
      return date >= day && date < next
    })
    return {
      date: day,
      label: new Intl.DateTimeFormat(ar ? 'ar-DZ' : 'fr-FR', { weekday: 'short' }).format(day),
      orders: dayOrders.length,
      revenue: dayOrders.reduce((sum, order) => sum + (Number(order.total) || 0), 0),
    }
  }), [orders, ar]) // eslint-disable-line react-hooks/exhaustive-deps
  const currentWeekOrders = dailySales.reduce((sum, day) => sum + day.orders, 0)
  const currentWeekRevenue = dailySales.reduce((sum, day) => sum + day.revenue, 0)
  const averageOrder = orders.length ? revenue / orders.length : 0
  const maxDailyRevenue = Math.max(1, ...dailySales.map(day => day.revenue))
  const activePixels = pixels.filter(pixel => pixel.active).length
  const connectedDelivery = Object.values(delivery).filter(Boolean).length
  const publishedPages = pages.filter(page => page.published).length
  const readinessScore = Math.min(100, 72 + (activePixels ? 8 : 0) + (connectedDelivery > 1 ? 6 : 0) + (domain ? 7 : 0) + (sheets.length ? 7 : 0))
  const landingViews = pages.reduce((sum, page) => sum + page.views, 0)
  const conversionRate = landingViews ? orders.length / landingViews * 100 : 0
  const todayLabel = new Intl.DateTimeFormat(ar ? 'ar-DZ' : 'fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }).format(now)
  const globalResults = useMemo(() => {
    const query = globalSearch.trim().toLowerCase()
    if (!query) return []
    const productResults = products.filter(product => `${product.name.ar} ${product.name.fr} ${productSku(product)}`.toLowerCase().includes(query)).map(product => ({ type: 'product' as const, id: String(product.id), label: product.name[lang], detail: productSku(product), tab: 'products' as Tab }))
    const orderResults = orders.filter(order => `${order.id} ${String(order.customer.name ?? '')}`.toLowerCase().includes(query)).map(order => ({ type: 'order' as const, id: order.id, label: String(order.customer.name ?? order.id), detail: order.id, tab: 'orders' as Tab }))
    const pageResults = pages.filter(page => page.title.toLowerCase().includes(query)).map(page => ({ type: 'page' as const, id: String(page.id), label: page.title, detail: `/pages/${page.slug}`, tab: 'pages' as Tab }))
    return [...productResults, ...orderResults, ...pageResults].slice(0, 8)
  }, [globalSearch, products, orders, pages, lang])

  const productSales = useMemo(() => {
    const sold = new Map<number, number>()
    orders.forEach(order => order.items?.forEach(item => sold.set(item.id, (sold.get(item.id) ?? 0) + (Number(item.quantity) || 0))))
    return sold
  }, [orders])

  const topProducts = useMemo(() => products.map(product => ({ ...product, sold: productSales.get(product.id) ?? 0 }))
    .sort((a, b) => b.sold - a.sold || b.price - a.price)
    .slice(0, 4), [products, productSales])

  const customers = useMemo(() => {
    const unique = new Map<string, { name: string; phone: string; orders: number; spent: number }>()
    orders.forEach(order => {
      const phone = String(order.customer.phone ?? order.customer.email ?? order.id)
      const previous = unique.get(phone)
      unique.set(phone, {
        name: String(order.customer.name ?? l('زبون', 'Client')),
        phone,
        orders: (previous?.orders ?? 0) + 1,
        spent: (previous?.spent ?? 0) + (Number(order.total) || 0),
      })
    })
    manualCustomers.forEach(customer => {
      if (!unique.has(customer.phone)) unique.set(customer.phone, { name: customer.name, phone: customer.phone, orders: 0, spent: 0 })
    })
    return Array.from(unique.values())
  }, [orders, manualCustomers, lang]) // eslint-disable-line react-hooks/exhaustive-deps

  const filteredProducts = useMemo(() => {
    const query = productSearch.trim().toLowerCase()
    const result = products.filter(product => {
      const matchesSearch = !query || `${product.name.ar} ${product.name.fr} ${productSku(product)}`.toLowerCase().includes(query)
      const matchesCategory = productCategory === 'all' || product.category === productCategory
      const isActive = product.active !== false
      const stock = product.stock ?? 10
      const matchesStatus = productStatus === 'all' || (productStatus === 'active' && isActive) || (productStatus === 'draft' && !isActive) || (productStatus === 'low' && stock <= 5)
      return matchesSearch && matchesCategory && matchesStatus
    })
    return result.sort((a, b) => {
      if (productSort === 'price-high') return b.price - a.price
      if (productSort === 'price-low') return a.price - b.price
      if (productSort === 'stock-low') return (a.stock ?? 10) - (b.stock ?? 10)
      if (productSort === 'sales') return (productSales.get(b.id) ?? 0) - (productSales.get(a.id) ?? 0)
      return b.id - a.id
    })
  }, [products, productSearch, productCategory, productStatus, productSort, productSales])
  const activeProductCount = products.filter(product => product.active !== false).length
  const lowStockProducts = products.filter(product => (product.stock ?? 10) <= 5)
  const totalInventory = products.reduce((sum, product) => sum + (product.stock ?? 10), 0)
  const inventoryValue = products.reduce((sum, product) => sum + product.price * (product.stock ?? 10), 0)
  const categoryCounts = products.reduce<Record<string, number>>((result, product) => ({ ...result, [product.category]: (result[product.category] ?? 0) + 1 }), {})
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

  const toggleProductSelection = (id: number) => setSelectedProductIds(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id])
  const toggleAllProducts = () => setSelectedProductIds(current => filteredProducts.every(product => current.includes(product.id)) ? current.filter(id => !filteredProducts.some(product => product.id === id)) : [...new Set([...current, ...filteredProducts.map(product => product.id)])])
  const runBulkProductAction = (action: 'activate' | 'draft' | 'delete') => {
    if (!selectedProductIds.length) return
    if (action === 'delete') onDeleteProducts(selectedProductIds)
    else onSetProductsStatus(selectedProductIds, action === 'activate')
    setSelectedProductIds([])
    notify(action === 'delete' ? l('تم حذف المنتجات المحددة', 'Produits supprimés') : l('تم تحديث حالة المنتجات', 'Statut des produits mis à jour'))
  }
  const exportProducts = () => {
    const rows = [['SKU', 'Name AR', 'Name FR', 'Category', 'Price', 'Stock', 'Status'], ...products.map(product => [`${productSku(product)}`, product.name.ar, product.name.fr, product.category, String(product.price), String(product.stock ?? 10), product.active === false ? 'Draft' : 'Active'])]
    const csv = rows.map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'elegance-products.csv'
    anchor.click()
    URL.revokeObjectURL(url)
    notify(l('تم تصدير ملف المنتجات', 'Catalogue exporté'))
  }

  const renderOverview = () => (
    <section className="overview-page">
      <div className="smart-welcome overview-welcome">
        <div>
          <p><Sparkles /> {l('مركز Elegance الذكي', 'Centre intelligent Elegance')}</p>
          <h1>{l('مرحباً وليد، متجرك أمامك بوضوح', 'Bonjour Walid, votre boutique en un coup d’œil')}</h1>
          <span>{l('بيانات حقيقية ومحدّثة من الطلبات والمنتجات والتكاملات المحفوظة.', 'Des données réelles issues de vos commandes, produits et intégrations.')}</span>
          <div className="overview-date"><Clock3 /> {todayLabel}</div>
        </div>
        <div className="store-health">
          <div className="health-ring"><b>{readinessScore}%</b><span>{l('جاهزية', 'Prêt')}</span></div>
          <p><CircleCheck /> {l('المتجر يعمل بصورة طبيعية', 'Boutique opérationnelle')}</p>
        </div>
      </div>

      <div className="smart-stat-grid overview-stats">
        <SmartStat icon={<ShoppingBag />} label={l('المنتجات الحالية', 'Produits actuels')} value={products.length.toString()} trend="∞" color="gold" hint={l('لا يوجد حد أقصى', 'Aucune limite')} />
        <SmartStat icon={<ClipboardList />} label={l('إجمالي الطلبات', 'Total commandes')} value={orders.length.toString()} trend={`+${currentWeekOrders}`} color="blue" hint={l('خلال آخر 7 أيام', 'Sur les 7 derniers jours')} />
        <SmartStat icon={<TrendingUp />} label={l('إجمالي المبيعات', 'Chiffre d’affaires')} value={money(revenue)} trend={money(currentWeekRevenue)} color="green" hint={l('مبيعات حقيقية مسجلة', 'Ventes enregistrées')} />
        <SmartStat icon={<UsersRound />} label={l('عملاء CRM', 'Clients CRM')} value={customers.length.toString()} trend={`${conversionRate.toFixed(1)}%`} color="purple" hint={l('معدل التحويل', 'Taux de conversion')} />
      </div>

      <div className="smart-overview-grid overview-primary-grid">
        <section className="dashboard-card revenue-card upgraded-revenue-card">
          <CardHead title={l('المبيعات خلال آخر 7 أيام', 'Ventes des 7 derniers jours')} subtitle={l('يُحتسب من الطلبات المسجلة فقط', 'Calculé uniquement depuis les commandes')} action={<span className="live-data-pill"><Radio /> LIVE</span>} />
          <div className="revenue-summary enhanced-summary">
            <p><span>{l('مبيعات الفترة', 'Ventes de la période')}</span><b>{money(currentWeekRevenue)}</b></p>
            <div><p><span>{l('متوسط الطلب', 'Panier moyen')}</span><strong>{money(averageOrder)}</strong></p><p><span>{l('عدد الطلبات', 'Commandes')}</span><strong>{currentWeekOrders}</strong></p></div>
          </div>
          <div className={`real-sales-chart ${currentWeekRevenue === 0 ? 'is-empty' : ''}`}>
            <div className="chart-y-axis"><span>{money(maxDailyRevenue)}</span><span>{money(maxDailyRevenue / 2)}</span><span>{money(0)}</span></div>
            <div className="sales-bars">
              {dailySales.map((day, index) => <div className="sales-day" key={day.date.toISOString()} title={`${day.label}: ${money(day.revenue)}`}><div className="bar-track"><span className={index === 6 ? 'today' : ''} style={{ height: `${Math.max(day.revenue ? 8 : 2, day.revenue / maxDailyRevenue * 100)}%` }}><i>{day.orders}</i></span></div><b>{day.label}</b><small>{day.orders}</small></div>)}
            </div>
            {currentWeekRevenue === 0 && <div className="chart-empty-message"><BarChart3 /><p><b>{l('لا توجد مبيعات في هذه الفترة', 'Aucune vente sur cette période')}</b><span>{l('سيظهر الرسم تلقائياً عند وصول أول طلب.', 'Le graphique apparaîtra avec la première commande.')}</span></p></div>}
          </div>
        </section>

        <section className="dashboard-card ai-card upgraded-ai-card">
          <CardHead title={l('مساعد Elegance الذكي', 'Assistant intelligent')} subtitle={l('تحليل مباشر', 'Analyse en direct')} action={<BrainCircuit />} />
          <div className="ai-score"><div><Sparkles /><b>4</b></div><p><strong>{l('إجراءات مقترحة الآن', 'Actions recommandées')}</strong><span>{l('مرتبة حسب تأثيرها على المتجر', 'Classées par impact sur la boutique')}</span></p></div>
          <div className="insight-list">
            <Insight icon={cartCount ? <CircleAlert /> : <CircleCheck />} title={cartCount ? l(`${cartCount} عناصر في سلة غير مكتملة`, `${cartCount} articles dans un panier`) : l('السلات المتروكة تحت السيطرة', 'Paniers abandonnés maîtrisés')} text={cartCount ? l('راجع الاسترداد وارسل تذكيراً للعميل.', 'Activez un rappel de récupération.') : l('لا توجد سلات معلقة في هذا المتصفح.', 'Aucun panier en attente dans ce navigateur.')} action={() => switchTab('marketing')} />
            <Insight icon={<Target />} title={activePixels ? l(`${activePixels} بيكسل نشط`, `${activePixels} pixel(s) actif(s)`) : l('التتبع غير مفعّل', 'Suivi non configuré')} text={activePixels ? l('أحداث المتجر جاهزة للإرسال.', 'Les événements sont prêts à être envoyés.') : l('أضف Meta أو TikTok Pixel لقياس الحملات.', 'Ajoutez Meta ou TikTok Pixel.')} action={() => switchTab('marketing')} />
            <Insight icon={<Truck />} title={connectedDelivery > 1 ? l('التوصيل متعدد الشركات', 'Livraison multi-transporteurs') : l('اربط شركة توصيل ثانية', 'Connectez un second transporteur')} text={l(`${connectedDelivery} شركة متصلة حالياً.`, `${connectedDelivery} transporteur(s) connecté(s).`)} action={() => switchTab('integrations')} />
            <Insight icon={<PanelTop />} title={l(`${publishedPages} صفحات منشورة`, `${publishedPages} pages publiées`)} text={l('أنشئ صفحة عرض مخصصة للحملة القادمة.', 'Créez une page pour votre prochaine campagne.')} action={() => switchTab('pages')} />
          </div>
        </section>
      </div>

      <div className="smart-bottom-grid overview-orders-grid">
        <section className="dashboard-card latest-orders-card">
          <CardHead title={l('أحدث الطلبات', 'Commandes récentes')} subtitle={`${orders.length} ${l('طلب مسجل', 'commande(s) enregistrée(s)')}`} action={<button onClick={() => switchTab('orders')}>{l('إدارة الطلبات', 'Gérer')} {ar ? <ChevronLeft /> : <ChevronRight />}</button>} />
          <OrderTable orders={orders.slice(-4).reverse()} ar={ar} money={money} emptyText={l('لا توجد طلبات بعد. نفّذ طلباً تجريبياً من المتجر لاختبار التدفق.', 'Aucune commande. Passez une commande test depuis la boutique.')} />
        </section>
        <section className="dashboard-card usage-card overview-health-card">
          <CardHead title={l('جاهزية المميزات', 'État des fonctionnalités')} subtitle={`${readinessScore}%`} action={<ShieldCheck />} />
          <ConnectionStatus label={l('التوصيل', 'Livraison')} value={`${connectedDelivery}/4`} active={connectedDelivery > 0} />
          <ConnectionStatus label="Pixels" value={activePixels.toString()} active={activePixels > 0} />
          <ConnectionStatus label="Google Sheets" value={`${sheets.length}/30`} active={sheets.length > 0} />
          <ConnectionStatus label={l('النطاق المخصص', 'Domaine')} value={domain || l('غير مربوط', 'Non connecté')} active={Boolean(domain)} />
        </section>
      </div>

      <div className="overview-detail-grid">
        <section className="dashboard-card funnel-card">
          <CardHead title={l('مسار التحويل', 'Tunnel de conversion')} subtitle={l('من الزيارة إلى الطلب', 'De la visite à la commande')} action={<BarChart3 />} />
          <FunnelStep label={l('مشاهدات صفحات الهبوط', 'Vues des landing pages')} value={landingViews} percent={100} color="navy" />
          <FunnelStep label={l('عناصر في السلة', 'Articles au panier')} value={cartCount} percent={landingViews ? Math.min(100, cartCount / landingViews * 100) : 0} color="gold" />
          <FunnelStep label={l('طلبات مكتملة', 'Commandes finalisées')} value={orders.length} percent={landingViews ? Math.min(100, orders.length / landingViews * 100) : 0} color="green" />
          <div className="conversion-total"><span>{l('معدل التحويل الفعلي', 'Taux de conversion réel')}</span><b>{conversionRate.toFixed(2)}%</b></div>
        </section>

        <section className="dashboard-card top-products-card">
          <CardHead title={l('أفضل المنتجات', 'Meilleurs produits')} subtitle={l('حسب الكمية المباعة', 'Selon les quantités vendues')} action={<button onClick={() => switchTab('products')}>{l('الكتالوج', 'Catalogue')} {ar ? <ChevronLeft /> : <ChevronRight />}</button>} />
          <div className="top-products-list">{topProducts.map((product, index) => <div className="top-product-row" key={product.id}><span>{index + 1}</span><StoredImage src={product.image} alt="" /><p><b>{product.name[lang]}</b><small>{product.sold} {l('مباع', 'vendu(s)')}</small></p><strong>{money(product.price * product.sold)}</strong></div>)}</div>
        </section>

        <section className="dashboard-card quick-center-card">
          <CardHead title={l('إجراءات سريعة', 'Actions rapides')} subtitle={l('اختصارات الإدارة', 'Raccourcis')} action={<Zap />} />
          <div className="overview-actions">
            <OverviewAction icon={<Plus />} label={l('إضافة منتج', 'Ajouter produit')} onClick={() => { switchTab('products'); setAddProductOpen(true) }} />
            <OverviewAction icon={<PackageCheck />} label={l('عرض الطلبات', 'Voir commandes')} onClick={() => switchTab('orders')} />
            <OverviewAction icon={<PanelTop />} label={l('صفحة هبوط', 'Landing page')} onClick={() => switchTab('pages')} />
            <OverviewAction icon={<Target />} label={l('إضافة Pixel', 'Ajouter Pixel')} onClick={() => switchTab('marketing')} />
          </div>
          <button className="overview-support-button" onClick={() => window.open('https://wa.me/213555000000', '_blank')}><Headphones /><p><b>{l('الدعم المباشر متاح', 'Support direct disponible')}</b><span>24/7 · Online</span></p><ExternalLink /></button>
        </section>
      </div>
    </section>
  )

  const renderProducts = () => (
    <section className="dashboard-page products-workspace">
      <PageTitle icon={<ShoppingBag />} title={l('مركز إدارة المنتجات', 'Centre de gestion des produits')} text={l('تحكم في الكتالوج، المخزون، الأسعار، النشر والأداء من مكان واحد.', 'Gérez catalogue, stock, prix, publication et performances en un seul endroit.')} action={<div className="page-action-buttons product-page-actions"><button className="smart-secondary" onClick={exportProducts}><Download /> {l('تصدير CSV', 'Exporter CSV')}</button><button className="smart-secondary" onClick={() => { onRestoreProducts(); setSelectedProductIds([]); notify(l('تمت استعادة المنتجات الأصلية', 'Produits d’origine restaurés')) }}><RefreshCw /> {l('استعادة', 'Restaurer')}</button><button className="smart-primary" onClick={() => { setEditingProduct(null); setAddProductOpen(true) }}><Plus /> {l('منتج جديد', 'Nouveau produit')}</button></div>} />

      <div className="product-kpi-grid">
        <ProductKpi icon={<ShoppingBag />} label={l('كل المنتجات', 'Tous les produits')} value={products.length.toString()} detail={l('غير محدود', 'Illimité')} color="navy" />
        <ProductKpi icon={<CircleCheck />} label={l('منشور في المتجر', 'Produits actifs')} value={activeProductCount.toString()} detail={`${Math.round(activeProductCount / Math.max(1, products.length) * 100)}%`} color="green" />
        <ProductKpi icon={<CircleAlert />} label={l('مخزون منخفض', 'Stock faible')} value={lowStockProducts.length.toString()} detail={l('5 قطع أو أقل', '5 unités ou moins')} color="orange" />
        <ProductKpi icon={<Boxes />} label={l('إجمالي المخزون', 'Stock total')} value={totalInventory.toString()} detail={money(inventoryValue)} color="gold" />
      </div>

      <div className="dashboard-card product-control-panel">
        <div className="product-toolbar-advanced">
          <label className="product-admin-search"><Search /><input value={productSearch} onChange={event => setProductSearch(event.target.value)} placeholder={l('ابحث بالاسم أو SKU...', 'Rechercher par nom ou SKU...')} />{productSearch && <button onClick={() => setProductSearch('')}><X /></button>}</label>
          <select value={productCategory} onChange={event => setProductCategory(event.target.value)}><option value="all">{l('كل الأقسام', 'Toutes catégories')}</option><option value="decor">{l('ديكور', 'Décoration')}</option><option value="lighting">{l('إضاءة', 'Éclairage')}</option><option value="textiles">{l('مفروشات', 'Textile')}</option><option value="fragrance">{l('عطور منزلية', 'Parfums')}</option><option value="tableware">{l('أناقة المائدة', 'Art de table')}</option><option value="kitchen">{l('المطبخ', 'Cuisine')}</option><option value="organization">{l('تنظيم المنزل', 'Rangement')}</option><option value="gifts">{l('هدايا', 'Cadeaux')}</option></select>
          <select value={productStatus} onChange={event => setProductStatus(event.target.value)}><option value="all">{l('كل الحالات', 'Tous les statuts')}</option><option value="active">{l('منشور', 'Actif')}</option><option value="draft">{l('مسودة', 'Brouillon')}</option><option value="low">{l('مخزون منخفض', 'Stock faible')}</option></select>
          <select value={productSort} onChange={event => setProductSort(event.target.value)}><option value="newest">{l('الأحدث أولاً', 'Plus récents')}</option><option value="sales">{l('الأكثر مبيعاً', 'Meilleures ventes')}</option><option value="price-high">{l('السعر: الأعلى', 'Prix décroissant')}</option><option value="price-low">{l('السعر: الأقل', 'Prix croissant')}</option><option value="stock-low">{l('المخزون: الأقل', 'Stock croissant')}</option></select>
          <div className="product-view-switch"><button className={productView === 'table' ? 'active' : ''} onClick={() => setProductView('table')} title={l('جدول', 'Tableau')}><List /></button><button className={productView === 'grid' ? 'active' : ''} onClick={() => setProductView('grid')} title={l('شبكة', 'Grille')}><Grid3X3 /></button></div>
        </div>

        <div className="product-results-head"><p><b>{filteredProducts.length}</b> {l('منتج ظاهر', 'produit(s) affiché(s)')}<span>·</span>{l('العدد الحالي وليس الحد الأقصى', 'Total actuel, aucune limite')}</p>{(productSearch || productCategory !== 'all' || productStatus !== 'all') && <button onClick={() => { setProductSearch(''); setProductCategory('all'); setProductStatus('all') }}><RefreshCw /> {l('مسح الفلاتر', 'Réinitialiser')}</button>}</div>

        {selectedProductIds.length > 0 && <div className="product-bulk-bar"><div><Check /><b>{selectedProductIds.length}</b><span>{l('منتج محدد', 'produit(s) sélectionné(s)')}</span></div><button onClick={() => runBulkProductAction('activate')}><CircleCheck /> {l('نشر', 'Activer')}</button><button onClick={() => runBulkProductAction('draft')}><Eye /> {l('تحويل لمسودة', 'Brouillon')}</button><button className="danger" onClick={() => runBulkProductAction('delete')}><Trash2 /> {l('حذف', 'Supprimer')}</button><button className="bulk-close" onClick={() => setSelectedProductIds([])}><X /></button></div>}

        {productView === 'table' ? <div className="advanced-product-table">
          <div className="advanced-product-header"><label><input type="checkbox" checked={filteredProducts.length > 0 && filteredProducts.every(product => selectedProductIds.includes(product.id))} onChange={toggleAllProducts} /><i /></label><span>{l('المنتج', 'Produit')}</span><span>SKU</span><span>{l('المخزون', 'Stock')}</span><span>{l('السعر', 'Prix')}</span><span>{l('المبيعات', 'Ventes')}</span><span>{l('الحالة', 'Statut')}</span><span>{l('إجراءات', 'Actions')}</span></div>
          {filteredProducts.length ? filteredProducts.map(product => {
            const stock = product.stock ?? 10
            const sold = productSales.get(product.id) ?? 0
            const active = product.active !== false
            return <div className={`advanced-product-row ${selectedProductIds.includes(product.id) ? 'selected' : ''}`} key={product.id}>
              <label className="product-check"><input type="checkbox" checked={selectedProductIds.includes(product.id)} onChange={() => toggleProductSelection(product.id)} /><i /></label>
              <div className="advanced-product-identity"><StoredImage src={product.image} alt="" /><div><b>{product.name[lang]}</b><span>{product.name[ar ? 'fr' : 'ar']}</span><em>{categoryNames[product.category] ?? product.category}</em></div></div>
              <code>{productSku(product)}</code>
              <div className={`stock-cell ${stock <= 5 ? 'low' : ''}`}><div><b>{stock}</b><span>{stock <= 5 ? l('منخفض', 'Faible') : l('متوفر', 'En stock')}</span></div><i><span style={{ width: `${Math.min(100, stock / 25 * 100)}%` }} /></i></div>
              <div className="price-cell"><b>{money(product.price)}</b>{product.oldPrice && <del>{money(product.oldPrice)}</del>}{product.cost && <small>{Math.round((product.price - product.cost) / Math.max(1, product.price) * 100)}% {l('هامش', 'marge')}</small>}</div>
              <div className="sales-cell"><b>{sold}</b><span>{money(sold * product.price)}</span></div>
              <button className={`product-status-pill ${active ? 'active' : 'draft'}`} onClick={() => onSetProductsStatus([product.id], !active)}><i />{active ? l('منشور', 'Actif') : l('مسودة', 'Brouillon')}</button>
              <div className="product-row-actions"><button onClick={() => { setEditingProduct(product); setAddProductOpen(true) }} title={l('تعديل', 'Modifier')}><Pencil /></button><button onClick={() => onDuplicateProduct(product.id)} title={l('نسخ', 'Dupliquer')}><Copy /></button><button className="delete" onClick={() => onDeleteProducts([product.id])} title={l('حذف', 'Supprimer')}><Trash2 /></button></div>
            </div>
          }) : <DashboardEmpty icon={<Search />} text={l('لا توجد منتجات مطابقة. غيّر الفلاتر أو أضف منتجاً جديداً.', 'Aucun produit correspondant. Modifiez les filtres ou ajoutez un produit.')} />}
        </div> : <div className="admin-product-grid">{filteredProducts.length ? filteredProducts.map(product => {
          const active = product.active !== false
          const stock = product.stock ?? 10
          const sold = productSales.get(product.id) ?? 0
          return <article className={`admin-product-card ${selectedProductIds.includes(product.id) ? 'selected' : ''}`} key={product.id}><div className="admin-product-card-image"><StoredImage src={product.image} alt="" /><label className="product-check"><input type="checkbox" checked={selectedProductIds.includes(product.id)} onChange={() => toggleProductSelection(product.id)} /><i /></label><span className={active ? 'active' : 'draft'}>{active ? l('منشور', 'Actif') : l('مسودة', 'Brouillon')}</span><em className="image-count-badge"><ImagePlus />{product.images?.length || 1}</em><div><button onClick={() => { setEditingProduct(product); setAddProductOpen(true) }}><Pencil /></button><button onClick={() => onDuplicateProduct(product.id)}><Copy /></button></div></div><div className="admin-product-card-copy"><small>{categoryNames[product.category] ?? product.category} · {productSku(product)}</small><h3>{product.name[lang]}</h3><div><p><b>{money(product.price)}</b>{product.oldPrice && <del>{money(product.oldPrice)}</del>}</p><span className={stock <= 5 ? 'low' : ''}>{stock} {l('في المخزون', 'en stock')}</span></div><footer><span><TrendingUp /> {sold} {l('مباع', 'vendu')}</span><button onClick={() => onSetProductsStatus([product.id], !active)}>{active ? l('إيقاف', 'Désactiver') : l('نشر', 'Publier')}</button></footer></div></article>
        }) : <DashboardEmpty icon={<Search />} text={l('لا توجد منتجات مطابقة.', 'Aucun produit correspondant.')} />}</div>}
      </div>

      <div className="product-insights-grid">
        <section className="dashboard-card category-insight-card"><CardHead title={l('توزيع الكتالوج', 'Répartition du catalogue')} subtitle={`${products.length} ${l('منتج', 'produits')}`} action={<BarChart3 />} /><div className="category-bars">{[['decor', l('ديكور', 'Décoration'), 'gold'], ['lighting', l('إضاءة', 'Éclairage'), 'blue'], ['textiles', l('مفروشات', 'Textile'), 'purple'], ['fragrance', l('عطور', 'Parfums'), 'green'], ['tableware', l('أناقة المائدة', 'Art de table'), 'gold'], ['kitchen', l('المطبخ', 'Cuisine'), 'blue'], ['organization', l('تنظيم المنزل', 'Rangement'), 'purple'], ['gifts', l('هدايا', 'Cadeaux'), 'green']].map(([key, label, color]) => <div key={key}><p><span><i className={color} />{label}</span><b>{categoryCounts[key] ?? 0}</b></p><div><i className={color} style={{ width: `${(categoryCounts[key] ?? 0) / Math.max(1, products.length) * 100}%` }} /></div></div>)}</div></section>
        <section className="dashboard-card inventory-alert-card"><CardHead title={l('تنبيهات المخزون', 'Alertes de stock')} subtitle={`${lowStockProducts.length} ${l('تحتاج متابعة', 'à surveiller')}`} action={<CircleAlert />} />{lowStockProducts.length ? <div>{lowStockProducts.slice(0, 4).map(product => <button key={product.id} onClick={() => { setEditingProduct(product); setAddProductOpen(true) }}><StoredImage src={product.image} alt="" /><p><b>{product.name[lang]}</b><span>{productSku(product)}</span></p><em>{product.stock ?? 10} {l('متبقي', 'restant')}</em><ChevronLeft /></button>)}</div> : <DashboardEmpty icon={<CircleCheck />} text={l('المخزون في حالة ممتازة.', 'Le stock est en excellent état.')} />}</section>
        <section className="dashboard-card product-performance-card"><CardHead title={l('أداء المنتجات', 'Performance produits')} subtitle={l('من الطلبات الحقيقية', 'Selon les commandes')} action={<TrendingUp />} /><div className="performance-highlight"><div><Sparkles /><b>{topProducts[0]?.name[lang] ?? '—'}</b><span>{l('المنتج الأعلى أداءً', 'Produit le plus performant')}</span></div><strong>{productSales.get(topProducts[0]?.id ?? -1) ?? 0}<small>{l('مباع', 'vendu')}</small></strong></div><div className="performance-stats"><p><span>{l('قيمة المخزون', 'Valeur du stock')}</span><b>{money(inventoryValue)}</b></p><p><span>{l('متوسط السعر', 'Prix moyen')}</span><b>{money(products.length ? products.reduce((sum, product) => sum + product.price, 0) / products.length : 0)}</b></p></div></section>
      </div>
    </section>
  )

  const renderOrders = () => (
    <section className="dashboard-page">
      <PageTitle icon={<PackageCheck />} title={l('إدارة الطلبات', 'Gestion des commandes')} text={l('طلبات غير محدودة ومتابعة كاملة من التأكيد حتى التسليم.', 'Commandes illimitées, du suivi à la livraison.')} />
      <div className="metric-strip"><Metric label={l('كل الطلبات', 'Toutes')} value={orders.length} /><Metric label={l('جديدة', 'Nouvelles')} value={orders.length} warning /><Metric label={l('قيد التوصيل', 'En livraison')} value={0} /><Metric label={l('الإيرادات', 'Revenus')} value={money(revenue)} green /></div>
      <div className="dashboard-card data-card">
        <div className="table-tools"><label><Search /><input value={orderSearch} onChange={e => setOrderSearch(e.target.value)} placeholder={l('رقم الطلب، الزبون أو الهاتف...', 'Commande, client ou téléphone...')} /></label><button className="smart-secondary" onClick={() => notify(l('الطلبات محدثة الآن', 'Commandes actualisées'))}><RefreshCw /> {l('تحديث', 'Actualiser')}</button></div>
        <OrderTable orders={filteredOrders.slice().reverse()} ar={ar} money={money} emptyText={l('لا توجد طلبات مطابقة.', 'Aucune commande correspondante.')} expanded />
      </div>
    </section>
  )

  const renderCrm = () => (
    <section className="dashboard-page">
      <PageTitle icon={<UsersRound />} title={l('CRM العملاء الذكي', 'CRM clients intelligent')} text={l('ملف موحد لكل عميل مع سجل الطلبات وقيمة العميل.', 'Une fiche unifiée par client avec historique et valeur.')} action={<button className="smart-primary" onClick={() => setCrmAddOpen(true)}><Plus /> {l('عميل جديد', 'Nouveau client')}</button>} />
      <div className="metric-strip"><Metric label={l('إجمالي العملاء', 'Total clients')} value={customers.length} /><Metric label={l('عملاء متكررون', 'Fidèles')} value={customers.filter(c => c.orders > 1).length} green /><Metric label={l('متوسط القيمة', 'Panier moyen')} value={money(customers.length ? revenue / customers.length : 0)} /><Metric label={l('شرائح ذكية', 'Segments')} value={4} /></div>
      <div className="crm-layout">
        <div className="dashboard-card crm-list"><CardHead title={l('قاعدة العملاء', 'Base clients')} subtitle={l('تتحدث تلقائياً', 'Mise à jour automatique')} />{customers.length ? customers.map((customer, index) => <div className="customer-row" key={customer.phone}><div className={`customer-avatar c${index % 4}`}>{customer.name.charAt(0)}</div><p><b>{customer.name}</b><span dir="ltr">{customer.phone}</span></p><small>{customer.orders} {l('طلبات', 'cmd.')}</small><strong>{money(customer.spent)}</strong><button onClick={() => notify(`${customer.name} · ${customer.phone} · ${money(customer.spent)}`)}><MoreHorizontal /></button></div>) : <DashboardEmpty icon={<UsersRound />} text={l('سيتم إنشاء ملفات العملاء تلقائياً مع أول طلب.', 'Les profils clients seront créés avec la première commande.')} />}</div>
        <div className="dashboard-card crm-segments"><CardHead title={l('شرائح ذكية', 'Segments intelligents')} subtitle="CRM" /><Segment color="gold" title={l('عملاء VIP', 'Clients VIP')} value={customers.filter(c => c.spent >= 15000).length} /><Segment color="green" title={l('عملاء متكررون', 'Clients fidèles')} value={customers.filter(c => c.orders > 1).length} /><Segment color="blue" title={l('عملاء جدد', 'Nouveaux clients')} value={customers.length} /><Segment color="rose" title={l('بحاجة لإعادة تفاعل', 'À réactiver')} value={0} /></div>
      </div>
    </section>
  )

  const renderPages = () => (
    <section className="dashboard-page">
      <PageTitle icon={<PanelTop />} title={l('صفحات الهبوط', 'Landing pages')} text={l('أنشئ صفحات حملات غير محدودة بدون كود.', 'Créez des pages de campagne illimitées, sans code.')} />
      <form className="inline-creator" onSubmit={addLandingPage}><div><WandSparkles /><input value={newPage} onChange={e => setNewPage(e.target.value)} placeholder={l('اسم الصفحة الجديدة...', 'Nom de la nouvelle page...')} /></div><button className="smart-primary"><Plus /> {l('إنشاء الصفحة', 'Créer la page')}</button></form>
      <div className="landing-grid">
        {pages.map(page => <article className="landing-card dashboard-card" key={page.id}><div className="landing-preview"><div className="preview-browser"><i /><i /><i /></div><PanelTop /><span>{page.title}</span></div><div className="landing-info"><div><em className={page.published ? 'published' : 'draft'}>{page.published ? l('منشورة', 'Publiée') : l('مسودة', 'Brouillon')}</em><h3>{page.title}</h3><p dir="ltr">/pages/{page.slug}</p></div><button onClick={() => setPreviewPage(page)} title={l('معاينة', 'Aperçu')}><Eye /></button></div><div className="landing-stats"><span><Eye /> {page.views}</span><button onClick={() => setPages(current => current.map(item => item.id === page.id ? { ...item, published: !item.published } : item))}>{page.published ? l('إيقاف', 'Dépublier') : l('نشر', 'Publier')}</button><button onClick={() => setPages(current => current.filter(item => item.id !== page.id))}><Trash2 /></button></div></article>)}
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
        <div className="dashboard-card recovery-card"><CardHead title={l('استرداد السلات المتروكة', 'Paniers abandonnés')} subtitle={l('أتمتة ذكية', 'Automatisation')} action={<Zap />} /><div className="recovery-visual"><div className="recovery-ring"><b>{cartCount}</b><span>{l('عنصر', 'article(s)')}</span></div><p>{l('قيمة قابلة للاسترداد', 'Valeur récupérable')}<strong>{money(cartValue)}</strong></p></div><div className="automation-row"><div><MessageIcon /><p><b>WhatsApp</b><span>{l('بعد 30 دقيقة', 'Après 30 min')}</span></p></div><button className={`smart-toggle ${automation.whatsapp ? 'on' : ''}`} onClick={() => setAutomation(current => ({ ...current, whatsapp: !current.whatsapp }))}><i /></button></div><div className="automation-row"><div><Megaphone /><p><b>{l('إعلان إعادة الاستهداف', 'Retargeting')}</b><span>Meta + TikTok</span></p></div><button className={`smart-toggle ${automation.retargeting ? 'on' : ''}`} onClick={() => setAutomation(current => ({ ...current, retargeting: !current.retargeting }))}><i /></button></div></div>
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
        <div className="plan-badge"><Crown /><div><b>Elite · Local Mode</b><span>{l('البيانات محفوظة على هذا الجهاز', 'Données enregistrées sur cet appareil')}</span></div><CircleCheck /></div>
        <nav>{navGroups.map(group => <div className="nav-group" key={group.label}><p>{group.label}</p>{group.items.map(item => <button key={item.id} className={tab === item.id ? 'active' : ''} onClick={() => switchTab(item.id)}>{item.icon}<span>{item.label}</span>{item.badge !== undefined && <em>{item.badge}</em>}</button>)}</div>)}</nav>
        <button className="smart-support" onClick={() => window.open('https://wa.me/213555000000', '_blank')}><Headphones /><div><b>{l('دعم مباشر', 'Support direct')}</b><span>24/7 · Online</span></div><i /></button>
        <button className="smart-logout" onClick={onLogout}><LogOut /> {l('تسجيل الخروج', 'Déconnexion')}</button>
      </aside>
      {sidebarOpen && <div className="sidebar-scrim" onClick={() => setSidebarOpen(false)} />}

      <main className="smart-main">
        <header className="smart-topbar">
          <div className="topbar-start"><button className="dashboard-menu" onClick={() => setSidebarOpen(true)}><Menu /></button><div className="global-search"><Search /><input value={globalSearch} onChange={event => setGlobalSearch(event.target.value)} placeholder={l('ابحث في المنتجات والطلبات والصفحات...', 'Rechercher produits, commandes et pages...')} />{globalSearch ? <button onClick={() => setGlobalSearch('')}><X /></button> : <kbd>⌘ K</kbd>}{globalSearch && <div className="global-search-results">{globalResults.length ? globalResults.map(result => <button key={`${result.type}-${result.id}`} onClick={() => { setTab(result.tab); if (result.type === 'product') setProductSearch(result.label); if (result.type === 'order') setOrderSearch(result.detail); setGlobalSearch('') }}><div>{result.type === 'product' ? <ShoppingBag /> : result.type === 'order' ? <PackageCheck /> : <PanelTop />}</div><p><b>{result.label}</b><span dir="ltr">{result.detail}</span></p><ChevronLeft /></button>) : <span>{l('لا توجد نتائج', 'Aucun résultat')}</span>}</div>}</div></div>
          <div className="topbar-actions">
            <button className="visit-store" onClick={onOpenStore}><Store /> {l('عرض المتجر', 'Voir la boutique')} <ExternalLink /></button>
            <div className="notification-wrap"><button className="notification-button" onClick={() => setNotificationsOpen(value => !value)}><Bell /><i>3</i></button>{notificationsOpen && <div className="notification-popover"><h3>{l('الإشعارات', 'Notifications')} <span>3</span></h3><Notification icon={<PackageCheck />} title={l('طلب جديد', 'Nouvelle commande')} text={l('تم تسجيل طلب جديد في المتجر.', 'Une commande a été enregistrée.')} /><Notification icon={<CircleAlert />} title={l('تنبيه ذكي', 'Alerte intelligente')} text={l('اربط شركة توصيل ثانية لتحسين الأداء.', 'Connectez un second transporteur.')} /><Notification icon={<ShieldCheck />} title="SLA 99.9%" text={l('جميع الأنظمة تعمل بشكل طبيعي.', 'Tous les systèmes sont opérationnels.')} /></div>}</div>
            <div className="admin-profile"><div>W</div><p><b>Walid</b><span>{l('مالك المتجر', 'Propriétaire')}</span></p><ChevronDownIcon /></div>
            <button className="dashboard-close" onClick={onClose}><X /></button>
          </div>
        </header>
        <div className="smart-scroll">{tabContent[tab]()}</div>
      </main>

      {addProductOpen && <ProductEditorModal ar={ar} logo={logo} products={products} product={editingProduct} onClose={() => { setAddProductOpen(false); setEditingProduct(null) }} onSave={draft => { if (editingProduct) onUpdateProduct(editingProduct.id, draft); else onAddProduct(draft); setAddProductOpen(false); setEditingProduct(null); notify(editingProduct ? l('تم تحديث المنتج بنجاح', 'Produit mis à jour') : l('تمت إضافة المنتج بنجاح', 'Produit ajouté avec succès')) }} />}
      {previewPage && <div className="dashboard-inner-overlay" onMouseDown={() => setPreviewPage(null)}><div className="landing-preview-modal" onMouseDown={event => event.stopPropagation()}><button onClick={() => setPreviewPage(null)}><X /></button><img src={logo} alt="" /><span>{previewPage.published ? l('صفحة منشورة', 'Page publiée') : l('معاينة المسودة', 'Aperçu du brouillon')}</span><h2>{previewPage.title}</h2><p>{l('صفحة هبوط أنيقة لعرض مجموعتك ومنتجاتك، مع زر طلب مباشر وتوصيل إلى 58 ولاية.', 'Une landing page élégante avec commande directe et livraison nationale.')}</p><div><Sparkles /><b>Elegance Home & Style</b><small dir="ltr">/pages/{previewPage.slug}</small></div><button className="smart-primary" onClick={() => { void navigator.clipboard?.writeText(`${location.origin}${location.pathname}#page-${previewPage.slug}`); notify(l('تم نسخ رابط الصفحة', 'Lien de la page copié')) }}><Copy /> {l('نسخ الرابط', 'Copier le lien')}</button></div></div>}
      {crmAddOpen && <div className="dashboard-inner-overlay" onMouseDown={() => setCrmAddOpen(false)}><form className="simple-dashboard-modal" onMouseDown={event => event.stopPropagation()} onSubmit={event => { event.preventDefault(); const data = new FormData(event.currentTarget); setManualCustomers(current => [...current, { id: Date.now(), name: String(data.get('name')), phone: String(data.get('phone')), email: String(data.get('email')) }]); setCrmAddOpen(false); notify(l('تمت إضافة العميل إلى CRM', 'Client ajouté au CRM')) }}><div className="add-modal-head"><div><UsersRound /><p><b>{l('إضافة عميل جديد', 'Nouveau client')}</b><span>CRM</span></p></div><button type="button" onClick={() => setCrmAddOpen(false)}><X /></button></div><label><span>{l('الاسم الكامل', 'Nom complet')}</span><input name="name" required /></label><label><span>{l('رقم الهاتف', 'Téléphone')}</span><input name="phone" required dir="ltr" /></label><label><span>{l('البريد الإلكتروني', 'E-mail')}</span><input name="email" type="email" dir="ltr" /></label><button className="smart-primary" type="submit"><Plus /> {l('حفظ العميل', 'Enregistrer')}</button></form></div>}
      {notice && <div className="dashboard-toast"><CircleCheck /> {notice}</div>}
    </div>
  )
}

function ProductKpi({ icon, label, value, detail, color }: { icon: ReactNode; label: string; value: string; detail: string; color: string }) {
  return <article className="product-kpi dashboard-card"><div className={color}>{icon}</div><p><span>{label}</span><b>{value}</b><small>{detail}</small></p></article>
}

function ConnectionStatus({ label, value, active }: { label: string; value: string; active: boolean }) {
  return <div className="connection-status"><div><i className={active ? 'active' : ''} /><span>{label}</span></div><b title={value}>{value}</b><em className={active ? 'active' : ''}>{active ? <CircleCheck /> : <CircleAlert />}</em></div>
}

function FunnelStep({ label, value, percent, color }: { label: string; value: number; percent: number; color: string }) {
  return <div className="funnel-step"><div><span>{label}</span><b>{new Intl.NumberFormat('fr-DZ').format(value)}</b></div><div><i className={color} style={{ width: `${Math.max(value ? 5 : 0, percent)}%` }} /></div></div>
}

function OverviewAction({ icon, label, onClick }: { icon: ReactNode; label: string; onClick: () => void }) {
  return <button className="overview-action" onClick={onClick}><div>{icon}</div><span>{label}</span><ChevronLeft /></button>
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
  return <div className={`smart-order-list ${expanded ? 'expanded' : ''}`}>{orders.map((order, index) => <div className="smart-order-row" key={order.id}><div className={`order-customer-avatar c${index % 4}`}>{String(order.customer.name ?? 'C').charAt(0)}</div><p><b>{String(order.customer.name ?? (ar ? 'زبون' : 'Client'))}</b><span dir="ltr">{order.id}</span></p>{expanded && <small dir="ltr">{String(order.customer.phone ?? '—')}</small>}<strong>{money(order.total)}</strong><em>{ar ? 'طلب جديد' : 'Nouvelle'}</em><span className="order-row-menu"><MoreHorizontal /></span></div>)}</div>
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

function ProductEditorModal({ ar, logo, products, product, onClose, onSave }: { ar: boolean; logo: string; products: DashboardProduct[]; product: DashboardProduct | null; onClose: () => void; onSave: (product: ProductDraft) => void }) {
  const initialGallery = product?.images?.length ? product.images : product?.image ? [product.image] : products[0]?.image ? [products[0].image] : []
  const [gallery, setGallery] = useState<string[]>(initialGallery)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [remoteImage, setRemoteImage] = useState('')

  const uploadFiles = async (files: File[] | FileList) => {
    const accepted = Array.from(files).filter(file => file.type.startsWith('image/')).slice(0, Math.max(0, 8 - gallery.length))
    if (!accepted.length) return
    setUploading(true)
    setUploadError('')
    try {
      const stored = await Promise.all(accepted.map(file => storeProductImage(file, logo)))
      setGallery(current => [...current, ...stored].slice(0, 8))
    } catch {
      setUploadError(ar ? 'تعذر معالجة إحدى الصور. استخدم JPG أو PNG أصغر من 15MB.' : 'Impossible de traiter une image. Utilisez JPG ou PNG de moins de 15 Mo.')
    } finally {
      setUploading(false)
    }
  }

  const removeImage = (source: string) => {
    setGallery(current => current.filter(image => image !== source))
  }

  const makePrimary = (source: string) => setGallery(current => [source, ...current.filter(image => image !== source)])

  const addRemoteImage = () => {
    const source = remoteImage.trim()
    if (!/^https?:\/\//i.test(source) || gallery.length >= 8) {
      setUploadError(ar ? 'أدخل رابط صورة صحيح يبدأ بـ https://.' : 'Saisissez une URL valide commençant par https://.')
      return
    }
    setGallery(current => [...current, source])
    setRemoteImage('')
    setUploadError('')
  }

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const oldPrice = Number(data.get('oldPrice'))
    onSave({
      nameAr: String(data.get('nameAr')).trim(),
      nameFr: String(data.get('nameFr')).trim() || String(data.get('nameAr')).trim(),
      descriptionAr: String(data.get('descriptionAr')).trim(),
      price: Number(data.get('price')),
      oldPrice: oldPrice > 0 ? oldPrice : undefined,
      stock: Math.max(0, Number(data.get('stock')) || 0),
      active: String(data.get('status')) === 'active',
      category: String(data.get('category')) as ProductDraft['category'],
      image: gallery[0] || products[0]?.image || '',
      images: gallery,
      cost: Number(data.get('cost')) > 0 ? Number(data.get('cost')) : undefined,
      sku: String(data.get('sku')).trim() || undefined,
      featured: data.get('featured') === 'on',
      tags: String(data.get('tags')).split(',').map(tag => tag.trim()).filter(Boolean),
    })
  }
  const imageChoices = Array.from(new Map(products.map(item => [item.image, item])).values())
  return <div className="dashboard-inner-overlay product-editor-overlay" onMouseDown={onClose}>
    <form className="add-product-modal product-editor-modal" onSubmit={submit} onMouseDown={event => event.stopPropagation()}>
      <div className="add-modal-head"><div><Sparkles /><p><b>{product ? (ar ? 'تعديل المنتج' : 'Modifier le produit') : (ar ? 'إضافة منتج جديد' : 'Nouveau produit')}</b><span>{ar ? 'البيانات تظهر مباشرة في كتالوج المتجر' : 'Les changements apparaissent dans le catalogue'}</span></p></div><button type="button" onClick={onClose}><X /></button></div>
      <div className="editor-form-scroll">
        <div className="editor-section-title"><span>01</span><p><b>{ar ? 'المعلومات الأساسية' : 'Informations principales'}</b><small>{ar ? 'اسم المنتج ووصفه' : 'Nom et description'}</small></p></div>
        <div className="add-form-grid"><label><span>{ar ? 'اسم المنتج بالعربية' : 'Nom en arabe'}</span><input name="nameAr" defaultValue={product?.name.ar ?? ''} required dir="rtl" /></label><label><span>{ar ? 'الاسم بالفرنسية' : 'Nom en français'}</span><input name="nameFr" defaultValue={product?.name.fr ?? ''} dir="ltr" /></label></div>
        <label><span>{ar ? 'وصف مختصر' : 'Description courte'}</span><textarea name="descriptionAr" defaultValue={product?.description?.ar ?? ''} rows={3} /></label>
        <div className="editor-section-title"><span>02</span><p><b>{ar ? 'السعر والمخزون' : 'Prix et stock'}</b><small>{ar ? 'تحكم في التسعير والتوفر' : 'Tarification et disponibilité'}</small></p></div>
        <div className="editor-three-grid"><label><span>{ar ? 'السعر (د.ج)' : 'Prix (DA)'}</span><input name="price" type="number" min="0" defaultValue={product?.price ?? ''} required /></label><label><span>{ar ? 'السعر قبل التخفيض' : 'Prix barré'}</span><input name="oldPrice" type="number" min="0" defaultValue={product?.oldPrice ?? ''} /></label><label><span>{ar ? 'كمية المخزون' : 'Stock'}</span><input name="stock" type="number" min="0" defaultValue={product?.stock ?? 10} required /></label></div>
        <div className="editor-three-grid"><label><span>{ar ? 'تكلفة المنتج' : 'Coût du produit'}</span><input name="cost" type="number" min="0" defaultValue={product?.cost ?? ''} /></label><label><span>SKU</span><input name="sku" defaultValue={product?.sku ?? ''} placeholder="EHS-0001" dir="ltr" /></label><label><span>{ar ? 'الوسوم — بفاصلة' : 'Tags — séparés par virgule'}</span><input name="tags" defaultValue={product?.tags?.join(', ') ?? ''} placeholder={ar ? 'جديد، فاخر' : 'nouveau, luxe'} /></label></div>
        <div className="editor-section-title"><span>03</span><p><b>{ar ? 'التصنيف والنشر' : 'Classement et publication'}</b><small>{ar ? 'حدد مكان ظهور المنتج' : 'Choisissez où afficher le produit'}</small></p></div>
        <div className="add-form-grid"><label><span>{ar ? 'القسم' : 'Catégorie'}</span><select name="category" defaultValue={product?.category ?? 'decor'}><option value="decor">{ar ? 'ديكور' : 'Décoration'}</option><option value="lighting">{ar ? 'إضاءة' : 'Éclairage'}</option><option value="textiles">{ar ? 'مفروشات' : 'Textile'}</option><option value="fragrance">{ar ? 'عطور منزلية' : 'Parfums'}</option><option value="tableware">{ar ? 'أناقة المائدة' : 'Art de table'}</option><option value="kitchen">{ar ? 'المطبخ' : 'Cuisine'}</option><option value="organization">{ar ? 'تنظيم المنزل' : 'Rangement'}</option><option value="gifts">{ar ? 'هدايا' : 'Cadeaux'}</option></select></label><label><span>{ar ? 'حالة المنتج' : 'Statut'}</span><select name="status" defaultValue={product?.active === false ? 'draft' : 'active'}><option value="active">{ar ? 'منشور في المتجر' : 'Actif dans la boutique'}</option><option value="draft">{ar ? 'مسودة مخفية' : 'Brouillon masqué'}</option></select></label></div>
        <label className="featured-product-check"><input type="checkbox" name="featured" defaultChecked={product?.featured ?? false} /><i><Check /></i><p><b>{ar ? 'منتج مميز' : 'Produit vedette'}</b><span>{ar ? 'إبرازه داخل المتجر والحملات' : 'Le mettre en avant dans la boutique'}</span></p></label>
        <div className="editor-section-title"><span>04</span><p><b>{ar ? 'صور المنتج' : 'Images du produit'}</b><small>{ar ? 'حتى 8 صور — تُضغط ويضاف لها الشعار تلقائياً' : 'Jusqu’à 8 images — compressées et marquées automatiquement'}</small></p></div>
        <div className={`product-upload-zone ${uploading ? 'uploading' : ''}`} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); void uploadFiles(event.dataTransfer.files) }}><input type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={event => event.target.files && void uploadFiles(event.target.files)} disabled={uploading || gallery.length >= 8} /><ImagePlus /><p><b>{uploading ? (ar ? 'جارٍ ضغط الصور وإضافة الشعار...' : 'Compression et ajout du logo...') : (ar ? 'اسحب الصور هنا أو اضغط للاختيار' : 'Glissez vos images ou cliquez pour choisir')}</b><span>{ar ? `JPG, PNG, WEBP · ${gallery.length}/8 صور` : `JPG, PNG, WEBP · ${gallery.length}/8 images`}</span></p></div>
        {uploadError && <div className="upload-error"><CircleAlert /> {uploadError}</div>}
        <div className="remote-image-row"><Link2 /><input type="url" value={remoteImage} onChange={event => setRemoteImage(event.target.value)} placeholder="https://example.com/product.jpg" dir="ltr" /><button type="button" onClick={addRemoteImage}><Plus /> {ar ? 'إضافة رابط' : 'Ajouter URL'}</button></div>
        <div className="product-image-gallery">{gallery.map((source, index) => <article className={index === 0 ? 'primary' : ''} key={`${source}-${index}`}><StoredImage src={source} alt="" /><button type="button" className="make-primary" onClick={() => makePrimary(source)} title={ar ? 'تعيين كصورة رئيسية' : 'Définir comme principale'}>{index === 0 ? <Crown /> : <Sparkles />}</button><button type="button" className="remove-uploaded-image" onClick={() => removeImage(source)}><X /></button>{index === 0 && <span>{ar ? 'الرئيسية' : 'Principale'}</span>}</article>)}{gallery.length === 0 && <div className="empty-gallery"><ImagePlus /><span>{ar ? 'أضف صورة واحدة على الأقل' : 'Ajoutez au moins une image'}</span></div>}</div>
        <div className="image-library"><span>{ar ? 'أو اختر من مكتبة المتجر:' : 'Ou choisissez dans la bibliothèque :'}</span><div>{imageChoices.slice(0, 8).map(item => <button type="button" key={item.image} onClick={() => !gallery.includes(item.image) && setGallery(current => [...current, item.image].slice(0, 8))}><StoredImage src={item.image} alt="" /><Plus /></button>)}</div></div>
      </div>
      <div className="editor-modal-footer"><div className="add-product-note"><ShieldCheck /> {ar ? 'يُحفظ التعديل مباشرة في هذا المتصفح.' : 'Les changements sont enregistrés dans ce navigateur.'}</div><button type="button" className="smart-secondary" onClick={onClose}>{ar ? 'إلغاء' : 'Annuler'}</button><button className="smart-primary full-add" type="submit"><Check /> {product ? (ar ? 'حفظ التغييرات' : 'Enregistrer') : (ar ? 'إضافة المنتج' : 'Ajouter')}</button></div>
    </form>
  </div>
}
