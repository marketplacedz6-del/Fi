type CommercePayload = {
  content_ids?: number[]
  content_name?: string
  value?: number
  currency?: string
  quantity?: number
  order_id?: string
}

type PixelFunction = ((...args: unknown[]) => void) & { queue?: unknown[][]; loaded?: boolean; version?: string }
type TikTokQueue = unknown[] & { load?: (id: string) => void; page?: () => void; track?: (event: string, payload?: CommercePayload) => void }

declare global {
  interface Window {
    fbq?: PixelFunction
    _fbq?: PixelFunction
    dataLayer?: unknown[]
    gtag?: (...args: unknown[]) => void
    ttq?: TikTokQueue
    pintrk?: PixelFunction
    snaptr?: PixelFunction
  }
}

const ids = (value: string | undefined) =>
  (value ?? '').split(',').map(id => id.trim()).filter(Boolean)

const environmentPixelIds = {
  meta: ids(import.meta.env.VITE_META_PIXEL_IDS),
  tiktok: ids(import.meta.env.VITE_TIKTOK_PIXEL_IDS),
  google: ids(import.meta.env.VITE_GOOGLE_TAG_IDS),
  pinterest: ids(import.meta.env.VITE_PINTEREST_TAG_IDS),
  snapchat: ids(import.meta.env.VITE_SNAPCHAT_PIXEL_IDS),
}

type RuntimeProvider = 'Meta' | 'TikTok' | 'Google' | 'Pinterest' | 'Snapchat'
type RuntimePixel = { provider: RuntimeProvider; pixelId: string; active: boolean }

const configuredPixelIds = () => {
  const configured = {
    meta: [...environmentPixelIds.meta],
    tiktok: [...environmentPixelIds.tiktok],
    google: [...environmentPixelIds.google],
    pinterest: [...environmentPixelIds.pinterest],
    snapchat: [...environmentPixelIds.snapchat],
  }
  try {
    const runtime = JSON.parse(localStorage.getItem('ehs-dashboard-pixels') ?? '[]') as RuntimePixel[]
    runtime.filter(pixel => pixel.active).forEach(pixel => {
      const key = pixel.provider.toLowerCase() as keyof typeof configured
      if (!configured[key].includes(pixel.pixelId)) configured[key].push(pixel.pixelId)
    })
  } catch {
    // Invalid local configuration should never block the storefront.
  }
  return configured
}

const addScript = (id: string, source: string) => {
  if (document.getElementById(id)) return
  const script = document.createElement('script')
  script.id = id
  script.async = true
  script.src = source
  document.head.appendChild(script)
}

const makeQueue = (name: 'fbq' | 'pintrk' | 'snaptr') => {
  if (window[name]) return window[name]!
  const queue: PixelFunction = (...args: unknown[]) => { queue.queue?.push(args) }
  queue.queue = []
  window[name] = queue
  return queue
}

export function initializeAnalytics() {
  const pixelIds = configuredPixelIds()

  if (pixelIds.meta.length) {
    const fbq = makeQueue('fbq')
    window._fbq = fbq
    addScript('ehs-meta-pixel', 'https://connect.facebook.net/en_US/fbevents.js')
    pixelIds.meta.forEach(id => fbq('init', id))
    fbq('track', 'PageView')
  }

  if (pixelIds.google.length) {
    window.dataLayer = window.dataLayer ?? []
    window.gtag = window.gtag ?? ((...args: unknown[]) => window.dataLayer?.push(args))
    window.gtag('js', new Date())
    addScript('ehs-google-tag', `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(pixelIds.google[0])}`)
    pixelIds.google.forEach(id => window.gtag?.('config', id))
  }

  if (pixelIds.tiktok.length) {
    window.ttq = window.ttq ?? []
    window.ttq.track = window.ttq.track ?? ((...args: unknown[]) => window.ttq?.push(['track', ...args]))
    window.ttq.page = window.ttq.page ?? (() => window.ttq?.push(['page']))
    window.ttq.load = window.ttq.load ?? ((id: string) => {
      addScript(`ehs-tiktok-${id}`, `https://analytics.tiktok.com/i18n/pixel/events.js?sdkid=${encodeURIComponent(id)}&lib=ttq`)
    })
    pixelIds.tiktok.forEach(id => window.ttq?.load?.(id))
    window.ttq.page()
  }

  if (pixelIds.pinterest.length) {
    const pintrk = makeQueue('pintrk')
    addScript('ehs-pinterest-tag', 'https://s.pinimg.com/ct/core.js')
    pixelIds.pinterest.forEach(id => pintrk('load', id))
    pintrk('page')
  }

  if (pixelIds.snapchat.length) {
    const snaptr = makeQueue('snaptr')
    addScript('ehs-snapchat-pixel', 'https://sc-static.net/scevent.min.js')
    pixelIds.snapchat.forEach(id => snaptr('init', id))
    snaptr('track', 'PAGE_VIEW')
  }
}

/** Activates a pixel added from the smart dashboard without requiring a rebuild. */
export function registerRuntimePixel(provider: RuntimeProvider, pixelId: string) {
  const id = pixelId.trim()
  if (!id) return

  if (provider === 'Meta') {
    const fbq = makeQueue('fbq')
    window._fbq = fbq
    addScript('ehs-meta-pixel', 'https://connect.facebook.net/en_US/fbevents.js')
    fbq('init', id)
    fbq('track', 'PageView')
  } else if (provider === 'Google') {
    window.dataLayer = window.dataLayer ?? []
    window.gtag = window.gtag ?? ((...args: unknown[]) => window.dataLayer?.push(args))
    addScript('ehs-google-tag', `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`)
    window.gtag('config', id)
  } else if (provider === 'TikTok') {
    window.ttq = window.ttq ?? []
    window.ttq.track = window.ttq.track ?? ((...args: unknown[]) => window.ttq?.push(['track', ...args]))
    window.ttq.page = window.ttq.page ?? (() => window.ttq?.push(['page']))
    addScript(`ehs-tiktok-${id}`, `https://analytics.tiktok.com/i18n/pixel/events.js?sdkid=${encodeURIComponent(id)}&lib=ttq`)
    window.ttq.page?.()
  } else if (provider === 'Pinterest') {
    const pintrk = makeQueue('pintrk')
    addScript('ehs-pinterest-tag', 'https://s.pinimg.com/ct/core.js')
    pintrk('load', id)
    pintrk('page')
  } else if (provider === 'Snapchat') {
    const snaptr = makeQueue('snaptr')
    addScript('ehs-snapchat-pixel', 'https://sc-static.net/scevent.min.js')
    snaptr('init', id)
    snaptr('track', 'PAGE_VIEW')
  }
}

export function trackCommerceEvent(event: 'ViewContent' | 'AddToCart' | 'InitiateCheckout' | 'Purchase', payload: CommercePayload = {}) {
  window.fbq?.('track', event, payload)
  window.ttq?.track?.(event, payload)
  window.gtag?.('event', event.toLowerCase(), payload)

  const pinterestEvent = event === 'Purchase' ? 'checkout' : event === 'AddToCart' ? 'addtocart' : 'pagevisit'
  window.pintrk?.('track', pinterestEvent, payload)

  const snapchatEvent = event === 'ViewContent' ? 'VIEW_CONTENT' : event === 'AddToCart' ? 'ADD_CART' : event === 'InitiateCheckout' ? 'START_CHECKOUT' : 'PURCHASE'
  window.snaptr?.('track', snapchatEvent, payload)
}
