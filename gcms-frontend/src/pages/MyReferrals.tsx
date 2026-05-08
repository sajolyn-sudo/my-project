import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CalendarDays, Eye, Plus } from "lucide-react";
import {
  type College,
  type Course,
  createReferral,
  fetchEntitiesBootstrap,
  type User as BootstrapUser,
} from "../lib/entitiesApi";
import {
  normalizeSentenceCaseName,
  toSentenceCaseNameInput,
} from "../lib/nameCase";
import DropdownSelect from "../components/DropdownSelect";
import {
  useGCMS,
  type Referral,
  type ReferralStatus,
} from "../store/gcmsStore";
import useStudentPortalSync from "../hooks/useStudentPortalSync";

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
  justifyContent: "center",
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

const iconButton: React.CSSProperties = {
  height: 46,
  width: 46,
  borderRadius: 14,
  border: "1px solid rgba(15,23,42,0.14)",
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

const tableHead: React.CSSProperties = {
  textAlign: "left",
  padding: "10px 8px",
  opacity: 0.82,
  fontSize: 13,
};

const tableCell: React.CSSProperties = {
  padding: "12px 8px",
  borderTop: "1px solid rgba(15,23,42,0.08)",
  verticalAlign: "top",
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

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatTime(value?: string) {
  if (!value) return "-";
  const [hourPart, minutePart] = String(value).split(":");
  const hours = Number(hourPart);
  const minutes = Number(minutePart);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return String(value);
  const suffix = hours >= 12 ? "PM" : "AM";
  const displayHour = hours % 12 || 12;
  return `${displayHour}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

function toDateKey(value?: string): string {
  const source = String(value || "").trim();
  if (!source) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(source)) return source;
  const parsed = new Date(source);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10);
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function shiftMonth(date: Date, delta: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1);
}

function sameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

function ReferralChip({ status }: { status: ReferralStatus }) {
  const label = status === "pending" ? "Waiting for Approval" : "Approved";
  const color = status === "pending" ? "#b45309" : "#1d4ed8";

  return <span style={{ display: "inline-block", color, fontSize: 13, fontWeight: 950, whiteSpace: "nowrap" }}>{label}</span>;
}

function isStudentReferralApproved(status: ReferralStatus): boolean {
  return status === "approved" || status === "complete";
}

function getStudentReferralScheduleDate(referral: Referral): string {
  return isStudentReferralApproved(referral.status) ? String(referral.referred_date || "") : "";
}

function getStudentReferralScheduleTime(referral: Referral): string {
  return isStudentReferralApproved(referral.status) ? String(referral.referred_time || "") : "";
}

function referralSortTimestamp(referral: Referral): number {
  const scheduledDate = getStudentReferralScheduleDate(referral).trim();
  const scheduledTime = getStudentReferralScheduleTime(referral).trim() || "00:00";
  if (scheduledDate) {
    const parsed = new Date(`${scheduledDate}T${scheduledTime}:00`);
    if (!Number.isNaN(parsed.getTime())) return parsed.getTime();
  }

  const created = String(referral.created_at || "").trim();
  if (created) {
    const parsed = new Date(created);
    if (!Number.isNaN(parsed.getTime())) return parsed.getTime();
  }

  return 0;
}

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
          width: "min(720px, 100%)",
          maxHeight: "84vh",
          background: "white",
          borderRadius: 18,
          border: "1px solid rgba(15,23,42,0.12)",
          boxShadow: "0 20px 60px rgba(15,23,42,0.25)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
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
          <div style={{ fontWeight: 950, fontSize: 14, color: "#0f172a" }}>{title}</div>
          <button
            onClick={onClose}
            style={{ ...btn, height: 34, width: 40, padding: 0, borderRadius: 10, fontSize: 14 }}
            aria-label="Close"
            title="Close"
          >
            ×
          </button>
        </div>

        <div style={{ padding: 14, overflowY: "auto", flex: "1 1 auto" }}>{children}</div>
      </div>
    </div>
  );
}

export default function MyReferrals() {
  useStudentPortalSync();
  const navigate = useNavigate();
  const { currentUser, referrals, setReferrals } = useGCMS();
  const [directionFilter, setDirectionFilter] = useState<"all" | "received" | "sent">("received");
  const [filterDate, setFilterDate] = useState("");
  const [showDateCalendar, setShowDateCalendar] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState<Date>(() => startOfMonth(new Date()));
  const [open, setOpen] = useState(false);

  const [studentName, setStudentName] = useState("");
  const [collegeId, setCollegeId] = useState(0);
  const [course, setCourse] = useState("");
  const [selectedReasons, setSelectedReasons] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [bootstrapUsers, setBootstrapUsers] = useState<BootstrapUser[]>([]);
  const [colleges, setColleges] = useState<College[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [activeAcademicYearId, setActiveAcademicYearId] = useState(0);
  const [saving, setSaving] = useState(false);

  const myUserId = currentUser?.users_id;

  const myRelatedReferrals = useMemo(() => {
    if (!myUserId) return [];
    return [...referrals]
      .filter((referral) => referral.student_user_id === myUserId || referral.referred_by_user_id === myUserId)
      .sort((a, b) => referralSortTimestamp(b) - referralSortTimestamp(a));
  }, [myUserId, referrals]);

  const directionReferrals = useMemo(() => {
    if (!myUserId) return [];
    if (directionFilter === "received") {
      return myRelatedReferrals.filter(
        (referral) => referral.student_user_id === myUserId && referral.referred_by_user_id !== myUserId,
      );
    }
    if (directionFilter === "sent") {
      return myRelatedReferrals.filter((referral) => referral.referred_by_user_id === myUserId);
    }
    return myRelatedReferrals;
  }, [directionFilter, myRelatedReferrals, myUserId]);

  const visibleReferrals = useMemo(
    () =>
      directionReferrals.filter((referral) =>
        filterDate
          ? toDateKey(getStudentReferralScheduleDate(referral)) === filterDate
          : true,
      ),
    [directionReferrals, filterDate],
  );

  const receivedCount = useMemo(
    () =>
      myRelatedReferrals.filter(
        (referral) => referral.student_user_id === myUserId && referral.referred_by_user_id !== myUserId,
      ).length,
    [myRelatedReferrals, myUserId],
  );

  const sentCount = useMemo(
    () => myRelatedReferrals.filter((referral) => referral.referred_by_user_id === myUserId).length,
    [myRelatedReferrals, myUserId],
  );
  const showScheduleColumns = directionFilter !== "sent";

  useEffect(() => {
    let alive = true;

    fetchEntitiesBootstrap()
      .then((payload) => {
        if (!alive) return;
        setBootstrapUsers(payload.users ?? []);
        setColleges(payload.colleges ?? []);
        setCourses(payload.courses ?? []);
        setActiveAcademicYearId(
          payload.academicYears?.find((item) => item.isActive)?.id ?? payload.academicYears?.[0]?.id ?? 0,
        );
      })
      .catch(() => {
        if (!alive) return;
      });

    return () => {
      alive = false;
    };
  }, []);

  const currentBootstrapUser = useMemo(
    () => bootstrapUsers.find((item) => item.id === myUserId) ?? null,
    [bootstrapUsers, myUserId],
  );

  const availableCourses = useMemo(() => {
    if (!collegeId) return [];
    return courses.filter((item) => item.collegeId === collegeId);
  }, [collegeId, courses]);

  useEffect(() => {
    if (!currentBootstrapUser) return;
    setCollegeId((prev) => prev || Number(currentBootstrapUser.collegeId || 0));
    setCourse((prev) => prev || String(currentBootstrapUser.courseName || "").trim());
  }, [currentBootstrapUser]);

  useEffect(() => {
    if (!course.trim()) return;
    const exists = availableCourses.some((item) => item.name === course);
    if (!exists) setCourse("");
  }, [availableCourses, course]);

  const scheduleDateKeys = useMemo(
    () =>
      new Set(
        directionReferrals
          .map((referral) => toDateKey(getStudentReferralScheduleDate(referral)))
          .filter(Boolean),
      ),
    [directionReferrals],
  );

  const scheduleTimesByDate = useMemo(() => {
    const map = new Map<string, string[]>();
    directionReferrals.forEach((referral) => {
      const key = toDateKey(getStudentReferralScheduleDate(referral));
      const referralTime = getStudentReferralScheduleTime(referral);
      if (!key || !referralTime) return;
      const label = formatTime(referralTime);
      const current = map.get(key) ?? [];
      if (!current.includes(label)) current.push(label);
      map.set(key, current);
    });
    return map;
  }, [directionReferrals]);

  const calendarCells = useMemo(() => {
    const monthStart = startOfMonth(calendarMonth);
    const gridStart = new Date(monthStart);
    gridStart.setDate(monthStart.getDate() - monthStart.getDay());

    return Array.from({ length: 42 }, (_, index) => {
      const cellDate = new Date(gridStart);
      cellDate.setDate(gridStart.getDate() + index);
      const key = toDateKey(cellDate.toISOString());
      const times = scheduleTimesByDate.get(key) ?? [];
      return {
        key,
        label: cellDate.getDate(),
        isCurrentMonth: sameMonth(cellDate, calendarMonth),
        hasSchedule: scheduleDateKeys.has(key),
        isSelected: filterDate === key,
        isToday: toDateKey(new Date().toISOString()) === key,
        tooltip: times.length > 0 ? `${key}\n${times.join("\n")}` : key,
      };
    });
  }, [calendarMonth, filterDate, scheduleDateKeys, scheduleTimesByDate]);

  const toggleReason = (reason: string) => {
    setSelectedReasons((prev) =>
      prev.includes(reason) ? prev.filter((item) => item !== reason) : [...prev, reason],
    );
  };

  const normalizeApiStatus = (status: string): ReferralStatus => {
    const normalized = String(status || "").trim().toLowerCase();
    if (
      normalized === "approved" ||
      normalized === "ongoing" ||
      normalized === "reviewed"
    ) {
      return "approved";
    }
    if (
      normalized === "complete" ||
      normalized === "completed" ||
      normalized === "closed" ||
      normalized === "resolved"
    ) {
      return "complete";
    }
    return "pending";
  };
  const addReferral = async () => {
    if (!myUserId || !currentBootstrapUser) return;

    alert("Students cannot refer themselves. Please ask a teacher, non-teaching personnel, staff, or admin to submit the referral.");
    return;

    if (selectedReasons.length === 0) {
      alert("Please select at least one reason.");
      return;
    }
    if (!studentName.trim() || !collegeId || !course.trim()) {
      alert("Please provide name, college, and course.");
      return;
    }
    if (!currentBootstrapUser.collegeId || !currentBootstrapUser.yearLevelId) {
      alert("Your college or year level is missing. Please contact the admin.");
      return;
    }
    if (!activeAcademicYearId) {
      alert("No active academic year found.");
      return;
    }

    const reasonText = selectedReasons.join(", ");
    const selectedCollegeName = colleges.find((item) => item.id === collegeId)?.name ?? "";
    const metadata = [
      `Name: ${normalizeSentenceCaseName(studentName)}`,
      selectedCollegeName ? `College: ${selectedCollegeName}` : "",
      `Course: ${course.trim()}`,
    ].filter(Boolean);
    if (notes.trim()) metadata.push(notes.trim());

    try {
      setSaving(true);
      const res = await createReferral({
        studentId: myUserId,
        referredByUserId: myUserId,
        academicYearId: activeAcademicYearId,
        collegeId: currentBootstrapUser.collegeId,
        yearLevelId: currentBootstrapUser.yearLevelId,
        referredDate: new Date().toISOString().slice(0, 10),
        reason: reasonText,
        notes: metadata.join("\n"),
        status: "Pending",
      });

      const next = (res.referrals ?? []).map(
        (item): Referral => ({
          referral_id: item.id,
          student_user_id: item.studentId,
          referred_by_user_id: item.referredByUserId,
          referred_date: item.referredDate ?? undefined,
          referred_time: item.referredTime ?? undefined,
          reason: item.reason,
          status: normalizeApiStatus(item.status),
          notes: item.notes ?? undefined,
          created_at: item.createdAt,
        }),
      );
      setReferrals(() => next);
      setDirectionFilter("sent");
      setFilterDate("");
      setOpen(false);
      setStudentName("");
      setCollegeId(Number(currentBootstrapUser.collegeId || 0));
      setCourse(String(currentBootstrapUser.courseName || "").trim());
      setSelectedReasons([]);
      setNotes("");
      navigate(`/app/my-referrals/${res.id}`);
    } catch (e: any) {
      alert(e?.message || "Failed to create referral.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={pageStyle}>
      <div style={containerStyle}>
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
            <h1 style={{ margin: 0, fontSize: 28, letterSpacing: -0.3, color: "#0f172a" }}>
              My Referrals
            </h1>
            <p style={{ margin: "6px 0 0", color: "#64748b" }}>
              View your referrals and track their status.
            </p>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <button
              onClick={() => setOpen(true)}
              disabled
              style={{ ...btnPrimary, width: 56, padding: 0 }}
              title="Students cannot refer themselves"
              aria-label="Students cannot refer themselves"
            >
              <Plus size={18} />
            </button>
          </div>
        </div>

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
              <div style={{ position: "relative" }}>
                <button
                  type="button"
                  onClick={() => setShowDateCalendar((prev) => !prev)}
                  style={{
                    ...iconButton,
                    background: filterDate || showDateCalendar ? "#0f172a" : "white",
                    color: filterDate || showDateCalendar ? "white" : "#0f172a",
                    border:
                      filterDate || showDateCalendar
                        ? "1px solid #0f172a"
                        : "1px solid rgba(15,23,42,0.14)",
                  }}
                  title="Filter by date"
                  aria-label="Filter by date"
                >
                  <CalendarDays size={20} />
                </button>

                {showDateCalendar && (
                  <div
                    style={{
                      position: "absolute",
                      right: 0,
                      top: "calc(100% + 10px)",
                      width: 290,
                      padding: 14,
                      borderRadius: 16,
                      border: "1px solid rgba(15,23,42,0.12)",
                      background: "white",
                      boxShadow: "0 18px 40px rgba(15,23,42,0.16)",
                      zIndex: 20,
                      display: "grid",
                      gap: 12,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                      <button
                        type="button"
                        onClick={() => setCalendarMonth((prev) => shiftMonth(prev, -1))}
                        style={{ ...iconButton, width: 34, height: 34, borderRadius: 10 }}
                        aria-label="Previous month"
                      >
                        <span style={{ fontSize: 18, lineHeight: 1 }}>‹</span>
                      </button>
                      <div style={{ fontWeight: 900, fontSize: 15 }}>
                        {calendarMonth.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
                      </div>
                      <button
                        type="button"
                        onClick={() => setCalendarMonth((prev) => shiftMonth(prev, 1))}
                        style={{ ...iconButton, width: 34, height: 34, borderRadius: 10 }}
                        aria-label="Next month"
                      >
                        <span style={{ fontSize: 18, lineHeight: 1 }}>›</span>
                      </button>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6, textAlign: "center", color: "#64748b", fontSize: 11, fontWeight: 900 }}>
                      {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                        <div key={day}>{day}</div>
                      ))}
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6 }}>
                      {calendarCells.map((cell) => (
                        <button
                          key={cell.key}
                          type="button"
                          onClick={() => {
                            setFilterDate(cell.key);
                            setCalendarMonth(startOfMonth(new Date(cell.key)));
                            setShowDateCalendar(false);
                          }}
                          title={cell.tooltip}
                          style={{
                            minHeight: 40,
                            borderRadius: 12,
                            border: cell.isSelected
                              ? "1px solid #0f172a"
                              : cell.isToday
                                ? "1px solid rgba(34,197,94,0.35)"
                                : "1px solid rgba(15,23,42,0.08)",
                            background: cell.isSelected
                              ? "#0f172a"
                              : cell.isCurrentMonth
                                ? "white"
                                : "rgba(226,232,240,0.38)",
                            color: cell.isSelected
                              ? "white"
                              : cell.isCurrentMonth
                                ? "#0f172a"
                                : "#94a3b8",
                            display: "grid",
                            placeItems: "center",
                            cursor: "pointer",
                            padding: "6px 4px",
                            fontSize: 12,
                            fontWeight: 800,
                          }}
                          aria-label={`Filter ${cell.key}`}
                        >
                          <span>{cell.label}</span>
                          <span style={{ width: 8, height: 8, borderRadius: 999, background: cell.hasSchedule ? "#22c55e" : "transparent" }} />
                        </button>
                      ))}
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 800 }}>
                      <button
                        type="button"
                        onClick={() => {
                          setFilterDate("");
                          setShowDateCalendar(false);
                        }}
                        style={{ border: "none", background: "transparent", color: "#2563eb", cursor: "pointer", fontWeight: 900 }}
                      >
                        Clear
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const today = toDateKey(new Date().toISOString());
                          setFilterDate(today);
                          setCalendarMonth(startOfMonth(new Date(today)));
                          setShowDateCalendar(false);
                        }}
                        style={{ border: "none", background: "transparent", color: "#2563eb", cursor: "pointer", fontWeight: 900 }}
                      >
                        Today
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <button type="button" style={filterChip(directionFilter === "received")} onClick={() => setDirectionFilter("received")}>
                Received ({receivedCount})
              </button>
              <button type="button" style={filterChip(directionFilter === "sent")} onClick={() => setDirectionFilter("sent")}>
                Sent Out ({sentCount})
              </button>
              <button type="button" style={filterChip(directionFilter === "all")} onClick={() => setDirectionFilter("all")}>
                All ({myRelatedReferrals.length})
              </button>
              <div style={{ color: "#64748b", fontSize: 13, fontWeight: 900 }}>Total: {visibleReferrals.length}</div>
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
            <div
              style={{
                border: "1px solid rgba(15,23,42,0.08)",
                borderRadius: 16,
                overflow: "hidden",
                background: "rgba(255,255,255,0.72)",
              }}
            >
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "rgba(15,23,42,0.04)" }}>
                    {showScheduleColumns && <th style={tableHead}>Schedule Date</th>}
                    {showScheduleColumns && <th style={tableHead}>Schedule Time</th>}
                    <th style={tableHead}>Reason</th>
                    <th style={tableHead}>Status</th>
                    <th style={tableHead}></th>
                  </tr>
                </thead>
                <tbody>
                  {visibleReferrals.map((referral) => {
                    const scheduleDate = getStudentReferralScheduleDate(referral);
                    const scheduleTime = getStudentReferralScheduleTime(referral);
                    const approved = isStudentReferralApproved(referral.status);
                    const isReceivedReferral =
                      referral.student_user_id === myUserId &&
                      referral.referred_by_user_id !== myUserId;

                    return (
                    <tr key={referral.referral_id}>
                      {showScheduleColumns && (
                        <td style={tableCell}>
                          <div style={{ fontWeight: 900 }}>
                            {isReceivedReferral
                              ? approved
                                ? formatDate(scheduleDate)
                                : "Waiting for approval"
                              : "Status only"}
                          </div>
                        </td>
                      )}
                      {showScheduleColumns && (
                        <td style={tableCell}>
                          <div style={{ fontWeight: 800, color: "#334155" }}>
                            {isReceivedReferral && approved ? formatTime(scheduleTime) : "-"}
                          </div>
                        </td>
                      )}
                      <td style={tableCell}>
                        <div style={{ fontWeight: 900, color: "#0f172a" }}>{referral.reason}</div>
                      </td>
                      <td style={tableCell}>
                        <ReferralChip status={referral.status} />
                      </td>
                      <td style={tableCell}>
                        <Link
                          to={`/app/my-referrals/${referral.referral_id}`}
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
                            textDecoration: "none",
                          }}
                        >
                          <Eye size={14} />
                          View
                        </Link>
                      </td>
                    </tr>
                  )})}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <Modal open={open} title="Create Referral" onClose={() => setOpen(false)}>
        <div style={{ display: "grid", gap: 12 }}>
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
            Your information will remain confidential.
          </div>

          <div>
            <div style={{ fontSize: 12, color: "#64748b", fontWeight: 900, marginBottom: 6 }}>Name</div>
            <input
              value={studentName}
              onChange={(e) =>
                setStudentName(toSentenceCaseNameInput(e.target.value))
              }
              placeholder="Enter student name"
              style={inputStyle}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <div style={{ fontSize: 12, color: "#64748b", fontWeight: 900, marginBottom: 6 }}>College</div>
              <DropdownSelect value={collegeId} onChange={(e) => setCollegeId(Number(e.target.value))}>
                <option value={0}>Select college</option>
                {colleges.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </DropdownSelect>
            </div>

            <div>
              <div style={{ fontSize: 12, color: "#64748b", fontWeight: 900, marginBottom: 6 }}>Course</div>
              <DropdownSelect value={course} onChange={(e) => setCourse(e.target.value)} disabled={!collegeId}>
                <option value="">
                  {!collegeId
                    ? "Select college first"
                    : availableCourses.length
                      ? "Select course"
                      : "No courses found"}
                </option>
                {availableCourses.map((item) => (
                  <option key={item.id} value={item.name}>
                    {item.name}
                  </option>
                ))}
              </DropdownSelect>
            </div>
          </div>

          <div>
            <div style={{ fontSize: 12, color: "#64748b", fontWeight: 900, marginBottom: 6 }}>
              Reason for Referral * (Select all that apply)
            </div>

            <div style={checkboxGrid}>
              {referralReasons.map((reason) => (
                <label
                  key={reason}
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
                    checked={selectedReasons.includes(reason)}
                    onChange={() => toggleReason(reason)}
                  />
                  {reason}
                </label>
              ))}
            </div>

            {selectedReasons.length > 0 && (
              <div style={chipBar}>
                {selectedReasons.map((reason) => (
                  <span key={reason} style={chip}>
                    {reason}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div>
            <div style={{ fontSize: 12, color: "#64748b", fontWeight: 900, marginBottom: 6 }}>
              Notes / Details (optional)
            </div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              style={textareaStyle}
              placeholder="Add details, previous interventions, or specify 'Others' here..."
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, flexWrap: "wrap" }}>
            <button onClick={() => setOpen(false)} style={btn}>
              Cancel
            </button>
            <button onClick={addReferral} style={btnPrimary} disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
