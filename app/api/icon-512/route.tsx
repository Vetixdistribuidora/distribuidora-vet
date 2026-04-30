import { ImageResponse } from "next/og"

export const runtime = "edge"

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 512,
          height: 512,
          background: "linear-gradient(145deg, #0c0f1a, #111827)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: 364,
            height: 364,
            background: "linear-gradient(145deg, #1e40af, #3b82f6)",
            borderRadius: 76,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg
            width="224"
            height="224"
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
    { width: 512, height: 512 }
  )
}
