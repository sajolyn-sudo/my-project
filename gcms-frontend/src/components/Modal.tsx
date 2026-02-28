import React, { useEffect } from "react";

export default function Modal({
  open,
  title,
  children,
  onClose,
}: {
  open: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      onMouseDown={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.35)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 12,
        zIndex: 999,
      }}
    >
      <div
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          width: "min(760px, 100%)", // ✅ smaller width
          maxHeight: "84vh", // ✅ cap modal height
          background: "white",
          borderRadius: 16,
          border: "1px solid rgba(15,23,42,0.10)",
          boxShadow: "0 18px 50px rgba(2,6,23,0.20)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "12px 14px",
            borderBottom: "1px solid rgba(15,23,42,0.08)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
            flex: "0 0 auto",
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 900, color: "#0f172a" }}>
            {title}
          </div>

          <button
            onClick={onClose}
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              border: "1px solid rgba(15,23,42,0.12)",
              background: "white",
              cursor: "pointer",
              fontSize: 18,
              lineHeight: "34px",
            }}
            aria-label="Close"
            title="Close"
          >
            ×
          </button>
        </div>

        {/* ✅ Scrollable Body */}
        <div
          style={{
            padding: 14,
            overflowY: "auto",
            flex: "1 1 auto",
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
