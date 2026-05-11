import { useEffect, useMemo, useRef, useState } from "react";
import {
  Pencil,
  Trash2,
  X,
  Search,
  CheckCircle2,
  XCircle,
  List,
  ArrowUp,
  Archive,
  Users as UsersIcon,
  Plus,
  FileUp,
} from "lucide-react";
import { postFormData, postJSON } from "../lib/api";
import SuccessNoticeModal from "../components/SuccessNoticeModal";
import LoadingSpinner from "../components/LoadingSpinner";
import UserManagementProcessingOverlay from "../components/UserManagementProcessingOverlay";
import {
  normalizeSentenceCaseName,
  toSentenceCaseNameInput,
} from "../lib/nameCase";
import { matchesSearchPrefix } from "../lib/searchPrefix";

type Role =
  | "ADMIN"
  | "STAFF"
  | "TEACHER"
  | "NON_TEACHING_PERSONNEL"
  | "STUDENT";

type College = { id: number; name: string };
type AcademicYear = { id: number; name: string; isActive: boolean };
type YearLevel = {
  id: number;
  name: string;
  collegeId: number;
  academicYearId: number;
};
type Course = {
  id: number;
  name: string;
  collegeId: number;
};

type User = {
  id: number;
  fname: string;
  mname?: string;
  lname: string;
  email: string;
  role: Role;
  username: string;
  registered: boolean;

  // Student-only fields
  collegeId?: number;
  courseId?: number;
  courseName?: string;
  yearLevelId?: number;
  section?: string;
  isArchived?: boolean;
  archivedAt?: string | null;
  archiveReason?: string | null;
};

type BootstrapResponse = {
  ok: boolean;
  users?: Array<{
    id: number;
    fname: string;
    mname?: string | null;
    lname: string;
    email: string;
    role: string;
    username?: string | null;
    registered?: number | boolean | null;
    collegeId?: number | null;
    courseId?: number | null;
    courseName?: string | null;
    yearLevelId?: number | null;
    section?: string | null;
    isArchived?: number | boolean | null;
    archivedAt?: string | null;
    archiveReason?: string | null;
  }>;
  colleges?: College[];
  academicYears?: AcademicYear[];
  yearLevels?: YearLevel[];
  courses?: Course[];
};

type CsvImportResponse = {
  ok: boolean;
  message?: string;
  inserted: number;
  skipped: number;
  errors?: string[];
};

type YearEndHistoryRecord = {
  id: number;
  userId?: number | null;
  studentName: string;
  studentEmail: string;
  collegeName: string;
  courseName: string;
  sectionName: string;
  fromYearLevelName: string;
  toYearLevelName?: string | null;
  academicYearName: string;
  actionNote: string;
  actionAt: string;
};

type YearEndHistoryResponse = {
  ok: boolean;
  promotedHistory?: YearEndHistoryRecord[];
  archivedHistory?: YearEndHistoryRecord[];
};

