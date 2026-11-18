import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";

// A 1200x630 social-sharing image for any page: its section and its title on the practice's colours.
// Pages get theirs from buildMetadata (lib/seo/metadata.ts), so each page shares its own title.

export const runtime = "edge";

const clip = (value: string | null, max: number, fallback: string) => {
  const text = (value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
  return text || fallback;
};

export function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const title = clip(params.get("title"), 110, "Chaitanya Raj Psychology & Counselling");
  const label = clip(params.get("label"), 30, "Chaitanya Raj");
  const size = title.length > 80 ? 52 : title.length > 50 ? 62 : 74;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px 72px",
          background: "linear-gradient(135deg, #123A36 0%, #1F5C56 100%)",
          color: "#FFFFFF",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div style={{ width: 56, height: 4, background: "#F0B860" }} />
          <div style={{ fontSize: 28, letterSpacing: 4, textTransform: "uppercase", color: "#F0B860" }}>{label}</div>
        </div>
        <div style={{ display: "flex", fontSize: size, lineHeight: 1.12, fontWeight: 700, maxWidth: 1040 }}>{title}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ fontSize: 34, fontWeight: 700 }}>Chaitanya Raj</div>
          <div style={{ fontSize: 24, color: "#A9C4BD" }}>Psychology & Counselling · Vashi & CBD Belapur, Navi Mumbai · Online worldwide</div>
        </div>
      </div>
    ),
    { width: 1200, height: 630, headers: { "Cache-Control": "public, max-age=86400, s-maxage=31536000, immutable" } },
  );
}
