import React from "react";
import { Link } from "react-router-dom";
import { ClipboardPlus, Share2, UsersRound } from "lucide-react";
import { useAuthStore } from "../store/authStore";

const card: React.CSSProperties = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 18,
  padding: 16,
  boxShadow: "var(--shadow)",
};

const statCard: React.CSSProperties = {
  ...card,
  display: "grid",
  gap: 8,
};

const actionBtn: React.CSSProperties = {
  height: 42,
  borderRadius: 12,
  border: "1px solid rgba(37,99,235,0.22)",
  background: "rgba(37,99,235,0.10)",
  color: "#1d4ed8",
  fontWeight: 900,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  textDecoration: "none",
  padding: "0 14px",
};

export default function TeacherDashboard() {
  const role = useAuthStore((s) => s.user?.role);
  const isNonTeaching = role === "NON_TEACHING_PERSONNEL";
  const dashboardTitle = isNonTeaching
    ? "Non Teaching Personnel Dashboard"
    : "Teacher Dashboard";

  return (
    <div
      style={{
        padding: 28,
        maxWidth: 1180,
        margin: "0 auto",
        display: "grid",
        gap: 16,
      }}
    >
      <div
        style={{
          ...card,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div style={{ fontSize: 22, fontWeight: 1000 }}>{dashboardTitle}</div>
          <div style={{ marginTop: 4, opacity: 0.78, fontWeight: 700 }}>
            Create and manage student referrals.
          </div>
        </div>
        <Link to="/app/referrals" style={actionBtn}>
          <ClipboardPlus size={18} />
          Add Referral
        </Link>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: 12,
        }}
      >
        <div style={statCard}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              display: "grid",
              placeItems: "center",
              background: "rgba(37,99,235,0.14)",
              color: "#1d4ed8",
            }}
          >
            <Share2 size={18} />
          </div>
          <div style={{ fontSize: 30, fontWeight: 1000, lineHeight: 1 }}>0</div>
          <div style={{ opacity: 0.75, fontWeight: 800 }}>
            Referrals this month
          </div>
        </div>

        <div style={statCard}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              display: "grid",
              placeItems: "center",
              background: "rgba(251,191,36,0.18)",
              color: "#92400e",
            }}
          >
            <UsersRound size={18} />
          </div>
          <div style={{ fontSize: 30, fontWeight: 1000, lineHeight: 1 }}>0</div>
          <div style={{ opacity: 0.75, fontWeight: 800 }}>
            Students referred
          </div>
        </div>

        <div style={statCard}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              display: "grid",
              placeItems: "center",
              background: "rgba(16,185,129,0.16)",
              color: "#047857",
            }}
          >
            <ClipboardPlus size={18} />
          </div>
          <div style={{ fontSize: 30, fontWeight: 1000, lineHeight: 1 }}>0</div>
          <div style={{ opacity: 0.75, fontWeight: 800 }}>Open follow-ups</div>
        </div>
      </div>
    </div>
  );
}
