import React, { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  useGCMS,
  fullName,
  type Referral,
  type ReferralStatus,
  type User,
} from "../store/gcmsStore";

/** =======================
 *  Page styles
 *  ======================= */
const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  padding: 24,
  background:
    "radial-gradient(1100px 500px at 20% -20%, rgba(99,102,241,0.16), transparent 55%), #f4f6fb",
};

const containerStyle: React.CSSProperties = {
  maxWidth: 1200,
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

const sectionTitle: React.CSSProperties = {
  margin: 0,
  fontSize: 13,
  fontWeight: 900,
  letterSpacing: 0.2,
  color: "#334155",
  textTransform: "uppercase",
};

const btn: React.CSSProperties = {
  height: 40,
  padding: "0 14px",
  borderRadius: 12,
  border: "1px solid rgba(15,23,42,0.12)",
  background: "white",
  fontWeight: 900,
  cursor: "pointer",
  color: "#0f172a",
};

const btnPrimary: React.CSSProperties = {
  ...btn,
  border: "1px solid rgba(99,102,241,0.35)",
  background:
    "linear-gradient(180deg, rgba(99,102,241,0.16), rgba(99,102,241,0.08))",
};

const inputStyle: React.CSSProperties = {
  height: 38,
  borderRadius: 12,
  border: "1px solid rgba(15,23,42,0.12)",
  padding: "0 12px",
  outline: "none",
  width: "100%",
  background: "white",
  fontSize: 12,
  fontWeight: 700,
};

const textareaStyle: React.CSSProperties = {
  width: "100%",
  minHeight: 90,
  borderRadius: 12,
  border: "1px solid rgba(15,23,42,0.12)",
  padding: "10px 12px",
  outline: "none",
  background: "white",
  fontSize: 12,
  fontWeight: 650,
};

const checkboxGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 8,
  padding: 12,
  borderRadius: 14,
  border: "1px solid rgba(15,23,42,0.12)",
  background: "rgba(255,255,255,0.8)",
};

const chipBar: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
  marginTop: 10,
};

const chip: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  padding: "6px 10px",
  borderRadius: 999,
  border: "1px solid rgba(15,23,42,0.12)",
  background: "rgba(15,23,42,0.04)",
  fontSize: 12,
  fontWeight: 900,
  color: "#0f172a",
};

const referralReasons = [
  "Academics",
  "Attendance and Tardiness",
  "Adjustment",
  "Behavioral Problems",
  "Bullying",
  "Career Choice",
  "Depression",
  "Discipline",
  "Drugs/Drug Abuse",
  "Early Pregnancy",
  "Family Conflicts",
  "Financial",
  "Health",
  "Loss/Death",
  "Love and Relationships",
  "Motivation",
  "Phobia, Panic and Anxiety",
  "Prejudice and Discrimination",
  "Premarital Sex/Sex",
  "Single Parenting/Early Parenthood",
  "Social Relations",
  "Stress",
  "Study Habits",
  "Time Management",
  "Others (Specify in Notes)",
];

/** =======================
 *  Helpers
 *  ======================= */
function formatDate(d: string) {
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "—";
  return dt.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function ReferralChip({ status }: { status: ReferralStatus }) {
  const palette =
    status === "pending"
      ? {
          bg: "rgba(245,158,11,0.14)",
          br: "rgba(245,158,11,0.35)",
          tx: "#92400e",
          dot: "#f59e0b",
          label: "Pending",
        }
      : status === "reviewed"
        ? {
            bg: "rgba(59,130,246,0.14)",
            br: "rgba(59,130,246,0.35)",
            tx: "#1d4ed8",
            dot: "#3b82f6",
            label: "Reviewed",
          }
        : {
            bg: "rgba(34,197,94,0.14)",
            br: "rgba(34,197,94,0.35)",
            tx: "#166534",
            dot: "#22c55e",
            label: "Resolved",
          };

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 10px",
        borderRadius: 999,
        border: `1px solid ${palette.br}`,
        background: palette.bg,
        color: palette.tx,
        fontSize: 12,
        fontWeight: 950,
        whiteSpace: "nowrap",
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: 99,
          background: palette.dot,
        }}
      />
      {palette.label}
    </span>
  );
}

