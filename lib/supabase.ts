import { createClient } from '@supabase/supabase-js'

// Wrapper de fetch con timeout de 10 segundos.
// Cuando el token JWT expira, Supabase hace un refresh request en background.
// Sin timeout, ese request puede colgar indefinidamente (red lenta, servidor no responde),
// dejando TODAS las queries en cola para siempre → todas las páginas muestran "Cargando..." para siempre.
// Con este timeout, si el refresh no responde en 10s, falla limpiamente →
// Supabase dispara SIGNED_OUT → AuthGuard redirige al login → usuario vuelve a entrar con sesión fresca.
function fetchConTimeout(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 10_000)
  return fetch(input, { ...init, signal: controller.signal })
    .finally(() => clearTimeout(timer))
}

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    global: { fetch: fetchConTimeout },
  }
)
