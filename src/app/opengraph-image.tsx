import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const alt = "Govt Job Prep: past government job exam questions with answers and explanations";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const icon = await readFile(join(process.cwd(), "public/icons/icon-512.png"));
const iconSrc = `data:image/png;base64,${icon.toString("base64")}`;

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          gap: 64,
          padding: "0 96px",
          background: "#f2f2f7",
          color: "#000000",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse renders plain <img> only */}
        <img src={iconSrc} width={280} height={280} alt="" style={{ borderRadius: 64 }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ fontSize: 84, fontWeight: 700, lineHeight: 1.05 }}>Govt Job Prep</div>
          <div style={{ fontSize: 38, color: "#3c3c43", lineHeight: 1.3, maxWidth: 680 }}>
            Past government job exam questions with correct answers and explanations.
          </div>
        </div>
      </div>
    ),
    size,
  );
}
