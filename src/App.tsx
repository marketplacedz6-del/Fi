import { Component, FormEvent, MouseEvent, type ReactNode, useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  Clock3,
  Eye,
  EyeOff,
  Gift,
  Globe2,
  Headphones,
  Heart,
  Instagram,
  KeyRound,
  LayoutDashboard,
  LockKeyhole,
  Mail,
  MapPin,
  Menu,
  MessageCircle,
  Minus,
  PackageCheck,
  Phone,
  Plus,
  Search,
  ShoppingBag,
  Sparkles,
  Star,
  Trash2,
  Truck,
  UserRound,
  X,
} from 'lucide-react'
import AdminDashboard from './AdminDashboard'
import StoredImage from './StoredImage'
import { initializeAnalytics, trackCommerceEvent } from './lib/analytics'
import { dispatchOrder, type StoreOrder } from './lib/integrations'
import { deleteStoredImage } from './lib/imageStore'

type Lang = 'ar' | 'fr'
type Category = 'all' | 'decor' | 'lighting' | 'textiles' | 'fragrance' | 'tableware' | 'kitchen' | 'organization' | 'gifts'
type Localized = { ar: string; fr: string }

// Keeps public assets working both at a root domain (Netlify) and under
// the repository sub-path used by GitHub Pages.
const assetPath = (path: string) => `${import.meta.env.BASE_URL}${path.replace(/^\/+/, '')}`

// The static build validates one-way hashes; the actual password is never
// written to the generated JavaScript bundle.
const ADMIN_EMAIL_HASHES = ['1d8c5f9c308dffc945ee2b03e4cb5f9d993489ef462cb191aac76bcb96255a52', 'bfeae9cb']
const ADMIN_PASSWORD_HASHES = ['f37f3f2b0dc57a86dee4ba6ff855283bb4d2f0dea1c5bd1b708853444c2ffcec', 'c92e926c']

const fallbackHash = (value: string) => {
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

const credentialHash = async (value: string) => {
  try {
    if (!globalThis.crypto?.subtle) return fallbackHash(value)
    const bytes = new TextEncoder().encode(value)
    const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes)
    return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
  } catch {
    return fallbackHash(value)
  }
}

type Product = {
  id: number
  name: Localized
  description: Localized
  category: Exclude<Category, 'all'>
  image: string
  price: number
  oldPrice?: number
  rating: number
  reviews: number
  badge?: Localized
  stock?: number
  active?: boolean
  images?: string[]
  cost?: number
  sku?: string
  featured?: boolean
  tags?: string[]
}

type CartItem = { id: number; quantity: number }

const defaultProducts: Product[] = [
  {
    id: 1,
    name: { ar: 'مزهرية لوتس الخزفية', fr: 'Vase Lotus en céramique' },
    description: {
      ar: 'قطعة خزفية ناعمة بلمسة ذهبية، صُممت لتمنح طاولتك هدوءاً وأناقة خالدة.',
      fr: 'Une pièce en céramique douce avec une touche dorée, pensée pour une élégance intemporelle.',
    },
    category: 'decor',
    image: assetPath('products/vase.jpg'),
    price: 6900,
    oldPrice: 8200,
    rating: 4.9,
    reviews: 48,
    stock: 12,
    active: true,
    badge: { ar: 'جديد', fr: 'Nouveau' },
  },
  {
    id: 2,
    name: { ar: 'صينية أوريانا الذهبية', fr: 'Plateau doré Oriana' },
    description: {
      ar: 'صينية تقديم بسطح مرآة وإطار شامبانيا ذهبي، مثالية للضيافة والمناسبات.',
      fr: 'Plateau miroir au cadre doré champagne, idéal pour recevoir avec raffinement.',
    },
    category: 'decor',
    image: assetPath('products/tray.jpg'),
    price: 8500,
    oldPrice: 9900,
    rating: 4.8,
    reviews: 72,
    stock: 8,
    active: true,
    badge: { ar: 'الأكثر طلباً', fr: 'Best-seller' },
  },
  {
    id: 3,
    name: { ar: 'شمعة سكون العطرية', fr: 'Bougie parfumée Sérénité' },
    description: {
      ar: 'مزيج دافئ من المسك الأبيض والفانيلا في وعاء خزفي يمكن إعادة استخدامه.',
      fr: 'Un accord chaleureux de musc blanc et vanille dans un écrin en céramique réutilisable.',
    },
    category: 'fragrance',
    image: assetPath('products/candle.jpg'),
    price: 3200,
    rating: 4.9,
    reviews: 91,
    stock: 24,
    active: true,
    badge: { ar: 'مفضل', fr: 'Coup de cœur' },
  },
  {
    id: 4,
    name: { ar: 'مصباح نورا المكتبي', fr: 'Lampe de table Nora' },
    description: {
      ar: 'إضاءة دافئة بقاعدة نحاسية وغطاء قماشي مطوي تضيف دفئاً راقياً لكل زاوية.',
      fr: 'Une lumière chaude, un pied en laiton et un abat-jour plissé pour une ambiance raffinée.',
    },
    category: 'lighting',
    image: assetPath('products/lamp.jpg'),
    price: 12900,
    oldPrice: 14900,
    rating: 4.7,
    reviews: 36,
    stock: 4,
    active: true,
    badge: { ar: 'حصري', fr: 'Exclusif' },
  },
  {
    id: 5,
    name: { ar: 'طقم وسائد لُمى', fr: 'Duo de coussins Luma' },
    description: {
      ar: 'وسادتان بملمس البوكليه والمخمل مع حواف ذهبية دقيقة، لراحة وأناقة متوازنة.',
      fr: 'Deux coussins en bouclette et velours, soulignés d’un passepoil doré délicat.',
    },
    category: 'textiles',
    image: assetPath('products/cushion.jpg'),
    price: 5400,
    rating: 4.8,
    reviews: 55,
    stock: 15,
    active: true,
  },
  {
    id: 6,
    name: { ar: 'مرآة أماليا المقوسة', fr: 'Miroir arche Amalia' },
    description: {
      ar: 'مرآة مقوسة بإطار معدني ذهبي معتّق، تعكس الضوء وتمنح المكان عمقاً وأناقة.',
      fr: 'Un miroir arqué au cadre doré patiné qui amplifie la lumière et sublime l’espace.',
    },
    category: 'decor',
    image: assetPath('products/mirror.jpg'),
    price: 18900,
    rating: 4.9,
    reviews: 29,
    stock: 3,
    active: true,
    badge: { ar: 'كمية محدودة', fr: 'Série limitée' },
  },
]

