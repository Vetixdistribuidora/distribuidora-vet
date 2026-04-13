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

const EMPTY_FORM = {
  nombre: "",
  cuit: "",
  telefono: "",
  email: "",
  direccion: "",
  notas: "",
};

function fmt(n: number) {
  return n.toLocaleString("es-AR", { style: "currency", currency: "ARS" });
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

  useEffect(() => { cargarProveedores(); }, []);

  async function cargarProveedores() {
    setLoading(true);
    const { data, error } = await supabase
      .from("proveedores_con_saldo")
      .select("*")
      .order("nombre", { ascending: true });
    if (!error && data) setProveedores(data);
    setLoading(false);
  }

  function abrirCrear() {
    setEditando(null);
    setForm(EMPTY_FORM);
    setError(null);
    setModalAbierto(true);
  }

  function abrirEditar(p: Proveedor) {
    setEditando(p);
    setForm({
      nombre: p.nombre,
      cuit: p.cuit ?? "",
      telefono: p.telefono ?? "",
      email: p.email ?? "",
      direccion: p.direccion ?? "",
      notas: p.notas ?? "",
    });
    setError(null);
    setModalAbierto(true);
  }

  function cerrarModal() {
    setModalAbierto(false);
    setEditando(null);
    setForm(EMPTY_FORM);
    setError(null);
  }

  async function guardar() {
    if (!form.nombre.trim()) { setError("El nombre es obligatorio."); return; }
    setGuardando(true); setError(null);

    const payload = {
      nombre: form.nombre.trim(),
      cuit: form.cuit.trim() || null,
      telefono: form.telefono.trim() || null,
      email: form.email.trim() || null,
      direccion: form.direccion.trim() || null,
      notas: form.notas.trim() || null,
    };

    let err;
    if (editando) {
      ({ error: err } = await supabase.from("proveedores").update(payload).eq("id", editando.id));
    } else {
      ({ error: err } = await supabase.from("proveedores").insert([payload]));
    }

    setGuardando(false);
    if (err) { setError("Error al guardar: " + err.message); return; }
    cerrarModal();
    cargarProveedores();
  }

  async function eliminar(p: Proveedor) {
    const { error } = await supabase.from("proveedores").delete().eq("id", p.id);
    if (!error) { setConfirmEliminar(null); cargarProveedores(); }
  }

  const filtrados = proveedores.filter((p) =>
    [p.nombre, p.cuit, p.telefono, p.email].join(" ").toLowerCase().includes(busqueda.toLowerCase())
  );

  const totalDeuda = proveedores.reduce((s, p) => s + (p.saldo_pendiente ?? 0), 0);

  return (
    <div className="p-6 max-w-6xl mx-auto">

      {/* Encabezado */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Proveedores</h1>
          <p className="text-sm text-gray-500 mt-1">
            {proveedores.length} proveedor{proveedores.length !== 1 ? "es" : ""} registrado{proveedores.length !== 1 ? "s" : ""}
            {totalDeuda > 0 && (
              <span className="ml-3 text-red-600 font-medium">· Deuda total: {fmt(totalDeuda)}</span>
            )}
          </p>
        </div>
        <button onClick={abrirCrear}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          + Nuevo proveedor
        </button>
      </div>

      {/* Buscador */}
      <div className="mb-6">
        <input type="text" placeholder="Buscar por nombre, CUIT, teléfono o email..."
          value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>

      {/* Cards */}
      {loading ? (
        <div className="p-8 text-center text-gray-400 text-sm">Cargando...</div>
      ) : filtrados.length === 0 ? (
        <div className="p-8 text-center text-gray-400 text-sm">
          {busqueda ? "No se encontraron resultados." : "No hay proveedores cargados todavía."}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filtrados.map((p) => (
            <div key={p.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between gap-4">

                {/* Info principal */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm flex-shrink-0">
                      {p.nombre.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 text-base">{p.nombre}</h3>
                      {p.cuit && <p className="text-xs text-gray-500">CUIT: {p.cuit}</p>}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-1 text-sm">
                    {p.telefono && (
                      <div className="flex items-center gap-1.5 text-gray-600">
                        <span className="text-gray-400">📞</span> {p.telefono}
                      </div>
                    )}
                    {p.email && (
                      <div className="flex items-center gap-1.5 text-gray-600 truncate">
                        <span className="text-gray-400">✉️</span> {p.email}
                      </div>
                    )}
                    {p.direccion && (
                      <div className="flex items-center gap-1.5 text-gray-600">
                        <span className="text-gray-400">📍</span> {p.direccion}
                      </div>
                    )}
                    {p.notas && (
                      <div className="col-span-2 md:col-span-3 flex items-start gap-1.5 text-gray-500 text-xs mt-1">
                        <span>📝</span> {p.notas}
                      </div>
                    )}
                  </div>
                </div>

                {/* Saldo + acciones */}
                <div className="flex flex-col items-end gap-3 flex-shrink-0">
                  {/* Saldo */}
                  <div className="text-right">
                    {p.saldo_pendiente > 0 ? (
                      <div>
                        <div className="text-xs text-gray-500 mb-0.5">Deuda pendiente</div>
                        <div className="text-base font-bold text-red-600">{fmt(p.saldo_pendiente)}</div>
                        <div className="text-xs text-gray-400">
                          {p.compras_pendientes} compra{p.compras_pendientes !== 1 ? "s" : ""} sin saldar
                        </div>
                      </div>
                    ) : (
                      <span className="inline-flex items-center gap-1 bg-green-50 text-green-700 text-xs font-medium px-2.5 py-1 rounded-full">
                        ✓ Sin deuda
                      </span>
                    )}
                  </div>

                  {/* Botones */}
                  <div className="flex gap-2">
                    <button onClick={() => abrirEditar(p)}
                      className="border border-gray-300 hover:border-blue-400 hover:text-blue-600 text-gray-600 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors">
                      ✏️ Editar
                    </button>
                    <button onClick={() => setConfirmEliminar(p)}
                      className="border border-gray-300 hover:border-red-400 hover:text-red-600 text-gray-600 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors">
                      🗑️ Eliminar
                    </button>
                  </div>
                </div>

              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Crear/Editar */}
      {modalAbierto && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">
                {editando ? "Editar proveedor" : "Nuevo proveedor"}
              </h2>
            </div>
            <div className="px-6 py-4 space-y-4">
              {error && <div className="bg-red-50 text-red-600 text-sm px-3 py-2 rounded-lg">{error}</div>}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Nombre <span className="text-red-500">*</span></label>
                <input type="text" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Ej: Laboratorio Holliday Scott" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">CUIT</label>
                  <input type="text" value={form.cuit} onChange={(e) => setForm({ ...form, cuit: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="20-12345678-9" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Teléfono</label>
                  <input type="text" value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="011 4567-8900" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="contacto@proveedor.com" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Dirección</label>
                <input type="text" value={form.direccion} onChange={(e) => setForm({ ...form, direccion: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Av. Corrientes 1234, CABA" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Notas</label>
                <textarea value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })}
                  rows={2}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  placeholder="Observaciones, condiciones comerciales, etc." />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={cerrarModal} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors">
                Cancelar
              </button>
              <button onClick={guardar} disabled={guardando}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors">
                {guardando ? "Guardando..." : editando ? "Guardar cambios" : "Crear proveedor"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Confirmar Eliminar */}
      {confirmEliminar && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">¿Eliminar proveedor?</h2>
            <p className="text-sm text-gray-500 mb-6">
              Vas a eliminar a <strong>{confirmEliminar.nombre}</strong>. Esta acción no se puede deshacer.
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmEliminar(null)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">
                Cancelar
              </button>
              <button onClick={() => eliminar(confirmEliminar)}
                className="bg-red-600 hover:bg-red-700 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors">
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}