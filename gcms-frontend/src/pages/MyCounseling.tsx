import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  CirclePlus,
  ClipboardList,
  Eye,
  FileText,
  History,
  Users,
} from "lucide-react";
import Modal from "../components/Modal";
import {
  createCounselingCase,
  type CounselingCase as SessionCounselingCase,
} from "../lib/entitiesApi";
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

const SESSION_CASES_KEY = "gcms_mock_counseling_cases_v2";
const MOCK_USERS_KEY = "gcms_mock_users_v1";
const YEARS_KEY = "gcms_mock_academic_years_v1";

type CachedStudentProfile = {
  id?: number;
  users_id?: number;
  collegeId?: number | null;
  college_id?: number | null;
  yearLevelId?: number | null;
  year_level_id?: number | null;
};

type AcademicYearRecord = {
  id: number;
  name: string;
  isActive?: boolean;
};

function loadLocal<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function saveLocal<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value));
}

function toPositiveNumber(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function todayDateKey() {
  return toDateKey(new Date());
}

function getActiveAcademicYearId() {
  const years = loadLocal<AcademicYearRecord[]>(YEARS_KEY, []);
  return (
    years.find((year) => year.isActive)?.id ??
    years[0]?.id ??
    2
  );
}

function upsertSessionCase(
  cases: SessionCounselingCase[],
  item: SessionCounselingCase,
) {
  const withoutCurrent = cases.filter((entry) => entry.id !== item.id);
  return [item, ...withoutCurrent];
}

function formatDate(value?: string) {
  const dt = value ? new Date(value) : null;
  if (!dt || Number.isNaN(dt.getTime())) return "-";
  return dt.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function toDateKey(value?: string | Date) {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    return value.slice(0, 10);
  }

  const dt =
    value instanceof Date ? value : value ? new Date(value) : new Date();
  if (Number.isNaN(dt.getTime())) return "";
  const year = dt.getFullYear();
  const month = String(dt.getMonth() + 1).padStart(2, "0");
  const day = String(dt.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatSessionTime(value?: string) {
  if (!value) return "-";
  const [hourPart, minutePart] = String(value).split(":");
  const hours = Number(hourPart);
  const minutes = Number(minutePart);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes))
    return String(value);
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
  flexShrink: 0,
};

const iconButtonGroup: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  flexShrink: 0,
};

const tableWrap: React.CSSProperties = {
  border: "1px solid rgba(15,23,42,0.08)",
  borderRadius: 14,
  background: "rgba(248,250,252,0.8)",
  overflowX: "auto",
};

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "12px 16px",
  color: "#475569",
  fontSize: 12,
  fontWeight: 900,
  whiteSpace: "nowrap",
};

const tdStyle: React.CSSProperties = {
  padding: "14px 16px",
  color: "#334155",
  fontSize: 13,
  fontWeight: 700,
  verticalAlign: "top",
};

