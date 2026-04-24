"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

interface Proveedor { id: number; nombre: string; }
interface Producto { id: number; nombre: string; stock: number; }
interface ItemForm {
  producto_id: number; nombre: string;
  cantidad: string; precio_unitario: string; fecha_vencimiento: string;
}
interface Compra {
  id: number; fecha: string; numero_remito: string | null;
  fecha_vencimiento: string | null; metodo_pago: string | null; notas: string | null;
  total: number; total_pagado: number; estado: string;
  incluye_iva: boolean; monto_iva: number; porcentaje_iva: number; monto_flete: number;
  proveedores: { nombre: string } | null;
}
interface DetalleCompra {
  id: number; cantidad: number; precio_unitario: number; subtotal: number;
  monto_iva: number; monto_flete: number; productos: { nombre: string } | null;
}
interface PagoCompra {
  id: number; fecha: string; monto: number; metodo_pago: string | null; notas: string | null;
}

const METODOS = ["Efectivo", "Transferencia", "Cheque", "Tarjeta", "Otro"];
const ESTADO_LABEL: Record<string, { label: string; bg: string; color: string }> = {
  pendiente: { label: "Pendiente", bg: "rgba(239,68,68,0.12)", color: "#f87171" },
  parcial:   { label: "Parcial",   bg: "rgba(251,191,36,0.12)", color: "#fbbf24" },
  pagado:    { label: "Pagado",    bg: "rgba(74,222,128,0.12)", color: "#4ade80" },
};

function fmt(n: number) {
  return n.toLocaleString("es-AR", { style: "currency", currency: "ARS" });
}

function calcularTotales(
  items: ItemForm[], incluyeIva: boolean, porcentajeIva: number,
  incluyeFlete: boolean, tipoFlete: "pct" | "pesos", valorFlete: number
) {
  const subtotal = items.reduce((s, it) => s + (parseFloat(it.cantidad) || 0) * (parseFloat(it.precio_unitario) || 0), 0);
  const iva = incluyeIva && porcentajeIva > 0 ? Math.round(subtotal * (porcentajeIva / 100) * 100) / 100 : 0;
  const flete = incluyeFlete && valorFlete > 0
    ? tipoFlete === "pct" ? Math.round(subtotal * (valorFlete / 100) * 100) / 100 : valorFlete : 0;
  return { subtotal, iva, flete, total: subtotal + iva + flete };
}

const labelStyle: React.CSSProperties = {
  display: "block", fontSize: 11, fontWeight: 700,
  color: "#9ca3af", letterSpacing: 0.5, marginBottom: 6, textTransform: "uppercase"
}
const inputDarkStyle: React.CSSProperties = {
  width: "100%", padding: "10px 14px", background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10,
  color: "white", fontSize: 14, outline: "none", boxSizing: "border-box"
}
const selectDarkStyle: React.CSSProperties = {
  width: "100%", padding: "10px 14px",
  background: "#1e293b",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 10, color: "white", fontSize: 14,
  outline: "none", boxSizing: "border-box", cursor: "pointer"
}