const copy = {
  ar: {
    announcement: 'توصيل إلى 58 ولاية · الدفع عند الاستلام',
    home: 'الرئيسية', shop: 'المتجر', collections: 'المجموعات', story: 'قصتنا', contact: 'تواصل معنا',
    search: 'ابحثي عن قطعة...', wishlist: 'المفضلة', cart: 'السلة', account: 'حسابي',
    heroEyebrow: 'مجموعة البيت الهادئ · 2026',
    heroTitle1: 'تفاصيل صغيرة.', heroTitle2: 'أناقة لا تُنسى.',
    heroText: 'قطع مختارة بعناية لتحوّل كل زاوية في بيتك إلى مساحة دافئة، راقية، وتشبهك.',
    shopNow: 'تسوّقي المجموعة', discover: 'اكتشفي قصتنا',
    delivery: 'توصيل لكل الجزائر', deliverySub: 'إلى 58 ولاية', cod: 'الدفع عند الاستلام', codSub: 'دفع آمن ومريح',
    quality: 'جودة مختارة', qualitySub: 'كل قطعة تُفحص بعناية', support: 'نحن هنا دائماً', supportSub: 'دعم مباشر 24/7',
    curation: 'مختاراتنا', collectionTitle: 'اختاري مزاج بيتك', collectionText: 'مجموعات متناسقة صُممت لتمنحك بيتاً أكثر دفئاً وجمالاً.',
    tableCollection: 'أناقة المائدة', tableCollectionSub: 'ضيافة تترك أثراً',
    calmCollection: 'عطر وهدوء', calmCollectionSub: 'لحظاتك الخاصة',
    livingCollection: 'دفء الصالون', livingCollectionSub: 'راحة بتفاصيل راقية',
    explore: 'استكشفي',
    selected: 'مختار لكِ', productsTitle: 'قطع تُكمل حكاية بيتك', productsText: 'كل منتج اختير لجودته، بساطته، وقدرته على صنع فرق حقيقي.',
    all: 'الكل', decor: 'ديكور', lighting: 'إضاءة', textiles: 'مفروشات', fragrance: 'عطور منزلية', tableware: 'أناقة المائدة', kitchen: 'المطبخ', organization: 'تنظيم المنزل', gifts: 'هدايا',
    newest: 'الأحدث', priceLow: 'السعر: من الأقل', priceHigh: 'السعر: من الأعلى',
    quickView: 'نظرة سريعة', add: 'أضيفي للسلة', added: 'أُضيف إلى سلتك', noResults: 'لا توجد منتجات تطابق بحثك.',
    storyEyebrow: 'من بيتنا إلى بيتك', storyTitle: 'نؤمن أن الأناقة إحساس قبل أن تكون مظهراً',
    storyText: 'بدأت Elegance Home & Style من شغفنا بالتفاصيل الهادئة. نختار كل قطعة كما لو كانت لبيتنا: خامة جميلة، حضور دافئ، وجودة تعيش معك طويلاً.',
    storyPoint1: 'تصاميم منتقاة وليست مكررة', storyPoint2: 'تغليف راقٍ يحمي كل تفصيلة', storyPoint3: 'خدمة قريبة منك قبل وبعد الطلب', readStory: 'اعرفي المزيد عنا',
    promise: 'وعد Elegance', promiseTitle: 'تجربة أنيقة من أول نقرة إلى باب بيتك',
    secure: 'طلب آمن', secureText: 'بياناتك محمية والدفع عند الاستلام.',
    gift: 'تغليف يليق بالهدية', giftText: 'عناية خاصة في كل طرد يصل إليك.',
    easyDelivery: 'توصيل موثوق', easyDeliveryText: 'متابعة لطلبك حتى 58 ولاية.',
    liveHelp: 'مساعدة مباشرة', liveHelpText: 'فريقنا يجيبك في أي وقت.',
    reviewsEyebrow: 'كلمات من بيوتكم', reviewsTitle: 'أحببتنّ التفاصيل، ونحن أحببنا ثقتكنّ',
    review1: 'المنتج أجمل من الصورة والتغليف في غاية الأناقة. وصلني سليماً وفي الوقت المتفق عليه.',
    review2: 'أول طلب ولن يكون الأخير. المرآة غيّرت شكل المدخل تماماً، وخدمة الزبائن ممتازة.',
    review3: 'تفاصيل راقية فعلاً. الشمعة رائحتها هادئة وثابتة، وكانت هدية مثالية لأختي.',
    newsletter: 'رسائل جميلة لبيت أجمل', newsletterText: 'كوني أول من يكتشف القطع الجديدة، الإصدارات المحدودة، وعروضنا الهادئة.',
    email: 'بريدك الإلكتروني', subscribe: 'انضمّي إلينا', subscribed: 'أهلاً بك في عائلة Elegance!',
    cartTitle: 'سلة مشترياتك', emptyCart: 'سلتك تنتظر لمستك الأنيقة', emptyCartText: 'اكتشفي مجموعتنا وأضيفي القطع التي تشبه بيتك.', continueShopping: 'متابعة التسوق',
    subtotal: 'المجموع الفرعي', shipping: 'التوصيل', free: 'مجاني', total: 'الإجمالي', checkout: 'تأكيد الطلب', taxNote: 'السعر النهائي. الدفع عند استلام طلبك.', remove: 'حذف',
    checkoutTitle: 'إتمام الطلب', checkoutSubtitle: 'أدخلي معلومات التوصيل وسنتصل بك للتأكيد.',
    fullName: 'الاسم واللقب', phone: 'رقم الهاتف', wilaya: 'الولاية', city: 'البلدية', address: 'العنوان الكامل', note: 'ملاحظة للطلب (اختياري)',
    selectWilaya: 'اختاري الولاية', confirmOrder: 'تأكيد الطلب', backToCart: 'العودة للسلة',
    successTitle: 'شكراً لثقتك!', successText: 'تم تسجيل طلبك بنجاح. سيتصل بك فريقنا قريباً لتأكيد تفاصيل التوصيل.', orderNumber: 'رقم الطلب', backHome: 'العودة للرئيسية',
    quantity: 'الكمية', details: 'تفاصيل المنتج', available: 'متوفر وجاهز للشحن', brandNote: 'منتج أصلي من Elegance Home & Style',
    footerText: 'نختار لكِ تفاصيل تصنع بيتاً دافئاً، راقياً، ويشبهك.', links: 'روابط سريعة', service: 'خدمة الزبائن', privacy: 'سياسة الخصوصية', returns: 'الاستبدال والاسترجاع', deliveryPolicy: 'سياسة التوصيل', faq: 'الأسئلة الشائعة',
    follow: 'تابعينا', rights: 'جميع الحقوق محفوظة', recovery: 'مرحباً بعودتك! احتفظنا بالقطع في سلتك.', menu: 'القائمة', close: 'إغلاق',
  },
  fr: {
    announcement: 'Livraison dans les 58 wilayas · Paiement à la livraison',
    home: 'Accueil', shop: 'Boutique', collections: 'Collections', story: 'Notre histoire', contact: 'Contact',
    search: 'Rechercher une pièce...', wishlist: 'Favoris', cart: 'Panier', account: 'Compte',
    heroEyebrow: 'Collection Maison Sereine · 2026',
    heroTitle1: 'Petits détails.', heroTitle2: 'Élégance inoubliable.',
    heroText: 'Des pièces soigneusement choisies pour transformer chaque coin de votre maison en un espace chaleureux et raffiné.',
    shopNow: 'Voir la collection', discover: 'Notre histoire',
    delivery: 'Livraison en Algérie', deliverySub: 'Dans les 58 wilayas', cod: 'Paiement à la livraison', codSub: 'Simple et sécurisé',
    quality: 'Qualité choisie', qualitySub: 'Chaque pièce est vérifiée', support: 'Toujours à vos côtés', supportSub: 'Assistance directe 24/7',
    curation: 'Nos sélections', collectionTitle: 'Choisissez l’ambiance', collectionText: 'Des collections harmonieuses pour une maison plus douce et plus belle.',
    tableCollection: 'Art de la table', tableCollectionSub: 'Recevoir avec élégance', calmCollection: 'Parfum & calme', calmCollectionSub: 'Vos instants précieux', livingCollection: 'Salon chaleureux', livingCollectionSub: 'Le confort raffiné', explore: 'Explorer',
    selected: 'Pour vous', productsTitle: 'Des pièces qui racontent votre intérieur', productsText: 'Chaque produit est choisi pour sa qualité, sa simplicité et sa présence.',
    all: 'Tout', decor: 'Décoration', lighting: 'Éclairage', textiles: 'Textile', fragrance: 'Parfums', tableware: 'Art de table', kitchen: 'Cuisine', organization: 'Rangement', gifts: 'Cadeaux', newest: 'Nouveautés',  priceLow: 'Prix croissant', priceHigh: 'Prix décroissant',
    quickView: 'Aperçu', add: 'Ajouter au panier', added: 'Ajouté à votre panier', noResults: 'Aucun produit ne correspond à votre recherche.',
    storyEyebrow: 'De notre maison à la vôtre', storyTitle: 'L’élégance est une sensation avant d’être un style',
    storyText: 'Elegance Home & Style est née de notre passion pour les détails apaisants. Chaque pièce est choisie comme si elle était destinée à notre propre maison.',
    storyPoint1: 'Des créations choisies et singulières', storyPoint2: 'Un emballage raffiné et protecteur', storyPoint3: 'Un service proche avant et après la commande', readStory: 'En savoir plus',
    promise: 'La promesse Elegance', promiseTitle: 'Une expérience raffinée, du premier clic à votre porte',
    secure: 'Commande sécurisée', secureText: 'Vos données sont protégées, paiement à la livraison.', gift: 'Emballage soigné', giftText: 'Une attention particulière portée à chaque colis.', easyDelivery: 'Livraison fiable', easyDeliveryText: 'Suivi de votre commande dans 58 wilayas.', liveHelp: 'Aide en direct', liveHelpText: 'Notre équipe vous répond à tout moment.',
    reviewsEyebrow: 'Vos mots', reviewsTitle: 'Vous aimez les détails, nous aimons votre confiance',
    review1: 'Le produit est encore plus beau que sur la photo et l’emballage est très élégant. Reçu intact et à temps.', review2: 'Première commande, certainement pas la dernière. Le miroir a transformé mon entrée.', review3: 'Des détails vraiment raffinés. La bougie est douce et durable, un cadeau parfait.',
    newsletter: 'De belles nouvelles pour une belle maison', newsletterText: 'Découvrez en premier nos nouveautés, séries limitées et offres.', email: 'Votre adresse e-mail', subscribe: 'Nous rejoindre', subscribed: 'Bienvenue dans la famille Elegance !',
    cartTitle: 'Votre panier', emptyCart: 'Votre panier attend votre touche', emptyCartText: 'Découvrez notre collection et ajoutez les pièces qui vous ressemblent.', continueShopping: 'Continuer mes achats', subtotal: 'Sous-total', shipping: 'Livraison', free: 'Gratuite', total: 'Total', checkout: 'Valider la commande', taxNote: 'Prix final. Paiement à la réception.', remove: 'Supprimer',
    checkoutTitle: 'Finaliser la commande', checkoutSubtitle: 'Renseignez vos coordonnées, nous vous appellerons pour confirmer.', fullName: 'Nom et prénom', phone: 'Téléphone', wilaya: 'Wilaya', city: 'Commune', address: 'Adresse complète', note: 'Note (facultatif)', selectWilaya: 'Choisissez la wilaya', confirmOrder: 'Confirmer la commande', backToCart: 'Retour au panier',
    successTitle: 'Merci pour votre confiance !', successText: 'Votre commande est enregistrée. Notre équipe vous appellera bientôt pour confirmer la livraison.', orderNumber: 'Numéro de commande', backHome: 'Retour à l’accueil', quantity: 'Quantité', details: 'Détails du produit', available: 'Disponible et prêt à expédier', brandNote: 'Produit original Elegance Home & Style',
    footerText: 'Des détails choisis pour une maison chaleureuse, raffinée et à votre image.', links: 'Liens rapides', service: 'Service client', privacy: 'Confidentialité', returns: 'Échanges et retours', deliveryPolicy: 'Livraison', faq: 'FAQ', follow: 'Suivez-nous', rights: 'Tous droits réservés', recovery: 'Bon retour ! Nous avons gardé vos articles dans le panier.', menu: 'Menu', close: 'Fermer',
  },
} as const

