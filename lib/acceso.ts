// ── Control de acceso al sistema interno de la distribuidora ──────────────────
// SOLO estos emails pueden entrar. Cualquier otra cuenta (incluidos los clientes
// que se registran en la tienda online, que comparte el mismo Supabase) queda
// bloqueada. El registro de nuevos usuarios está deshabilitado.
//
// Para dar de alta a alguien nuevo: agregá su email acá en minúsculas y volvé
// a deployar. No hay otra forma de habilitar el acceso.
export const EMAILS_AUTORIZADOS = [
  "santiagozabalegui@gmail.com",
  "clauforte@gmail.com",
]

export function esEmailAutorizado(email: string | null | undefined): boolean {
  if (!email) return false
  return EMAILS_AUTORIZADOS.includes(email.trim().toLowerCase())
}
