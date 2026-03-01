import React, { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CirclePlus, Eye, Printer } from "lucide-react";
import {
  useGCMS,
  fullName,
  type Referral,
  type ReferralStatus,
  type User,
} from "../store/gcmsStore";
import { openReferralFormPrint } from "../lib/referralFormPrint";

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
  border: "1px solid rgba(15,23,42,0.7)",
  background: "linear-gradient(180deg, rgba(15,23,42,0.96), rgba(2,6,23,0.98))",
  color: "white",
  boxShadow: "0 8px 18px rgba(2,6,23,0.08)",
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
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

const miniIconBtn: React.CSSProperties = {
  height: 32,
  width: 32,
  borderRadius: 999,
  border: "1px solid rgba(15,23,42,0.18)",
  background: "white",
  color: "#0f172a",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
};

const filterChip = (active: boolean): React.CSSProperties => ({
  height: 34,
  padding: "0 12px",
  borderRadius: 999,
  border: active
    ? "1px solid rgba(15,23,42,0.65)"
    : "1px solid rgba(15,23,42,0.14)",
  background: active
    ? "linear-gradient(180deg, rgba(15,23,42,0.96), rgba(2,6,23,0.98))"
    : "white",
  color: active ? "white" : "#0f172a",
  fontSize: 12,
  fontWeight: 900,
  cursor: "pointer",
});

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

function extractLabeledValue(text: string | undefined, label: string): string {
  const source = String(text || "");
  const chunks = source
    .split(/\r?\n|\|/)
    .map((line) => line.trim())
    .filter(Boolean);
  const found = chunks.find((line) =>
    line.toLowerCase().startsWith(`${label.toLowerCase()}:`),
  );
  if (!found) return "";
  return found.slice(found.indexOf(":") + 1).trim();
}

function cleanDetailsText(text: string | undefined): string {
  const source = String(text || "");
  const chunks = source
    .split(/\r?\n|\|/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/^(name|course)\s*:/i.test(line));
  return chunks.join("\n");
}