const USERS_KEY = "gcms_mock_users_v1";
const COLLEGES_KEY = "gcms_mock_colleges_v1";
const YEARS_KEY = "gcms_mock_academic_years_v1";
const YL_KEY = "gcms_mock_year_levels_v1";
const COURSES_KEY = "gcms_mock_courses_v1";
const BISU_DOMAIN = "bisu.edu.ph";
const USERS_PAGE_SIZE = 10;
const PROCESSING_MIN_MS = 2000;
const CSV_SAMPLE = `first_name,middle_name,last_name,email,username,role,college_name,course_name,year_level_name,section,password
Celine,,Abao,celine.abao@bisu.edu.ph,celine.abao,STUDENT,College of Science,Bachelor of Science in Computer Science,3rd Year,A,Welcome123
Faye,,Tutor,faye.tutor@bisu.edu.ph,faye.tutor,STUDENT,College of Teacher Education,Bachelor of Secondary Education Major in English,3rd Year,A,Welcome123
Brent,,Sales,brent.sales@bisu.edu.ph,brent.sales,STUDENT,College of Business and Management,Bachelor of Science in Office Administration,3rd Year,B,Welcome123
May,,Santos,may.santos@bisu.edu.ph,may.santos,STAFF,,,,,Welcome123
Noel,,Reyes,noel.reyes@bisu.edu.ph,noel.reyes,TEACHER,,,,,Welcome123
Rica,,Flores,rica.flores@bisu.edu.ph,rica.flores,NON_TEACHING_PERSONNEL,,,,,Welcome123
`;

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

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatDateTime(value?: string | null): string {
  const raw = String(value || "").trim();
  if (!raw) return "-";
  const parsed = new Date(raw.includes("T") ? raw : raw.replace(" ", "T"));
  if (Number.isNaN(parsed.getTime())) return raw;
  return parsed.toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function normalizeEmailInput(value: string): string {
  const clean = String(value || "")
    .toLowerCase()
    .replace(/\s+/g, "");
  if (!clean) return "";
  if (!clean.includes("@")) return clean;
  const local = clean.split("@")[0];
  if (!local) return "";
  return `${local}@${BISU_DOMAIN}`;
}

function normalizeBisuEmail(value: string): string {
  const clean = String(value || "")
    .toLowerCase()
    .replace(/\s+/g, "");
  if (!clean) return "";
  const localRaw = clean.split("@")[0];
  const local = localRaw.replace(/[^a-z0-9._-]/g, "");
  if (!local) return "";
  return `${local}@${BISU_DOMAIN}`;
}

function usernameFromEmail(email: string): string {
  return String(email || "").split("@")[0] || "";
}

function normalizeUser(u: User): User {
  return {
    ...u,
    fname: normalizeSentenceCaseName(u.fname),
    mname: u.mname ? normalizeSentenceCaseName(u.mname) : undefined,
    lname: normalizeSentenceCaseName(u.lname),
    email: normalizeBisuEmail(u.email),
    username: String(u.username || "").trim(),
    registered: Boolean(u.registered),
    courseName: String(u.courseName || "").trim() || undefined,
    section: String(u.section || "").trim() || undefined,
  };
}

function toRole(value: string): Role {
  const r = String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");
  if (r === "COUNSELOR") return "STAFF";
  if (r === "ADMIN" || r === "STAFF" || r === "TEACHER") return r;
  if (r === "NON_TEACHING" || r === "NON_TEACHING_STAFF") {
    return "NON_TEACHING_PERSONNEL";
  }
  if (r === "NON_TEACHING_PERSONNEL") return "NON_TEACHING_PERSONNEL";
  return "STUDENT";
}

function roleLabel(role: Role): string {
  if (role === "NON_TEACHING_PERSONNEL") return "Non-Teaching Personnel";
  if (role === "STAFF") return "Staff";
  if (role === "TEACHER") return "Teacher";
  if (role === "ADMIN") return "Admin";
  return "Student";
}

function isUserArchived(user: User): boolean {
  return Boolean(user.isArchived);
}

function extractYearLevelRank(name?: string): number {
  const raw = String(name || "").trim().toLowerCase();
  if (!raw) return 0;

  const digitMatch = raw.match(/(\d+)/);
  if (digitMatch) {
    const rank = Number(digitMatch[1]);
    return Number.isFinite(rank) ? rank : 0;
  }

  if (raw.includes("first")) return 1;
  if (raw.includes("second")) return 2;
  if (raw.includes("third")) return 3;
  if (raw.includes("fourth")) return 4;
  if (raw.includes("fifth")) return 5;
  if (raw.includes("sixth")) return 6;

  return 0;
}

function mapBootstrapUser(u: NonNullable<BootstrapResponse["users"]>[number]): User {
  return normalizeUser({
    id: Number(u.id || 0),
    fname: String(u.fname || ""),
    mname: u.mname ? String(u.mname) : undefined,
    lname: String(u.lname || ""),
    email: String(u.email || ""),
    role: toRole(u.role),
    username: String(u.username || usernameFromEmail(String(u.email || ""))),
    registered: Boolean(
      u.registered === null || u.registered === undefined
        ? true
        : Number(u.registered) === 1 || u.registered === true,
    ),
    collegeId:
      u.collegeId === null || u.collegeId === undefined
        ? undefined
        : Number(u.collegeId),
    courseId:
      u.courseId === null || u.courseId === undefined
        ? undefined
        : Number(u.courseId),
    courseName: u.courseName ? String(u.courseName) : undefined,
    yearLevelId:
      u.yearLevelId === null || u.yearLevelId === undefined
        ? undefined
        : Number(u.yearLevelId),
    section: u.section ? String(u.section) : undefined,
    isArchived: Boolean(
      u.isArchived === null || u.isArchived === undefined
        ? false
        : Number(u.isArchived) === 1 || u.isArchived === true,
    ),
    archivedAt: u.archivedAt ? String(u.archivedAt) : undefined,
    archiveReason: u.archiveReason ? String(u.archiveReason) : undefined,
  });
}

export default function Users() {
  const [isAddTriggerPressed, setIsAddTriggerPressed] = useState(false);
  const [isImportTriggerPressed, setIsImportTriggerPressed] = useState(false);
  const [isYearEndResultsTriggerPressed, setIsYearEndResultsTriggerPressed] =
    useState(false);
  const [isAddSubmitPressed, setIsAddSubmitPressed] = useState(false);
  const [colleges, setColleges] = useState<College[]>(() =>
    load<College[]>(COLLEGES_KEY, [
      { id: 1, name: "College of Computer Studies" },
      { id: 2, name: "College of Education" },
    ]),
  );

  const [years, setYears] = useState<AcademicYear[]>(() =>
    load<AcademicYear[]>(YEARS_KEY, [
      { id: 1, name: "2024-2025", isActive: false },
      { id: 2, name: "2025-2026", isActive: true },
    ]),
  );
  const [yearLevels, setYearLevels] = useState<YearLevel[]>(() =>
    load<YearLevel[]>(YL_KEY, [
      { id: 1, name: "1st Year", collegeId: 1, academicYearId: 2 },
      { id: 2, name: "2nd Year", collegeId: 1, academicYearId: 2 },
    ]),
  );
  const [courses, setCourses] = useState<Course[]>(() =>
    load<Course[]>(COURSES_KEY, []),
  );
  const [users, setUsers] = useState<User[]>(() =>
    load<User[]>(USERS_KEY, [
      {
        id: 1,
        fname: "System",
        lname: "Admin",
        email: "admin@bisu.edu.ph",
        role: "ADMIN",
        username: "admin",
        registered: true,
      },
    ]).map(normalizeUser),
  );

  const activeYearId = useMemo(
    () => years.find((y) => y.isActive)?.id ?? years[0]?.id ?? 0,
    [years],
  );

  const syncEntitiesFromDatabase = async () => {
    const res = await postJSON<BootstrapResponse>("/entities_bootstrap.php", {});
    if (!res.ok) return;

    const nextColleges = (res.colleges ?? []).map((c) => ({
      id: Number(c.id),
      name: String(c.name),
    }));
    const nextYears = (res.academicYears ?? []).map((y) => ({
      id: Number(y.id),
      name: String(y.name),
      isActive: Boolean(y.isActive),
    }));
    const nextYearLevels = (res.yearLevels ?? []).map((yl) => ({
      id: Number(yl.id),
      name: String(yl.name),
      collegeId: Number(yl.collegeId),
      academicYearId: Number(yl.academicYearId),
    }));
    const nextCourses = (res.courses ?? []).map((c) => ({
      id: Number(c.id),
      name: String(c.name),
      collegeId: Number(c.collegeId),
    }));
    const nextUsers = (res.users ?? []).map(mapBootstrapUser);

    setColleges(nextColleges);
    setYears(nextYears);
    setYearLevels(nextYearLevels);
    setCourses(nextCourses);
    setUsers(nextUsers);
  };

  const syncYearEndHistory = async () => {
    setYearEndHistoryLoading(true);
    setYearEndHistoryError("");
    try {
      const res = await postJSON<YearEndHistoryResponse>("/user_year_end_api.php", {
        action: "history",
      });
      if (!res.ok) {
        throw new Error("Failed to load year-end history.");
      }
      setPromotedHistory(res.promotedHistory ?? []);
      setArchivedHistory(res.archivedHistory ?? []);
    } catch (error: any) {
      setYearEndHistoryError(
        error?.message || "Failed to load year-end promotion and archive history.",
      );
    } finally {
      setYearEndHistoryLoading(false);
    }
  };

  useEffect(() => {
    let alive = true;
    Promise.all([syncEntitiesFromDatabase(), syncYearEndHistory()]).catch(() => {
      if (!alive) return;
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => save(COLLEGES_KEY, colleges), [colleges]);
  useEffect(() => save(YEARS_KEY, years), [years]);
  useEffect(() => save(YL_KEY, yearLevels), [yearLevels]);
  useEffect(() => save(COURSES_KEY, courses), [courses]);
  useEffect(() => save(USERS_KEY, users), [users]);

  // ===== ADD USER MODAL =====
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [fname, setFname] = useState("");
  const [mname, setMname] = useState("");
  const [lname, setLname] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("STUDENT");
  const [collegeId, setCollegeId] = useState<number>(colleges[0]?.id ?? 0);
  const [courseId, setCourseId] = useState<number>(0);
  const [yearLevelId, setYearLevelId] = useState<number>(0);
  const [section, setSection] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState("");
  const [addSuccess, setAddSuccess] = useState("");
  const [successNotice, setSuccessNotice] = useState<{
    title: string;
    message: string;
  } | null>(null);
  const [yearEndHistoryTab, setYearEndHistoryTab] = useState<
    "PROMOTED" | "ARCHIVED"
  >("PROMOTED");
  const [promotedHistory, setPromotedHistory] = useState<YearEndHistoryRecord[]>([]);
  const [archivedHistory, setArchivedHistory] = useState<YearEndHistoryRecord[]>([]);
  const [yearEndHistoryLoading, setYearEndHistoryLoading] = useState(false);
  const [yearEndHistoryError, setYearEndHistoryError] = useState("");

  const addFilteredYearLevels = useMemo(() => {
    return yearLevels.filter(
      (yl) => yl.collegeId === collegeId && yl.academicYearId === activeYearId,
    );
  }, [yearLevels, collegeId, activeYearId]);
  const addFilteredCourses = useMemo(() => {
    return courses.filter((c) => c.collegeId === collegeId);
  }, [courses, collegeId]);

  useEffect(() => {
    if (role !== "STUDENT") return;
    if (!collegeId || !colleges.some((c) => c.id === collegeId)) {
      setCollegeId(colleges[0]?.id ?? 0);
    }
  }, [role, collegeId, colleges]);

  useEffect(() => {
    if (role !== "STUDENT") return;
    setYearLevelId(addFilteredYearLevels[0]?.id ?? 0);
  }, [role, collegeId, addFilteredYearLevels]);

  useEffect(() => {
    if (role !== "STUDENT") return;
    const ok = addFilteredCourses.some((c) => c.id === courseId);
    if (!ok) setCourseId(addFilteredCourses[0]?.id ?? 0);
  }, [role, collegeId, addFilteredCourses, courseId]);

  const closeAddModal = () => {
    if (adding) return;
    setIsAddOpen(false);
    setAddError("");
    setAddSuccess("");
  };
  const openAddModal = () => {
    // Keep list visible after opening modal even if browser autofilled search.
    setSearchText("");
    setIsAddOpen(true);
  };

  const handleAddUser = async () => {
    setAddError("");
    setAddSuccess("");
    if (adding) return;

    const f = normalizeSentenceCaseName(fname);
    const m = normalizeSentenceCaseName(mname);
    const l = normalizeSentenceCaseName(lname);
    const e = normalizeBisuEmail(email);
    if (!f || !l || !e) {
      setAddError("First name, last name, and BISU email are required.");
      return;
    }
    if (role === "STUDENT" && (!collegeId || !yearLevelId)) {
      setAddError("Student users must have a college and year level.");
      return;
    }

    const exists = users.some((u) => u.email.trim().toLowerCase() === e);
    if (exists) {
      setAddError("This email already exists.");
      return;
    }

    try {
      const startedAt = Date.now();
      setAdding(true);
      await postJSON<{ ok?: boolean; users_id?: number }>("/create_user.php", {
        fname: f,
        mname: m || "",
        lname: l,
        email: e,
        role,
        collegeId: role === "STUDENT" ? collegeId : undefined,
        courseId: role === "STUDENT" && courseId > 0 ? courseId : undefined,
        yearLevelId: role === "STUDENT" ? yearLevelId : undefined,
        section: role === "STUDENT" ? section.trim() : undefined,
      });
      await syncEntitiesFromDatabase();
      const elapsed = Date.now() - startedAt;
      if (elapsed < PROCESSING_MIN_MS) {
        await wait(PROCESSING_MIN_MS - elapsed);
      }

      setAddSuccess("User added successfully.");
      setSuccessNotice({
        title: "User Added",
        message: "The user has been added successfully.",
      });
      setFname("");
      setMname("");
      setLname("");
      setEmail("");
      setRole("STUDENT");
      setCourseId(0);
      setSection("");
    } catch (e: any) {
      setAddError(e?.message || "Failed to add user.");
    } finally {
      setAdding(false);
    }
  };

  // ===== CSV IMPORT MODAL =====
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState("");
  const [importResult, setImportResult] = useState<CsvImportResponse | null>(null);
  const csvFileInputRef = useRef<HTMLInputElement | null>(null);

  const closeImportModal = () => {
    setIsImportOpen(false);
    setCsvFile(null);
    setImportError("");
    setImportResult(null);
  };
  const openImportModal = () => {
    // Keep list visible after opening modal even if browser autofilled search.
    setSearchText("");
    setIsImportOpen(true);
  };

  const handleImportCsv = async () => {
    setImportError("");
    setImportResult(null);
    if (importing) return;
    if (!csvFile) {
      setImportError("Please choose a CSV file.");
      return;
    }

    try {
      const startedAt = Date.now();
      setImporting(true);
      const fd = new FormData();
      fd.append("csv", csvFile);
      const res = await postFormData<CsvImportResponse>(
        "/import_users_csv.php",
        fd,
      );
      await syncEntitiesFromDatabase();
      await syncYearEndHistory();
      const elapsed = Date.now() - startedAt;
      if (elapsed < PROCESSING_MIN_MS) {
        await wait(PROCESSING_MIN_MS - elapsed);
      }
      setImportResult(res);
      setSuccessNotice({
        title: "Import Successful",
        message:
          res.message || `Import successful. Inserted ${res.inserted} user(s).`,
      });
    } catch (e: any) {
      setImportError(e?.message || "Failed to import CSV.");
    } finally {
      setImporting(false);
    }
  };

  // ===== DELETE CONFIRM MODAL =====
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);

  const openDeleteConfirm = (u: User) => {
    setDeleteTarget(u);
    setIsDeleteOpen(true);
  };
  const closeDeleteConfirm = () => {
    setIsDeleteOpen(false);
    setDeleteTarget(null);
  };
  const confirmDelete = () => {
    if (!deleteTarget) return;
    setUsers((prev) => prev.filter((u) => u.id !== deleteTarget.id));
    closeDeleteConfirm();
  };

  // ===== FILTERS + SEARCH =====
  const [roleFilter, setRoleFilter] = useState<
    "ALL" | "STUDENT" | "TEACHER" | "STAFF" | "NON_TEACHING"
  >("ALL");
  const [searchText, setSearchText] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [userFilterCollegeId, setUserFilterCollegeId] = useState<number>(0);
  const [userFilterCourseId, setUserFilterCourseId] = useState<number>(0);
  const [userFilterYearLevelId, setUserFilterYearLevelId] = useState<number>(0);
  const [userFilterSection, setUserFilterSection] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [isYearEndOpen, setIsYearEndOpen] = useState(false);
  const [isYearEndResultsOpen, setIsYearEndResultsOpen] = useState(false);
  const [yearEndSelectedIds, setYearEndSelectedIds] = useState<number[]>([]);
  const [yearEndError, setYearEndError] = useState("");
  const [yearEndProcessing, setYearEndProcessing] = useState<
    "promote" | "archive" | null
  >(null);
  const [yearEndSearchText, setYearEndSearchText] = useState("");
  const [showYearEndFilters, setShowYearEndFilters] = useState(false);
  const [yearEndCollegeFilterId, setYearEndCollegeFilterId] = useState(0);
  const [yearEndCourseFilterId, setYearEndCourseFilterId] = useState(0);
  const [yearEndYearLevelFilterId, setYearEndYearLevelFilterId] = useState(0);
  const [yearEndSectionFilter, setYearEndSectionFilter] = useState("");

  const userFilteredCourses = useMemo(
    () =>
      userFilterCollegeId
        ? courses.filter((c) => c.collegeId === userFilterCollegeId)
        : courses,
    [courses, userFilterCollegeId],
  );

  useEffect(() => {
    if (userFilterCourseId && !userFilteredCourses.some((c) => c.id === userFilterCourseId)) {
      setUserFilterCourseId(0);
    }
  }, [userFilterCourseId, userFilteredCourses]);

  const userFilteredYearLevels = useMemo(
    () =>
      yearLevels.filter(
        (yl) =>
          yl.academicYearId === activeYearId &&
          (userFilterCollegeId ? yl.collegeId === userFilterCollegeId : true),
      ),
    [yearLevels, activeYearId, userFilterCollegeId],
  );

  useEffect(() => {
    if (
      userFilterYearLevelId &&
      !userFilteredYearLevels.some((yl) => yl.id === userFilterYearLevelId)
    ) {
      setUserFilterYearLevelId(0);
    }
  }, [userFilterYearLevelId, userFilteredYearLevels]);

  const sectionOptions = useMemo(() => {
    const rows = users.filter((u) => {
      if (u.role !== "STUDENT") return false;
      if (isUserArchived(u)) return false;
      return (
        (userFilterCollegeId ? u.collegeId === userFilterCollegeId : true) &&
        (userFilterCourseId ? u.courseId === userFilterCourseId : true) &&
        (userFilterYearLevelId ? u.yearLevelId === userFilterYearLevelId : true)
      );
    });
    return Array.from(
      new Set(
        rows
          .map((u) => String(u.section || "").trim())
          .filter((value) => value.length > 0),
      ),
    ).sort((a, b) => a.localeCompare(b));
  }, [users, userFilterCollegeId, userFilterCourseId, userFilterYearLevelId]);

  useEffect(() => {
    if (userFilterSection && !sectionOptions.includes(userFilterSection)) {
      setUserFilterSection("");
    }
  }, [userFilterSection, sectionOptions]);

  const visibleUsers = useMemo(() => {
    const q = searchText.trim().toLowerCase();

    return users.filter((u) => {
      if (isUserArchived(u)) return false;

      // Search (name/email/username)
      if (q) {
        const name = `${u.fname} ${u.mname ?? ""} ${u.lname}`.toLowerCase();
        const em = u.email.toLowerCase();
        const un = String(u.username || "").toLowerCase();
        if (!matchesSearchPrefix(q, name, em, un))
          return false;
      }

      if (roleFilter === "STUDENT" && u.role !== "STUDENT") return false;
      if (roleFilter === "TEACHER" && u.role !== "TEACHER") {
        return false;
      }
      if (roleFilter === "STAFF" && u.role !== "STAFF") return false;
      if (roleFilter === "NON_TEACHING" && u.role !== "NON_TEACHING_PERSONNEL") {
        return false;
      }

      if (
        userFilterCollegeId ||
        userFilterCourseId ||
        userFilterYearLevelId ||
        userFilterSection.trim() !== ""
      ) {
        if (u.role !== "STUDENT") return false;
        if (userFilterCollegeId && u.collegeId !== userFilterCollegeId) return false;
        if (userFilterCourseId && u.courseId !== userFilterCourseId) return false;
        if (userFilterYearLevelId && u.yearLevelId !== userFilterYearLevelId) return false;
        if (
          userFilterSection.trim() !== "" &&
          String(u.section || "").trim().toLowerCase() !== userFilterSection.trim().toLowerCase()
        ) {
          return false;
        }
      }

      return true;
    });
  }, [
    users,
    roleFilter,
    searchText,
    userFilterCollegeId,
    userFilterCourseId,
    userFilterYearLevelId,
    userFilterSection,
  ]);

  const totalPages = Math.max(
    1,
    Math.ceil(visibleUsers.length / USERS_PAGE_SIZE),
  );
  const pagedUsers = useMemo(() => {
    const start = (currentPage - 1) * USERS_PAGE_SIZE;
    return visibleUsers.slice(start, start + USERS_PAGE_SIZE);
  }, [visibleUsers, currentPage]);
  const paginationNumbers = useMemo(() => {
    const start = Math.max(1, currentPage - 2);
    const end = Math.min(totalPages, start + 4);
    const adjustedStart = Math.max(1, end - 4);
    return Array.from(
      { length: end - adjustedStart + 1 },
      (_, index) => adjustedStart + index,
    );
  }, [currentPage, totalPages]);

  useEffect(() => {
    setCurrentPage(1);
  }, [
    searchText,
    roleFilter,
    userFilterCollegeId,
    userFilterCourseId,
    userFilterYearLevelId,
    userFilterSection,
  ]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const getCollegeName = (id?: number) =>
    colleges.find((c) => c.id === id)?.name ?? "-";
  const getCourseName = (courseId?: number, courseName?: string) =>
    String(courseName || "").trim() ||
    courses.find((c) => c.id === courseId)?.name ||
    "-";
  const getYearLevelName = (id?: number) =>
    yearLevels.find((y) => y.id === id)?.name ?? "-";
  const yearEndRows = useMemo(() => {
    return visibleUsers
      .filter((u) => u.role === "STUDENT")
      .map((u) => {
        const currentYearLevel = yearLevels.find((yl) => yl.id === u.yearLevelId);
        const currentRank = extractYearLevelRank(currentYearLevel?.name);
        const nextYearLevel =
          currentRank > 0
            ? yearLevels.find(
                (yl) =>
                  yl.collegeId === u.collegeId &&
                  yl.academicYearId === activeYearId &&
                  extractYearLevelRank(yl.name) === currentRank + 1,
              )
            : undefined;

        const actionType =
          nextYearLevel
            ? "promote"
            : currentRank > 0 && currentYearLevel
              ? "archive"
              : "review";

        return {
          user: u,
          collegeLabel: colleges.find((c) => c.id === u.collegeId)?.name ?? "-",
          courseLabel:
            String(u.courseName || "").trim() ||
            courses.find((c) => c.id === u.courseId)?.name ||
            "-",
          currentYearLabel: currentYearLevel?.name ?? "-",
          currentYearLevelId: currentYearLevel?.id ?? 0,
          sectionLabel: String(u.section || "").trim(),
          nextYearLevelId: nextYearLevel?.id ?? 0,
          targetLabel:
            actionType === "promote"
              ? nextYearLevel?.name ?? "-"
              : actionType === "archive"
                ? "Archive as Graduated"
                : "Review manually",
          actionType,
        };
      });
  }, [visibleUsers, yearLevels, activeYearId, colleges, courses]);
  const yearEndCollegeOptions = useMemo(
    () =>
      colleges
        .filter((college) => yearEndRows.some((row) => row.user.collegeId === college.id))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [colleges, yearEndRows],
  );
  const yearEndCourseOptions = useMemo(() => {
    const courseIds = new Set(
      yearEndRows
        .filter((row) =>
          yearEndCollegeFilterId ? row.user.collegeId === yearEndCollegeFilterId : true,
        )
        .map((row) => row.user.courseId)
        .filter((id): id is number => Number(id) > 0),
    );

    return courses
      .filter((course) => courseIds.has(course.id))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [courses, yearEndRows, yearEndCollegeFilterId]);
  const yearEndYearLevelOptions = useMemo(() => {
    const yearLevelIds = new Set(
      yearEndRows
        .filter((row) => {
          if (yearEndCollegeFilterId && row.user.collegeId !== yearEndCollegeFilterId) {
            return false;
          }
          if (yearEndCourseFilterId && row.user.courseId !== yearEndCourseFilterId) {
            return false;
          }
          return true;
        })
        .map((row) => row.currentYearLevelId)
        .filter((id): id is number => Number(id) > 0),
    );

    return yearLevels
      .filter((yearLevel) => yearLevelIds.has(yearLevel.id))
      .sort(
        (a, b) => extractYearLevelRank(a.name) - extractYearLevelRank(b.name),
      );
  }, [
    yearLevels,
    yearEndRows,
    yearEndCollegeFilterId,
    yearEndCourseFilterId,
  ]);
  const yearEndSectionOptions = useMemo(() => {
    return Array.from(
      new Set(
        yearEndRows
          .filter((row) => {
            if (yearEndCollegeFilterId && row.user.collegeId !== yearEndCollegeFilterId) {
              return false;
            }
            if (yearEndCourseFilterId && row.user.courseId !== yearEndCourseFilterId) {
              return false;
            }
            if (
              yearEndYearLevelFilterId &&
              row.currentYearLevelId !== yearEndYearLevelFilterId
            ) {
              return false;
            }
            return true;
          })
          .map((row) => row.sectionLabel)
          .filter((label) => label.length > 0),
      ),
    ).sort((a, b) => a.localeCompare(b));
  }, [
    yearEndRows,
    yearEndCollegeFilterId,
    yearEndCourseFilterId,
    yearEndYearLevelFilterId,
  ]);

  useEffect(() => {
    if (
      yearEndCourseFilterId &&
      !yearEndCourseOptions.some((course) => course.id === yearEndCourseFilterId)
    ) {
      setYearEndCourseFilterId(0);
    }
  }, [yearEndCourseFilterId, yearEndCourseOptions]);

  useEffect(() => {
    if (
      yearEndYearLevelFilterId &&
      !yearEndYearLevelOptions.some((yearLevel) => yearLevel.id === yearEndYearLevelFilterId)
    ) {
      setYearEndYearLevelFilterId(0);
    }
  }, [yearEndYearLevelFilterId, yearEndYearLevelOptions]);

  useEffect(() => {
    if (yearEndSectionFilter && !yearEndSectionOptions.includes(yearEndSectionFilter)) {
      setYearEndSectionFilter("");
    }
  }, [yearEndSectionFilter, yearEndSectionOptions]);

  const yearEndFilteredRows = useMemo(() => {
    const needle = yearEndSearchText.trim().toLowerCase();

    return yearEndRows.filter((row) => {
      const matchesSearch =
        needle === "" ||
        matchesSearchPrefix(
          needle,
          `${row.user.fname} ${row.user.mname ?? ""} ${row.user.lname}`,
          row.collegeLabel,
          row.courseLabel,
          row.currentYearLabel,
          row.sectionLabel,
          row.targetLabel,
        );

      const matchesCollege =
        yearEndCollegeFilterId === 0 || row.user.collegeId === yearEndCollegeFilterId;
      const matchesCourse =
        yearEndCourseFilterId === 0 || row.user.courseId === yearEndCourseFilterId;
      const matchesYearLevel =
        yearEndYearLevelFilterId === 0 ||
        row.currentYearLevelId === yearEndYearLevelFilterId;
      const matchesSection =
        yearEndSectionFilter.trim() === "" ||
        row.sectionLabel.toLowerCase() === yearEndSectionFilter.trim().toLowerCase();

      return (
        matchesSearch &&
        matchesCollege &&
        matchesCourse &&
        matchesYearLevel &&
        matchesSection
      );
    });
  }, [
    yearEndRows,
    yearEndSearchText,
    yearEndCollegeFilterId,
    yearEndCourseFilterId,
    yearEndYearLevelFilterId,
    yearEndSectionFilter,
  ]);
  const yearEndSelectableIds = useMemo(
    () =>
      yearEndFilteredRows
        .filter((row) => row.actionType === "promote" || row.actionType === "archive")
        .map((row) => row.user.id),
    [yearEndFilteredRows],
  );
  const allYearEndSelected =
    yearEndSelectableIds.length > 0 &&
    yearEndSelectableIds.every((id) => yearEndSelectedIds.includes(id));
  const yearEndSelectedCount = yearEndSelectedIds.length;

  useEffect(() => {
    setYearEndSelectedIds((prev) =>
      prev.filter((id) => yearEndFilteredRows.some((row) => row.user.id === id)),
    );
  }, [yearEndFilteredRows]);

  const closeYearEndModal = () => {
    if (yearEndProcessing) return;
    setIsYearEndOpen(false);
    setYearEndError("");
    setYearEndSelectedIds([]);
    setYearEndSearchText("");
    setShowYearEndFilters(false);
    setYearEndCollegeFilterId(0);
    setYearEndCourseFilterId(0);
    setYearEndYearLevelFilterId(0);
    setYearEndSectionFilter("");
  };
  const openYearEndResultsModal = () => {
    setYearEndHistoryError("");
    setIsYearEndResultsOpen(true);
  };
  const closeYearEndResultsModal = () => {
    setIsYearEndResultsOpen(false);
  };
  const toggleYearEndStudent = (userId: number) => {
    setYearEndSelectedIds((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId],
    );
  };
  const handlePromoteStudents = async () => {
    const selectedRows = yearEndRows.filter(
      (row) =>
        yearEndSelectedIds.includes(row.user.id) && row.actionType === "promote",
    );
    if (selectedRows.length === 0) {
      setYearEndError("Select at least one eligible student to promote.");
      return;
    }

    try {
      const startedAt = Date.now();
      setYearEndError("");
      setYearEndProcessing("promote");
      const res = await postJSON<{ ok: boolean; promoted?: number; message?: string }>(
        "/user_year_end_api.php",
        {
          action: "promote_students",
          items: selectedRows.map((row) => ({
            id: row.user.id,
            yearLevelId: row.nextYearLevelId,
          })),
        },
      );
      await syncEntitiesFromDatabase();
      await syncYearEndHistory();
      const elapsed = Date.now() - startedAt;
      if (elapsed < PROCESSING_MIN_MS) {
        await wait(PROCESSING_MIN_MS - elapsed);
      }
      setIsYearEndOpen(false);
      setYearEndError("");
      setYearEndSelectedIds([]);
      setYearEndSearchText("");
      setShowYearEndFilters(false);
      setYearEndCollegeFilterId(0);
      setYearEndCourseFilterId(0);
      setYearEndYearLevelFilterId(0);
      setYearEndSectionFilter("");
      setSuccessNotice({
        title: "Students Promoted",
        message:
          res.message ||
          `${selectedRows.length} student(s) moved to the next year level.`,
      });
    } catch (e: any) {
      setYearEndError(e?.message || "Failed to promote selected students.");
    } finally {
      setYearEndProcessing(null);
    }
  };
  const handleArchiveGraduates = async () => {
    const selectedRows = yearEndRows.filter(
      (row) =>
        yearEndSelectedIds.includes(row.user.id) && row.actionType === "archive",
    );
    if (selectedRows.length === 0) {
      setYearEndError("Select at least one graduating student to archive.");
      return;
    }

    try {
      const startedAt = Date.now();
      setYearEndError("");
      setYearEndProcessing("archive");
      const res = await postJSON<{ ok: boolean; archived?: number; message?: string }>(
        "/user_year_end_api.php",
        {
          action: "archive_students",
          userIds: selectedRows.map((row) => row.user.id),
        },
      );
      await syncEntitiesFromDatabase();
      const elapsed = Date.now() - startedAt;
      if (elapsed < PROCESSING_MIN_MS) {
        await wait(PROCESSING_MIN_MS - elapsed);
      }
      setIsYearEndOpen(false);
      setYearEndError("");
      setYearEndSelectedIds([]);
      setYearEndSearchText("");
      setShowYearEndFilters(false);
      setYearEndCollegeFilterId(0);
      setYearEndCourseFilterId(0);
      setYearEndYearLevelFilterId(0);
      setYearEndSectionFilter("");
      setSuccessNotice({
        title: "Graduates Archived",
        message:
          res.message ||
          `${selectedRows.length} graduated student(s) archived successfully.`,
      });
    } catch (e: any) {
      setYearEndError(e?.message || "Failed to archive selected graduates.");
    } finally {
      setYearEndProcessing(null);
    }
  };

  // ===== EDIT MODAL =====
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [efname, setEFname] = useState("");
  const [emname, setEMname] = useState("");
  const [elname, setELname] = useState("");
  const [eemail, setEEmail] = useState("");
  const [erole, setERole] = useState<Role>("STUDENT");
  const [savingEdit, setSavingEdit] = useState(false);
  const [esection, setESection] = useState("");

  const [ecollegeId, setECollegeId] = useState<number>(colleges[0]?.id ?? 0);
  const [ecourseId, setECourseId] = useState<number>(0);
  const [eyearLevelId, setEYearLevelId] = useState<number>(0);

  const editFilteredYearLevels = useMemo(() => {
    return yearLevels.filter(
      (yl) => yl.collegeId === ecollegeId && yl.academicYearId === activeYearId,
    );
  }, [yearLevels, ecollegeId, activeYearId]);
  const editFilteredCourses = useMemo(() => {
    return courses.filter((c) => c.collegeId === ecollegeId);
  }, [courses, ecollegeId]);

  useEffect(() => {
    if (erole !== "STUDENT") return;
    const ok = editFilteredYearLevels.some((yl) => yl.id === eyearLevelId);
    if (!ok) setEYearLevelId(editFilteredYearLevels[0]?.id ?? 0);
  }, [editFilteredYearLevels, eyearLevelId, erole]);

  useEffect(() => {
    if (erole !== "STUDENT") return;
    const ok = editFilteredCourses.some((c) => c.id === ecourseId);
    if (!ok) setECourseId(editFilteredCourses[0]?.id ?? 0);
  }, [editFilteredCourses, ecourseId, erole]);

  const openEdit = (u: User) => {
    setEditingId(u.id);
    setEFname(u.fname);
    setEMname(u.mname ?? "");
    setELname(u.lname);
    setEEmail(u.email);
    setERole(u.role);

    if (u.role === "STUDENT") {
      setECollegeId(u.collegeId ?? colleges[0]?.id ?? 0);
      setECourseId(u.courseId ?? 0);
      setEYearLevelId(u.yearLevelId ?? 0);
      setESection(u.section ?? "");
    } else {
      setECollegeId(colleges[0]?.id ?? 0);
      setECourseId(0);
      setEYearLevelId(0);
      setESection("");
    }

    setIsEditOpen(true);
  };

  const closeEdit = () => {
    setIsEditOpen(false);
    setEditingId(null);
  };

  const handleSaveEdit = async () => {
    if (editingId == null) return;
    if (savingEdit) return;

    const f = normalizeSentenceCaseName(efname);
    const m = normalizeSentenceCaseName(emname);
    const l = normalizeSentenceCaseName(elname);
    const e = normalizeBisuEmail(eemail);

    if (!f || !l || !e) return;

    const exists = users.some(
      (u) => u.id !== editingId && u.email.trim().toLowerCase() === e,
    );
    if (exists) {
      alert("This email already exists. Please use a different email.");
      return;
    }

    if (erole === "STUDENT" && (!ecollegeId || !eyearLevelId)) {
      alert("Please select College and Year Level for Student.");
      return;
    }

    try {
      setSavingEdit(true);
      await postJSON<{ ok: boolean; message?: string }>("/update_user.php", {
        id: editingId,
        fname: f,
        mname: m || "",
        lname: l,
        email: e,
        role: erole,
        collegeId: erole === "STUDENT" ? ecollegeId : null,
        courseId: erole === "STUDENT" && ecourseId > 0 ? ecourseId : null,
        yearLevelId: erole === "STUDENT" ? eyearLevelId : null,
        section: erole === "STUDENT" ? esection.trim() : null,
      });
      await syncEntitiesFromDatabase();
      closeEdit();
    } catch (err: any) {
      alert(err?.message || "Failed to update user.");
    } finally {
      setSavingEdit(false);
    }
  };

  const activeYearEndHistory =
    yearEndHistoryTab === "PROMOTED" ? promotedHistory : archivedHistory;

  return (
    <div className="users-page" style={{ display: "grid", gap: 16 }}>
      <style>{`
        .users-page button:not(:disabled) {
          transition:
            background-color 140ms ease,
            color 140ms ease,
            border-color 140ms ease,
            transform 140ms ease,
            box-shadow 140ms ease,
            opacity 140ms ease;
        }

        .users-page button:not(:disabled):hover {
          transform: translateY(-1px);
          box-shadow: 0 12px 24px rgba(15, 23, 42, 0.12);
        }

        .users-page button:not(:disabled):active {
          transform: translateY(0);
          box-shadow: none;
        }
      `}</style>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
        }}
      >
        <h2 style={{ margin: 0, fontWeight: 800 }}>User Management</h2>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            type="button"
            style={headerIconActionButton(isYearEndResultsTriggerPressed)}
            onClick={openYearEndResultsModal}
            title="Year-End Results"
            aria-label="Year-End Results"
            onPointerDown={() => setIsYearEndResultsTriggerPressed(true)}
            onPointerUp={() => setIsYearEndResultsTriggerPressed(false)}
            onPointerLeave={() => setIsYearEndResultsTriggerPressed(false)}
            onPointerCancel={() => setIsYearEndResultsTriggerPressed(false)}
            onBlur={() => setIsYearEndResultsTriggerPressed(false)}
          >
            <Archive size={18} />
          </button>
          <button
            type="button"
            style={headerIconActionButton(isAddTriggerPressed)}
            onClick={openAddModal}
            title="Add User"
            aria-label="Add User"
            onPointerDown={() => setIsAddTriggerPressed(true)}
            onPointerUp={() => setIsAddTriggerPressed(false)}
            onPointerLeave={() => setIsAddTriggerPressed(false)}
            onPointerCancel={() => setIsAddTriggerPressed(false)}
            onBlur={() => setIsAddTriggerPressed(false)}
          >
            <Plus size={18} />
          </button>
          <button
            type="button"
            style={headerIconActionButton(isImportTriggerPressed)}
            onClick={openImportModal}
            title="Import CSV"
            aria-label="Import CSV"
            onPointerDown={() => setIsImportTriggerPressed(true)}
            onPointerUp={() => setIsImportTriggerPressed(false)}
            onPointerLeave={() => setIsImportTriggerPressed(false)}
            onPointerCancel={() => setIsImportTriggerPressed(false)}
            onBlur={() => setIsImportTriggerPressed(false)}
          >
            <FileUp size={18} />
          </button>
        </div>
      </div>

      {/* ===== USER LIST CARD ===== */}

      <div style={card}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            marginBottom: 10,
          }}
        >
          <h3 style={{ margin: 0 }}>User List</h3>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={searchWrap}>
              <Search size={16} style={{ opacity: 0.7 }} />
              <input
                type="search"
                name="users-search"
                autoComplete="off"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Search name, email, username..."
                style={searchInput}
              />
            </div>
            <div style={{ position: "relative" }}>
              <button
                type="button"
                onClick={() => setShowFilters((prev) => !prev)}
                style={{
                  ...headerFilterButton,
                  background: showFilters ? "#5F6D7A" : "white",
                  color: showFilters ? "white" : "#000000",
                  border: showFilters ? "1px solid #5F6D7A" : "1px solid #111111",
                }}
                title={showFilters ? "Hide filters" : "Show filters"}
                aria-label={showFilters ? "Hide filters" : "Show filters"}
              >
                <List size={20} />
              </button>

              {showFilters && (
                <div style={compactFilterPanel}>
                  <div style={compactField}>
                    <div style={compactLabel}>College</div>
                    <select
                      value={userFilterCollegeId}
                      onChange={(e) => setUserFilterCollegeId(Number(e.target.value))}
                      style={compactSelect}
                    >
                      <option value={0}>All colleges</option>
                      {colleges.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div style={compactField}>
                    <div style={compactLabel}>Course</div>
                    <select
                      value={userFilterCourseId}
                      onChange={(e) => setUserFilterCourseId(Number(e.target.value))}
                      style={compactSelect}
                    >
                      <option value={0}>
                        {userFilteredCourses.length ? "All courses" : "No courses found"}
                      </option>
                      {userFilteredCourses.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div style={compactField}>
                    <div style={compactLabel}>Year Level</div>
                    <select
                      value={userFilterYearLevelId}
                      onChange={(e) => setUserFilterYearLevelId(Number(e.target.value))}
                      style={compactSelect}
                    >
                      <option value={0}>All year levels</option>
                      {userFilteredYearLevels.map((yl) => (
                        <option key={yl.id} value={yl.id}>
                          {yl.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div style={compactField}>
                    <div style={compactLabel}>Section</div>
                    <select
                      value={userFilterSection}
                      onChange={(e) => setUserFilterSection(e.target.value)}
                      style={compactSelect}
                    >
                      <option value="">All sections</option>
                      {sectionOptions.map((sectionName) => (
                        <option key={sectionName} value={sectionName}>
                          {sectionName}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 2 }}>
                    <button
                      type="button"
                      onClick={() => {
                        setUserFilterCollegeId(0);
                        setUserFilterCourseId(0);
                        setUserFilterYearLevelId(0);
                        setUserFilterSection("");
                        setShowFilters(false);
                      }}
                      style={compactClearButton}
                    >
                      <X size={14} />
                      Clear
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: 10,
            alignItems: "center",
            marginBottom: 12,
            flexWrap: "wrap",
          }}
        >
          <button
            style={filterChip(roleFilter === "ALL")}
            onClick={() => setRoleFilter("ALL")}
          >
            All
          </button>
          <button
            style={filterChip(roleFilter === "STUDENT")}
            onClick={() => setRoleFilter("STUDENT")}
          >
            Student
          </button>
          <button
            style={filterChip(roleFilter === "TEACHER")}
            onClick={() => setRoleFilter("TEACHER")}
          >
            Teacher
          </button>
          <button
            style={filterChip(roleFilter === "STAFF")}
            onClick={() => setRoleFilter("STAFF")}
          >
            Staff
          </button>
          <button
            style={filterChip(roleFilter === "NON_TEACHING")}
            onClick={() => setRoleFilter("NON_TEACHING")}
          >
            Non-Teaching Personnel
          </button>
        </div>

        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left" }}>
              <th style={th}>Name</th>
              <th style={th}>Email</th>
              <th style={th}>Role</th>
              <th style={th}>Registered</th>
              <th style={th}>Username</th>
              <th style={th}>College</th>
              <th style={th}>Courses</th>
              <th style={th}>Year Level</th>
              <th style={th}>Section</th>
              <th style={th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {pagedUsers.map((u) => (
              <tr key={u.id} style={{ borderTop: "1px solid var(--border)" }}>
                <td style={td}>
                  {u.fname} {u.mname ? u.mname + " " : ""}
                  {u.lname}
                </td>
                <td style={td}>{u.email}</td>
                <td style={td}>{roleLabel(u.role)}</td>
                <td style={td}>
                  {u.registered ? (
                    <span title="Registered" style={{ display: "inline-flex" }}>
                      <CheckCircle2 size={18} color="#16A34A" />
                    </span>
                  ) : (
                    <span title="Not Registered" style={{ display: "inline-flex" }}>
                      <XCircle size={18} color="#DC2626" />
                    </span>
                  )}
                </td>
                <td style={td}>
                  {u.username || usernameFromEmail(u.email)}
                </td>
                <td style={td}>
                  {u.role === "STUDENT" ? getCollegeName(u.collegeId) : "-"}
                </td>
                <td style={td}>
                  {u.role === "STUDENT" ? getCourseName(u.courseId, u.courseName) : "-"}
                </td>
                <td style={td}>
                  {u.role === "STUDENT" ? getYearLevelName(u.yearLevelId) : "-"}
                </td>
                <td style={td}>
                  {u.role === "STUDENT" ? (u.section?.trim() || "-") : "-"}
                </td>
                <td style={td}>
                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      justifyContent: "flex-end",
                    }}
                  >
                    <button
                      onClick={() => openEdit(u)}
                      style={iconButton}
                      title="Edit"
                    >
                      <Pencil size={18} />
                    </button>
                    <button
                      onClick={() => openDeleteConfirm(u)}
                      style={dangerIconButton}
                      title="Delete"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {visibleUsers.length === 0 && (
              <tr style={{ borderTop: "1px solid var(--border)" }}>
                <td style={{ ...td, paddingTop: 14, paddingBottom: 14 }} colSpan={10}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 10,
                      flexWrap: "wrap",
                    }}
                  >
                    <span style={{ opacity: 0.8 }}>
                      No users match your current search/filter.
                    </span>
                    {(searchText.trim() !== "" ||
                      roleFilter !== "ALL" ||
                      userFilterCollegeId !== 0 ||
                      userFilterCourseId !== 0 ||
                      userFilterYearLevelId !== 0 ||
                      userFilterSection.trim() !== "") && (
                      <button
                        type="button"
                        style={ghostButton}
                        onClick={() => {
                          setSearchText("");
                          setRoleFilter("ALL");
                          setUserFilterCollegeId(0);
                          setUserFilterCourseId(0);
                          setUserFilterYearLevelId(0);
                          setUserFilterSection("");
                          setShowFilters(false);
                        }}
                      >
                        Clear Filters
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {visibleUsers.length > 0 && (
          <div
            style={{
              marginTop: 14,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <div style={{ fontSize: 13, color: "#64748b", fontWeight: 700 }}>
              Showing {(currentPage - 1) * USERS_PAGE_SIZE + 1}-
              {Math.min(currentPage * USERS_PAGE_SIZE, visibleUsers.length)} of{" "}
              {visibleUsers.length} user{visibleUsers.length === 1 ? "" : "s"}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                disabled={currentPage === 1}
                style={{
                  ...paginationButton,
                  opacity: currentPage === 1 ? 0.55 : 1,
                  cursor: currentPage === 1 ? "not-allowed" : "pointer",
                }}
              >
                Prev
              </button>

              {paginationNumbers.map((pageNumber) => (
                <button
                  key={pageNumber}
                  type="button"
                  onClick={() => setCurrentPage(pageNumber)}
                  style={{
                    ...paginationButton,
                    minWidth: 40,
                    background: pageNumber === currentPage ? "var(--primary)" : "white",
                    color: pageNumber === currentPage ? "white" : "#0f172a",
                    border:
                      pageNumber === currentPage
                        ? "1px solid var(--primary)"
                        : "1px solid var(--border)",
                  }}
                >
                  {pageNumber}
                </button>
              ))}

              <button
                type="button"
                onClick={() =>
                  setCurrentPage((page) => Math.min(totalPages, page + 1))
                }
                disabled={currentPage === totalPages}
                style={{
                  ...paginationButton,
                  opacity: currentPage === totalPages ? 0.55 : 1,
                  cursor: currentPage === totalPages ? "not-allowed" : "pointer",
                }}
              >
                Next
              </button>
            </div>
          </div>
        )}

        <div style={{ marginTop: 10, opacity: 0.8, fontSize: 13 }}>
          Student users are linked to College + Course + Year Level (based on
          your setup flow).
        </div>
      </div>

      {/* ===== ADD USER MODAL ===== */}
      {isAddOpen && (
        <div style={modalOverlay} onClick={closeAddModal}>
          <div style={modalWideCard} onClick={(e) => e.stopPropagation()}>
            <div style={modalHeader}>
              <h3 style={{ margin: 0 }}>Add User</h3>
              <button onClick={closeAddModal} style={iconButton} title="Close">
                <X size={18} />
              </button>
            </div>

            <div style={modalGridThree}>
              <div>
                <label style={labelStyle}>First Name</label>
                <input
                  placeholder="First name"
                  value={fname}
                  onChange={(e) =>
                    setFname(toSentenceCaseNameInput(e.target.value))
                  }
                  onBlur={() => setFname((v) => normalizeSentenceCaseName(v))}
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Middle Name (optional)</label>
                <input
                  placeholder="Middle name"
                  value={mname}
                  onChange={(e) =>
                    setMname(toSentenceCaseNameInput(e.target.value))
                  }
                  onBlur={() => setMname((v) => normalizeSentenceCaseName(v))}
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Last Name</label>
                <input
                  placeholder="Last name"
                  value={lname}
                  onChange={(e) =>
                    setLname(toSentenceCaseNameInput(e.target.value))
                  }
                  onBlur={() => setLname((v) => normalizeSentenceCaseName(v))}
                  style={inputStyle}
                />
              </div>
            </div>

            <div style={{ ...modalGrid, marginTop: 10 }}>
              <div>
                <label style={labelStyle}>Email</label>
                <input
                  type="email"
                  name="new-user-email"
                  autoComplete="off"
                  placeholder="Email (local part or full)"
                  value={email}
                  onChange={(e) => setEmail(normalizeEmailInput(e.target.value))}
                  onBlur={() => setEmail((v) => normalizeBisuEmail(v))}
                  onKeyDown={(e) => {
                    if (e.key === "Tab") {
                      setEmail((v) => normalizeBisuEmail(v));
                    }
                  }}
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Role</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as Role)}
                  style={inputStyle}
                >
                  <option value="STUDENT">Student</option>
                  <option value="TEACHER">Teacher</option>
                  <option value="STAFF">Staff</option>
                  <option value="NON_TEACHING_PERSONNEL">
                    Non Teaching Personnel
                  </option>
                </select>
              </div>
            </div>

            {role === "STUDENT" && (
              <div style={{ ...modalGrid, marginTop: 10 }}>
                <div>
                  <label style={labelStyle}>College</label>
                  <select
                    value={collegeId}
                    onChange={(e) => setCollegeId(Number(e.target.value))}
                    style={inputStyle}
                  >
                    {colleges.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={labelStyle}>Course</label>
                  <select
                    value={courseId}
                    onChange={(e) => setCourseId(Number(e.target.value))}
                    style={inputStyle}
                  >
                    <option value={0}>
                      {addFilteredCourses.length ? "Select course" : "No courses found"}
                    </option>
                    {addFilteredCourses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={labelStyle}>Year Level</label>
                  <select
                    value={yearLevelId}
                    onChange={(e) => setYearLevelId(Number(e.target.value))}
                    style={inputStyle}
                  >
                    {addFilteredYearLevels.map((yl) => (
                      <option key={yl.id} value={yl.id}>
                        {yl.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={labelStyle}>Section (optional)</label>
                  <select
                    value={section}
                    onChange={(e) => setSection(e.target.value)}
                    style={inputStyle}
                  >
                    <option value="">None</option>
                    <option value="A">A</option>
                    <option value="B">B</option>
                  </select>
                </div>
              </div>
            )}

            {addError && <div style={errorBox}>{addError}</div>}
            {addSuccess && <div style={okBox}>{addSuccess}</div>}

            <div style={modalFooter}>
              <button onClick={closeAddModal} style={ghostButton} disabled={adding}>
                Cancel
              </button>
              <button
                onClick={handleAddUser}
                style={addUserButtonStyle(isAddSubmitPressed, adding)}
                disabled={adding}
                onPointerDown={() => setIsAddSubmitPressed(true)}
                onPointerUp={() => setIsAddSubmitPressed(false)}
                onPointerLeave={() => setIsAddSubmitPressed(false)}
                onPointerCancel={() => setIsAddSubmitPressed(false)}
                onBlur={() => setIsAddSubmitPressed(false)}
              >
                <span style={buttonContent}>
                  {adding && <LoadingSpinner size={14} />}
                  <span>{adding ? "Adding..." : "Add User"}</span>
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== IMPORT CSV MODAL ===== */}
      {isImportOpen && (
        <div style={modalOverlay} onClick={closeImportModal}>
          <div style={modalWideCard} onClick={(e) => e.stopPropagation()}>
            <div style={modalHeader}>
              <h3 style={{ margin: 0 }}>Import CSV</h3>
              <button onClick={closeImportModal} style={iconButton} title="Close">
                <X size={18} />
              </button>
            </div>

            <p style={{ marginTop: 0, opacity: 0.85, fontSize: 13 }}>
              Upload a CSV file to bulk insert users directly into the database.
            </p>

            <div style={{ display: "grid", gap: 8 }}>
              <input
                ref={csvFileInputRef}
                type="file"
                accept=".csv,text/csv"
                style={{ display: "none" }}
                onChange={(e) => setCsvFile(e.target.files?.[0] ?? null)}
              />
              <button
                type="button"
                style={ghostButton}
                onClick={() => csvFileInputRef.current?.click()}
              >
                Choose CSV File
              </button>
            </div>

            {importError && <div style={errorBox}>{importError}</div>}
            {importResult && (
              <div style={okBox}>
                <div>{importResult.message || "Import completed."}</div>
                <div style={{ marginTop: 6 }}>
                  Inserted: <b>{importResult.inserted}</b> | Skipped:{" "}
                  <b>{importResult.skipped}</b>
                </div>
                {(importResult.errors?.length ?? 0) > 0 && (
                  <ul style={{ margin: "8px 0 0 18px", padding: 0 }}>
                    {(importResult.errors ?? []).slice(0, 10).map((line, idx) => (
                      <li key={`${line}-${idx}`}>{line}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                CSV Template
              </div>
              <pre style={csvPre}>{CSV_SAMPLE}</pre>
            </div>

            <div style={modalFooter}>
              <button onClick={closeImportModal} style={ghostButton}>
                Cancel
              </button>
              <button
                onClick={handleImportCsv}
                style={primaryButton}
                disabled={importing}
              >
                <span style={buttonContent}>
                  {importing && <LoadingSpinner size={14} />}
                  <span>{importing ? "Importing..." : "Import CSV"}</span>
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {isYearEndOpen && (
        <div style={modalOverlay} onClick={closeYearEndModal}>
          <div style={yearEndModalCard} onClick={(e) => e.stopPropagation()}>
            <div style={modalHeader}>
              <div style={{ display: "grid", gap: 4 }}>
                <h3 style={{ margin: 0 }}>Year-End Update</h3>
                <div style={{ fontSize: 13, color: "#64748b", fontWeight: 600 }}>
                  Select students to promote to the next year level or archive as
                  graduated.
                </div>
              </div>
              <button onClick={closeYearEndModal} style={iconButton} title="Close">
                <X size={18} />
              </button>
            </div>

            <div style={yearEndModalBody}>
              <div style={yearEndSummaryRow}>
                <div style={yearEndSummaryCard}>
                  <UsersIcon size={16} />
                  <span>{yearEndFilteredRows.length} student(s) in current filtered view</span>
                </div>
                <div style={yearEndSummaryCard}>
                  <ArrowUp size={16} />
                  <span>
                    {yearEndFilteredRows.filter((row) => row.actionType === "promote").length}{" "}
                    eligible for promotion
                  </span>
                </div>
                <div style={yearEndSummaryCard}>
                  <Archive size={16} />
                  <span>
                    {yearEndFilteredRows.filter((row) => row.actionType === "archive").length}{" "}
                    graduate archive candidate(s)
                  </span>
                </div>
              </div>

              <div style={yearEndMetaRow}>
                <div style={{ fontSize: 13, color: "#475569", fontWeight: 600 }}>
                  Active academic year target:{" "}
                  <b>{years.find((year) => year.id === activeYearId)?.name ?? "-"}</b>
                </div>
                <div style={{ fontSize: 13, color: "#64748b", fontWeight: 600 }}>
                  Promotion flow: 1st Year to 2nd Year, 2nd Year to 3rd Year, 3rd Year
                  to 4th Year. Final year students become archive candidates.
                </div>
              </div>

              <div style={yearEndToolbar}>
                <div style={yearEndSearchTools}>
                  <div style={yearEndFilterAnchor}>
                    <button
                      type="button"
                      onClick={() => setShowYearEndFilters((prev) => !prev)}
                      style={{
                        ...headerFilterButton,
                        height: 44,
                        width: 44,
                        borderRadius: 12,
                        background: showYearEndFilters ? "#5F6D7A" : "white",
                        color: showYearEndFilters ? "white" : "#000000",
                        border: showYearEndFilters
                          ? "1px solid #5F6D7A"
                          : "1px solid #111111",
                      }}
                      title={showYearEndFilters ? "Hide filters" : "Show filters"}
                      aria-label={showYearEndFilters ? "Hide filters" : "Show filters"}
                    >
                      <List size={20} />
                    </button>

                    {showYearEndFilters && (
                      <div style={yearEndFilterPanel}>
                        <div style={compactField}>
                          <label style={compactLabel}>College</label>
                          <select
                            value={yearEndCollegeFilterId}
                            onChange={(e) =>
                              setYearEndCollegeFilterId(Number(e.target.value) || 0)
                            }
                            style={compactSelect}
                          >
                            <option value={0}>All colleges</option>
                            {yearEndCollegeOptions.map((college) => (
                              <option key={college.id} value={college.id}>
                                {college.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div style={compactField}>
                          <label style={compactLabel}>Course</label>
                          <select
                            value={yearEndCourseFilterId}
                            onChange={(e) =>
                              setYearEndCourseFilterId(Number(e.target.value) || 0)
                            }
                            style={compactSelect}
                          >
                            <option value={0}>All courses</option>
                            {yearEndCourseOptions.map((course) => (
                              <option key={course.id} value={course.id}>
                                {course.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div style={compactField}>
                          <label style={compactLabel}>Year Level</label>
                          <select
                            value={yearEndYearLevelFilterId}
                            onChange={(e) =>
                              setYearEndYearLevelFilterId(Number(e.target.value) || 0)
                            }
                            style={compactSelect}
                          >
                            <option value={0}>All year levels</option>
                            {yearEndYearLevelOptions.map((yearLevel) => (
                              <option key={yearLevel.id} value={yearLevel.id}>
                                {yearLevel.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div style={compactField}>
                          <label style={compactLabel}>Section</label>
                          <select
                            value={yearEndSectionFilter}
                            onChange={(e) => setYearEndSectionFilter(e.target.value)}
                            style={compactSelect}
                          >
                            <option value="">All sections</option>
                            {yearEndSectionOptions.map((sectionName) => (
                              <option key={sectionName} value={sectionName}>
                                {sectionName}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div style={{ display: "flex", justifyContent: "flex-end" }}>
                          <button
                            type="button"
                            style={compactClearButton}
                            onClick={() => {
                              setYearEndCollegeFilterId(0);
                              setYearEndCourseFilterId(0);
                              setYearEndYearLevelFilterId(0);
                              setYearEndSectionFilter("");
                            }}
                          >
                            <X size={14} />
                            Clear
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  <div style={yearEndSearchField}>
                    <Search size={16} style={{ opacity: 0.7 }} />
                    <input
                      type="search"
                      value={yearEndSearchText}
                      onChange={(e) => setYearEndSearchText(e.target.value)}
                      placeholder="Search student, college, course, year level, or section..."
                      style={yearEndSearchInput}
                    />
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    flexWrap: "wrap",
                    justifyContent: "flex-end",
                  }}
                >
                  <div style={yearEndSelectionText}>
                    Selected: <b>{yearEndSelectedCount}</b> student(s) | Filtered list:{" "}
                    <b>{yearEndFilteredRows.length}</b> student(s)
                  </div>

                  <button
                    type="button"
                    style={ghostButton}
                    onClick={() =>
                      setYearEndSelectedIds(allYearEndSelected ? [] : yearEndSelectableIds)
                    }
                  >
                    {allYearEndSelected ? "Clear Selection" : "Select All Actionable"}
                  </button>
                </div>
              </div>

              <div style={yearEndTableWrap}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 860 }}>
                  <thead>
                    <tr style={{ textAlign: "left" }}>
                      <th style={{ ...th, width: 52 }}>Pick</th>
                      <th style={th}>Student</th>
                      <th style={th}>College</th>
                      <th style={th}>Course</th>
                      <th style={th}>Year Level</th>
                      <th style={th}>Section</th>
                      <th style={th}>Next Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {yearEndFilteredRows.map((row) => {
                      const disabled = row.actionType === "review";
                      const selected = yearEndSelectedIds.includes(row.user.id);
                      return (
                        <tr
                          key={row.user.id}
                          style={{ borderTop: "1px solid var(--border)" }}
                        >
                          <td style={td}>
                            <input
                              type="checkbox"
                              checked={selected}
                              disabled={disabled}
                              onChange={() => toggleYearEndStudent(row.user.id)}
                            />
                          </td>
                          <td style={td}>
                            {row.user.fname} {row.user.mname ? `${row.user.mname} ` : ""}
                            {row.user.lname}
                          </td>
                          <td style={td}>{row.collegeLabel}</td>
                          <td style={td}>{row.courseLabel}</td>
                          <td style={td}>{row.currentYearLabel}</td>
                          <td style={td}>{row.sectionLabel || "-"}</td>
                          <td style={td}>
                            <span
                              style={{
                                ...yearEndActionChip,
                                color:
                                  row.actionType === "promote"
                                    ? "#1d4ed8"
                                    : row.actionType === "archive"
                                      ? "#92400e"
                                      : "#64748b",
                                background:
                                  row.actionType === "promote"
                                    ? "#eff6ff"
                                    : row.actionType === "archive"
                                      ? "#fffbeb"
                                      : "#f8fafc",
                                borderColor:
                                  row.actionType === "promote"
                                    ? "#bfdbfe"
                                    : row.actionType === "archive"
                                      ? "#fde68a"
                                      : "#e2e8f0",
                              }}
                            >
                              {row.targetLabel}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                    {yearEndFilteredRows.length === 0 && (
                      <tr style={{ borderTop: "1px solid var(--border)" }}>
                        <td style={{ ...td, paddingTop: 16, paddingBottom: 16 }} colSpan={7}>
                          <span style={{ opacity: 0.8 }}>
                            No active student users match the current year-end filters.
                          </span>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {yearEndError && <div style={errorBox}>{yearEndError}</div>}
            </div>

            <div style={modalFooter}>
              <button onClick={closeYearEndModal} style={ghostButton}>
                Cancel
              </button>
              <button
                type="button"
                onClick={handlePromoteStudents}
                style={ghostButton}
                disabled={yearEndProcessing !== null}
              >
                Promote Selected
              </button>
              <button
                type="button"
                onClick={handleArchiveGraduates}
                style={primaryButton}
                disabled={yearEndProcessing !== null}
              >
                Archive Graduates
              </button>
            </div>
          </div>
        </div>
      )}

      {isYearEndResultsOpen && (
        <div style={modalOverlay} onClick={closeYearEndResultsModal}>
          <div style={yearEndResultsModalCard} onClick={(e) => e.stopPropagation()}>
            <div style={modalHeader}>
              <div style={{ display: "grid", gap: 4 }}>
                <h3 style={{ margin: 0 }}>Year-End Results</h3>
                <div style={{ fontSize: 13, color: "#64748b", fontWeight: 600 }}>
                  View promoted students and archived graduates in separate tables.
                </div>
              </div>
              <button onClick={closeYearEndResultsModal} style={iconButton} title="Close">
                <X size={18} />
              </button>
            </div>

            <div style={yearEndResultsModalBody}>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button
                  type="button"
                  style={filterChip(yearEndHistoryTab === "PROMOTED")}
                  onClick={() => setYearEndHistoryTab("PROMOTED")}
                >
                  Promoted Students
                </button>
                <button
                  type="button"
                  style={filterChip(yearEndHistoryTab === "ARCHIVED")}
                  onClick={() => setYearEndHistoryTab("ARCHIVED")}
                >
                  Archived Students
                </button>
              </div>

              {yearEndHistoryError && <div style={errorBox}>{yearEndHistoryError}</div>}

              {yearEndHistoryLoading ? (
                <div style={yearEndResultsEmpty}>
                  <LoadingSpinner size={18} />
                  <span>Loading year-end results...</span>
                </div>
              ) : (
                <div style={yearEndResultsTableWrap}>
                  <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 960 }}>
                    <thead>
                      {yearEndHistoryTab === "PROMOTED" ? (
                        <tr style={{ textAlign: "left" }}>
                          <th style={th}>Student</th>
                          <th style={th}>Email</th>
                          <th style={th}>College</th>
                          <th style={th}>Course</th>
                          <th style={th}>From Year</th>
                          <th style={th}>To Year</th>
                          <th style={th}>Section</th>
                          <th style={th}>Academic Year</th>
                          <th style={th}>Promoted At</th>
                        </tr>
                      ) : (
                        <tr style={{ textAlign: "left" }}>
                          <th style={th}>Student</th>
                          <th style={th}>Email</th>
                          <th style={th}>College</th>
                          <th style={th}>Course</th>
                          <th style={th}>Final Year</th>
                          <th style={th}>Section</th>
                          <th style={th}>Academic Year</th>
                          <th style={th}>Archived At</th>
                        </tr>
                      )}
                    </thead>
                    <tbody>
                      {activeYearEndHistory.map((row) =>
                        yearEndHistoryTab === "PROMOTED" ? (
                          <tr
                            key={`promoted-${row.id}`}
                            style={{ borderTop: "1px solid var(--border)" }}
                          >
                            <td style={td}>{row.studentName}</td>
                            <td style={td}>{row.studentEmail || "-"}</td>
                            <td style={td}>{row.collegeName || "-"}</td>
                            <td style={td}>{row.courseName || "-"}</td>
                            <td style={td}>{row.fromYearLevelName || "-"}</td>
                            <td style={td}>{row.toYearLevelName || "-"}</td>
                            <td style={td}>{row.sectionName || "-"}</td>
                            <td style={td}>{row.academicYearName || "-"}</td>
                            <td style={td}>{formatDateTime(row.actionAt)}</td>
                          </tr>
                        ) : (
                          <tr
                            key={`archived-${row.id}`}
                            style={{ borderTop: "1px solid var(--border)" }}
                          >
                            <td style={td}>{row.studentName}</td>
                            <td style={td}>{row.studentEmail || "-"}</td>
                            <td style={td}>{row.collegeName || "-"}</td>
                            <td style={td}>{row.courseName || "-"}</td>
                            <td style={td}>{row.fromYearLevelName || "-"}</td>
                            <td style={td}>{row.sectionName || "-"}</td>
                            <td style={td}>{row.academicYearName || "-"}</td>
                            <td style={td}>{formatDateTime(row.actionAt)}</td>
                          </tr>
                        ),
                      )}
                      {activeYearEndHistory.length === 0 && (
                        <tr style={{ borderTop: "1px solid var(--border)" }}>
                          <td
                            style={{ ...td, paddingTop: 16, paddingBottom: 16 }}
                            colSpan={yearEndHistoryTab === "PROMOTED" ? 9 : 8}
                          >
                            <span style={{ opacity: 0.8 }}>
                              {yearEndHistoryTab === "PROMOTED"
                                ? "No promoted student records yet."
                                : "No archived student records yet."}
                            </span>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div style={modalFooter}>
              <button onClick={closeYearEndResultsModal} style={ghostButton}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <SuccessNoticeModal
        open={Boolean(successNotice)}
        onClose={() => setSuccessNotice(null)}
        title={successNotice?.title ?? "Success"}
        message={successNotice?.message ?? ""}
      />

      <UserManagementProcessingOverlay
        open={adding}
        title="Adding User"
        message="Please wait while we add the user to User Management."
      />

      <UserManagementProcessingOverlay
        open={importing}
        title="Importing CSV"
        message="Please wait while we import users into User Management."
      />

      <UserManagementProcessingOverlay
        open={yearEndProcessing !== null}
        title={
          yearEndProcessing === "promote"
            ? "Promoting Students"
            : "Archiving Graduates"
        }
        message={
          yearEndProcessing === "promote"
            ? "Please wait while we move the selected students to the next year level."
            : "Please wait while we archive the selected graduated students."
        }
      />

      {/* ===== EDIT MODAL ===== */}
      {isEditOpen && (
        <div style={modalOverlay} onClick={closeEdit}>
          <div style={modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={modalHeader}>
              <h3 style={{ margin: 0 }}>Edit User</h3>
              <button onClick={closeEdit} style={iconButton} title="Close">
                <X size={18} />
              </button>
            </div>

            <div style={modalGrid}>
              <div>
                <label style={labelStyle}>First Name</label>
                <input
                  value={efname}
                  onChange={(e) =>
                    setEFname(toSentenceCaseNameInput(e.target.value))
                  }
                  onBlur={() => setEFname((v) => normalizeSentenceCaseName(v))}
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Middle Name (optional)</label>
                <input
                  value={emname}
                  onChange={(e) =>
                    setEMname(toSentenceCaseNameInput(e.target.value))
                  }
                  onBlur={() => setEMname((v) => normalizeSentenceCaseName(v))}
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Last Name</label>
                <input
                  value={elname}
                  onChange={(e) =>
                    setELname(toSentenceCaseNameInput(e.target.value))
                  }
                  onBlur={() => setELname((v) => normalizeSentenceCaseName(v))}
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Email</label>
                <input
                  value={eemail}
                  onChange={(e) => setEEmail(normalizeEmailInput(e.target.value))}
                  onBlur={() => setEEmail((v) => normalizeBisuEmail(v))}
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Role</label>
                <select
                  value={erole}
                  onChange={(e) => setERole(e.target.value as Role)}
                  style={inputStyle}
                >
                  <option value="STUDENT">Student</option>
                  <option value="STAFF">Staff</option>
                  <option value="TEACHER">Teacher</option>
                  <option value="NON_TEACHING_PERSONNEL">
                    Non Teaching Personnel
                  </option>
                  <option value="ADMIN">Admin</option>
                </select>
              </div>

              {erole === "STUDENT" && (
                <>
                  <div>
                    <label style={labelStyle}>College</label>
                    <select
                      value={ecollegeId}
                      onChange={(e) => setECollegeId(Number(e.target.value))}
                      style={inputStyle}
                    >
                      {colleges.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={labelStyle}>Course</label>
                    <select
                      value={ecourseId}
                      onChange={(e) => setECourseId(Number(e.target.value))}
                      style={inputStyle}
                    >
                      <option value={0}>
                        {editFilteredCourses.length ? "Select course" : "No courses found"}
                      </option>
                      {editFilteredCourses.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={labelStyle}>Year Level</label>
                    <select
                      value={eyearLevelId}
                      onChange={(e) => setEYearLevelId(Number(e.target.value))}
                      style={inputStyle}
                    >
                      {editFilteredYearLevels.map((yl) => (
                        <option key={yl.id} value={yl.id}>
                          {yl.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={labelStyle}>Section (optional)</label>
                    <select
                      value={esection}
                      onChange={(e) => setESection(e.target.value)}
                      style={inputStyle}
                    >
                      <option value="">None</option>
                      <option value="A">A</option>
                      <option value="B">B</option>
                    </select>
                  </div>
                </>
              )}
            </div>

            <div style={modalFooter}>
              <button onClick={closeEdit} style={ghostButton}>
                Cancel
              </button>
              <button onClick={handleSaveEdit} style={primaryButton} disabled={savingEdit}>
                {savingEdit ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== DELETE CONFIRM MODAL ===== */}
      {isDeleteOpen && deleteTarget && (
        <div style={modalOverlay} onClick={closeDeleteConfirm}>
          <div style={confirmCard} onClick={(e) => e.stopPropagation()}>
            <div style={modalHeader}>
              <h3 style={{ margin: 0 }}>Confirm Delete</h3>
              <button
                onClick={closeDeleteConfirm}
                style={iconButton}
                title="Close"
              >
                <X size={18} />
              </button>
            </div>

            <p style={{ margin: "10px 0 0" }}>
              Are you sure you want to delete{" "}
              <b>
                {deleteTarget.fname} {deleteTarget.lname}
              </b>
              ? This action cannot be undone.
            </p>

            <div style={modalFooter}>
              <button onClick={closeDeleteConfirm} style={ghostButton}>
                Cancel
              </button>
              <button onClick={confirmDelete} style={dangerButtonStrong}>
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ===== styles ===== */

const card: React.CSSProperties = {
  background: "var(--card)",
  padding: 16,
  borderRadius: 16,
  boxShadow: "var(--shadow)",
  border: "1px solid var(--border)",
};

const labelStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  marginBottom: 6,
  opacity: 0.9,
};

const inputStyle: React.CSSProperties = {
  height: 40,
  borderRadius: 10,
  border: "1px solid var(--border)",
  padding: "0 10px",
  outline: "none",
  background: "white",
  color: "var(--text)",
  width: "100%",
};

const primaryButton: React.CSSProperties = {
  height: 40,
  padding: "0 16px",
  borderRadius: 10,
  border: "none",
  background: "var(--primary)",
  color: "white",
  fontWeight: 700,
  cursor: "pointer",
};

const addUserButtonStyle = (
  pressed: boolean,
  disabled = false,
): React.CSSProperties => ({
  ...primaryButton,
  border: "none",
  background: pressed && !disabled ? "#244957" : "var(--primary)",
  color: "white",
  boxShadow: pressed && !disabled ? "none" : "var(--shadow)",
  transform: pressed && !disabled ? "translateY(1px)" : "translateY(0)",
  opacity: disabled ? 0.7 : 1,
  cursor: disabled ? "not-allowed" : "pointer",
  transition:
    "background-color 120ms ease, color 120ms ease, transform 120ms ease, box-shadow 120ms ease",
});

const headerIconActionButton = (
  pressed: boolean,
  disabled = false,
): React.CSSProperties => ({
  height: 40,
  width: 56,
  borderRadius: 12,
  border: "1px solid #111111",
  background: pressed && !disabled ? "#f8fafc" : "white",
  color: "#111111",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: disabled ? "not-allowed" : "pointer",
  opacity: disabled ? 0.7 : 1,
  boxShadow: "none",
  transform: pressed && !disabled ? "translateY(1px)" : "translateY(0)",
});

const iconButton: React.CSSProperties = {
  height: 40,
  width: 44,
  borderRadius: 12,
  border: "1px solid var(--border)",
  background: "white",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
};

const headerFilterButton: React.CSSProperties = {
  height: 48,
  width: 48,
  borderRadius: 14,
  border: "1px solid #111111",
  background: "white",
  color: "#000000",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  transition:
    "background-color 140ms ease, color 140ms ease, border-color 140ms ease, transform 140ms ease",
};

const compactFilterPanel: React.CSSProperties = {
  position: "absolute",
  right: 0,
  top: "calc(100% + 10px)",
  width: "min(340px, calc(100vw - 120px))",
  padding: 12,
  borderRadius: 16,
  border: "1px solid var(--border)",
  background: "white",
  boxShadow: "0 18px 40px rgba(15,23,42,0.12)",
  display: "grid",
  gap: 10,
  zIndex: 20,
};

const compactField: React.CSSProperties = {
  display: "grid",
  gap: 5,
};

const compactLabel: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  opacity: 0.78,
};

const compactSelect: React.CSSProperties = {
  height: 40,
  borderRadius: 10,
  border: "1px solid var(--border)",
  padding: "0 10px",
  outline: "none",
  width: "100%",
  background: "white",
  color: "var(--text)",
};

const compactClearButton: React.CSSProperties = {
  height: 34,
  padding: "0 12px",
  borderRadius: 10,
  border: "1px solid var(--border)",
  background: "white",
  color: "#000000",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  fontWeight: 800,
  fontSize: 12.5,
  cursor: "pointer",
};

const dangerIconButton: React.CSSProperties = {
  height: 40,
  width: 44,
  borderRadius: 12,
  border: "none",
  background: "#FEE2E2",
  color: "#DC2626",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
};

const ghostButton: React.CSSProperties = {
  height: 40,
  padding: "0 14px",
  borderRadius: 10,
  border: "1px solid var(--border)",
  background: "white",
  cursor: "pointer",
  fontWeight: 600,
};

const filterChip = (active: boolean): React.CSSProperties => ({
  height: 34,
  padding: "0 14px",
  borderRadius: 10,
  border: active ? "1px solid var(--primary)" : "1px solid var(--border)",
  background: active ? "var(--primary)" : "white",
  color: active ? "white" : "var(--text)",
  fontWeight: 700,
  cursor: "pointer",
});

const paginationButton: React.CSSProperties = {
  minHeight: 38,
  padding: "0 14px",
  borderRadius: 10,
  border: "1px solid var(--border)",
  background: "white",
  color: "#0f172a",
  fontWeight: 700,
  fontSize: 13,
  cursor: "pointer",
};

const yearEndSummaryRow: React.CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
  marginBottom: 12,
};

const yearEndSummaryCard: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  minHeight: 28,
  padding: "0",
  borderRadius: 0,
  border: "none",
  background: "transparent",
  color: "#334155",
  fontSize: 13,
  fontWeight: 700,
};

const yearEndModalCard: React.CSSProperties = {
  width: "min(1180px, calc(100vw - 32px))",
  maxHeight: "calc(100vh - 32px)",
  background: "white",
  borderRadius: 16,
  border: "1px solid var(--border)",
  boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
  padding: 16,
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
};

const yearEndModalBody: React.CSSProperties = {
  display: "grid",
  gap: 12,
  minHeight: 0,
  overflowY: "auto",
  paddingRight: 2,
};

const yearEndResultsModalCard: React.CSSProperties = {
  width: "min(1120px, calc(100vw - 32px))",
  maxHeight: "calc(100vh - 32px)",
  background: "white",
  borderRadius: 16,
  border: "1px solid var(--border)",
  boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
  padding: 16,
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
};

const yearEndResultsModalBody: React.CSSProperties = {
  display: "grid",
  gap: 12,
  minHeight: 0,
  overflowY: "auto",
  paddingRight: 2,
};

const yearEndMetaRow: React.CSSProperties = {
  display: "grid",
  gap: 8,
};

const yearEndToolbar: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
};

const yearEndSearchTools: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "44px minmax(280px, 420px)",
  gap: 10,
  alignItems: "center",
};

const yearEndSelectionText: React.CSSProperties = {
  fontSize: 13,
  color: "#475569",
  fontWeight: 600,
  textAlign: "right",
};

const yearEndFilterAnchor: React.CSSProperties = {
  position: "relative",
  zIndex: 30,
};

const yearEndFilterPanel: React.CSSProperties = {
  ...compactFilterPanel,
  left: 0,
  right: "auto",
  top: "calc(100% + 10px)",
  width: "min(360px, calc(100vw - 96px))",
};

const yearEndSearchField: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  height: 44,
  padding: "0 12px",
  borderRadius: 12,
  border: "1px solid var(--border)",
  background: "white",
};

const yearEndSearchInput: React.CSSProperties = {
  border: "none",
  outline: "none",
  width: "100%",
  background: "transparent",
  color: "var(--text)",
  fontSize: 13.5,
};

const yearEndTableWrap: React.CSSProperties = {
  border: "1px solid var(--border)",
  borderRadius: 14,
  overflow: "auto",
  maxHeight: "min(52vh, 560px)",
  background: "white",
};

const yearEndActionChip: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: 30,
  padding: "6px 10px",
  borderRadius: 999,
  border: "1px solid #e2e8f0",
  fontSize: 12.5,
  fontWeight: 800,
};

const yearEndResultsTableWrap: React.CSSProperties = {
  border: "1px solid var(--border)",
  borderRadius: 14,
  overflow: "auto",
  background: "white",
};

const yearEndResultsEmpty: React.CSSProperties = {
  minHeight: 120,
  border: "1px solid var(--border)",
  borderRadius: 14,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 10,
  color: "#475569",
  fontWeight: 600,
  background: "white",
};

const dangerButtonStrong: React.CSSProperties = {
  height: 40,
  padding: "0 14px",
  borderRadius: 10,
  border: "none",
  background: "#DC2626",
  color: "white",
  cursor: "pointer",
  fontWeight: 800,
};

const th: React.CSSProperties = {
  padding: "8px 8px",
  opacity: 0.8,
  fontSize: 13.5,
  fontWeight: 700,
};
const td: React.CSSProperties = {
  padding: "8px 8px",
  fontSize: 13.5,
  lineHeight: 1.35,
};

const modalOverlay: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.35)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 16,
  zIndex: 9999,
};

const modalCard: React.CSSProperties = {
  width: "min(720px, 100%)",
  background: "white",
  borderRadius: 16,
  border: "1px solid var(--border)",
  boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
  padding: 16,
};

const modalWideCard: React.CSSProperties = {
  width: "min(880px, 100%)",
  background: "white",
  borderRadius: 16,
  border: "1px solid var(--border)",
  boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
  padding: 16,
};

const confirmCard: React.CSSProperties = {
  width: "min(520px, 100%)",
  background: "white",
  borderRadius: 16,
  border: "1px solid var(--border)",
  boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
  padding: 16,
};

const modalHeader: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: 12,
};

const modalGrid: React.CSSProperties = {
  display: "grid",
  gap: 10,
  gridTemplateColumns: "repeat(2, 1fr)",
};
const modalGridThree: React.CSSProperties = {
  display: "grid",
  gap: 10,
  gridTemplateColumns: "repeat(3, 1fr)",
};

const modalFooter: React.CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 10,
  marginTop: 16,
};

const buttonContent: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
};

const searchWrap: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  height: 40,
  padding: "0 10px",
  borderRadius: 12,
  border: "1px solid var(--border)",
  background: "white",
};

const searchInput: React.CSSProperties = {
  border: "none",
  outline: "none",
  width: 240,
  background: "transparent",
  color: "var(--text)",
  fontSize: 13.5,
};

const errorBox: React.CSSProperties = {
  marginTop: 10,
  border: "1px solid #fecaca",
  background: "#fee2e2",
  color: "#991b1b",
  borderRadius: 10,
  padding: "10px 12px",
  fontWeight: 700,
  fontSize: 13,
};

const okBox: React.CSSProperties = {
  marginTop: 10,
  border: "1px solid #bbf7d0",
  background: "#dcfce7",
  color: "#166534",
  borderRadius: 10,
  padding: "10px 12px",
  fontWeight: 700,
  fontSize: 13,
};

const csvPre: React.CSSProperties = {
  margin: 0,
  background: "#f8fafc",
  color: "#0f172a",
  border: "1px solid #e2e8f0",
  borderRadius: 12,
  padding: 12,
  overflowX: "auto",
  fontSize: 12,
  lineHeight: 1.45,
};




