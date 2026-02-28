export default function DoughnutMock({
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
          display: "grid",
          placeItems: "center",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: 190,
            height: 190,
            borderRadius: "50%",
            background:
              "conic-gradient(#2563EB 0 40%, #F59E0B 40% 68%, rgba(37,99,235,0.35) 68% 84%, rgba(245,158,11,0.35) 84% 100%)",
            display: "grid",
            placeItems: "center",
          }}
        >
          <div
            style={{
              width: 110,
              height: 110,
              borderRadius: "50%",
              background: "white",
              border: "1px solid rgba(15,23,42,0.10)",
              display: "grid",
              placeItems: "center",
              textAlign: "center",
            }}
          >
            <div>
              <div style={{ fontSize: 12, opacity: 0.7 }}>Cases</div>
              <div style={{ fontSize: 22, fontWeight: 900 }}>100%</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
