import { ImageResponse } from "next/og"

export const runtime = "edge"

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 192,
          height: 192,
          background: "linear-gradient(145deg, #0c0f1a, #111827)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: 136,
            height: 136,
            background: "linear-gradient(145deg, #1e40af, #3b82f6)",
            borderRadius: 28,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg
            width="84"
            height="84"
            viewBox="0 0 24 24"
            fill="none"
            style={{ display: "flex" }}
          >
            <polyline
              points="3,5 9,19 12,13 15,19 21,5"
              stroke="white"
              stroke-width="2.2"
              stroke-linejoin="round"
              stroke-linecap="round"
            />
            <circle cx="12" cy="4" r="1.3" fill="#93c5fd" />
          </svg>
        </div>
      </div>
    ),
    { width: 192, height: 192 }
  )
}