/** =======================
 *  Modal (smaller + scroll)
 *  ======================= */
function Modal({
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
  if (!open) return null;

  return (
    <div
      onMouseDown={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15,23,42,0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 50,
        padding: 12,
      }}
    >
      <div
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          width: "min(720px, 100%)", // ✅ slightly smaller
          maxHeight: "84vh", // ✅ do not exceed screen
          background: "white",
          borderRadius: 18,
          border: "1px solid rgba(15,23,42,0.12)",
          boxShadow: "0 20px 60px rgba(15,23,42,0.25)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* header */}
        <div
          style={{
            padding: "12px 14px",
            borderBottom: "1px solid rgba(15,23,42,0.10)",
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            alignItems: "center",
            flex: "0 0 auto",
          }}
        >
          <div style={{ fontWeight: 950, fontSize: 14, color: "#0f172a" }}>
            {title}
          </div>
          <button
            onClick={onClose}
            style={{
              ...btn,
              height: 34,
              width: 40,
              padding: 0,
              borderRadius: 10,
              fontSize: 14,
            }}
            aria-label="Close"
            title="Close"
          >
            ✕
          </button>
        </div>

        {/* body scroll */}
        <div style={{ padding: 14, overflowY: "auto", flex: "1 1 auto" }}>
          {children}
        </div>
      </div>
    </div>
  );
}