function splitReasons(reasonText: string): string[] {
  return String(reasonText || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}
function ReferralChip({ status }: { status: ReferralStatus }) {
  const label =
    status === "pending"
      ? "Pending"
      : status === "reviewed"
        ? "Reviewed"
        : "Resolved";
  const color =
    status === "pending"
      ? "#b45309"
      : status === "reviewed"
        ? "#1d4ed8"
        : "#166534";

  return (
    <span
      style={{
        display: "inline-block",
        color,
        fontSize: 13,
        fontWeight: 950,
        whiteSpace: "nowrap",
      }}
    >
      {label}
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
  const [directionFilter, setDirectionFilter] = useState<
    "all" | "received" | "sent"
  >("received");

  const myUserId = currentUser?.users_id;

  const myRelatedReferrals = useMemo(() => {
    if (!myUserId) return [];
    return [...referrals]
      .filter(
        (r) =>
          r.student_user_id === myUserId || r.referred_by_user_id === myUserId,
      )
      .sort(
        (a, b) =>
          new Date(b.referred_date).getTime() -
          new Date(a.referred_date).getTime(),
      );
  }, [myUserId, referrals]);

  const visibleReferrals = useMemo(() => {
    if (!myUserId) return [];
    if (directionFilter === "received") {
      return myRelatedReferrals.filter((r) => r.student_user_id === myUserId);
    }
    if (directionFilter === "sent") {
      return myRelatedReferrals.filter(
        (r) => r.referred_by_user_id === myUserId,
      );
    }
    return myRelatedReferrals;
  }, [directionFilter, myRelatedReferrals, myUserId]);

  const receivedCount = useMemo(
    () =>
      myRelatedReferrals.filter((r) => r.student_user_id === myUserId).length,
    [myRelatedReferrals, myUserId],
  );
  const sentCount = useMemo(
    () =>
      myRelatedReferrals.filter((r) => r.referred_by_user_id === myUserId)
        .length,
    [myRelatedReferrals, myUserId],
  );

  const [open, setOpen] = useState(false);

  // form state
  const [studentName, setStudentName] = useState("");
  const [course, setCourse] = useState("");
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

  const handlePrintReferral = (r: Referral) => {
    const student = users.find((u) => u.users_id === r.student_user_id);
    const referredBy = users.find((u) => u.users_id === r.referred_by_user_id);

    const studentName =
      extractLabeledValue(r.notes, "Name") || (student ? fullName(student) : "-");
    const courseYearSection = extractLabeledValue(r.notes, "Course") || "-";

    openReferralFormPrint({
      studentName,
      courseYearSection,
      reasons: splitReasons(r.reason),
      details: cleanDetailsText(r.notes),
      facultyStaffName: referredBy ? fullName(referredBy) : "-",
      referralDate: r.referred_date,
    });
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
    if (!studentName.trim() || !course.trim()) {
      alert("Please provide name and course.");
      return;
    }

    const reasonText = selectedReasons.join(", ");
    const metadata = [`Name: ${studentName.trim()}`, `Course: ${course.trim()}`];
    if (notes.trim()) metadata.push(notes.trim());

    setReferrals((prev) => {
      const nextId = prev.reduce((m, x) => Math.max(m, x.referral_id), 0) + 1;
      const r: Referral = {
        referral_id: nextId,
        student_user_id: myUserId,
        referred_by_user_id: referredByDefault,
        referred_date: new Date().toISOString().slice(0, 10),
        reason: reasonText,
        status: "pending",
        notes: metadata.join("\n"),
      };
      return [r, ...prev];
    });

    const nextId =
      referrals.reduce((m, x) => Math.max(m, x.referral_id), 0) + 1;

    setOpen(false);
    setStudentName("");
    setCourse("");
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
              <CirclePlus size={16} />
              Create Referral
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
              alignItems: "flex-start",
            }}
          >
            <h3 style={sectionTitle}>All My Referrals</h3>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                justifyContent: "flex-end",
                gap: 8,
              }}
            >
              <button
                type="button"
                style={filterChip(directionFilter === "received")}
                onClick={() => setDirectionFilter("received")}
              >
                Received ({receivedCount})
              </button>
              <button
                type="button"
                style={filterChip(directionFilter === "sent")}
                onClick={() => setDirectionFilter("sent")}
              >
                Sent Out ({sentCount})
              </button>
              <button
                type="button"
                style={filterChip(directionFilter === "all")}
                onClick={() => setDirectionFilter("all")}
              >
                All ({myRelatedReferrals.length})
              </button>
              <div style={{ color: "#64748b", fontSize: 13, fontWeight: 900 }}>
                Total: {visibleReferrals.length}
              </div>
            </div>
          </div>

          <div style={divider} />

          {visibleReferrals.length === 0 ? (
            <div style={{ color: "#64748b" }}>
              {directionFilter === "received"
                ? "No received referrals yet."
                : directionFilter === "sent"
                  ? "No sent-out referrals yet."
                  : "No referrals yet."}
            </div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {visibleReferrals.map((r) => {
                const isReceived = r.student_user_id === myUserId;
                const secondaryLabel = isReceived ? "Referred by" : "Sent to";
                const secondaryUser = isReceived
                  ? getUserName(r.referred_by_user_id)
                  : getUserName(r.student_user_id);

                return (
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
                      {secondaryLabel}: {secondaryUser}
                      {r.notes ? ` • Notes: ${r.notes}` : ""}
                    </div>
                  </div>
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 10 }}
                  >
                    <ReferralChip status={r.status} />
                    <button
                      type="button"
                      title="Print / Download Referral Form"
                      style={miniIconBtn}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handlePrintReferral(r);
                      }}
                    >
                      <Printer size={14} />
                    </button>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "6px 10px",
                        borderRadius: 999,
                        border: "1px solid rgba(15,23,42,0.20)",
                        background: "rgba(15,23,42,0.04)",
                        color: "#0f172a",
                        fontWeight: 900,
                        fontSize: 12,
                      }}
                    >
                      <Eye size={14} />
                      View
                    </span>
                  </div>
                </Link>
              );
            })}
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

          {/* student info */}
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
                Name
              </div>
              <input
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                placeholder="Enter student name"
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
                Course
              </div>
              <input
                value={course}
                onChange={(e) => setCourse(e.target.value)}
                placeholder="Enter course"
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

