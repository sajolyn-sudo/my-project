import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useGCMS, fullName, type SurveyInterview } from "../store/gcmsStore";

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  padding: 24,
  background:
    "radial-gradient(1100px 500px at 20% -20%, rgba(99,102,241,0.16), transparent 55%), #f4f6fb",
};

const containerStyle: React.CSSProperties = {
  maxWidth: 1000,
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

const btn: React.CSSProperties = {
  height: 40,
  padding: "0 14px",
  borderRadius: 12,
  border: "1px solid rgba(15,23,42,0.12)",
  background: "white",
  fontWeight: 900,
  cursor: "pointer",
  color: "#0f172a",
  textDecoration: "none",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};

const btnPrimary: React.CSSProperties = {
  ...btn,
  border: "1px solid rgba(99,102,241,0.35)",
  background:
    "linear-gradient(180deg, rgba(99,102,241,0.16), rgba(99,102,241,0.08))",
};

const inputStyle: React.CSSProperties = {
  height: 40,
  borderRadius: 12,
  border: "1px solid rgba(15,23,42,0.12)",
  padding: "0 12px",
  outline: "none",
  width: "100%",
  background: "white",
};

const textareaStyle: React.CSSProperties = {
  borderRadius: 12,
  border: "1px solid rgba(15,23,42,0.12)",
  padding: "10px 12px",
  outline: "none",
  width: "100%",
  minHeight: 110,
  background: "white",
};

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 10px",
        borderRadius: 999,
        border: "1px solid rgba(15,23,42,0.10)",
        background: "rgba(255,255,255,0.9)",
        fontSize: 12,
        fontWeight: 900,
        color: "#0f172a",
      }}
    >
      {children}
    </span>
  );
}

function ScorePill({ label, value }: { label: string; value: number }) {
  const color = value <= 3 ? "#22c55e" : value <= 7 ? "#f59e0b" : "#ef4444";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
        padding: "8px 10px",
        borderRadius: 999,
        border: `1px solid ${color}55`,
        background: `${color}16`,
        fontSize: 12,
        fontWeight: 950,
        color,
        minWidth: 170,
      }}
    >
      {label}
      <span style={{ color: "#0f172a" }}>{value}/10</span>
    </span>
  );
}

