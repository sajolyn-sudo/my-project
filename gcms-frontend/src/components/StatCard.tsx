import React from "react";

type Tone = "blue" | "yellow";

export default function StatCard({
  label,
  value,
  icon,
  hint,
  tone = "blue",
}: {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  hint?: string;
  tone?: Tone;
}) {
  const toneStyles =
    tone === "yellow"
      ? {
          accent: "#F59E0B", // warm yellow
          softBg: "rgba(245,158,11,0.12)",
          softBorder: "rgba(245,158,11,0.22)",
        }
      : {
          accent: "#2563EB", // admin blue
          softBg: "rgba(37,99,235,0.12)",
          softBorder: "rgba(37,99,235,0.22)",
        };

  return (
    <div
      style={{
        position: "relative",
        background: "white",
        border: "1px solid rgba(15,23,42,0.10)",
        borderRadius: 18,
        padding: 16,
        boxShadow: "0 10px 24px rgba(15, 23, 42, 0.08)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 14,
        overflow: "hidden",
      }}
    >
      {/* Left accent strip */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: 4,
          background: toneStyles.accent,
        }}
      />

      {/* Text */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div
          style={{
            fontSize: 12,
            fontWeight: 900,
            letterSpacing: 0.6,
            opacity: 0.7,
            textTransform: "uppercase",
          }}
        >
          {label}
        </div>

        <div style={{ fontSize: 34, fontWeight: 900, lineHeight: 1 }}>
          {value}
        </div>

        {hint ? <div style={{ fontSize: 13, opacity: 0.7 }}>{hint}</div> : null}
      </div>

      {/* Right icon pill */}
      <div
        style={{
          width: 54,
          height: 54,
          borderRadius: 18,
          display: "grid",
          placeItems: "center",
          background: toneStyles.softBg,
          border: `1px solid ${toneStyles.softBorder}`,
          color: toneStyles.accent,
          flex: "0 0 auto",
        }}
      >
        {icon}
      </div>
    </div>
  );
}
