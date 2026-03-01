import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Eye, History as HistoryIcon, List, Plus, Printer } from "lucide-react";
import Modal from "../components/Modal";
import DropdownSelect from "../components/DropdownSelect";
import { useAuthStore } from "../store/authStore";
import { createReferral, listReferrals, updateReferral } from "../lib/entitiesApi";
import { postJSON } from "../lib/api";
import { openReferralFormPrint } from "../lib/referralFormPrint";

type Role =
  | "ADMIN"
  | "COUNSELOR"
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
  referredByUserId: number; // counselor/admin
  academicYearId: number;
  collegeId: number;
  yearLevelId: number;

  referredDate: string; // ERD: referred_date
  reason: string; // ERD: reason (stored as comma-separated text)
  notes?: string;
  status: "New" | "Reviewed" | "Closed";
  createdAt: string;
};

type Course = {
  id: number;
  name: string;
  collegeId: number;
  collegeName?: string;
};
type CoursesResponse = { ok: boolean; courses?: Course[] };

const USERS_KEY = "gcms_mock_users_v1";
const COLLEGES_KEY = "gcms_mock_colleges_v1";
const YEARS_KEY = "gcms_mock_academic_years_v1";
const YL_KEY = "gcms_mock_year_levels_v1";
const REF_KEY = "gcms_mock_referrals_v1";

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

