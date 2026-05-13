"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import * as XLSX from "xlsx";

interface Proveedor { id: number; nombre: string; }
interface Producto { id: number; nombre: string; stock: number; laboratorio?: string; }
interface ItemForm {
  producto_id: number; nombre: string;
  cantidad: string; precio_unitario: string; fecha_vencimiento: string;
}
interface Compra {
  id: number; fecha: string; numero_remito: string | null;
  fecha_vencimiento: string | null; metodo_pago: string | null; notas: string | null;
  total: number; total_pagado: number; estado: string;
  incluye_iva: boolean; monto_iva: number; porcentaje_iva: number; monto_flete: number;
  descuento_pct: number; monto_descuento: number;
  proveedores: { nombre: string } | null;
}
interface DetalleCompra {
  id: number; producto_id: number; cantidad: number; precio_unitario: number; subtotal: number;
  monto_iva: number; monto_flete: number; productos: { nombre: string } | null;
}
interface PagoCompra {
  id: number; fecha: string; monto: number; metodo_pago: string | null; notas: string | null;
}

const METODOS = ["Efectivo", "Transferencia", "Cheque", "Tarjeta", "Otro"];
const METODO_COLOR: Record<string, { bg: string; color: string }> = {
  Efectivo:      { bg: "rgba(74,222,128,0.15)",  color: "#4ade80" },
  Transferencia: { bg: "rgba(96,165,250,0.15)",  color: "#60a5fa" },
  Cheque:        { bg: "rgba(251,191,36,0.15)",  color: "#fbbf24" },
  Tarjeta:       { bg: "rgba(167,139,250,0.15)", color: "#a78bfa" },
  Otro:          { bg: "rgba(156,163,175,0.15)", color: "#9ca3af" },
};
const ESTADO_LABEL: Record<string, { label: string; bg: string; color: string }> = {
  pendiente: { label: "Pendiente", bg: "rgba(239,68,68,0.12)",   color: "#f87171" },
  parcial:   { label: "Parcial",   bg: "rgba(251,191,36,0.12)",  color: "#fbbf24" },
  pagado:    { label: "Pagado",    bg: "rgba(74,222,128,0.12)",  color: "#4ade80" },
};

function fmt(n: number) {
  return n.toLocaleString("es-AR", { style: "currency", currency: "ARS" });
}

function calcularTotales(
  items: ItemForm[], incluyeIva: boolean, porcentajeIva: number,
  incluyeFlete: boolean, tipoFlete: "pct" | "pesos", valorFlete: number,
  descuentoPct: number = 0
) {
  const subtotal = items.reduce((s, it) => s + (parseFloat(it.cantidad) || 0) * (parseFloat(it.precio_unitario) || 0), 0);
  const descuento = descuentoPct > 0 ? Math.round(subtotal * (descuentoPct / 100) * 100) / 100 : 0;
  const subtotalNeto = subtotal - descuento;
  const iva = incluyeIva && porcentajeIva > 0 ? Math.round(subtotalNeto * (porcentajeIva / 100) * 100) / 100 : 0;
  const flete = incluyeFlete && valorFlete > 0
    ? tipoFlete === "pct" ? Math.round(subtotalNeto * (valorFlete / 100) * 100) / 100 : valorFlete : 0;
  return { subtotal, descuento, subtotalNeto, iva, flete, total: subtotalNeto + iva + flete };
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
  width: "100%", padding: "10px 14px", background: "#1e293b",
  border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10,
  color: "white", fontSize: 14, outline: "none", boxSizing: "border-box", cursor: "pointer"
}

const responsiveStyles = `
  @media (max-width: 768px) {
    .compras-header { flex-direction: column !important; align-items: flex-start !important; gap: 10px !important; }
    .compras-header-btn { width: 100% !important; text-align: center !important; }
    .compras-filtros { flex-direction: column !important; }
    .compras-filtros input,
    .compras-filtros select { width: 100% !important; box-sizing: border-box !important; }
    .compras-card { flex-direction: column !important; align-items: flex-start !important; gap: 10px !important; }
    .compras-card-numeros { flex-wrap: wrap !important; gap: 10px !important; }
    .compras-card-acciones { width: 100% !important; justify-content: flex-end !important; display: flex !important; gap: 8px !important; flex-wrap: wrap !important; }
    .compras-modal-grid { grid-template-columns: 1fr !important; }
    .compras-tabla-scroll { overflow-x: auto !important; -webkit-overflow-scrolling: touch !important; }
    .compras-modal-footer { flex-direction: column !important; align-items: stretch !important; }
    .compras-modal-footer-btns { width: 100% !important; justify-content: stretch !important; }
    .compras-modal-footer-btns button { flex: 1 !important; }
    .compras-resumen-grid { grid-template-columns: 1fr !important; gap: 8px !important; }
    .compras-botones-pago { flex-direction: column !important; }
    .compras-tabs { padding: 0 16px !important; }
    .compras-detalle-inner { padding: 16px !important; }
  }
`

