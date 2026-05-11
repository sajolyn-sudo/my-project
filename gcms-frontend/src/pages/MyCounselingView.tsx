import React, { useMemo } from "react";
import { Link, useParams, Navigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useGCMS, fullName, type CounselingCase } from "../store/gcmsStore";
import useStudentPortalSync from "../hooks/useStudentPortalSync";

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

function formatTime(value?: string | null) {
  if (!value) return "-";
  const [hourPart, minutePart] = String(value).split(":");
  const hours = Number(hourPart);
  const minutes = Number(minutePart);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return String(value);
  const suffix = hours >= 12 ? "PM" : "AM";
  const displayHour = hours % 12 || 12;
  return `${displayHour}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

export default function MyCounselingView() {
  const { loading } = useStudentPortalSync();
  const { id } = useParams();
  const caseId = Number(id);

  const { currentUser, counseling, users } = useGCMS();
  const myUserId = currentUser?.users_id;

  const c = useMemo(() => {
    if (!myUserId || !caseId) return null;
    return counseling.find(
      (x) => x.counseling_id === caseId && x.student_user_id === myUserId,
    ) as CounselingCase | undefined;
  }, [myUserId, caseId, counseling]);

  if (!currentUser) return <Navigate to="/login" replace />;
  if (loading && !c) {
    return (
      <div style={pageStyle}>
        <div style={containerStyle}>
          <div style={cardStyle}>Loading your counseling case...</div>
        </div>
      </div>
    );
  }
  if (!c) return <Navigate to="/app/my-counseling" replace />;

  const staffUser = users.find((u) => u.users_id === c.counselor_user_id);

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
              Counseling Case #{c.counseling_id}
            </h1>
            <p style={{ margin: "6px 0 0", color: "#64748b" }}>
              View full details of your counseling case.
            </p>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link
              to="/app/my-counseling"
              title="Back"
              aria-label="Back"
              style={{
                width: 46,
                height: 46,
                borderRadius: 999,
                border: "1px solid rgba(15,23,42,0.16)",
                background: "white",
                color: "#0f172a",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                textDecoration: "none",
                boxShadow: "0 8px 18px rgba(2,6,23,0.08)",
              }}
            >
              <ArrowLeft size={18} />
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
            <span style={pill}>{c.status.toUpperCase()}</span>
          </div>

          <div style={divider} />

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <div style={{ fontSize: 12, color: "#64748b", fontWeight: 900 }}>
                Date
              </div>
              <div style={{ fontWeight: 950 }}>{formatDate(c.counseling_date)}</div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: "#64748b", fontWeight: 900 }}>
                Staff
              </div>
              <div style={{ fontWeight: 950 }}>
                {staffUser ? fullName(staffUser) : "To be assigned"}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: "#64748b", fontWeight: 900 }}>
                Time
              </div>
              <div style={{ fontWeight: 950 }}>
                {formatTime(c.counseling_time)}
              </div>
            </div>

            <div style={{ gridColumn: "1 / -1" }}>
              <div style={{ fontSize: 12, color: "#64748b", fontWeight: 900 }}>
                Reason
              </div>
              <div style={{ fontWeight: 800 }}>{c.reason ?? "-"}</div>
            </div>

            <div style={{ gridColumn: "1 / -1" }}>
              <div style={{ fontSize: 12, color: "#64748b", fontWeight: 900 }}>
                Notes
              </div>
              <div style={{ color: "#334155", fontWeight: 700 }}>
                {c.notes ?? "No notes yet."}
              </div>
            </div>
          </div>
        </div>

        <div style={{ ...cardStyle, color: "#64748b", fontSize: 13 }}>
          Next upgrade: we can add messages, file attachments, and STAFF feedback here once your backend tables exist.
        </div>
      </div>
    </div>
  );
}