const modalIconLink: React.CSSProperties = {
  width: 38,
  height: 38,
  borderRadius: 10,
  border: "1px solid rgba(15,23,42,0.12)",
  background: "white",
  color: "#0f172a",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  textDecoration: "none",
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

  const todayKey = useMemo(() => toDateKey(), []);
  const upcomingStudentCircles = useMemo(() => {
    return [...mySessions]
      .filter((item) => toDateKey(item.session_date) >= todayKey)
      .sort((a, b) =>
        `${toDateKey(a.session_date)} ${a.session_time || ""}`.localeCompare(
          `${toDateKey(b.session_date)} ${b.session_time || ""}`,
        ),
      );
  }, [mySessions, todayKey]);
  const studentCircleHistory = useMemo(() => {
    return [...mySessions]
      .filter((item) => toDateKey(item.session_date) < todayKey)
      .sort((a, b) =>
        `${toDateKey(b.session_date)} ${b.session_time || ""}`.localeCompare(
          `${toDateKey(a.session_date)} ${a.session_time || ""}`,
        ),
      );
  }, [mySessions, todayKey]);
  const currentCase = myCases[0] ?? null;

  const [openRequest, setOpenRequest] = useState(false);
  const [openCurrentCase, setOpenCurrentCase] = useState(false);
  const [openAllCases, setOpenAllCases] = useState(false);
  const [openStudentCircles, setOpenStudentCircles] = useState(false);
  const [studentCircleMode, setStudentCircleMode] = useState<
    "all" | "upcoming" | "history"
  >("all");
  const [selectedReasons, setSelectedReasons] = useState<string[]>([]);
  const [details, setDetails] = useState("");
  const [requestSaving, setRequestSaving] = useState(false);
  const [requestError, setRequestError] = useState("");

  const toggleReason = (reason: string) => {
    setSelectedReasons((prev) =>
      prev.includes(reason)
        ? prev.filter((item) => item !== reason)
        : [...prev, reason],
    );
  };

  const canSubmit = selectedReasons.length > 0 && myUserId > 0 && !requestSaving;

  const resolveRequestProfile = () => {
    const legacyUser = users.find((item) => item.users_id === myUserId);
    const mockUser = loadLocal<CachedStudentProfile[]>(MOCK_USERS_KEY, []).find(
      (item) => toPositiveNumber(item.id ?? item.users_id) === myUserId,
    );

    return {
      academicYearId: getActiveAcademicYearId(),
      collegeId: toPositiveNumber(
        currentUser?.collegeId ??
          legacyUser?.collegeId ??
          mockUser?.collegeId ??
          mockUser?.college_id,
      ),
      yearLevelId: toPositiveNumber(
        currentUser?.yearLevelId ??
          legacyUser?.yearLevelId ??
          mockUser?.yearLevelId ??
          mockUser?.year_level_id,
      ),
    };
  };

  const submitRequest = async () => {
    if (!canSubmit) return;

    const profile = resolveRequestProfile();
    const reason = selectedReasons.join(", ");
    const cleanNotes = details.trim() || undefined;
    const requestDate = todayDateKey();
    const cachedCases = loadLocal<SessionCounselingCase[]>(
      SESSION_CASES_KEY,
      [],
    );
    const fallbackId =
      cachedCases.reduce((max, item) => Math.max(max, item.id), 0) + 1;
    let createdCase: SessionCounselingCase = {
      id: fallbackId,
      studentId: myUserId,
      academicYearId: profile.academicYearId,
      collegeId: profile.collegeId,
      yearLevelId: profile.yearLevelId,
      date: requestDate,
      status: "Pending",
      reason,
      notes: cleanNotes,
      studentRequest: true,
      createdByUserId: myUserId,
      createdByRole: "STUDENT",
      createdAt: new Date().toISOString(),
    };

    setRequestSaving(true);
    setRequestError("");

    try {
      const res = await createCounselingCase({
        studentId: myUserId,
        academicYearId: profile.academicYearId,
        collegeId: profile.collegeId,
        yearLevelId: profile.yearLevelId,
        date: requestDate,
        status: "Pending",
        studentRequest: true,
        reason,
        notes: cleanNotes,
      });

      const createdId =
        typeof res.id === "number" && Number.isFinite(res.id)
          ? res.id
          : fallbackId;
      createdCase = {
        ...createdCase,
        id: createdId,
      };
      const apiCases =
        res.cases && res.cases.length > 0
          ? res.cases
          : upsertSessionCase(cachedCases, createdCase);
      saveLocal(SESSION_CASES_KEY, upsertSessionCase(apiCases, createdCase));
    } catch {
      saveLocal(SESSION_CASES_KEY, upsertSessionCase(cachedCases, createdCase));
      setRequestError(
        "Saved locally. The request will still appear in Sessions when this browser syncs state.",
      );
    }

    setCounseling((prev) => [
      {
        counseling_id: createdCase.id,
        student_user_id: myUserId,
        counselor_user_id:
          createdCase.STAFFUserId ?? createdCase.counselorUserId ?? null,
        counseling_date: createdCase.date,
        counseling_time: createdCase.time ?? undefined,
        status: "pending",
        reason: createdCase.reason,
        notes: createdCase.notes,
      },
      ...prev.filter((item) => item.counseling_id !== createdCase.id),
    ]);

    setSelectedReasons([]);
    setDetails("");
    setOpenRequest(false);
    setRequestSaving(false);
  };

  const getStaffName = (staffUserId?: number | null) => {
    if (!staffUserId) return "To be assigned";
    const staffUser = users.find((item) => item.users_id === staffUserId);
    return staffUser ? fullName(staffUser) : "To be assigned";
  };

  const openStudentCircleList = (
    mode: "all" | "upcoming" | "history" = "all",
  ) => {
    setStudentCircleMode(mode);
    setOpenStudentCircles(true);
  };

  const visibleStudentCircles =
    studentCircleMode === "history"
      ? studentCircleHistory
      : studentCircleMode === "upcoming"
        ? upcomingStudentCircles
        : mySessions;
  const studentCircleModalTitle =
    studentCircleMode === "history"
      ? "Group Counselling History"
      : studentCircleMode === "upcoming"
        ? "Upcoming Group Counselling"
        : "All Group Counselling";
  const openCardWithKeyboard = (
    event: React.KeyboardEvent<HTMLDivElement>,
    action: () => void,
  ) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      action();
    }
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
            View your counseling cases and Group Counselling sessions in one place.
          </p>
        </div>

        <button
          onClick={() => {
            setRequestError("");
            setOpenRequest(true);
          }}
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

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 14,
        }}
      >
        <div
          className="clickableSummaryCard"
          role="button"
          tabIndex={0}
          onClick={() => setOpenCurrentCase(true)}
          onKeyDown={(event) =>
            openCardWithKeyboard(event, () => setOpenCurrentCase(true))
          }
          aria-label="Show current case table"
          style={sectionCard}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <div
              style={{
                fontWeight: 900,
                letterSpacing: 0.4,
                color: "#0f172a",
                fontSize: 12,
              }}
            >
              CURRENT CASE
            </div>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setOpenCurrentCase(true);
              }}
              title="Show current case"
              aria-label="Show current case"
              style={iconLauncher}
            >
              <FileText size={18} />
            </button>
          </div>
          <div
            style={{
              marginTop: 12,
              color: "#64748b",
              fontWeight: 700,
              fontSize: 13,
            }}
          >
            {loading && !currentCase
              ? "Loading latest case..."
              : currentCase
                ? `Latest: ${formatDate(currentCase.counseling_date)}`
                : "No current case yet."}
          </div>
        </div>

        <div
          className="clickableSummaryCard"
          role="button"
          tabIndex={0}
          onClick={() => openStudentCircleList("all")}
          onKeyDown={(event) =>
            openCardWithKeyboard(event, () => openStudentCircleList("all"))
          }
          aria-label="Show all Group Counselling sessions table"
          style={sectionCard}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <div
              style={{
                fontWeight: 900,
                letterSpacing: 0.4,
                color: "#0f172a",
                fontSize: 12,
              }}
            >
              MY STUDENT CIRCLES
            </div>
            <div style={iconButtonGroup}>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  openStudentCircleList("upcoming");
                }}
                title="Show upcoming Group Counselling sessions"
                aria-label="Show upcoming Group Counselling sessions"
                style={iconLauncher}
              >
                <Users size={18} />
              </button>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  openStudentCircleList("history");
                }}
                title="Show Group Counselling history"
                aria-label="Show Group Counselling history"
                style={iconLauncher}
              >
                <History size={18} />
              </button>
            </div>
          </div>
          <div
            style={{
              marginTop: 12,
              color: "#64748b",
              fontWeight: 700,
              fontSize: 13,
            }}
          >
            Upcoming: {upcomingStudentCircles.length} | History:{" "}
            {studentCircleHistory.length}
          </div>
        </div>

        <div
          className="clickableSummaryCard"
          role="button"
          tabIndex={0}
          onClick={() => setOpenAllCases(true)}
          onKeyDown={(event) =>
            openCardWithKeyboard(event, () => setOpenAllCases(true))
          }
          aria-label="Show all my cases table"
          style={sectionCard}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <div
              style={{
                fontWeight: 900,
                letterSpacing: 0.4,
                color: "#0f172a",
                fontSize: 12,
              }}
            >
              ALL MY CASES
            </div>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setOpenAllCases(true);
              }}
              title="Show all my cases"
              aria-label="Show all my cases"
              style={iconLauncher}
            >
              <ClipboardList size={18} />
            </button>
          </div>
          <div
            style={{
              marginTop: 12,
              color: "#64748b",
              fontWeight: 700,
              fontSize: 13,
            }}
          >
            Total cases: {myCases.length}
          </div>
        </div>
      </div>

      <Modal
        open={openRequest}
        title="Request Counseling"
        onClose={() => {
          if (!requestSaving) setOpenRequest(false);
        }}
      >
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

          {requestError ? (
            <div
              style={{
                background: "rgba(251,191,36,0.14)",
                border: "1px solid rgba(217,119,6,0.24)",
                padding: 10,
                borderRadius: 10,
                fontSize: 12,
                fontWeight: 800,
                color: "#92400e",
              }}
            >
              {requestError}
            </div>
          ) : null}

          <div>
            <div
              style={{
                fontWeight: 800,
                color: "#334155",
                fontSize: 13,
                marginBottom: 8,
              }}
            >
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
              <div
                className="reasonsGrid"
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 8,
                }}
              >
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
                        background: checked
                          ? "rgba(15,23,42,0.05)"
                          : "transparent",
                        userSelect: "none",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleReason(reason)}
                      />
                      {reason}
                    </label>
                  );
                })}
              </div>
            </div>

            <div
              style={{
                marginTop: 6,
                fontSize: 11,
                color: "#64748b",
                fontWeight: 700,
              }}
            >
              Selected: {selectedReasons.length}
            </div>
          </div>

          <div>
            <div
              style={{
                fontWeight: 800,
                color: "#334155",
                fontSize: 13,
                marginBottom: 8,
              }}
            >
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
              disabled={requestSaving}
              style={{
                height: 36,
                padding: "0 14px",
                borderRadius: 10,
                border: "1px solid rgba(15,23,42,0.15)",
                background: "white",
                fontWeight: 900,
                fontSize: 12,
                cursor: requestSaving ? "not-allowed" : "pointer",
                opacity: requestSaving ? 0.65 : 1,
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
              {requestSaving ? "Creating..." : "Create"}
            </button>
          </div>

          {!canSubmit && !requestSaving && (
            <div style={{ fontSize: 11, color: "#ef4444", fontWeight: 700 }}>
              Please select at least one reason.
            </div>
          )}
        </div>
      </Modal>

      <Modal
        open={openCurrentCase}
        title="Current Case"
        onClose={() => setOpenCurrentCase(false)}
        contentStyle={{ width: "min(920px, 100%)" }}
      >
        {loading && myCases.length === 0 ? (
          <div style={{ color: "#64748b", fontWeight: 700 }}>
            Loading your counseling records...
          </div>
        ) : !currentCase ? (
          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ fontWeight: 900, color: "#0f172a" }}>
              No counseling cases yet
            </div>
            <div style={{ color: "#64748b", fontWeight: 600, fontSize: 13 }}>
              When admin or STAFFs create a case for you, it will show here
              automatically.
            </div>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            <div
              style={{
                justifySelf: "end",
                fontSize: 12,
                fontWeight: 900,
                border: "1px solid rgba(15,23,42,0.10)",
                padding: "4px 10px",
                borderRadius: 999,
                background: "rgba(255,255,255,0.85)",
              }}
            >
              Latest case
            </div>
            <div style={tableWrap}>
              <table
                style={{
                  width: "100%",
                  minWidth: 760,
                  borderCollapse: "collapse",
                }}
              >
                <thead>
                  <tr style={{ background: "rgba(255,255,255,0.72)" }}>
                    <th style={thStyle}>Case</th>
                    <th style={thStyle}>Date</th>
                    <th style={thStyle}>Time</th>
                    <th style={thStyle}>Staff</th>
                    <th style={thStyle}>Status</th>
                    <th style={thStyle}>Notes</th>
                    <th style={{ ...thStyle, width: 58 }}></th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={tdStyle}>
                      <div style={{ fontWeight: 900, color: "#0f172a" }}>
                        {currentCase.reason || "Counseling Request"}
                      </div>
                    </td>
                    <td
                      style={{
                        ...tdStyle,
                        color: "#475569",
                        fontWeight: 800,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {formatDate(currentCase.counseling_date)}
                    </td>
                    <td
                      style={{
                        ...tdStyle,
                        color: "#475569",
                        fontWeight: 800,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {formatSessionTime(currentCase.counseling_time)}
                    </td>
                    <td style={tdStyle}>
                      {getStaffName(currentCase.counselor_user_id)}
                    </td>
                    <td style={tdStyle}>{statusPill(currentCase.status)}</td>
                    <td
                      style={{
                        ...tdStyle,
                        maxWidth: 260,
                        whiteSpace: "pre-wrap",
                      }}
                    >
                      {currentCase.notes || "-"}
                    </td>
                    <td style={{ ...tdStyle, textAlign: "right" }}>
                      <Link
                        to={`/app/my-counseling/${currentCase.counseling_id}`}
                        title="View case"
                        aria-label="View case"
                        style={modalIconLink}
                      >
                        <Eye size={16} />
                      </Link>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={openAllCases}
        title="All My Cases"
        onClose={() => setOpenAllCases(false)}
        contentStyle={{ width: "min(920px, 100%)" }}
      >
        {loading && myCases.length === 0 ? (
          <div style={{ color: "#64748b", fontWeight: 700 }}>
            Loading your case list...
          </div>
        ) : myCases.length === 0 ? (
          <div style={{ color: "#64748b", fontWeight: 700 }}>No cases yet.</div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            <div
              style={{
                justifySelf: "end",
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
            <div style={tableWrap}>
              <table
                style={{
                  width: "100%",
                  minWidth: 700,
                  borderCollapse: "collapse",
                }}
              >
                <thead>
                  <tr style={{ background: "rgba(255,255,255,0.72)" }}>
                    <th style={thStyle}>Case</th>
                    <th style={thStyle}>Date</th>
                    <th style={thStyle}>Time</th>
                    <th style={thStyle}>Staff</th>
                    <th style={thStyle}>Status</th>
                    <th style={{ ...thStyle, width: 58 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {myCases.map((item, index) => (
                    <tr
                      key={item.counseling_id}
                      style={{
                        borderTop:
                          index === 0
                            ? "none"
                            : "1px solid rgba(15,23,42,0.08)",
                      }}
                    >
                      <td style={tdStyle}>
                        <div style={{ fontWeight: 900, color: "#0f172a" }}>
                          {item.reason || "Counseling Request"}
                        </div>
                        {!!item.notes && (
                          <div
                            style={{
                              color: "#64748b",
                              fontSize: 12,
                              fontWeight: 700,
                              marginTop: 4,
                              whiteSpace: "pre-wrap",
                            }}
                          >
                            {item.notes}
                          </div>
                        )}
                      </td>
                      <td
                        style={{
                          ...tdStyle,
                          color: "#475569",
                          fontWeight: 800,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {formatDate(item.counseling_date)}
                      </td>
                      <td
                        style={{
                          ...tdStyle,
                          color: "#475569",
                          fontWeight: 800,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {formatSessionTime(item.counseling_time)}
                      </td>
                      <td style={tdStyle}>
                        {getStaffName(item.counselor_user_id)}
                      </td>
                      <td style={tdStyle}>{statusPill(item.status)}</td>
                      <td style={{ ...tdStyle, textAlign: "right" }}>
                        <Link
                          to={`/app/my-counseling/${item.counseling_id}`}
                          title="View case"
                          aria-label="View case"
                          style={modalIconLink}
                        >
                          <Eye size={16} />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={openStudentCircles}
        title={studentCircleModalTitle}
        onClose={() => setOpenStudentCircles(false)}
        contentStyle={{ width: "min(920px, 100%)" }}
      >
        {loading && mySessions.length === 0 ? (
          <div style={{ color: "#64748b", fontWeight: 700 }}>
            Loading your Group Counselling sessions...
          </div>
        ) : visibleStudentCircles.length === 0 ? (
          <div style={{ color: "#64748b", fontWeight: 700 }}>
            {studentCircleMode === "history"
              ? "No Group Counselling history yet."
              : studentCircleMode === "upcoming"
                ? "No upcoming Group Counselling sessions assigned yet."
                : "No Group Counselling sessions assigned yet."}
          </div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            <div
              style={{
                justifySelf: "end",
                fontSize: 12,
                fontWeight: 900,
                border: "1px solid rgba(15,23,42,0.10)",
                padding: "4px 10px",
                borderRadius: 999,
                background: "rgba(255,255,255,0.85)",
              }}
            >
              Total: {visibleStudentCircles.length}
            </div>
            <div style={tableWrap}>
              <table
                style={{
                  width: "100%",
                  minWidth: 760,
                  borderCollapse: "collapse",
                }}
              >
                <thead>
                  <tr style={{ background: "rgba(255,255,255,0.72)" }}>
                    <th style={thStyle}>Topic</th>
                    <th style={thStyle}>Facilitator</th>
                    <th style={thStyle}>Location</th>
                    <th style={thStyle}>Date</th>
                    <th style={thStyle}>Time</th>
                    <th style={thStyle}>Type</th>
                    <th style={{ ...thStyle, width: 58 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {visibleStudentCircles.map((session, index) => (
                    <tr
                      key={session.group_session_id}
                      style={{
                        borderTop:
                          index === 0
                            ? "none"
                            : "1px solid rgba(15,23,42,0.08)",
                      }}
                    >
                      <td
                        style={{
                          ...tdStyle,
                          fontWeight: 900,
                          color: "#0f172a",
                        }}
                      >
                        {session.topic || session.notes || "Group Counselling"}
                      </td>
                      <td style={tdStyle}>
                        {session.facilitator || "To be announced"}
                      </td>
                      <td style={tdStyle}>{session.location || "TBA"}</td>
                      <td
                        style={{
                          ...tdStyle,
                          color: "#475569",
                          fontWeight: 800,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {formatDate(session.session_date)}
                      </td>
                      <td
                        style={{
                          ...tdStyle,
                          color: "#475569",
                          fontWeight: 800,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {formatSessionTime(session.session_time)}
                      </td>
                      <td style={tdStyle}>
                        {toDateKey(session.session_date) >= todayKey
                          ? "Upcoming"
                          : "History"}
                      </td>
                      <td style={{ ...tdStyle, textAlign: "right" }}>
                        <Link
                          to={`/app/my-counseling/student-circles/${session.group_session_id}`}
                          title="View Group Counselling"
                          aria-label="View Group Counselling"
                          style={modalIconLink}
                        >
                          <Eye size={16} />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