const wilayas = [
  '01 - أدرار', '02 - الشلف', '03 - الأغواط', '04 - أم البواقي', '05 - باتنة', '06 - بجاية', '07 - بسكرة', '08 - بشار', '09 - البليدة', '10 - البويرة',
  '11 - تمنراست', '12 - تبسة', '13 - تلمسان', '14 - تيارت', '15 - تيزي وزو', '16 - الجزائر', '17 - الجلفة', '18 - جيجل', '19 - سطيف', '20 - سعيدة',
  '21 - سكيكدة', '22 - سيدي بلعباس', '23 - عنابة', '24 - قالمة', '25 - قسنطينة', '26 - المدية', '27 - مستغانم', '28 - المسيلة', '29 - معسكر', '30 - ورقلة',
  '31 - وهران', '32 - البيض', '33 - إليزي', '34 - برج بوعريريج', '35 - بومرداس', '36 - الطارف', '37 - تندوف', '38 - تيسمسيلت', '39 - الوادي', '40 - خنشلة',
  '41 - سوق أهراس', '42 - تيبازة', '43 - ميلة', '44 - عين الدفلى', '45 - النعامة', '46 - عين تموشنت', '47 - غرداية', '48 - غليزان', '49 - تيميمون', '50 - برج باجي مختار',
  '51 - أولاد جلال', '52 - بني عباس', '53 - إن صالح', '54 - إن قزام', '55 - تقرت', '56 - جانت', '57 - المغير', '58 - المنيعة',
]

const readStorage = <T,>(key: string, fallback: T): T => {
  try {
    const value = localStorage.getItem(key)
    return value ? (JSON.parse(value) as T) : fallback
  } catch {
    return fallback
  }
}

const writeStorage = (key: string, value: unknown) => {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* Continue when storage is restricted. */ }
}

