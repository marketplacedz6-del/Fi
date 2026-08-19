export type StoreOrder = {
  id: string
  customer: Record<string, FormDataEntryValue>
  items: { id: number; quantity: number }[]
  total: number
  date: string
  status: string
}

const urls = (value: string | undefined) =>
  (value ?? '').split(',').map(url => url.trim()).filter(Boolean)

/**
 * Sends a new order to any configured CRM/API, delivery provider webhooks,
 * and Google Sheets web apps. The local order remains available if a remote
 * integration is temporarily unavailable.
 */
export async function dispatchOrder(order: StoreOrder) {
  let dashboardSheets: string[] = []
  try {
    const savedSheets = JSON.parse(localStorage.getItem('ehs-sheets') ?? '[]') as { url: string; active: boolean }[]
    dashboardSheets = savedSheets.filter(sheet => sheet.active && sheet.url).map(sheet => sheet.url)
  } catch {
    // Keep checkout operational even if a local integration is malformed.
  }

  const endpoints = [...new Set([
    ...urls(import.meta.env.VITE_ORDER_API_URL),
    ...urls(import.meta.env.VITE_DELIVERY_WEBHOOK_URLS),
    ...urls(import.meta.env.VITE_GOOGLE_SHEETS_WEBHOOK_URLS),
    ...dashboardSheets,
  ])]

  if (!endpoints.length) return []

  return Promise.allSettled(endpoints.map(endpoint => fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(order),
  })))
}