export default function MyReferrals() {
  const navigate = useNavigate();
  const { currentUser, users, referrals, setReferrals } = useGCMS();

  const myUserId = currentUser?.users_id;

console.log("currentUser:", currentUser);
console.log("myUserId:", myUserId);

  const myReferrals = useMemo(() => {
    if (!myUserId) return [];
    return [...referrals]
      .filter((r) => r.student_user_id === myUserId)
      .sort(
        (a, b) =>
          new Date(b.referred_date).getTime() -
          new Date(a.referred_date).getTime(),
      );
  }, [myUserId, referrals]);

  const [open, setOpen] = useState(false);

  // form state
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState("09:00"); // ✅ preferred time
  const [selectedReasons, setSelectedReasons] = useState<string[]>([]);
  const [notes, setNotes] = useState("");

  const referredByDefault =
    users.find((u) => u.user_type === "admin")?.users_id ??
    users[0]?.users_id ??
    1;

  const getUserName = (id: number) => {
    const u = users.find((x) => x.users_id === id) as User | undefined;
    return u ? fullName(u) : "—";
  };

  const toggleReason = (reason: string) => {
    setSelectedReasons((prev) =>
      prev.includes(reason)
        ? prev.filter((r) => r !== reason)
        : [...prev, reason],
    );
  };

  const addReferralDemo = () => {
    if (!myUserId) return;

    if (selectedReasons.length === 0) {
      alert("Please select at least one reason.");
      return;
    }

    const reasonText = selectedReasons.join(", ");
    const scheduleText = `${date} ${time}`;

    setReferrals((prev) => {
      const nextId = prev.reduce((m, x) => Math.max(m, x.referral_id), 0) + 1;
      const r: Referral = {
        referral_id: nextId,
        student_user_id: myUserId,
        referred_by_user_id: referredByDefault,
        referred_date: date,
        reason: reasonText,
        status: "pending",
        notes: notes.trim()
          ? `Schedule: ${scheduleText}\n${notes.trim()}`
          : `Schedule: ${scheduleText}`,
      };
      return [r, ...prev];
    });

    const nextId =
      referrals.reduce((m, x) => Math.max(m, x.referral_id), 0) + 1;

    setOpen(false);
    setSelectedReasons([]);
    setNotes("");

    navigate(`/app/my-referrals/${nextId}`);
  };

  return (
    <div style={pageStyle}>
      <div style={containerStyle}>
        {/* HEADER */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
            alignItems: "flex-start",
          }}
        >
          <div>
            <h1
              style={{
                margin: 0,
                fontSize: 28,
                letterSpacing: -0.3,
                color: "#0f172a",
              }}
            >
              My Referrals
            </h1>
            <p style={{ margin: "6px 0 0", color: "#64748b" }}>
              View your referrals and track their status.
            </p>
          </div>

          {/* RIGHT ACTIONS */}
          <div
            style={{
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "flex-end",
            }}
          >
            {/* ✅ Back to Dashboard removed */}
            <button onClick={() => setOpen(true)} style={btnPrimary}>
              + Create Referral
            </button>
          </div>
        </div>

        {/* LIST */}
        <div style={cardStyle}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <h3 style={sectionTitle}>All My Referrals</h3>
            <div style={{ color: "#64748b", fontSize: 13, fontWeight: 900 }}>
              Total: {myReferrals.length}
            </div>
          </div>

          <div style={divider} />

          {myReferrals.length === 0 ? (
            <div style={{ color: "#64748b" }}>
              No referrals yet. When a referral is filed for you, it will appear
              here.
            </div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {myReferrals.map((r) => (
                <Link
                  key={r.referral_id}
                  to={`/app/my-referrals/${r.referral_id}`}
                  style={{
                    textDecoration: "none",
                    color: "inherit",
                    padding: 12,
                    borderRadius: 16,
                    border: "1px solid rgba(15,23,42,0.08)",
                    background: "rgba(255,255,255,0.72)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 950, color: "#0f172a" }}>
                      {formatDate(r.referred_date)} • {r.reason}
                    </div>
                    <div style={{ color: "#64748b", fontSize: 13 }}>
                      Referred by: {getUserName(r.referred_by_user_id)}
                      {r.notes ? ` • Notes: ${r.notes}` : ""}
                    </div>
                  </div>
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 10 }}
                  >
                    <ReferralChip status={r.status} />
                    <span style={{ fontWeight: 950, color: "#334155" }}>→</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* MODAL */}
      <Modal open={open} title="Create Referral" onClose={() => setOpen(false)}>
        <div style={{ display: "grid", gap: 12 }}>
          {/* reassurance */}
          <div
            style={{
              background: "rgba(34,197,94,0.08)",
              border: "1px solid rgba(34,197,94,0.25)",
              padding: 10,
              borderRadius: 10,
              fontSize: 12,
              fontWeight: 800,
              color: "#166534",
            }}
          >
            🔒 Your information will remain confidential.
          </div>

          {/* schedule */}
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}
          >
            <div>
              <div
                style={{
                  fontSize: 12,
                  color: "#64748b",
                  fontWeight: 900,
                  marginBottom: 6,
                }}
              >
                Preferred Date
              </div>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                style={inputStyle}
              />
            </div>

            <div>
              <div
                style={{
                  fontSize: 12,
                  color: "#64748b",
                  fontWeight: 900,
                  marginBottom: 6,
                }}
              >
                Preferred Time
              </div>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>

          {/* reasons */}
          <div>
            <div
              style={{
                fontSize: 12,
                color: "#64748b",
                fontWeight: 900,
                marginBottom: 6,
              }}
            >
              Reason for Referral * (Select all that apply)
            </div>

            <div style={checkboxGrid}>
              {referralReasons.map((r) => (
                <label
                  key={r}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    fontSize: 12,
                    color: "#0f172a",
                    fontWeight: 850,
                    userSelect: "none",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selectedReasons.includes(r)}
                    onChange={() => toggleReason(r)}
                  />
                  {r}
                </label>
              ))}
            </div>

            {selectedReasons.length > 0 && (
              <div style={chipBar}>
                {selectedReasons.map((r) => (
                  <span key={r} style={chip}>
                    {r}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* notes */}
          <div>
            <div
              style={{
                fontSize: 12,
                color: "#64748b",
                fontWeight: 900,
                marginBottom: 6,
              }}
            >
              Notes / Details (optional)
            </div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              style={textareaStyle}
              placeholder="Add details, previous interventions, or specify 'Others' here..."
            />
          </div>

          {/* footer */}
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <button onClick={() => setOpen(false)} style={btn}>
              Cancel
            </button>
            <button onClick={addReferralDemo} style={btnPrimary}>
              Save
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