function App() {
  const [lang, setLang] = useState<Lang>(() => readStorage<Lang>('ehs-lang', 'ar'))
  const [catalogProducts, setCatalogProducts] = useState<Product[]>(() => readStorage<Product[]>('ehs-products', defaultProducts))
  const [cart, setCart] = useState<CartItem[]>(() => readStorage<CartItem[]>('ehs-cart', []))
  const [wishlist, setWishlist] = useState<number[]>(() => readStorage<number[]>('ehs-wishlist', []))
  const [category, setCategory] = useState<Category>('all')
  const [sort, setSort] = useState('newest')
  const [search, setSearch] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [cartOpen, setCartOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [quickProduct, setQuickProduct] = useState<Product | null>(null)
  const [quickImage, setQuickImage] = useState('')
  const [quickQuantity, setQuickQuantity] = useState(1)
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [orderId, setOrderId] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [subscribed, setSubscribed] = useState(false)
  const [loginOpen, setLoginOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [authError, setAuthError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loginPending, setLoginPending] = useState(false)

  const t = copy[lang]
  const isAr = lang === 'ar'

  useEffect(() => {
    document.documentElement.lang = lang
    document.documentElement.dir = isAr ? 'rtl' : 'ltr'
    writeStorage('ehs-lang', lang)
  }, [lang, isAr])

  useEffect(() => {
    initializeAnalytics()
  }, [])

  useEffect(() => writeStorage('ehs-products', catalogProducts), [catalogProducts])
  useEffect(() => writeStorage('ehs-cart', cart), [cart])
  useEffect(() => writeStorage('ehs-wishlist', wishlist), [wishlist])

  useEffect(() => {
    try {
      if (cart.length && sessionStorage.getItem('ehs-visited')) {
        const timer = window.setTimeout(() => setToast(t.recovery), 900)
        return () => window.clearTimeout(timer)
      }
      sessionStorage.setItem('ehs-visited', 'yes')
    } catch {
      return undefined
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 3200)
    return () => window.clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    const shouldLock = cartOpen || menuOpen || !!quickProduct || checkoutOpen || !!orderId || loginOpen || accountOpen
    document.body.style.overflow = shouldLock ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [cartOpen, menuOpen, quickProduct, checkoutOpen, orderId, loginOpen, accountOpen])

  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setCartOpen(false)
      setMenuOpen(false)
      setQuickProduct(null)
      setCheckoutOpen(false)
      setLoginOpen(false)
      setAccountOpen(false)
      setIsAuthenticated(false)
    }
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [])

  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0)
  const cartProducts = cart.map(item => ({ ...catalogProducts.find(p => p.id === item.id)!, quantity: item.quantity })).filter(Boolean)
  const subtotal = cartProducts.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const storedOrders = readStorage<StoreOrder[]>('ehs-orders', [])

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase()
    const filtered = catalogProducts.filter(product => {
      const matchesCategory = category === 'all' || product.category === category
      if (product.active === false) return false
      const text = `${product.name.ar} ${product.name.fr} ${product.description.ar} ${product.description.fr}`.toLowerCase()
      return matchesCategory && (!query || text.includes(query))
    })
    if (sort === 'low') return [...filtered].sort((a, b) => a.price - b.price)
    if (sort === 'high') return [...filtered].sort((a, b) => b.price - a.price)
    return filtered
  }, [catalogProducts, category, search, sort])

  const money = (value: number) => `${new Intl.NumberFormat(isAr ? 'ar-DZ' : 'fr-DZ').format(value)} ${isAr ? 'د.ج' : 'DA'}`

  const addToCart = (id: number, quantity = 1) => {
    setCart(current => {
      const exists = current.find(item => item.id === id)
      return exists
        ? current.map(item => item.id === id ? { ...item, quantity: item.quantity + quantity } : item)
        : [...current, { id, quantity }]
    })
    const product = catalogProducts.find(item => item.id === id)
    trackCommerceEvent('AddToCart', {
      content_ids: [id],
      content_name: product?.name[lang],
      value: product ? product.price * quantity : undefined,
      currency: 'DZD',
      quantity,
    })
    setToast(t.added)
  }

  const updateQuantity = (id: number, quantity: number) => {
    if (quantity <= 0) setCart(current => current.filter(item => item.id !== id))
    else setCart(current => current.map(item => item.id === id ? { ...item, quantity } : item))
  }

  const toggleWishlist = (id: number) => {
    setWishlist(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id])
  }

  const openQuickView = (product: Product) => {
    setQuickProduct(product)
    setQuickImage(product.image)
    setQuickQuantity(1)
    trackCommerceEvent('ViewContent', {
      content_ids: [product.id],
      content_name: product.name[lang],
      value: product.price,
      currency: 'DZD',
    })
  }

  const openAccount = () => {
    setMenuOpen(false)
    setAuthError('')
    if (isAuthenticated) setAccountOpen(true)
    else setLoginOpen(true)
  }

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setAuthError('')
    setLoginPending(true)
    const data = new FormData(event.currentTarget)
    const email = String(data.get('email') ?? '').trim().toLowerCase()
    const password = String(data.get('password') ?? '')

    try {
      const [emailHash, passwordHash] = await Promise.all([credentialHash(email), credentialHash(password)])
      if (!ADMIN_EMAIL_HASHES.includes(emailHash) || !ADMIN_PASSWORD_HASHES.includes(passwordHash)) {
        setAuthError(isAr ? 'البريد الإلكتروني أو كلمة السر غير صحيحة.' : 'E-mail ou mot de passe incorrect.')
        return
      }
      setIsAuthenticated(true)
      setLoginOpen(false)
      setAccountOpen(true)
      setToast(isAr ? 'تم تسجيل الدخول بنجاح' : 'Connexion réussie')
    } catch {
      setAuthError(isAr ? 'تعذر تسجيل الدخول. حاولي مرة أخرى.' : 'Connexion impossible. Réessayez.')
    } finally {
      setLoginPending(false)
    }
  }

  const lockDashboard = () => {
    setAccountOpen(false)
    setIsAuthenticated(false)
  }

  const logout = () => {
    lockDashboard()
    setToast(isAr ? 'تم تسجيل الخروج' : 'Déconnexion réussie')
  }

  type DashboardProductDraft = { nameAr: string; nameFr: string; descriptionAr: string; price: number; oldPrice?: number; stock: number; active: boolean; category: Exclude<Category, 'all'>; image: string; images: string[]; cost?: number; sku?: string; featured: boolean; tags: string[] }

  const addDashboardProduct = (draft: DashboardProductDraft) => {
    setCatalogProducts(current => [...current, {
      id: Math.max(0, ...current.map(product => product.id)) + 1,
      name: { ar: draft.nameAr, fr: draft.nameFr || draft.nameAr },
      description: {
        ar: draft.descriptionAr || 'منتج جديد من مجموعة Elegance Home & Style، اختير بعناية ليضيف لمسة راقية إلى بيتك.',
        fr: draft.descriptionAr || 'Une nouveauté Elegance Home & Style, choisie pour apporter une touche raffinée à votre intérieur.',
      },
      category: draft.category,
      image: draft.image,
      price: draft.price,
      oldPrice: draft.oldPrice,
      stock: draft.stock,
      active: draft.active,
      images: draft.images,
      cost: draft.cost,
      sku: draft.sku,
      featured: draft.featured,
      tags: draft.tags,
      rating: 5,
      reviews: 0,
      badge: { ar: 'جديد', fr: 'Nouveau' },
    }])
  }

  const updateDashboardProduct = (id: number, draft: DashboardProductDraft) => {
    setCatalogProducts(current => current.map(product => product.id === id ? {
      ...product,
      name: { ar: draft.nameAr, fr: draft.nameFr || draft.nameAr },
      description: { ar: draft.descriptionAr || product.description.ar, fr: draft.descriptionAr || product.description.fr },
      category: draft.category,
      image: draft.image,
      price: draft.price,
      oldPrice: draft.oldPrice,
      stock: draft.stock,
      active: draft.active,
      images: draft.images,
      cost: draft.cost,
      sku: draft.sku,
      featured: draft.featured,
      tags: draft.tags,
    } : product))
  }

  const duplicateDashboardProduct = (id: number) => {
    setCatalogProducts(current => {
      const source = current.find(product => product.id === id)
      if (!source) return current
      return [...current, { ...source, id: Math.max(0, ...current.map(product => product.id)) + 1, name: { ar: `${source.name.ar} — نسخة`, fr: `${source.name.fr} — Copie` }, active: false, badge: { ar: 'نسخة', fr: 'Copie' } }]
    })
  }

  const deleteDashboardProducts = (ids: number[]) => {
    const accepted = window.confirm(isAr ? `هل تريد حذف ${ids.length} منتج من المتجر؟` : `Supprimer ${ids.length} produit(s) ?`)
    if (!accepted) return
    const deletedSources = catalogProducts.filter(product => ids.includes(product.id)).flatMap(product => product.images ?? [product.image])
    const retainedSources = new Set(catalogProducts.filter(product => !ids.includes(product.id)).flatMap(product => product.images ?? [product.image]))
    deletedSources.filter(source => !retainedSources.has(source)).forEach(source => { void deleteStoredImage(source) })
    setCatalogProducts(current => current.filter(product => !ids.includes(product.id)))
    setCart(current => current.filter(item => !ids.includes(item.id)))
  }

  const setDashboardProductsStatus = (ids: number[], active: boolean) => {
    setCatalogProducts(current => current.map(product => ids.includes(product.id) ? { ...product, active } : product))
  }

  const goToProducts = (selectedCategory?: Category) => {
    if (selectedCategory) setCategory(selectedCategory)
    setMenuOpen(false)
    requestAnimationFrame(() => document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' }))
  }

  const submitOrder = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const nextId = `EHS-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`
    const order: StoreOrder = {
      id: nextId,
      customer: Object.fromEntries(form.entries()),
      items: cart,
      total: subtotal,
      date: new Date().toISOString(),
      status: 'new',
    }
    const previousOrders = readStorage<StoreOrder[]>('ehs-orders', [])
    writeStorage('ehs-orders', [...previousOrders, order])
    void dispatchOrder(order)
    trackCommerceEvent('Purchase', {
      content_ids: cart.map(item => item.id),
      value: subtotal,
      currency: 'DZD',
      order_id: nextId,
    })
    setCart([])
    setCheckoutOpen(false)
    setCartOpen(false)
    setOrderId(nextId)
  }

  const stopLink = (event: MouseEvent<HTMLAnchorElement>, id: string) => {
    event.preventDefault()
    setMenuOpen(false)
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  }

  const navLinks = [
    ['home', t.home], ['products', t.shop], ['collections', t.collections], ['story', t.story], ['contact', t.contact],
  ]

  const categoryLabels: Record<Category, string> = {
    all: t.all, decor: t.decor, lighting: t.lighting, textiles: t.textiles, fragrance: t.fragrance,
    tableware: t.tableware, kitchen: t.kitchen, organization: t.organization, gifts: t.gifts,
  }

  return (
    <div className={`app ${isAr ? 'font-ar' : 'font-fr'}`}>
      <div className="announcement-bar">
        <div className="announcement-spacer" />
        <p><Truck size={15} strokeWidth={1.8} /> {t.announcement}</p>
        <div className="announcement-controls">
          <button onClick={() => setLang(isAr ? 'fr' : 'ar')} aria-label="Change language">
            <Globe2 size={14} /> {isAr ? 'FR' : 'العربية'}
          </button>
        </div>
      </div>

      <header className="site-header">
        <div className="header-inner page-shell">
          <button className="icon-button mobile-menu-button" onClick={() => setMenuOpen(true)} aria-label={t.menu}>
            <Menu size={23} />
          </button>

          <a href="#home" onClick={e => stopLink(e, 'home')} className="brand" aria-label="Elegance Home & Style">
            <img src={assetPath('assets/logo.png')} alt="Elegance Home & Style" />
          </a>

          <nav className="desktop-nav" aria-label="Main navigation">
            {navLinks.map(([id, label], index) => (
              <a key={id} href={`#${id}`} onClick={e => stopLink(e, id)} className={index === 0 ? 'active' : ''}>{label}</a>
            ))}
          </nav>

          <div className="header-actions">
            <div className={`header-search ${searchOpen ? 'open' : ''}`}>
              {searchOpen && (
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t.search} autoFocus
                  onKeyDown={e => { if (e.key === 'Enter') goToProducts() }} />
              )}
              <button className="icon-button" onClick={() => setSearchOpen(value => !value)} aria-label={t.search}>
                {searchOpen ? <X size={20} /> : <Search size={21} />}
              </button>
            </div>
            <button className={`icon-button desktop-only account-trigger ${isAuthenticated ? 'signed-in' : ''}`} aria-label={t.account} onClick={openAccount}>
              {isAuthenticated ? <LayoutDashboard size={21} /> : <UserRound size={21} />}
            </button>
            <button className="icon-button desktop-only badge-button" aria-label={t.wishlist} onClick={() => goToProducts()}>
              <Heart size={21} />{wishlist.length > 0 && <span>{wishlist.length}</span>}
            </button>
            <button className="cart-button badge-button" onClick={() => setCartOpen(true)} aria-label={t.cart}>
              <ShoppingBag size={21} />
              <span className="cart-label">{t.cart}</span>
              {cartCount > 0 && <b>{cartCount}</b>}
            </button>
          </div>
        </div>
      </header>

      <main>
        <section className="hero" id="home">
          <div className="hero-copy">
            <div className="hero-copy-inner">
              <p className="eyebrow"><span /> {t.heroEyebrow}</p>
              <h1>{t.heroTitle1}<br /><em>{t.heroTitle2}</em></h1>
              <p className="hero-description">{t.heroText}</p>
              <div className="hero-buttons">
                <button className="primary-button" onClick={() => goToProducts()}>
                  {t.shopNow} {isAr ? <ArrowLeft size={18} /> : <ArrowRight size={18} />}
                </button>
                <a href="#story" onClick={e => stopLink(e, 'story')} className="text-link">{t.discover}<span /></a>
              </div>
            </div>
            <div className="hero-monogram">E</div>
          </div>
          <div className="hero-image-wrap">
            <img src={assetPath('assets/cover.png')} alt="Elegance Home & Style — delivery across Algeria" className="hero-image" />
            <div className="hero-image-shade" />
            <span className="image-number">EST. <b>2026</b></span>
          </div>
        </section>

        <section className="trust-strip page-shell" aria-label="Store benefits">
          <TrustItem icon={<Truck />} title={t.delivery} text={t.deliverySub} />
          <TrustItem icon={<PackageCheck />} title={t.cod} text={t.codSub} />
          <TrustItem icon={<BadgeCheck />} title={t.quality} text={t.qualitySub} />
          <TrustItem icon={<Headphones />} title={t.support} text={t.supportSub} />
        </section>

        <div className="brand-marquee" aria-hidden="true">
          <div>
            <span>ELEGANCE HOME & STYLE</span><Sparkles size={16} /><span>DES DÉTAILS QUI VOUS RESSEMBLENT</span><Sparkles size={16} />
            <span>ELEGANCE HOME & STYLE</span><Sparkles size={16} /><span>DES DÉTAILS QUI VOUS RESSEMBLENT</span><Sparkles size={16} />
          </div>
        </div>

        <section className="collections section-space page-shell" id="collections">
          <SectionHeading eyebrow={t.curation} title={t.collectionTitle} text={t.collectionText} />
          <div className="collection-grid">
            <CollectionCard image={assetPath('products/tray.jpg')} title={t.tableCollection} subtitle={t.tableCollectionSub} button={t.explore} onClick={() => goToProducts('decor')} />
            <CollectionCard image={assetPath('products/candle.jpg')} title={t.calmCollection} subtitle={t.calmCollectionSub} button={t.explore} onClick={() => goToProducts('fragrance')} featured />
            <CollectionCard image={assetPath('products/cushion.jpg')} title={t.livingCollection} subtitle={t.livingCollectionSub} button={t.explore} onClick={() => goToProducts('textiles')} />
          </div>
        </section>

        <section className="products-section section-space" id="products">
          <div className="page-shell">
            <SectionHeading eyebrow={t.selected} title={t.productsTitle} text={t.productsText} />
            <div className="product-toolbar">
              <div className="category-pills">
                {(Object.keys(categoryLabels) as Category[]).map(key => (
                  <button key={key} className={category === key ? 'active' : ''} onClick={() => setCategory(key)}>{categoryLabels[key]}</button>
                ))}
              </div>
              <div className="toolbar-end">
                <label className="catalog-search">
                  <Search size={17} />
                  <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t.search} />
                </label>
                <label className="sort-select">
                  <select value={sort} onChange={e => setSort(e.target.value)} aria-label={t.newest}>
                    <option value="newest">{t.newest}</option>
                    <option value="low">{t.priceLow}</option>
                    <option value="high">{t.priceHigh}</option>
                  </select>
                  <ChevronDown size={16} />
                </label>
              </div>
            </div>

            {filteredProducts.length ? (
              <div className="product-grid">
                {filteredProducts.map(product => (
                  <ProductCard key={product.id} product={product} lang={lang} money={money}
                    wished={wishlist.includes(product.id)} onWish={() => toggleWishlist(product.id)}
                    onQuick={() => openQuickView(product)} onAdd={() => addToCart(product.id)}
                    quickLabel={t.quickView} addLabel={t.add} categoryLabel={categoryLabels[product.category]} />
                ))}
              </div>
            ) : (
              <div className="no-results"><Search size={34} /><p>{t.noResults}</p></div>
            )}
          </div>
        </section>

        <section className="story section-space page-shell" id="story">
          <div className="story-images">
            <div className="story-main-image"><img src={assetPath('products/mirror.jpg')} alt={defaultProducts[5].name[lang]} /></div>
            <div className="story-small-image"><img src={assetPath('products/vase.jpg')} alt={defaultProducts[0].name[lang]} /></div>
            <div className="story-stamp"><img src={assetPath('assets/logo.png')} alt="" /></div>
          </div>
          <div className="story-copy">
            <p className="eyebrow"><span /> {t.storyEyebrow}</p>
            <h2>{t.storyTitle}</h2>
            <p className="story-description">{t.storyText}</p>
            <ul>
              {[t.storyPoint1, t.storyPoint2, t.storyPoint3].map(point => <li key={point}><Check size={16} /> {point}</li>)}
            </ul>
            <button className="outline-button">{t.readStory} {isAr ? <ArrowLeft size={17} /> : <ArrowRight size={17} />}</button>
          </div>
        </section>

        <section className="promise section-space">
          <div className="page-shell">
            <SectionHeading eyebrow={t.promise} title={t.promiseTitle} />
            <div className="promise-grid">
              <PromiseCard number="01" icon={<LockKeyhole />} title={t.secure} text={t.secureText} />
              <PromiseCard number="02" icon={<Gift />} title={t.gift} text={t.giftText} />
              <PromiseCard number="03" icon={<Truck />} title={t.easyDelivery} text={t.easyDeliveryText} />
              <PromiseCard number="04" icon={<MessageCircle />} title={t.liveHelp} text={t.liveHelpText} />
            </div>
          </div>
        </section>

        <section className="reviews section-space page-shell">
          <SectionHeading eyebrow={t.reviewsEyebrow} title={t.reviewsTitle} />
          <div className="reviews-grid">
            <ReviewCard text={t.review1} name="سارة ب." place="الجزائر" />
            <ReviewCard text={t.review2} name="إيناس م." place="وهران" featured />
            <ReviewCard text={t.review3} name="مريم ك." place="سطيف" />
          </div>
        </section>

        <section className="newsletter" id="contact">
          <div className="newsletter-mark"><img src={assetPath('assets/logo.png')} alt="" /></div>
          <div className="newsletter-inner page-shell">
            <div>
              <p className="eyebrow light"><span /> Elegance Letters</p>
              <h2>{t.newsletter}</h2>
              <p>{t.newsletterText}</p>
            </div>
            <form onSubmit={e => { e.preventDefault(); setSubscribed(true) }}>
              {subscribed ? (
                <div className="subscribed"><CircleCheck size={22} /> {t.subscribed}</div>
              ) : (
                <>
                  <Mail size={19} />
                  <input type="email" required placeholder={t.email} aria-label={t.email} />
                  <button>{t.subscribe} {isAr ? <ArrowLeft size={17} /> : <ArrowRight size={17} />}</button>
                </>
              )}
            </form>
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="page-shell footer-grid">
          <div className="footer-brand">
            <img src={assetPath('assets/logo.png')} alt="Elegance Home & Style" />
            <p>{t.footerText}</p>
            <div className="socials">
              <a href="https://instagram.com" target="_blank" rel="noreferrer" aria-label="Instagram"><Instagram /></a>
              <a href="https://facebook.com" target="_blank" rel="noreferrer" aria-label="Facebook">f</a>
              <a href="https://tiktok.com" target="_blank" rel="noreferrer" aria-label="TikTok">♪</a>
            </div>
          </div>
          <div className="footer-column"><h3>{t.links}</h3>{navLinks.slice(0, 4).map(([id, label]) => <a key={id} href={`#${id}`} onClick={e => stopLink(e, id)}>{label}</a>)}</div>
          <div className="footer-column"><h3>{t.service}</h3><a href="#privacy">{t.privacy}</a><a href="#returns">{t.returns}</a><a href="#delivery">{t.deliveryPolicy}</a><a href="#faq">{t.faq}</a></div>
          <div className="footer-column contact-column"><h3>{t.contact}</h3><a href="tel:+213555000000"><Phone /> +213 555 00 00 00</a><a href="mailto:bonjour@elegance-home.dz"><Mail /> bonjour@elegance-home.dz</a><p><MapPin /> Alger, Algérie</p><p><Clock3 /> 24/7</p></div>
        </div>
        <div className="page-shell footer-bottom">
          <p>© {new Date().getFullYear()} Elegance Home & Style. {t.rights}.</p>
          <div><span>COD</span><span>Yalidine</span><span>ZR Express</span></div>
        </div>
      </footer>

      <button className="whatsapp" onClick={() => window.open('https://wa.me/213555000000', '_blank')} aria-label="WhatsApp">
        <MessageCircle size={25} /><span>{isAr ? 'كيف نساعدك؟' : 'Besoin d’aide ?'}</span>
      </button>

      {menuOpen && (
        <div className="overlay mobile-nav-overlay" onMouseDown={() => setMenuOpen(false)}>
          <aside className="mobile-nav" onMouseDown={e => e.stopPropagation()}>
            <div className="drawer-head">
              <img src={assetPath('assets/logo.png')} alt="Elegance Home & Style" />
              <button className="icon-button" onClick={() => setMenuOpen(false)} aria-label={t.close}><X /></button>
            </div>
            <nav>{navLinks.map(([id, label]) => <a key={id} href={`#${id}`} onClick={e => stopLink(e, id)}>{label}{isAr ? <ChevronLeft /> : <ChevronRight />}</a>)}</nav>
            <div className="mobile-nav-bottom">
              <button onClick={() => setLang(isAr ? 'fr' : 'ar')}><Globe2 /> {isAr ? 'Français' : 'العربية'}</button>
              <button onClick={openAccount}>{isAuthenticated ? <LayoutDashboard /> : <UserRound />} {isAuthenticated ? (isAr ? 'لوحة المتجر' : 'Tableau de bord') : t.account}</button>
            </div>
          </aside>
        </div>
      )}

      {cartOpen && (
        <div className="overlay cart-overlay" onMouseDown={() => setCartOpen(false)}>
          <aside className="cart-drawer" onMouseDown={e => e.stopPropagation()}>
            <div className="drawer-head">
              <div><p>{t.cartTitle}</p><span>{cartCount} {isAr ? 'قطع' : 'article(s)'}</span></div>
              <button className="icon-button" onClick={() => setCartOpen(false)} aria-label={t.close}><X /></button>
            </div>
            {cartProducts.length ? (
              <>
                <div className="cart-items">
                  {cartProducts.map(item => (
                    <div className="cart-item" key={item.id}>
                      <StoredImage src={item.image} alt={item.name[lang]} />
                      <div className="cart-item-info">
                        <h4>{item.name[lang]}</h4><p>{money(item.price)}</p>
                        <div className="quantity-row">
                          <div className="quantity-control">
                            <button onClick={() => updateQuantity(item.id, item.quantity - 1)}><Minus /></button><span>{item.quantity}</span><button onClick={() => updateQuantity(item.id, item.quantity + 1)}><Plus /></button>
                          </div>
                          <button className="remove-button" onClick={() => updateQuantity(item.id, 0)}><Trash2 /> {t.remove}</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="cart-summary">
                  <div><span>{t.subtotal}</span><b>{money(subtotal)}</b></div>
                  <div><span>{t.shipping}</span><b className="free">{t.free}</b></div>
                  <div className="cart-total"><span>{t.total}</span><b>{money(subtotal)}</b></div>
                  <button className="primary-button full" onClick={() => {
                    trackCommerceEvent('InitiateCheckout', { content_ids: cart.map(item => item.id), value: subtotal, currency: 'DZD' })
                    setCartOpen(false)
                    setCheckoutOpen(true)
                  }}>{t.checkout} {isAr ? <ArrowLeft /> : <ArrowRight />}</button>
                  <p><LockKeyhole /> {t.taxNote}</p>
                </div>
              </>
            ) : (
              <div className="empty-cart">
                <div><ShoppingBag /></div><h3>{t.emptyCart}</h3><p>{t.emptyCartText}</p>
                <button className="outline-button" onClick={() => { setCartOpen(false); goToProducts() }}>{t.continueShopping}</button>
              </div>
            )}
          </aside>
        </div>
      )}

      {quickProduct && (
        <div className="overlay modal-overlay" onMouseDown={() => setQuickProduct(null)}>
          <div className="quick-modal" role="dialog" aria-modal="true" onMouseDown={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setQuickProduct(null)} aria-label={t.close}><X /></button>
            <div className="quick-image"><StoredImage src={quickImage || quickProduct.image} alt={quickProduct.name[lang]} />{(quickProduct.images?.length ?? 0) > 1 && <div className="quick-gallery">{quickProduct.images?.map((source, index) => <button key={`${source}-${index}`} className={(quickImage || quickProduct.image) === source ? 'active' : ''} onClick={() => setQuickImage(source)}><StoredImage src={source} alt="" /></button>)}</div>}</div>
            <div className="quick-copy">
              <p className="quick-category">{categoryLabels[quickProduct.category]}</p>
              <h2>{quickProduct.name[lang]}</h2>
              <div className="rating"><span><Star fill="currentColor" /> {quickProduct.rating}</span><small>({quickProduct.reviews})</small></div>
              <div className="quick-price"><b>{money(quickProduct.price)}</b>{quickProduct.oldPrice && <del>{money(quickProduct.oldPrice)}</del>}</div>
              <p className="quick-description">{quickProduct.description[lang]}</p>
              <div className="stock"><CircleCheck /> {t.available}</div>
              <div className="quick-actions">
                <div className="quantity-control large"><button onClick={() => setQuickQuantity(q => Math.max(1, q - 1))}><Minus /></button><span>{quickQuantity}</span><button onClick={() => setQuickQuantity(q => q + 1)}><Plus /></button></div>
                <button className="primary-button" onClick={() => { addToCart(quickProduct.id, quickQuantity); setQuickProduct(null); setCartOpen(true) }}><ShoppingBag /> {t.add}</button>
              </div>
              <div className="quick-meta"><span><Truck /> {t.deliverySub}</span><span><BadgeCheck /> {t.brandNote}</span></div>
            </div>
          </div>
        </div>
      )}

      {checkoutOpen && (
        <div className="overlay modal-overlay checkout-overlay" onMouseDown={() => setCheckoutOpen(false)}>
          <div className="checkout-modal" role="dialog" aria-modal="true" onMouseDown={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setCheckoutOpen(false)} aria-label={t.close}><X /></button>
            <div className="checkout-header"><img src={assetPath('assets/logo.png')} alt="" /><div><h2>{t.checkoutTitle}</h2><p>{t.checkoutSubtitle}</p></div></div>
            <form onSubmit={submitOrder}>
              <div className="form-grid">
                <label><span>{t.fullName}</span><input name="name" required autoComplete="name" /></label>
                <label><span>{t.phone}</span><input name="phone" required type="tel" dir="ltr" inputMode="tel" placeholder="05 / 06 / 07" pattern="[0-9 +]{9,15}" /></label>
                <label><span>{t.wilaya}</span><select name="wilaya" required defaultValue=""><option value="" disabled>{t.selectWilaya}</option>{wilayas.map(w => <option key={w}>{w}</option>)}</select></label>
                <label><span>{t.city}</span><input name="city" required /></label>
                <label className="wide"><span>{t.address}</span><input name="address" required /></label>
                <label className="wide"><span>{t.note}</span><textarea name="note" rows={2} /></label>
              </div>
              <div className="checkout-total"><span>{t.total}</span><b>{money(subtotal)}</b></div>
              <button className="primary-button full" type="submit"><PackageCheck /> {t.confirmOrder}</button>
              <button className="back-button" type="button" onClick={() => { setCheckoutOpen(false); setCartOpen(true) }}>{isAr ? <ChevronRight /> : <ChevronLeft />} {t.backToCart}</button>
            </form>
          </div>
        </div>
      )}

      {loginOpen && (
        <div className="overlay modal-overlay auth-overlay" onMouseDown={() => setLoginOpen(false)}>
          <div className="login-modal" role="dialog" aria-modal="true" aria-labelledby="login-title" onMouseDown={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setLoginOpen(false)} aria-label={t.close}><X /></button>
            <div className="login-brand"><img src={assetPath('assets/logo.png')} alt="Elegance Home & Style" /></div>
            <p className="login-kicker"><LockKeyhole /> {isAr ? 'دخول آمن' : 'Accès sécurisé'}</p>
            <h2 id="login-title">{isAr ? 'بوابة دخول إدارة المتجر' : 'Portail d’administration'}</h2>
            <p className="login-intro">{isAr ? 'أدخل بيانات المالك للوصول الآمن إلى مركز تحكم Elegance.' : 'Saisissez les identifiants du propriétaire pour accéder au centre de contrôle Elegance.'}</p>
            <form onSubmit={handleLogin}>
              <label>
                <span>{isAr ? 'البريد الإلكتروني' : 'Adresse e-mail'}</span>
                <div className="auth-input"><Mail /><input name="email" type="email" required autoComplete="username" dir="ltr" placeholder="name@email.com" /></div>
              </label>
              <label>
                <span>{isAr ? 'كلمة السر' : 'Mot de passe'}</span>
                <div className="auth-input"><KeyRound /><input name="password" type={showPassword ? 'text' : 'password'} required autoComplete="current-password" dir="ltr" />
                  <button type="button" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff /> : <Eye />}</button>
                </div>
              </label>
              {authError && <div className="auth-error" role="alert">{authError}</div>}
              <button className="primary-button full login-submit" type="submit" disabled={loginPending}>
                {loginPending ? <span className="button-spinner" /> : <LockKeyhole />}
                {loginPending ? (isAr ? 'جارٍ التحقق...' : 'Vérification...') : (isAr ? 'تسجيل الدخول' : 'Se connecter')}
              </button>
            </form>
            <p className="auth-security"><LockKeyhole /> {isAr ? 'تُقفل اللوحة تلقائياً عند إغلاقها وتعود بوابة الدخول.' : 'Le tableau se verrouille automatiquement à sa fermeture.'}</p>
          </div>
        </div>
      )}

      {accountOpen && isAuthenticated && (
        <div className="overlay modal-overlay account-overlay">
          <DashboardErrorBoundary lang={lang} onClose={lockDashboard}>
            <AdminDashboard
              lang={lang}
              logo={assetPath('assets/logo.png')}
              products={catalogProducts}
              orders={storedOrders}
              cartCount={cartCount}
              money={money}
              onClose={lockDashboard}
              onLogout={logout}
              onOpenStore={() => { lockDashboard(); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
              onAddProduct={addDashboardProduct}
              onUpdateProduct={updateDashboardProduct}
              onDuplicateProduct={duplicateDashboardProduct}
              onDeleteProducts={deleteDashboardProducts}
              onSetProductsStatus={setDashboardProductsStatus}
              onRestoreProducts={() => setCatalogProducts(defaultProducts)}
            />
          </DashboardErrorBoundary>
        </div>
      )}

      {orderId && (
        <div className="overlay modal-overlay success-overlay">
          <div className="success-modal" role="dialog" aria-modal="true">
            <div className="success-icon"><Check /></div>
            <img src={assetPath('assets/logo.png')} alt="Elegance Home & Style" />
            <h2>{t.successTitle}</h2><p>{t.successText}</p>
            <div className="order-number"><span>{t.orderNumber}</span><b dir="ltr">{orderId}</b></div>
            <button className="primary-button" onClick={() => { setOrderId(null); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>{t.backHome}</button>
          </div>
        </div>
      )}

      {toast && <div className="toast"><CircleCheck /> {toast}</div>}
    </div>
  )
}

function TrustItem({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return <div className="trust-item"><div>{icon}</div><p><b>{title}</b><span>{text}</span></p></div>
}

function SectionHeading({ eyebrow, title, text }: { eyebrow: string; title: string; text?: string }) {
  return <div className="section-heading"><p className="eyebrow"><span /> {eyebrow} <span /></p><h2>{title}</h2>{text && <p className="section-intro">{text}</p>}</div>
}

function CollectionCard({ image, title, subtitle, button, onClick, featured = false }: { image: string; title: string; subtitle: string; button: string; onClick: () => void; featured?: boolean }) {
  return (
    <article className={`collection-card ${featured ? 'featured' : ''}`} onClick={onClick} tabIndex={0} onKeyDown={e => e.key === 'Enter' && onClick()}>
      <img src={image} alt={title} /><div className="collection-shade" />
      <div className="collection-copy"><p>{subtitle}</p><h3>{title}</h3><button>{button} <ArrowLeft /></button></div>
    </article>
  )
}

function ProductCard({ product, lang, money, wished, onWish, onQuick, onAdd, quickLabel, addLabel, categoryLabel }: {
  product: Product; lang: Lang; money: (value: number) => string; wished: boolean; onWish: () => void; onQuick: () => void; onAdd: () => void; quickLabel: string; addLabel: string; categoryLabel: string
}) {
  return (
    <article className="product-card">
      <div className="product-image-wrap">
        <StoredImage className="product-primary-image" src={product.image} alt={product.name[lang]} loading="lazy" />
        {(product.images?.length ?? 0) > 1 && <StoredImage className="product-secondary-image" src={product.images![1]} alt="" loading="lazy" />}
        {product.badge && <span className="product-badge">{product.badge[lang]}</span>}
        <button className={`wish-button ${wished ? 'active' : ''}`} onClick={onWish} aria-label="wishlist"><Heart fill={wished ? 'currentColor' : 'none'} /></button>
        <button className="quick-button" onClick={onQuick}><Search /> {quickLabel}</button>
      </div>
      <div className="product-info">
        <div className="product-meta"><span>{categoryLabel}</span><span><Star fill="currentColor" /> {product.rating}</span></div>
        <h3 onClick={onQuick}>{product.name[lang]}</h3>
        <div className="product-buy">
          <p><b>{money(product.price)}</b>{product.oldPrice && <del>{money(product.oldPrice)}</del>}</p>
          <button onClick={onAdd} aria-label={addLabel}><ShoppingBag /><span>{addLabel}</span></button>
        </div>
      </div>
    </article>
  )
}

function PromiseCard({ number, icon, title, text }: { number: string; icon: React.ReactNode; title: string; text: string }) {
  return <article className="promise-card"><span className="promise-number">{number}</span><div className="promise-icon">{icon}</div><h3>{title}</h3><p>{text}</p></article>
}

function ReviewCard({ text, name, place, featured = false }: { text: string; name: string; place: string; featured?: boolean }) {
  return (
    <article className={`review-card ${featured ? 'featured' : ''}`}>
      <div className="review-stars">{Array.from({ length: 5 }).map((_, i) => <Star key={i} fill="currentColor" />)}</div>
      <blockquote>“{text}”</blockquote>
      <div className="review-author"><div>{name.charAt(0)}</div><p><b>{name}</b><span>{place}</span></p><BadgeCheck /></div>
    </article>
  )
}

type DashboardErrorBoundaryProps = { children: ReactNode; lang: Lang; onClose: () => void }

class DashboardErrorBoundary extends Component<DashboardErrorBoundaryProps, { hasError: boolean }> {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  resetDashboard = () => {
    try {
      ['ehs-landing-pages', 'ehs-dashboard-pixels', 'ehs-team', 'ehs-sheets', 'ehs-delivery', 'ehs-domain', 'ehs-api-key'].forEach(key => localStorage.removeItem(key))
    } catch { /* Storage may be restricted. */ }
    this.setState({ hasError: false })
  }

  render() {
    if (!this.state.hasError) return this.props.children
    const ar = this.props.lang === 'ar'
    return <div className="dashboard-error-fallback" dir={ar ? 'rtl' : 'ltr'}>
      <CircleAlert size={34} />
      <h2>{ar ? 'تعذر فتح لوحة التحكم' : 'Impossible d’ouvrir le tableau de bord'}</h2>
      <p>{ar ? 'قد تكون هناك إعدادات قديمة أو غير متوافقة في المتصفح. يمكنك إصلاحها دون حذف المنتجات أو الطلبات.' : 'Des paramètres anciens peuvent être incompatibles. Réinitialisez-les sans supprimer les produits ni les commandes.'}</p>
      <div><button className="primary-button" onClick={this.resetDashboard}>{ar ? 'إصلاح وإعادة المحاولة' : 'Réparer et réessayer'}</button><button className="outline-button" onClick={this.props.onClose}>{ar ? 'العودة للمتجر' : 'Retour à la boutique'}</button></div>
    </div>
  }
}

export default App
