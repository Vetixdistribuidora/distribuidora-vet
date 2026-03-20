"use client"

import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"

type Producto = {
  id: number
  nombre: string
  precio: number
  stock: number
}

type Cliente = {
  id: number
  nombre: string
  apellido: string
}

type Venta = {
  id: number
  total: number
  cliente: string
  created_at: string
}

type ItemVenta = {
  producto: Producto
  cantidad: number
}

export default function Ventas() {

  const [productos, setProductos] = useState<Producto[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [busqueda, setBusqueda] = useState("")
  const [clienteSeleccionado, setClienteSeleccionado] = useState<Cliente | null>(null)
  const [ventasCliente, setVentasCliente] = useState<Venta[]>([])
  const [carrito, setCarrito] = useState<ItemVenta[]>([])

  useEffect(() => {
    fetchProductos()
    fetchClientes()
  }, [])

  async function fetchProductos() {
    const { data } = await supabase.from("productos").select("*")
    setProductos(data || [])
  }

  async function fetchClientes() {
    const { data } = await supabase.from("clientes").select("*")
    setClientes(data || [])
  }

  async function fetchHistorial(nombre: string) {
    const { data } = await supabase
      .from("ventas")
      .select("*")
      .ilike("cliente", `%${nombre}%`)

    setVentasCliente(data || [])
  }

  function agregarAlCarrito(producto: Producto) {
    if (producto.stock <= 0) return alert("Sin stock")

    const existe = carrito.find(p => p.producto.id === producto.id)

    if (existe) {
      if (existe.cantidad >= producto.stock) return alert("Sin stock")

      setCarrito(carrito.map(p =>
        p.producto.id === producto.id
          ? { ...p, cantidad: p.cantidad + 1 }
          : p
      ))
    } else {
      setCarrito([...carrito, { producto, cantidad: 1 }])
    }
  }

  function restarCantidad(id: number) {
    setCarrito(
      carrito
        .map(p =>
          p.producto.id === id
            ? { ...p, cantidad: p.cantidad - 1 }
            : p
        )
        .filter(p => p.cantidad > 0)
    )
  }

  function eliminarDelCarrito(id: number) {
    setCarrito(carrito.filter(p => p.producto.id !== id))
  }

  const total = carrito.reduce(
    (acc, item) => acc + item.producto.precio * item.cantidad,
    0
  )

  const clientesFiltrados = clientes.filter(c =>
    `${c.nombre} ${c.apellido}`.toLowerCase().includes(busqueda.toLowerCase())
  )

  function abrirFactura(numero: number) {

    const cliente = clienteSeleccionado
      ? `${clienteSeleccionado.nombre} ${clienteSeleccionado.apellido}`
      : "Consumidor Final"

    const contenido = `
      <html>
        <head>
          <style>
            body { font-family: Arial; padding:20px; }
            @media print { button { display:none; } }
          </style>
        </head>
        <body>

          <h2>CONSULTORIO VETERINARIO</h2>
          <p>Factura N° ${numero}</p>
          <p>Cliente: ${cliente}</p>

          <button onclick="window.print()">Imprimir / PDF</button>

        </body>
      </html>
    `

    const w = window.open("", "_blank")
    if (w) {
      w.document.write(contenido)
      w.document.close()
    }
  }

  async function confirmarVenta() {

    if (carrito.length === 0) return alert("Carrito vacío")

    const { data: ultima } = await supabase
      .from("ventas")
      .select("numero_factura")
      .order("numero_factura", { ascending: false })
      .limit(1)

    const numero = (ultima?.[0]?.numero_factura || 0) + 1

    const clienteNombre = clienteSeleccionado
      ? `${clienteSeleccionado.nombre} ${clienteSeleccionado.apellido}`
      : "Consumidor Final"

    const { error } = await supabase.from("ventas").insert([{
      total,
      numero_factura: numero,
      cliente: clienteNombre
    }])

    if (error) {
      console.log(error)
      alert("Error al guardar venta")
      return
    }

    abrirFactura(numero)

    setCarrito([])
  }

  return (
    <main style={{ padding: 20 }}>

      <h1>🧾 Ventas</h1>

      {/* BUSCADOR */}
      <input
        placeholder="Buscar cliente..."
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
      />

      {clientesFiltrados.map(c => (
        <div key={c.id}
          onClick={() => {
            setClienteSeleccionado(c)
            fetchHistorial(`${c.nombre} ${c.apellido}`)
          }}
          style={{ cursor: "pointer", background: "#eee", margin: 5 }}
        >
          {c.nombre} {c.apellido}
        </div>
      ))}

      <h3>
        Cliente: {clienteSeleccionado
          ? `${clienteSeleccionado.nombre} ${clienteSeleccionado.apellido}`
          : "Consumidor Final"}
      </h3>

      {/* HISTORIAL */}
      <h2>Historial</h2>

      {ventasCliente.map(v => (
        <div key={v.id}>
          ${v.total} - {new Date(v.created_at).toLocaleDateString()}
        </div>
      ))}

      <hr />

      <h2>Productos</h2>

      {productos.map(p => (
        <div key={p.id}>
          {p.nombre} - ${p.precio}
          <button onClick={() => agregarAlCarrito(p)}>+</button>
        </div>
      ))}

      <h3>Total: $ {total}</h3>

      <button onClick={confirmarVenta}>
        Confirmar venta
      </button>

    </main>
  )
}