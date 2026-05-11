import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileDown,
  GraduationCap,
  Hash,
  School,
  UserRound,
} from "lucide-react";
import { useAuthStore } from "../store/authStore";
import {
  createReferralLog,
  deleteReferralLog,
  getReferral,
  listReferralLogs,
  updateReferral,
} from "../lib/entitiesApi";
import {
  canApproveSystemReferrals,
  canViewEverySystemReferral,
} from "../lib/referralApproval";
import { referralStatusLabel } from "../lib/referralStatus";
import {
  canPrintReferralCallSlip,
  downloadReferralCallSlipWord,
} from "../lib/referralCallSlipPrint";
import SuccessNoticeModal from "../components/SuccessNoticeModal";

type Role =
  | "ADMIN"
  | "STAFF"
  | "TEACHER"
  | "NON_TEACHING_PERSONNEL"
  | "STUDENT";

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
  referredDate?: string | null;
  referredTime?: string | null;
  approvedAt?: string | null;
  scheduleUpdatedAt?: string | null;
  completedAt?: string | null;
  reason: string; // comma separated
  notes?: string;
  status: "Pending" | "Approved" | "Complete";
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

function formatDateShort(iso?: string | null) {
  if (!iso) return "â€”";
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return iso;
  return dt.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

function formatTimeShort(value?: string | null) {
  if (!value) return "â€”";
  const [hourPart, minutePart] = String(value).split(":");
  const hours = Number(hourPart);
  const minutes = Number(minutePart);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return String(value);
  const suffix = hours >= 12 ? "PM" : "AM";
  const displayHour = hours % 12 || 12;
  return `${displayHour}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

function formatDateTimeParts(value?: string | null) {
  if (!value) return { date: "—", time: "—" };
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return { date: String(value), time: "—" };
  }

  return {
    date: parsed.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
    }),
    time: parsed.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    }),
  };
}

function normalizeReferralStatus(status: unknown): Referral["status"] {
  const normalized = String(status || "")
    .trim()
    .toLowerCase();

  if (
    normalized === "approved" ||
    normalized === "ongoing" ||
    normalized === "reviewed"
  ) {
    return "Approved";
  }
  if (
    normalized === "complete" ||
    normalized === "completed" ||
    normalized === "closed" ||
    normalized === "resolved"
  ) {
    return "Complete";
  }

  return "Pending";
}

function normalizeReferral(item: {
  id: number;
  studentId: number;
  referredByUserId: number;
  academicYearId: number;
  collegeId: number;
  yearLevelId: number;
  referredDate?: string | null;
  referredTime?: string | null;
  approvedAt?: string | null;
  scheduleUpdatedAt?: string | null;
  completedAt?: string | null;
  reason: string;
  notes?: string;
  status: unknown;
  createdAt: string;
}): Referral {
  return {
    ...item,
    status: normalizeReferralStatus(item.status),
  };
}

function normalizeReferrals(items: Array<{
  id: number;
  studentId: number;
  referredByUserId: number;
  academicYearId: number;
  collegeId: number;
  yearLevelId: number;
  referredDate?: string | null;
  referredTime?: string | null;
  approvedAt?: string | null;
  scheduleUpdatedAt?: string | null;
  completedAt?: string | null;
  reason: string;
  notes?: string;
  status: unknown;
  createdAt: string;
}>): Referral[] {
  return items.map(normalizeReferral);
}

function mergeReferralRecord(
  apiItem: Referral,
  cachedItem?: Referral,
): Referral {
  if (!cachedItem) return apiItem;

  const apiStatus = normalizeReferralStatus(apiItem.status);
  const cachedStatus = normalizeReferralStatus(cachedItem.status);
  const shouldKeepCachedStatus =
    apiStatus === "Pending" && cachedStatus !== "Pending";

  return normalizeReferral({
    ...apiItem,
    status: shouldKeepCachedStatus ? cachedStatus : apiStatus,
    referredDate: apiItem.referredDate ?? cachedItem.referredDate ?? null,
    referredTime: apiItem.referredTime ?? cachedItem.referredTime ?? null,
    approvedAt: apiItem.approvedAt ?? cachedItem.approvedAt ?? null,
    scheduleUpdatedAt: apiItem.scheduleUpdatedAt ?? cachedItem.scheduleUpdatedAt ?? null,
    completedAt: apiItem.completedAt ?? cachedItem.completedAt ?? null,
    notes: apiItem.notes ?? cachedItem.notes,
  });
}

function mergeReferralRecords(apiItems: Referral[], cachedItems: Referral[]): Referral[] {
  const cachedById = new Map(cachedItems.map((item) => [item.id, item]));
  return apiItems.map((item) => mergeReferralRecord(item, cachedById.get(item.id)));
}

function getReferralScheduleDateTime(referral: {
  referredDate?: string | null;
  referredTime?: string | null;
}) {
  const datePart = String(referral.referredDate || "").trim();
  const timePart = String(referral.referredTime || "").trim();
  if (!datePart || !timePart) return null;

  const parsed = new Date(`${datePart}T${timePart}:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function hasReferralReachedScheduledSession(referral: {
  referredDate?: string | null;
  referredTime?: string | null;
}) {
  const schedule = getReferralScheduleDateTime(referral);
  if (!schedule) return false;
  return schedule.getTime() <= Date.now();
}

function isReferralOverdue(referral: {
  referredDate?: string | null;
  referredTime?: string | null;
  status: Referral["status"];
}) {
  return (
    referral.status !== "Complete" &&
    hasReferralReachedScheduledSession(referral)
  );
}

/** âœ… Nice toast (no library) */
function referralDetailActionStyle(
  base: React.CSSProperties,
  {
    active = false,
    hovered = false,
    disabled = false,
    keepBorder = false,
  }: {
    active?: boolean;
    hovered?: boolean;
    disabled?: boolean;
    keepBorder?: boolean;
  } = {},
): React.CSSProperties {
  const isInteractive = !disabled;
  const isActive = active && isInteractive;

  return {
    ...base,
    border: keepBorder
      ? isActive
        ? "2px solid #5F6D7A"
        : "2px solid #000000"
      : isActive
        ? "1px solid #5F6D7A"
        : "1px solid var(--border)",
    background: isActive ? "#5F6D7A" : "white",
    color: isActive ? "white" : "#000000",
    boxShadow: "none",
    transform: isActive
      ? "translateY(1px) scale(0.98)"
      : hovered && isInteractive
        ? "translateY(-1px)"
        : "translateY(0)",
    transition:
      "background-color 140ms ease, color 140ms ease, border-color 140ms ease, box-shadow 140ms ease, transform 140ms ease",
    opacity: disabled ? 0.6 : 1,
    cursor: disabled ? "not-allowed" : "pointer",
    textDecoration: "none",
  };
}

type ReferralDetailActionButtonProps = {
  baseStyle: React.CSSProperties;
  onClick?: () => void;
  title: string;
  ariaLabel?: string;
  active?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
  type?: "button" | "submit" | "reset";
};

function ReferralDetailActionButton({
  baseStyle,
  onClick,
  title,
  ariaLabel,
  active = false,
  disabled = false,
  children,
  type = "button",
}: ReferralDetailActionButtonProps) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={ariaLabel ?? title}
      style={referralDetailActionStyle(baseStyle, {
        active: active || pressed,
        hovered,
        disabled,
      })}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => {
        setHovered(false);
        setPressed(false);
      }}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerCancel={() => setPressed(false)}
      onBlur={() => setPressed(false)}
    >
      {children}
    </button>
  );
}

