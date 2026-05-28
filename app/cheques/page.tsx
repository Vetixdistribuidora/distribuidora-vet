"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "../../lib/supabase";

interface Cheque {
  id: number;
  dueno: string | null;
  numero: string;
  tipo: string;
  fecha: string | null;
  banco: string | null;
  quien_entrego: string | null;
  monto_egresado: number;
  monto_ingresado: number;
  entregada_a: string | null;
  pagado: boolean;
  rechazado: boolean;
  notas: string | null;
  created_at: string;
}

const TIPO_LABELS: Record<string, string> = { CH: "CH", ECHEQ: "ECHEQ" };
const BANCOS_COMUNES = [
  "NACION ARG", "GALICIA", "SANTANDER", "ICBC", "MACRO",
  "SUPERVIELLE", "CREDICOOP", "BCO PROVINCIA", "BCO ENTRE RIOS", "BNA",
];
const EMPTY_FORM = {
  dueno: "", numero: "", tipo: "CH", fecha: "",
  banco: "", quien_entrego: "", monto_egresado: "",
  monto_ingresado: "", entregada_a: "", notas: "",
};

function fmt(n: number) {
  return n.toLocaleString("es-AR", { style: "currency", currency: "ARS" });
}

// Color determinista para chips de "Entregada a"
function chipColor(name: string) {
  const palette = [
    { bg: "#dcfce7", color: "#15803d", border: "#bbf7d0" },
    { bg: "#dbeafe", color: "#1d4ed8", border: "#bfdbfe" },
    { bg: "#fef9c3", color: "#a16207", border: "#fde68a" },
    { bg: "#fce7f3", color: "#be185d", border: "#fbcfe8" },
    { bg: "#ede9fe", color: "#6d28d9", border: "#ddd6fe" },
    { bg: "#ffedd5", color: "#c2410c", border: "#fed7aa" },
    { bg: "#e0f2fe", color: "#0369a1", border: "#bae6fd" },
    { bg: "#f0fdf4", color: "#166534", border: "#bbf7d0" },
  ];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff;
  return palette[h % palette.length];
}

const responsiveStyles = `
  @media (max-width: 768px) {
    .ch-header { flex-direction: column !important; gap: 10px !important; }
    .ch-filters { flex-wrap: wrap !important; }
    .ch-modal-inner { padding: 20px 16px !important; max-height: 95vh !important; }
    .ch-modal-grid { grid-template-columns: 1fr !important; }
    .ch-cards { gap: 8px !important; }
    .ch-card { min-width: 110px !important; padding: 10px 14px !important; }
  }
`;

const inputLight: React.CSSProperties = {
  width: "100%", padding: "10px 14px",
  border: "1px solid #e2e8f0", borderRadius: 10,
  fontSize: 14, color: "#111827", outline: "none",
  boxSizing: "border-box", background: "white",
};
const labelStyle: React.CSSProperties = {
  display: "block", fontSize: 11, fontWeight: 700,
  color: "#6b7280", letterSpacing: 0.5, marginBottom: 5, textTransform: "uppercase",
};

