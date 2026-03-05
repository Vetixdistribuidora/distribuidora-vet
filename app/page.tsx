import Link from "next/link"

export default function Home() {
  return (
    <main style={{ padding: "40px" }}>

      <h1>Sistema Distribuidora Veterinaria</h1>

      <h2>Menú</h2>

      <ul>

        <li>
          <Link href="/productos">Productos</Link>
        </li>

        <li>
          <Link href="/clientes">Clientes</Link>
        </li>

        <li>
          <Link href="/ventas">Ventas</Link>
        </li>

      </ul>

    </main>
  )
}