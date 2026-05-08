import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CirclePlus, FileText, Users } from "lucide-react";
import Modal from "../components/Modal";
import FormattedDateInput from "../components/FormattedDateInput";
import { fullName, useGCMS } from "../store/gcmsStore";
import useStudentPortalSync from "../hooks/useStudentPortalSync";
import "./MyCounseling.css";

const REASONS = [
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
  "Others (Please specify)",
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
];

function formatDate(value?: string) {
  const dt = value ? new Date(value) : null;
  if (!dt || Number.isNaN(dt.getTime())) return "-";
  return dt.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatSessionTime(value?: string) {
  if (!value) return "-";
  const [hourPart, minutePart] = String(value).split(":");
  const hours = Number(hourPart);
  const minutes = Number(minutePart);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return String(value);
  const normalized = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  if (normalized === "09:00") return "9 AM - 11 AM";
  if (normalized === "13:00") return "1 PM - 3 PM";
  if (normalized === "15:00") return "3 PM - 5 PM";
  const suffix = hours >= 12 ? "PM" : "AM";
  const displayHour = hours % 12 || 12;
  return `${displayHour}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

function statusPill(status: string) {
  const normalized = String(status || "").toLowerCase();
  const palette =
    normalized === "ongoing"
      ? { bg: "#bfdbfe", color: "#1d4ed8", label: "Ongoing" }
      : normalized === "done" || normalized === "completed"
        ? { bg: "#bbf7d0", color: "#166534", label: "Completed" }
        : normalized === "cancelled"
          ? { bg: "#e2e8f0", color: "#475569", label: "Cancelled" }
          : { bg: "#fde68a", color: "#92400e", label: "Pending" };

  return (
    <span
      style={{
        padding: "6px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 900,
        color: palette.color,
        background: palette.bg,
        display: "inline-flex",
        alignItems: "center",
      }}
    >
      {palette.label}
    </span>
  );
}

const sectionCard: React.CSSProperties = {
  background: "rgba(255,255,255,0.92)",
  border: "1px solid rgba(15,23,42,0.08)",
  borderRadius: 16,
  boxShadow: "0 18px 50px rgba(2,6,23,0.10)",
  padding: 16,
};

const iconLauncher: React.CSSProperties = {
  width: 52,
  height: 52,
  borderRadius: 14,
  border: "1px solid rgba(15,23,42,0.10)",
  background: "rgba(255,255,255,0.88)",
  color: "#0f172a",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
};

export default function MyCounseling() {
  const { loading } = useStudentPortalSync();
  const {
    currentUser,
    users,
    counseling,
    group_sessions,
    group_session_members,
    setCounseling,
  } = useGCMS();
  const myUserId = currentUser?.users_id ?? 0;

  const myCases = useMemo(() => {
    return [...counseling]
      .filter((item) => item.student_user_id === myUserId)
      .sort(
        (a, b) =>
          new Date(b.counseling_date || 0).getTime() -
          new Date(a.counseling_date || 0).getTime(),
      );
  }, [counseling, myUserId]);

  const mySessions = useMemo(() => {
    const sessionIds = new Set(
      group_session_members
        .filter((item) => item.student_user_id === myUserId)
        .map((item) => item.group_session_id),
    );

    return [...group_sessions]
      .filter((item) => sessionIds.has(item.group_session_id))
      .sort(
        (a, b) =>
          new Date(b.session_date || 0).getTime() -
          new Date(a.session_date || 0).getTime(),
      );
  }, [group_session_members, group_sessions, myUserId]);

  const currentCase = myCases[0] ?? null;

  const [openRequest, setOpenRequest] = useState(false);
  const [openCurrentCase, setOpenCurrentCase] = useState(false);
  const [openStudentCircles, setOpenStudentCircles] = useState(false);
  const [selectedReasons, setSelectedReasons] = useState<string[]>([]);
  const [details, setDetails] = useState("");
  const [preferredDate, setPreferredDate] = useState("");
  const [preferredTime, setPreferredTime] = useState("");

  const toggleReason = (reason: string) => {
    setSelectedReasons((prev) =>
      prev.includes(reason)
        ? prev.filter((item) => item !== reason)
        : [...prev, reason],
    );
  };

  const canSubmit =
    selectedReasons.length > 0 &&
    preferredDate.trim().length > 0 &&
    preferredTime.trim().length > 0 &&
    myUserId > 0;

  const submitRequest = () => {
    if (!canSubmit) return;

    setCounseling((prev) => {
      const nextId =
        prev.reduce((max, item) => Math.max(max, item.counseling_id), 0) + 1;

      return [
        {
          counseling_id: nextId,
          student_user_id: myUserId,
          counselor_user_id: 0,
          counseling_date: preferredDate,
          status: "pending",
          reason: selectedReasons.join(", "),
          notes: [`Preferred time: ${preferredTime}`, details.trim()]
            .filter(Boolean)
            .join("\n"),
        },
        ...prev,
      ];
    });

    setSelectedReasons([]);
    setDetails("");
    setPreferredDate("");
    setPreferredTime("");
    setOpenRequest(false);
  };

  const getStaffName = (staffUserId?: number) => {
    if (!staffUserId) return "To be assigned";
    const staffUser = users.find((item) => item.users_id === staffUserId);
    return staffUser ? fullName(staffUser) : "To be assigned";
  };

  return (
    <div style={{ padding: 24, width: "100%", boxSizing: "border-box" }}>
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 16,
          marginBottom: 18,
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: 30 }}>My Counseling</h1>
          <p style={{ margin: "6px 0 0", color: "#64748b", fontWeight: 600 }}>
            View your counseling cases and Student Circles in one place.
          </p>
        </div>

        <button
          onClick={() => setOpenRequest(true)}
          title="Request Counseling"
          aria-label="Request Counseling"
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            border: "1px solid rgba(15,23,42,0.7)",
            background:
              "linear-gradient(180deg, rgba(15,23,42,0.96), rgba(2,6,23,0.98))",
            color: "white",
            fontWeight: 900,
            cursor: "pointer",
            boxShadow: "0 8px 18px rgba(2,6,23,0.08)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <CirclePlus size={18} />
        </button>
      </div>

      <div style={{ display: "grid", gap: 14 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 14,
          }}
        >
          <div style={sectionCard}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
              <div style={{ fontWeight: 900, letterSpacing: 0.4, color: "#0f172a", fontSize: 12 }}>
                CURRENT CASE
              </div>
              <button
                type="button"
                onClick={() => setOpenCurrentCase(true)}
                title="Show current case"
                aria-label="Show current case"
                style={iconLauncher}
              >
                <FileText size={18} />
              </button>
            </div>
            <div style={{ marginTop: 12, color: "#64748b", fontWeight: 700, fontSize: 13 }}>
              Tap the icon to open your current counseling case.
            </div>
          </div>

          <div style={sectionCard}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
              <div style={{ fontWeight: 900, letterSpacing: 0.4, color: "#0f172a", fontSize: 12 }}>
                MY STUDENT CIRCLES
              </div>
              <button
                type="button"
                onClick={() => setOpenStudentCircles(true)}
                title="Show My Student Circles"
                aria-label="Show My Student Circles"
                style={iconLauncher}
              >
                <Users size={18} />
              </button>
            </div>
            <div style={{ marginTop: 12, color: "#64748b", fontWeight: 700, fontSize: 13 }}>
              Tap the icon to open your Student Circle schedule.
            </div>
          </div>
        </div>
        <div style={sectionCard}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <div style={{ fontWeight: 900, letterSpacing: 0.4, color: "#0f172a", fontSize: 12 }}>
              ALL MY CASES
            </div>
            <div
              style={{
                fontSize: 12,
                fontWeight: 900,
                border: "1px solid rgba(15,23,42,0.10)",
                padding: "4px 10px",
                borderRadius: 999,
                background: "rgba(255,255,255,0.85)",
              }}
            >
              Total: {myCases.length}
            </div>
          </div>

          <div style={{ marginTop: 12 }}>
            {loading && myCases.length === 0 ? (
              <div style={{ color: "#64748b", fontWeight: 700 }}>
                Loading your case list...
              </div>
            ) : myCases.length === 0 ? (
              <div style={{ color: "#64748b", fontWeight: 700 }}>No cases yet.</div>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {myCases.map((item) => (
                  <Link
                    key={item.counseling_id}
                    to={`/app/my-counseling/${item.counseling_id}`}
                    style={{
                      border: "1px solid rgba(15,23,42,0.08)",
                      borderRadius: 14,
                      padding: 12,
                      background: "rgba(248,250,252,0.8)",
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 12,
                      alignItems: "flex-start",
                      textDecoration: "none",
                      color: "inherit",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 900, color: "#0f172a" }}>
                        {item.reason || "Counseling Request"}
                      </div>
                      <div
                        style={{
                          color: "#64748b",
                          fontWeight: 700,
                          fontSize: 13,
                          marginTop: 4,
                        }}
                      >
                        Date: {formatDate(item.counseling_date)}
                      </div>
                      {!!item.notes && (
                        <div
                          style={{
                            color: "#475569",
                            fontWeight: 700,
                            fontSize: 13,
                            marginTop: 4,
                            whiteSpace: "pre-wrap",
                          }}
                        >
                          {item.notes}
                        </div>
                      )}
                    </div>
                    {statusPill(item.status)}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <Modal open={openRequest} title="Request Counseling" onClose={() => setOpenRequest(false)}>
        <div style={{ display: "grid", gap: 14 }}>
          <div
            style={{
              background: "rgba(34,197,94,0.08)",
              border: "1px solid rgba(34,197,94,0.25)",
              padding: 10,
              borderRadius: 10,
              fontSize: 12,
              fontWeight: 700,
              color: "#166534",
            }}
          >
            Your information will remain confidential.
          </div>

          <div>
            <div style={{ fontWeight: 800, color: "#334155", fontSize: 13, marginBottom: 8 }}>
              Reason for Counseling * (Select all that apply)
            </div>

            <div
              style={{
                border: "1px solid rgba(15,23,42,0.12)",
                borderRadius: 12,
                padding: 10,
                background: "rgba(255,255,255,0.92)",
              }}
            >
              <div className="reasonsGrid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {REASONS.map((reason) => {
                  const checked = selectedReasons.includes(reason);

                  return (
                    <label
                      key={reason}
                      style={{
                        display: "flex",
                        gap: 8,
                        alignItems: "center",
                        padding: 4,
                        borderRadius: 8,
                        cursor: "pointer",
                        fontSize: 12,
                        fontWeight: 800,
                        color: "#0f172a",
                        background: checked ? "rgba(15,23,42,0.05)" : "transparent",
                        userSelect: "none",
                      }}
                    >
                      <input type="checkbox" checked={checked} onChange={() => toggleReason(reason)} />
                      {reason}
                    </label>
                  );
                })}
              </div>
            </div>

            <div style={{ marginTop: 6, fontSize: 11, color: "#64748b", fontWeight: 700 }}>
              Selected: {selectedReasons.length}
            </div>
          </div>

          <div>
            <div style={{ fontWeight: 800, color: "#334155", fontSize: 13, marginBottom: 8 }}>
              Preferred Schedule
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <div style={{ fontSize: 12, color: "#64748b", fontWeight: 900, marginBottom: 6 }}>
                  Preferred Date
                </div>
                <FormattedDateInput
                  value={preferredDate}
                  onChange={(e) => setPreferredDate(e.target.value)}
                  displayStyle={{ height: 36, borderRadius: 8, border: "1px solid rgba(15,23,42,0.15)", padding: "0 34px 0 10px", fontSize: 12, width: "100%" }}
                />
              </div>

              <div>
                <div style={{ fontSize: 12, color: "#64748b", fontWeight: 900, marginBottom: 6 }}>
                  Preferred Time
                </div>
                <input
                  type="time"
                  value={preferredTime}
                  onChange={(e) => setPreferredTime(e.target.value)}
                  style={{ height: 36, borderRadius: 8, border: "1px solid rgba(15,23,42,0.15)", padding: "0 10px", fontSize: 12, width: "100%" }}
                />
              </div>
            </div>
          </div>
          <div>
            <div style={{ fontWeight: 800, color: "#334155", fontSize: 13, marginBottom: 8 }}>
              Notes (optional)
            </div>

            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Write additional details here..."
              style={{
                width: "100%",
                minHeight: 80,
                borderRadius: 10,
                border: "1px solid rgba(15,23,42,0.15)",
                padding: 10,
                fontSize: 12,
              }}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <button
              onClick={() => setOpenRequest(false)}
              style={{
                height: 36,
                padding: "0 14px",
                borderRadius: 10,
                border: "1px solid rgba(15,23,42,0.15)",
                background: "white",
                fontWeight: 900,
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>

            <button
              onClick={submitRequest}
              disabled={!canSubmit}
              style={{
                height: 36,
                padding: "0 14px",
                borderRadius: 10,
                border: "none",
                background: canSubmit ? "#2563eb" : "rgba(37,99,235,0.35)",
                color: "white",
                fontWeight: 900,
                fontSize: 12,
                cursor: canSubmit ? "pointer" : "not-allowed",
              }}
            >
              Create
            </button>
          </div>

          {!canSubmit && (
            <div style={{ fontSize: 11, color: "#ef4444", fontWeight: 700 }}>
              Please select at least one reason and choose your preferred date and time.
            </div>
          )}
        </div>
      </Modal>

      <Modal open={openCurrentCase} title="Current Case" onClose={() => setOpenCurrentCase(false)}>
        {loading && myCases.length === 0 ? (
          <div style={{ color: "#64748b", fontWeight: 700 }}>Loading your counseling records...</div>
        ) : !currentCase ? (
          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ fontWeight: 900, color: "#0f172a" }}>No counseling cases yet</div>
            <div style={{ color: "#64748b", fontWeight: 600, fontSize: 13 }}>
              When admin or STAFFs create a case for you, it will show here automatically.
            </div>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div style={{ fontWeight: 900, color: "#0f172a" }}>{currentCase.reason || "Counseling Request"}</div>
              {statusPill(currentCase.status)}
            </div>
            <div style={{ color: "#64748b", fontWeight: 700, fontSize: 13 }}>
              Date: {formatDate(currentCase.counseling_date)}
            </div>
            <div style={{ color: "#64748b", fontWeight: 700, fontSize: 13 }}>
              Staff: {getStaffName(currentCase.counselor_user_id)}
            </div>
            {!!currentCase.notes && (
              <div style={{ color: "#0f172a", fontWeight: 650, whiteSpace: "pre-wrap" }}>{currentCase.notes}</div>
            )}
            <div>
              <Link
                to={`/app/my-counseling/${currentCase.counseling_id}`}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 12px",
                  borderRadius: 10,
                  textDecoration: "none",
                  border: "1px solid rgba(15,23,42,0.10)",
                  background: "white",
                  color: "#0f172a",
                  fontWeight: 900,
                }}
              >
                View details
              </Link>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={openStudentCircles} title="My Student Circles" onClose={() => setOpenStudentCircles(false)}>
        {loading && mySessions.length === 0 ? (
          <div style={{ color: "#64748b", fontWeight: 700 }}>Loading your Student Circles...</div>
        ) : mySessions.length === 0 ? (
          <div style={{ color: "#64748b", fontWeight: 700 }}>No Student Circles assigned yet.</div>
        ) : (
          <div style={{ border: "1px solid rgba(15,23,42,0.08)", borderRadius: 14, background: "rgba(248,250,252,0.8)", overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "rgba(255,255,255,0.72)" }}>
                  <th style={{ textAlign: "left", padding: "12px 16px", color: "#475569", fontSize: 12, fontWeight: 900 }}>Facilitator</th>
                  <th style={{ textAlign: "left", padding: "12px 16px", color: "#475569", fontSize: 12, fontWeight: 900 }}>Location</th>
                  <th style={{ textAlign: "left", padding: "12px 16px", color: "#475569", fontSize: 12, fontWeight: 900 }}>Date</th>
                  <th style={{ textAlign: "left", padding: "12px 16px", color: "#475569", fontSize: 12, fontWeight: 900 }}>Time</th>
                </tr>
              </thead>
              <tbody>
                {mySessions.map((session, index) => (
                  <tr key={session.group_session_id} style={{ borderTop: index === 0 ? "none" : "1px solid rgba(15,23,42,0.08)" }}>
                    <td style={{ padding: "14px 16px", color: "#334155", fontSize: 13, fontWeight: 700, verticalAlign: "top" }}>
                      {session.facilitator || "To be announced"}
                    </td>
                    <td style={{ padding: "14px 16px", color: "#334155", fontSize: 13, fontWeight: 700, verticalAlign: "top" }}>
                      {session.location || "TBA"}
                    </td>
                    <td style={{ padding: "14px 16px", color: "#475569", fontSize: 13, fontWeight: 800, verticalAlign: "top", whiteSpace: "nowrap" }}>
                      {formatDate(session.session_date)}
                    </td>
                    <td style={{ padding: "14px 16px", color: "#475569", fontSize: 13, fontWeight: 800, verticalAlign: "top", whiteSpace: "nowrap" }}>
                      {formatSessionTime(session.session_time)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>
    </div>
  );
}
