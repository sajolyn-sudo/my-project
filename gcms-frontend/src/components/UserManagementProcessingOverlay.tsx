import { Users } from "lucide-react";
import LoadingSpinner from "./LoadingSpinner";

export default function UserManagementProcessingOverlay({
  open,
  title,
  message,
}: {
  open: boolean;
  title: string;
  message: string;
}) {
  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15, 23, 42, 0.28)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        zIndex: 10000,
      }}
    >
      <div
        style={{
          width: "min(360px, 100%)",
          background: "white",
          borderRadius: 18,
          border: "1px solid rgba(15,23,42,0.08)",
          boxShadow: "0 24px 60px rgba(15,23,42,0.22)",
          padding: "24px 22px",
          display: "grid",
          justifyItems: "center",
          gap: 14,
          textAlign: "center",
        }}
        role="status"
        aria-live="polite"
      >
        <div
          aria-hidden="true"
          style={{
            width: 58,
            height: 58,
            borderRadius: 18,
            background: "rgba(245, 158, 11, 0.14)",
            color: "#b45309",
            display: "grid",
            placeItems: "center",
            border: "1px solid rgba(245, 158, 11, 0.26)",
          }}
        >
          <Users size={28} />
        </div>

        <div style={{ display: "grid", gap: 6 }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#0f172a" }}>
            {title}
          </div>
          <div style={{ fontSize: 13.5, color: "#475569", lineHeight: 1.55 }}>
            {message}
          </div>
        </div>

        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
            color: "#1f2937",
            fontSize: 13.5,
            fontWeight: 700,
          }}
        >
          <LoadingSpinner size={18} color="#b45309" thickness={2.5} />
          Processing...
        </div>
      </div>
    </div>
  );
}