export default function Survey() {
  const { currentUser, survey_interviews, setSurveyInterviews } = useGCMS();
  const myUserId = currentUser?.users_id;

  const mySurvey = useMemo(() => {
    if (!myUserId) return null;
    return (
      survey_interviews.find((s) => s.student_user_id === myUserId) ?? null
    );
  }, [myUserId, survey_interviews]);

  const submittedAt = mySurvey?.submitted_at
    ? new Date(mySurvey.submitted_at)
    : null;

  // Form state (this is UI-only for now; you can later persist answers in DB)
  const [academicYear, setAcademicYear] = useState<string>(
    mySurvey?.academic_year ?? "2025-2026",
  );
  const [mood, setMood] = useState<number>(6);
  const [stress, setStress] = useState<number>(6);
  const [sleep, setSleep] = useState<number>(6);
  const [concerns, setConcerns] = useState<string>("");
  const [consent, setConsent] = useState<boolean>(true);

  const isSubmitted = Boolean(mySurvey?.submitted_at);

  const submitSurvey = () => {
    if (!myUserId) {
      alert("No student is logged in in GCMS store. Please login as student.");
      return;
    }
    if (!consent) {
      alert("Please confirm consent to submit.");
      return;
    }

    setSurveyInterviews((prev) => {
      const nowIso = new Date().toISOString();

      // Update existing
      const idx = prev.findIndex((s) => s.student_user_id === myUserId);
      if (idx !== -1) {
        const updated: SurveyInterview = {
          ...prev[idx],
          academic_year: academicYear,
          submitted_at: nowIso,
        };
        const copy = [...prev];
        copy[idx] = updated;
        return copy;
      }

      // Create new
      const nextId =
        prev.reduce((m, x) => Math.max(m, x.survey_interview_id), 0) + 1;
      const created: SurveyInterview = {
        survey_interview_id: nextId,
        student_user_id: myUserId,
        academic_year: academicYear,
        submitted_at: nowIso,
      };
      return [created, ...prev];
    });

    alert("Survey submitted!");
  };

  const editSurvey = () => {
    if (!myUserId) return;
    setSurveyInterviews((prev) => {
      const idx = prev.findIndex((s) => s.student_user_id === myUserId);
      if (idx === -1) return prev;
      const copy = [...prev];
      copy[idx] = { ...copy[idx], submitted_at: undefined };
      return copy;
    });
  };

  if (!currentUser) {
    return (
      <div style={pageStyle}>
        <div style={containerStyle}>
          <div style={cardStyle}>
            <h1 style={{ margin: 0, fontSize: 26 }}>Survey</h1>
            <div style={divider} />
            <p style={{ color: "#64748b", margin: 0 }}>
              Your `useGCMS.currentUser` is null.
              <br />
              Make sure your student login sets `useGCMS.currentUser` (demo:
              `loginAs("student")`).
            </p>
            <div style={{ marginTop: 12 }}>
              <Link to="/app/dashboard" style={btnPrimary}>
                Back to Dashboard →
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      <div style={containerStyle}>
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
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
              Student Survey
            </h1>
            <p style={{ margin: "6px 0 0", color: "#64748b" }}>
              Help guidance understand how you’re doing this term.
            </p>
          </div>

          <div
            style={{
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <Pill>👤 {fullName(currentUser)}</Pill>
            <Pill>🧾 Status: {isSubmitted ? "Done" : "Pending"}</Pill>
            <Link to="/app/dashboard" style={btn}>
              ← Dashboard
            </Link>
          </div>
        </div>

        {/* Status / info */}
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
            <div style={{ fontWeight: 950, color: "#0f172a" }}>
              {isSubmitted
                ? "Your survey is submitted ✅"
                : "Your survey is not submitted yet"}
              {submittedAt ? (
                <div style={{ marginTop: 6, color: "#64748b", fontSize: 13 }}>
                  Submitted: {submittedAt.toLocaleString()}
                </div>
              ) : (
                <div style={{ marginTop: 6, color: "#64748b", fontSize: 13 }}>
                  Please answer honestly. This helps your counselor support you
                  better.
                </div>
              )}
            </div>

            {isSubmitted ? (
              <button onClick={editSurvey} style={btn}>
                Edit / Resubmit
              </button>
            ) : (
              <button onClick={submitSurvey} style={btnPrimary}>
                Submit Survey
              </button>
            )}
          </div>
        </div>

        {/* Survey Form */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 16,
            alignItems: "start",
          }}
        >
          {/* Left */}
          <div style={{ ...cardStyle }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 900,
                color: "#334155",
                textTransform: "uppercase",
              }}
            >
              Basic Details
            </div>
            <div style={divider} />

            <div style={{ display: "grid", gap: 12 }}>
              <div>
                <div
                  style={{
                    fontSize: 12,
                    color: "#64748b",
                    fontWeight: 900,
                    marginBottom: 6,
                  }}
                >
                  Academic Year
                </div>
                <input
                  value={academicYear}
                  onChange={(e) => setAcademicYear(e.target.value)}
                  style={inputStyle}
                  placeholder="e.g., 2025-2026"
                />
              </div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <ScorePill label="Mood" value={mood} />
                <ScorePill label="Stress" value={stress} />
                <ScorePill label="Sleep" value={sleep} />
              </div>

              <div style={{ display: "grid", gap: 10 }}>
                <Range
                  label="Mood (1 low - 10 high)"
                  value={mood}
                  setValue={setMood}
                />
                <Range
                  label="Stress (1 low - 10 high)"
                  value={stress}
                  setValue={setStress}
                />
                <Range
                  label="Sleep Quality (1 poor - 10 great)"
                  value={sleep}
                  setValue={setSleep}
                />
              </div>
            </div>
          </div>

          {/* Right */}
          <div style={{ ...cardStyle }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 900,
                color: "#334155",
                textTransform: "uppercase",
              }}
            >
              Concerns & Notes
            </div>
            <div style={divider} />

            <div style={{ display: "grid", gap: 12 }}>
              <div>
                <div
                  style={{
                    fontSize: 12,
                    color: "#64748b",
                    fontWeight: 900,
                    marginBottom: 6,
                  }}
                >
                  What’s your biggest concern right now?
                </div>
                <textarea
                  value={concerns}
                  onChange={(e) => setConcerns(e.target.value)}
                  style={textareaStyle}
                  placeholder="e.g., academic pressure, family concerns, anxiety, time management..."
                />
              </div>

              <label
                style={{
                  display: "flex",
                  gap: 10,
                  alignItems: "flex-start",
                  color: "#334155",
                  fontWeight: 800,
                }}
              >
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  style={{ marginTop: 4 }}
                />
                I confirm this information is truthful and I understand it will
                be used for guidance support.
              </label>

              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: 10,
                  flexWrap: "wrap",
                }}
              >
                <Link to="/app/dashboard" style={btn}>
                  Cancel
                </Link>
                <button onClick={submitSurvey} style={btnPrimary}>
                  Submit Survey
                </button>
              </div>

              <div style={{ color: "#64748b", fontSize: 13 }}>
                Note: For now, this page stores “submitted_at” only. Later, we
                can store the answers in your ERD tables.
              </div>
            </div>
          </div>
        </div>

        {/* Quick links */}
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
            <div style={{ fontWeight: 950, color: "#0f172a" }}>Next steps</div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Link to="/app/my-counseling" style={btnPrimary}>
                My Counseling
              </Link>
              <Link to="/app/my-referrals" style={btn}>
                My Referrals
              </Link>
            </div>
          </div>
        </div>

        <style>{`
          @media (max-width: 900px) {
            .grid { grid-template-columns: 1fr !important; }
          }
        `}</style>
      </div>
    </div>
  );
}

function Range({
  label,
  value,
  setValue,
}: {
  label: string;
  value: number;
  setValue: (n: number) => void;
}) {
  return (
    <div
      style={{
        padding: 12,
        borderRadius: 14,
        border: "1px solid rgba(15,23,42,0.08)",
        background: "rgba(248,250,252,1)",
      }}
    >
      <div
        style={{
          fontSize: 12,
          color: "#64748b",
          fontWeight: 900,
          marginBottom: 8,
        }}
      >
        {label}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <input
          type="range"
          min={1}
          max={10}
          value={value}
          onChange={(e) => setValue(Number(e.target.value))}
          style={{ width: "100%" }}
        />
        <div
          style={{
            width: 42,
            textAlign: "right",
            fontWeight: 950,
            color: "#0f172a",
          }}
        >
          {value}
        </div>
      </div>
    </div>
  );
}