export default function ChequesPage() {
  const [cheques,        setCheques]        = useState<Cheque[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [busqueda,       setBusqueda]       = useState("");
  const [filtroTipo,     setFiltroTipo]     = useState("todos");
  const [filtroEstado,   setFiltroEstado]   = useState("todos");
  const [filtroBanco,    setFiltroBanco]    = useState("todos");
  const [modalAbierto,   setModalAbierto]   = useState(false);
  const [editando,       setEditando]       = useState<Cheque | null>(null);
  const [form,           setForm]           = useState(EMPTY_FORM);
  const [guardando,      setGuardando]      = useState(false);
  const [errorForm,      setErrorForm]      = useState<string | null>(null);
  const [confirmElim,    setConfirmElim]    = useState<Cheque | null>(null);
  const [toast,          setToast]          = useState<{ msg: string; ok: boolean } | null>(null);

  useEffect(() => { cargar(); }, []);

  function mostrarToast(msg: string, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  }

  async function cargar() {
    setLoading(true);
    const { data, error } = await supabase
      .from("cheques")
      .select("*")
      .order("fecha", { ascending: false })
      .order("created_at", { ascending: false });
    if (!error && data) setCheques(data);
    setLoading(false);
  }

  // ── Filtrado ──────────────────────────────────────────────────────────────
  const chequesFiltrados = useMemo(() => {
    return cheques.filter(c => {
      if (filtroTipo !== "todos" && c.tipo !== filtroTipo) return false;
      if (filtroBanco !== "todos" && c.banco !== filtroBanco) return false;
      if (filtroEstado === "pendiente" && (c.pagado || c.rechazado)) return false;
      if (filtroEstado === "pagado"    && (!c.pagado || c.rechazado)) return false;
      if (filtroEstado === "rechazado" && !c.rechazado) return false;
      if (busqueda.trim()) {
        const q = busqueda.toLowerCase();
        const campo = [c.dueno, c.numero, c.banco, c.quien_entrego, c.entregada_a, c.notas]
          .filter(Boolean).join(" ").toLowerCase();
        if (!campo.includes(q)) return false;
      }
      return true;
    });
  }, [cheques, filtroTipo, filtroEstado, filtroBanco, busqueda]);

  // ── Saldo acumulado (sobre TODOS los cheques, ordenados por fecha ASC) ────
  const saldoMap = useMemo(() => {
    const sorted = [...cheques].sort((a, b) => {
      if (!a.fecha && !b.fecha) return 0;
      if (!a.fecha) return 1;
      if (!b.fecha) return -1;
      return a.fecha.localeCompare(b.fecha);
    });
    const map: Record<number, number> = {};
    let acum = 0;
    sorted.forEach(c => {
      acum += (Number(c.monto_ingresado) || 0) - (Number(c.monto_egresado) || 0);
      map[c.id] = Math.round(acum * 100) / 100;
    });
    return map;
  }, [cheques]);

  // ── Bancos únicos ─────────────────────────────────────────────────────────
  const bancosUnicos = useMemo(
    () => Array.from(new Set(cheques.map(c => c.banco).filter(Boolean))).sort() as string[],
    [cheques]
  );

  // ── Totales ───────────────────────────────────────────────────────────────
  const totalIng  = cheques.reduce((s, c) => s + Number(c.monto_ingresado), 0);
  const totalEgr  = cheques.reduce((s, c) => s + Number(c.monto_egresado),  0);
  const saldoNeto = totalIng - totalEgr;
  const pendientes   = cheques.filter(c => !c.pagado && !c.rechazado).length;
  const rechazadosCt = cheques.filter(c => c.rechazado).length;

  // Totales de la vista filtrada
  const filtIng = chequesFiltrados.reduce((s, c) => s + Number(c.monto_ingresado), 0);
  const filtEgr = chequesFiltrados.reduce((s, c) => s + Number(c.monto_egresado),  0);

  // ── CRUD ──────────────────────────────────────────────────────────────────
  function abrirCrear() {
    setEditando(null);
    setForm({ ...EMPTY_FORM, fecha: new Date().toISOString().slice(0, 10) });
    setErrorForm(null);
    setModalAbierto(true);
  }

  function abrirEditar(c: Cheque) {
    setEditando(c);
    setForm({
      dueno: c.dueno || "", numero: c.numero, tipo: c.tipo,
      fecha: c.fecha || "", banco: c.banco || "",
      quien_entrego: c.quien_entrego || "",
      monto_egresado:  c.monto_egresado  ? String(c.monto_egresado)  : "",
      monto_ingresado: c.monto_ingresado ? String(c.monto_ingresado) : "",
      entregada_a: c.entregada_a || "", notas: c.notas || "",
    });
    setErrorForm(null);
    setModalAbierto(true);
  }

  async function guardar() {
    if (!form.numero.trim()) { setErrorForm("El número es obligatorio."); return; }
    setGuardando(true); setErrorForm(null);
    const payload = {
      dueno:           form.dueno.trim() || null,
      numero:          form.numero.trim(),
      tipo:            form.tipo,
      fecha:           form.fecha || null,
      banco:           form.banco.trim() || null,
      quien_entrego:   form.quien_entrego.trim() || null,
      monto_egresado:  parseFloat(form.monto_egresado.replace(",", "."))  || 0,
      monto_ingresado: parseFloat(form.monto_ingresado.replace(",", ".")) || 0,
      entregada_a:     form.entregada_a.trim() || null,
      notas:           form.notas.trim() || null,
    };
    try {
      if (editando) {
        const { error } = await supabase.from("cheques").update(payload).eq("id", editando.id);
        if (error) { setErrorForm("Error: " + error.message); return; }
        setCheques(prev => prev.map(c => c.id === editando.id ? { ...c, ...payload } : c));
        mostrarToast("Cheque actualizado ✓");
      } else {
        const { data, error } = await supabase.from("cheques").insert([payload]).select().single();
        if (error) { setErrorForm("Error: " + error.message); return; }
        if (data) setCheques(prev => [data, ...prev]);
        mostrarToast("Cheque registrado ✓");
      }
      setModalAbierto(false);
    } finally {
      setGuardando(false);
    }
  }

  async function togglePagado(c: Cheque) {
    const nuevo = !c.pagado;
    const { error } = await supabase.from("cheques")
      .update({ pagado: nuevo, ...(nuevo ? { rechazado: false } : {}) })
      .eq("id", c.id);
    if (!error) setCheques(prev => prev.map(x =>
      x.id === c.id ? { ...x, pagado: nuevo, rechazado: nuevo ? false : x.rechazado } : x
    ));
  }

  async function toggleRechazado(c: Cheque) {
    const nuevo = !c.rechazado;
    const { error } = await supabase.from("cheques")
      .update({ rechazado: nuevo, ...(nuevo ? { pagado: false } : {}) })
      .eq("id", c.id);
    if (!error) setCheques(prev => prev.map(x =>
      x.id === c.id ? { ...x, rechazado: nuevo, pagado: nuevo ? false : x.pagado } : x
    ));
  }

  async function eliminar(c: Cheque) {
    const { error } = await supabase.from("cheques").delete().eq("id", c.id);
    if (!error) {
      setCheques(prev => prev.filter(x => x.id !== c.id));
      setConfirmElim(null);
      mostrarToast("Cheque eliminado");
    }
  }

  function rowBg(c: Cheque, i: number): string {
    if (c.rechazado)        return i % 2 === 0 ? "#fff1f1" : "#fff5f5";
    if (c.pagado)           return i % 2 === 0 ? "#f0fdf4" : "#f7fef9";
    if (c.tipo === "ECHEQ") return i % 2 === 0 ? "#fffbeb" : "#fefce8";
    return i % 2 === 0 ? "white" : "#fafafa";
  }

  // ── Tipo chip style ───────────────────────────────────────────────────────
  function tipoStyle(tipo: string) {
    if (tipo === "ECHEQ") return { bg: "#fef3c7", color: "#d97706", border: "#fde68a" };
    return { bg: "#f1f5f9", color: "#475569", border: "#e2e8f0" };
  }

  return (
    <div>
      <style>{responsiveStyles}</style>

      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", top: 20, right: 20, zIndex: 200,
          background: toast.ok ? "#16a34a" : "#dc2626",
          color: "white", padding: "12px 20px", borderRadius: 10,
          fontSize: 14, fontWeight: 600, boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
          transition: "all 0.2s",
        }}>{toast.msg}</div>
      )}

      {/* Header */}
      <div className="ch-header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <p style={{ fontSize: 13, color: "#6b7280", margin: 0 }}>
          <span style={{ fontWeight: 700, color: "#374151" }}>{cheques.length}</span> cheques registrados
          {rechazadosCt > 0 && (
            <span style={{ marginLeft: 10, color: "#dc2626", fontWeight: 700 }}>
              · {rechazadosCt} rechazado{rechazadosCt !== 1 ? "s" : ""}
            </span>
          )}
        </p>
        <button onClick={abrirCrear} style={{
          background: "linear-gradient(135deg, #2563eb, #3b82f6)", color: "white",
          border: "none", borderRadius: 10, padding: "10px 18px",
          fontSize: 13, fontWeight: 700, cursor: "pointer",
          boxShadow: "0 2px 8px rgba(59,130,246,0.3)",
        }}>+ Nuevo cheque</button>
      </div>

      {/* Summary cards */}
      <div className="ch-cards" style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
        {[
          { label: "Total ingresado", value: fmt(totalIng),  color: "#15803d", bg: "#f0fdf4", border: "#bbf7d0" },
          { label: "Total egresado",  value: fmt(totalEgr),  color: "#dc2626", bg: "#fef2f2", border: "#fecaca" },
          { label: "Saldo neto",      value: fmt(saldoNeto), color: saldoNeto >= 0 ? "#1d4ed8" : "#dc2626", bg: "#eff6ff", border: "#bfdbfe" },
          { label: "Pendientes",      value: String(pendientes),   color: "#d97706", bg: "#fffbeb", border: "#fde68a" },
          { label: "Rechazados",      value: String(rechazadosCt), color: "#dc2626", bg: "#fef2f2", border: "#fecaca" },
        ].map(s => (
          <div key={s.label} className="ch-card" style={{
            background: s.bg, border: `1px solid ${s.border}`,
            borderRadius: 12, padding: "12px 18px", minWidth: 130,
          }}>
            <div style={{ fontSize: 10, color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 3 }}>{s.label}</div>
            <div style={{ fontSize: 17, fontWeight: 800, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Leyenda de colores */}
      <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        {[
          { label: "CH (físico)",   bg: "white",   border: "#e2e8f0", color: "#475569" },
          { label: "ECHEQ",         bg: "#fffbeb",  border: "#fde68a", color: "#d97706" },
          { label: "Pagado",        bg: "#f0fdf4",  border: "#bbf7d0", color: "#15803d" },
          { label: "Rechazado",     bg: "#fef2f2",  border: "#fecaca", color: "#dc2626" },
        ].map(l => (
          <span key={l.label} style={{
            fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 20,
            background: l.bg, border: `1px solid ${l.border}`, color: l.color,
          }}>{l.label}</span>
        ))}
      </div>

      {/* Filtros */}
      <div className="ch-filters" style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
        <input
          type="text" placeholder="🔍 Buscar número, dueño, banco, quién entregó..."
          value={busqueda} onChange={e => setBusqueda(e.target.value)}
          style={{ ...inputLight, flex: 1, minWidth: 220, width: "auto" }}
        />

        {/* Tipo */}
        <div style={{ display: "flex", gap: 3, background: "#f1f5f9", borderRadius: 10, padding: 3, border: "1px solid #e2e8f0" }}>
          {["todos", "CH", "ECHEQ"].map(t => {
            const labels: Record<string, string> = { todos: "Todos", CH: "CH", ECHEQ: "ECHEQ" };
            const active = filtroTipo === t;
            return (
              <button key={t} onClick={() => setFiltroTipo(t)} style={{
                padding: "5px 11px", borderRadius: 7, border: "none", cursor: "pointer",
                fontSize: 12, fontWeight: 600,
                background: active ? "white" : "transparent",
                color: active ? "#1d4ed8" : "#6b7280",
                boxShadow: active ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
              }}>{labels[t]}</button>
            );
          })}
        </div>

        {/* Estado */}
        <div style={{ display: "flex", gap: 3, background: "#f1f5f9", borderRadius: 10, padding: 3, border: "1px solid #e2e8f0" }}>
          {[
            { v: "todos",     l: "Todos",     c: "#1d4ed8" },
            { v: "pendiente", l: "Pendiente", c: "#d97706" },
            { v: "pagado",    l: "Pagado",    c: "#15803d" },
            { v: "rechazado", l: "Rechazado", c: "#dc2626" },
          ].map(({ v, l, c }) => {
            const active = filtroEstado === v;
            return (
              <button key={v} onClick={() => setFiltroEstado(v)} style={{
                padding: "5px 11px", borderRadius: 7, border: "none", cursor: "pointer",
                fontSize: 12, fontWeight: 600,
                background: active ? "white" : "transparent",
                color: active ? c : "#6b7280",
                boxShadow: active ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
              }}>{l}</button>
            );
          })}
        </div>

        {/* Banco */}
        {bancosUnicos.length > 0 && (
          <select value={filtroBanco} onChange={e => setFiltroBanco(e.target.value)}
            style={{ ...inputLight, width: "auto", padding: "8px 12px", cursor: "pointer" }}>
            <option value="todos">Todos los bancos</option>
            {bancosUnicos.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
        )}
      </div>

      {/* Resumen vista filtrada */}
      {(busqueda || filtroTipo !== "todos" || filtroEstado !== "todos" || filtroBanco !== "todos") && (
        <div style={{ display: "flex", gap: 10, marginBottom: 10, fontSize: 12, color: "#6b7280", flexWrap: "wrap", alignItems: "center" }}>
          <span>{chequesFiltrados.length} de {cheques.length} cheques</span>
          {filtIng > 0 && <span style={{ color: "#15803d", fontWeight: 700 }}>↑ Ing: {fmt(filtIng)}</span>}
          {filtEgr > 0 && <span style={{ color: "#dc2626", fontWeight: 700 }}>↓ Egr: {fmt(filtEgr)}</span>}
        </div>
      )}

      {/* Tabla */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 50, color: "#94a3b8" }}>Cargando...</div>
      ) : chequesFiltrados.length === 0 ? (
        <div style={{ textAlign: "center", padding: 50, color: "#94a3b8" }}>
          {cheques.length === 0
            ? "No hay cheques registrados todavía."
            : "No hay cheques que coincidan con los filtros."}
        </div>
      ) : (
        <div style={{
          background: "white", borderRadius: 14, border: "1px solid #e2e8f0",
          overflowX: "auto", boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
        }}>
          <div>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 920 }}>
              <thead>
                <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0" }}>
                  {[
                    { h: "Dueño",        right: false },
                    { h: "N° / Tipo",    right: false },
                    { h: "Fecha",        right: false },
                    { h: "Banco",        right: false },
                    { h: "Quién entregó",right: false },
                    { h: "Egresado",     right: true  },
                    { h: "Ingresado",    right: true  },
                    { h: "Saldo",        right: true  },
                    { h: "Entregada a",  right: false },
                    { h: "Acciones",     right: false },
                  ].map((col, i) => (
                    <th key={i} style={{
                      padding: "8px 10px", fontSize: 10, fontWeight: 700, color: "#9ca3af",
                      textAlign: col.right ? "right" : "left",
                      whiteSpace: "nowrap", textTransform: "uppercase", letterSpacing: 0.4,
                    }}>{col.h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {chequesFiltrados.map((c, i) => {
                  const ts = tipoStyle(c.tipo);
                  return (
                    <tr key={c.id} style={{ borderBottom: "1px solid #f1f5f9", background: rowBg(c, i) }}>

                      {/* Dueño */}
                      <td style={{ padding: "7px 10px", fontSize: 11, color: "#374151", maxWidth: 120, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {c.dueno || <span style={{ color: "#d1d5db" }}>—</span>}
                      </td>

                      {/* Número + tipo */}
                      <td style={{ padding: "7px 10px", whiteSpace: "nowrap" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                          <span style={{
                            fontSize: 9, fontWeight: 800, padding: "1px 5px", borderRadius: 4,
                            background: ts.bg, color: ts.color, border: `1px solid ${ts.border}`,
                            letterSpacing: 0.2, flexShrink: 0,
                          }}>{TIPO_LABELS[c.tipo] || c.tipo}</span>
                          <span style={{ fontSize: 12, fontWeight: 600, color: "#111827" }}>{c.numero}</span>
                        </div>
                      </td>

                      {/* Fecha */}
                      <td style={{ padding: "7px 10px", fontSize: 12, color: "#4b5563", whiteSpace: "nowrap" }}>
                        {c.fecha ? new Date(c.fecha + "T12:00:00").toLocaleDateString("es-AR") : "—"}
                      </td>

                      {/* Banco */}
                      <td style={{ padding: "7px 10px", fontSize: 11, color: "#374151", whiteSpace: "nowrap", maxWidth: 100, overflow: "hidden", textOverflow: "ellipsis" }}>{c.banco || "—"}</td>

                      {/* Quien entregó */}
                      <td style={{ padding: "7px 10px", fontSize: 11, color: "#374151", maxWidth: 130, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {c.quien_entrego || "—"}
                      </td>

                      {/* Egresado */}
                      <td style={{ padding: "7px 10px", textAlign: "right", fontWeight: 700, fontSize: 12, color: Number(c.monto_egresado) > 0 ? "#dc2626" : "#d1d5db", whiteSpace: "nowrap" }}>
                        {Number(c.monto_egresado) > 0 ? fmt(Number(c.monto_egresado)) : "—"}
                      </td>

                      {/* Ingresado */}
                      <td style={{ padding: "7px 10px", textAlign: "right", fontWeight: 700, fontSize: 12, color: Number(c.monto_ingresado) > 0 ? "#15803d" : "#d1d5db", whiteSpace: "nowrap" }}>
                        {Number(c.monto_ingresado) > 0 ? fmt(Number(c.monto_ingresado)) : "—"}
                      </td>

                      {/* Saldo acumulado */}
                      <td style={{ padding: "7px 10px", textAlign: "right", fontSize: 12, fontWeight: 800, whiteSpace: "nowrap", color: (saldoMap[c.id] ?? 0) >= 0 ? "#1d4ed8" : "#dc2626" }}>
                        {fmt(saldoMap[c.id] ?? 0)}
                      </td>

                      {/* Entregada a */}
                      <td style={{ padding: "7px 10px" }}>
                        {c.entregada_a ? (() => {
                          const cm = chipColor(c.entregada_a);
                          return (
                            <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: cm.bg, color: cm.color, border: `1px solid ${cm.border}`, whiteSpace: "nowrap" }}>
                              {c.entregada_a}
                            </span>
                          );
                        })() : <span style={{ color: "#d1d5db", fontSize: 11 }}>—</span>}
                      </td>

                      {/* Acciones: pagado + rechazar + editar + eliminar en una sola columna compacta */}
                      <td style={{ padding: "7px 10px", whiteSpace: "nowrap" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          {/* Toggle pagado */}
                          <button
                            onClick={() => togglePagado(c)}
                            title={c.pagado ? "Quitar pagado" : "Marcar como pagado"}
                            style={{
                              width: 24, height: 24, borderRadius: 6, border: "2px solid",
                              borderColor: c.pagado ? "#16a34a" : "#d1d5db",
                              background: c.pagado ? "#16a34a" : "white",
                              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                              fontSize: 12, color: "white", flexShrink: 0, transition: "all 0.15s",
                            }}
                          >{c.pagado ? "✓" : ""}</button>

                          {/* Estado badge mini */}
                          <span style={{
                            fontSize: 10, fontWeight: 700, minWidth: 52,
                            color: c.rechazado ? "#dc2626" : c.pagado ? "#15803d" : "#d97706",
                          }}>
                            {c.rechazado ? "Rechazado" : c.pagado ? "Pagado" : "Pendiente"}
                          </span>

                          {/* Separador */}
                          <span style={{ color: "#e2e8f0", fontSize: 14 }}>│</span>

                          {/* Rechazar / Reactivar — solo icono */}
                          <button
                            onClick={() => toggleRechazado(c)}
                            title={c.rechazado ? "Reactivar cheque" : "Marcar como rechazado"}
                            style={{
                              width: 24, height: 24, borderRadius: 6, border: "1px solid",
                              borderColor: c.rechazado ? "#fecaca" : "#e2e8f0",
                              background: c.rechazado ? "#fef2f2" : "#f8fafc",
                              color: c.rechazado ? "#dc2626" : "#9ca3af",
                              fontSize: 12, fontWeight: 700, cursor: "pointer",
                              display: "flex", alignItems: "center", justifyContent: "center",
                            }}
                          >{c.rechazado ? "↺" : "✕"}</button>

                          {/* Editar */}
                          <button onClick={() => abrirEditar(c)} title="Editar" style={{
                            width: 24, height: 24, borderRadius: 6, border: "1px solid #e2e8f0",
                            background: "#f8fafc", color: "#374151", fontSize: 12, cursor: "pointer",
                            display: "flex", alignItems: "center", justifyContent: "center",
                          }}>✏️</button>

                          {/* Eliminar */}
                          <button onClick={() => setConfirmElim(c)} title="Eliminar" style={{
                            width: 24, height: 24, borderRadius: 6, border: "1px solid #fecaca",
                            background: "#fef2f2", color: "#dc2626", fontSize: 12, cursor: "pointer",
                            display: "flex", alignItems: "center", justifyContent: "center",
                          }}>🗑️</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>

              {/* Fila de totales */}
              <tfoot>
                <tr style={{ background: "#f8fafc", borderTop: "2px solid #e2e8f0" }}>
                  <td colSpan={5} style={{ padding: "8px 10px", fontSize: 11, fontWeight: 700, color: "#6b7280" }}>
                    TOTALES ({chequesFiltrados.length} cheques)
                  </td>
                  <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 800, fontSize: 12, color: "#dc2626", whiteSpace: "nowrap" }}>
                    {fmt(filtEgr)}
                  </td>
                  <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 800, fontSize: 12, color: "#15803d", whiteSpace: "nowrap" }}>
                    {fmt(filtIng)}
                  </td>
                  <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 800, fontSize: 13, color: (filtIng - filtEgr) >= 0 ? "#1d4ed8" : "#dc2626", whiteSpace: "nowrap" }}>
                    {fmt(filtIng - filtEgr)}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* ── Modal crear/editar ── */}
      {modalAbierto && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 }}
          onClick={() => setModalAbierto(false)}>
          <div className="ch-modal-inner" style={{
            background: "white", borderRadius: 20, padding: "32px 28px",
            width: "100%", maxWidth: 560, maxHeight: "90vh", overflowY: "auto",
            boxShadow: "0 24px 64px rgba(0,0,0,0.2)",
          }} onClick={e => e.stopPropagation()}>
            <h2 style={{ margin: "0 0 20px", fontSize: 18, fontWeight: 700, color: "#111827" }}>
              {editando ? "Editar cheque" : "Registrar cheque"}
            </h2>
            {errorForm && (
              <div style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", fontSize: 13, padding: "10px 14px", borderRadius: 8, marginBottom: 16 }}>
                {errorForm}
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

              {/* Tipo + Número */}
              <div style={{ display: "grid", gridTemplateColumns: "150px 1fr", gap: 14 }}>
                <div>
                  <label style={labelStyle}>Tipo</label>
                  <select value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })}
                    style={{ ...inputLight, cursor: "pointer" }}>
                    <option value="CH">CH (físico)</option>
                    <option value="ECHEQ">ECHEQ (electrónico)</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Número *</label>
                  <input type="text" value={form.numero} onChange={e => setForm({ ...form, numero: e.target.value })}
                    placeholder="02542167" style={inputLight} autoFocus />
                </div>
              </div>

              {/* Dueño */}
              <div>
                <label style={labelStyle}>Dueño del cheque</label>
                <input type="text" value={form.dueno} onChange={e => setForm({ ...form, dueno: e.target.value })}
                  placeholder="Nombre del firmante o empresa" style={inputLight} />
              </div>

              {/* Fecha + Banco */}
              <div className="ch-modal-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div>
                  <label style={labelStyle}>Fecha</label>
                  <input type="date" value={form.fecha} onChange={e => setForm({ ...form, fecha: e.target.value })}
                    style={inputLight} />
                </div>
                <div>
                  <label style={labelStyle}>Banco</label>
                  <input type="text" value={form.banco} onChange={e => setForm({ ...form, banco: e.target.value })}
                    list="bancos-list" placeholder="NACION ARG, GALICIA..." style={inputLight} />
                  <datalist id="bancos-list">
                    {BANCOS_COMUNES.map(b => <option key={b} value={b} />)}
                  </datalist>
                </div>
              </div>

              {/* Quién entregó + Entregada a */}
              <div className="ch-modal-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div>
                  <label style={labelStyle}>Quién entregó</label>
                  <input type="text" value={form.quien_entrego} onChange={e => setForm({ ...form, quien_entrego: e.target.value })}
                    placeholder="Nombre o empresa" style={inputLight} />
                </div>
                <div>
                  <label style={labelStyle}>Entregada a</label>
                  <input type="text" value={form.entregada_a} onChange={e => setForm({ ...form, entregada_a: e.target.value })}
                    placeholder="SIVET, GANAFORT, CR..." style={inputLight} />
                </div>
              </div>

              {/* Montos */}
              <div className="ch-modal-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div>
                  <label style={labelStyle}>Monto egresado (salida)</label>
                  <input type="number" min="0" step="0.01" value={form.monto_egresado}
                    onChange={e => setForm({ ...form, monto_egresado: e.target.value })}
                    placeholder="0,00" style={inputLight} />
                </div>
                <div>
                  <label style={labelStyle}>Monto ingresado (entrada)</label>
                  <input type="number" min="0" step="0.01" value={form.monto_ingresado}
                    onChange={e => setForm({ ...form, monto_ingresado: e.target.value })}
                    placeholder="0,00" style={inputLight} />
                </div>
              </div>

              {/* Notas */}
              <div>
                <label style={labelStyle}>Notas</label>
                <textarea value={form.notas} onChange={e => setForm({ ...form, notas: e.target.value })}
                  rows={2} placeholder="Observaciones, número de endoso, referencia, etc."
                  style={{ ...inputLight, resize: "none" }} />
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button onClick={() => setModalAbierto(false)} style={{
                flex: 1, padding: "11px", background: "#f1f5f9",
                border: "1px solid #e2e8f0", borderRadius: 10,
                color: "#374151", fontSize: 13, cursor: "pointer", fontWeight: 600,
              }}>Cancelar</button>
              <button onClick={guardar} disabled={guardando} style={{
                flex: 2, padding: "11px",
                background: "linear-gradient(135deg, #2563eb, #3b82f6)",
                border: "none", borderRadius: 10, color: "white",
                fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: guardando ? 0.5 : 1,
              }}>{guardando ? "Guardando..." : editando ? "Guardar cambios" : "Registrar cheque"}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal confirmar eliminar ── */}
      {confirmElim && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 }}
          onClick={() => setConfirmElim(null)}>
          <div style={{
            background: "white", borderRadius: 20, padding: "36px 32px",
            width: "100%", maxWidth: 360, boxShadow: "0 24px 64px rgba(0,0,0,0.2)",
          }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🗑️</div>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 8px", color: "#111827" }}>¿Eliminar cheque?</h2>
            <p style={{ color: "#6b7280", fontSize: 13, marginBottom: 20 }}>
              Vas a eliminar el cheque <strong>{TIPO_LABELS[confirmElim.tipo] || confirmElim.tipo} {confirmElim.numero}</strong>.
              Esta acción no se puede deshacer.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setConfirmElim(null)} style={{
                flex: 1, padding: "11px", background: "#f1f5f9",
                border: "1px solid #e2e8f0", borderRadius: 10,
                color: "#374151", fontSize: 13, cursor: "pointer", fontWeight: 600,
              }}>Cancelar</button>
              <button onClick={() => eliminar(confirmElim)} style={{
                flex: 1, padding: "11px", background: "#dc2626",
                border: "none", borderRadius: 10, color: "white",
                fontSize: 13, fontWeight: 700, cursor: "pointer",
              }}>Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