export default function ComprasPage() {
  const [compras, setCompras] = useState<Compra[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("todos");
  const [busquedaProducto, setBusquedaProducto] = useState("");
  const [productoDropdown, setProductoDropdown] = useState(false);
  const [productoIndiceCompras, setProductoIndiceCompras] = useState(-1);

  const [modalNueva, setModalNueva] = useState(false);
  const [form, setForm] = useState({
    proveedor_id: "", fecha: new Date().toISOString().slice(0, 10),
    numero_remito: "", fecha_vencimiento: "", metodo_pago: "",
    notas: "", pago_inicial: "", incluye_iva: false, porcentaje_iva: "21",
    incluye_flete: false, tipo_flete: "pesos" as "pct" | "pesos", valor_flete: "",
    incluye_descuento: false, porcentaje_descuento: "",
  });
  const [items, setItems] = useState<ItemForm[]>([]);
  const [guardando, setGuardando] = useState(false);
  const [actualizarCostos, setActualizarCostos] = useState(true);
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
  const [modalCancelar, setModalCancelar] = useState(false);
  const [descuentoCancelar, setDescuentoCancelar] = useState("");
  const [reaplicando, setReaplicando] = useState(false);
  const [confirmEliminarCompra, setConfirmEliminarCompra] = useState<Compra | null>(null);
  const [eliminandoCompra, setEliminandoCompra] = useState(false);
  const [mostrarFormNuevoProd, setMostrarFormNuevoProd] = useState(false);
  const [formNuevoProd, setFormNuevoProd] = useState({ nombre: "", laboratorio: "", costo: "", margen: "30" });
  const [guardandoNuevoProd, setGuardandoNuevoProd] = useState(false);

  useEffect(() => { cargarTodo(); }, []);

  async function cargarTodo() {
    setLoading(true);
    const [{ data: c }, { data: p }] = await Promise.all([
      supabase.from("compras").select("*, proveedores(nombre)").order("fecha", { ascending: false }),
      supabase.from("proveedores").select("id, nombre").order("nombre"),
    ]);
    if (c) setCompras(c);
    if (p) setProveedores(p);

    let todosProductos: Producto[] = [];
    let desde = 0;
    while (true) {
      const { data: pr } = await supabase.from("productos").select("id, nombre, stock, laboratorio").order("nombre").range(desde, desde + 999);
      if (!pr || pr.length === 0) break;
      todosProductos = [...todosProductos, ...pr];
      if (pr.length < 1000) break;
      desde += 1000;
    }
    setProductos(todosProductos);
    setLoading(false);
  }

  function abrirNueva() {
    setForm({
      proveedor_id: "", fecha: new Date().toISOString().slice(0, 10),
      numero_remito: "", fecha_vencimiento: "", metodo_pago: "",
      notas: "", pago_inicial: "", incluye_iva: false, porcentaje_iva: "21",
      incluye_flete: false, tipo_flete: "pesos", valor_flete: "",
      incluye_descuento: false, porcentaje_descuento: "",
    });
    setItems([]); setBusquedaProducto(""); setErrorForm(null); setMostrarFormNuevoProd(false); setModalNueva(true);
  }

  function agregarItem(prod: Producto) {
    if (items.find(i => i.producto_id === prod.id)) return;
    setItems([...items, { producto_id: prod.id, nombre: prod.nombre, cantidad: "1", precio_unitario: "", fecha_vencimiento: "" }]);
    setBusquedaProducto(""); setProductoDropdown(false); setProductoIndiceCompras(-1);
  }

  function quitarItem(idx: number) { setItems(items.filter((_, i) => i !== idx)); }

  async function crearYAgregarProducto() {
    if (!formNuevoProd.nombre.trim()) return;
    setGuardandoNuevoProd(true);
    const costo = parseFloat(formNuevoProd.costo) || 0;
    const margen = parseFloat(formNuevoProd.margen) || 30;
    const precio_venta = Math.round(costo * (1 + margen / 100) * 100) / 100;
    const { data, error } = await supabase.from("productos").insert({
      nombre: formNuevoProd.nombre.trim().toUpperCase(),
      laboratorio: formNuevoProd.laboratorio.trim(),
      costo,
      margen,
      precio_venta,
      stock: 0,
    }).select("id, nombre, stock, laboratorio").single();
    if (!error && data) {
      const nuevo = data as Producto;
      setProductos(prev => [...prev, nuevo].sort((a, b) => a.nombre.localeCompare(b.nombre)));
      agregarItem(nuevo);
      setMostrarFormNuevoProd(false);
      setFormNuevoProd({ nombre: "", laboratorio: "", costo: "", margen: "30" });
    }
    setGuardandoNuevoProd(false);
  }

  const pctIvaForm = parseFloat(form.porcentaje_iva) || 0;
  const valFleteForm = parseFloat(form.valor_flete) || 0;
  const pctDescuentoForm = parseFloat(form.porcentaje_descuento) || 0;

  function calcularItemsConExtras() {
    const { subtotal, iva, flete } = calcularTotales(items, form.incluye_iva, pctIvaForm, form.incluye_flete, form.tipo_flete, valFleteForm, form.incluye_descuento ? pctDescuentoForm : 0);
    return items.map(it => {
      const subtotalItem = (parseFloat(it.cantidad) || 0) * (parseFloat(it.precio_unitario) || 0);
      const proporcion = subtotal > 0 ? subtotalItem / subtotal : 0;
      const ivaItem = form.incluye_iva ? iva * proporcion : 0;
      const fleteItem = form.incluye_flete ? flete * proporcion : 0;
      return { ...it, subtotalItem, ivaItem: Math.round(ivaItem * 100) / 100, fleteItem: Math.round(fleteItem * 100) / 100 };
    });
  }

  const { subtotal: subtotalForm, descuento: descuentoForm, subtotalNeto: subtotalNetoForm, iva: ivaForm, flete: fleteForm, total: totalForm } =
    calcularTotales(items, form.incluye_iva, pctIvaForm, form.incluye_flete, form.tipo_flete, valFleteForm, form.incluye_descuento ? pctDescuentoForm : 0);
  const itemsCalculados = calcularItemsConExtras();

  async function guardarCompra() {
    if (!form.proveedor_id) { setErrorForm("Seleccioná un proveedor."); return; }
    if (items.length === 0) { setErrorForm("Agregá al menos un producto."); return; }
    if (items.some(it => (parseFloat(it.precio_unitario) || 0) <= 0)) { setErrorForm("Todos los productos deben tener precio mayor a 0."); return; }
    const pctIva = parseFloat(form.porcentaje_iva) || 0;
    const valFlete = parseFloat(form.valor_flete) || 0;
    const pctDesc = form.incluye_descuento ? (parseFloat(form.porcentaje_descuento) || 0) : 0;
    if (form.incluye_flete && valFlete <= 0) { setErrorForm("El valor del flete debe ser mayor a 0."); return; }
    const { flete: montoFlete, descuento: montoDescuento, total: totalConDescuento } = calcularTotales(items, form.incluye_iva, pctIva, form.incluye_flete, form.tipo_flete, valFlete, pctDesc);
    setGuardando(true); setErrorForm(null);
    const { error } = await supabase.rpc("registrar_compra", {
      p_proveedor_id: Number(form.proveedor_id), p_fecha: form.fecha,
      p_numero_remito: form.numero_remito || null, p_fecha_vencimiento: form.fecha_vencimiento || null,
      p_metodo_pago: (parseFloat(form.pago_inicial) || 0) > 0 ? (form.metodo_pago || null) : null, p_notas: form.notas || null,
      p_pago_inicial: parseFloat(form.pago_inicial) || 0,
      p_items: items.map(it => ({
        producto_id: it.producto_id, cantidad: parseFloat(it.cantidad) || 1,
        precio_unitario: parseFloat(it.precio_unitario) || 0, fecha_vencimiento: it.fecha_vencimiento || null
      })),
      p_incluye_iva: form.incluye_iva, p_porcentaje_iva: pctIva, p_monto_flete: montoFlete,
    });
    setGuardando(false);
    if (error) { setErrorForm("Error: " + error.message); return; }
    // Corregir campos que el RPC no maneja correctamente
    const pagoInicial = parseFloat(form.pago_inicial) || 0;
    if (pctDesc > 0 || pagoInicial === 0) {
      const { data: compraCreada } = await supabase
        .from("compras").select("id").eq("proveedor_id", Number(form.proveedor_id))
        .order("id", { ascending: false }).limit(1).single();
      if (compraCreada) {
        const patch: Record<string, any> = {};
        if (pctDesc > 0) { patch.total = totalConDescuento; patch.descuento_pct = pctDesc; patch.monto_descuento = montoDescuento; }
        if (pagoInicial === 0) patch.metodo_pago = null;
        await supabase.from("compras").update(patch).eq("id", compraCreada.id);
      }
    }
    // El RPC registrar_compra ya actualiza el stock. Aquí solo actualizamos costo/precio_venta si está activado.
    if (actualizarCostos) {
      const subtotalTotal = items.reduce((s, it) => s + (parseFloat(it.cantidad) || 0) * (parseFloat(it.precio_unitario) || 0), 0)
      await Promise.all(items.map(async (item) => {
        const precioUnit = parseFloat(item.precio_unitario) || 0
        if (!precioUnit) return
        const cantidad = parseFloat(item.cantidad) || 1
        const subtotalItem = precioUnit * cantidad
        const proporcion = subtotalTotal > 0 ? subtotalItem / subtotalTotal : 0
        const fleteUnitario = montoFlete > 0 ? (montoFlete * proporcion) / cantidad : 0
        const { data: prodActual } = await supabase.from("productos").select("margen").eq("id", item.producto_id).single()
        const margen = prodActual?.margen ?? 30
        await supabase.from("productos").update({
          costo: Math.round(precioUnit * 100) / 100,
          precio_venta: Math.round((precioUnit + fleteUnitario) * (1 + margen / 100) * 100) / 100,
        }).eq("id", item.producto_id)
      }))
    }
    setModalNueva(false); cargarTodo();
  }

  async function eliminarCompra() {
    if (!confirmEliminarCompra) return;
    setEliminandoCompra(true);

    // 1. Recuperar detalle antes de borrar para revertir el stock
    const { data: detalleCompra } = await supabase
      .from("compras_detalle")
      .select("producto_id, cantidad")
      .eq("compra_id", confirmEliminarCompra.id);

    // 2. Borrar registros asociados
    await supabase.from("compras_pagos").delete().eq("compra_id", confirmEliminarCompra.id);
    await supabase.from("compras_detalle").delete().eq("compra_id", confirmEliminarCompra.id);
    await supabase.from("lotes").update({ cantidad: 0 }).eq("compra_id", confirmEliminarCompra.id);
    const { error } = await supabase.from("compras").delete().eq("id", confirmEliminarCompra.id);

    if (error) { setEliminandoCompra(false); alert("Error al eliminar: " + error.message); return; }

    // 3. Revertir stock: restar la cantidad que había entrado con esta compra
    if (detalleCompra && detalleCompra.length > 0) {
      await Promise.all(detalleCompra.map(async (d) => {
        const { data: prod } = await supabase.from("productos").select("stock").eq("id", d.producto_id).single();
        if (prod) {
          await supabase.from("productos").update({
            stock: Math.max(0, prod.stock - d.cantidad)
          }).eq("id", d.producto_id);
        }
      }));
    }

    setEliminandoCompra(false);
    setConfirmEliminarCompra(null);
    if (compraVer?.id === confirmEliminarCompra.id) setCompraVer(null);
    cargarTodo();
  }

  async function verDetalle(c: Compra) {
    setCompraVer(c); setTabDetalle("detalle"); setLoadingDetalle(true);
    const [{ data: d }, { data: p }] = await Promise.all([
      supabase.from("compras_detalle").select("*, productos(nombre)").eq("compra_id", c.id).order("id"),
      supabase.from("compras_pagos").select("*").eq("compra_id", c.id).order("fecha"),
    ]);
    if (d) setDetalle(d); if (p) setPagos(p);
    setLoadingDetalle(false);
  }

  async function cancelarCompra(descuentoPct: number = 0) {
    if (!compraVer) return;
    const saldo = compraVer.total - compraVer.total_pagado;
    if (saldo <= 0) return;
    setCancelando(true);
    let montoPago = saldo;
    if (descuentoPct > 0) {
      const montoDesc = Math.round(saldo * (descuentoPct / 100) * 100) / 100;
      montoPago = Math.round((saldo - montoDesc) * 100) / 100;
      const nuevoTotal = Math.round((compraVer.total - montoDesc) * 100) / 100;
      await supabase.from("compras").update({ total: nuevoTotal }).eq("id", compraVer.id);
    }
    const notas = descuentoPct > 0 ? `Cancelación con ${descuentoPct}% de descuento` : "Cancelación total";
    const { error } = await supabase.rpc("registrar_pago_compra", { p_compra_id: compraVer.id, p_monto: montoPago, p_metodo_pago: "Efectivo", p_notas: notas });
    if (error) { alert("Error: " + error.message); setCancelando(false); return; }
    setModalCancelar(false); setDescuentoCancelar("");
    setCancelando(false); await cargarTodo();
    const { data: ca } = await supabase.from("compras").select("*").eq("id", compraVer.id).single();
    if (ca) setCompraVer(ca);
    const { data: p } = await supabase.from("compras_pagos").select("*").eq("compra_id", compraVer.id).order("fecha");
    if (p) setPagos(p); cargarTodo();
  }

  async function reaplicarCompraAProductos() {
    if (!compraVer || detalle.length === 0) return;
    setReaplicando(true);
    // Solo actualiza costo y precio_venta — el stock ya fue sumado por el RPC al crear la compra
    const subtotalBase = detalle.reduce((s, d) => s + d.cantidad * d.precio_unitario, 0);
    await Promise.all(detalle.map(async (d) => {
      const proporcion = subtotalBase > 0 ? (d.cantidad * d.precio_unitario) / subtotalBase : 0;
      const fleteItem = compraVer.monto_flete > 0 ? Math.round(compraVer.monto_flete * proporcion * 100) / 100 : 0;
      const fleteUnitario = d.cantidad > 0 ? fleteItem / d.cantidad : 0;
      const { data: prodActual } = await supabase.from("productos").select("margen").eq("id", d.producto_id).single();
      const margen = prodActual?.margen ?? 30;
      await supabase.from("productos").update({
        costo: Math.round(d.precio_unitario * 100) / 100,
        precio_venta: Math.round((d.precio_unitario + fleteUnitario) * (1 + margen / 100) * 100) / 100,
      }).eq("id", d.producto_id);
    }));
    setReaplicando(false);
    cargarTodo();
    alert(`✅ Costo y precio de venta actualizados para ${detalle.length} producto${detalle.length !== 1 ? "s" : ""}.`);
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

  function exportarCompras() {
    const datos = filtradas.map(c => ({
      "Fecha": c.fecha?.slice(0, 10) || "",
      "Proveedor": c.proveedores?.nombre || "",
      "N° Remito": c.numero_remito || "",
      "Estado": ESTADO_LABEL[c.estado]?.label || c.estado,
      "Total": c.total,
      "Pagado": c.total_pagado,
      "Saldo": c.total - c.total_pagado,
      "Método pago": c.metodo_pago || "",
    }))
    const ws = XLSX.utils.json_to_sheet(datos)
    ws["!cols"] = [{ wch: 12 }, { wch: 24 }, { wch: 14 }, { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Compras")
    XLSX.writeFile(wb, "compras_" + new Date().toISOString().slice(0, 10) + ".xlsx")
  }
  const totalDeuda = compras.filter(c => c.estado !== "pagado").reduce((s, c) => s + (c.total - c.total_pagado), 0);
  const terminoBusqProd = busquedaProducto.trim().replace(/\s+/g, " ").toLowerCase();
  const palabrasBusqProd = terminoBusqProd.split(" ").filter(Boolean);
  const productosFiltradosDropdown = productos.filter(p => {
    if (!palabrasBusqProd.length) return false;
    const campo = p.nombre.toLowerCase() + " " + (p.laboratorio || "").toLowerCase();
    return (campo.includes(terminoBusqProd) || palabrasBusqProd.every(w => campo.includes(w))) &&
      !items.find(i => i.producto_id === p.id);
  });

  return (
    <div>
      <style>{responsiveStyles}</style>

      {/* Header */}
      <div className="compras-header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <p style={{ fontSize: 13, color: "#6b7280", margin: 0 }}>
          <span style={{ fontWeight: 700, color: "#374151" }}>{compras.length}</span> compra{compras.length !== 1 ? "s" : ""}
          {totalDeuda > 0 && <span style={{ marginLeft: 8, color: "#dc2626", fontWeight: 600 }}>· Deuda: {fmt(totalDeuda)}</span>}
        </p>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={exportarCompras} disabled={filtradas.length === 0} style={{
            background: "#16a34a", color: "white", border: "none", borderRadius: 10,
            padding: "10px 14px", fontSize: 13, fontWeight: 700, cursor: filtradas.length === 0 ? "not-allowed" : "pointer",
            opacity: filtradas.length === 0 ? 0.5 : 1
          }}>📊 Excel</button>
          <button className="compras-header-btn" onClick={abrirNueva} style={{
            background: "linear-gradient(135deg, #2563eb, #3b82f6)", color: "white",
            border: "none", borderRadius: 10, padding: "10px 18px",
            fontSize: 13, fontWeight: 700, cursor: "pointer", boxShadow: "0 2px 8px rgba(59,130,246,0.3)"
          }}>+ Nueva compra</button>
        </div>
      </div>

      {/* Filtros */}
      <div className="compras-filtros" style={{ display: "flex", gap: 10, marginBottom: 16 }}>
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
              <div key={c.id} className="compras-card" style={{
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
                    {c.fecha_vencimiento && <span style={{ color: vencido ? "#dc2626" : "#6b7280" }}>⏰ {c.fecha_vencimiento}</span>}
                    {c.total_pagado > 0 && c.metodo_pago && <span>💳 {c.metodo_pago}</span>}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  <div className="compras-card-numeros" style={{ display: "flex", gap: 14, alignItems: "center" }}>
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
                  </div>
                  <div className="compras-card-acciones">
                    <button onClick={() => verDetalle(c)} style={{ background: "#f1f5f9", color: "#374151", border: "1px solid #e2e8f0", borderRadius: 8, padding: "7px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Ver detalle</button>
                    <button onClick={() => setConfirmEliminarCompra(c)} style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", borderRadius: 8, padding: "7px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>🗑️</button>
                  </div>
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

              <div className="compras-modal-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div>
                  <label style={labelStyle}>Proveedor *</label>
                  <select value={form.proveedor_id} onChange={e => setForm({ ...form, proveedor_id: e.target.value })} style={selectDarkStyle}>
                    <option value="" style={{ background: "#1e293b", color: "white" }}>Seleccioná un proveedor</option>
                    {proveedores.map(p => <option key={p.id} value={p.id} style={{ background: "#1e293b", color: "white" }}>{p.nombre}</option>)}
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
                    onChange={e => { setBusquedaProducto(e.target.value); setProductoDropdown(true); setProductoIndiceCompras(-1) }}
                    onFocus={() => setProductoDropdown(true)}
                    onBlur={() => setTimeout(() => setProductoDropdown(false), 150)}
                    onKeyDown={e => {
                      if (e.key === "ArrowDown") { e.preventDefault(); setProductoIndiceCompras(i => Math.min(i + 1, productosFiltradosDropdown.length - 1)) }
                      else if (e.key === "ArrowUp") { e.preventDefault(); setProductoIndiceCompras(i => Math.max(i - 1, 0)) }
                      else if (e.key === "Enter" && productoIndiceCompras >= 0) { e.preventDefault(); agregarItem(productosFiltradosDropdown[productoIndiceCompras]); setProductoIndiceCompras(-1) }
                      else if (e.key === "Escape") { setProductoDropdown(false); setProductoIndiceCompras(-1) }
                    }}
                    style={inputDarkStyle} />
                  {productoDropdown && busquedaProducto && (
                    <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "#1e293b", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, zIndex: 10, maxHeight: 260, overflowY: "auto", marginTop: 4, boxShadow: "0 8px 24px rgba(0,0,0,0.4)" }}>
                      {productosFiltradosDropdown.length === 0 ? (
                        <div style={{ padding: "10px 14px", fontSize: 13, color: "#6b7280", textAlign: "center" }}>Sin resultados</div>
                      ) : productosFiltradosDropdown.map((p, idx) => (
                        <div key={p.id} onMouseDown={() => agregarItem(p)}
                          style={{ padding: "9px 14px", cursor: "pointer", fontSize: 13, display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.06)", color: "white", background: idx === productoIndiceCompras ? "rgba(59,130,246,0.25)" : "transparent" }}
                          onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = idx === productoIndiceCompras ? "rgba(59,130,246,0.25)" : "rgba(59,130,246,0.15)"}
                          onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = idx === productoIndiceCompras ? "rgba(59,130,246,0.25)" : "transparent"}>
                          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                            <span style={{ fontWeight: 500 }}>{p.nombre}</span>
                            {p.laboratorio && <span style={{ fontSize: 11, color: "#86efac" }}>{p.laboratorio}</span>}
                          </div>
                          <span style={{ fontSize: 11, color: "#6b7280", flexShrink: 0, marginLeft: 8 }}>Stock: {p.stock}</span>
                        </div>
                      ))}
                      <div onMouseDown={() => { setMostrarFormNuevoProd(true); setFormNuevoProd(f => ({ ...f, nombre: busquedaProducto.trim().toUpperCase() })); setProductoDropdown(false); }}
                        style={{ padding: "10px 14px", cursor: "pointer", fontSize: 13, color: "#60a5fa", borderTop: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontWeight: 700, fontSize: 16 }}>+</span> Crear nuevo producto
                      </div>
                    </div>
                  )}
                </div>

                {mostrarFormNuevoProd && (
                  <div style={{ background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.25)", borderRadius: 12, padding: "16px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                      <span style={{ color: "#60a5fa", fontWeight: 700, fontSize: 13 }}>+ Nuevo producto</span>
                      <button onClick={() => setMostrarFormNuevoProd(false)} style={{ background: "none", border: "none", color: "#6b7280", cursor: "pointer", fontSize: 18, lineHeight: 1 }}>×</button>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                      <div style={{ gridColumn: "1 / -1" }}>
                        <label style={labelStyle}>Nombre *</label>
                        <input type="text" value={formNuevoProd.nombre} onChange={e => setFormNuevoProd(f => ({ ...f, nombre: e.target.value.toUpperCase() }))} placeholder="NOMBRE DEL PRODUCTO" style={inputDarkStyle} />
                      </div>
                      <div>
                        <label style={labelStyle}>Laboratorio</label>
                        <input type="text" value={formNuevoProd.laboratorio} onChange={e => setFormNuevoProd(f => ({ ...f, laboratorio: e.target.value }))} placeholder="Laboratorio" style={inputDarkStyle} />
                      </div>
                      <div>
                        <label style={labelStyle}>Costo</label>
                        <input type="number" min="0" step="0.01" value={formNuevoProd.costo} onChange={e => setFormNuevoProd(f => ({ ...f, costo: e.target.value }))} placeholder="0.00" style={inputDarkStyle} />
                      </div>
                      <div>
                        <label style={labelStyle}>Margen %</label>
                        <input type="number" min="0" value={formNuevoProd.margen} onChange={e => setFormNuevoProd(f => ({ ...f, margen: e.target.value }))} placeholder="30" style={inputDarkStyle} />
                      </div>
                    </div>
                    <button onClick={crearYAgregarProducto} disabled={!formNuevoProd.nombre.trim() || guardandoNuevoProd}
                      style={{ background: "#2563eb", color: "white", border: "none", borderRadius: 8, padding: "9px 18px", fontSize: 13, fontWeight: 700, cursor: !formNuevoProd.nombre.trim() || guardandoNuevoProd ? "not-allowed" : "pointer", opacity: !formNuevoProd.nombre.trim() || guardandoNuevoProd ? 0.6 : 1 }}>
                      {guardandoNuevoProd ? "Guardando..." : "Crear y agregar a la compra"}
                    </button>
                  </div>
                )}

                {items.length > 0 && (
                  <div>
                    <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12 }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 680 }}>
                        <thead>
                          <tr style={{ background: "rgba(255,255,255,0.04)" }}>
                            {["Producto", "Cant.", "P. unitario", "Venc.", "Subtotal", "IVA", "Flete", "Total ítem", ""].map((h, i) => (
                              <th key={i} style={{ padding: "10px 10px", fontSize: 11, fontWeight: 700, color: "#6b7280", textAlign: i >= 4 && i <= 7 ? "right" : i === 8 ? "center" : "left", letterSpacing: 0.5, textTransform: "uppercase", whiteSpace: "nowrap" }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {itemsCalculados.map((it, idx) => (
                            <tr key={it.producto_id} style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                              <td style={{ padding: "9px 10px", color: "white", fontSize: 13, fontWeight: 500, maxWidth: 180, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={it.nombre}>{it.nombre}</td>
                              <td style={{ padding: "9px 10px" }}>
                                <input type="number" min="1" value={it.cantidad}
                                  onChange={e => setItems(items.map((item, i) => i === idx ? { ...item, cantidad: e.target.value } : item))}
                                  style={{ width: 62, padding: "5px 8px", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "white", fontSize: 13, outline: "none", textAlign: "center" }} />
                              </td>
                              <td style={{ padding: "9px 10px" }}>
                                <input type="number" min="0" step="0.01" value={it.precio_unitario}
                                  onChange={e => setItems(items.map((item, i) => i === idx ? { ...item, precio_unitario: e.target.value } : item))}
                                  placeholder="0.00"
                                  style={{ width: 90, padding: "5px 8px", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "white", fontSize: 13, outline: "none", textAlign: "center" }} />
                              </td>
                              <td style={{ padding: "9px 10px" }}>
                                <input type="date" value={it.fecha_vencimiento}
                                  onChange={e => setItems(items.map((item, i) => i === idx ? { ...item, fecha_vencimiento: e.target.value } : item))}
                                  style={{ padding: "5px 8px", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "white", fontSize: 12, outline: "none", colorScheme: "dark" }} />
                              </td>
                              <td style={{ padding: "9px 10px", textAlign: "right", color: "#d1d5db", fontSize: 12, whiteSpace: "nowrap" }}>{fmt(it.subtotalItem)}</td>
                              <td style={{ padding: "9px 10px", textAlign: "right", color: "#93c5fd", fontSize: 12, whiteSpace: "nowrap" }}>{fmt(it.ivaItem)}</td>
                              <td style={{ padding: "9px 10px", textAlign: "right", color: "#fb923c", fontSize: 12, whiteSpace: "nowrap" }}>{fmt(it.fleteItem)}</td>
                              <td style={{ padding: "9px 10px", textAlign: "right", color: "white", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" }}>{fmt(it.subtotalItem + it.ivaItem + it.fleteItem)}</td>
                              <td style={{ padding: "9px 10px", textAlign: "center" }}>
                                <button onClick={() => quitarItem(idx)} title="Quitar producto" style={{ background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.2)", color: "#f87171", borderRadius: 6, width: 28, height: 28, cursor: "pointer", fontSize: 14, fontWeight: 700, flexShrink: 0 }}>✕</button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {/* Resumen siempre visible */}
                    <div style={{ marginTop: 8, padding: "10px 14px", background: "rgba(255,255,255,0.04)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.08)", display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 12, color: "#6b7280" }}>Subtotal: <b style={{ color: "#d1d5db" }}>{fmt(subtotalForm)}</b></span>
                      {form.incluye_descuento && descuentoForm > 0 && <span style={{ fontSize: 12, color: "#4ade80" }}>🏷️ −{pctDescuentoForm}%: <b>−{fmt(descuentoForm)}</b></span>}
                      {form.incluye_iva && ivaForm > 0 && <span style={{ fontSize: 12, color: "#93c5fd" }}>IVA {pctIvaForm}%: <b>{fmt(ivaForm)}</b></span>}
                      {form.incluye_flete && fleteForm > 0 && <span style={{ fontSize: 12, color: "#fb923c" }}>🚚 Flete: <b>{fmt(fleteForm)}</b></span>}
                      <span style={{ fontSize: 14, color: "white", fontWeight: 800 }}>Total: {fmt(totalForm)}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Descuento toggle */}
              <div onClick={() => setForm({ ...form, incluye_descuento: !form.incluye_descuento })}
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderRadius: 10, cursor: "pointer", background: form.incluye_descuento ? "rgba(74,222,128,0.1)" : "rgba(255,255,255,0.04)", border: form.incluye_descuento ? "1px solid rgba(74,222,128,0.3)" : "1px solid rgba(255,255,255,0.08)", flexWrap: "wrap" }}>
                <div style={{ width: 20, height: 20, borderRadius: 5, flexShrink: 0, background: form.incluye_descuento ? "#16a34a" : "rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {form.incluye_descuento && <span style={{ color: "white", fontSize: 12 }}>✓</span>}
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: form.incluye_descuento ? "#4ade80" : "#9ca3af" }}>🏷️ Descuento</span>
                {form.incluye_descuento && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: 8 }} onClick={e => e.stopPropagation()}>
                    <input type="number" min="0" max="100" step="0.01" value={form.porcentaje_descuento}
                      onChange={e => setForm({ ...form, porcentaje_descuento: e.target.value })}
                      placeholder="0"
                      style={{ width: 60, padding: "6px 10px", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(74,222,128,0.3)", borderRadius: 8, color: "white", fontSize: 13, outline: "none", textAlign: "center" }} />
                    <span style={{ color: "#4ade80", fontSize: 13 }}>%</span>
                    {descuentoForm > 0 && <span style={{ marginLeft: 8, color: "#4ade80", fontSize: 12, fontWeight: 700 }}>−{fmt(descuentoForm)}</span>}
                  </div>
                )}
              </div>

              {/* IVA toggle */}
              <div onClick={() => setForm({ ...form, incluye_iva: !form.incluye_iva })}
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderRadius: 10, cursor: "pointer", background: form.incluye_iva ? "rgba(59,130,246,0.1)" : "rgba(255,255,255,0.04)", border: form.incluye_iva ? "1px solid rgba(59,130,246,0.3)" : "1px solid rgba(255,255,255,0.08)", flexWrap: "wrap" }}>
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
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderRadius: 10, cursor: "pointer", background: form.incluye_flete ? "rgba(249,115,22,0.1)" : "rgba(255,255,255,0.04)", border: form.incluye_flete ? "1px solid rgba(249,115,22,0.3)" : "1px solid rgba(255,255,255,0.08)", flexWrap: "wrap" }}>
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

              {(() => {
                const hayPago = !!form.pago_inicial && parseFloat(form.pago_inicial) > 0
                return (
                  <div className="compras-modal-grid" style={{ display: "grid", gridTemplateColumns: hayPago ? "1fr 1fr" : "1fr", gap: 14 }}>
                    <div>
                      <label style={labelStyle}>Pago inicial (vacío = a crédito)</label>
                      <input type="number" min="0" step="0.01" value={form.pago_inicial}
                        onChange={e => {
                          const val = e.target.value
                          const tieneValor = !!val && parseFloat(val) > 0
                          setForm({ ...form, pago_inicial: val, metodo_pago: tieneValor ? (form.metodo_pago || "Efectivo") : "" })
                        }}
                        placeholder="Dejar vacío = a crédito" style={inputDarkStyle} />
                    </div>
                    {hayPago && (
                      <div>
                        <label style={labelStyle}>Método de pago</label>
                        <select value={form.metodo_pago} onChange={e => setForm({ ...form, metodo_pago: e.target.value })} style={selectDarkStyle}>
                          {METODOS.map(m => <option key={m} style={{ background: "#1e293b", color: "white" }}>{m}</option>)}
                        </select>
                      </div>
                    )}
                  </div>
                )
              })()}

              <div>
                <label style={labelStyle}>Notas</label>
                <textarea value={form.notas} onChange={e => setForm({ ...form, notas: e.target.value })}
                  rows={2} placeholder="Observaciones, condiciones, etc."
                  style={{ ...inputDarkStyle, resize: "none" }} />
              </div>
            </div>

            <div style={{ padding: "0 28px 18px" }}>
              <div onClick={() => setActualizarCostos(!actualizarCostos)}
                style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 10, cursor: "pointer", background: actualizarCostos ? "rgba(34,197,94,0.08)" : "rgba(255,255,255,0.04)", border: actualizarCostos ? "1px solid rgba(34,197,94,0.25)" : "1px solid rgba(255,255,255,0.08)", marginBottom: 12 }}>
                <div style={{ width: 18, height: 18, borderRadius: 4, flexShrink: 0, background: actualizarCostos ? "#16a34a" : "rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {actualizarCostos && <span style={{ color: "white", fontSize: 11, fontWeight: 700 }}>✓</span>}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: actualizarCostos ? "#4ade80" : "#6b7280" }}>Actualizar costos en productos</div>
                  <div style={{ fontSize: 11, color: "#4b5563" }}>Actualiza el costo de cada producto al precio de esta compra</div>
                </div>
              </div>
            </div>
            <div className="compras-modal-footer" style={{ padding: "18px 28px", borderTop: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              {items.length > 0 && <span style={{ color: "#9ca3af", fontSize: 13 }}>Total: <b style={{ color: "white" }}>{fmt(totalForm)}</b></span>}
              <div className="compras-modal-footer-btns" style={{ display: "flex", gap: 10, marginLeft: "auto" }}>
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
                  {compraVer.monto_descuento > 0 && <span style={{ background: "rgba(74,222,128,0.12)", color: "#4ade80", fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 20 }}>🏷️ Desc. {compraVer.descuento_pct}% (−{fmt(compraVer.monto_descuento)})</span>}
                  {compraVer.incluye_iva && <span style={{ background: "rgba(59,130,246,0.12)", color: "#93c5fd", fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 20 }}>IVA {compraVer.porcentaje_iva}%</span>}
                  {compraVer.monto_flete > 0 && <span style={{ background: "rgba(249,115,22,0.12)", color: "#fb923c", fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 20 }}>🚚 {fmt(compraVer.monto_flete)}</span>}
                </div>
                <p style={{ color: "#6b7280", fontSize: 12, margin: 0 }}>
                  {compraVer.proveedores?.nombre} · {compraVer.fecha}
                  {compraVer.numero_remito && <span> · Remito: {compraVer.numero_remito}</span>}
                </p>
              </div>
              <button onClick={() => setCompraVer(null)} style={{ background: "rgba(255,255,255,0.08)", border: "none", color: "white", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 16, fontWeight: 700, flexShrink: 0 }}>✕</button>
            </div>

            {/* Resumen financiero */}
            <div style={{ padding: "18px 28px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
              <div className="compras-resumen-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 14 }}>
                {[
                  { label: "Total",   value: fmt(compraVer.total),                              color: "white" },
                  { label: "Pagado",  value: fmt(compraVer.total_pagado),                       color: "#4ade80" },
                  { label: "Saldo",   value: fmt(compraVer.total - compraVer.total_pagado),     color: compraVer.estado === "pagado" ? "#6b7280" : "#f87171" },
                ].map(item => (
                  <div key={item.label} style={{ background: "rgba(255,255,255,0.04)", borderRadius: 10, padding: "12px 16px", textAlign: "center", border: "1px solid rgba(255,255,255,0.06)" }}>
                    <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 4 }}>{item.label}</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: item.color }}>{item.value}</div>
                  </div>
                ))}
              </div>
              {compraVer.estado !== "pagado" ? (
                <div className="compras-botones-pago" style={{ display: "flex", gap: 10 }}>
                  <button onClick={() => { setFormPago({ monto: "", metodo_pago: "Efectivo", notas: "" }); setModalPago(true) }}
                    style={{ flex: 1, padding: "10px", background: "linear-gradient(135deg, #16a34a, #22c55e)", border: "none", borderRadius: 10, color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                    💳 Pago parcial
                  </button>
                  <button onClick={() => { setDescuentoCancelar(""); setModalCancelar(true); }} disabled={cancelando}
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
            <div className="compras-tabs" style={{ display: "flex", padding: "0 28px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
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
              <div className="compras-detalle-inner" style={{ padding: "20px 28px" }}>
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
                              <th style={{ textAlign: "left",   padding: "8px 10px", color: "#6b7280", fontSize: 11, fontWeight: 700, textTransform: "uppercase" }}>Producto</th>
                              <th style={{ textAlign: "center", padding: "8px 10px", color: "#6b7280", fontSize: 11, fontWeight: 700, textTransform: "uppercase" }}>Cant.</th>
                              <th style={{ textAlign: "right",  padding: "8px 10px", color: "#6b7280", fontSize: 11, fontWeight: 700, textTransform: "uppercase" }}>P. unit.</th>
                              <th style={{ textAlign: "right",  padding: "8px 10px", color: "#6b7280", fontSize: 11, fontWeight: 700, textTransform: "uppercase" }}>Subtotal</th>
                              {hayIva   && <th style={{ textAlign: "right", padding: "8px 10px", color: "#93c5fd", fontSize: 11, fontWeight: 700, textTransform: "uppercase" }}>IVA</th>}
                              {hayFlete && <th style={{ textAlign: "right", padding: "8px 10px", color: "#fb923c", fontSize: 11, fontWeight: 700, textTransform: "uppercase" }}>Flete</th>}
                              <th style={{ textAlign: "right",  padding: "8px 10px", color: "#6b7280", fontSize: 11, fontWeight: 700, textTransform: "uppercase" }}>Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {detalleConExtras.map(d => (
                              <tr key={d.id} style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                                <td style={{ padding: "9px 10px", color: "white",   fontSize: 12 }}>{d.productos?.nombre ?? "—"}</td>
                                <td style={{ padding: "9px 10px", textAlign: "center", color: "#9ca3af", fontSize: 12 }}>{d.cantidad}</td>
                                <td style={{ padding: "9px 10px", textAlign: "right",  color: "#d1d5db", fontSize: 12 }}>{fmt(d.precio_unitario)}</td>
                                <td style={{ padding: "9px 10px", textAlign: "right",  color: "#d1d5db", fontSize: 12 }}>{fmt(d.subtotalItem)}</td>
                                {hayIva   && <td style={{ padding: "9px 10px", textAlign: "right", color: "#93c5fd", fontSize: 12 }}>{fmt(d.ivaItem)}</td>}
                                {hayFlete && <td style={{ padding: "9px 10px", textAlign: "right", color: "#fb923c", fontSize: 12 }}>{fmt(d.fleteItem)}</td>}
                                <td style={{ padding: "9px 10px", textAlign: "right",  color: "white",   fontSize: 12, fontWeight: 700 }}>{fmt(d.subtotalItem + d.ivaItem + d.fleteItem)}</td>
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
                      <div style={{ marginTop: 14, borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 14 }}>
                        <button onClick={reaplicarCompraAProductos} disabled={reaplicando}
                          style={{ width: "100%", padding: "11px", background: reaplicando ? "rgba(255,255,255,0.05)" : "rgba(59,130,246,0.12)", border: "1px solid rgba(59,130,246,0.25)", borderRadius: 10, color: reaplicando ? "#6b7280" : "#60a5fa", fontSize: 13, fontWeight: 700, cursor: reaplicando ? "not-allowed" : "pointer" }}>
                          {reaplicando ? "Aplicando..." : "🔄 Aplicar a productos (costo · precio de venta)"}
                        </button>
                      </div>
                    </div>
                  );
                })()}

                {tabDetalle === "pagos" && (
                  <div>
                    {pagos.length === 0 ? (
                      <p style={{ textAlign: "center", padding: 24, color: "#6b7280", fontSize: 13 }}>Sin pagos registrados todavía.</p>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {pagos.map((p, idx) => {
                          const mc = (p.metodo_pago ? METODO_COLOR[p.metodo_pago] : null) ?? METODO_COLOR["Otro"]
                          return (
                            <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: "rgba(255,255,255,0.04)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)", flexWrap: "wrap" }}>
                              <span style={{ fontSize: 11, color: "#4b5563", fontWeight: 700, flexShrink: 0 }}>#{idx + 1}</span>
                              <span style={{ fontSize: 12, color: "#9ca3af", flexShrink: 0 }}>📅 {p.fecha}</span>
                              {p.metodo_pago
                                ? <span style={{ background: mc.bg, color: mc.color, fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, flexShrink: 0 }}>💳 {p.metodo_pago}</span>
                                : <span style={{ color: "#4b5563", fontSize: 11 }}>—</span>
                              }
                              <span style={{ marginLeft: "auto", color: "#4ade80", fontWeight: 800, fontSize: 14, flexShrink: 0 }}>{fmt(p.monto)}</span>
                              {p.notas && <span style={{ width: "100%", fontSize: 11, color: "#6b7280", paddingLeft: 24 }}>📝 {p.notas}</span>}
                            </div>
                          )
                        })}
                        <div style={{ display: "flex", justifyContent: "flex-end", padding: "10px 14px", borderTop: "1px solid rgba(255,255,255,0.08)", marginTop: 4 }}>
                          <span style={{ color: "white", fontSize: 13, fontWeight: 700 }}>Total pagado: <span style={{ color: "#4ade80", fontSize: 15 }}>{fmt(compraVer.total_pagado)}</span></span>
                        </div>
                      </div>
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
              <select value={formPago.metodo_pago} onChange={e => setFormPago({ ...formPago, metodo_pago: e.target.value })} style={selectDarkStyle}>
                {METODOS.map(m => <option key={m} style={{ background: "#1e293b", color: "white" }}>{m}</option>)}
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

      {/* ── MODAL CANCELAR CON DESCUENTO ── */}
      {modalCancelar && compraVer && (() => {
        const saldo = compraVer.total - compraVer.total_pagado;
        const pctDesc = parseFloat(descuentoCancelar) || 0;
        const montoDesc = pctDesc > 0 ? Math.round(saldo * (pctDesc / 100) * 100) / 100 : 0;
        const montoPago = Math.round((saldo - montoDesc) * 100) / 100;
        return (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 70, padding: 16 }}>
            <div style={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: "32px 28px", width: "100%", maxWidth: 400, boxShadow: "0 24px 64px rgba(0,0,0,0.6)" }}>
              <h2 style={{ color: "white", fontSize: 17, fontWeight: 700, margin: "0 0 6px" }}>✅ Cancelar deuda</h2>
              <p style={{ color: "#6b7280", fontSize: 12, marginBottom: 24 }}>
                Saldo pendiente: <span style={{ color: "#f87171", fontWeight: 700 }}>{fmt(saldo)}</span>
              </p>

              {/* Descuento */}
              <div style={{ marginBottom: 20 }}>
                <label style={labelStyle}>Descuento (opcional)</label>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <input type="number" min="0" max="100" step="0.01"
                    value={descuentoCancelar}
                    onChange={e => setDescuentoCancelar(e.target.value)}
                    placeholder="0"
                    style={{ ...inputDarkStyle, width: 90, textAlign: "center" }} />
                  <span style={{ color: "#9ca3af", fontSize: 14, fontWeight: 700 }}>%</span>
                  {montoDesc > 0 && (
                    <span style={{ color: "#4ade80", fontSize: 13, fontWeight: 600 }}>− {fmt(montoDesc)}</span>
                  )}
                </div>
              </div>

              {/* Resumen */}
              <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "14px 16px", marginBottom: 24 }}>
                {montoDesc > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 13, color: "#9ca3af" }}>
                    <span>Descuento ({pctDesc}%)</span>
                    <span style={{ color: "#4ade80", fontWeight: 600 }}>− {fmt(montoDesc)}</span>
                  </div>
                )}
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15, fontWeight: 800, color: "white" }}>
                  <span>Total a pagar</span>
                  <span style={{ color: "#60a5fa" }}>{fmt(montoPago)}</span>
                </div>
              </div>

              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => setModalCancelar(false)} style={{ flex: 1, padding: "11px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, color: "#9ca3af", fontSize: 13, cursor: "pointer", fontWeight: 600 }}>Cancelar</button>
                <button onClick={() => cancelarCompra(pctDesc)} disabled={cancelando}
                  style={{ flex: 1, padding: "11px", background: "linear-gradient(135deg, #2563eb, #3b82f6)", border: "none", borderRadius: 10, color: "white", fontSize: 13, fontWeight: 700, cursor: cancelando ? "not-allowed" : "pointer", opacity: cancelando ? 0.5 : 1 }}>
                  {cancelando ? "Registrando..." : "Confirmar pago"}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

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