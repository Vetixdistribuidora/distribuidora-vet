"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

interface Proveedor { id: number; nombre: string; }
interface Producto { id: number; nombre: string; stock: number; }
interface ItemForm { producto_id: number; nombre: string; cantidad: number; precio_unitario: number; }
interface Compra {
  id: number;
  fecha: string;
  numero_remito: string | null;
  fecha_vencimiento: string | null;
  metodo_pago: string | null;
  notas: string | null;
  total: number;
  total_pagado: number;
  estado: string;
  incluye_iva: boolean;
  monto_iva: number;
  porcentaje_iva: number;
  proveedores: { nombre: string } | null;
}
interface DetalleCompra {
  id: number; cantidad: number; precio_unitario: number; subtotal: number;
  productos: { nombre: string } | null;
}
interface PagoCompra {
  id: number; fecha: string; monto: number; metodo_pago: string | null; notas: string | null;
}

const METODOS = ["Efectivo", "Transferencia", "Cheque", "Tarjeta", "Otro"];
const ESTADO_LABEL: Record<string, { label: string; color: string }> = {
  pendiente: { label: "Pendiente", color: "bg-red-100 text-red-700" },
  parcial:   { label: "Parcial",   color: "bg-yellow-100 text-yellow-700" },
  pagado:    { label: "Pagado",    color: "bg-green-100 text-green-700" },
};

function fmt(n: number) {
  return n.toLocaleString("es-AR", { style: "currency", currency: "ARS" });
}

function calcularTotales(
  items: ItemForm[],
  incluyeIva: boolean, porcentajeIva: number,
  incluyeFlete: boolean, tipoFlete: "pct" | "pesos", valorFlete: number
) {
  const subtotal = items.reduce((s, it) => s + it.cantidad * it.precio_unitario, 0);
  const iva = incluyeIva && porcentajeIva > 0 ? Math.round(subtotal * (porcentajeIva / 100) * 100) / 100 : 0;
  const flete = incluyeFlete && valorFlete > 0
    ? tipoFlete === "pct"
      ? Math.round(subtotal * (valorFlete / 100) * 100) / 100
      : valorFlete
    : 0;
  return { subtotal, iva, flete, total: subtotal + iva + flete };
}

