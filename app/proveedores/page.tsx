"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

interface Proveedor {
  id: string;
  nombre: string;
  cuit: string | null;
  telefono: string | null;
  email: string | null;
  direccion: string | null;
  notas: string | null;
  created_at: string;
  saldo_pendiente: number;
  compras_pendientes: number;
}

const EMPTY_FORM = { nombre: "", cuit: "", telefono: "", email: "", direccion: "", notas: "" };
const METODOS_PAGO = ["Transferencia", "Efectivo", "Cheque", "Tarjeta", "Otro"];

const responsiveStyles = `
  @media (max-width: 768px) {
    .prov-header { flex-direction: column !important; align-items: flex-start !important; gap: 10px !important; }
    .prov-header-btn { width: 100% !important; text-align: center !important; }
    .prov-card { flex-direction: column !important; align-items: flex-start !important; }
    .prov-card-acciones { width: 100% !important; justify-content: flex-end !important; display: flex !important; gap: 8px !important; margin-top: 10px !important; }
    .prov-modal-grid { grid-template-columns: 1fr !important; }
    .prov-modal-inner { padding: 24px 18px !important; }
  }
`

function fmt(n: number) {
  return n.toLocaleString("es-AR", { style: "currency", currency: "ARS" });
}

const labelStyle: React.CSSProperties = {
  display: "block", fontSize: 11, fontWeight: 700,
  color: "#9ca3af", letterSpacing: 0.5, marginBottom: 6, textTransform: "uppercase"
}

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "10px 14px",
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 10, color: "white", fontSize: 14,
  outline: "none", boxSizing: "border-box"
}

const inputLightStyle: React.CSSProperties = {
  width: "100%", padding: "10px 14px",
  border: "1px solid #e2e8f0", borderRadius: 10,
  fontSize: 14, color: "#111827", outline: "none",
  boxSizing: "border-box", background: "white"
}