type ReferralDetailActionLinkProps = {
  to: string;
  title: string;
  ariaLabel?: string;
  baseStyle: React.CSSProperties;
  children: React.ReactNode;
  keepBorder?: boolean;
};

function ReferralDetailActionLink({
  to,
  title,
  ariaLabel,
  baseStyle,
  children,
  keepBorder = false,
}: ReferralDetailActionLinkProps) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);

  return (
    <Link
      to={to}
      title={title}
      aria-label={ariaLabel ?? title}
      style={referralDetailActionStyle(baseStyle, {
        active: pressed,
        hovered,
        keepBorder,
      })}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => {
        setHovered(false);
        setPressed(false);
      }}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerCancel={() => setPressed(false)}
      onBlur={() => setPressed(false)}
    >
      {children}
    </Link>
  );
}

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
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);

  if (!open) return null;

  const palette =
    tone === "success"
      ? {
          bg: "rgba(34,197,94,0.14)",
          border: "rgba(34,197,94,0.35)",
          text: "#166534",
          dot: "#22c55e",
          icon: "âœ“",
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
          style={referralDetailActionStyle(
            {
              border: "1px solid var(--border)",
              background: "white",
              borderRadius: 10,
              height: 30,
              padding: "0 10px",
              fontWeight: 950,
              color: "var(--primary)",
            },
            {
              active: pressed,
              hovered,
            },
          )}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => {
            setHovered(false);
            setPressed(false);
          }}
          onPointerDown={() => setPressed(true)}
          onPointerUp={() => setPressed(false)}
          onPointerCancel={() => setPressed(false)}
          onBlur={() => setPressed(false)}
        >
          âœ•
        </button>
      </div>
    </div>
  );
}