export default function ComprasPage() {
  const [compras, setCompras] = useState<Compra[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("todos");

  const [modalNueva, setModalNueva] = useState(false);
  const [form, setForm] = useState({
    proveedor_id: "", fecha: new Date().toISOString().slice(0, 10),
    numero_remito: "", fecha_vencimiento: "", metodo_pago: "Efectivo",
    notas: "", pago_inicial: "", incluye_iva: false, porcentaje_iva: "21",
    incluye_flete: false, tipo_flete: "pesos" as "pct" | "pesos", valor_flete: "",
  });
  const [items, setItems] = useState<ItemForm[]>([]);
  const [productoSel, setProductoSel] = useState("");
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
    setItems([]);
    setProductoSel("");
    setErrorForm(null);
    setModalNueva(true);
  }

  function agregarItem() {
    const prod = productos.find(p => p.id === Number(productoSel));
    if (!prod) return;
    if (items.find(i => i.producto_id === Number(productoSel))) return;
    setItems([...items, { producto_id: prod.id, nombre: prod.nombre, cantidad: 1, precio_unitario: 0 }]);
    setProductoSel("");
  }

  function actualizarItem(idx: number, campo: "cantidad" | "precio_unitario", val: number) {
    setItems(items.map((it, i) => i === idx ? { ...it, [campo]: val } : it));
  }

  function quitarItem(idx: number) { setItems(items.filter((_, i) => i !== idx)); }

  async function guardarCompra() {
  if (!form.proveedor_id) { setErrorForm("Seleccioná un proveedor."); return; }
  if (items.length === 0) { setErrorForm("Agregá al menos un producto."); return; }
  if (items.some(it => it.precio_unitario <= 0)) { setErrorForm("Todos los productos deben tener precio mayor a 0."); return; }

  const pctIva = parseFloat(form.porcentaje_iva) || 0;
  if (form.incluye_iva && (pctIva <= 0 || pctIva > 100)) {
    setErrorForm("El porcentaje de IVA debe estar entre 1 y 100.");
    return;
  }

  const valFlete = parseFloat(form.valor_flete) || 0;
  if (form.incluye_flete && valFlete <= 0) {
    setErrorForm("El valor del flete debe ser mayor a 0.");
    return;
  }

  setGuardando(true);
  setErrorForm(null);

 // ✅ calcular subtotal base
const subtotal = items.reduce((s, it) => s + it.cantidad * it.precio_unitario, 0);

// ✅ calcular flete correctamente
let montoFlete = 0;

if (form.incluye_flete) {
  if (form.tipo_flete === "pct") {
    montoFlete = Math.round(subtotal * (valFlete / 100) * 100) / 100;
  } else {
    montoFlete = valFlete;
  }
}

  const { error } = await supabase.rpc("registrar_compra", {
    p_proveedor_id: Number(form.proveedor_id),
    p_fecha: form.fecha,
    p_numero_remito: form.numero_remito || null,
    p_fecha_vencimiento: form.fecha_vencimiento || null,
    p_metodo_pago: form.metodo_pago,
    p_notas: form.notas || null,
    p_pago_inicial: parseFloat(form.pago_inicial) || 0,
    p_items: items.map(it => ({
      producto_id: it.producto_id,
      cantidad: it.cantidad,
      precio_unitario: it.precio_unitario
    })),
    p_incluye_iva: form.incluye_iva,
    p_porcentaje_iva: pctIva,

    // ✅ CLAVE: esto ahora va limpio y bien
    p_monto_flete: montoFlete
  });

  setGuardando(false);

  if (error) {
    setErrorForm("Error: " + error.message);
    return;
  }

  setModalNueva(false);
  cargarTodo();
}

  async function verDetalle(c: Compra) {
    setCompraVer(c);
    setTabDetalle("detalle");
    setLoadingDetalle(true);
    const [{ data: d }, { data: p }] = await Promise.all([
      supabase.from("compras_detalle").select("*, productos(nombre)").eq("compra_id", c.id),
      supabase.from("compras_pagos").select("*").eq("compra_id", c.id).order("fecha"),
    ]);
    if (d) setDetalle(d);
    if (p) setPagos(p);
    setLoadingDetalle(false);
  }

  async function cancelarCompra() {
    if (!compraVer) return;
    const saldo = compraVer.total - compraVer.total_pagado;
    if (saldo <= 0) return;
    setCancelando(true);
    await supabase.rpc("registrar_pago_compra", {
      p_compra_id: compraVer.id, p_monto: saldo,
      p_metodo_pago: "Efectivo", p_notas: "Cancelación total",
    });
    setCancelando(false);
    const actualizada = { ...compraVer, total_pagado: compraVer.total, estado: "pagado" };
    setCompraVer(actualizada);
    const { data: p } = await supabase.from("compras_pagos").select("*").eq("compra_id", compraVer.id).order("fecha");
    if (p) setPagos(p);
    cargarTodo();
  }

  function abrirPago() {
    setFormPago({ monto: "", metodo_pago: "Efectivo", notas: "" });
    setModalPago(true);
  }

  async function guardarPago() {
    if (!compraVer) return;
    const monto = parseFloat(formPago.monto);
    const saldo = compraVer.total - compraVer.total_pagado;
    if (!monto || monto <= 0) return;
    if (monto > saldo) { alert("El monto supera el saldo pendiente."); return; }
    setGuardandoPago(true);
    await supabase.rpc("registrar_pago_compra", {
      p_compra_id: compraVer.id, p_monto: monto,
      p_metodo_pago: formPago.metodo_pago, p_notas: formPago.notas || null,
    });
    setGuardandoPago(false);
    setModalPago(false);
    const nuevoTotal = compraVer.total_pagado + monto;
    setCompraVer({ ...compraVer, total_pagado: nuevoTotal, estado: nuevoTotal >= compraVer.total ? "pagado" : "parcial" });
    const { data: p } = await supabase.from("compras_pagos").select("*").eq("compra_id", compraVer.id).order("fecha");
    if (p) setPagos(p);
    cargarTodo();
  }

  const filtradas = compras.filter(c => {
    const texto = [c.proveedores?.nombre, c.numero_remito].join(" ").toLowerCase();
    return texto.includes(busqueda.toLowerCase()) && (filtroEstado === "todos" || c.estado === filtroEstado);
  });

  const totalDeuda = compras.filter(c => c.estado !== "pagado").reduce((s, c) => s + (c.total - c.total_pagado), 0);
  const pctIvaForm = parseFloat(form.porcentaje_iva) || 0;
  const valFleteForm = parseFloat(form.valor_flete) || 0;
  const { subtotal: subtotalForm, iva: ivaForm, flete: fleteForm, total: totalForm } =
    calcularTotales(items, form.incluye_iva, pctIvaForm, form.incluye_flete, form.tipo_flete, valFleteForm);

  return (
    <div className="p-4 md:p-6" style={{ maxWidth: "100%", overflowX: "hidden" }}>

      {/* Encabezado */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Compras</h1>
          <p className="text-sm text-gray-500 mt-1">
            {compras.length} compra{compras.length !== 1 ? "s" : ""} registrada{compras.length !== 1 ? "s" : ""}
            {totalDeuda > 0 && <span className="ml-2 text-red-600 font-medium">· Deuda: {fmt(totalDeuda)}</span>}
          </p>
        </div>
        <button onClick={abrirNueva} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap">
          + Nueva compra
        </button>
      </div>

      {/* Filtros */}
      <div className="flex gap-3 mb-4">
        <input type="text" placeholder="Buscar proveedor o remito..." value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          className="flex-1 min-w-0 border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="todos">Todos</option>
          <option value="pendiente">Pendiente</option>
          <option value="parcial">Parcial</option>
          <option value="pagado">Pagado</option>
        </select>
      </div>

      {/* Cards */}
      {loading ? (
        <div className="p-8 text-center text-gray-400 text-sm">Cargando...</div>
      ) : filtradas.length === 0 ? (
        <div className="p-8 text-center text-gray-400 text-sm">No hay compras registradas.</div>
      ) : (
        <div className="space-y-3">
          {filtradas.map(c => {
            const saldo = c.total - c.total_pagado;
            const est = ESTADO_LABEL[c.estado] ?? ESTADO_LABEL.pendiente;
            const vencido = c.fecha_vencimiento && c.estado !== "pagado" && new Date(c.fecha_vencimiento) < new Date();
            return (
              <div key={c.id}
                className={`bg-white rounded-xl border shadow-sm p-4 ${vencido ? "border-red-300 bg-red-50" : "border-gray-200"}`}>
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-semibold text-gray-900">{c.proveedores?.nombre ?? "—"}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${est.color}`}>{est.label}</span>
                      {c.incluye_iva && (
                        <span className="bg-blue-50 text-blue-700 text-xs px-2 py-0.5 rounded-full font-medium">
                          IVA {c.porcentaje_iva}%
                        </span>
                      )}
                      {vencido && <span className="text-red-600 text-xs font-medium">⚠️ Vencida</span>}
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-gray-500">
                      <span>📅 {c.fecha}</span>
                      {c.numero_remito && <span>🧾 {c.numero_remito}</span>}
                      {c.fecha_vencimiento && (
                        <span className={vencido ? "text-red-600 font-medium" : ""}>
                          ⏰ Vence: {c.fecha_vencimiento}
                        </span>
                      )}
                      {c.metodo_pago && <span>💳 {c.metodo_pago}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 flex-shrink-0">
                    <div className="text-right">
                      <div className="text-xs text-gray-400">Total</div>
                      <div className="font-semibold text-gray-900 text-sm">{fmt(c.total)}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-gray-400">Pagado</div>
                      <div className="font-semibold text-green-700 text-sm">{fmt(c.total_pagado)}</div>
                    </div>
                    {saldo > 0 && (
                      <div className="text-right">
                        <div className="text-xs text-gray-400">Saldo</div>
                        <div className="font-bold text-red-600 text-sm">{fmt(saldo)}</div>
                      </div>
                    )}
                    <button onClick={() => verDetalle(c)}
                      className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap">
                      Ver detalle
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── MODAL NUEVA COMPRA ── */}
      {modalNueva && (
        <div className="fixed inset-0 bg-black/40 flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl my-8">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">Nueva compra</h2>
            </div>
            <div className="px-6 py-4 space-y-4">
              {errorForm && <div className="bg-red-50 text-red-600 text-sm px-3 py-2 rounded-lg">{errorForm}</div>}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Proveedor *</label>
                  <select value={form.proveedor_id} onChange={e => setForm({ ...form, proveedor_id: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">Seleccioná un proveedor</option>
                    {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Fecha</label>
                  <input type="date" value={form.fecha} onChange={e => setForm({ ...form, fecha: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">N° Remito / Factura</label>
                  <input type="text" value={form.numero_remito} onChange={e => setForm({ ...form, numero_remito: e.target.value })}
                    placeholder="0001-00012345"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Fecha de vencimiento</label>
                  <input type="date" value={form.fecha_vencimiento} onChange={e => setForm({ ...form, fecha_vencimiento: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>

              {/* Productos */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Productos *</label>
                <div className="flex gap-2 mb-2">
                  <select value={productoSel} onChange={e => setProductoSel(e.target.value)}
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">Seleccioná un producto</option>
                    {productos.filter(p => !items.find(i => i.producto_id === p.id)).map(p =>
                      <option key={p.id} value={p.id}>{p.nombre}</option>)}
                  </select>
                  <button onClick={agregarItem} disabled={!productoSel}
                    className="bg-gray-100 hover:bg-gray-200 disabled:opacity-40 px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                    Agregar
                  </button>
                </div>
                {items.length > 0 && (
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 text-gray-500 text-xs">
                        <tr>
                          <th className="text-left px-3 py-2">Producto</th>
                          <th className="text-center px-3 py-2 w-20">Cant.</th>
                          <th className="text-center px-3 py-2 w-28">P. unit.</th>
                          <th className="text-right px-3 py-2 w-24">Subtotal</th>
                          <th className="w-6"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {items.map((it, idx) => (
                          <tr key={it.producto_id}>
                            <td className="px-3 py-2 text-gray-800 text-xs">{it.nombre}</td>
                            <td className="px-3 py-2">
                              <input type="number" min="1" value={it.cantidad}
                                onChange={e => actualizarItem(idx, "cantidad", parseFloat(e.target.value) || 1)}
                                className="w-full text-center border border-gray-300 rounded px-1 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                            </td>
                            <td className="px-3 py-2">
                              <input type="number" min="0" step="0.01" value={it.precio_unitario}
                                onChange={e => actualizarItem(idx, "precio_unitario", parseFloat(e.target.value) || 0)}
                                className="w-full text-center border border-gray-300 rounded px-1 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                            </td>
                            <td className="px-3 py-2 text-right font-medium text-gray-700 text-xs">{fmt(it.cantidad * it.precio_unitario)}</td>
                            <td className="px-3 py-2 text-center">
                              <button onClick={() => quitarItem(idx)} className="text-red-400 hover:text-red-600 text-xs">✕</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-gray-50 text-sm">
                        <tr>
                          <td colSpan={3} className="px-3 py-1.5 text-right text-gray-500 text-xs">Subtotal:</td>
                          <td className="px-3 py-1.5 text-right text-gray-700 text-xs">{fmt(subtotalForm)}</td>
                          <td></td>
                        </tr>
                        {form.incluye_iva && ivaForm > 0 && (
                          <tr>
                            <td colSpan={3} className="px-3 py-1.5 text-right text-blue-600 text-xs">IVA {pctIvaForm}%:</td>
                            <td className="px-3 py-1.5 text-right text-blue-600 text-xs">{fmt(ivaForm)}</td>
                            <td></td>
                          </tr>
                        )}
                        {form.incluye_flete && fleteForm > 0 && (
                          <tr>
                            <td colSpan={3} className="px-3 py-1.5 text-right text-orange-600 text-xs">
                              Flete{form.tipo_flete === "pct" ? ` ${valFleteForm}%` : ""}:
                            </td>
                            <td className="px-3 py-1.5 text-right text-orange-600 text-xs">{fmt(fleteForm)}</td>
                            <td></td>
                          </tr>
                        )}
                        <tr className="border-t border-gray-200">
                          <td colSpan={3} className="px-3 py-2 text-right font-semibold text-gray-700 text-xs">Total:</td>
                          <td className="px-3 py-2 text-right font-bold text-gray-900 text-xs">{fmt(totalForm)}</td>
                          <td></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>

              {/* IVA toggle */}
              <div className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${form.incluye_iva ? "bg-blue-50 border-blue-200" : "bg-gray-50 border-gray-200"}`}>
                <input type="checkbox" id="incluye_iva" checked={form.incluye_iva}
                  onChange={e => setForm({ ...form, incluye_iva: e.target.checked })}
                  className="w-4 h-4 accent-blue-600 cursor-pointer flex-shrink-0" />
                <label htmlFor="incluye_iva" className={`text-sm cursor-pointer font-medium ${form.incluye_iva ? "text-blue-800" : "text-gray-600"}`}>
                  Agregar IVA
                </label>
                {form.incluye_iva && (
                  <>
                    <div className="flex items-center gap-1.5 ml-2">
                      <input type="number" min="0" max="100" step="0.5"
                        value={form.porcentaje_iva}
                        onChange={e => setForm({ ...form, porcentaje_iva: e.target.value })}
                        className="w-16 text-center border border-blue-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
                      <span className="text-sm text-blue-700 font-medium">%</span>
                    </div>
                    {items.length > 0 && ivaForm > 0 && (
                      <span className="ml-auto text-xs text-blue-700 font-medium">+{fmt(ivaForm)}</span>
                    )}
                  </>
                )}
              </div>

              {/* Flete toggle */}
              <div className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${form.incluye_flete ? "bg-orange-50 border-orange-200" : "bg-gray-50 border-gray-200"}`}>
                <input type="checkbox" id="incluye_flete" checked={form.incluye_flete}
                  onChange={e => setForm({ ...form, incluye_flete: e.target.checked })}
                  className="w-4 h-4 accent-orange-500 cursor-pointer flex-shrink-0" />
                <label htmlFor="incluye_flete" className={`text-sm cursor-pointer font-medium ${form.incluye_flete ? "text-orange-800" : "text-gray-600"}`}>
                  Agregar flete
                </label>
                {form.incluye_flete && (
                  <>
                    {/* Selector % o $ */}
                    <div className="flex rounded-lg border border-orange-300 overflow-hidden ml-2">
                      <button
                        onClick={() => setForm({ ...form, tipo_flete: "pesos" })}
                        className={`px-2.5 py-1 text-xs font-medium transition-colors ${form.tipo_flete === "pesos" ? "bg-orange-500 text-white" : "bg-white text-orange-700 hover:bg-orange-50"}`}>
                        $
                      </button>
                      <button
                        onClick={() => setForm({ ...form, tipo_flete: "pct" })}
                        className={`px-2.5 py-1 text-xs font-medium transition-colors ${form.tipo_flete === "pct" ? "bg-orange-500 text-white" : "bg-white text-orange-700 hover:bg-orange-50"}`}>
                        %
                      </button>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <input type="number" min="0" step={form.tipo_flete === "pct" ? "0.5" : "1"}
                        value={form.valor_flete}
                        onChange={e => setForm({ ...form, valor_flete: e.target.value })}
                        placeholder="0"
                        className="w-20 text-center border border-orange-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white" />
                      <span className="text-sm text-orange-700 font-medium">
                        {form.tipo_flete === "pct" ? "%" : "$"}
                      </span>
                    </div>
                    {items.length > 0 && fleteForm > 0 && (
                      <span className="ml-auto text-xs text-orange-700 font-medium">+{fmt(fleteForm)}</span>
                    )}
                  </>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Pago inicial (0 = a crédito)</label>
                  <input type="number" min="0" step="0.01" value={form.pago_inicial}
                    onChange={e => setForm({ ...form, pago_inicial: e.target.value })}
                    placeholder="0"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Método de pago</label>
                  <select value={form.metodo_pago} onChange={e => setForm({ ...form, metodo_pago: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    {METODOS.map(m => <option key={m}>{m}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Notas</label>
                <textarea value={form.notas} onChange={e => setForm({ ...form, notas: e.target.value })}
                  rows={2} placeholder="Observaciones, condiciones, etc."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
              {items.length > 0 && (
                <div className="text-sm text-gray-500">
                  Total: <span className="font-bold text-gray-900">{fmt(totalForm)}</span>
                </div>
              )}
              <div className="flex gap-3 ml-auto">
                <button onClick={() => setModalNueva(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Cancelar</button>
                <button onClick={guardarCompra} disabled={guardando}
                  className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors">
                  {guardando ? "Guardando..." : "Registrar compra"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL DETALLE ── */}
      {compraVer && (
        <div className="fixed inset-0 bg-black/40 flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl my-8">
            <div className="px-6 py-4 border-b border-gray-100 flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <h2 className="text-lg font-semibold text-gray-900">Detalle de compra</h2>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ESTADO_LABEL[compraVer.estado]?.color}`}>
                    {ESTADO_LABEL[compraVer.estado]?.label}
                  </span>
                  {compraVer.incluye_iva && (
                    <span className="bg-blue-50 text-blue-700 text-xs px-2 py-0.5 rounded-full font-medium">
                      IVA {compraVer.porcentaje_iva}%
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-500">
                  {compraVer.proveedores?.nombre} · {compraVer.fecha}
                  {compraVer.numero_remito && <span> · Remito: {compraVer.numero_remito}</span>}
                </p>
              </div>
              <button onClick={() => setCompraVer(null)} className="text-gray-400 hover:text-gray-600 text-xl leading-none ml-4 flex-shrink-0">✕</button>
            </div>

            {/* Resumen financiero */}
            <div className="px-6 pt-4">
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Total", value: fmt(compraVer.total), color: "text-gray-900" },
                  { label: "Pagado", value: fmt(compraVer.total_pagado), color: "text-green-700" },
                  { label: "Saldo", value: fmt(compraVer.total - compraVer.total_pagado), color: compraVer.estado === "pagado" ? "text-gray-400" : "text-red-600" },
                ].map(item => (
                  <div key={item.label} className="bg-gray-50 rounded-lg px-4 py-3 text-center">
                    <div className="text-xs text-gray-500 mb-1">{item.label}</div>
                    <div className={`text-base font-bold ${item.color}`}>{item.value}</div>
                  </div>
                ))}
              </div>

              {compraVer.estado !== "pagado" ? (
                <div className="flex gap-2 mt-3">
                  <button onClick={abrirPago}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                    💳 Pago parcial
                  </button>
                  <button onClick={cancelarCompra} disabled={cancelando}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                    {cancelando ? "..." : `✅ Cancelar deuda (${fmt(compraVer.total - compraVer.total_pagado)})`}
                  </button>
                </div>
              ) : (
                <div className="mt-3 text-center py-2 bg-green-50 rounded-lg text-green-700 text-sm font-medium">
                  ✓ Compra totalmente pagada
                </div>
              )}
            </div>

            {/* Tabs */}
            <div className="px-6 mt-4 border-b border-gray-100">
              <div className="flex gap-4">
                {(["detalle", "pagos"] as const).map(tab => (
                  <button key={tab} onClick={() => setTabDetalle(tab)}
                    className={`pb-2 text-sm font-medium border-b-2 transition-colors ${
                      tabDetalle === tab ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"
                    }`}>
                    {tab === "detalle" ? "📦 Productos" : `💰 Pagos (${pagos.length})`}
                  </button>
                ))}
              </div>
            </div>

            {loadingDetalle ? (
              <div className="p-8 text-center text-gray-400 text-sm">Cargando...</div>
            ) : (
              <div className="px-6 py-4">
                {tabDetalle === "detalle" && (
                  <div>
                    <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
                      <thead className="bg-gray-50 text-gray-500 text-xs">
                        <tr>
                          <th className="text-left px-3 py-2">Producto</th>
                          <th className="text-center px-3 py-2">Cant.</th>
                          <th className="text-right px-3 py-2">P. unit.</th>
                          <th className="text-right px-3 py-2">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {(() => {
  const ivaPct = compraVer.porcentaje_iva || 0;

  // 1. Calcular BASE TOTAL (sin IVA ni flete)
  const baseTotal = detalle.reduce((acc, d) => {
    return acc + (d.subtotal / (1 + ivaPct / 100));
  }, 0);

  // 2. IVA total
  const ivaTotal = compraVer.monto_iva || 0;

  // 3. FLETE total (REAL)
  const fleteTotal = compraVer.total - baseTotal - ivaTotal;

  return detalle.map(d => {
    const subtotalConTodo = d.subtotal;

    // Base del item
    const baseItem = subtotalConTodo / (1 + ivaPct / 100);

    // IVA del item
    const ivaItem = ivaPct > 0 ? baseItem * (ivaPct / 100) : 0;

    // Proporción
    const proporcion = baseTotal > 0 ? baseItem / baseTotal : 0;

    // Flete del item
    const fleteItem = fleteTotal > 0 ? fleteTotal * proporcion : 0;

    return (
      <tr key={d.id}>
        <td className="px-3 py-2">
          <div className="flex flex-col gap-1">
            <span>{d.productos?.nombre ?? "—"}</span>

            {/* PRECIO BASE */}
            <span className="inline-block text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium w-fit">
              Base: {fmt(baseItem)}
            </span>

            {/* IVA */}
            {ivaItem > 0 && (
              <span className="inline-block text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium w-fit">
                IVA: {fmt(ivaItem)}
              </span>
            )}

            {/* FLETE */}
            {fleteItem > 0 && (
              <span className="inline-block text-[10px] px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 font-medium w-fit">
                🚚 Flete: {fmt(fleteItem)}
              </span>
            )}
          </div>
        </td>

        <td className="px-3 py-2 text-center">{d.cantidad}</td>

        <td className="px-3 py-2 text-right">
          {fmt(d.precio_unitario)}
        </td>

        <td className="px-3 py-2 text-right font-medium">
          {fmt(subtotalConTodo)}
        </td>
      </tr>
    );
  });
})()}
                      </tbody>
                      <tfoot className="bg-gray-50 text-sm">
                        {compraVer.incluye_iva && (
                          <>
                            <tr>
                              <td colSpan={3} className="px-3 py-1.5 text-right text-gray-500 text-xs">Subtotal:</td>
                              <td className="px-3 py-1.5 text-right text-gray-700 text-xs">{fmt(compraVer.total - compraVer.monto_iva)}</td>
                            </tr>
                            <tr>
                              <td colSpan={3} className="px-3 py-1.5 text-right text-blue-600 text-xs">IVA {compraVer.porcentaje_iva}%:</td>
                              <td className="px-3 py-1.5 text-right text-blue-600 text-xs">{fmt(compraVer.monto_iva)}</td>
                            </tr>
                          </>
                        )}
                        <tr className="border-t border-gray-200">
                          <td colSpan={3} className="px-3 py-2 text-right font-semibold text-xs">Total:</td>
                          <td className="px-3 py-2 text-right font-bold">{fmt(compraVer.total)}</td>
                        </tr>
                      </tfoot>
                    </table>
                    {compraVer.notas && (
                      <p className="mt-3 text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">📝 {compraVer.notas}</p>
                    )}
                  </div>
                )}

                {tabDetalle === "pagos" && (
                  <div>
                    {pagos.length === 0 ? (
                      <p className="text-sm text-gray-400 text-center py-6">Sin pagos registrados todavía.</p>
                    ) : (
                      <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
                        <thead className="bg-gray-50 text-gray-500 text-xs">
                          <tr>
                            <th className="text-left px-3 py-2">#</th>
                            <th className="text-left px-3 py-2">Fecha</th>
                            <th className="text-left px-3 py-2">Método</th>
                            <th className="text-right px-3 py-2">Monto</th>
                            <th className="text-left px-3 py-2">Notas</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {pagos.map((p, idx) => (
                            <tr key={p.id} className="hover:bg-gray-50">
                              <td className="px-3 py-2 text-gray-400 text-xs">{idx + 1}</td>
                              <td className="px-3 py-2 text-gray-600">{p.fecha}</td>
                              <td className="px-3 py-2 text-gray-500">{p.metodo_pago ?? "—"}</td>
                              <td className="px-3 py-2 text-right font-medium text-green-700">{fmt(p.monto)}</td>
                              <td className="px-3 py-2 text-gray-400 text-xs">{p.notas ?? ""}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-gray-50">
                          <tr>
                            <td colSpan={3} className="px-3 py-2 text-right text-sm font-semibold text-gray-700">Total pagado:</td>
                            <td className="px-3 py-2 text-right font-bold text-green-700">{fmt(compraVer.total_pagado)}</td>
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
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">Registrar pago</h2>
              <p className="text-sm text-gray-500">Saldo: <span className="font-semibold text-red-600">{fmt(compraVer.total - compraVer.total_pagado)}</span></p>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Monto *</label>
                <input type="number" min="0" step="0.01" value={formPago.monto}
                  onChange={e => setFormPago({ ...formPago, monto: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0.00" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Método</label>
                <select value={formPago.metodo_pago} onChange={e => setFormPago({ ...formPago, metodo_pago: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {METODOS.map(m => <option key={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Notas</label>
                <input type="text" value={formPago.notas} onChange={e => setFormPago({ ...formPago, notas: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Opcional" />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={() => setModalPago(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Cancelar</button>
              <button onClick={guardarPago} disabled={guardandoPago}
                className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors">
                {guardandoPago ? "Guardando..." : "Confirmar pago"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}