function parsePositiveInt(raw: string | null): number {
  if (!raw) return 0;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** âœ… Helpers for clean list rendering */
function splitReasons(reasonText: string) {
  return reasonText
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

function formatDateShort(iso: string) {
  if (!iso) return "â€”";
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return iso;
  return dt.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

function fullNameOfUser(u?: { fname: string; mname?: string; lname: string }) {
  if (!u) return "Unknown";
  return `${u.fname} ${u.mname ? `${u.mname} ` : ""}${u.lname}`.trim();
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
    .filter((line) => !/^(name|type|college|course|notes)\s*:/i.test(line));
  return chunks.join("\n");
}

function userCourseId(u: User): number {
  const raw = (u as User & { courseId?: unknown; course_id?: unknown }).courseId ??
    (u as User & { courseId?: unknown; course_id?: unknown }).course_id ??
    0;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}
export default function Referrals() {
  const authUser = useAuthStore((s) => s.user);
  const [searchParams, setSearchParams] = useSearchParams();
  const isTeacherPortal =
    authUser?.role === "TEACHER" ||
    authUser?.role === "NON_TEACHING_PERSONNEL";
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
    () =>
      load<AcademicYear[]>(YEARS_KEY, [
        { id: 1, name: "2024â€“2025", isActive: false },
        { id: 2, name: "2025â€“2026", isActive: true },
      ]),
    [],
  );
  const yearLevels = useMemo<YearLevel[]>(
    () => load<YearLevel[]>(YL_KEY, []),
    [],
  );

  const students = useMemo(
    () => users.filter((u) => u.role === "STUDENT"),
    [users],
  );

  const activeAyId = useMemo(
    () => years.find((y) => y.isActive)?.id ?? years[0]?.id ?? 0,
    [years],
  );

  const [courses, setCourses] = useState<Course[]>([]);
  const selectedAyId = activeAyId;
  const [filterCollegeId, setFilterCollegeId] = useState<number>(() => {
    const fromQuery = parsePositiveInt(searchParams.get("collegeId"));
    if (fromQuery && colleges.some((c) => c.id === fromQuery)) return fromQuery;
    return 0;
  });
  const filteredCourses = useMemo(
    () =>
      filterCollegeId
        ? courses.filter((c) => c.collegeId === filterCollegeId)
        : courses,
    [courses, filterCollegeId],
  );
  const [filterCourseId, setFilterCourseId] = useState<number>(() =>
    parsePositiveInt(searchParams.get("courseId")),
  );

  const filteredYearLevels = useMemo(
    () =>
      yearLevels.filter(
        (yl) =>
          yl.academicYearId === selectedAyId &&
          (filterCollegeId ? yl.collegeId === filterCollegeId : true),
      ),
    [yearLevels, selectedAyId, filterCollegeId],
  );

  const [filterYearLevelId, setFilterYearLevelId] = useState<number>(() =>
    parsePositiveInt(searchParams.get("yearLevelId")),
  );
  const [showClosedHistory, setShowClosedHistory] = useState<boolean>(() => {
    return searchParams.get("tab") === "history";
  });
  useEffect(() => {
    if (filteredYearLevels.length === 0) {
      if (filterYearLevelId !== 0) setFilterYearLevelId(0);
      return;
    }
    const exists = filteredYearLevels.some((yl) => yl.id === filterYearLevelId);
    if (!exists && filterYearLevelId !== 0) setFilterYearLevelId(0);
  }, [filteredYearLevels, filterYearLevelId]);

  useEffect(() => {
    if (filterCourseId && !filteredCourses.some((c) => c.id === filterCourseId)) {
      setFilterCourseId(0);
    }
  }, [filterCourseId, filteredCourses]);

  useEffect(() => {
    const next = new URLSearchParams();
    if (filterCollegeId) next.set("collegeId", String(filterCollegeId));
    if (filterCourseId) next.set("courseId", String(filterCourseId));
    if (filterYearLevelId) next.set("yearLevelId", String(filterYearLevelId));
    if (showClosedHistory) next.set("tab", "history");
    setSearchParams(next, { replace: true });
  }, [
    filterCollegeId,
    filterCourseId,
    filterYearLevelId,
    showClosedHistory,
    setSearchParams,
  ]);

  const filteredStudents = useMemo(() => {
    if (isTeacherPortal) return students;
    return students.filter(
      (s) => {
        const sid = userCourseId(s);
        const matchesCourse = !filterCourseId || sid === 0 || sid === filterCourseId;
        return (
          s.collegeId === filterCollegeId &&
          s.yearLevelId === filterYearLevelId &&
          matchesCourse
        );
      },
    );
  }, [
    students,
    filterCollegeId,
    filterCourseId,
    filterYearLevelId,
    isTeacherPortal,
  ]);

  const [referrals, setReferrals] = useState<Referral[]>(() =>
    load<Referral[]>(REF_KEY, []),
  );

  useEffect(() => {
    let alive = true;
    listReferrals()
      .then((res) => {
        if (!alive) return;
        const next = res.referrals ?? [];
        setReferrals(next);
        save(REF_KEY, next);
      })
      .catch(() => {
        // Keep cached data when API is unreachable.
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    postJSON<CoursesResponse>("/courses_api.php", { action: "list" })
      .then((res) => {
        if (!alive) return;
        setCourses(res.courses ?? []);
      })
      .catch(() => {
        if (!alive) return;
      });
    return () => {
      alive = false;
    };
  }, []);

  const visibleReferrals = useMemo(() => {
    const scoped = isTeacherPortal
      ? referrals.filter((r) => r.referredByUserId === authUser?.id)
      : referrals
          .filter((r) => r.academicYearId === selectedAyId)
          .filter((r) => (filterCollegeId ? r.collegeId === filterCollegeId : true))
          .filter((r) => {
            if (!filterCourseId) return true;
            const selectedCourse = courses.find((c) => c.id === filterCourseId);
            if (!selectedCourse) return true;

            const courseFromNotes = extractLabeledValue(r.notes, "Course")
              .toLowerCase()
              .trim();
            if (courseFromNotes) {
              return courseFromNotes === selectedCourse.name.toLowerCase().trim();
            }

            const student = users.find((u) => u.id === r.studentId);
            if (!student) return true;
            const sid = userCourseId(student);
            return sid === 0 || sid === filterCourseId;
          })
          .filter((r) =>
            filterYearLevelId ? r.yearLevelId === filterYearLevelId : true,
          );

    return scoped.sort((a, b) => (a.referredDate < b.referredDate ? 1 : -1));
  }, [
    referrals,
    isTeacherPortal,
    authUser?.id,
    selectedAyId,
    filterCollegeId,
    filterCourseId,
    filterYearLevelId,
    courses,
    users,
  ]);
  const activeReferrals = useMemo(
    () => visibleReferrals.filter((r) => r.status !== "Closed"),
    [visibleReferrals],
  );
  const closedReferrals = useMemo(
    () => visibleReferrals.filter((r) => r.status === "Closed"),
    [visibleReferrals],
  );

  const userById = (id: number) => users.find((x) => x.id === id);

  const labelUserName = (id: number) => {
    const u = users.find((x) => x.id === id);
    if (!u) return "Unknown";
    return `${u.fname} ${u.mname ? u.mname + " " : ""}${u.lname}`.trim();
  };

  const labelUserEmail = (id: number) => userById(id)?.email ?? "-";

  const labelCollege = (id: number) =>
    colleges.find((c) => c.id === id)?.name ?? "-";
  const labelYearLevel = (id: number) =>
    yearLevels.find((yl) => yl.id === id)?.name ?? "-";

  // âœ… Reasons list (multi-select)
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

  // Create Modal
  const [open, setOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [studentId, setStudentId] = useState<number>(
    filteredStudents[0]?.id ?? 0,
  );
  const [targetName, setTargetName] = useState("");
  const [targetType, setTargetType] = useState<
    "STUDENT" | "TEACHER" | "NON_TEACHING"
  >("STUDENT");
  const [targetCollegeId, setTargetCollegeId] = useState<number>(0);
  const [targetCourseId, setTargetCourseId] = useState<number>(0);
  const [referredByUserId, setReferredByUserId] = useState<number>(
    authUser?.id ?? 0,
  );
  const [referredDate, setReferredDate] = useState("");
  const [selectedReasons, setSelectedReasons] = useState<string[]>([]);
  const [notes, setNotes] = useState("");

  useMemo(() => setStudentId(filteredStudents[0]?.id ?? 0), [filteredStudents]);
  useEffect(() => {
    if (authUser?.id) setReferredByUserId(authUser.id);
  }, [authUser?.id]);

  const teacherCourseOptions = useMemo(
    () => courses.filter((c) => c.collegeId === targetCollegeId),
    [courses, targetCollegeId],
  );

  useEffect(() => {
    if (targetType === "NON_TEACHING") {
      if (targetCollegeId) setTargetCollegeId(0);
      if (targetCourseId) setTargetCourseId(0);
      return;
    }
    if (!targetCollegeId && colleges[0]?.id) {
      setTargetCollegeId(colleges[0].id);
    }
  }, [targetType, targetCollegeId, targetCourseId, colleges]);

  useEffect(() => {
    if (targetType !== "STUDENT") {
      if (targetCourseId) setTargetCourseId(0);
      return;
    }
    if (!targetCollegeId) {
      if (targetCourseId) setTargetCourseId(0);
      return;
    }
    if (!teacherCourseOptions.some((c) => c.id === targetCourseId)) {
      setTargetCourseId(teacherCourseOptions[0]?.id ?? 0);
    }
  }, [targetType, targetCollegeId, teacherCourseOptions, targetCourseId]);

  const referredByDisplay = useMemo(() => {
    if (authUser) return `${authUser.fname} ${authUser.lname}`.trim();
    if (!referredByUserId) return "";
    const u = users.find((x) => x.id === referredByUserId);
    if (!u) return "";
    return `${u.fname} ${u.mname ? `${u.mname} ` : ""}${u.lname}`.trim();
  }, [authUser, referredByUserId, users]);

  const referredByLabel = useMemo(() => {
    const role = String(authUser?.role || "").toUpperCase();
    if (role === "TEACHER") return "Referred By Teacher";
    if (role === "NON_TEACHING_PERSONNEL") {
      return "Referred By Non Teaching Personnel";
    }
    if (role === "ADMIN") return "Referred By Admin";
    return "Referred By Counselor";
  }, [authUser?.role]);

  const personTypeLabel = (v: "STUDENT" | "TEACHER" | "NON_TEACHING") => {
    if (v === "NON_TEACHING") return "Non Teaching Personnel";
    if (v === "TEACHER") return "Teacher";
    return "Student";
  };

  const totalSubmittedCount = useMemo(
    () => visibleReferrals.length,
    [visibleReferrals],
  );

  const studentsReferredCount = useMemo(
    () => new Set(visibleReferrals.map((r) => r.studentId)).size,
    [visibleReferrals],
  );

  const awaitingReviewCount = useMemo(
    () => visibleReferrals.filter((r) => r.status === "New").length,
    [visibleReferrals],
  );

  const handlePrintReferral = (r: Referral) => {
    const student = users.find((u) => u.id === r.studentId);
    const referredBy = users.find((u) => u.id === r.referredByUserId);

    const studentName =
      extractLabeledValue(r.notes, "Name") || fullNameOfUser(student);
    const courseFromNotes = extractLabeledValue(r.notes, "Course");
    const courseYearSection =
      courseFromNotes ||
      `${labelCollege(r.collegeId)} / ${labelYearLevel(r.yearLevelId)}`;

    openReferralFormPrint({
      studentName,
      courseYearSection,
      reasons: splitReasons(r.reason),
      details: cleanDetailsText(r.notes),
      facultyStaffName: fullNameOfUser(referredBy),
      referralDate: r.referredDate,
    });
  };

  const toggleReason = (r: string) => {
    setSelectedReasons((prev) =>
      prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r],
    );
  };

  const updateStatus = (id: number, status: Referral["status"]) => {
    updateReferral({ id, status })
      .then((res) => {
        const next = res.referrals ?? [];
        setReferrals(next);
        save(REF_KEY, next);
      })
      .catch((e: any) => {
        alert(e?.message || "Failed to update referral status.");
      });
  };

  const handleCreate = async () => {
    const normalize = (v: string) => v.toLowerCase().replace(/\s+/g, " ").trim();

    if (isTeacherPortal) {
      if (!targetName.trim() || !referredByUserId || !referredDate || selectedReasons.length === 0) return;
      if ((targetType === "STUDENT" || targetType === "TEACHER") && !targetCollegeId) return;
      if (targetType === "STUDENT" && !targetCourseId) return;

      const allowedRoles =
        targetType === "STUDENT"
          ? ["STUDENT"]
          : targetType === "TEACHER"
            ? ["TEACHER"]
            : ["COUNSELOR", "ADMIN", "NON_TEACHING_PERSONNEL"];
      const inputName = normalize(targetName);
      const targetUser = users.find((u) => {
        if (!allowedRoles.includes(u.role)) return false;
        const full = `${u.fname} ${u.mname ? `${u.mname} ` : ""}${u.lname}`;
        return normalize(full) === inputName;
      });

      if (!targetUser) {
        alert("Name not found for the selected type. Please check the spelling.");
        return;
      }

      let payloadCollegeId = 0;
      if (targetType === "STUDENT" || targetType === "TEACHER") {
        if (!targetCollegeId) {
          alert("Please select a college.");
          return;
        }
        payloadCollegeId = targetCollegeId;
      } else {
        payloadCollegeId = Number(targetUser.collegeId ?? colleges[0]?.id ?? 0);
      }

      const fallbackYearLevel =
        yearLevels.find(
          (yl) =>
            yl.academicYearId === selectedAyId && yl.collegeId === payloadCollegeId,
        ) ??
        yearLevels.find((yl) => yl.academicYearId === selectedAyId) ??
        yearLevels[0];

      const payloadYearLevelId =
        targetType === "STUDENT"
          ? Number(targetUser.yearLevelId ?? fallbackYearLevel?.id ?? 0)
          : Number(fallbackYearLevel?.id ?? 0);

      if (!payloadCollegeId || !payloadYearLevelId) {
        alert("Missing college or year level mapping. Please review inputs.");
        return;
      }

      const selectedCollegeName =
        colleges.find((c) => c.id === payloadCollegeId)?.name ?? "";
      const selectedCourseName =
        courses.find((c) => c.id === targetCourseId)?.name ?? "";

      const metadataBits = [
        `Name: ${targetName.trim()}`,
        `Type: ${personTypeLabel(targetType)}`,
        (targetType === "STUDENT" || targetType === "TEACHER") && selectedCollegeName
          ? `College: ${selectedCollegeName}`
          : "",
        targetType === "STUDENT" && selectedCourseName
          ? `Course: ${selectedCourseName}`
          : "",
        notes.trim() ? `Notes: ${notes.trim()}` : "",
      ].filter(Boolean);

      try {
        const res = await createReferral({
          studentId: targetUser.id,
          referredByUserId,
          academicYearId: selectedAyId,
          collegeId: payloadCollegeId,
          yearLevelId: payloadYearLevelId,
          referredDate,
          reason: selectedReasons.join(", "),
          notes: metadataBits.join(" | "),
        });

        const next = res.referrals ?? [];
        setReferrals(next);
        save(REF_KEY, next);

        setTargetName("");
        setTargetType("STUDENT");
        setTargetCollegeId(0);
        setTargetCourseId(0);
        setReferredDate("");
        setSelectedReasons([]);
        setNotes("");
        setOpen(false);
      } catch (e: any) {
        alert(e?.message || "Failed to create referral.");
      }
      return;
    }

    if (!studentId || !referredByUserId || !referredDate || selectedReasons.length === 0) return;

    const payloadCollegeId = filterCollegeId;
    const payloadYearLevelId = filterYearLevelId;

    if (!payloadCollegeId || !payloadYearLevelId) {
      alert("Selected student has no college or year level assigned.");
      return;
    }

    try {
      const res = await createReferral({
        studentId,
        referredByUserId,
        academicYearId: selectedAyId,
        collegeId: payloadCollegeId,
        yearLevelId: payloadYearLevelId,
        referredDate,
        reason: selectedReasons.join(", "),
        notes: notes.trim() ? notes.trim() : undefined,
      });

      const next = res.referrals ?? [];
      setReferrals(next);
      save(REF_KEY, next);

      setReferredDate("");
      setSelectedReasons([]);
      setNotes("");
      setOpen(false);
    } catch (e: any) {
      alert(e?.message || "Failed to create referral.");
    }
  };

  // Styles
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
    minHeight: 90,
    resize: "vertical",
  };

  const primaryButton: React.CSSProperties = {
    height: 40,
    padding: "0 16px",
    borderRadius: 10,
    border: "none",
    background: "var(--primary)",
    color: "white",
    fontWeight: 800,
    cursor: "pointer",
    whiteSpace: "nowrap",
  };

  const ghostButton: React.CSSProperties = {
    height: 40,
    padding: "0 16px",
    borderRadius: 10,
    border: "1px solid var(--border)",
    background: "transparent",
    color: "var(--primary)",
    fontWeight: 800,
    cursor: "pointer",
  };

  const label: React.CSSProperties = {
    fontSize: 13,
    fontWeight: 800,
    opacity: 0.85,
  };

  const th: React.CSSProperties = {
    textAlign: "left",
    padding: "10px 8px",
    opacity: 0.8,
  };
  const td: React.CSSProperties = {
    padding: "10px 8px",
    borderTop: "1px solid var(--border)",
    verticalAlign: "top",
  };

  const smallMuted: React.CSSProperties = {
    fontSize: 12,
    opacity: 0.75,
    fontWeight: 700,
  };

  const reasonWrap: React.CSSProperties = {
    display: "flex",
    flexWrap: "wrap",
    gap: 6,
    alignItems: "center",
    maxWidth: 520,
  };

  const reasonChip: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 800,
    padding: "5px 10px",
    borderRadius: 999,
    border: "1px solid var(--border)",
    background: "rgba(15,23,42,0.04)",
    whiteSpace: "nowrap",
  };

  const iconAction: React.CSSProperties = {
    height: 34,
    width: 34,
    borderRadius: 10,
    border: "1px solid var(--border)",
    background: "white",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    color: "var(--primary)",
  };

  const filterQuery = useMemo(() => {
    const qs = searchParams.toString();
    return qs ? `?${qs}` : "";
  }, [searchParams]);
  const tableReferrals = historyOpen || showClosedHistory ? closedReferrals : activeReferrals;

  const referralTable = (
    <table style={{ width: "100%", borderCollapse: "collapse" }}>
      <thead>
        <tr>
          <th style={th}>Name</th>
          <th style={th}>Email</th>
          <th style={th}>Referred By</th>
          <th style={th}>Date</th>
          <th style={th}>Reason</th>
          <th style={th}>Status</th>
          <th style={th}></th>
        </tr>
      </thead>

      <tbody>
        {tableReferrals.length === 0 ? (
          <tr>
            <td style={td} colSpan={7}>
              <span style={{ opacity: 0.8 }}>
                {historyOpen || showClosedHistory
                  ? "No closed referrals found for this filter."
                  : isTeacherPortal
                    ? "No active referrals yet."
                    : "No active referrals found for this filter."}
              </span>
            </td>
          </tr>
        ) : (
          tableReferrals.map((r) => {
            const reasons = splitReasons(r.reason);
            const preview = reasons.slice(0, 2);
            const remaining = reasons.length - preview.length;

            return (
              <tr key={r.id}>
                <td style={td}>
                  <div style={{ fontWeight: 900 }}>{labelUserName(r.studentId)}</div>
                  {r.notes && (
                    <div style={{ opacity: 0.8, fontSize: 13 }}>{r.notes}</div>
                  )}
                </td>

                <td style={td}>
                  <div style={smallMuted}>{labelUserEmail(r.studentId)}</div>
                </td>

                <td style={td}>{labelUserName(r.referredByUserId)}</td>

                <td style={td}>
                  <div style={smallMuted}>{formatDateShort(r.referredDate)}</div>
                </td>

                <td style={td}>
                  <div style={reasonWrap} title={reasons.join(", ")}>
                    {preview.map((x) => (
                      <span key={x} style={reasonChip}>
                        {x}
                      </span>
                    ))}
                    {remaining > 0 && (
                      <span
                        style={{
                          ...reasonChip,
                          background: "rgba(99,102,241,0.10)",
                          border: "1px solid rgba(99,102,241,0.25)",
                        }}
                      >
                        +{remaining} more
                      </span>
                    )}
                    {reasons.length === 0 && <span style={smallMuted}>â€”</span>}
                  </div>
                </td>

                <td style={td}>
                  <DropdownSelect
                    value={r.status}
                    onChange={(e) =>
                      updateStatus(r.id, e.target.value as Referral["status"])
                    }
                  >
                    <option value="New">New</option>
                    <option value="Reviewed">Reviewed</option>
                    <option value="Closed">Closed</option>
                  </DropdownSelect>
                </td>

                <td style={td}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <button
                      type="button"
                      title="Print / Download Referral Form"
                      onClick={() => handlePrintReferral(r)}
                      style={iconAction}
                    >
                      <Printer size={16} />
                    </button>
                    <Link
                      to={`/app/referrals/${r.id}${filterQuery}`}
                      title="View referral"
                      aria-label="View referral"
                      style={{ ...iconAction, textDecoration: "none" }}
                    >
                      <Eye size={16} />
                    </Link>
                  </div>
                </td>
              </tr>
            );
          })
        )}
      </tbody>
    </table>
  );

  const createReferralModal = (
    <Modal open={open} onClose={() => setOpen(false)} title="Create Referral">
      <div style={{ display: "grid", gap: 12 }}>
        {isTeacherPortal ? (
          <>
            <div>
              <div style={label}>Name</div>
              <input
                value={targetName}
                onChange={(e) => setTargetName(e.target.value)}
                placeholder="Type full name"
                style={inputStyle}
              />
            </div>

            <div>
              <div style={label}>Type</div>
              <DropdownSelect
                value={targetType}
                onChange={(e) =>
                  setTargetType(
                    e.target.value as "STUDENT" | "TEACHER" | "NON_TEACHING",
                  )
                }
              >
                <option value="STUDENT">Student</option>
                <option value="TEACHER">Teacher</option>
                <option value="NON_TEACHING">Non Teaching Personnel</option>
              </DropdownSelect>
            </div>

            {(targetType === "STUDENT" || targetType === "TEACHER") && (
              <div>
                <div style={label}>College</div>
                <DropdownSelect
                  value={targetCollegeId}
                  onChange={(e) => setTargetCollegeId(Number(e.target.value))}
                >
                  <option value={0}>Select college</option>
                  {colleges.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </DropdownSelect>
              </div>
            )}

            {targetType === "STUDENT" && (
              <div>
                <div style={label}>Course</div>
                <DropdownSelect
                  value={targetCourseId}
                  onChange={(e) => setTargetCourseId(Number(e.target.value))}
                >
                  <option value={0}>
                    {targetCollegeId ? "Select course" : "Select college first"}
                  </option>
                  {teacherCourseOptions.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </DropdownSelect>
              </div>
            )}
          </>
        ) : (
          <div>
            <div style={label}>Student (filtered by College + Year Level)</div>
            <DropdownSelect
              value={studentId}
              onChange={(e) => setStudentId(Number(e.target.value))}
            >
              {filteredStudents.map((s) => (
                <option key={s.id} value={s.id}>
                  {`${s.fname} ${s.mname ? s.mname + " " : ""}${s.lname}`} ({s.email})
                </option>
              ))}
            </DropdownSelect>
            {filteredStudents.length === 0 && (
              <div style={{ marginTop: 8, opacity: 0.8, fontSize: 13 }}>
                No students found in this College + Year Level. Add students in
                User Management.
              </div>
            )}
          </div>
        )}

        <div>
          <div style={label}>{referredByLabel}</div>
          <input
            value={referredByDisplay}
            readOnly
            style={{
              ...inputStyle,
              background: "rgba(15,23,42,0.06)",
              color: "rgba(15,23,42,0.85)",
              cursor: "default",
            }}
          />
        </div>

        <div>
          <div style={label}>Referred Date</div>
          <input
            type="date"
            value={referredDate}
            onChange={(e) => setReferredDate(e.target.value)}
            style={inputStyle}
          />
        </div>

        <div>
          <div style={label}>Reason for Referral (Select all that apply)</div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 8,
              padding: 12,
              borderRadius: 12,
              border: "1px solid var(--border)",
              background: "white",
            }}
          >
            {referralReasons.map((r) => (
              <label
                key={r}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  fontSize: 13,
                  fontWeight: 700,
                  opacity: 0.9,
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
            <div
              style={{
                marginTop: 10,
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
              }}
            >
              {selectedReasons.map((r) => (
                <span
                  key={r}
                  style={{
                    padding: "6px 10px",
                    borderRadius: 999,
                    border: "1px solid var(--border)",
                    background: "rgba(15,23,42,0.04)",
                    fontSize: 12,
                    fontWeight: 800,
                  }}
                >
                  {r}
                </span>
              ))}
            </div>
          )}
        </div>

        <div>
          <div style={label}>Notes (optional)</div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            style={textareaStyle}
            placeholder="Add details or specify 'Others' here..."
          />
        </div>

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={() => setOpen(false)} style={ghostButton}>
            Cancel
          </button>
          <button
            onClick={handleCreate}
            style={primaryButton}
            disabled={
              isTeacherPortal
                ? !targetName.trim() ||
                  !referredByUserId ||
                  !referredDate ||
                  selectedReasons.length === 0 ||
                  ((targetType === "STUDENT" || targetType === "TEACHER") &&
                    !targetCollegeId) ||
                  (targetType === "STUDENT" && !targetCourseId)
                : filteredStudents.length === 0 || !referredByUserId
            }
            title={
              isTeacherPortal
                ? !targetName.trim()
                  ? "Type name"
                  : (targetType === "STUDENT" || targetType === "TEACHER") &&
                      !targetCollegeId
                    ? "Select college"
                    : targetType === "STUDENT" && !targetCourseId
                      ? "Select course"
                      : !referredDate
                        ? "Select referred date"
                        : selectedReasons.length === 0
                          ? "Select at least one reason"
                          : ""
                : filteredStudents.length === 0
                  ? "No students found for this College + Year Level"
                  : !referredByUserId
                    ? "Signed-in user is missing"
                    : selectedReasons.length === 0
                      ? "Select at least one reason"
                      : ""
            }
          >
            Create
          </button>
        </div>
      </div>
    </Modal>
  );

  const historyModal = (
    <Modal
      open={historyOpen}
      onClose={() => setHistoryOpen(false)}
      title="Closed Referral History"
    >
      <div style={{ display: "grid", gap: 12 }}>
        <div style={{ ...smallMuted, fontSize: 13 }}>
          Showing closed referrals you submitted.
        </div>
        <div
          style={{
            border: "1px solid var(--border)",
            borderRadius: 12,
            padding: 10,
            background: "white",
            maxHeight: "62vh",
            overflow: "auto",
          }}
        >
          {referralTable}
        </div>
      </div>
    </Modal>
  );

  if (isTeacherPortal) {
    return (
      <div style={{ display: "grid", gap: 24 }}>
        <section
          style={{
            borderRadius: 24,
            padding: "54px 24px",
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.94) 0%, rgba(248,250,252,0.96) 100%)",
            border: "1px solid rgba(15,23,42,0.08)",
            boxShadow: "0 24px 60px rgba(15,23,42,0.07)",
            textAlign: "center",
          }}
        >
          <h1
            style={{
              margin: 0,
              fontSize: "clamp(34px, 5vw, 54px)",
              lineHeight: 1.08,
              fontWeight: 900,
              color: "var(--text)",
            }}
          >
            Referral Management Portal
          </h1>
          <p
            style={{
              margin: "14px 0 0",
              fontSize: "clamp(16px, 2.2vw, 22px)",
              color: "rgba(51,65,85,0.82)",
              fontWeight: 600,
            }}
          >
            Submit and monitor guidance referrals for students and school
            personnel.
          </p>
          <div
            style={{
              marginTop: 26,
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <button
              onClick={() => setOpen(true)}
              style={{
                height: 50,
                padding: "0 24px",
                fontSize: 16,
                borderRadius: 14,
                border: "1px solid rgba(15,23,42,1)",
                background: "rgba(15,23,42,1)",
                color: "white",
                fontWeight: 900,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                boxShadow: "0 16px 30px rgba(15,23,42,0.25)",
              }}
            >
              <Plus size={16} />
              Add Referral
            </button>
            <button
              onClick={() => setHistoryOpen(true)}
              style={{
                height: 50,
                padding: "0 22px",
                fontSize: 15,
                borderRadius: 14,
                background: "rgba(15,23,42,1)",
                border: "1px solid rgba(15,23,42,1)",
                color: "white",
                fontWeight: 900,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                boxShadow: "0 16px 30px rgba(15,23,42,0.25)",
              }}
            >
              <HistoryIcon size={16} />
              View Referral History
            </button>
          </div>
        </section>

        <section
          style={{
            ...card,
            borderRadius: 20,
            padding: 22,
            boxShadow: "0 20px 44px rgba(15,23,42,0.08)",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: 12,
            }}
          >
            {[
              { title: "Total Referrals Submitted", value: totalSubmittedCount },
              { title: "Unique Students Referred", value: studentsReferredCount },
              { title: "Awaiting Counselor Review", value: awaitingReviewCount },
            ].map((item) => (
              <div
                key={item.title}
                style={{
                  borderRadius: 14,
                  border: "1px solid rgba(15,23,42,0.09)",
                  background: "rgba(255,255,255,0.86)",
                  boxShadow: "0 12px 24px rgba(15,23,42,0.06)",
                  padding: "14px 16px",
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 800, opacity: 0.72 }}>
                  {item.title}
                </div>
                <div style={{ fontSize: 28, fontWeight: 950, marginTop: 8 }}>
                  {item.value}
                </div>
              </div>
            ))}
          </div>

        </section>

        {createReferralModal}
        {historyModal}
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div
        style={{
          display: "flex",
          gap: 12,
          alignItems: "flex-end",
          flexWrap: "wrap",
        }}
      >
        <h2 style={{ fontWeight: 800, marginRight: "auto", marginTop: 6 }}>
          Referrals
        </h2>

        <div style={{ display: "grid", gap: 6 }}>
          <div style={label}>College</div>
          <DropdownSelect
            value={filterCollegeId}
            onChange={(e) => setFilterCollegeId(Number(e.target.value))}
          >
            <option value={0}>All colleges</option>
            {colleges.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </DropdownSelect>
        </div>

        <div style={{ display: "grid", gap: 6 }}>
          <div style={label}>Course</div>
          <DropdownSelect
            value={filterCourseId}
            onChange={(e) => setFilterCourseId(Number(e.target.value))}
          >
            <option value={0}>
              {filteredCourses.length ? "All courses" : "No courses found"}
            </option>
            {filteredCourses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </DropdownSelect>
        </div>

        <div style={{ display: "grid", gap: 6 }}>
          <div style={label}>Year Level</div>
          <DropdownSelect
            value={filterYearLevelId}
            onChange={(e) => setFilterYearLevelId(Number(e.target.value))}
          >
            <option value={0}>All year levels</option>
            {filteredYearLevels.map((yl) => (
              <option key={yl.id} value={yl.id}>
                {yl.name}
              </option>
            ))}
          </DropdownSelect>
        </div>

        <button onClick={() => setOpen(true)} style={primaryButton}>
          + Create Referral
        </button>
        <button
          onClick={() => setShowClosedHistory((v) => !v)}
          style={ghostButton}
          title={showClosedHistory ? "Show active referrals" : "Show closed history"}
          aria-label={showClosedHistory ? "Show active referrals" : "Show closed history"}
        >
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            {showClosedHistory ? <List size={16} /> : <HistoryIcon size={16} />}
            {showClosedHistory ? "Active Referrals" : "Closed History"}
          </span>
        </button>
      </div>

      <div style={card}>
        <h3 style={{ marginBottom: 10 }}>
          {showClosedHistory ? "Closed Referral History" : "Referral List"}
        </h3>
        {referralTable}
      </div>

      {createReferralModal}
    </div>
  );
}