export default function ReferralView() {
  const location = useLocation();
  const { id } = useParams();
  const referralId = Number(id);
  const authUser = useAuthStore((s) => s.user);
  const canManageReferralStatus = canApproveSystemReferrals(authUser);
  const canViewAllSystemReferrals = canViewEverySystemReferral(authUser);
  const listHref = useMemo(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("from") === "reports") return "/app/reports";
    if (authUser?.role === "ADMIN" || authUser?.role === "STAFF") {
      return "/app/referrals";
    }
    return `/app/referrals${location.search || ""}`;
  }, [authUser?.role, location.search]);

  const users = useMemo<User[]>(() => {
    const base = load<User[]>(USERS_KEY, []);
    if (!authUser) return base;

    const authAsUser: User = {
      id: authUser.id,
      fname: authUser.fname,
      lname: authUser.lname,
      email: authUser.email,
      role: authUser.role,
    };

    const idx = base.findIndex((u) => u.id === authAsUser.id);
    if (idx === -1) return [authAsUser, ...base];

    const copy = [...base];
    copy[idx] = { ...copy[idx], ...authAsUser };
    return copy;
  }, [authUser]);
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

  // âœ… STATEFUL: referrals + logs
  const [referrals, setReferrals] = useState<Referral[]>(() =>
    normalizeReferrals(load<any[]>(REF_KEY, [])),
  );
  const [logs, setLogs] = useState<ReferralLog[]>(() =>
    load<ReferralLog[]>(REF_LOG_KEY, []),
  );
  const [loaded, setLoaded] = useState(false);

  // âœ… Toast state
  const [toast, setToast] = useState<{
    open: boolean;
    message: string;
    tone: "success" | "error" | "info";
  }>({ open: false, message: "", tone: "success" });
  const [showAddLogNotice, setShowAddLogNotice] = useState(false);

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
      if (e.key === REF_KEY) {
        setReferrals(normalizeReferrals(load<any[]>(REF_KEY, [])));
      }
      if (e.key === REF_LOG_KEY) setLogs(load<ReferralLog[]>(REF_LOG_KEY, []));
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    if (!referralId) {
      setLoaded(true);
      return;
    }
    setLoaded(false);
    let alive = true;
    const p1 = getReferral(referralId)
      .then((res) => {
        if (!alive) return;
        const cached = normalizeReferrals(load<any[]>(REF_KEY, []));
        const item = mergeReferralRecord(
          normalizeReferral(res.item),
          cached.find((entry) => entry.id === referralId),
        );
        setReferrals((prev) => {
          const idx = prev.findIndex((r) => r.id === item.id);
          const next =
            idx === -1
              ? [item, ...prev]
              : prev.map((r) => (r.id === item.id ? item : r));
          save(REF_KEY, next);
          return next;
        });
      })
      .catch(() => {
        // Keep cached fallback if API is unreachable.
      });

    const p2 = listReferralLogs(referralId)
      .then((res) => {
        if (!alive) return;
        const next = res.logs ?? [];
        setLogs(next);
        save(REF_LOG_KEY, next);
      })
      .catch(() => {
        // Keep cached fallback if API is unreachable.
      });

    Promise.allSettled([p1, p2]).finally(() => {
      if (alive) setLoaded(true);
    });

    return () => {
      alive = false;
    };
  }, [referralId]);

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

  const [detailsText, setDetailsText] = useState("");
  useEffect(() => {
    setDetailsText(found?.notes ?? "");
  }, [found?.notes]);

  const [actionDate, setActionDate] = useState<string>(
    new Date().toISOString().slice(0, 10),
  );
  const [actionType, setActionType] =
    useState<ReferralLog["actionType"]>("Follow-up");
  const [note, setNote] = useState("");

  const [createdByUserId, setCreatedByUserId] = useState<number>(
    authUser?.id ?? 0,
  );
  useEffect(() => {
    setCreatedByUserId(authUser?.id ?? found?.referredByUserId ?? 0);
  }, [authUser?.id, found?.referredByUserId]);

  const saveDetails = () => {
    if (!found) return;
    if (!canManageReferralStatus) {
      showToast(
        "Only the admin or Carissa can update referral details.",
        "error",
      );
      return;
    }

    updateReferral({ id: found.id, status: found.status, notes: detailsText })
      .then((res) => {
        const cached = normalizeReferrals(load<any[]>(REF_KEY, []));
        const next = mergeReferralRecords(normalizeReferrals(res.referrals ?? []), cached);
        setReferrals(next);
        save(REF_KEY, next);
        showToast("Referral details saved!", "success");
      })
      .catch((e: any) => {
        showToast(e?.message || "Failed to save referral.", "error");
      });
  };

  const addLog = async () => {
    if (!found) return;

    if (!note.trim()) {
      showToast("Please type a note before adding a log.", "error");
      return;
    }
    if (!createdByUserId) {
      showToast("Please choose who created this log.", "error");
      return;
    }

    try {
      const res = await createReferralLog({
        referralId: found.id,
        createdByUserId,
        actionDate,
        actionType,
        note: note.trim(),
      });
      const next = res.logs ?? [];
      setLogs(next);
      save(REF_LOG_KEY, next);

      setNote("");
      setActionType("Follow-up");
      showToast("Log added!", "success");
      setShowAddLogNotice(true);
    } catch (e: any) {
      showToast(e?.message || "Failed to add log.", "error");
    }
  };

  const deleteLog = async (logId: number) => {
    try {
      const res = await deleteReferralLog({ id: logId, referralId: found?.id });
      const next = res.logs ?? [];
      setLogs(next);
      save(REF_LOG_KEY, next);
      showToast("Log deleted.", "info");
    } catch (e: any) {
      showToast(e?.message || "Failed to delete log.", "error");
    }
  };

  const referralLogs = useMemo(() => {
    if (!found) return [];
    return logs
      .filter((l) => l.referralId === found.id)
      .sort((a, b) => (a.actionDate < b.actionDate ? 1 : -1));
  }, [logs, found]);

  const currentStatus = found?.status ?? "Pending";
  const statusHistoryRows = useMemo(() => {
    if (!found) return [];

    return [
      {
        label: "Approved",
        timestamp:
          found.approvedAt ??
          (found.status !== "Pending" &&
          String(found.referredDate || "").trim() &&
          String(found.referredTime || "").trim()
            ? `${String(found.referredDate).trim()}T${String(found.referredTime).trim()}:00`
            : null),
        details:
          found.referredDate || found.referredTime
            ? `Schedule: ${formatDateShort(found.referredDate)} ${formatTimeShort(found.referredTime)}`
            : "Schedule pending",
      },
      {
        label: "Schedule Changed",
        timestamp: found.scheduleUpdatedAt ?? null,
        details:
          found.scheduleUpdatedAt && (found.referredDate || found.referredTime)
            ? `Updated to ${formatDateShort(found.referredDate)} ${formatTimeShort(found.referredTime)}`
            : "No schedule change recorded",
      },
      {
        label: "Completed",
        timestamp: found.completedAt ?? null,
        details:
          found.completedAt
            ? "Referral closed"
            : "Not completed yet",
      },
    ].map((row) => ({
      ...row,
      ...formatDateTimeParts(row.timestamp),
    }));
  }, [found]);

  // Styles
  const page: React.CSSProperties = { display: "grid", gap: 14 };
  const pageTitle: React.CSSProperties = {
    margin: 0,
    marginRight: "auto",
    fontSize: 18,
    fontWeight: 800,
    color: "#1e293b",
  };

  const paper: React.CSSProperties = {
    background: "white",
    padding: 18,
    borderRadius: 18,
    boxShadow: "0 14px 34px rgba(15,23,42,0.06)",
    border: "1px solid rgba(15,23,42,0.08)",
  };

  const topBar: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  };

  const backIconLink: React.CSSProperties = {
    height: 40,
    width: 40,
    borderRadius: 12,
    border: "1px solid var(--border)",
    background: "white",
    color: "var(--primary)",
    textDecoration: "none",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 4px 14px rgba(15, 23, 42, 0.06)",
  };

  const grid2: React.CSSProperties = {
    display: "none",
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
    fontSize: 12.5,
    fontWeight: 800,
    letterSpacing: 0.16,
    textTransform: "uppercase",
    color: "#64748b",
  };

  const summaryValue: React.CSSProperties = {
    fontSize: 18,
    fontWeight: 800,
    color: "#0f172a",
    lineHeight: 1.25,
  };

  const summarySubtext: React.CSSProperties = {
    marginTop: 4,
    fontSize: 12.5,
    color: "#64748b",
  };

  const infoChipWrap: React.CSSProperties = {
    marginTop: 18,
    display: "flex",
    flexWrap: "wrap",
    gap: 12,
  };

  const infoChip: React.CSSProperties = {
    minHeight: 52,
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(15,23,42,0.10)",
    background: "white",
    display: "inline-flex",
    alignItems: "center",
    gap: 10,
  };

  const infoChipIcon: React.CSSProperties = {
    width: 30,
    height: 30,
    borderRadius: 999,
    background: "rgba(248,250,252,0.96)",
    border: "1px solid rgba(15,23,42,0.08)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#475569",
    flexShrink: 0,
  };

  const infoChipLabel: React.CSSProperties = {
    fontSize: 11.5,
    fontWeight: 800,
    letterSpacing: 0.16,
    textTransform: "uppercase",
    color: "#64748b",
    lineHeight: 1.1,
  };

  const infoChipValue: React.CSSProperties = {
    fontSize: 12.5,
    fontWeight: 700,
    color: "#0f172a",
    lineHeight: 1.35,
  };

  const reasonWrap: React.CSSProperties = {
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
  };

  const reasonChip: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    minHeight: 34,
    padding: "8px 12px",
    borderRadius: 999,
    border: "1px solid rgba(15,23,42,0.08)",
    background: "white",
    fontSize: 12.5,
    fontWeight: 700,
    color: "#0f172a",
  };

  const metaValue: React.CSSProperties = {
    fontSize: 12.5,
    color: "#64748b",
    fontWeight: 500,
  };

  const checkboxPanel: React.CSSProperties = {
    display: "none",
    border: "1px solid var(--border)",
    borderRadius: 16,
    padding: 12,
    background: "rgba(255,255,255,0.65)",
  };

  const checkboxGrid: React.CSSProperties = {
    display: "none",
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
    border: "1px solid rgba(15,23,42,0.08)",
    borderRadius: 12,
    padding: 12,
    background: "white",
    minHeight: 110,
    whiteSpace: "pre-wrap",
    lineHeight: 1.55,
    fontSize: 12.5,
    fontWeight: 500,
    color: "#0f172a",
  };

  const pillRow: React.CSSProperties = {
    display: "none",
  };

  const pill: React.CSSProperties = {
    display: "none",
  };

  const card: React.CSSProperties = {
    background: "white",
    padding: 16,
    borderRadius: 16,
    boxShadow: "0 14px 34px rgba(15,23,42,0.06)",
    border: "1px solid rgba(15,23,42,0.08)",
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
    border: "1px solid var(--border)",
    background: "white",
    color: "var(--primary)",
    fontWeight: 900,
    cursor: "pointer",
    whiteSpace: "nowrap",
    boxShadow: "0 4px 14px rgba(15, 23, 42, 0.06)",
  };

  const dangerButton: React.CSSProperties = {
    height: 32,
    padding: "0 12px",
    borderRadius: 8,
    border: "1px solid var(--border)",
    background: "white",
    color: "var(--primary)",
    cursor: "pointer",
    fontWeight: 900,
    boxShadow: "0 4px 14px rgba(15, 23, 42, 0.06)",
  };

  const label: React.CSSProperties = {
    fontSize: 12.5,
    fontWeight: 800,
    color: "#64748b",
    letterSpacing: 0.16,
    textTransform: "uppercase",
    marginBottom: 6,
  };

  if (!found) {
    if (!loaded) {
      return (
        <div style={page}>
          <Toast
            open={toast.open}
            message={toast.message}
            tone={toast.tone}
            onClose={() => setToast((p) => ({ ...p, open: false }))}
          />

          <div style={topBar}>
            <h2 style={pageTitle}>Referral Details</h2>
            <ReferralDetailActionLink
              to={listHref}
              title="Back to Referrals"
              ariaLabel="Back to Referrals"
              baseStyle={backIconLink}
            >
              <ArrowLeft size={18} />
            </ReferralDetailActionLink>
          </div>

          <div style={card}>
            <div style={{ opacity: 0.8 }}>Loading referral...</div>
          </div>
        </div>
      );
    }
    return (
      <div style={page}>
        <Toast
          open={toast.open}
          message={toast.message}
          tone={toast.tone}
          onClose={() => setToast((p) => ({ ...p, open: false }))}
        />

        <div style={topBar}>
          <h2 style={pageTitle}>Referral Details</h2>
          <ReferralDetailActionLink
            to={listHref}
            title="Back to Referrals"
            ariaLabel="Back to Referrals"
            baseStyle={backIconLink}
          >
            <ArrowLeft size={18} />
          </ReferralDetailActionLink>
        </div>

        <div style={card}>
          <div style={{ opacity: 0.8 }}>Referral not found.</div>
        </div>
      </div>
    );
  }

  const canViewThisReferral =
    canViewAllSystemReferrals || found.referredByUserId === authUser?.id;
  if (!canViewThisReferral) {
    return (
      <div style={page}>
        <Toast
          open={toast.open}
          message={toast.message}
          tone={toast.tone}
          onClose={() => setToast((p) => ({ ...p, open: false }))}
        />

        <div style={topBar}>
          <h2 style={pageTitle}>Referral Details</h2>
          <ReferralDetailActionLink
            to={listHref}
            title="Back to Referrals"
            ariaLabel="Back to Referrals"
            baseStyle={backIconLink}
          >
            <ArrowLeft size={18} />
          </ReferralDetailActionLink>
        </div>

        <div style={card}>
          <div style={{ opacity: 0.8 }}>
            You do not have access to this referral.
          </div>
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

  const selectedReasons = splitReasons(found.reason);
  const selected = new Set(selectedReasons);
  const showOverdueWarning = isReferralOverdue(found);
  const canDownloadCallSlip =
    canViewAllSystemReferrals && canPrintReferralCallSlip(found);
  const openDetailsCallSlip = () => {
    if (!canDownloadCallSlip) return;

    downloadReferralCallSlipWord({
      referralId: found.id,
      studentName,
      studentEmail: student?.email,
      courseYearSection: [college?.name, yl?.name].filter(Boolean).join(" / "),
      scheduleDate: String(found.referredDate || ""),
      scheduleTime: String(found.referredTime || ""),
      reason: found.reason,
      referredByName: referredBy ? labelUserById(referredBy.id) : "Guidance Office",
      issuedDate: new Date().toISOString().slice(0, 10),
    });
  };

  return (
    <div style={page}>
      <Toast
        open={toast.open}
        message={toast.message}
        tone={toast.tone}
        onClose={() => setToast((p) => ({ ...p, open: false }))}
      />
      <SuccessNoticeModal
        open={showAddLogNotice}
        onClose={() => setShowAddLogNotice(false)}
        title="Log Added"
        message="The referral log has been added successfully."
      />

      <div style={topBar}>
        <h2 style={pageTitle}>Referral Details</h2>
        {canDownloadCallSlip && (
          <ReferralDetailActionButton
            onClick={openDetailsCallSlip}
            title="Download call slip as Word"
            ariaLabel="Download call slip as Word"
            baseStyle={backIconLink}
          >
            <FileDown size={18} />
          </ReferralDetailActionButton>
        )}
        <ReferralDetailActionLink
          to={listHref}
          title="Back to Referrals"
          ariaLabel="Back to Referrals"
          baseStyle={backIconLink}
        >
          <ArrowLeft size={18} />
        </ReferralDetailActionLink>
      </div>

      <div style={paper}>
        <div>
          <div style={label}>Student</div>
          <div style={summaryValue}>{studentName}</div>
          <div style={summarySubtext}>{student?.email ?? "-"}</div>
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
              {college?.name ?? "â€”"} â€¢ {yl?.name ?? "â€”"}
            </div>
          </div>
        </div>

        <div style={pillRow}>
          <span style={pill}>
            <CalendarDays size={14} />
            Scheduled Date: {formatDateShort(found.referredDate ?? "")}
          </span>
          <span style={pill}>
            <CalendarDays size={14} />
            Time: {formatTimeShort(found.referredTime)}
          </span>
          <span style={pill}>
            <GraduationCap size={14} />
            Academic Year: {ay?.name ?? "â€”"}
          </span>
          <span style={pill}>
            <UserRound size={14} />
            Referred By: {referredBy ? labelUserById(referredBy.id) : "â€”"}
          </span>
          <span style={pill}>
            <Hash size={14} />
            Referral ID: #{found.id}
          </span>
        </div>

        <div style={infoChipWrap}>
          <div style={infoChip}>
            <span style={infoChipIcon}>
              <CalendarDays size={16} />
            </span>
            <div>
              <div style={infoChipLabel}>Referred Date</div>
              <div style={infoChipValue}>
                {found.referredDate ? formatDateShort(found.referredDate) : "-"}
              </div>
            </div>
          </div>

          <div style={infoChip}>
            <span style={infoChipIcon}>
              <Clock3 size={16} />
            </span>
            <div>
              <div style={infoChipLabel}>Time</div>
              <div style={infoChipValue}>
                {found.referredTime ? formatTimeShort(found.referredTime) : "-"}
              </div>
            </div>
          </div>

          <div style={infoChip}>
            <span style={infoChipIcon}>
              <GraduationCap size={16} />
            </span>
            <div>
              <div style={infoChipLabel}>Academic Year</div>
              <div style={infoChipValue}>{ay?.name ?? "-"}</div>
            </div>
          </div>

          <div style={infoChip}>
            <span style={infoChipIcon}>
              <School size={16} />
            </span>
            <div>
              <div style={infoChipLabel}>College / Year Level</div>
              <div style={infoChipValue}>
                {college?.name ?? "-"} / {yl?.name ?? "-"}
              </div>
            </div>
          </div>

          <div style={infoChip}>
            <span style={infoChipIcon}>
              <UserRound size={16} />
            </span>
            <div>
              <div style={infoChipLabel}>Referred By</div>
              <div style={infoChipValue}>
                {referredBy ? labelUserById(referredBy.id) : "-"}
              </div>
            </div>
          </div>

          <div style={infoChip}>
            <span style={infoChipIcon}>
              <CheckCircle2 size={16} />
            </span>
            <div>
              <div style={infoChipLabel}>Status</div>
              <div
                style={{
                  ...infoChipValue,
                  color:
                    currentStatus === "Complete"
                      ? "#166534"
                      : currentStatus === "Approved"
                        ? "#1d4ed8"
                        : "#92400e",
                }}
              >
                {referralStatusLabel(currentStatus)}
              </div>
            </div>
          </div>

          <div style={infoChip}>
            <span style={infoChipIcon}>
              <Hash size={16} />
            </span>
            <div>
              <div style={infoChipLabel}>Referral ID</div>
              <div style={infoChipValue}>#{found.id}</div>
            </div>
          </div>
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
                    {checked ? "âœ“" : ""}
                  </span>
                  <span style={{ opacity: checked ? 1 : 0.78 }}>{r}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div style={reasonWrap}>
          {selectedReasons.length === 0 ? (
            <div style={metaValue}>No referral reasons selected.</div>
          ) : (
            selectedReasons.map((reason) => (
              <span key={reason} style={reasonChip}>
                {reason}
              </span>
            ))
          )}
        </div>

        <div style={sectionTitle}>Details</div>
        <textarea
          value={detailsText}
          onChange={(e) => setDetailsText(e.target.value)}
          style={{ ...detailsBox, width: "100%", resize: "vertical" }}
          placeholder="Type referral details here..."
        />

        <div
          style={{
            marginTop: 12,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          <div style={{ fontSize: 12.5, color: "#64748b", fontWeight: 700 }}>
            Created: <b>{found.createdAt}</b>
          </div>
          <ReferralDetailActionButton
            onClick={saveDetails}
            title="Save Details"
            ariaLabel="Save Details"
            baseStyle={primaryButton}
            disabled={!canManageReferralStatus}
          >
            Save Details
          </ReferralDetailActionButton>
        </div>
      </div>

      <div style={card}>
        <h3 style={{ marginBottom: 10 }}>Status</h3>

        <div
          style={{
            display: "grid",
            gap: 16,
            gridTemplateColumns: "minmax(220px, 280px) minmax(0, 1fr)",
            alignItems: "start",
          }}
        >
          <div
            style={{
              borderRadius: 16,
              border: showOverdueWarning
                ? "1px solid rgba(220,38,38,0.22)"
                : "1px solid rgba(148,163,184,0.22)",
              background: showOverdueWarning
                ? "rgba(254,242,242,0.94)"
                : "rgba(248,250,252,0.92)",
              padding: 16,
              display: "grid",
              gap: 12,
            }}
          >
            <div style={label}>Referral Status</div>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                minHeight: 44,
                borderRadius: 999,
                padding: "0 16px",
                border:
                  currentStatus === "Complete"
                    ? "1px solid rgba(34,197,94,0.28)"
                    : currentStatus === "Approved"
                      ? "1px solid rgba(59,130,246,0.28)"
                      : "1px solid rgba(245,158,11,0.28)",
                background:
                  currentStatus === "Complete"
                    ? "rgba(240,253,244,0.96)"
                    : currentStatus === "Approved"
                      ? "rgba(239,246,255,0.96)"
                      : "rgba(255,251,235,0.96)",
                color:
                  currentStatus === "Complete"
                    ? "#166534"
                    : currentStatus === "Approved"
                      ? "#1d4ed8"
                      : "#92400e",
                fontSize: 16,
                fontWeight: 800,
              }}
            >
              {referralStatusLabel(currentStatus)}
            </div>
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: showOverdueWarning ? "#b45309" : "#64748b",
                lineHeight: 1.5,
              }}
            >
              {showOverdueWarning
                ? "This referral already reached its scheduled session time and is waiting to be marked complete from the referrals list."
                : "Approval, schedule changes, and completion are managed from the referrals list. This page now shows the recorded timeline only."}
            </div>
          </div>

          <div
            style={{
              borderRadius: 16,
              border: "1px solid rgba(148,163,184,0.18)",
              overflow: "hidden",
              background: "rgba(255,255,255,0.9)",
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(120px, 0.9fr) minmax(120px, 0.85fr) minmax(100px, 0.7fr) minmax(160px, 1.2fr)",
                gap: 0,
                background: "rgba(241,245,249,0.92)",
                borderBottom: "1px solid rgba(148,163,184,0.18)",
              }}
            >
              {["Event", "Date", "Time", "Details"].map((heading) => (
                <div
                  key={heading}
                  style={{
                    padding: "12px 14px",
                    fontSize: 12,
                    fontWeight: 800,
                    color: "#475569",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  {heading}
                </div>
              ))}
            </div>

            <div style={{ display: "grid" }}>
              {statusHistoryRows.map((row, index) => (
                <div
                  key={row.label}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(120px, 0.9fr) minmax(120px, 0.85fr) minmax(100px, 0.7fr) minmax(160px, 1.2fr)",
                    borderBottom:
                      index === statusHistoryRows.length - 1
                        ? "none"
                        : "1px solid rgba(148,163,184,0.14)",
                  }}
                >
                  <div style={{ padding: "13px 14px", fontWeight: 800, color: "#0f172a" }}>
                    {row.label}
                  </div>
                  <div style={{ padding: "13px 14px", color: "#334155", fontWeight: 600 }}>
                    {row.date}
                  </div>
                  <div style={{ padding: "13px 14px", color: "#334155", fontWeight: 600 }}>
                    {row.time}
                  </div>
                  <div style={{ padding: "13px 14px", color: "#64748b", fontWeight: 600 }}>
                    {row.details}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div style={card}>
        <h3 style={{ marginBottom: 10 }}>Action Logs / Follow-ups</h3>

        <div
          style={{
            display: "grid",
            gap: 12,
            gridTemplateColumns: "1fr 1fr",
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
          <ReferralDetailActionButton
            onClick={addLog}
            title="Add Log"
            ariaLabel="Add Log"
            baseStyle={primaryButton}
          >
            + Add Log
          </ReferralDetailActionButton>
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
                    {l.actionType} â€¢ {formatDateShort(l.actionDate)}
                  </div>
                  <ReferralDetailActionButton
                    onClick={() => deleteLog(l.id)}
                    title="Delete"
                    ariaLabel="Delete"
                    baseStyle={dangerButton}
                  >
                    Delete
                  </ReferralDetailActionButton>
                </div>

                <div style={{ opacity: 0.88, fontWeight: 800 }}>{l.note}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

