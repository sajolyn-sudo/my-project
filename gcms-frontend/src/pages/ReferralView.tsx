import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

type Role = "ADMIN" | "COUNSELOR" | "STUDENT";

type User = {
  id: number;
  fname: string;
  mname?: string;
  lname: string;
  email: string;
  role: Role;
  collegeId?: number;
  yearLevelId?: number;
};

type College = { id: number; name: string };
type AcademicYear = { id: number; name: string; isActive: boolean };
type YearLevel = {
  id: number;
  name: string;
  collegeId: number;
  academicYearId: number;
};

type Referral = {
  id: number;
  studentId: number;
  referredByUserId: number;
  academicYearId: number;
  collegeId: number;
  yearLevelId: number;
  referredDate: string;
  reason: string; // comma separated
  notes?: string;
  status: "New" | "Reviewed" | "Closed";
  createdAt: string;
};

type ReferralLog = {
  id: number;
  referralId: number;
  createdByUserId: number;
  actionDate: string; // yyyy-mm-dd
  actionType: "Follow-up" | "Meeting" | "Phone Call" | "Resolved" | "Other";
  note: string;
};

const USERS_KEY = "gcms_mock_users_v1";
const COLLEGES_KEY = "gcms_mock_colleges_v1";
const YEARS_KEY = "gcms_mock_academic_years_v1";
const YL_KEY = "gcms_mock_year_levels_v1";
const REF_KEY = "gcms_mock_referrals_v1";
const REF_LOG_KEY = "gcms_mock_referral_logs_v1";

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function save<T>(key: string, data: T) {
  localStorage.setItem(key, JSON.stringify(data));
}

