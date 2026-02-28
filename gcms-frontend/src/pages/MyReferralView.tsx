import React, { useMemo } from "react";
import { Link, useParams, Navigate } from "react-router-dom";
import { useGCMS, fullName } from "../store/gcmsStore";

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  padding: 24,
  background:
    "radial-gradient(1100px 500px at 20% -20%, rgba(99,102,241,0.16), transparent 55%), #f4f6fb",
};

const containerStyle: React.CSSProperties = {
  maxWidth: 960,
  margin: "0 auto",
  display: "grid",
  gap: 16,
};

const cardStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.92)",
  border: "1px solid rgba(15,23,42,0.08)",
  borderRadius: 18,
  padding: 16,
  boxShadow: "0 10px 24px rgba(15,23,42,0.06)",
};

const divider: React.CSSProperties = {
  height: 1,
  background: "rgba(15,23,42,0.08)",
  margin: "12px 0",
};

const pill: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "6px 10px",
  borderRadius: 999,
  border: "1px solid rgba(15,23,42,0.10)",
  background: "rgba(255,255,255,0.9)",
  fontSize: 12,
  fontWeight: 900,
  color: "#0f172a",
  textDecoration: "none",
};

function formatDate(d: string) {
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "—";
  return dt.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function MyReferralView() {
  const { id } = useParams();
  const referralId = Number(id);

  const { currentUser, referrals, users } = useGCMS();
  const myUserId = currentUser?.users_id;

  const r = useMemo(() => {
    if (!myUserId || !referralId) return null;
    return (
      referrals.find(
        (x) => x.referral_id === referralId && x.student_user_id === myUserId,
      ) ?? null
    );
  }, [myUserId, referralId, referrals]);

  if (!currentUser) return <Navigate to="/login" replace />;
  if (!r) return <Navigate to="/app/my-referrals" replace />;

  const refBy = users.find((u) => u.users_id === r.referred_by_user_id);

  return (
    <div style={pageStyle}>
      <div style={containerStyle}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div>
            <h1 style={{ margin: 0, fontSize: 26, letterSpacing: -0.3 }}>
              Referral #{r.referral_id}
            </h1>
            <p style={{ margin: "6px 0 0", color: "#64748b" }}>
              Full details of your referral record.
            </p>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link to="/app/my-referrals" style={pill}>
              ← Back
            </Link>
            <Link to="/app/dashboard" style={pill}>
              Dashboard
            </Link>
          </div>
        </div>

        <div style={cardStyle}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <div style={{ fontWeight: 950 }}>Status</div>
            <span style={pill}>{r.status.toUpperCase()}</span>
          </div>

          <div style={divider} />

          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}
          >
            <div>
              <div style={{ fontSize: 12, color: "#64748b", fontWeight: 900 }}>
                Referred Date
              </div>
              <div style={{ fontWeight: 950 }}>
                {formatDate(r.referred_date)}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: "#64748b", fontWeight: 900 }}>
                Referred By
              </div>
              <div style={{ fontWeight: 950 }}>
                {refBy ? fullName(refBy) : "—"}
              </div>
            </div>

            <div style={{ gridColumn: "1 / -1" }}>
              <div style={{ fontSize: 12, color: "#64748b", fontWeight: 900 }}>
                Reason
              </div>
              <div style={{ fontWeight: 800 }}>{r.reason}</div>
            </div>

            <div style={{ gridColumn: "1 / -1" }}>
              <div style={{ fontSize: 12, color: "#64748b", fontWeight: 900 }}>
                Notes
              </div>
              <div style={{ color: "#334155", fontWeight: 700 }}>
                {r.notes ?? "No notes."}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