export default function ComprasPage() {
  const [compras, setCompras] = useState<Compra[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("todos");
  const [busquedaProducto, setBusquedaProducto] = useState("");
  const [productoDropdown, setProductoDropdown] = useState(false);

  const [modalNueva, setModalNueva] = useState(false);
  const [form, setForm] = useState({
    proveedor_id: "", fecha: new Date().toISOString().slice(0, 10),
    numero_remito: "", fecha_vencimiento: "", metodo_pago: "Efectivo",
    notas: "", pago_inicial: "", incluye_iva: false, porcentaje_iva: "21",
    incluye_flete: false, tipo_flete: "pesos" as "pct" | "pesos", valor_flete: "",
  });
  const [items, setItems] = useState<ItemForm[]>([]);
  const [guardando, setGuardando] = useState(false);
  const [errorForm, setErrorForm] = useState<string | null>(null);

  const [compraVer, setCompraVer] = useState<Compra | null>(null);
  const [detalle, setDetalle] = useState<DetalleCompra[]>([]);
  const [pagos, setPagos] = useState<PagoCompra[]>([]);
  const [loadingDetalle, setLoadingDetalle] = useState(false);
  const [tabDetalle, setTabDetalle] = useState<"detalle" | "pagos">("detalle");
  const [modalPago, setModalPago] = useState(false);
  const [formPago, setFormPago] = useState({ monto: "", metodo_pago: "Efectivo", notas: "" });
  const [guardandoPago, setGuardandoPago] = useState(false);
  const [cancelando, setCancelando] = useState(false);
  const [confirmEliminarCompra, setConfirmEliminarCompra] = useState<Compra | null>(null);
  const [eliminandoCompra, setEliminandoCompra] = useState(false);

  useEffect(() => { cargarTodo(); }, []);

  async function cargarTodo() {
    setLoading(true);
    const [{ data: c }, { data: p }, { data: pr }] = await Promise.all([
      supabase.from("compras").select("*, proveedores(nombre)").order("fecha", { ascending: false }),
      supabase.from("proveedores").select("id, nombre").order("nombre"),
      supabase.from("productos").select("id, nombre, stock").order("nombre"),
    ]);
    if (c) setCompras(c);
    if (p) setProveedores(p);
    if (pr) setProductos(pr);
    setLoading(false);
  }

  function abrirNueva() {
    setForm({
      proveedor_id: "", fecha: new Date().toISOString().slice(0, 10),
      numero_remito: "", fecha_vencimiento: "", metodo_pago: "Efectivo",
      notas: "", pago_inicial: "", incluye_iva: false, porcentaje_iva: "21",
      incluye_flete: false, tipo_flete: "pesos", valor_flete: "",
    });
    setItems([]); setBusquedaProducto(""); setErrorForm(null); setModalNueva(true);
  }

  function agregarItem(prod: Producto) {
    if (items.find(i => i.producto_id === prod.id)) return;
    setItems([...items, { producto_id: prod.id, nombre: prod.nombre, cantidad: "1", precio_unitario: "", fecha_vencimiento: "" }]);
    setBusquedaProducto(""); setProductoDropdown(false);
  }

  function quitarItem(idx: number) { setItems(items.filter((_, i) => i !== idx)); }

  const pctIvaForm = parseFloat(form.porcentaje_iva) || 0;
  const valFleteForm = parseFloat(form.valor_flete) || 0;

  function calcularItemsConExtras() {
    const { subtotal, iva, flete } = calcularTotales(items, form.incluye_iva, pctIvaForm, form.incluye_flete, form.tipo_flete, valFleteForm);
    return items.map(it => {
      const subtotalItem = (parseFloat(it.cantidad) || 0) * (parseFloat(it.precio_unitario) || 0);
      const proporcion = subtotal > 0 ? subtotalItem / subtotal : 0;
      const ivaItem = form.incluye_iva ? iva * proporcion : 0;
      const fleteItem = form.incluye_flete ? flete * proporcion : 0;
      return { ...it, subtotalItem, ivaItem: Math.round(ivaItem * 100) / 100, fleteItem: Math.round(fleteItem * 100) / 100 };
    });
  }

  const { subtotal: subtotalForm, iva: ivaForm, flete: fleteForm, total: totalForm } =
    calcularTotales(items, form.incluye_iva, pctIvaForm, form.incluye_flete, form.tipo_flete, valFleteForm);
  const itemsCalculados = calcularItemsConExtras();

  async function guardarCompra() {
    if (!form.proveedor_id) { setErrorForm("Seleccioná un proveedor."); return; }
    if (items.length === 0) { setErrorForm("Agregá al menos un producto."); return; }
    if (items.some(it => (parseFloat(it.precio_unitario) || 0) <= 0)) { setErrorForm("Todos los productos deben tener precio mayor a 0."); return; }
    const pctIva = parseFloat(form.porcentaje_iva) || 0;
    const valFlete = parseFloat(form.valor_flete) || 0;
    if (form.incluye_flete && valFlete <= 0) { setErrorForm("El valor del flete debe ser mayor a 0."); return; }
    const { flete: montoFlete } = calcularTotales(items, form.incluye_iva, pctIva, form.incluye_flete, form.tipo_flete, valFlete);
    setGuardando(true); setErrorForm(null);
    const { error } = await supabase.rpc("registrar_compra", {
      p_proveedor_id: Number(form.proveedor_id), p_fecha: form.fecha,
      p_numero_remito: form.numero_remito || null, p_fecha_vencimiento: form.fecha_vencimiento || null,
      p_metodo_pago: form.metodo_pago, p_notas: form.notas || null,
      p_pago_inicial: parseFloat(form.pago_inicial) || 0,
      p_items: items.map(it => ({
        producto_id: it.producto_id, cantidad: parseFloat(it.cantidad) || 1,
        precio_unitario: parseFloat(it.precio_unitario) || 0, fecha_vencimiento: it.fecha_vencimiento || null
      })),
      p_incluye_iva: form.incluye_iva, p_porcentaje_iva: pctIva, p_monto_flete: montoFlete,
    });
    setGuardando(false);
    if (error) { setErrorForm("Error: " + error.message); return; }
    setModalNueva(false); cargarTodo();
  }

  async function eliminarCompra() {
    if (!confirmEliminarCompra) return;
    setEliminandoCompra(true);
    await supabase.from("compras_pagos").delete().eq("compra_id", confirmEliminarCompra.id);
    await supabase.from("compras_detalle").delete().eq("compra_id", confirmEliminarCompra.id);
    await supabase.from("lotes").update({ cantidad: 0 }).eq("compra_id", confirmEliminarCompra.id);
    const { error } = await supabase.from("compras").delete().eq("id", confirmEliminarCompra.id);
    setEliminandoCompra(false);
    if (error) { alert("Error al eliminar: " + error.message); return; }
    setConfirmEliminarCompra(null);
    if (compraVer?.id === confirmEliminarCompra.id) setCompraVer(null);
    cargarTodo();
  }

  async function verDetalle(c: Compra) {
    setCompraVer(c); setTabDetalle("detalle"); setLoadingDetalle(true);
    const [{ data: d }, { data: p }] = await Promise.all([
      supabase.from("compras_detalle").select("*, productos(nombre)").eq("compra_id", c.id),
      supabase.from("compras_pagos").select("*").eq("compra_id", c.id).order("fecha"),
    ]);
    if (d) setDetalle(d); if (p) setPagos(p);
    setLoadingDetalle(false);
  }

  async function cancelarCompra() {
    if (!compraVer) return;
    const saldo = compraVer.total - compraVer.total_pagado;
    if (saldo <= 0) return;
    setCancelando(true);
    const { error } = await supabase.rpc("registrar_pago_compra", { p_compra_id: compraVer.id, p_monto: saldo, p_metodo_pago: "Efectivo", p_notas: "Cancelación total" });
    if (error) { alert("Error: " + error.message); setCancelando(false); return; }
    setCancelando(false); await cargarTodo();
    const { data: ca } = await supabase.from("compras").select("*").eq("id", compraVer.id).single();
    if (ca) setCompraVer(ca);
    const { data: p } = await supabase.from("compras_pagos").select("*").eq("compra_id", compraVer.id).order("fecha");
    if (p) setPagos(p); cargarTodo();
  }

  async function guardarPago() {
    if (!compraVer) return;
    const monto = parseFloat(formPago.monto);
    const saldo = compraVer.total - compraVer.total_pagado;
    if (!monto || monto <= 0) return;
    if (monto > saldo) { alert("El monto supera el saldo pendiente."); return; }
    setGuardandoPago(true);
    await supabase.rpc("registrar_pago_compra", { p_compra_id: compraVer.id, p_monto: monto, p_metodo_pago: formPago.metodo_pago, p_notas: formPago.notas || null });
    setGuardandoPago(false); setModalPago(false);
    const nuevoTotal = compraVer.total_pagado + monto;
    setCompraVer({ ...compraVer, total_pagado: nuevoTotal, estado: nuevoTotal >= compraVer.total ? "pagado" : "parcial" });
    const { data: p } = await supabase.from("compras_pagos").select("*").eq("compra_id", compraVer.id).order("fecha");
    if (p) setPagos(p); cargarTodo();
  }

  const filtradas = compras.filter(c => {
    const texto = [c.proveedores?.nombre, c.numero_remito].join(" ").toLowerCase();
    return texto.includes(busqueda.toLowerCase()) && (filtroEstado === "todos" || c.estado === filtroEstado);
  });
  const totalDeuda = compras.filter(c => c.estado !== "pagado").reduce((s, c) => s + (c.total - c.total_pagado), 0);
  const productosFiltradosDropdown = productos.filter(p =>
    !items.find(i => i.producto_id === p.id) &&
    p.nombre.toLowerCase().includes(busquedaProducto.toLowerCase())
  ).slice(0, 40);

  return (
    <div style={{ fontFamily: "'DM Sans', 'Segoe UI', sans-serif" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <p style={{ fontSize: 13, color: "#6b7280", margin: 0 }}>
          <span style={{ fontWeight: 700, color: "#374151" }}>{compras.length}</span> compra{compras.length !== 1 ? "s" : ""}
          {totalDeuda > 0 && <span style={{ marginLeft: 8, color: "#dc2626", fontWeight: 600 }}>· Deuda: {fmt(totalDeuda)}</span>}
        </p>
        <button onClick={abrirNueva} style={{
          background: "linear-gradient(135deg, #2563eb, #3b82f6)", color: "white",
          border: "none", borderRadius: 10, padding: "10px 18px",
          fontSize: 13, fontWeight: 700, cursor: "pointer", boxShadow: "0 2px 8px rgba(59,130,246,0.3)"
        }}>+ Nueva compra</button>
      </div>

      {/* Filtros */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
        <input type="text" placeholder="🔍 Buscar proveedor o remito..." value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          style={{ flex: 1, padding: "10px 14px", border: "1px solid #e2e8f0", borderRadius: 10, fontSize: 14, outline: "none" }} />
        <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}
          style={{ padding: "10px 14px", border: "1px solid #e2e8f0", borderRadius: 10, fontSize: 14, outline: "none", background: "white", color: "#111827" }}>
          <option value="todos">Todos</option>
          <option value="pendiente">Pendiente</option>
          <option value="parcial">Parcial</option>
          <option value="pagado">Pagado</option>
        </select>
      </div>

      {/* Lista compras */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: "#94a3b8" }}>Cargando...</div>
      ) : filtradas.length === 0 ? (
        <div style={{ textAlign: "center", padding: 40, color: "#94a3b8" }}>No hay compras registradas.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filtradas.map(c => {
            const saldo = c.total - c.total_pagado;
            const est = ESTADO_LABEL[c.estado] ?? ESTADO_LABEL.pendiente;
            const vencido = c.fecha_vencimiento && c.estado !== "pagado" && new Date(c.fecha_vencimiento) < new Date();
            return (
              <div key={c.id} style={{
                background: vencido ? "#fff5f5" : "white", borderRadius: 14, padding: "14px 18px",
                border: vencido ? "1px solid #fecaca" : "1px solid #e2e8f0",
                boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
                display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap"
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                    <span style={{ fontWeight: 700, fontSize: 14, color: "#111827" }}>{c.proveedores?.nombre ?? "—"}</span>
                    <span style={{ background: est.bg, color: est.color, fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20 }}>{est.label}</span>
                    {c.incluye_iva && <span style={{ background: "rgba(59,130,246,0.1)", color: "#3b82f6", fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 20 }}>IVA {c.porcentaje_iva}%</span>}
                    {c.monto_flete > 0 && <span style={{ background: "rgba(249,115,22,0.1)", color: "#ea580c", fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 20 }}>🚚 {fmt(c.monto_flete)}</span>}
                    {vencido && <span style={{ color: "#dc2626", fontSize: 11, fontWeight: 700 }}>⚠️ Vencida</span>}
                  </div>
                  <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 11, color: "#6b7280" }}>
                    <span>📅 {c.fecha}</span>
                    {c.numero_remito && <span>🧾 {c.numero_remito}</span>}
                    {c.fecha_vencimiento && <span className={vencido ? "" : ""} style={{ color: vencido ? "#dc2626" : "#6b7280" }}>⏰ {c.fecha_vencimiento}</span>}
                    {c.metodo_pago && <span>💳 {c.metodo_pago}</span>}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 14, flexShrink: 0, flexWrap: "wrap" }}>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 10, color: "#9ca3af" }}>Total</div>
                    <div style={{ fontWeight: 700, color: "#111827", fontSize: 14 }}>{fmt(c.total)}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 10, color: "#9ca3af" }}>Pagado</div>
                    <div style={{ fontWeight: 700, color: "#16a34a", fontSize: 14 }}>{fmt(c.total_pagado)}</div>
                  </div>
                  {saldo > 0 && (
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 10, color: "#9ca3af" }}>Saldo</div>
                      <div style={{ fontWeight: 800, color: "#dc2626", fontSize: 14 }}>{fmt(saldo)}</div>
                    </div>
                  )}
                  <button onClick={() => verDetalle(c)} style={{ background: "#f1f5f9", color: "#374151", border: "1px solid #e2e8f0", borderRadius: 8, padding: "7px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Ver detalle</button>
                  <button onClick={() => setConfirmEliminarCompra(c)} style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", borderRadius: 8, padding: "7px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>🗑️</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── MODAL NUEVA COMPRA ── */}
      {modalNueva && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 50, padding: 16, overflowY: "auto" }}>
          <div style={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, width: "100%", maxWidth: 900, margin: "32px 0", boxShadow: "0 24px 64px rgba(0,0,0,0.6)" }}>
            <div style={{ padding: "24px 28px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
              <h2 style={{ color: "white", fontSize: 18, fontWeight: 700, margin: 0 }}>Nueva compra</h2>
            </div>
            <div style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: 18 }}>
              {errorForm && <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "#f87171", fontSize: 13, padding: "10px 14px", borderRadius: 8 }}>{errorForm}</div>}

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div>
                  <label style={labelStyle}>Proveedor *</label>
                  <select value={form.proveedor_id} onChange={e => setForm({ ...form, proveedor_id: e.target.value })}
                    style={selectDarkStyle}>
  <option value="">Seleccioná un proveedor</option>
                    <option value="">Seleccioná un proveedor</option>
                    {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Fecha</label>
                  <input type="date" value={form.fecha} onChange={e => setForm({ ...form, fecha: e.target.value })} style={{ ...inputDarkStyle, colorScheme: "dark" }} />
                </div>
                <div>
                  <label style={labelStyle}>N° Remito / Factura</label>
                  <input type="text" value={form.numero_remito} onChange={e => setForm({ ...form, numero_remito: e.target.value })} placeholder="0001-00012345" style={inputDarkStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Vencimiento del remito</label>
                  <input type="date" value={form.fecha_vencimiento} onChange={e => setForm({ ...form, fecha_vencimiento: e.target.value })} style={{ ...inputDarkStyle, colorScheme: "dark" }} />
                </div>
              </div>

              {/* Buscador productos */}
              <div>
                <label style={labelStyle}>Productos *</label>
                <div style={{ position: "relative", marginBottom: 12 }}>
                  <input type="text" placeholder="Buscar y agregar producto..." value={busquedaProducto}
                    onChange={e => { setBusquedaProducto(e.target.value); setProductoDropdown(true) }}
                    onFocus={() => setProductoDropdown(true)}
                    style={inputDarkStyle} />
                  {productoDropdown && busquedaProducto && productosFiltradosDropdown.length > 0 && (
                    <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "#1e293b", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, zIndex: 10, maxHeight: 220, overflowY: "auto", marginTop: 4, boxShadow: "0 8px 24px rgba(0,0,0,0.4)" }}>
                      {productosFiltradosDropdown.map(p => (
                        <div key={p.id} onClick={() => agregarItem(p)}
                          style={{ padding: "9px 14px", cursor: "pointer", fontSize: 13, display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.06)", color: "white" }}
                          onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = "rgba(59,130,246,0.15)"}
                          onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = "transparent"}>
                          <span style={{ fontWeight: 500 }}>{p.nombre}</span>
                          <span style={{ fontSize: 11, color: "#6b7280" }}>Stock: {p.stock}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {items.length > 0 && (
                  <div style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, overflow: "hidden" }}>
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 700 }}>
                        <thead>
                          <tr style={{ background: "rgba(255,255,255,0.04)" }}>
                            {["Producto", "Cantidad", "P. unitario", "Vencimiento", "Subtotal", "IVA", "Flete", "Total", ""].map((h, i) => (
                              <th key={i} style={{ padding: "10px 12px", fontSize: 11, fontWeight: 700, color: "#6b7280", textAlign: i >= 4 && i <= 7 ? "right" : i === 8 ? "center" : "left", letterSpacing: 0.5, textTransform: "uppercase", whiteSpace: "nowrap" }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {itemsCalculados.map((it, idx) => (
                            <tr key={it.producto_id} style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                              <td style={{ padding: "10px 12px", color: "white", fontSize: 13, fontWeight: 500 }}>{it.nombre}</td>
                              <td style={{ padding: "10px 12px" }}>
                                <input type="number" min="1" value={it.cantidad}
                                  onChange={e => setItems(items.map((item, i) => i === idx ? { ...item, cantidad: e.target.value } : item))}
                                  style={{ width: 70, padding: "6px 10px", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "white", fontSize: 13, outline: "none", textAlign: "center" }} />
                              </td>
                              <td style={{ padding: "10px 12px" }}>
                                <input type="number" min="0" step="0.01" value={it.precio_unitario}
                                  onChange={e => setItems(items.map((item, i) => i === idx ? { ...item, precio_unitario: e.target.value } : item))}
                                  placeholder="0.00"
                                  style={{ width: 100, padding: "6px 10px", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "white", fontSize: 13, outline: "none", textAlign: "center" }} />
                              </td>
                              <td style={{ padding: "10px 12px" }}>
                                <input type="date" value={it.fecha_vencimiento}
                                  onChange={e => setItems(items.map((item, i) => i === idx ? { ...item, fecha_vencimiento: e.target.value } : item))}
                                  style={{ padding: "6px 10px", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "white", fontSize: 12, outline: "none", colorScheme: "dark" }} />
                              </td>
                              <td style={{ padding: "10px 12px", textAlign: "right", color: "#d1d5db", fontSize: 12 }}>{fmt(it.subtotalItem)}</td>
                              <td style={{ padding: "10px 12px", textAlign: "right", color: "#93c5fd", fontSize: 12 }}>{fmt(it.ivaItem)}</td>
                              <td style={{ padding: "10px 12px", textAlign: "right", color: "#fb923c", fontSize: 12 }}>{fmt(it.fleteItem)}</td>
                              <td style={{ padding: "10px 12px", textAlign: "right", color: "white", fontSize: 12, fontWeight: 700 }}>{fmt(it.subtotalItem + it.ivaItem + it.fleteItem)}</td>
                              <td style={{ padding: "10px 12px", textAlign: "center" }}>
                                <button onClick={() => quitarItem(idx)} style={{ background: "rgba(239,68,68,0.15)", border: "none", color: "#f87171", borderRadius: 6, width: 26, height: 26, cursor: "pointer", fontSize: 12, fontWeight: 700 }}>✕</button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                            <td colSpan={7} style={{ padding: "8px 12px", textAlign: "right", color: "#6b7280", fontSize: 12 }}>Subtotal:</td>
                            <td style={{ padding: "8px 12px", textAlign: "right", color: "#d1d5db", fontSize: 12, fontWeight: 600 }}>{fmt(subtotalForm)}</td>
                            <td></td>
                          </tr>
                          {form.incluye_iva && ivaForm > 0 && (
                            <tr>
                              <td colSpan={7} style={{ padding: "6px 12px", textAlign: "right", color: "#93c5fd", fontSize: 12 }}>IVA {pctIvaForm}%:</td>
                              <td style={{ padding: "6px 12px", textAlign: "right", color: "#93c5fd", fontSize: 12, fontWeight: 600 }}>{fmt(ivaForm)}</td>
                              <td></td>
                            </tr>
                          )}
                          {form.incluye_flete && fleteForm > 0 && (
                            <tr>
                              <td colSpan={7} style={{ padding: "6px 12px", textAlign: "right", color: "#fb923c", fontSize: 12 }}>🚚 Flete:</td>
                              <td style={{ padding: "6px 12px", textAlign: "right", color: "#fb923c", fontSize: 12, fontWeight: 600 }}>{fmt(fleteForm)}</td>
                              <td></td>
                            </tr>
                          )}
                          <tr style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                            <td colSpan={7} style={{ padding: "10px 12px", textAlign: "right", color: "white", fontSize: 13, fontWeight: 700 }}>Total:</td>
                            <td style={{ padding: "10px 12px", textAlign: "right", color: "white", fontSize: 15, fontWeight: 800 }}>{fmt(totalForm)}</td>
                            <td></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              {/* IVA toggle */}
              <div onClick={() => setForm({ ...form, incluye_iva: !form.incluye_iva })}
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderRadius: 10, cursor: "pointer", background: form.incluye_iva ? "rgba(59,130,246,0.1)" : "rgba(255,255,255,0.04)", border: form.incluye_iva ? "1px solid rgba(59,130,246,0.3)" : "1px solid rgba(255,255,255,0.08)" }}>
                <div style={{ width: 20, height: 20, borderRadius: 5, flexShrink: 0, background: form.incluye_iva ? "#3b82f6" : "rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {form.incluye_iva && <span style={{ color: "white", fontSize: 12 }}>✓</span>}
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: form.incluye_iva ? "#93c5fd" : "#9ca3af" }}>Agregar IVA</span>
                {form.incluye_iva && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: 8 }} onClick={e => e.stopPropagation()}>
                    <input type="number" min="0" max="100" value={form.porcentaje_iva}
                      onChange={e => setForm({ ...form, porcentaje_iva: e.target.value })}
                      style={{ width: 60, padding: "6px 10px", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(59,130,246,0.3)", borderRadius: 8, color: "white", fontSize: 13, outline: "none", textAlign: "center" }} />
                    <span style={{ color: "#93c5fd", fontSize: 13 }}>%</span>
                    {ivaForm > 0 && <span style={{ marginLeft: 8, color: "#93c5fd", fontSize: 12, fontWeight: 700 }}>+{fmt(ivaForm)}</span>}
                  </div>
                )}
              </div>

              {/* Flete toggle */}
              <div onClick={() => setForm({ ...form, incluye_flete: !form.incluye_flete })}
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderRadius: 10, cursor: "pointer", background: form.incluye_flete ? "rgba(249,115,22,0.1)" : "rgba(255,255,255,0.04)", border: form.incluye_flete ? "1px solid rgba(249,115,22,0.3)" : "1px solid rgba(255,255,255,0.08)" }}>
                <div style={{ width: 20, height: 20, borderRadius: 5, flexShrink: 0, background: form.incluye_flete ? "#ea580c" : "rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {form.incluye_flete && <span style={{ color: "white", fontSize: 12 }}>✓</span>}
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: form.incluye_flete ? "#fb923c" : "#9ca3af" }}>🚚 Agregar flete</span>
                {form.incluye_flete && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: 8 }} onClick={e => e.stopPropagation()}>
                    <div style={{ display: "flex", borderRadius: 8, overflow: "hidden", border: "1px solid rgba(249,115,22,0.3)" }}>
                      <button onClick={() => setForm({ ...form, tipo_flete: "pesos" })} style={{ padding: "5px 12px", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, background: form.tipo_flete === "pesos" ? "#ea580c" : "rgba(255,255,255,0.05)", color: form.tipo_flete === "pesos" ? "white" : "#fb923c" }}>$</button>
                      <button onClick={() => setForm({ ...form, tipo_flete: "pct" })} style={{ padding: "5px 12px", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, background: form.tipo_flete === "pct" ? "#ea580c" : "rgba(255,255,255,0.05)", color: form.tipo_flete === "pct" ? "white" : "#fb923c" }}>%</button>
                    </div>
                    <input type="number" min="0" value={form.valor_flete}
                      onChange={e => setForm({ ...form, valor_flete: e.target.value })}
                      placeholder="0"
                      style={{ width: 80, padding: "6px 10px", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(249,115,22,0.3)", borderRadius: 8, color: "white", fontSize: 13, outline: "none", textAlign: "center" }} />
                    {fleteForm > 0 && <span style={{ color: "#fb923c", fontSize: 12, fontWeight: 700 }}>+{fmt(fleteForm)}</span>}
                  </div>
                )}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div>
                  <label style={labelStyle}>Pago inicial (0 = a crédito)</label>
                  <input type="number" min="0" step="0.01" value={form.pago_inicial}
                    onChange={e => setForm({ ...form, pago_inicial: e.target.value })} placeholder="0" style={inputDarkStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Método de pago</label>
                  <select value={form.metodo_pago} onChange={e => setForm({ ...form, metodo_pago: e.target.value })} style={selectDarkStyle}>
  {METODOS.map(m => <option key={m}>{m}</option>)}
                    {METODOS.map(m => <option key={m}>{m}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label style={labelStyle}>Notas</label>
                <textarea value={form.notas} onChange={e => setForm({ ...form, notas: e.target.value })}
                  rows={2} placeholder="Observaciones, condiciones, etc."
                  style={{ ...inputDarkStyle, resize: "none" }} />
              </div>
            </div>

            <div style={{ padding: "18px 28px", borderTop: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              {items.length > 0 && <span style={{ color: "#9ca3af", fontSize: 13 }}>Total: <b style={{ color: "white" }}>{fmt(totalForm)}</b></span>}
              <div style={{ display: "flex", gap: 10, marginLeft: "auto" }}>
                <button onClick={() => setModalNueva(false)} style={{ padding: "10px 20px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, color: "#9ca3af", fontSize: 13, cursor: "pointer", fontWeight: 600 }}>Cancelar</button>
                <button onClick={guardarCompra} disabled={guardando} style={{ padding: "10px 24px", background: "linear-gradient(135deg, #2563eb, #3b82f6)", border: "none", borderRadius: 10, color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: guardando ? 0.5 : 1 }}>
                  {guardando ? "Guardando..." : "Registrar compra"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL DETALLE ── */}
      {compraVer && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 50, padding: 16, overflowY: "auto" }}>
          <div style={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, width: "100%", maxWidth: 640, margin: "32px 0", boxShadow: "0 24px 64px rgba(0,0,0,0.6)" }}>
            <div style={{ padding: "22px 28px", borderBottom: "1px solid rgba(255,255,255,0.08)", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                  <h2 style={{ color: "white", fontSize: 17, fontWeight: 700, margin: 0 }}>Detalle de compra</h2>
                  {(() => { const est = ESTADO_LABEL[compraVer.estado] ?? ESTADO_LABEL.pendiente; return <span style={{ background: est.bg, color: est.color, fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20 }}>{est.label}</span> })()}
                  {compraVer.incluye_iva && <span style={{ background: "rgba(59,130,246,0.12)", color: "#93c5fd", fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 20 }}>IVA {compraVer.porcentaje_iva}%</span>}
                  {compraVer.monto_flete > 0 && <span style={{ background: "rgba(249,115,22,0.12)", color: "#fb923c", fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 20 }}>🚚 {fmt(compraVer.monto_flete)}</span>}
                </div>
                <p style={{ color: "#6b7280", fontSize: 12, margin: 0 }}>
                  {compraVer.proveedores?.nombre} · {compraVer.fecha}
                  {compraVer.numero_remito && <span> · Remito: {compraVer.numero_remito}</span>}
                </p>
              </div>
              <button onClick={() => setCompraVer(null)} style={{ background: "rgba(255,255,255,0.08)", border: "none", color: "white", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 16, fontWeight: 700 }}>✕</button>
            </div>

            {/* Resumen financiero */}
            <div style={{ padding: "18px 28px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 14 }}>
                {[
                  { label: "Total", value: fmt(compraVer.total), color: "white" },
                  { label: "Pagado", value: fmt(compraVer.total_pagado), color: "#4ade80" },
                  { label: "Saldo", value: fmt(compraVer.total - compraVer.total_pagado), color: compraVer.estado === "pagado" ? "#6b7280" : "#f87171" },
                ].map(item => (
                  <div key={item.label} style={{ background: "rgba(255,255,255,0.04)", borderRadius: 10, padding: "12px 16px", textAlign: "center", border: "1px solid rgba(255,255,255,0.06)" }}>
                    <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 4 }}>{item.label}</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: item.color }}>{item.value}</div>
                  </div>
                ))}
              </div>
              {compraVer.estado !== "pagado" ? (
                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={() => { setFormPago({ monto: "", metodo_pago: "Efectivo", notas: "" }); setModalPago(true) }}
                    style={{ flex: 1, padding: "10px", background: "linear-gradient(135deg, #16a34a, #22c55e)", border: "none", borderRadius: 10, color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                    💳 Pago parcial
                  </button>
                  <button onClick={cancelarCompra} disabled={cancelando}
                    style={{ flex: 1, padding: "10px", background: "linear-gradient(135deg, #2563eb, #3b82f6)", border: "none", borderRadius: 10, color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: cancelando ? 0.5 : 1 }}>
                    {cancelando ? "..." : `✅ Cancelar deuda (${fmt(compraVer.total - compraVer.total_pagado)})`}
                  </button>
                </div>
              ) : (
                <div style={{ textAlign: "center", padding: "10px", background: "rgba(74,222,128,0.08)", borderRadius: 10, color: "#4ade80", fontSize: 13, fontWeight: 700, border: "1px solid rgba(74,222,128,0.15)" }}>
                  ✓ Compra totalmente pagada
                </div>
              )}
            </div>

            {/* Tabs */}
            <div style={{ display: "flex", padding: "0 28px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
              {(["detalle", "pagos"] as const).map(t => (
                <button key={t} onClick={() => setTabDetalle(t)}
                  style={{ padding: "14px 18px", border: "none", background: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, color: tabDetalle === t ? "#3b82f6" : "#6b7280", borderBottom: tabDetalle === t ? "2px solid #3b82f6" : "2px solid transparent", marginBottom: -1 }}>
                  {t === "detalle" ? "📦 Productos" : `💰 Pagos (${pagos.length})`}
                </button>
              ))}
            </div>

            {loadingDetalle ? (
              <div style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>Cargando...</div>
            ) : (
              <div style={{ padding: "20px 28px" }}>
                {tabDetalle === "detalle" && (() => {
                  const subtotalBase = detalle.reduce((s, d) => s + d.cantidad * d.precio_unitario, 0);
                  const detalleConExtras = detalle.map(d => {
                    const subtotalItem = d.cantidad * d.precio_unitario;
                    const proporcion = subtotalBase > 0 ? subtotalItem / subtotalBase : 0;
                    const ivaItem = compraVer.incluye_iva ? Math.round(compraVer.monto_iva * proporcion * 100) / 100 : 0;
                    const fleteItem = compraVer.monto_flete > 0 ? Math.round(compraVer.monto_flete * proporcion * 100) / 100 : 0;
                    return { ...d, subtotalItem, ivaItem, fleteItem };
                  });
                  const hayIva = compraVer.incluye_iva && compraVer.monto_iva > 0;
                  const hayFlete = compraVer.monto_flete > 0;
                  const colSpanTotal = 3 + (hayIva ? 1 : 0) + (hayFlete ? 1 : 0);
                  return (
                    <div>
                      <div style={{ overflowX: "auto" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                          <thead>
                            <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                              <th style={{ textAlign: "left", padding: "8px 10px", color: "#6b7280", fontSize: 11, fontWeight: 700, textTransform: "uppercase" }}>Producto</th>
                              <th style={{ textAlign: "center", padding: "8px 10px", color: "#6b7280", fontSize: 11, fontWeight: 700, textTransform: "uppercase" }}>Cant.</th>
                              <th style={{ textAlign: "right", padding: "8px 10px", color: "#6b7280", fontSize: 11, fontWeight: 700, textTransform: "uppercase" }}>P. unit.</th>
                              <th style={{ textAlign: "right", padding: "8px 10px", color: "#6b7280", fontSize: 11, fontWeight: 700, textTransform: "uppercase" }}>Subtotal</th>
                              {hayIva && <th style={{ textAlign: "right", padding: "8px 10px", color: "#93c5fd", fontSize: 11, fontWeight: 700, textTransform: "uppercase" }}>IVA</th>}
                              {hayFlete && <th style={{ textAlign: "right", padding: "8px 10px", color: "#fb923c", fontSize: 11, fontWeight: 700, textTransform: "uppercase" }}>Flete</th>}
                              <th style={{ textAlign: "right", padding: "8px 10px", color: "#6b7280", fontSize: 11, fontWeight: 700, textTransform: "uppercase" }}>Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {detalleConExtras.map(d => (
                              <tr key={d.id} style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                                <td style={{ padding: "9px 10px", color: "white", fontSize: 12 }}>{d.productos?.nombre ?? "—"}</td>
                                <td style={{ padding: "9px 10px", textAlign: "center", color: "#9ca3af", fontSize: 12 }}>{d.cantidad}</td>
                                <td style={{ padding: "9px 10px", textAlign: "right", color: "#d1d5db", fontSize: 12 }}>{fmt(d.precio_unitario)}</td>
                                <td style={{ padding: "9px 10px", textAlign: "right", color: "#d1d5db", fontSize: 12 }}>{fmt(d.subtotalItem)}</td>
                                {hayIva && <td style={{ padding: "9px 10px", textAlign: "right", color: "#93c5fd", fontSize: 12 }}>{fmt(d.ivaItem)}</td>}
                                {hayFlete && <td style={{ padding: "9px 10px", textAlign: "right", color: "#fb923c", fontSize: 12 }}>{fmt(d.fleteItem)}</td>}
                                <td style={{ padding: "9px 10px", textAlign: "right", color: "white", fontSize: 12, fontWeight: 700 }}>{fmt(d.subtotalItem + d.ivaItem + d.fleteItem)}</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            {(hayIva || hayFlete) && (
                              <tr style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                                <td colSpan={colSpanTotal} style={{ padding: "8px 10px", textAlign: "right", color: "#6b7280", fontSize: 12 }}>Subtotal:</td>
                                <td style={{ padding: "8px 10px", textAlign: "right", color: "#d1d5db", fontSize: 12, fontWeight: 600 }}>{fmt(compraVer.total - compraVer.monto_iva - compraVer.monto_flete)}</td>
                              </tr>
                            )}
                            {hayIva && (
                              <tr>
                                <td colSpan={colSpanTotal} style={{ padding: "6px 10px", textAlign: "right", color: "#93c5fd", fontSize: 12 }}>IVA {compraVer.porcentaje_iva}%:</td>
                                <td style={{ padding: "6px 10px", textAlign: "right", color: "#93c5fd", fontSize: 12, fontWeight: 600 }}>{fmt(compraVer.monto_iva)}</td>
                              </tr>
                            )}
                            {hayFlete && (
                              <tr>
                                <td colSpan={colSpanTotal} style={{ padding: "6px 10px", textAlign: "right", color: "#fb923c", fontSize: 12 }}>🚚 Flete:</td>
                                <td style={{ padding: "6px 10px", textAlign: "right", color: "#fb923c", fontSize: 12, fontWeight: 600 }}>{fmt(compraVer.monto_flete)}</td>
                              </tr>
                            )}
                            <tr style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                              <td colSpan={colSpanTotal} style={{ padding: "10px 10px", textAlign: "right", color: "white", fontSize: 13, fontWeight: 700 }}>Total:</td>
                              <td style={{ padding: "10px 10px", textAlign: "right", color: "white", fontSize: 15, fontWeight: 800 }}>{fmt(compraVer.total)}</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                      {compraVer.notas && (
                        <p style={{ marginTop: 12, fontSize: 12, color: "#9ca3af", background: "rgba(255,255,255,0.04)", padding: "8px 12px", borderRadius: 8 }}>📝 {compraVer.notas}</p>
                      )}
                    </div>
                  );
                })()}

                {tabDetalle === "pagos" && (
                  <div>
                    {pagos.length === 0 ? (
                      <p style={{ textAlign: "center", padding: 24, color: "#6b7280", fontSize: 13 }}>Sin pagos registrados todavía.</p>
                    ) : (
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                        <thead>
                          <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                            {["#", "Fecha", "Método", "Monto", "Notas"].map((h, i) => (
                              <th key={i} style={{ padding: "8px 10px", textAlign: i === 3 ? "right" : "left", color: "#6b7280", fontSize: 11, fontWeight: 700, textTransform: "uppercase" }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {pagos.map((p, idx) => (
                            <tr key={p.id} style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                              <td style={{ padding: "9px 10px", color: "#6b7280", fontSize: 12 }}>{idx + 1}</td>
                              <td style={{ padding: "9px 10px", color: "#d1d5db", fontSize: 12 }}>{p.fecha}</td>
                              <td style={{ padding: "9px 10px", color: "#9ca3af", fontSize: 12 }}>{p.metodo_pago ?? "—"}</td>
                              <td style={{ padding: "9px 10px", textAlign: "right", color: "#4ade80", fontWeight: 700, fontSize: 13 }}>{fmt(p.monto)}</td>
                              <td style={{ padding: "9px 10px", color: "#6b7280", fontSize: 12 }}>{p.notas ?? ""}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                            <td colSpan={3} style={{ padding: "10px 10px", textAlign: "right", color: "white", fontSize: 13, fontWeight: 700 }}>Total pagado:</td>
                            <td style={{ padding: "10px 10px", textAlign: "right", color: "#4ade80", fontSize: 14, fontWeight: 800 }}>{fmt(compraVer.total_pagado)}</td>
                            <td></td>
                          </tr>
                        </tfoot>
                      </table>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── MODAL PAGO PARCIAL ── */}
      {modalPago && compraVer && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60, padding: 16 }}>
          <div style={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: "32px 28px", width: "100%", maxWidth: 380, boxShadow: "0 24px 64px rgba(0,0,0,0.6)" }}>
            <h2 style={{ color: "white", fontSize: 17, fontWeight: 700, margin: "0 0 4px" }}>Registrar pago</h2>
            <p style={{ color: "#6b7280", fontSize: 12, marginBottom: 20 }}>Saldo: <span style={{ color: "#f87171", fontWeight: 700 }}>{fmt(compraVer.total - compraVer.total_pagado)}</span></p>
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Monto *</label>
              <input type="number" min="0" step="0.01" value={formPago.monto}
                onChange={e => setFormPago({ ...formPago, monto: e.target.value })}
                placeholder="0.00" style={inputDarkStyle} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Método</label>
              <select value={formPago.metodo_pago} onChange={e => setFormPago({ ...formPago, metodo_pago: e.target.value })} style={{ ...inputDarkStyle, cursor: "pointer" }}>
                {METODOS.map(m => <option key={m}>{m}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: 24 }}>
              <label style={labelStyle}>Notas</label>
              <input type="text" value={formPago.notas} onChange={e => setFormPago({ ...formPago, notas: e.target.value })} placeholder="Opcional" style={inputDarkStyle} />
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setModalPago(false)} style={{ flex: 1, padding: "11px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, color: "#9ca3af", fontSize: 13, cursor: "pointer", fontWeight: 600 }}>Cancelar</button>
              <button onClick={guardarPago} disabled={guardandoPago} style={{ flex: 1, padding: "11px", background: "linear-gradient(135deg, #16a34a, #22c55e)", border: "none", borderRadius: 10, color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: guardandoPago ? 0.5 : 1 }}>
                {guardandoPago ? "Guardando..." : "Confirmar pago"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL ELIMINAR COMPRA ── */}
      {confirmEliminarCompra && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 }}>
          <div style={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: "36px 32px", width: "100%", maxWidth: 400, boxShadow: "0 24px 64px rgba(0,0,0,0.6)" }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🗑️</div>
            <h2 style={{ color: "white", fontSize: 18, fontWeight: 700, margin: "0 0 8px" }}>¿Eliminar compra?</h2>
            <p style={{ color: "#9ca3af", fontSize: 13, marginBottom: 8 }}>
              Proveedor: <span style={{ color: "white", fontWeight: 600 }}>{confirmEliminarCompra.proveedores?.nombre ?? "—"}</span>
            </p>
            <p style={{ color: "#9ca3af", fontSize: 13, marginBottom: 16 }}>
              Total: <span style={{ color: "white", fontWeight: 600 }}>{fmt(confirmEliminarCompra.total)}</span> · Fecha: <span style={{ color: "white" }}>{confirmEliminarCompra.fecha}</span>
            </p>
            <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, padding: "10px 12px", marginBottom: 24 }}>
              <p style={{ color: "#f87171", fontSize: 12, margin: 0 }}>⚠️ Se eliminarán también los pagos y lotes asociados. Esta acción no se puede deshacer.</p>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setConfirmEliminarCompra(null)} style={{ flex: 1, padding: "11px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, color: "#9ca3af", fontSize: 13, cursor: "pointer", fontWeight: 600 }}>Cancelar</button>
              <button onClick={eliminarCompra} disabled={eliminandoCompra} style={{ flex: 1, padding: "11px", background: "#dc2626", border: "none", borderRadius: 10, color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: eliminandoCompra ? 0.5 : 1 }}>
                {eliminandoCompra ? "Eliminando..." : "Eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}