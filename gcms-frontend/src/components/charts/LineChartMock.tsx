export default function LineChartMock({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div
      style={{
        background: "white",
        border: "1px solid rgba(15,23,42,0.10)",
        borderRadius: 18,
        padding: 16,
        boxShadow: "0 10px 24px rgba(15, 23, 42, 0.08)",
        height: 360,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <div style={{ fontWeight: 900, fontSize: 16 }}>{title}</div>
        {subtitle ? (
          <div style={{ fontSize: 12, opacity: 0.7 }}>{subtitle}</div>
        ) : null}
      </div>

      <div
        style={{
          flex: 1,
          borderRadius: 14,
          border: "1px solid rgba(15,23,42,0.10)",
          background: "white",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* dashed grid like admin */}
        <div
          style={{
            position: "absolute",
            inset: 18,
            borderRadius: 12,
            background:
              "repeating-linear-gradient(0deg, rgba(15,23,42,0.10) 0 1px, transparent 1px 34px), repeating-linear-gradient(90deg, rgba(15,23,42,0.10) 0 1px, transparent 1px 90px)",
            opacity: 0.35,
          }}
        />

        {/* blue trend line placeholder */}
        <div
          style={{
            position: "absolute",
            left: 26,
            right: 26,
            top: 70,
            height: 180,
            borderRadius: 12,
            background:
              "linear-gradient(180deg, rgba(37,99,235,0.10), transparent)",
          }}
        />

        <div
          style={{
            position: "absolute",
            left: 24,
            top: 18,
            fontSize: 12,
            opacity: 0.7,
          }}
        >
          Hover points/bars to see values
        </div>
      </div>
    </div>
  );
}
