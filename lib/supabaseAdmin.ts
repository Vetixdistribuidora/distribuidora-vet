import { createClient } from "@supabase/supabase-js"

/**
 * Cliente Supabase con service_role — bypasea RLS.
 * SOLO usar en API routes (servidor). Nunca importar en "use client" components.
 */
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
