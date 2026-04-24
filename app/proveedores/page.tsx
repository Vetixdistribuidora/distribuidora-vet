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
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [modalAbierto, setModalAbierto] = useState(false);
  const [editando, setEditando] = useState<Proveedor | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmEliminar, setConfirmEliminar] = useState<Proveedor | null>(null);
  const [errorEliminar, setErrorEliminar] = useState<string | null>(null);

  useEffect(() => { cargarProveedores(); }, []);

  async function cargarProveedores() {
    setLoading(true);
    const { data, error } = await supabase.from("proveedores_con_saldo").select("*").order("nombre");
    if (!error && data) setProveedores(data);
    setLoading(false);
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
    let err;
    if (editando) {
      ({ error: err } = await supabase.from("proveedores").update(payload).eq("id", editando.id));
    } else {
      ({ error: err } = await supabase.from("proveedores").insert([payload]));
    }
    setGuardando(false);
    if (err) { setError("Error al guardar: " + err.message); return; }
    cerrarModal(); cargarProveedores();
  }

  async function eliminar(p: Proveedor) {
    setErrorEliminar(null);
    const { error } = await supabase.from("proveedores").delete().eq("id", p.id);
    if (error) {
      setErrorEliminar(p.compras_pendientes > 0
        ? `No se puede eliminar: ${p.nombre} tiene compras registradas.`
        : "No se pudo eliminar: " + error.message);
    } else {
      setConfirmEliminar(null); setErrorEliminar(null); cargarProveedores();
    }
  }

  const filtrados = proveedores.filter(p =>
    [p.nombre, p.cuit, p.telefono, p.email].join(" ").toLowerCase().includes(busqueda.toLowerCase())
  );
  const totalDeuda = proveedores.reduce((s, p) => s + (p.saldo_pendiente ?? 0), 0);

  return (
    <div style={{ fontFamily: "'DM Sans', 'Segoe UI', sans-serif" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <p style={{ fontSize: 13, color: "#6b7280", margin: 0 }}>
            <span style={{ fontWeight: 700, color: "#374151" }}>{proveedores.length}</span> proveedor{proveedores.length !== 1 ? "es" : ""}
            {totalDeuda > 0 && <span style={{ marginLeft: 10, color: "#dc2626", fontWeight: 600 }}>· Deuda total: {fmt(totalDeuda)}</span>}
          </p>
        </div>
        <button onClick={abrirCrear} style={{
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
            <div key={p.id} style={{
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
              <div style={{ display: "flex", alignItems: "center", gap: 16, flexShrink: 0 }}>
                {p.saldo_pendiente > 0 ? (
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 2 }}>Deuda pendiente</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: "#dc2626" }}>{fmt(p.saldo_pendiente)}</div>
                    <div style={{ fontSize: 11, color: "#9ca3af" }}>{p.compras_pendientes} compra{p.compras_pendientes !== 1 ? "s" : ""}</div>
                  </div>
                ) : (
                  <span style={{
                    background: "#f0fdf4", color: "#16a34a", fontSize: 11,
                    fontWeight: 700, padding: "4px 10px", borderRadius: 20,
                    border: "1px solid #bbf7d0"
                  }}>✓ Sin deuda</span>
                )}
                <div style={{ display: "flex", gap: 8 }}>
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
          <div style={{
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
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
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
    </div>
  );
}