function splitReasons(reasonText: string) {
  return reasonText
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

function formatDateShort(iso: string) {
  if (!iso) return "—";
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return iso;
  return dt.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

/** ✅ Nice toast (no library) */
function Toast({
  open,
  message,
  tone = "success",
  onClose,
}: {
  open: boolean;
  message: string;
  tone?: "success" | "error" | "info";
  onClose: () => void;
}) {
  if (!open) return null;

  const palette =
    tone === "success"
      ? {
          bg: "rgba(34,197,94,0.14)",
          border: "rgba(34,197,94,0.35)",
          text: "#166534",
          dot: "#22c55e",
          icon: "✓",
        }
      : tone === "error"
        ? {
            bg: "rgba(239,68,68,0.12)",
            border: "rgba(239,68,68,0.30)",
            text: "#991b1b",
            dot: "#ef4444",
            icon: "!",
          }
        : {
            bg: "rgba(59,130,246,0.12)",
            border: "rgba(59,130,246,0.30)",
            text: "#1d4ed8",
            dot: "#3b82f6",
            icon: "i",
          };

  return (
    <div
      style={{
        position: "fixed",
        top: 18,
        right: 18,
        zIndex: 80,
        width: "min(420px, calc(100vw - 36px))",
      }}
      role="status"
      aria-live="polite"
    >
      <div
        style={{
          position: "relative",
          display: "flex",
          alignItems: "flex-start",
          gap: 12,
          padding: 12,
          borderRadius: 14,
          border: `1px solid ${palette.border}`,
          background: palette.bg,
          boxShadow: "0 14px 40px rgba(15,23,42,0.18)",
          color: palette.text,
        }}
      >
        <span
          aria-hidden
          style={{
            position: "absolute",
            left: 10,
            top: 10,
            width: 8,
            height: 8,
            borderRadius: 99,
            background: palette.dot,
          }}
        />
        <div
          style={{
            width: 30,
            height: 30,
            borderRadius: 10,
            display: "grid",
            placeItems: "center",
            background: "rgba(255,255,255,0.75)",
            border: "1px solid rgba(15,23,42,0.08)",
            flex: "0 0 auto",
            fontWeight: 1000,
          }}
        >
          {palette.icon}
        </div>

        <div style={{ flex: "1 1 auto", minWidth: 0 }}>
          <div style={{ fontWeight: 950, fontSize: 13 }}>Notification</div>
          <div style={{ fontWeight: 850, fontSize: 13, opacity: 0.9 }}>
            {message}
          </div>
        </div>

        <button
          onClick={onClose}
          style={{
            border: "1px solid rgba(15,23,42,0.12)",
            background: "rgba(255,255,255,0.75)",
            borderRadius: 10,
            height: 30,
            padding: "0 10px",
            cursor: "pointer",
            fontWeight: 950,
            color: palette.text,
          }}
        >
          ✕
        </button>
      </div>
    </div>
  );
}

export default function ReferralView() {
  const { id } = useParams();
  const referralId = Number(id);

  const users = useMemo<User[]>(() => load<User[]>(USERS_KEY, []), []);
  const colleges = useMemo<College[]>(
    () => load<College[]>(COLLEGES_KEY, []),
    [],
  );
  const years = useMemo<AcademicYear[]>(
    () => load<AcademicYear[]>(YEARS_KEY, []),
    [],
  );
  const yearLevels = useMemo<YearLevel[]>(
    () => load<YearLevel[]>(YL_KEY, []),
    [],
  );

  // ✅ STATEFUL: referrals + logs
  const [referrals, setReferrals] = useState<Referral[]>(() =>
    load<Referral[]>(REF_KEY, []),
  );
  const [logs, setLogs] = useState<ReferralLog[]>(() =>
    load<ReferralLog[]>(REF_LOG_KEY, []),
  );

  // ✅ Toast state
  const [toast, setToast] = useState<{
    open: boolean;
    message: string;
    tone: "success" | "error" | "info";
  }>({ open: false, message: "", tone: "success" });

  const showToast = (
    message: string,
    tone: "success" | "error" | "info" = "success",
  ) => {
    setToast({ open: true, message, tone });
    window.clearTimeout((showToast as any)._t);
    (showToast as any)._t = window.setTimeout(() => {
      setToast((prev) => ({ ...prev, open: false }));
    }, 2500);
  };

  // (Optional) reflect localStorage changes from other tabs
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === REF_KEY) setReferrals(load<Referral[]>(REF_KEY, []));
      if (e.key === REF_LOG_KEY) setLogs(load<ReferralLog[]>(REF_LOG_KEY, []));
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const found = useMemo(
    () => referrals.find((r) => r.id === referralId),
    [referrals, referralId],
  );

  const labelUserById = (uid: number) => {
    const u = users.find((x) => x.id === uid);
    if (!u) return "Unknown";
    const full = `${u.fname} ${u.mname ? u.mname + " " : ""}${u.lname}`;
    return `${full} (${u.email})`;
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

  const [status, setStatus] = useState<Referral["status"]>("New");
  useEffect(() => {
    setStatus(found?.status ?? "New");
  }, [found?.status]);

  const staff = useMemo(
    () => users.filter((u) => u.role === "COUNSELOR" || u.role === "ADMIN"),
    [users],
  );

  const [actionDate, setActionDate] = useState<string>(
    new Date().toISOString().slice(0, 10),
  );
  const [actionType, setActionType] =
    useState<ReferralLog["actionType"]>("Follow-up");
  const [note, setNote] = useState("");

  const [createdByUserId, setCreatedByUserId] = useState<number>(0);
  useEffect(() => {
    const fallback = staff[0]?.id ?? 0;
    setCreatedByUserId(found?.referredByUserId ?? fallback);
  }, [found?.referredByUserId, staff]);

  const saveStatus = () => {
    if (!found) return;

    const next = referrals.map((r) =>
      r.id === found.id ? { ...r, status } : r,
    );

    setReferrals(next);
    save(REF_KEY, next);
    showToast("Status saved!", "success");
  };

  const addLog = () => {
    if (!found) return;

    if (!note.trim()) {
      showToast("Please type a note before adding a log.", "error");
      return;
    }
    if (!createdByUserId) {
      showToast("Please choose who created this log.", "error");
      return;
    }

    const nextId = logs.length ? Math.max(...logs.map((l) => l.id)) + 1 : 1;

    const newLog: ReferralLog = {
      id: nextId,
      referralId: found.id,
      createdByUserId,
      actionDate,
      actionType,
      note: note.trim(),
    };

    const next = [newLog, ...logs];
    setLogs(next);
    save(REF_LOG_KEY, next);

    setNote("");
    setActionType("Follow-up");

    showToast("Log added!", "success");
  };

  const deleteLog = (logId: number) => {
    const next = logs.filter((l) => l.id !== logId);
    setLogs(next);
    save(REF_LOG_KEY, next);
    showToast("Log deleted.", "info");
  };

  const referralLogs = useMemo(() => {
    if (!found) return [];
    return logs
      .filter((l) => l.referralId === found.id)
      .sort((a, b) => (a.actionDate < b.actionDate ? 1 : -1));
  }, [logs, found]);

  // Styles
  const page: React.CSSProperties = { display: "grid", gap: 16 };

  const paper: React.CSSProperties = {
    background: "var(--card)",
    padding: 18,
    borderRadius: 18,
    boxShadow: "var(--shadow)",
    border: "1px solid var(--border)",
  };

  const topBar: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  };

  const backLink: React.CSSProperties = {
    textDecoration: "none",
    color: "var(--primary)",
    fontWeight: 900,
  };

  const headerBlock: React.CSSProperties = {
    display: "grid",
    gap: 2,
    textAlign: "center",
    paddingBottom: 10,
    borderBottom: "1px solid var(--border)",
  };

  const formTitle: React.CSSProperties = {
    margin: 0,
    fontWeight: 1000,
    letterSpacing: 0.5,
  };

  const formSubtitle: React.CSSProperties = {
    margin: 0,
    fontSize: 12,
    opacity: 0.85,
    fontWeight: 800,
  };

  const formName: React.CSSProperties = {
    margin: "8px 0 0",
    fontSize: 16,
    fontWeight: 1000,
    letterSpacing: 0.6,
  };

  const grid2: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12,
    marginTop: 14,
  };

  const lineField: React.CSSProperties = { display: "grid", gap: 6 };

  const fieldLabel: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 900,
    opacity: 0.8,
  };

  const fieldValue: React.CSSProperties = {
    border: "1px solid var(--border)",
    borderRadius: 12,
    padding: "10px 12px",
    background: "rgba(255,255,255,0.65)",
    fontWeight: 900,
    minHeight: 40,
    display: "flex",
    alignItems: "center",
  };

  const sectionTitle: React.CSSProperties = {
    margin: "14px 0 8px",
    fontSize: 12,
    fontWeight: 1000,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    opacity: 0.85,
  };

  const checkboxPanel: React.CSSProperties = {
    border: "1px solid var(--border)",
    borderRadius: 16,
    padding: 12,
    background: "rgba(255,255,255,0.65)",
  };

  const checkboxGrid: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 8,
  };

  const checkboxRow: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 10,
    fontSize: 13,
    fontWeight: 800,
    opacity: 0.9,
  };

  const detailsBox: React.CSSProperties = {
    border: "1px solid var(--border)",
    borderRadius: 16,
    padding: 12,
    background: "rgba(255,255,255,0.65)",
    minHeight: 90,
    whiteSpace: "pre-wrap",
    lineHeight: 1.35,
    fontWeight: 800,
  };

  const pillRow: React.CSSProperties = {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  };

  const pill: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid var(--border)",
    background: "rgba(255,255,255,0.65)",
    fontWeight: 900,
    fontSize: 12,
  };

  const card: React.CSSProperties = {
    background: "var(--card)",
    padding: 16,
    borderRadius: 16,
    boxShadow: "var(--shadow)",
    border: "1px solid var(--border)",
  };

  const inputStyle: React.CSSProperties = {
    height: 40,
    borderRadius: 10,
    border: "1px solid var(--border)",
    padding: "0 10px",
    outline: "none",
    width: "100%",
    background: "white",
    color: "var(--text)",
  };

  const textareaStyle: React.CSSProperties = {
    borderRadius: 10,
    border: "1px solid var(--border)",
    padding: "10px 10px",
    outline: "none",
    width: "100%",
    background: "white",
    color: "var(--text)",
    minHeight: 110,
    resize: "vertical",
  };

  const primaryButton: React.CSSProperties = {
    height: 40,
    padding: "0 16px",
    borderRadius: 10,
    border: "none",
    background: "var(--primary)",
    color: "white",
    fontWeight: 900,
    cursor: "pointer",
    whiteSpace: "nowrap",
  };

  const dangerButton: React.CSSProperties = {
    height: 32,
    padding: "0 12px",
    borderRadius: 8,
    border: "none",
    background: "#D9534F",
    color: "white",
    cursor: "pointer",
    fontWeight: 900,
  };

  const label: React.CSSProperties = {
    fontSize: 13,
    fontWeight: 900,
    opacity: 0.85,
    marginBottom: 6,
  };

  if (!found) {
    return (
      <div style={page}>
        <Toast
          open={toast.open}
          message={toast.message}
          tone={toast.tone}
          onClose={() => setToast((p) => ({ ...p, open: false }))}
        />

        <div style={topBar}>
          <h2 style={{ fontWeight: 1000, marginRight: "auto" }}>
            Referral Details
          </h2>
          <Link to="/app/referrals" style={backLink}>
            ← Back
          </Link>
        </div>

        <div style={card}>
          <div style={{ opacity: 0.8 }}>Referral not found.</div>
        </div>
      </div>
    );
  }

  const student = users.find((u) => u.id === found.studentId);
  const referredBy = users.find((u) => u.id === found.referredByUserId);
  const ay = years.find((y) => y.id === found.academicYearId);
  const college = colleges.find((c) => c.id === found.collegeId);
  const yl = yearLevels.find((y) => y.id === found.yearLevelId);

  const studentName = student
    ? `${student.fname} ${student.mname ? student.mname + " " : ""}${student.lname}`
    : "Unknown Student";

  const selected = new Set(splitReasons(found.reason));

  return (
    <div style={page}>
      <Toast
        open={toast.open}
        message={toast.message}
        tone={toast.tone}
        onClose={() => setToast((p) => ({ ...p, open: false }))}
      />

      <div style={topBar}>
        <h2 style={{ fontWeight: 1000, marginRight: "auto" }}>
          Referral Details
        </h2>
        <Link to="/app/referrals" style={backLink}>
          ← Back
        </Link>
      </div>

      <div style={paper}>
        <div style={headerBlock}>
          <p style={formSubtitle}>Republic of the Philippines</p>
          <p style={formTitle}>BOHOL ISLAND STATE UNIVERSITY</p>
          <p style={formSubtitle}>Guidance and Counseling Services Center</p>
          <p style={formName}>COUNSELING REFERRAL FORM - INTERNAL</p>
        </div>

        <div style={grid2}>
          <div style={lineField}>
            <div style={fieldLabel}>Name of Student</div>
            <div style={fieldValue}>
              {studentName} {student?.email ? `(${student.email})` : ""}
            </div>
          </div>

          <div style={lineField}>
            <div style={fieldLabel}>Course / Year / Section</div>
            <div style={fieldValue}>
              {college?.name ?? "—"} • {yl?.name ?? "—"}
            </div>
          </div>
        </div>

        <div style={pillRow}>
          <span style={pill}>
            📅 Referred Date: {formatDateShort(found.referredDate)}
          </span>
          <span style={pill}>🎓 Academic Year: {ay?.name ?? "—"}</span>
          <span style={pill}>
            👤 Referred By: {referredBy ? labelUserById(referredBy.id) : "—"}
          </span>
          <span style={pill}>🆔 Referral ID: #{found.id}</span>
        </div>

        <div style={sectionTitle}>Reason for Referral</div>
        <div style={checkboxPanel}>
          <div style={checkboxGrid}>
            {referralReasons.map((r) => {
              const checked = selected.has(r);
              return (
                <div key={r} style={checkboxRow}>
                  <span
                    aria-hidden
                    style={{
                      width: 16,
                      height: 16,
                      borderRadius: 4,
                      border: "1px solid rgba(15,23,42,0.25)",
                      display: "inline-grid",
                      placeItems: "center",
                      background: checked
                        ? "rgba(34,197,94,0.18)"
                        : "transparent",
                    }}
                  >
                    {checked ? "✓" : ""}
                  </span>
                  <span style={{ opacity: checked ? 1 : 0.78 }}>{r}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div style={sectionTitle}>Details</div>
        <div style={detailsBox}>{found.notes?.trim() || "—"}</div>

        <div
          style={{
            marginTop: 12,
            fontSize: 12,
            opacity: 0.75,
            fontWeight: 900,
          }}
        >
          Created: <b>{found.createdAt}</b>
        </div>
      </div>

      <div style={card}>
        <h3 style={{ marginBottom: 10 }}>Status</h3>

        <div
          style={{
            display: "grid",
            gap: 12,
            gridTemplateColumns: "1fr auto",
          }}
        >
          <div>
            <div style={label}>Referral Status</div>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as Referral["status"])}
              style={inputStyle}
            >
              <option value="New">New</option>
              <option value="Reviewed">Reviewed</option>
              <option value="Closed">Closed</option>
            </select>
          </div>

          <div style={{ display: "flex", alignItems: "end" }}>
            <button onClick={saveStatus} style={primaryButton}>
              Save
            </button>
          </div>
        </div>
      </div>

      <div style={card}>
        <h3 style={{ marginBottom: 10 }}>Action Logs / Follow-ups</h3>

        <div
          style={{
            display: "grid",
            gap: 12,
            gridTemplateColumns: "1fr 1fr 2fr",
          }}
        >
          <div>
            <div style={label}>Action Date</div>
            <input
              type="date"
              value={actionDate}
              onChange={(e) => setActionDate(e.target.value)}
              style={inputStyle}
            />
          </div>

          <div>
            <div style={label}>Action Type</div>
            <select
              value={actionType}
              onChange={(e) =>
                setActionType(e.target.value as ReferralLog["actionType"])
              }
              style={inputStyle}
            >
              <option value="Follow-up">Follow-up</option>
              <option value="Meeting">Meeting</option>
              <option value="Phone Call">Phone Call</option>
              <option value="Resolved">Resolved</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div>
            <div style={label}>Created By</div>
            <select
              value={createdByUserId}
              onChange={(e) => setCreatedByUserId(Number(e.target.value))}
              style={inputStyle}
            >
              {staff.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.fname} {u.lname} ({u.role})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          <div style={label}>Note</div>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            style={textareaStyle}
          />
        </div>

        <div
          style={{
            marginTop: 12,
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          <button onClick={addLog} style={primaryButton}>
            + Add Log
          </button>
        </div>

        <div style={{ marginTop: 16, display: "grid", gap: 10 }}>
          {referralLogs.length === 0 ? (
            <div style={{ opacity: 0.8 }}>No logs yet.</div>
          ) : (
            referralLogs.map((l) => (
              <div
                key={l.id}
                style={{
                  border: "1px solid var(--border)",
                  borderRadius: 12,
                  padding: 12,
                  background: "rgba(255,255,255,0.6)",
                  display: "grid",
                  gap: 6,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 10,
                  }}
                >
                  <div style={{ fontWeight: 1000 }}>
                    {l.actionType} • {formatDateShort(l.actionDate)}
                  </div>
                  <button onClick={() => deleteLog(l.id)} style={dangerButton}>
                    Delete
                  </button>
                </div>

                <div style={{ opacity: 0.88, fontWeight: 800 }}>{l.note}</div>
                <div style={{ fontSize: 13, opacity: 0.75 }}>
                  By: <b>{labelUserById(l.createdByUserId)}</b>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
