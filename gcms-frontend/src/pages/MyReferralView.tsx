import React, { useMemo, useState } from "react";
import {
  ArrowLeft,
  CalendarDays,
  GraduationCap,
  ListChecks,
  StickyNote,
  UserRound,
} from "lucide-react";
import { useParams, Navigate, useNavigate } from "react-router-dom";
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

const chip: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "6px 10px",
  borderRadius: 999,
  border: "1px solid rgba(15,23,42,0.14)",
  background: "rgba(255,255,255,0.96)",
  fontSize: 12,
  fontWeight: 900,
  color: "#0f172a",
};

const labelStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  fontSize: 12,
  color: "#64748b",
  fontWeight: 900,
};

function formatDate(d: string) {
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "-";
  return dt.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function statusColor(status: string) {
  if (status === "pending") return "#b45309";
  if (status === "reviewed") return "#1d4ed8";
  return "#166534";
}

function parseReferralNotes(notes?: string) {
  const lines = String(notes || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  let name = "";
  let course = "";
  const extra: string[] = [];

  for (const line of lines) {
    if (/^name\s*:/i.test(line)) {
      name = line.replace(/^name\s*:/i, "").trim();
      continue;
    }
    if (/^course\s*:/i.test(line)) {
      course = line.replace(/^course\s*:/i, "").trim();
      continue;
    }
    extra.push(line);
  }

  return {
    name,
    course,
    extraText: extra.join("\n"),
  };
}

export default function MyReferralView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const referralId = Number(id);
  const [backActive, setBackActive] = useState(false);

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
  const parsed = parseReferralNotes(r.notes);
  const reasonList = r.reason
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

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

          <button
            type="button"
            onMouseDown={() => setBackActive(true)}
            onMouseUp={() => setBackActive(false)}
            onMouseLeave={() => setBackActive(false)}
            onClick={() => navigate("/app/my-referrals")}
            title="Back"
            aria-label="Back"
            style={{
              width: 46,
              height: 46,
              borderRadius: 999,
              border: backActive
                ? "1px solid rgba(2,6,23,0.98)"
                : "1px solid rgba(15,23,42,0.16)",
              background: backActive
                ? "linear-gradient(180deg, rgba(15,23,42,0.96), rgba(2,6,23,0.98))"
                : "white",
              color: backActive ? "white" : "#0f172a",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              boxShadow: "0 8px 18px rgba(2,6,23,0.08)",
            }}
          >
            <ArrowLeft size={18} />
          </button>
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
            <span
              style={{
                fontSize: 13,
                fontWeight: 950,
                color: statusColor(r.status),
                textTransform: "uppercase",
                letterSpacing: 0.3,
              }}
            >
              {r.status}
            </span>
          </div>

          <div style={divider} />

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 12,
            }}
          >
            <div>
              <div style={labelStyle}>
                <CalendarDays size={14} />
                Referred Date
              </div>
              <div style={{ fontWeight: 950 }}>{formatDate(r.referred_date)}</div>
            </div>

            <div>
              <div style={labelStyle}>
                <UserRound size={14} />
                Referred By
              </div>
              <div style={{ fontWeight: 950 }}>{refBy ? fullName(refBy) : "-"}</div>
            </div>

            <div>
              <div style={labelStyle}>
                <UserRound size={14} />
                Name
              </div>
              <div style={{ fontWeight: 950 }}>{parsed.name || fullName(currentUser)}</div>
            </div>

            <div>
              <div style={labelStyle}>
                <GraduationCap size={14} />
                Course
              </div>
              <div style={{ fontWeight: 950 }}>{parsed.course || "-"}</div>
            </div>
          </div>

          <div style={{ marginTop: 14 }}>
            <div style={labelStyle}>
              <ListChecks size={14} />
              Reason
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
              {reasonList.length > 0 ? (
                reasonList.map((reason) => (
                  <span key={reason} style={chip}>
                    {reason}
                  </span>
                ))
              ) : (
                <span style={{ color: "#64748b", fontWeight: 700 }}>-</span>
              )}
            </div>
          </div>

          <div style={{ marginTop: 14 }}>
            <div style={labelStyle}>
              <StickyNote size={14} />
              Notes
            </div>
            <div
              style={{
                marginTop: 8,
                border: "1px solid rgba(15,23,42,0.10)",
                borderRadius: 12,
                background: "rgba(248,250,252,0.92)",
                padding: "10px 12px",
                color: "#334155",
                fontWeight: 700,
                whiteSpace: "pre-wrap",
                lineHeight: 1.45,
              }}
            >
              {parsed.extraText || "No notes."}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
