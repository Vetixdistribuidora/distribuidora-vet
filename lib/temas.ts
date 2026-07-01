// Paletas de color que el cliente puede elegir desde Configuración.
// Recolorean el menú lateral (sidebar), el ítem activo, los degradados del
// header/avatar, el fondo del contenido y las variables CSS de acento.
export interface Tema {
  label: string
  sidebarBg: string   // fondo del menú lateral (puede ser degradado)
  activeBg: string    // fondo del ítem activo
  accent: string      // acento del sidebar (borde activo, punto de muestra — tono claro)
  grad: string        // degradado (badge del header, avatar, botones del chrome)
  glow: string        // sombra/resplandor
  pageBg: string      // fondo del contenido (canvas de las páginas)
  page: string        // --accent (medio)  → contenido que use var(--accent)
  pageDark: string    // --accent-dark (oscuro)
  pageLight: string   // --accent-light (claro)
}

export const TEMAS: Record<string, Tema> = {
  rosa:     { label: "Rosa/Navy", sidebarBg: "linear-gradient(180deg,#1d3461,#15264a 60%,#101d3a)", activeBg: "rgba(246,201,221,0.16)", accent: "#f6c9dd", grad: "linear-gradient(135deg,#1d3461,#15264a)", glow: "rgba(21,38,74,0.30)",  pageBg: "#fbeaf2", page: "#1d3461", pageDark: "#15264a", pageLight: "#3f5f9e" },
  azul:     { label: "Azul",      sidebarBg: "linear-gradient(180deg,#12233f,#0d1424)",              activeBg: "rgba(111,154,219,0.16)", accent: "#6f9adb", grad: "linear-gradient(135deg,#2c4b7a,#3f6fb0)", glow: "rgba(55,80,140,0.4)",  pageBg: "#eef2f8", page: "#3f6fb0", pageDark: "#2c4b7a", pageLight: "#6f9adb" },
  olivo:    { label: "Olivo",     sidebarBg: "linear-gradient(180deg,#232414,#14130d)",              activeBg: "rgba(138,154,91,0.18)",  accent: "#8a9a5b", grad: "linear-gradient(135deg,#4b5a2c,#6f7d49)", glow: "rgba(80,96,55,0.4)",   pageBg: "#f6f5ec", page: "#6f7d49", pageDark: "#4b5a2c", pageLight: "#8a9a5b" },
  bordo:    { label: "Bordó",     sidebarBg: "linear-gradient(180deg,#2c151b,#1c0f12)",              activeBg: "rgba(207,133,147,0.18)", accent: "#cf8593", grad: "linear-gradient(135deg,#7a2c3a,#a83f53)", glow: "rgba(140,55,70,0.4)",  pageBg: "#f8eef0", page: "#a83f53", pageDark: "#7a2c3a", pageLight: "#cf8593" },
  grafito:  { label: "Grafito",   sidebarBg: "linear-gradient(180deg,#1e2126,#121316)",              activeBg: "rgba(154,163,173,0.18)", accent: "#9aa3ad", grad: "linear-gradient(135deg,#3a414b,#5b6470)", glow: "rgba(80,90,100,0.4)",  pageBg: "#f1f2f4", page: "#5b6470", pageDark: "#3a414b", pageLight: "#9aa3ad" },
  turquesa: { label: "Turquesa",  sidebarBg: "linear-gradient(180deg,#0f2727,#0c1a1a)",              activeBg: "rgba(94,197,192,0.18)",  accent: "#5ec5c0", grad: "linear-gradient(135deg,#1f6b66,#2f9e96)", glow: "rgba(45,140,130,0.4)", pageBg: "#e9f4f3", page: "#2f9e96", pageDark: "#1f6b66", pageLight: "#5ec5c0" },
  violeta:  { label: "Violeta",   sidebarBg: "linear-gradient(180deg,#241832,#16101f)",              activeBg: "rgba(169,139,214,0.18)", accent: "#a98bd6", grad: "linear-gradient(135deg,#4b2c7a,#6f49b0)", glow: "rgba(90,55,140,0.4)",  pageBg: "#f2edf8", page: "#6f49b0", pageDark: "#4b2c7a", pageLight: "#a98bd6" },
}

export const TEMA_DEFAULT = "rosa"

export function getTema(key?: string | null): Tema {
  return TEMAS[key || ""] || TEMAS[TEMA_DEFAULT]
}
