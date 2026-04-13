"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase"; // ajustá si tu ruta es distinta

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

export default function ComprasPage() {
  const [compras, setCompras] = useState<Compra[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("todos");

  // Modal nueva compra
  const [modalNueva, setModalNueva] = useState(false);
  const [form, setForm] = useState({
    proveedor_id: "", fecha: new Date().toISOString().slice(0, 10),
    numero_remito: "", fecha_vencimiento: "", metodo_pago: "Efectivo",
    notas: "", pago_inicial: "",
  });
  const [items, setItems] = useState<ItemForm[]>([]);
  const [productoSel, setProductoSel] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [errorForm, setErrorForm] = useState<string | null>(null);

  // Modal detalle / cuenta corriente
  const [compraVer, setCompraVer] = useState<Compra | null>(null);
  const [detalle, setDetalle] = useState<DetalleCompra[]>([]);
  const [pagos, setPagos] = useState<PagoCompra[]>([]);
  const [loadingDetalle, setLoadingDetalle] = useState(false);

  // Modal nuevo pago
  const [modalPago, setModalPago] = useState(false);
  const [formPago, setFormPago] = useState({ monto: "", metodo_pago: "Efectivo", notas: "" });
  const [guardandoPago, setGuardandoPago] = useState(false);

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

  // ── NUEVA COMPRA ──────────────────────────────────────────
  function abrirNueva() {
    setForm({ proveedor_id: "", fecha: new Date().toISOString().slice(0, 10),
      numero_remito: "", fecha_vencimiento: "", metodo_pago: "Efectivo", notas: "", pago_inicial: "" });
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

  const totalCompra = items.reduce((s, it) => s + it.cantidad * it.precio_unitario, 0);

  async function guardarCompra() {
    if (!form.proveedor_id) { setErrorForm("Seleccioná un proveedor."); return; }
    if (items.length === 0) { setErrorForm("Agregá al menos un producto."); return; }
    if (items.some(it => it.precio_unitario <= 0)) { setErrorForm("Todos los productos deben tener precio mayor a 0."); return; }
    setGuardando(true); setErrorForm(null);
    const { error } = await supabase.rpc("registrar_compra", {
      p_proveedor_id: form.proveedor_id,
      p_fecha: form.fecha,
      p_numero_remito: form.numero_remito || null,
      p_fecha_vencimiento: form.fecha_vencimiento || null,
      p_metodo_pago: form.metodo_pago,
      p_notas: form.notas || null,
      p_pago_inicial: parseFloat(form.pago_inicial) || 0,
      p_items: items.map(it => ({ producto_id: it.producto_id, cantidad: it.cantidad, precio_unitario: it.precio_unitario })),
    });
    setGuardando(false);
    if (error) { setErrorForm("Error: " + error.message); return; }
    setModalNueva(false);
    cargarTodo();
  }

  // ── VER DETALLE ───────────────────────────────────────────
  async function verDetalle(c: Compra) {
    setCompraVer(c); setLoadingDetalle(true);
    const [{ data: d }, { data: p }] = await Promise.all([
      supabase.from("compras_detalle").select("*, productos(nombre)").eq("compra_id", c.id),
      supabase.from("compras_pagos").select("*").eq("compra_id", c.id).order("fecha"),
    ]);
    if (d) setDetalle(d); if (p) setPagos(p);
    setLoadingDetalle(false);
  }

  // ── REGISTRAR PAGO ────────────────────────────────────────
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
    setGuardandoPago(false); setModalPago(false);
    cargarTodo();
    // Refrescar detalle
    const compraActualizada = { ...compraVer,
      total_pagado: compraVer.total_pagado + monto,
      estado: compraVer.total_pagado + monto >= compraVer.total ? "pagado" : "parcial",
    };
    setCompraVer(compraActualizada);
    const { data: p } = await supabase.from("compras_pagos").select("*").eq("compra_id", compraVer.id).order("fecha");
    if (p) setPagos(p);
  }

  const filtradas = compras.filter(c => {
    const texto = [c.proveedores?.nombre, c.numero_remito].join(" ").toLowerCase();
    return texto.includes(busqueda.toLowerCase()) && (filtroEstado === "todos" || c.estado === filtroEstado);
  });

  const totalDeuda = compras.filter(c => c.estado !== "pagado").reduce((s, c) => s + (c.total - c.total_pagado), 0);

  // ── RENDER ────────────────────────────────────────────────
  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Encabezado */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Compras</h1>
          <p className="text-sm text-gray-500 mt-1">
            {compras.length} compra{compras.length !== 1 ? "s" : ""} registrada{compras.length !== 1 ? "s" : ""}
            {totalDeuda > 0 && <span className="ml-3 text-red-600 font-medium">· Deuda total: {fmt(totalDeuda)}</span>}
          </p>
        </div>
        <button onClick={abrirNueva} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          + Nueva compra
        </button>
      </div>

      {/* Filtros */}
      <div className="flex gap-3 mb-4">
        <input type="text" placeholder="Buscar por proveedor o remito..." value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          className="flex-1 border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="todos">Todos</option>
          <option value="pendiente">Pendiente</option>
          <option value="parcial">Parcial</option>
          <option value="pagado">Pagado</option>
        </select>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400 text-sm">Cargando...</div>
        ) : filtradas.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">No hay compras registradas.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
              <tr>
                <th className="text-left px-4 py-3">Fecha</th>
                <th className="text-left px-4 py-3">Proveedor</th>
                <th className="text-left px-4 py-3">Remito</th>
                <th className="text-left px-4 py-3">Vencimiento</th>
                <th className="text-right px-4 py-3">Total</th>
                <th className="text-right px-4 py-3">Pagado</th>
                <th className="text-right px-4 py-3">Saldo</th>
                <th className="text-center px-4 py-3">Estado</th>
                <th className="text-right px-4 py-3">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtradas.map(c => {
                const saldo = c.total - c.total_pagado;
                const est = ESTADO_LABEL[c.estado] ?? ESTADO_LABEL.pendiente;
                return (
                  <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-gray-600">{c.fecha}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{c.proveedores?.nombre ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-500">{c.numero_remito ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-500">{c.fecha_vencimiento ?? "—"}</td>
                    <td className="px-4 py-3 text-right text-gray-900 font-medium">{fmt(c.total)}</td>
                    <td className="px-4 py-3 text-right text-green-700">{fmt(c.total_pagado)}</td>
                    <td className="px-4 py-3 text-right text-red-600 font-medium">{saldo > 0 ? fmt(saldo) : "—"}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${est.color}`}>{est.label}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => verDetalle(c)} className="text-blue-600 hover:underline text-xs">Ver detalle</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ── MODAL NUEVA COMPRA ── */}
      {modalNueva && (
        <div className="fixed inset-0 bg-black/40 flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl my-8">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">Nueva compra</h2>
            </div>
            <div className="px-6 py-4 space-y-4">
              {errorForm && <div className="bg-red-50 text-red-600 text-sm px-3 py-2 rounded-lg">{errorForm}</div>}

              {/* Proveedor + fecha */}
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

              {/* Remito + vencimiento */}
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
                          <th className="text-center px-3 py-2 w-24">Cantidad</th>
                          <th className="text-center px-3 py-2 w-32">Precio unitario</th>
                          <th className="text-right px-3 py-2 w-28">Subtotal</th>
                          <th className="w-8"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {items.map((it, idx) => (
                          <tr key={it.producto_id}>
                            <td className="px-3 py-2 text-gray-800">{it.nombre}</td>
                            <td className="px-3 py-2">
                              <input type="number" min="1" value={it.cantidad}
                                onChange={e => actualizarItem(idx, "cantidad", parseFloat(e.target.value) || 1)}
                                className="w-full text-center border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                            </td>
                            <td className="px-3 py-2">
                              <input type="number" min="0" step="0.01" value={it.precio_unitario}
                                onChange={e => actualizarItem(idx, "precio_unitario", parseFloat(e.target.value) || 0)}
                                className="w-full text-center border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                            </td>
                            <td className="px-3 py-2 text-right font-medium text-gray-700">{fmt(it.cantidad * it.precio_unitario)}</td>
                            <td className="px-3 py-2 text-center">
                              <button onClick={() => quitarItem(idx)} className="text-red-400 hover:text-red-600 text-xs">✕</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-gray-50">
                        <tr>
                          <td colSpan={3} className="px-3 py-2 text-right text-sm font-semibold text-gray-700">Total:</td>
                          <td className="px-3 py-2 text-right text-sm font-bold text-gray-900">{fmt(totalCompra)}</td>
                          <td></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>

              {/* Pago inicial + método */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Pago inicial (dejar en 0 si es a crédito)</label>
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

              {/* Notas */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Notas</label>
                <textarea value={form.notas} onChange={e => setForm({ ...form, notas: e.target.value })}
                  rows={2} placeholder="Observaciones, condiciones, etc."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={() => setModalNueva(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Cancelar</button>
              <button onClick={guardarCompra} disabled={guardando}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors">
                {guardando ? "Guardando..." : "Registrar compra"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL DETALLE / CUENTA CORRIENTE ── */}
      {compraVer && (
        <div className="fixed inset-0 bg-black/40 flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl my-8">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Detalle de compra</h2>
                <p className="text-sm text-gray-500">{compraVer.proveedores?.nombre} · {compraVer.fecha}</p>
              </div>
              <button onClick={() => setCompraVer(null)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
            </div>

            {loadingDetalle ? (
              <div className="p-8 text-center text-gray-400 text-sm">Cargando...</div>
            ) : (
              <div className="px-6 py-4 space-y-6">
                {/* Info general */}
                <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
                  {compraVer.numero_remito && <><span className="text-gray-500">Remito:</span><span className="font-medium">{compraVer.numero_remito}</span></>}
                  {compraVer.fecha_vencimiento && <><span className="text-gray-500">Vencimiento:</span><span className="font-medium">{compraVer.fecha_vencimiento}</span></>}
                  {compraVer.metodo_pago && <><span className="text-gray-500">Método pago:</span><span>{compraVer.metodo_pago}</span></>}
                  {compraVer.notas && <><span className="text-gray-500">Notas:</span><span>{compraVer.notas}</span></>}
                </div>

                {/* Productos */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">Productos recibidos</h3>
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
                      {detalle.map(d => (
                        <tr key={d.id}>
                          <td className="px-3 py-2">{d.productos?.nombre ?? "—"}</td>
                          <td className="px-3 py-2 text-center">{d.cantidad}</td>
                          <td className="px-3 py-2 text-right">{fmt(d.precio_unitario)}</td>
                          <td className="px-3 py-2 text-right font-medium">{fmt(d.subtotal)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-50">
                      <tr>
                        <td colSpan={3} className="px-3 py-2 text-right text-sm font-semibold">Total:</td>
                        <td className="px-3 py-2 text-right font-bold">{fmt(compraVer.total)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Cuenta corriente */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-gray-700">Cuenta corriente</h3>
                    {compraVer.estado !== "pagado" && (
                      <button onClick={abrirPago}
                        className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded-lg text-xs font-medium transition-colors">
                        + Registrar pago
                      </button>
                    )}
                  </div>

                  {/* Resumen */}
                  <div className="grid grid-cols-3 gap-3 mb-3">
                    {[
                      { label: "Total", value: fmt(compraVer.total), color: "text-gray-900" },
                      { label: "Pagado", value: fmt(compraVer.total_pagado), color: "text-green-700" },
                      { label: "Saldo", value: fmt(compraVer.total - compraVer.total_pagado), color: "text-red-600" },
                    ].map(item => (
                      <div key={item.label} className="bg-gray-50 rounded-lg px-4 py-3 text-center">
                        <div className="text-xs text-gray-500 mb-1">{item.label}</div>
                        <div className={`text-base font-bold ${item.color}`}>{item.value}</div>
                      </div>
                    ))}
                  </div>

                  {/* Historial de pagos */}
                  {pagos.length > 0 ? (
                    <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
                      <thead className="bg-gray-50 text-gray-500 text-xs">
                        <tr>
                          <th className="text-left px-3 py-2">Fecha</th>
                          <th className="text-left px-3 py-2">Método</th>
                          <th className="text-right px-3 py-2">Monto</th>
                          <th className="text-left px-3 py-2">Notas</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {pagos.map(p => (
                          <tr key={p.id}>
                            <td className="px-3 py-2 text-gray-600">{p.fecha}</td>
                            <td className="px-3 py-2 text-gray-500">{p.metodo_pago ?? "—"}</td>
                            <td className="px-3 py-2 text-right font-medium text-green-700">{fmt(p.monto)}</td>
                            <td className="px-3 py-2 text-gray-400 text-xs">{p.notas ?? ""}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p className="text-sm text-gray-400 text-center py-3">Sin pagos registrados todavía.</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── MODAL REGISTRAR PAGO ── */}
      {modalPago && compraVer && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">Registrar pago</h2>
              <p className="text-sm text-gray-500">Saldo pendiente: {fmt(compraVer.total - compraVer.total_pagado)}</p>
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
                <label className="block text-xs font-medium text-gray-600 mb-1">Método de pago</label>
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