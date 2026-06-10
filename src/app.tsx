import type { PropsWithChildren } from 'react'
import './app.scss'

const storageKey = 'wedding-seating-demo-state'
const bridgeMessageSource = 'wedding-seating-storage-bridge'
const bridgeAttemptKey = 'wedding-seating-storage-bridge-attempted-v2'

function getPlanGuestCount(plan: any) {
  return Array.isArray(plan?.guests) ? plan.guests.length : 0
}

function getStoredGuestCount(raw: string | null) {
  if (!raw) {
    return 0
  }

  try {
    const parsed = JSON.parse(raw)
    const payload = parsed?.data ?? parsed

    if (Array.isArray(payload?.plans)) {
      return payload.plans.reduce((maxCount: number, variant: any) => Math.max(maxCount, getPlanGuestCount(variant?.plan)), 0)
    }

    return getPlanGuestCount(payload)
  } catch {
    return 0
  }
}

function restoreRawIfBetter(raw: string | null) {
  const currentRaw = window.localStorage.getItem(storageKey)

  if (getStoredGuestCount(raw) <= getStoredGuestCount(currentRaw)) {
    return false
  }

  window.localStorage.setItem(storageKey, raw as string)
  window.location.reload()
  return true
}

function migrateLocalStorageOrigin() {
  if (typeof window === 'undefined') {
    return
  }

  const { hostname, href } = window.location

  if (hostname === '127.0.0.1') {
    window.location.replace(href.replace('//127.0.0.1', '//localhost'))
    return
  }

  if (hostname !== 'localhost' || window.sessionStorage.getItem(bridgeAttemptKey)) {
    return
  }

  window.sessionStorage.setItem(bridgeAttemptKey, '1')

  const bridgeOrigin = `http://127.0.0.1${window.location.port ? `:${window.location.port}` : ''}`
  const bridge = document.createElement('iframe')

  bridge.src = `${bridgeOrigin}/static/storage-bridge.html?target=${encodeURIComponent(window.location.origin)}`
  bridge.style.display = 'none'
  bridge.title = 'storage migration bridge'

  const handleMessage = (event: MessageEvent) => {
    if (event.origin !== bridgeOrigin || event.data?.source !== bridgeMessageSource) {
      return
    }

    const migratedRaw = typeof event.data.raw === 'string' ? event.data.raw : null

    window.removeEventListener('message', handleMessage)
    bridge.remove()

    restoreRawIfBetter(migratedRaw)
  }

  window.addEventListener('message', handleMessage)
  document.body.appendChild(bridge)

  window
    .fetch('/static/local-recovery.json', { cache: 'no-store' })
    .then((response) => (response.ok ? response.json() : null))
    .then((data) => {
      const raw = typeof data?.raw === 'string' ? data.raw : null
      restoreRawIfBetter(raw)
    })
    .catch(() => undefined)
}

export default function App(props: PropsWithChildren) {
  migrateLocalStorageOrigin()

  return props.children
}
