"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { supabase } from "../../lib/supabase";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Merma {
  id: number;
  producto_id: number | null;
  producto_nombre: string;
  cantidad: number;
  motivo: string;
  fecha: string;
  costo_unitario: number;
  precio_venta_ref: number;
  lote: string | null;
  notas: string | null;
  created_at: string;
}

interface ProductoOpt {
  id: number;
  nombre: string;
  costo: number;
  precio_venta: number;
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const MOTIVOS: Record<string, { label: string; color: string; bg: string; border: string }> = {
  vencimiento: { label: "Vencimiento", color: "#b45309", bg: "#fef9c3", border: "#fde68a" },
  daño:        { label: "Daño",        color: "#9a3412", bg: "#ffedd5", border: "#fed7aa" },
  robo:        { label: "Robo",        color: "#7c3aed", bg: "#ede9fe", border: "#ddd6fe" },
  otro:        { label: "Otro",        color: "#0369a1", bg: "#e0f2fe", border: "#bae6fd" },
};

const EMPTY_FORM = {
  producto_nombre: "",
  producto_id: "" as string | number,
  cantidad: "",
  motivo: "vencimiento",
  fecha: new Date().toISOString().slice(0, 10),
  costo_unitario: "",
  precio_venta_ref: "",
  lote: "",
  notas: "",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return n.toLocaleString("es-AR", { style: "currency", currency: "ARS" });
}

function fmtNum(n: number, dec = 2) {
  return n.toLocaleString("es-AR", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

// ─── Estilos reutilizables ────────────────────────────────────────────────────

const inputLight: React.CSSProperties = {
  width: "100%", padding: "10px 14px",
  border: "1px solid #e2e8f0", borderRadius: 10,
  fontSize: 14, color: "#111827", outline: "none",
  boxSizing: "border-box", background: "white",
};

const labelStyle: React.CSSProperties = {
  display: "block", fontSize: 11, fontWeight: 700,
  color: "#6b7280", letterSpacing: 0.5, marginBottom: 5,
  textTransform: "uppercase",
};

const btnPrimario: React.CSSProperties = {
  background: "linear-gradient(135deg, #2563eb, #3b82f6)",
  color: "white", border: "none", borderRadius: 10,
  padding: "11px 22px", fontSize: 14, fontWeight: 700, cursor: "pointer",
  boxShadow: "0 2px 8px rgba(59,130,246,0.3)",
};

const btnSecundario: React.CSSProperties = {
  background: "#f1f5f9", color: "#374151",
  border: "1px solid #e2e8f0", borderRadius: 10,
  padding: "10px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer",
};

// ─── Componente principal ─────────────────────────────────────────────────────

export default function MermasPage() {
  const [mermas, setMermas] = useState<Merma[]>([]);
  const [productos, setProductos] = useState<ProductoOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [toast, setToast] = useState<{ msg: string; tipo: "ok" | "error" } | null>(null);

  // Filtros
  const [filtroPeriodo, setFiltroPeriodo] = useState<"todo" | "hoy" | "semana" | "mes">("todo");
  const [filtroMotivo, setFiltroMotivo] = useState("todos");
  const [busqueda, setBusqueda] = useState("");

  // Modal
  const [modalAbierto, setModalAbierto] = useState(false);
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });

  // Confirmación borrar
  const [confirmId, setConfirmId] = useState<number | null>(null);

  // Autocomplete de producto
  const [prodSuggestions, setProdSuggestions] = useState<ProductoOpt[]>([]);
  const [showSugg, setShowSugg] = useState(false);
  const prodInputRef = useRef<HTMLInputElement>(null);
  const suggBoxRef = useRef<HTMLDivElement>(null);

  // ── Carga inicial ────────────────────────────────────────────────────────────

  useEffect(() => {
    async function cargar() {
      // Cargar mermas y primera página de productos en paralelo
      const [mRes, primeraPage] = await Promise.all([
        supabase.from("mermas").select("*").order("fecha", { ascending: false }).order("created_at", { ascending: false }),
        supabase.from("productos").select("id, nombre, costo, precio_venta").order("nombre").range(0, 999),
      ]);
      if (mRes.data) setMermas(mRes.data);

      // Paginar el resto de productos si hay más de 1000
      let todos = primeraPage.data || [];
      let desde = 1000;
      while ((primeraPage.data?.length ?? 0) === 1000 || desde > 1000) {
        if (desde === 1000 && (primeraPage.data?.length ?? 0) < 1000) break;
        const { data } = await supabase
          .from("productos")
          .select("id, nombre, costo, precio_venta")
          .order("nombre")
          .range(desde, desde + 999);
        if (!data?.length) break;
        todos = [...todos, ...data];
        if (data.length < 1000) break;
        desde += 1000;
      }
      setProductos(todos);
      setLoading(false);
    }
    cargar();
  }, []);

  // ── Toast ────────────────────────────────────────────────────────────────────

  function mostrarToast(msg: string, tipo: "ok" | "error") {
    setToast({ msg, tipo });
    setTimeout(() => setToast(null), 3000);
  }

  // ── Autocomplete producto ─────────────────────────────────────────────────────

  function onProdInput(val: string) {
    setForm(f => ({ ...f, producto_nombre: val, producto_id: "" }));
    if (val.length < 1) { setProdSuggestions([]); setShowSugg(false); return; }
    const termino = val.trim().replace(/\s+/g, " ").toLowerCase();
    const palabras = termino.split(" ").filter(Boolean);
    const sugs = productos.filter(p => {
      const campo = p.nombre.toLowerCase();
      // Coincidencia exacta de frase O todas las palabras presentes (en cualquier orden)
      return campo.includes(termino) || palabras.every(w => campo.includes(w));
    }).slice(0, 10);
    setProdSuggestions(sugs);
    setShowSugg(sugs.length > 0);
  }

  function seleccionarProducto(p: ProductoOpt) {
    setForm(f => ({
      ...f,
      producto_id: p.id,
      producto_nombre: p.nombre,
      costo_unitario: String(p.costo),
      precio_venta_ref: String(p.precio_venta),
    }));
    setShowSugg(false);
    setProdSuggestions([]);
  }

  // Cerrar sugerencias al hacer click afuera
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        prodInputRef.current && !prodInputRef.current.contains(e.target as Node) &&
        suggBoxRef.current && !suggBoxRef.current.contains(e.target as Node)
      ) {
        setShowSugg(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // ── Filtrado ──────────────────────────────────────────────────────────────────

  const mermasFiltradas = useMemo(() => {
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    const inicioSemana = new Date(hoy); inicioSemana.setDate(hoy.getDate() - hoy.getDay());
    const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);

    return mermas.filter(m => {
      // Período
      if (filtroPeriodo !== "todo" && m.fecha) {
        const d = new Date(m.fecha + "T00:00:00");
        if (filtroPeriodo === "hoy"    && d < hoy) return false;
        if (filtroPeriodo === "semana" && d < inicioSemana) return false;
        if (filtroPeriodo === "mes"    && d < inicioMes) return false;
      }
      // Motivo
      if (filtroMotivo !== "todos" && m.motivo !== filtroMotivo) return false;
      // Búsqueda
      if (busqueda) {
        const q = busqueda.toLowerCase();
        const en = [m.producto_nombre, m.lote ?? "", m.notas ?? ""].join(" ").toLowerCase();
        if (!en.includes(q)) return false;
      }
      return true;
    });
  }, [mermas, filtroPeriodo, filtroMotivo, busqueda]);

  // ── Totales ───────────────────────────────────────────────────────────────────

  const totales = useMemo(() => {
    let perdidaCosto = 0, perdidaMargen = 0, unidades = 0;
    const productosSet = new Set<string>();
    for (const m of mermasFiltradas) {
      const c = m.costo_unitario * m.cantidad;
      const margen = (m.precio_venta_ref - m.costo_unitario) * m.cantidad;
      perdidaCosto  += c;
      perdidaMargen += margen;
      unidades      += m.cantidad;
      productosSet.add(m.producto_nombre);
    }
    return { perdidaCosto, perdidaMargen, perdidaTotal: perdidaCosto + perdidaMargen, unidades, productosAfectados: productosSet.size };
  }, [mermasFiltradas]);

  // ── CRUD ──────────────────────────────────────────────────────────────────────

  // Ajusta el stock de un producto: delta positivo = reduce stock, negativo = restaura
  async function ajustarStock(productoId: number, delta: number) {
    if (!productoId || delta === 0) return;
    const { data: prod } = await supabase
      .from("productos").select("stock").eq("id", productoId).single();
    if (!prod) return;
    const nuevoStock = Math.max(0, Number(prod.stock) - delta);
    await supabase.from("productos").update({ stock: nuevoStock }).eq("id", productoId);
  }

  function abrirCrear() {
    setEditandoId(null);
    setForm({ ...EMPTY_FORM, fecha: new Date().toISOString().slice(0, 10) });
    setShowSugg(false);
    setModalAbierto(true);
  }

  function abrirEditar(m: Merma) {
    setEditandoId(m.id);
    setForm({
      producto_nombre: m.producto_nombre,
      producto_id: m.producto_id ?? "",
      cantidad: String(m.cantidad),
      motivo: m.motivo,
      fecha: m.fecha,
      costo_unitario: String(m.costo_unitario),
      precio_venta_ref: String(m.precio_venta_ref),
      lote: m.lote ?? "",
      notas: m.notas ?? "",
    });
    setShowSugg(false);
    setModalAbierto(true);
  }

  async function guardar() {
    if (!form.producto_nombre.trim()) { mostrarToast("⚠️ Indicá el producto", "error"); return; }
    if (!form.cantidad || Number(form.cantidad) <= 0) { mostrarToast("⚠️ La cantidad debe ser mayor a 0", "error"); return; }
    if (!form.fecha) { mostrarToast("⚠️ Indicá la fecha", "error"); return; }

    setGuardando(true);
    try {
      const nuevoProdId = form.producto_id !== "" ? Number(form.producto_id) : null;
      const nuevaCant   = Number(form.cantidad);

      const payload = {
        producto_id: nuevoProdId,
        producto_nombre: form.producto_nombre.trim(),
        cantidad: nuevaCant,
        motivo: form.motivo,
        fecha: form.fecha,
        costo_unitario: Number(form.costo_unitario) || 0,
        precio_venta_ref: Number(form.precio_venta_ref) || 0,
        lote: form.lote.trim() || null,
        notas: form.notas.trim() || null,
      };

      if (editandoId !== null) {
        // ── Edición: calcular ajuste de stock necesario ──────────────────────
        const original = mermas.find(m => m.id === editandoId);
        const viejoProdId = original?.producto_id ?? null;
        const viejaCant   = original?.cantidad ?? 0;

        const { error } = await supabase.from("mermas").update(payload).eq("id", editandoId);
        if (error) throw error;

        if (viejoProdId && nuevoProdId && viejoProdId === nuevoProdId) {
          // Mismo producto: ajustar solo la diferencia
          await ajustarStock(nuevoProdId, nuevaCant - viejaCant);
        } else {
          // Producto cambió o fue removido/agregado
          if (viejoProdId) await ajustarStock(viejoProdId, -viejaCant); // restaurar viejo
          if (nuevoProdId) await ajustarStock(nuevoProdId, nuevaCant);  // descontar nuevo
        }

        setMermas(prev => prev.map(m => m.id === editandoId ? { ...m, ...payload } as Merma : m));
        mostrarToast(nuevoProdId ? "✅ Merma actualizada · Stock ajustado" : "✅ Merma actualizada", "ok");

      } else {
        // ── Creación ─────────────────────────────────────────────────────────
        const { data, error } = await supabase.from("mermas").insert([payload]).select();
        if (error) throw error;
        if (nuevoProdId) await ajustarStock(nuevoProdId, nuevaCant);
        if (data?.[0]) setMermas(prev => [data[0], ...prev]);
        mostrarToast(nuevoProdId ? "✅ Merma registrada · Stock descontado" : "✅ Merma registrada", "ok");
      }

      setModalAbierto(false);
    } catch (err: any) {
      mostrarToast("❌ " + (err?.message || "Error al guardar"), "error");
    } finally {
      setGuardando(false);
    }
  }

  async function eliminar(id: number) {
    const merma = mermas.find(m => m.id === id);
    const { error } = await supabase.from("mermas").delete().eq("id", id);
    if (error) { mostrarToast("❌ " + error.message, "error"); return; }
    // Restaurar stock si estaba vinculado a un producto del catálogo
    if (merma?.producto_id) await ajustarStock(merma.producto_id, -merma.cantidad);
    setMermas(prev => prev.filter(m => m.id !== id));
    setConfirmId(null);
    mostrarToast(merma?.producto_id ? "✅ Merma eliminada · Stock restaurado" : "✅ Merma eliminada", "ok");
  }

  // ─── Render ───────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 300 }}>
        <div style={{ textAlign: "center", color: "#64748b" }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>⏳</div>
          <div>Cargando mermas…</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto" }}>
      <style>{`
        @media (max-width: 768px) {
          .mr-header { flex-direction: column !important; gap: 10px !important; }
          .mr-filters { flex-wrap: wrap !important; }
          .mr-cards { flex-wrap: wrap !important; }
          .mr-card { min-width: 130px !important; }
          .mr-modal-inner { padding: 20px 16px !important; max-height: 95vh !important; }
          .mr-modal-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", bottom: 28, right: 28, zIndex: 9999,
          background: toast.tipo === "ok" ? "#16a34a" : "#dc2626",
          color: "white", padding: "12px 20px", borderRadius: 12,
          fontWeight: 700, fontSize: 14, boxShadow: "0 4px 20px rgba(0,0,0,0.18)",
        }}>
          {toast.msg}
        </div>
      )}

      {/* ── Header ────────────────────────────────────────────────────────────── */}
      <div className="mr-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, gap: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#0f172a" }}>📉 Control de Mermas</h1>
          <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: 13 }}>
            Registrá productos perdidos por vencimiento, daño, robo u otros motivos
          </p>
        </div>
        <button onClick={abrirCrear} style={btnPrimario}>+ Registrar merma</button>
      </div>

      {/* ── Chips de resumen ──────────────────────────────────────────────────── */}
      <div className="mr-cards" style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
        {[
          { icon: "💸", label: "Pérdida por costo",   value: fmt(totales.perdidaCosto),    bg: "#fef2f2", border: "#fecaca", color: "#dc2626" },
          { icon: "📊", label: "Margen no ganado",     value: fmt(totales.perdidaMargen),   bg: "#fef9c3", border: "#fde68a", color: "#b45309" },
          { icon: "🔥", label: "Pérdida total",        value: fmt(totales.perdidaTotal),    bg: "#fff1f2", border: "#ffa0a0", color: "#9f1239" },
          { icon: "📦", label: "Unidades perdidas",    value: fmtNum(totales.unidades, 0),  bg: "#f0fdf4", border: "#bbf7d0", color: "#15803d" },
          { icon: "🏷️", label: "Productos afectados",  value: String(totales.productosAfectados), bg: "#eff6ff", border: "#bfdbfe", color: "#1d4ed8" },
        ].map(chip => (
          <div key={chip.label} className="mr-card" style={{
            background: chip.bg, border: `1px solid ${chip.border}`,
            borderRadius: 12, padding: "12px 18px", minWidth: 150, flex: "1 1 auto",
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 4 }}>
              {chip.icon} {chip.label}
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: chip.color }}>{chip.value}</div>
          </div>
        ))}
      </div>

      {/* ── Filtros ────────────────────────────────────────────────────────────── */}
      <div className="mr-filters" style={{
        display: "flex", gap: 10, marginBottom: 20, alignItems: "center", flexWrap: "wrap",
        background: "white", borderRadius: 12, padding: "14px 16px",
        border: "1px solid #e2e8f0", boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
      }}>
        {/* Período */}
        {(["todo", "hoy", "semana", "mes"] as const).map(p => (
          <button key={p} onClick={() => setFiltroPeriodo(p)} style={{
            padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: "pointer",
            border: filtroPeriodo === p ? "none" : "1px solid #e2e8f0",
            background: filtroPeriodo === p ? "#1e40af" : "#f8fafc",
            color: filtroPeriodo === p ? "white" : "#64748b",
          }}>
            {{ todo: "Todo", hoy: "Hoy", semana: "Esta semana", mes: "Este mes" }[p]}
          </button>
        ))}

        <div style={{ width: 1, height: 24, background: "#e2e8f0" }} />

        {/* Motivo */}
        <select value={filtroMotivo} onChange={e => setFiltroMotivo(e.target.value)} style={{
          padding: "6px 10px", borderRadius: 8, fontSize: 12, fontWeight: 600,
          border: "1px solid #e2e8f0", background: "#f8fafc", color: "#374151", cursor: "pointer",
        }}>
          <option value="todos">Todos los motivos</option>
          {Object.entries(MOTIVOS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>

        {/* Búsqueda */}
        <input
          placeholder="🔍 Buscar producto, lote…"
          value={busqueda} onChange={e => setBusqueda(e.target.value)}
          style={{
            padding: "6px 12px", borderRadius: 8, fontSize: 12,
            border: "1px solid #e2e8f0", background: "white",
            color: "#374151", outline: "none", minWidth: 180,
          }}
        />

        <div style={{ marginLeft: "auto", fontSize: 12, color: "#94a3b8", fontWeight: 600 }}>
          {mermasFiltradas.length} registro{mermasFiltradas.length !== 1 ? "s" : ""}
        </div>
      </div>

      {/* ── Tabla ─────────────────────────────────────────────────────────────── */}
      <div style={{
        background: "white", borderRadius: 14, border: "1px solid #e2e8f0",
        boxShadow: "0 1px 6px rgba(0,0,0,0.04)", overflowX: "auto",
      }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 750, fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
              {["Fecha", "Producto", "Motivo", "Cant.", "Costo unit.", "PV ref.", "Pérd. costo", "Pérd. margen", "Lote / Notas", ""].map((h, i) => (
                <th key={i} style={{
                  padding: "10px 12px", textAlign: i >= 3 && i <= 7 ? "right" : "left",
                  fontSize: 11, fontWeight: 700, color: "#64748b",
                  textTransform: "uppercase", letterSpacing: 0.4, whiteSpace: "nowrap",
                }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {mermasFiltradas.length === 0 ? (
              <tr>
                <td colSpan={10} style={{ textAlign: "center", padding: "48px 20px", color: "#94a3b8" }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>📭</div>
                  <div style={{ fontWeight: 600 }}>Sin mermas registradas para este filtro</div>
                </td>
              </tr>
            ) : (
              mermasFiltradas.map((m, i) => {
                const mot = MOTIVOS[m.motivo] ?? MOTIVOS.otro;
                const perdCosto  = m.costo_unitario * m.cantidad;
                const perdMargen = (m.precio_venta_ref - m.costo_unitario) * m.cantidad;
                return (
                  <tr key={m.id} style={{
                    borderBottom: "1px solid #f1f5f9",
                    background: i % 2 === 0 ? "white" : "#fafafa",
                    transition: "background 0.1s",
                  }}
                    onMouseEnter={e => (e.currentTarget.style.background = "#f0f9ff")}
                    onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? "white" : "#fafafa")}
                  >
                    <td style={{ padding: "9px 12px", color: "#374151", whiteSpace: "nowrap" }}>
                      {m.fecha ? new Date(m.fecha + "T00:00:00").toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "2-digit" }) : "—"}
                    </td>
                    <td style={{ padding: "9px 12px", fontWeight: 600, color: "#0f172a", maxWidth: 200 }}>
                      <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {m.producto_nombre}
                      </div>
                      {m.producto_id ? (
                        <div style={{ fontSize: 10, fontWeight: 700, color: "#16a34a", marginTop: 2 }}>
                          📦 stock descontado
                        </div>
                      ) : (
                        <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>
                          externo al sistema
                        </div>
                      )}
                    </td>
                    <td style={{ padding: "9px 12px" }}>
                      <span style={{
                        display: "inline-block", padding: "2px 10px", borderRadius: 20,
                        fontSize: 11, fontWeight: 700,
                        background: mot.bg, color: mot.color, border: `1px solid ${mot.border}`,
                      }}>
                        {mot.label}
                      </span>
                    </td>
                    <td style={{ padding: "9px 12px", textAlign: "right", fontWeight: 700, color: "#374151" }}>
                      {fmtNum(m.cantidad, m.cantidad % 1 === 0 ? 0 : 2)}
                    </td>
                    <td style={{ padding: "9px 12px", textAlign: "right", color: "#64748b" }}>
                      {fmt(m.costo_unitario)}
                    </td>
                    <td style={{ padding: "9px 12px", textAlign: "right", color: "#64748b" }}>
                      {fmt(m.precio_venta_ref)}
                    </td>
                    <td style={{ padding: "9px 12px", textAlign: "right", fontWeight: 700, color: "#dc2626" }}>
                      {fmt(perdCosto)}
                    </td>
                    <td style={{ padding: "9px 12px", textAlign: "right", fontWeight: 700, color: "#b45309" }}>
                      {fmt(perdMargen)}
                    </td>
                    <td style={{ padding: "9px 12px", color: "#64748b", maxWidth: 160 }}>
                      <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {[m.lote, m.notas].filter(Boolean).join(" · ") || "—"}
                      </div>
                    </td>
                    <td style={{ padding: "9px 8px", whiteSpace: "nowrap" }}>
                      <button onClick={() => abrirEditar(m)} title="Editar" style={{
                        background: "none", border: "none", cursor: "pointer", fontSize: 16,
                        padding: "2px 5px", borderRadius: 6, color: "#94a3b8",
                      }}>✏️</button>
                      {confirmId === m.id ? (
                        <span style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
                          <button onClick={() => eliminar(m.id)} style={{
                            background: "#dc2626", color: "white", border: "none",
                            borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 700, cursor: "pointer",
                          }}>Sí</button>
                          <button onClick={() => setConfirmId(null)} style={{
                            background: "#e2e8f0", color: "#374151", border: "none",
                            borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 700, cursor: "pointer",
                          }}>No</button>
                        </span>
                      ) : (
                        <button onClick={() => setConfirmId(m.id)} title="Eliminar" style={{
                          background: "none", border: "none", cursor: "pointer", fontSize: 16,
                          padding: "2px 5px", borderRadius: 6, color: "#94a3b8",
                        }}>🗑️</button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
          {mermasFiltradas.length > 0 && (
            <tfoot>
              <tr style={{ borderTop: "2px solid #e2e8f0", background: "#f8fafc" }}>
                <td colSpan={3} style={{ padding: "10px 12px", fontWeight: 700, color: "#374151", fontSize: 12 }}>
                  TOTAL ({mermasFiltradas.length} registros)
                </td>
                <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 800, color: "#374151" }}>
                  {fmtNum(totales.unidades, totales.unidades % 1 === 0 ? 0 : 2)}
                </td>
                <td colSpan={2} />
                <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 800, color: "#dc2626" }}>
                  {fmt(totales.perdidaCosto)}
                </td>
                <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 800, color: "#b45309" }}>
                  {fmt(totales.perdidaMargen)}
                </td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* ── Nota explicativa ─────────────────────────────────────────────────── */}
      <div style={{
        marginTop: 16, padding: "14px 18px", borderRadius: 10,
        background: "#eff6ff", border: "1px solid #bfdbfe", fontSize: 12, color: "#1e40af",
      }}>
        💡 <strong>Pérdida por costo:</strong> dinero que ya gastaste en el producto (cantidad × costo).
        &nbsp;&nbsp;<strong>Margen no ganado:</strong> ganancia que dejaste de obtener (cantidad × (PV − costo)).
        &nbsp;&nbsp;<strong>Pérdida total</strong> = suma de ambas.
      </div>

      {/* ── Modal ─────────────────────────────────────────────────────────────── */}
      {modalAbierto && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 1000, padding: 16,
        }}>
          <div className="mr-modal-inner" style={{
            background: "white", borderRadius: 18, padding: "28px 32px",
            width: "100%", maxWidth: 600, maxHeight: "90vh", overflowY: "auto",
            boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
          }}>
            {/* Título */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#0f172a" }}>
                {editandoId !== null ? "✏️ Editar merma" : "📉 Registrar merma"}
              </h2>
              <button onClick={() => setModalAbierto(false)} style={{
                background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "#94a3b8", lineHeight: 1,
              }}>✕</button>
            </div>

            <div className="mr-modal-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>

              {/* Producto — autocomplete */}
              <div style={{ gridColumn: "1 / -1", position: "relative" }}>
                <label style={labelStyle}>Producto *</label>
                <input
                  ref={prodInputRef}
                  value={form.producto_nombre}
                  onChange={e => onProdInput(e.target.value)}
                  onFocus={() => form.producto_nombre && setShowSugg(prodSuggestions.length > 0)}
                  placeholder="Buscar producto…"
                  style={inputLight}
                  autoComplete="off"
                />
                {showSugg && (
                  <div ref={suggBoxRef} style={{
                    position: "absolute", left: 0, right: 0, top: "calc(100% + 4px)",
                    background: "white", border: "1px solid #e2e8f0", borderRadius: 10,
                    boxShadow: "0 8px 24px rgba(0,0,0,0.12)", zIndex: 50, overflow: "hidden",
                  }}>
                    {prodSuggestions.map(p => (
                      <button key={p.id} onMouseDown={() => seleccionarProducto(p)} style={{
                        display: "block", width: "100%", textAlign: "left",
                        padding: "9px 14px", background: "none", border: "none",
                        cursor: "pointer", fontSize: 13, color: "#111827",
                        borderBottom: "1px solid #f1f5f9",
                      }}
                        onMouseEnter={e => (e.currentTarget.style.background = "#f0f9ff")}
                        onMouseLeave={e => (e.currentTarget.style.background = "none")}
                      >
                        <span style={{ fontWeight: 600 }}>{p.nombre}</span>
                        <span style={{ color: "#94a3b8", marginLeft: 8, fontSize: 11 }}>
                          Costo: {fmt(p.costo)} · PV: {fmt(p.precio_venta)}
                        </span>
                      </button>
                    ))}
                    {/* Opción libre si no hay coincidencia exacta */}
                    {!prodSuggestions.some(p => p.nombre.toLowerCase() === form.producto_nombre.toLowerCase()) && (
                      <button onMouseDown={() => { setShowSugg(false); setForm(f => ({ ...f, producto_id: "" })); }} style={{
                        display: "block", width: "100%", textAlign: "left",
                        padding: "9px 14px", background: "#fef9c3", border: "none",
                        cursor: "pointer", fontSize: 12, color: "#92400e",
                        fontStyle: "italic",
                      }}>
                        Usar "{form.producto_nombre}" como nombre libre
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Indicador stock */}
              {form.producto_nombre.trim() && (
                <div style={{
                  gridColumn: "1 / -1",
                  padding: "8px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                  background: form.producto_id !== "" ? "#f0fdf4" : "#fef9c3",
                  color: form.producto_id !== "" ? "#16a34a" : "#92400e",
                  border: `1px solid ${form.producto_id !== "" ? "#bbf7d0" : "#fde68a"}`,
                }}>
                  {form.producto_id !== ""
                    ? "📦 Al guardar se descontará automáticamente del stock"
                    : "⚠️ Nombre libre — no descuenta stock (el producto no está en el catálogo)"}
                </div>
              )}

              {/* Fecha */}
              <div>
                <label style={labelStyle}>Fecha *</label>
                <input type="date" value={form.fecha}
                  onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))}
                  style={inputLight} />
              </div>

              {/* Motivo */}
              <div>
                <label style={labelStyle}>Motivo *</label>
                <select value={form.motivo}
                  onChange={e => setForm(f => ({ ...f, motivo: e.target.value }))}
                  style={{ ...inputLight, cursor: "pointer" }}>
                  {Object.entries(MOTIVOS).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
              </div>

              {/* Cantidad */}
              <div>
                <label style={labelStyle}>Cantidad perdida *</label>
                <input type="number" min="0" step="any" value={form.cantidad}
                  onChange={e => setForm(f => ({ ...f, cantidad: e.target.value }))}
                  placeholder="Ej: 3"
                  style={inputLight} />
              </div>

              {/* Lote */}
              <div>
                <label style={labelStyle}>Lote (opcional)</label>
                <input value={form.lote}
                  onChange={e => setForm(f => ({ ...f, lote: e.target.value }))}
                  placeholder="Ej: L-2024-05"
                  style={inputLight} />
              </div>

              {/* Costo unitario */}
              <div>
                <label style={labelStyle}>Costo unitario ($)</label>
                <input type="number" min="0" step="any" value={form.costo_unitario}
                  onChange={e => setForm(f => ({ ...f, costo_unitario: e.target.value }))}
                  placeholder="Se autocompleta al elegir producto"
                  style={inputLight} />
              </div>

              {/* Precio venta ref */}
              <div>
                <label style={labelStyle}>Precio de venta ref. ($)</label>
                <input type="number" min="0" step="any" value={form.precio_venta_ref}
                  onChange={e => setForm(f => ({ ...f, precio_venta_ref: e.target.value }))}
                  placeholder="Se autocompleta al elegir producto"
                  style={inputLight} />
              </div>

              {/* Vista previa pérdidas */}
              {(Number(form.cantidad) > 0 && Number(form.costo_unitario) > 0) && (() => {
                const c = Number(form.costo_unitario) * Number(form.cantidad);
                const mg = (Number(form.precio_venta_ref) - Number(form.costo_unitario)) * Number(form.cantidad);
                return (
                  <div style={{
                    gridColumn: "1 / -1", background: "#fef2f2", border: "1px solid #fecaca",
                    borderRadius: 10, padding: "12px 16px", display: "flex", gap: 24, flexWrap: "wrap",
                  }}>
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: "#9f1239", textTransform: "uppercase", letterSpacing: 0.5 }}>Pérdida por costo</div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: "#dc2626" }}>{fmt(c)}</div>
                    </div>
                    {Number(form.precio_venta_ref) > 0 && (
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: "#9f1239", textTransform: "uppercase", letterSpacing: 0.5 }}>Margen no ganado</div>
                        <div style={{ fontSize: 16, fontWeight: 800, color: "#b45309" }}>{fmt(mg)}</div>
                      </div>
                    )}
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: "#9f1239", textTransform: "uppercase", letterSpacing: 0.5 }}>Total</div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: "#9f1239" }}>{fmt(c + (Number(form.precio_venta_ref) > 0 ? mg : 0))}</div>
                    </div>
                  </div>
                );
              })()}

              {/* Notas */}
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={labelStyle}>Notas (opcional)</label>
                <textarea value={form.notas}
                  onChange={e => setForm(f => ({ ...f, notas: e.target.value }))}
                  placeholder="Descripción adicional…"
                  rows={2}
                  style={{ ...inputLight, resize: "vertical" }} />
              </div>
            </div>

            {/* Botones */}
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 22 }}>
              <button onClick={() => setModalAbierto(false)} style={btnSecundario}>Cancelar</button>
              <button onClick={guardar} disabled={guardando} style={{
                ...btnPrimario,
                opacity: guardando ? 0.7 : 1,
              }}>
                {guardando ? "Guardando…" : editandoId !== null ? "Guardar cambios" : "Registrar merma"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