export default function ProveedoresPage() {
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [loading, setLoading] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [modalAbierto, setModalAbierto] = useState(false);
  const [editando, setEditando] = useState<Proveedor | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmEliminar, setConfirmEliminar] = useState<Proveedor | null>(null);

  // ── Historial de pagos ─────────────────────────────────────────────────────
  const [modalHistorial,   setModalHistorial]   = useState<Proveedor | null>(null);
  const [historialPagos,   setHistorialPagos]   = useState<any[]>([]);
  const [loadingHistorial, setLoadingHistorial] = useState(false);
  const [filtroFechaHist,  setFiltroFechaHist]  = useState<"todo"|"hoy"|"semana"|"mes">("todo");
  const [filtroMetodoHist, setFiltroMetodoHist] = useState<string>("todos");
  const [errorEliminar, setErrorEliminar] = useState<string | null>(null);

  // ── Modal pago masivo ──────────────────────────────────────────────────────
  const [modalPago, setModalPago] = useState<Proveedor | null>(null);
  const [comprasPendientes, setComprasPendientes] = useState<any[]>([]);
  const [loadingCompras, setLoadingCompras] = useState(false);
  const [montoPago, setMontoPago] = useState("");
  const [metodoPago, setMetodoPago] = useState("Transferencia");
  const [notaPago, setNotaPago] = useState("");
  const [procesandoPago, setProcesandoPago] = useState(false);
  const [errorPago, setErrorPago] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);
  const [saldoFavorProv, setSaldoFavorProv] = useState(0);
  const [usarSaldoFavor, setUsarSaldoFavor] = useState(false);
  const [saldosFavor, setSaldosFavor] = useState<Record<string, number>>({});
  const [comprasSeleccionadas, setComprasSeleccionadas] = useState<Set<number>>(new Set());
  const [descuentoPago, setDescuentoPago] = useState("");

  // ── Modal nota de crédito / devolución ─────────────────────────────────────
  const [modalNC, setModalNC] = useState<Proveedor | null>(null);
  const [ncMonto, setNcMonto] = useState("");
  const [ncMotivo, setNcMotivo] = useState("");
  const [guardandoNC, setGuardandoNC] = useState(false);
  const [errorNC, setErrorNC] = useState<string | null>(null);

  useEffect(() => { cargarProveedores(); }, []);

  async function cargarProveedores() {
    setLoading(true);
    try {
      const [{ data, error }, { data: saldos }] = await Promise.all([
        supabase.from("proveedores_con_saldo").select("*").order("nombre"),
        supabase.from("saldo_proveedores").select("proveedor_id, monto"),
      ]);
      if (!error && data) setProveedores(data);
      if (saldos) {
        const mapa: Record<string, number> = {};
        saldos.forEach((s: any) => {
          mapa[s.proveedor_id] = (mapa[s.proveedor_id] || 0) + Number(s.monto);
        });
        setSaldosFavor(mapa);
      }
    } catch (e) {
      console.error("Error cargando proveedores:", e)
    } finally {
      setLoading(false);
    }
  }

  function abrirCrear() {
    setEditando(null); setForm(EMPTY_FORM); setError(null); setModalAbierto(true);
  }

  function abrirEditar(p: Proveedor) {
    setEditando(p);
    setForm({ nombre: p.nombre, cuit: p.cuit ?? "", telefono: p.telefono ?? "", email: p.email ?? "", direccion: p.direccion ?? "", notas: p.notas ?? "" });
    setError(null); setModalAbierto(true);
  }

  function cerrarModal() { setModalAbierto(false); setEditando(null); setForm(EMPTY_FORM); setError(null); }

  async function guardar() {
    if (!form.nombre.trim()) { setError("El nombre es obligatorio."); return; }
    setGuardando(true); setError(null);
    const payload = {
      nombre: form.nombre.trim(), cuit: form.cuit.trim() || null,
      telefono: form.telefono.trim() || null, email: form.email.trim() || null,
      direccion: form.direccion.trim() || null, notas: form.notas.trim() || null,
    };
    try {
      let err;
      if (editando) {
        ({ error: err } = await supabase.from("proveedores").update(payload).eq("id", editando.id));
      } else {
        ({ error: err } = await supabase.from("proveedores").insert([payload]));
      }
      if (err) { setError("Error al guardar: " + err.message); return; }
      if (editando) {
        // Edición: actualizar localmente sin recargar la lista completa
        setProveedores(prev => prev.map(p => p.id === editando.id ? { ...p, ...payload } : p))
        cerrarModal()
      } else {
        // Alta nueva: necesita recargar para obtener ID y datos computados de la vista
        cerrarModal(); cargarProveedores()
      }
    } catch (e: any) {
      setError("Error: " + (e?.message || "error desconocido"));
    } finally {
      setGuardando(false);
    }
  }

  async function eliminar(p: Proveedor) {
    setErrorEliminar(null);
    try {
      const { error } = await supabase.from("proveedores").delete().eq("id", p.id);
      if (error) {
        setErrorEliminar(p.compras_pendientes > 0
          ? `No se puede eliminar: ${p.nombre} tiene compras registradas.`
          : "No se pudo eliminar: " + error.message);
      } else {
        // Filtrar localmente — sin recargar toda la lista
        setProveedores(prev => prev.filter(x => x.id !== p.id))
        setConfirmEliminar(null); setErrorEliminar(null);
      }
    } catch (e: any) {
      setErrorEliminar("Error: " + (e?.message || "error desconocido"));
    }
  }

  // ── Nota de crédito / devolución ───────────────────────────────────────────
  function abrirNC(p: Proveedor) {
    setModalNC(p);
    setNcMonto("");
    setNcMotivo("");
    setErrorNC(null);
  }

  async function guardarNC() {
    if (!modalNC) return;
    const monto = parseFloat(ncMonto.replace(",", ".")) || 0;
    if (monto <= 0) { setErrorNC("Ingresá un monto válido."); return; }
    setGuardandoNC(true);
    setErrorNC(null);
    try {
      const fechaTxt = new Date().toLocaleDateString("es-AR");
      await supabase.from("saldo_proveedores").insert({
        proveedor_id: modalNC.id,
        monto: Math.round(monto * 100) / 100,
        notas: `Nota de crédito / devolución${ncMotivo.trim() ? " — " + ncMotivo.trim() : ""} (${fechaTxt})`,
      });
      setModalNC(null);
      await cargarProveedores();
    } catch (e: any) {
      setErrorNC(e.message || "Error al guardar la nota de crédito.");
    } finally {
      setGuardandoNC(false);
    }
  }

  // ── Funciones pago masivo ──────────────────────────────────────────────────
  async function abrirPago(p: Proveedor) {
    setModalPago(p);
    setMontoPago("");
    setMetodoPago("Transferencia");
    setNotaPago("");
    setErrorPago(null);
    setExito(null);
    setUsarSaldoFavor(false);
    setSaldoFavorProv(0);
    setComprasSeleccionadas(new Set());
    setDescuentoPago("");
    setLoadingCompras(true);
    try {
      const [{ data: compras }, { data: saldos }] = await Promise.all([
        supabase.from("compras").select("id, total, total_pagado, numero_remito, fecha")
          .eq("proveedor_id", p.id).in("estado", ["pendiente", "parcial"]).order("id", { ascending: true }),
        supabase.from("saldo_proveedores").select("monto").eq("proveedor_id", p.id),
      ]);
      setComprasPendientes(compras || []);
      const totalSaldo = (saldos || []).reduce((s: number, r: any) => s + Number(r.monto), 0);
      setSaldoFavorProv(Math.max(0, totalSaldo));
    } catch (e) {
      console.error("Error cargando compras del proveedor:", e);
    } finally {
      setLoadingCompras(false);
    }
  }

  function cerrarPago() {
    setModalPago(null);
    setComprasPendientes([]);
    setMontoPago("");
    setErrorPago(null);
    setExito(null);
    setUsarSaldoFavor(false);
    setSaldoFavorProv(0);
    setComprasSeleccionadas(new Set());
    setDescuentoPago("");
  }

  // Suma de efectivo a pagar por las compras seleccionadas (saldo menos descuento)
  function sumaCashSeleccion(sel: Set<number>, pct: number) {
    return comprasPendientes
      .filter(c => sel.has(c.id))
      .reduce((s, c) => {
        const saldo = Math.round((c.total - c.total_pagado) * 100) / 100;
        const desc = pct > 0 ? Math.round(saldo * (pct / 100) * 100) / 100 : 0;
        return s + (saldo - desc);
      }, 0);
  }

  // Efectivo a pagar en modo selección = (saldo − descuento) − crédito a favor (si se usa)
  function recomputarMontoSel(sel: Set<number>, pct: number, usarCred: boolean) {
    if (sel.size === 0) { setMontoPago(""); return; }
    const settle = sumaCashSeleccion(sel, pct);
    const credito = usarCred ? saldoFavorProv : 0;
    setMontoPago(String(Math.max(0, Math.round((settle - credito) * 100) / 100)));
  }

  function toggleCompra(id: number) {
    setComprasSeleccionadas(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      recomputarMontoSel(next, parseFloat(descuentoPago) || 0, usarSaldoFavor);
      setErrorPago(null); setExito(null);
      return next;
    });
  }

  function cambiarDescuento(valor: string) {
    setDescuentoPago(valor);
    if (comprasSeleccionadas.size > 0) {
      recomputarMontoSel(comprasSeleccionadas, parseFloat(valor) || 0, usarSaldoFavor);
    }
  }

  function toggleSaldoFavor() {
    const nuevo = !usarSaldoFavor;
    setUsarSaldoFavor(nuevo);
    setExito(null);
    if (comprasSeleccionadas.size > 0) {
      recomputarMontoSel(comprasSeleccionadas, parseFloat(descuentoPago) || 0, nuevo);
    }
  }

  function calcularPreview() {
    const pctDesc = parseFloat(descuentoPago) || 0;
    // ── Modo selección: cada compra tildada se paga en full (con descuento opcional) ──
    if (comprasSeleccionadas.size > 0) {
      return comprasPendientes.map(c => {
        const saldo = Math.round((c.total - c.total_pagado) * 100) / 100;
        if (!comprasSeleccionadas.has(c.id)) return { ...c, saldo, montoDesc: 0, pago: 0, resultado: "sin_cambio" };
        const montoDesc = pctDesc > 0 ? Math.round(saldo * (pctDesc / 100) * 100) / 100 : 0;
        const pago = Math.round((saldo - montoDesc) * 100) / 100;
        return { ...c, saldo, montoDesc, pago, resultado: "pagado" };
      });
    }
    // ── Modo monto libre: reparte de la más antigua a la más nueva (sin descuento) ──
    const monto = parseFloat(montoPago.replace(",", ".")) || 0;
    const saldoExtra = usarSaldoFavor ? saldoFavorProv : 0;
    const total = monto + saldoExtra;
    if (total <= 0 || comprasPendientes.length === 0) return [];
    let restante = total;
    return comprasPendientes.map(c => {
      const saldo = Math.round((c.total - c.total_pagado) * 100) / 100;
      if (restante <= 0) return { ...c, saldo, montoDesc: 0, pago: 0, resultado: "sin_cambio" };
      const pago = Math.min(restante, saldo);
      restante = Math.round((restante - pago) * 100) / 100;
      return { ...c, saldo, montoDesc: 0, pago: Math.round(pago * 100) / 100, resultado: pago >= saldo ? "pagado" : "parcial" };
    });
  }

  async function confirmarPago() {
    if (!modalPago) return;
    const seleccion = comprasSeleccionadas.size > 0;
    const monto = parseFloat(montoPago.replace(",", ".")) || 0;
    const saldoExtra = usarSaldoFavor ? saldoFavorProv : 0;
    const pctDesc = parseFloat(descuentoPago) || 0;
    if (!seleccion && monto <= 0 && saldoExtra <= 0) { setErrorPago("Ingresá un monto o seleccioná facturas."); return; }
    setProcesandoPago(true);
    setErrorPago(null);
    const preview = calcularPreview();
    const afectadas = preview.filter((c: any) => c.pago > 0 || (c.montoDesc || 0) > 0);
    const totalDescuento = afectadas.reduce((s: number, c: any) => s + (c.montoDesc || 0), 0);
    let creditoRestante = saldoExtra;
    let totalCash = 0, totalCredito = 0;
    try {
      // 1. Registrar pago en cada compra — crédito (nota de crédito / saldo a favor) primero, luego efectivo
      for (const c of afectadas) {
        const montoDesc = c.montoDesc || 0;
        const nuevoTotalCompra = montoDesc > 0 ? Math.round((c.total - montoDesc) * 100) / 100 : c.total;
        const credUsado = Math.min(creditoRestante, c.pago);
        creditoRestante = Math.round((creditoRestante - credUsado) * 100) / 100;
        const cashUsado = Math.round((c.pago - credUsado) * 100) / 100;
        totalCredito = Math.round((totalCredito + credUsado) * 100) / 100;
        totalCash = Math.round((totalCash + cashUsado) * 100) / 100;
        const notaBase = [
          notaPago.trim() || null,
          montoDesc > 0 ? `Descuento ${pctDesc}% aplicado: ${fmt(montoDesc)}` : null,
        ].filter(Boolean).join(" | ") || null;
        if (credUsado > 0) {
          await supabase.from("compras_pagos").insert({
            compra_id: c.id, monto: credUsado, metodo_pago: "Nota de crédito",
            notas: notaBase, fecha: new Date().toISOString(),
          });
        }
        if (cashUsado > 0) {
          await supabase.from("compras_pagos").insert({
            compra_id: c.id, monto: cashUsado, metodo_pago: metodoPago,
            notas: notaBase, fecha: new Date().toISOString(),
          });
        }
        const nuevoTotalPagado = Math.round((c.total_pagado + credUsado + cashUsado) * 100) / 100;
        const nuevoEstado = nuevoTotalPagado >= nuevoTotalCompra ? "pagado" : "parcial";
        const updateCompra: any = { total_pagado: nuevoTotalPagado, estado: nuevoEstado };
        if (montoDesc > 0) updateCompra.total = nuevoTotalCompra;
        await supabase.from("compras").update(updateCompra).eq("id", c.id);
      }

      const totalAplicado = Math.round((totalCash + totalCredito) * 100) / 100;
      const exceso = seleccion ? 0 : Math.max(0, Math.round((monto + saldoExtra - totalAplicado) * 100) / 100);

      // 2. Consumir el crédito usado de saldo_proveedores (FIFO)
      if (totalCredito > 0.01) {
        const { data: registros } = await supabase.from("saldo_proveedores")
          .select("id, monto").eq("proveedor_id", modalPago.id)
          .gt("monto", 0).order("fecha", { ascending: true });
        let aDescontar = totalCredito;
        for (const reg of (registros || [])) {
          if (aDescontar <= 0.001) break;
          if (reg.monto <= aDescontar + 0.001) {
            await supabase.from("saldo_proveedores").delete().eq("id", reg.id);
            aDescontar -= reg.monto;
          } else {
            await supabase.from("saldo_proveedores").update({ monto: Math.round((reg.monto - aDescontar) * 100) / 100 }).eq("id", reg.id);
            aDescontar = 0;
          }
        }
      }

      // 3. Si hay exceso de efectivo → guardar como saldo a favor
      if (exceso > 0.01) {
        await supabase.from("saldo_proveedores").insert({
          proveedor_id: modalPago.id,
          monto: exceso,
          notas: `Exceso de pago — ${new Date().toLocaleDateString("es-AR")}`,
        });
        setSaldoFavorProv(prev => Math.round((prev + exceso) * 100) / 100);
      }

      const facturasPagadas = afectadas.filter((c: any) => c.resultado === "pagado").length;
      let msg = `✅ Pago de ${fmt(totalAplicado)} aplicado. ${facturasPagadas} factura${facturasPagadas !== 1 ? "s" : ""} saldada${facturasPagadas !== 1 ? "s" : ""}.`;
      if (totalCredito > 0.01) msg += ` Nota de crédito / saldo a favor usado: ${fmt(totalCredito)}.`;
      if (totalDescuento > 0.01) msg += ` Descuento: ${fmt(totalDescuento)}.`;
      if (exceso > 0.01) msg += ` ${fmt(exceso)} quedaron como saldo a favor.`;
      setExito(msg);

      await cargarProveedores();
      const { data } = await supabase.from("compras")
        .select("id, total, total_pagado, numero_remito, fecha")
        .eq("proveedor_id", modalPago.id)
        .in("estado", ["pendiente", "parcial"])
        .order("id", { ascending: true });
      setComprasPendientes(data || []);
      setMontoPago("");
      setUsarSaldoFavor(false);
      setComprasSeleccionadas(new Set());
      setDescuentoPago("");
    } catch (e: any) {
      setErrorPago(e.message || "Error al procesar el pago.");
    } finally {
      setProcesandoPago(false);
    }
  }

  // ── Historial de pagos ─────────────────────────────────────────────────────
  async function abrirHistorial(p: Proveedor) {
    setModalHistorial(p);
    setHistorialPagos([]);
    setLoadingHistorial(true);
    setFiltroFechaHist("todo");
    setFiltroMetodoHist("todos");
    try {
      // Traer todas las compras del proveedor
      const { data: compras } = await supabase
        .from("compras")
        .select("id, numero_remito, fecha, total")
        .eq("proveedor_id", p.id);

      if (!compras?.length) { setLoadingHistorial(false); return; }

      // Traer todos los pagos de esas compras
      const { data: pagos } = await supabase
        .from("compras_pagos")
        .select("id, compra_id, fecha, monto, metodo_pago, notas")
        .in("compra_id", compras.map(c => c.id))
        .order("fecha", { ascending: false });

      // Unir pagos con info de la compra
      const comprasMap = Object.fromEntries(compras.map(c => [c.id, c]));
      setHistorialPagos((pagos || []).map(pg => ({
        ...pg,
        compra: comprasMap[pg.compra_id] || null,
      })));
    } finally {
      setLoadingHistorial(false);
    }
  }

  const filtrados = proveedores.filter(p =>
    [p.nombre, p.cuit, p.telefono, p.email].join(" ").toLowerCase().includes(busqueda.toLowerCase())
  );
  const totalDeuda = proveedores.reduce((s, p) => s + (p.saldo_pendiente ?? 0), 0);

  return (
    <div>
      <style>{responsiveStyles}</style>

      {/* Header */}
      <div className="prov-header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <p style={{ fontSize: 13, color: "#6b7280", margin: 0 }}>
            <span style={{ fontWeight: 700, color: "#374151" }}>{proveedores.length}</span> proveedor{proveedores.length !== 1 ? "es" : ""}
            {totalDeuda > 0 && <span style={{ marginLeft: 10, color: "#dc2626", fontWeight: 600 }}>· Deuda total: {fmt(totalDeuda)}</span>}
          </p>
        </div>
        <button onClick={abrirCrear} className="prov-header-btn" style={{
          background: "linear-gradient(135deg, #2563eb, #3b82f6)", color: "white",
          border: "none", borderRadius: 10, padding: "10px 18px",
          fontSize: 13, fontWeight: 700, cursor: "pointer",
          boxShadow: "0 2px 8px rgba(59,130,246,0.3)"
        }}>
          + Nuevo proveedor
        </button>
      </div>

      {/* Buscador */}
      <input type="text" placeholder="🔍 Buscar por nombre, CUIT, teléfono o email..."
        value={busqueda} onChange={e => setBusqueda(e.target.value)}
        style={{ ...inputLightStyle, marginBottom: 16 }} />

      {/* Lista */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: "#94a3b8" }}>Cargando...</div>
      ) : filtrados.length === 0 ? (
        <div style={{ textAlign: "center", padding: 40, color: "#94a3b8" }}>
          {busqueda ? "No se encontraron resultados." : "No hay proveedores cargados todavía."}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filtrados.map(p => (
            <div key={p.id} className="prov-card" style={{
              background: "white", borderRadius: 14, padding: "16px 20px",
              border: p.saldo_pendiente > 0 ? "1px solid #fecaca" : "1px solid #e2e8f0",
              boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
              display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap"
            }}>
              {/* Avatar + info */}
              <div style={{ display: "flex", alignItems: "center", gap: 14, flex: 1, minWidth: 0 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: "50%", flexShrink: 0,
                  background: "linear-gradient(135deg, #1e40af, #3b82f6)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 16, fontWeight: 800, color: "white"
                }}>
                  {p.nombre.charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 15, color: "#111827", marginBottom: 3 }}>{p.nombre}</div>
                  <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 12, color: "#6b7280" }}>
                    {p.cuit && <span>CUIT: {p.cuit}</span>}
                    {p.telefono && <span>📞 {p.telefono}</span>}
                    {p.email && <span>✉️ {p.email}</span>}
                    {p.direccion && <span>📍 {p.direccion}</span>}
                  </div>
                  {p.notas && <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 3 }}>📝 {p.notas}</div>}
                </div>
              </div>

              {/* Saldo + botones */}
              <div className="prov-card-acciones" style={{ display: "flex", alignItems: "center", gap: 16, flexShrink: 0 }}>
                <div style={{ textAlign: "right" }}>
                  {p.saldo_pendiente > 0 ? (
                    <>
                      <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 2 }}>Deuda pendiente</div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: "#dc2626" }}>{fmt(p.saldo_pendiente)}</div>
                      <div style={{ fontSize: 11, color: "#9ca3af" }}>{p.compras_pendientes} compra{p.compras_pendientes !== 1 ? "s" : ""}</div>
                    </>
                  ) : (
                    <span style={{
                      background: "#f0fdf4", color: "#16a34a", fontSize: 11,
                      fontWeight: 700, padding: "4px 10px", borderRadius: 20,
                      border: "1px solid #bbf7d0"
                    }}>✓ Sin deuda</span>
                  )}
                  {(saldosFavor[p.id] || 0) > 0 && (
                    <div style={{ marginTop: 4, fontSize: 11, fontWeight: 700, color: "#16a34a", background: "#f0fdf4", borderRadius: 20, padding: "2px 8px", border: "1px solid #bbf7d0", display: "inline-block" }}>
                      💰 Saldo a favor: {fmt(saldosFavor[p.id])}
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  {p.saldo_pendiente > 0 && (
                    <button onClick={() => abrirPago(p)} style={{
                      background: "linear-gradient(135deg, #16a34a, #22c55e)", color: "white",
                      border: "none", borderRadius: 8, padding: "7px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer",
                      boxShadow: "0 2px 6px rgba(34,197,94,0.3)"
                    }}>💳 Pagar</button>
                  )}
                  <button onClick={() => abrirNC(p)} title="Registrar nota de crédito / devolución" style={{
                    background: "#f0fdf4", color: "#16a34a", border: "1px solid #bbf7d0",
                    borderRadius: 8, padding: "7px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer"
                  }}>↩️ NC</button>
                  <button onClick={() => abrirHistorial(p)} style={{
                    background: "#eff6ff", color: "#2563eb", border: "1px solid #bfdbfe",
                    borderRadius: 8, padding: "7px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer"
                  }}>📋 Pagos</button>
                  <button onClick={() => abrirEditar(p)} style={{
                    background: "#f1f5f9", color: "#374151", border: "1px solid #e2e8f0",
                    borderRadius: 8, padding: "7px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer"
                  }}>✏️ Editar</button>
                  <button onClick={() => { setConfirmEliminar(p); setErrorEliminar(null); }} style={{
                    background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca",
                    borderRadius: 8, padding: "7px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer"
                  }}>🗑️</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal crear/editar */}
      {modalAbierto && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 }}
          onClick={cerrarModal}>
          <div className="prov-modal-inner" style={{
            background: "#0f172a", border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 20, padding: "36px 32px", width: "100%", maxWidth: 480,
            boxShadow: "0 24px 64px rgba(0,0,0,0.6)"
          }} onClick={e => e.stopPropagation()}>
            <h2 style={{ color: "white", fontSize: 18, fontWeight: 700, margin: "0 0 24px" }}>
              {editando ? "Editar proveedor" : "Nuevo proveedor"}
            </h2>
            {error && (
              <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "#f87171", fontSize: 13, padding: "10px 14px", borderRadius: 8, marginBottom: 16 }}>
                {error}
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={labelStyle}>Nombre *</label>
                <input type="text" value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })}
                  placeholder="Ej: Laboratorio Holliday Scott" style={inputStyle} />
              </div>
              <div className="prov-modal-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div>
                  <label style={labelStyle}>CUIT</label>
                  <input type="text" value={form.cuit} onChange={e => setForm({ ...form, cuit: e.target.value })}
                    placeholder="20-12345678-9" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Teléfono</label>
                  <input type="text" value={form.telefono} onChange={e => setForm({ ...form, telefono: e.target.value })}
                    placeholder="011 4567-8900" style={inputStyle} />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Email</label>
                <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                  placeholder="contacto@proveedor.com" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Dirección</label>
                <input type="text" value={form.direccion} onChange={e => setForm({ ...form, direccion: e.target.value })}
                  placeholder="Av. Corrientes 1234, CABA" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Notas</label>
                <textarea value={form.notas} onChange={e => setForm({ ...form, notas: e.target.value })}
                  rows={2} placeholder="Observaciones, condiciones comerciales, etc."
                  style={{ ...inputStyle, resize: "none" }} />
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
              <button onClick={cerrarModal} style={{
                flex: 1, padding: "11px", background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10,
                color: "#9ca3af", fontSize: 13, cursor: "pointer", fontWeight: 600
              }}>Cancelar</button>
              <button onClick={guardar} disabled={guardando} style={{
                flex: 1, padding: "11px",
                background: "linear-gradient(135deg, #2563eb, #3b82f6)",
                border: "none", borderRadius: 10, color: "white",
                fontSize: 13, fontWeight: 700, cursor: "pointer",
                opacity: guardando ? 0.5 : 1
              }}>
                {guardando ? "Guardando..." : editando ? "Guardar cambios" : "Crear proveedor"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal pago masivo ── */}
      {modalPago && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 }}
          onClick={cerrarPago}>
          <div style={{
            background: "#0f172a", border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 20, padding: "32px 28px", width: "100%", maxWidth: 520,
            maxHeight: "88vh", overflow: "auto", boxShadow: "0 24px 64px rgba(0,0,0,0.6)"
          }} onClick={e => e.stopPropagation()}>

            {/* Título */}
            <h2 style={{ color: "white", fontSize: 18, fontWeight: 700, margin: "0 0 4px" }}>
              💳 Registrar pago
            </h2>
            <p style={{ color: "#6b7280", fontSize: 13, margin: "0 0 20px" }}>
              {modalPago.nombre} · Deuda total:{" "}
              <span style={{ color: "#f87171", fontWeight: 700 }}>{fmt(modalPago.saldo_pendiente)}</span>
            </p>

            {/* Mensaje éxito */}
            {exito && (
              <div style={{ background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.3)", color: "#4ade80", fontSize: 13, padding: "10px 14px", borderRadius: 8, marginBottom: 16 }}>
                {exito}
              </div>
            )}

            {/* Saldo a favor / nota de crédito disponible */}
            {saldoFavorProv > 0 && (
              <div onClick={toggleSaldoFavor}
                style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 10, cursor: "pointer", marginBottom: 16,
                  background: usarSaldoFavor ? "rgba(34,197,94,0.1)" : "rgba(255,255,255,0.04)",
                  border: usarSaldoFavor ? "1px solid rgba(34,197,94,0.3)" : "1px solid rgba(255,255,255,0.08)" }}>
                <div style={{ width: 18, height: 18, borderRadius: 4, border: "2px solid", borderColor: usarSaldoFavor ? "#22c55e" : "#4b5563",
                  background: usarSaldoFavor ? "#22c55e" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  {usarSaldoFavor && <span style={{ color: "white", fontSize: 11, fontWeight: 900 }}>✓</span>}
                </div>
                <div>
                  <div style={{ color: "#4ade80", fontSize: 13, fontWeight: 700 }}>💰 Usar nota de crédito / saldo a favor: {fmt(saldoFavorProv)}</div>
                  {usarSaldoFavor && <div style={{ color: "#86efac", fontSize: 11, marginTop: 2 }}>
                    {comprasSeleccionadas.size > 0 ? "Cubre las compras seleccionadas; el resto lo pagás en efectivo" : "Se aplica al pago automáticamente"}
                  </div>}
                </div>
              </div>
            )}

            {/* Inputs */}
            <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 20 }}>
              <div>
                <label style={labelStyle}>
                  {comprasSeleccionadas.size > 0
                    ? `Monto a pagar (${comprasSeleccionadas.size} factura${comprasSeleccionadas.size !== 1 ? "s" : ""} seleccionada${comprasSeleccionadas.size !== 1 ? "s" : ""})`
                    : `Monto a pagar${usarSaldoFavor ? " (además del saldo a favor)" : ""}`}
                </label>
                <input
                  type="number" min="0" step="0.01"
                  value={montoPago}
                  onChange={e => { setMontoPago(e.target.value); setErrorPago(null); setExito(null); }}
                  placeholder={usarSaldoFavor ? "0 si el saldo cubre todo" : "Ej: 2000000 — o tocá las facturas abajo"}
                  style={inputStyle}
                  readOnly={comprasSeleccionadas.size > 0}
                />
              </div>
              {/* Descuento */}
              <div>
                <label style={labelStyle}>Descuento (opcional)</label>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <input type="number" min="0" max="100" step="0.01" value={descuentoPago}
                    onChange={e => cambiarDescuento(e.target.value)}
                    placeholder="0" style={{ ...inputStyle, width: 100, textAlign: "center" }} />
                  <span style={{ color: "#9ca3af", fontSize: 14, fontWeight: 700 }}>%</span>
                  {comprasSeleccionadas.size === 0 && (parseFloat(descuentoPago) || 0) > 0 && (
                    <span style={{ color: "#fbbf24", fontSize: 11 }}>Tocá las facturas a pagar para aplicar el descuento</span>
                  )}
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div>
                  <label style={labelStyle}>Método de pago</label>
                  <select value={metodoPago} onChange={e => setMetodoPago(e.target.value)}
                    style={{ width: "100%", padding: "10px 14px", background: "#1e293b", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, color: "white", fontSize: 14, outline: "none", boxSizing: "border-box" as const, cursor: "pointer" }}>
                    {METODOS_PAGO.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Nota (opcional)</label>
                  <input type="text" value={notaPago} onChange={e => setNotaPago(e.target.value)}
                    placeholder="Ej: Pago mayo" style={inputStyle} />
                </div>
              </div>
            </div>

            {/* Preview de facturas */}
            {loadingCompras ? (
              <div style={{ color: "#6b7280", fontSize: 13, textAlign: "center", padding: "16px 0" }}>Cargando facturas...</div>
            ) : comprasPendientes.length === 0 ? (
              <div style={{ color: "#4ade80", fontSize: 13, textAlign: "center", padding: "16px 0" }}>✓ Sin facturas pendientes</div>
            ) : (
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", letterSpacing: 0.5, textTransform: "uppercase" }}>
                    {comprasSeleccionadas.size > 0
                      ? `${comprasSeleccionadas.size} factura${comprasSeleccionadas.size !== 1 ? "s" : ""} seleccionada${comprasSeleccionadas.size !== 1 ? "s" : ""}`
                      : "Tocá las facturas a pagar"}
                  </div>
                  {comprasSeleccionadas.size > 0 && (
                    <button onClick={() => { setComprasSeleccionadas(new Set()); setMontoPago(""); }}
                      style={{ fontSize: 11, color: "#6b7280", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>
                      Limpiar
                    </button>
                  )}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 260, overflowY: "auto" }}>
                  {(() => {
                    const preview = calcularPreview();
                    const lista = preview.length > 0 ? preview : comprasPendientes.map(c => ({ ...c, saldo: c.total - c.total_pagado, montoDesc: 0, pago: 0, resultado: "sin_cambio" }));
                    return lista.map((c: any) => {
                      const sel = comprasSeleccionadas.has(c.id);
                      const colorMap: Record<string, { bg: string; border: string; color: string; label: string }> = {
                        pagado:    { bg: "rgba(34,197,94,0.12)",  border: "rgba(34,197,94,0.3)",  color: "#4ade80",  label: "✓ Saldada" },
                        parcial:   { bg: "rgba(251,191,36,0.12)", border: "rgba(251,191,36,0.3)", color: "#fbbf24",  label: "~ Parcial" },
                        sin_cambio:{ bg: "rgba(255,255,255,0.03)", border: "rgba(255,255,255,0.06)", color: "#6b7280", label: "" },
                      };
                      const est = colorMap[c.resultado] ?? colorMap.sin_cambio;
                      return (
                        <div key={c.id}
                          onClick={() => toggleCompra(c.id)}
                          style={{
                            display: "flex", justifyContent: "space-between", alignItems: "center",
                            padding: "9px 12px", borderRadius: 8, cursor: "pointer",
                            background: sel ? "rgba(59,130,246,0.18)" : est.bg,
                            border: `1px solid ${sel ? "rgba(59,130,246,0.5)" : est.border}`,
                            transition: "all 0.12s",
                          }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <div style={{
                              width: 18, height: 18, borderRadius: 5, flexShrink: 0,
                              border: `2px solid ${sel ? "#3b82f6" : "rgba(255,255,255,0.2)"}`,
                              background: sel ? "#3b82f6" : "transparent",
                              display: "flex", alignItems: "center", justifyContent: "center",
                            }}>
                              {sel && <span style={{ color: "white", fontSize: 11, fontWeight: 900, lineHeight: 1 }}>✓</span>}
                            </div>
                            <div>
                              <div style={{ color: "white", fontSize: 12, fontWeight: 600 }}>
                                {c.numero_remito ? `Remito ${c.numero_remito}` : `Compra #${c.id}`}
                              </div>
                              <div style={{ color: "#6b7280", fontSize: 11, marginTop: 1 }}>
                                {c.fecha?.slice(0, 10)} · Saldo: {fmt(c.saldo)}
                              </div>
                            </div>
                          </div>
                          <div style={{ textAlign: "right" }}>
                            {(c.montoDesc || 0) > 0 && (
                              <div style={{ color: "#fbbf24", fontSize: 10, fontWeight: 600 }}>desc. −{fmt(c.montoDesc)}</div>
                            )}
                            {c.pago > 0 && (
                              <div style={{ color: est.color, fontWeight: 700, fontSize: 13 }}>−{fmt(c.pago)}</div>
                            )}
                            {est.label && <div style={{ color: est.color, fontSize: 10, fontWeight: 600 }}>{est.label}</div>}
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>

                {/* Resumen del preview */}
                {(() => {
                  const seleccion = comprasSeleccionadas.size > 0;
                  const monto = parseFloat(montoPago.replace(",", ".")) || 0;
                  const saldoExtra = usarSaldoFavor ? saldoFavorProv : 0;
                  if (monto <= 0 && saldoExtra <= 0) return null;
                  const preview = calcularPreview();
                  const totalAplicado = preview.reduce((s: number, c: any) => s + c.pago, 0);
                  const totalDescuento = preview.reduce((s: number, c: any) => s + (c.montoDesc || 0), 0);
                  const creditoUsado = Math.min(saldoExtra, totalAplicado);
                  const cashReal = Math.max(0, Math.round((totalAplicado - creditoUsado) * 100) / 100);
                  const exceso = seleccion ? 0 : Math.max(0, Math.round((monto + saldoExtra - totalAplicado) * 100) / 100);
                  const saldadas = preview.filter((c: any) => c.resultado === "pagado").length;
                  const parciales = preview.filter((c: any) => c.resultado === "parcial").length;
                  return (
                    <div style={{ marginTop: 12, padding: "10px 14px", background: "rgba(255,255,255,0.04)", borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)", fontSize: 12 }}>
                      {totalDescuento > 0.01 && (
                        <div style={{ display: "flex", justifyContent: "space-between", color: "#9ca3af", marginBottom: 4 }}>
                          <span>Descuento aplicado:</span>
                          <span style={{ color: "#fbbf24", fontWeight: 700 }}>−{fmt(totalDescuento)}</span>
                        </div>
                      )}
                      {creditoUsado > 0.01 && (
                        <div style={{ display: "flex", justifyContent: "space-between", color: "#9ca3af", marginBottom: 4 }}>
                          <span>Nota de crédito / saldo a favor:</span>
                          <span style={{ color: "#4ade80", fontWeight: 700 }}>−{fmt(creditoUsado)}</span>
                        </div>
                      )}
                      {creditoUsado > 0.01 && (
                        <div style={{ display: "flex", justifyContent: "space-between", color: "#9ca3af", marginBottom: 4 }}>
                          <span>Pagás en efectivo:</span>
                          <span style={{ color: "white", fontWeight: 700 }}>{fmt(cashReal)}</span>
                        </div>
                      )}
                      <div style={{ display: "flex", justifyContent: "space-between", color: "#9ca3af", marginBottom: 4 }}>
                        <span>Facturas a saldar:</span>
                        <span style={{ color: "#4ade80", fontWeight: 700 }}>{saldadas}</span>
                      </div>
                      {parciales > 0 && (
                        <div style={{ display: "flex", justifyContent: "space-between", color: "#9ca3af", marginBottom: 4 }}>
                          <span>Facturas parciales:</span>
                          <span style={{ color: "#fbbf24", fontWeight: 700 }}>{parciales}</span>
                        </div>
                      )}
                      <div style={{ display: "flex", justifyContent: "space-between", color: "#9ca3af", marginBottom: exceso > 0 ? 4 : 0 }}>
                        <span>Total aplicado:</span>
                        <span style={{ color: "white", fontWeight: 700 }}>{fmt(totalAplicado)}</span>
                      </div>
                      {exceso > 0.01 && (
                        <div style={{ display: "flex", justifyContent: "space-between", color: "#9ca3af" }}>
                          <span>Excedente (saldo a favor):</span>
                          <span style={{ color: "#4ade80", fontWeight: 700 }}>{fmt(exceso)}</span>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}

            {errorPago && (
              <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "#f87171", fontSize: 13, padding: "10px 14px", borderRadius: 8, marginBottom: 16 }}>
                ⚠️ {errorPago}
              </div>
            )}

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={cerrarPago} style={{
                flex: 1, padding: "11px", background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10,
                color: "#9ca3af", fontSize: 13, cursor: "pointer", fontWeight: 600
              }}>Cerrar</button>
              <button
                onClick={confirmarPago}
                disabled={procesandoPago || comprasPendientes.length === 0 || (comprasSeleccionadas.size === 0 && Number(montoPago) <= 0 && (!usarSaldoFavor || saldoFavorProv <= 0))}
                style={{
                  flex: 2, padding: "11px",
                  background: "linear-gradient(135deg, #16a34a, #22c55e)",
                  border: "none", borderRadius: 10, color: "white",
                  fontSize: 13, fontWeight: 700, cursor: "pointer",
                  opacity: procesandoPago || (comprasSeleccionadas.size === 0 && (parseFloat(montoPago.replace(",", ".")) || 0) <= 0 && !(usarSaldoFavor && saldoFavorProv > 0)) ? 0.5 : 1,
                }}>
                {procesandoPago ? "Procesando..." : "Confirmar pago"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal nota de crédito / devolución */}
      {modalNC && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 }}
          onClick={() => setModalNC(null)}>
          <div style={{
            background: "#0f172a", border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 20, padding: "32px 28px", width: "100%", maxWidth: 440,
            boxShadow: "0 24px 64px rgba(0,0,0,0.6)"
          }} onClick={e => e.stopPropagation()}>
            <h2 style={{ color: "white", fontSize: 18, fontWeight: 700, margin: "0 0 4px" }}>
              ↩️ Nota de crédito / devolución
            </h2>
            <p style={{ color: "#6b7280", fontSize: 13, margin: "0 0 20px" }}>
              {modalNC.nombre}
            </p>

            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Monto de la devolución *</label>
              <input
                type="number" min="0" step="0.01"
                value={ncMonto}
                onChange={e => { setNcMonto(e.target.value); setErrorNC(null); }}
                placeholder="Ej: 150000"
                style={inputStyle}
                autoFocus
              />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>Motivo (opcional)</label>
              <input type="text" value={ncMotivo} onChange={e => setNcMotivo(e.target.value)}
                placeholder="Ej: devolución mercadería vencida" style={inputStyle} />
            </div>

            <div style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 10, padding: "10px 14px", marginBottom: 20, fontSize: 12, color: "#86efac" }}>
              💡 Se guardará como <b>saldo a favor</b> de este proveedor. Después lo aplicás a las compras que elijas desde el botón 💳 Pagar.
            </div>

            {errorNC && (
              <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "#f87171", fontSize: 13, padding: "10px 14px", borderRadius: 8, marginBottom: 16 }}>
                ⚠️ {errorNC}
              </div>
            )}

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setModalNC(null)} style={{
                flex: 1, padding: "11px", background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10,
                color: "#9ca3af", fontSize: 13, cursor: "pointer", fontWeight: 600
              }}>Cancelar</button>
              <button onClick={guardarNC} disabled={guardandoNC || (parseFloat(ncMonto) || 0) <= 0} style={{
                flex: 2, padding: "11px",
                background: "linear-gradient(135deg, #16a34a, #22c55e)",
                border: "none", borderRadius: 10, color: "white",
                fontSize: 13, fontWeight: 700, cursor: "pointer",
                opacity: guardandoNC || (parseFloat(ncMonto) || 0) <= 0 ? 0.5 : 1,
              }}>
                {guardandoNC ? "Guardando..." : "Registrar nota de crédito"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal confirmar eliminar */}
      {confirmEliminar && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 }}
          onClick={() => { setConfirmEliminar(null); setErrorEliminar(null); }}>
          <div style={{
            background: "#0f172a", border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 20, padding: "36px 32px", width: "100%", maxWidth: 380,
            boxShadow: "0 24px 64px rgba(0,0,0,0.6)"
          }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🗑️</div>
            <h2 style={{ color: "white", fontSize: 18, fontWeight: 700, margin: "0 0 8px" }}>¿Eliminar proveedor?</h2>
            <p style={{ color: "#9ca3af", fontSize: 13, marginBottom: 16 }}>
              Vas a eliminar a <span style={{ color: "white", fontWeight: 600 }}>{confirmEliminar.nombre}</span>. Esta acción no se puede deshacer.
            </p>
            {errorEliminar && (
              <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "#f87171", fontSize: 12, padding: "10px 14px", borderRadius: 8, marginBottom: 16 }}>
                ⚠️ {errorEliminar}
              </div>
            )}
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => { setConfirmEliminar(null); setErrorEliminar(null); }} style={{
                flex: 1, padding: "11px", background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10,
                color: "#9ca3af", fontSize: 13, cursor: "pointer", fontWeight: 600
              }}>Cancelar</button>
              <button onClick={() => eliminar(confirmEliminar)} style={{
                flex: 1, padding: "11px", background: "#dc2626",
                border: "none", borderRadius: 10, color: "white",
                fontSize: 13, fontWeight: 700, cursor: "pointer"
              }}>Eliminar</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal historial de pagos ── */}
      {modalHistorial && (() => {
        // ── Filtrado ──────────────────────────────────────────────────────────
        const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
        const inicioSemana = new Date(hoy); inicioSemana.setDate(hoy.getDate() - hoy.getDay());
        const inicioMes    = new Date(hoy.getFullYear(), hoy.getMonth(), 1);

        const pagosFiltrados = historialPagos.filter(pg => {
          const fecha = new Date(pg.fecha);
          if (filtroFechaHist === "hoy"    && fecha < hoy)         return false;
          if (filtroFechaHist === "semana" && fecha < inicioSemana) return false;
          if (filtroFechaHist === "mes"    && fecha < inicioMes)    return false;
          if (filtroMetodoHist !== "todos" && pg.metodo_pago !== filtroMetodoHist) return false;
          return true;
        });

        // ── Agrupar por día ───────────────────────────────────────────────────
        const grupos: Record<string, { fecha: string; pagos: any[]; total: number }> = {};
        pagosFiltrados.forEach(pg => {
          const dia = new Date(pg.fecha).toLocaleDateString("es-AR");
          if (!grupos[dia]) grupos[dia] = { fecha: dia, pagos: [], total: 0 };
          grupos[dia].pagos.push(pg);
          grupos[dia].total += Number(pg.monto);
        });
        const dias = Object.values(grupos); // ya ordenados desc porque historialPagos viene ordenado

        // ── Métodos únicos presentes ──────────────────────────────────────────
        const metodosPresentes = Array.from(new Set(historialPagos.map(p => p.metodo_pago).filter(Boolean)));

        const colorMetodo = (m: string) => ({
          bg:    m === "Transferencia" ? "rgba(96,165,250,0.15)"  : m === "Efectivo" ? "rgba(74,222,128,0.15)"  : m === "Cheque" ? "rgba(251,191,36,0.15)"  : "rgba(156,163,175,0.15)",
          color: m === "Transferencia" ? "#60a5fa"                : m === "Efectivo" ? "#4ade80"                : m === "Cheque" ? "#fbbf24"                : "#9ca3af",
        });

        const totalFiltrado = pagosFiltrados.reduce((s, p) => s + Number(p.monto), 0);

        return (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 }}
            onClick={() => setModalHistorial(null)}>
            <div style={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: "28px 28px", width: "100%", maxWidth: 700, maxHeight: "88vh", display: "flex", flexDirection: "column", boxShadow: "0 24px 64px rgba(0,0,0,0.6)" }}
              onClick={e => e.stopPropagation()}>

              {/* Header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                <div>
                  <h2 style={{ color: "white", margin: 0, fontSize: 18, fontWeight: 700 }}>📋 Historial de pagos</h2>
                  <p style={{ color: "#6b7280", margin: "4px 0 0", fontSize: 13 }}>{modalHistorial.nombre}</p>
                </div>
                <button onClick={() => setModalHistorial(null)}
                  style={{ background: "rgba(255,255,255,0.08)", border: "none", color: "white", borderRadius: 8, padding: "6px 14px", cursor: "pointer", fontSize: 16 }}>✕</button>
              </div>

              {loadingHistorial ? (
                <div style={{ textAlign: "center", padding: 40, color: "#6b7280" }}>Cargando pagos…</div>
              ) : historialPagos.length === 0 ? (
                <div style={{ textAlign: "center", padding: 40, color: "#6b7280" }}>
                  <div style={{ fontSize: 36, marginBottom: 10 }}>💳</div>
                  <div style={{ fontWeight: 600 }}>No hay pagos registrados para este proveedor</div>
                </div>
              ) : (
                <>
                  {/* ── Filtros ── */}
                  <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
                    {/* Período */}
                    <div style={{ display: "flex", gap: 4, background: "rgba(255,255,255,0.04)", borderRadius: 10, padding: 4, border: "1px solid rgba(255,255,255,0.08)" }}>
                      {(["hoy","semana","mes","todo"] as const).map(op => {
                        const labels = { hoy: "Hoy", semana: "Esta semana", mes: "Este mes", todo: "Todo" };
                        const active = filtroFechaHist === op;
                        return (
                          <button key={op} onClick={() => setFiltroFechaHist(op)} style={{
                            padding: "5px 12px", borderRadius: 7, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600,
                            background: active ? "#2563eb" : "transparent",
                            color: active ? "white" : "#9ca3af",
                            transition: "all 0.15s",
                          }}>{labels[op]}</button>
                        );
                      })}
                    </div>
                    {/* Método */}
                    {metodosPresentes.length > 1 && (
                      <div style={{ display: "flex", gap: 4, background: "rgba(255,255,255,0.04)", borderRadius: 10, padding: 4, border: "1px solid rgba(255,255,255,0.08)" }}>
                        <button onClick={() => setFiltroMetodoHist("todos")} style={{
                          padding: "5px 12px", borderRadius: 7, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600,
                          background: filtroMetodoHist === "todos" ? "#374151" : "transparent",
                          color: filtroMetodoHist === "todos" ? "white" : "#9ca3af",
                        }}>Todos</button>
                        {metodosPresentes.map(m => {
                          const active = filtroMetodoHist === m;
                          const cm = colorMetodo(m);
                          return (
                            <button key={m} onClick={() => setFiltroMetodoHist(m)} style={{
                              padding: "5px 12px", borderRadius: 7, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600,
                              background: active ? cm.bg : "transparent",
                              color: active ? cm.color : "#9ca3af",
                            }}>{m}</button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* ── Chips resumen del período filtrado ── */}
                  <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
                    <div style={{ background: "rgba(255,255,255,0.05)", borderRadius: 10, padding: "10px 18px", border: "1px solid rgba(255,255,255,0.08)" }}>
                      <div style={{ fontSize: 11, color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 }}>
                        {filtroFechaHist === "todo" ? "Total histórico" : filtroFechaHist === "hoy" ? "Pagado hoy" : filtroFechaHist === "semana" ? "Esta semana" : "Este mes"}
                        {filtroMetodoHist !== "todos" ? ` · ${filtroMetodoHist}` : ""}
                      </div>
                      <div style={{ fontSize: 20, fontWeight: 800, color: "#4ade80" }}>{fmt(totalFiltrado)}</div>
                    </div>
                    <div style={{ background: "rgba(255,255,255,0.05)", borderRadius: 10, padding: "10px 18px", border: "1px solid rgba(255,255,255,0.08)" }}>
                      <div style={{ fontSize: 11, color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 }}>Transacciones</div>
                      <div style={{ fontSize: 20, fontWeight: 800, color: "white" }}>{pagosFiltrados.length}</div>
                    </div>
                    {/* Subtotal por método en el período */}
                    {filtroMetodoHist === "todos" && metodosPresentes.map(m => {
                      const subtotal = pagosFiltrados.filter(p => p.metodo_pago === m).reduce((s, p) => s + Number(p.monto), 0);
                      if (subtotal === 0) return null;
                      const cm = colorMetodo(m);
                      return (
                        <div key={m} style={{ background: cm.bg, borderRadius: 10, padding: "10px 18px", border: `1px solid ${cm.color}33` }}>
                          <div style={{ fontSize: 11, color: cm.color, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2, opacity: 0.8 }}>{m}</div>
                          <div style={{ fontSize: 20, fontWeight: 800, color: cm.color }}>{fmt(subtotal)}</div>
                        </div>
                      );
                    })}
                  </div>

                  {/* ── Tabla agrupada por día ── */}
                  {pagosFiltrados.length === 0 ? (
                    <div style={{ textAlign: "center", padding: 30, color: "#6b7280", fontSize: 13 }}>
                      Sin pagos en este período
                    </div>
                  ) : (
                    <div style={{ overflowY: "auto", flex: 1 }}>
                      {dias.map(grupo => (
                        <div key={grupo.fecha} style={{ marginBottom: 18 }}>
                          {/* Cabecera del día */}
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 12px", background: "rgba(255,255,255,0.06)", borderRadius: 8, marginBottom: 4 }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: "#d1d5db" }}>📅 {grupo.fecha}</span>
                            <span style={{ fontSize: 13, fontWeight: 800, color: "#4ade80" }}>Total del día: {fmt(grupo.total)}</span>
                          </div>
                          {/* Filas del día */}
                          <table style={{ width: "100%", borderCollapse: "collapse" }}>
                            <thead>
                              <tr>
                                {["Compra / Remito", "Monto", "Método", "Notas"].map((h, i) => (
                                  <th key={i} style={{ padding: "6px 12px", fontSize: 10, fontWeight: 700, color: "#4b5563", textAlign: i === 1 ? "right" : "left", textTransform: "uppercase", letterSpacing: 0.4 }}>{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {grupo.pagos.map((pg, i) => (
                                <tr key={pg.id} style={{ borderTop: "1px solid rgba(255,255,255,0.05)", background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.015)" }}>
                                  <td style={{ padding: "9px 12px", fontSize: 13 }}>
                                    <div style={{ color: "#93c5fd", fontWeight: 600 }}>Compra #{pg.compra?.id}</div>
                                    {pg.compra?.numero_remito && <div style={{ fontSize: 11, color: "#6b7280" }}>Remito: {pg.compra.numero_remito}</div>}
                                    <div style={{ fontSize: 11, color: "#6b7280" }}>Total compra: {fmt(Number(pg.compra?.total || 0))}</div>
                                  </td>
                                  <td style={{ padding: "9px 12px", textAlign: "right", fontWeight: 800, fontSize: 14, color: "#4ade80", whiteSpace: "nowrap" }}>
                                    {fmt(Number(pg.monto))}
                                  </td>
                                  <td style={{ padding: "9px 12px" }}>
                                    {pg.metodo_pago ? (
                                      <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 20, background: colorMetodo(pg.metodo_pago).bg, color: colorMetodo(pg.metodo_pago).color }}>
                                        {pg.metodo_pago}
                                      </span>
                                    ) : <span style={{ color: "#4b5563", fontSize: 12 }}>—</span>}
                                  </td>
                                  <td style={{ padding: "9px 12px", color: "#9ca3af", fontSize: 12 }}>{pg.notas || "—"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}