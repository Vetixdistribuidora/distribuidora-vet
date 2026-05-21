import { createClient } from '@supabase/supabase-js'

/**
 * Fetch con timeout de 25 segundos y manejo de red offline.
 *
 * Sin esto, si hay un problema de red una request puede quedar colgada
 * indefinidamente, dejando los botones bloqueados (el finally nunca corre).
 *
 * Con esto:
 *  - Si no hay red: error inmediato
 *  - Si la request cuelga: se cancela a los 25s con mensaje claro
 *  - El AbortError genérico se convierte en mensaje entendible
 */
function fetchConTimeout(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  // Detección inmediata de red caída (sin esperar timeout)
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return Promise.reject(new Error('Sin conexión a internet. Verificá tu red e intentá de nuevo.'))
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 25_000)

  // Propagar señal existente del caller (si la hay) al nuestro
  const existingSignal = init?.signal
  if (existingSignal) {
    if (existingSignal.aborted) {
      controller.abort()
    } else {
      existingSignal.addEventListener('abort', () => controller.abort(), { once: true })
    }
  }

  return fetch(input, { ...init, signal: controller.signal })
    .catch(err => {
      // Convertir el AbortError genérico en un mensaje entendible
      if (err?.name === 'AbortError') {
        throw new Error('La operación tardó demasiado. Verificá tu conexión e intentá de nuevo.')
      }
      throw err
    })
    .finally(() => clearTimeout(timer))
}

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { global: { fetch: fetchConTimeout } }
)
