import { useEffect, useMemo, useRef, useState } from "react";
import { Pencil, Trash2, X, Search, CheckCircle2, XCircle } from "lucide-react";
import { postFormData, postJSON } from "../lib/api";

type Role =
  | "ADMIN"
  | "COUNSELOR"
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
  yearLevelId?: number;
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
    yearLevelId?: number | null;
  }>;
  colleges?: College[];
  academicYears?: AcademicYear[];
  yearLevels?: YearLevel[];
};

type CsvImportResponse = {
  ok: boolean;
  message?: string;
  inserted: number;
  skipped: number;
  errors?: string[];
};

const USERS_KEY = "gcms_mock_users_v1";
const COLLEGES_KEY = "gcms_mock_colleges_v1";
const YEARS_KEY = "gcms_mock_academic_years_v1";
const YL_KEY = "gcms_mock_year_levels_v1";
const BISU_DOMAIN = "bisu.edu.ph";
const CSV_SAMPLE = `first_name,middle_name,last_name,email,role,college_name,year_level_name,password
Juan,,Dela Cruz,juan.delacruz@bisu.edu.ph,STUDENT,College of Computer Studies,1st Year,
Maria,,Santos,maria.santos@bisu.edu.ph,COUNSELOR,,,
Natan,,Paxley,natan.paxley@bisu.edu.ph,TEACHER,,,
Luna,,Gonzales,luna.gonzales@bisu.edu.ph,NON_TEACHING_PERSONNEL,,,
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

function toSentenceCaseName(value: string): string {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase()
    .replace(/(^|[\s'-])([a-z])/g, (m) => m.toUpperCase());
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
    fname: toSentenceCaseName(u.fname),
    mname: u.mname ? toSentenceCaseName(u.mname) : undefined,
    lname: toSentenceCaseName(u.lname),
    email: normalizeBisuEmail(u.email),
    username: String(u.username || "").trim(),
    registered: Boolean(u.registered),
  };
}

function toRole(value: string): Role {
  const r = String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");
  if (r === "ADMIN" || r === "COUNSELOR" || r === "TEACHER") return r;
  if (r === "NON_TEACHING" || r === "NON_TEACHING_STAFF") {
    return "NON_TEACHING_PERSONNEL";
  }
  if (r === "NON_TEACHING_PERSONNEL") return "NON_TEACHING_PERSONNEL";
  return "STUDENT";
}

function roleLabel(role: Role): string {
  if (role === "NON_TEACHING_PERSONNEL") return "Non Teaching Personnel";
  if (role === "COUNSELOR") return "Counselor";
  if (role === "TEACHER") return "Teacher";
  if (role === "ADMIN") return "Admin";
  return "Student";
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
    yearLevelId:
      u.yearLevelId === null || u.yearLevelId === undefined
        ? undefined
        : Number(u.yearLevelId),
  });
}

export default function Users() {
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
    const nextUsers = (res.users ?? []).map(mapBootstrapUser);

    setColleges(nextColleges);
    setYears(nextYears);
    setYearLevels(nextYearLevels);
    setUsers(nextUsers);
  };

  useEffect(() => {
    let alive = true;
    syncEntitiesFromDatabase().catch(() => {
      if (!alive) return;
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => save(COLLEGES_KEY, colleges), [colleges]);
  useEffect(() => save(YEARS_KEY, years), [years]);
  useEffect(() => save(YL_KEY, yearLevels), [yearLevels]);
  useEffect(() => save(USERS_KEY, users), [users]);

  // ===== ADD USER MODAL =====
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [fname, setFname] = useState("");
  const [mname, setMname] = useState("");
  const [lname, setLname] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("STUDENT");
  const [collegeId, setCollegeId] = useState<number>(colleges[0]?.id ?? 0);
  const [yearLevelId, setYearLevelId] = useState<number>(0);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState("");
  const [addSuccess, setAddSuccess] = useState("");

  const addFilteredYearLevels = useMemo(() => {
    return yearLevels.filter(
      (yl) => yl.collegeId === collegeId && yl.academicYearId === activeYearId,
    );
  }, [yearLevels, collegeId, activeYearId]);

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

  const closeAddModal = () => {
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

    const f = toSentenceCaseName(fname);
    const m = toSentenceCaseName(mname);
    const l = toSentenceCaseName(lname);
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
      setAdding(true);
      await postJSON<{ ok?: boolean; users_id?: number }>("/create_user.php", {
        fname: f,
        mname: m || "",
        lname: l,
        email: e,
        role,
        collegeId: role === "STUDENT" ? collegeId : undefined,
        yearLevelId: role === "STUDENT" ? yearLevelId : undefined,
      });
      await syncEntitiesFromDatabase();

      setAddSuccess("User added successfully.");
      setFname("");
      setMname("");
      setLname("");
      setEmail("");
      setRole("STUDENT");
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
      setImporting(true);
      const fd = new FormData();
      fd.append("csv", csvFile);
      const res = await postFormData<CsvImportResponse>(
        "/import_users_csv.php",
        fd,
      );
      setImportResult(res);
      await syncEntitiesFromDatabase();
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
    "ALL" | "STUDENT" | "TEACHER_COUNSELOR" | "NON_TEACHING"
  >("ALL");
  const [searchText, setSearchText] = useState("");

  const visibleUsers = useMemo(() => {
    const q = searchText.trim().toLowerCase();

    return users.filter((u) => {
      // Search (name/email/username)
      if (q) {
        const name = `${u.fname} ${u.mname ?? ""} ${u.lname}`.toLowerCase();
        const em = u.email.toLowerCase();
        const un = String(u.username || "").toLowerCase();
        if (!name.includes(q) && !em.includes(q) && !un.includes(q))
          return false;
      }

      if (roleFilter === "STUDENT" && u.role !== "STUDENT") return false;
      if (
        roleFilter === "TEACHER_COUNSELOR" &&
        !(u.role === "TEACHER" || u.role === "COUNSELOR")
      ) {
        return false;
      }
      if (
        roleFilter === "NON_TEACHING" &&
        (u.role === "STUDENT" || u.role === "TEACHER" || u.role === "COUNSELOR")
      ) {
        return false;
      }

      return true;
    });
  }, [users, roleFilter, searchText]);

  const getCollegeName = (id?: number) =>
    colleges.find((c) => c.id === id)?.name ?? "-";
  const getYearLevelName = (id?: number) =>
    yearLevels.find((y) => y.id === id)?.name ?? "-";

  // ===== EDIT MODAL =====
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [efname, setEFname] = useState("");
  const [emname, setEMname] = useState("");
  const [elname, setELname] = useState("");
  const [eemail, setEEmail] = useState("");
  const [erole, setERole] = useState<Role>("STUDENT");

  const [ecollegeId, setECollegeId] = useState<number>(colleges[0]?.id ?? 0);
  const [eyearLevelId, setEYearLevelId] = useState<number>(0);

  const editFilteredYearLevels = useMemo(() => {
    return yearLevels.filter(
      (yl) => yl.collegeId === ecollegeId && yl.academicYearId === activeYearId,
    );
  }, [yearLevels, ecollegeId, activeYearId]);

  useEffect(() => {
    if (erole !== "STUDENT") return;
    const ok = editFilteredYearLevels.some((yl) => yl.id === eyearLevelId);
    if (!ok) setEYearLevelId(editFilteredYearLevels[0]?.id ?? 0);
  }, [editFilteredYearLevels, eyearLevelId, erole]);

  const openEdit = (u: User) => {
    setEditingId(u.id);
    setEFname(u.fname);
    setEMname(u.mname ?? "");
    setELname(u.lname);
    setEEmail(u.email);
    setERole(u.role);

    if (u.role === "STUDENT") {
      setECollegeId(u.collegeId ?? colleges[0]?.id ?? 0);
      setEYearLevelId(u.yearLevelId ?? 0);
    } else {
      setECollegeId(colleges[0]?.id ?? 0);
      setEYearLevelId(0);
    }

    setIsEditOpen(true);
  };

  const closeEdit = () => {
    setIsEditOpen(false);
    setEditingId(null);
  };

  const handleSaveEdit = () => {
    if (editingId == null) return;

    const f = toSentenceCaseName(efname);
    const m = toSentenceCaseName(emname);
    const l = toSentenceCaseName(elname);
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

    setUsers((prev) =>
      prev.map((u) => {
        if (u.id !== editingId) return u;

        return {
          ...u,
          fname: f,
          mname: m ? m : undefined,
          lname: l,
          email: e,
          role: erole,
          ...(erole === "STUDENT"
            ? { collegeId: ecollegeId, yearLevelId: eyearLevelId }
            : { collegeId: undefined, yearLevelId: undefined }),
        };
      }),
    );

    closeEdit();
  };

  return (
    <div style={{ display: "grid", gap: 16 }}>
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
        <button style={primaryButton} onClick={openAddModal}>
          + Add User
        </button>
        <button style={ghostButton} onClick={openImportModal}>
          Import CSV
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
            style={filterChip(roleFilter === "TEACHER_COUNSELOR")}
            onClick={() => setRoleFilter("TEACHER_COUNSELOR")}
          >
            Teacher and Counselor
          </button>
          <button
            style={filterChip(roleFilter === "NON_TEACHING")}
            onClick={() => setRoleFilter("NON_TEACHING")}
          >
            Non Teaching Personnel
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
              <th style={th}>Year Level</th>
              <th style={th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {visibleUsers.map((u) => (
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
                  {u.role === "STUDENT" ? getYearLevelName(u.yearLevelId) : "-"}
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
                <td style={{ ...td, paddingTop: 14, paddingBottom: 14 }} colSpan={8}>
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
                    {(searchText.trim() !== "" || roleFilter !== "ALL") && (
                      <button
                        type="button"
                        style={ghostButton}
                        onClick={() => {
                          setSearchText("");
                          setRoleFilter("ALL");
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

        <div style={{ marginTop: 10, opacity: 0.8, fontSize: 13 }}>
          Student users are linked to College + Year Level (based on your setup
          flow).
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
                  onChange={(e) => setFname(e.target.value)}
                  onBlur={() => setFname((v) => toSentenceCaseName(v))}
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Middle Name (optional)</label>
                <input
                  placeholder="Middle name"
                  value={mname}
                  onChange={(e) => setMname(e.target.value)}
                  onBlur={() => setMname((v) => toSentenceCaseName(v))}
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Last Name</label>
                <input
                  placeholder="Last name"
                  value={lname}
                  onChange={(e) => setLname(e.target.value)}
                  onBlur={() => setLname((v) => toSentenceCaseName(v))}
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
                  <option value="COUNSELOR">Counselor</option>
                  <option value="NON_TEACHING_PERSONNEL">
                    Non Teaching Personnel
                  </option>
                  <option value="ADMIN">Admin</option>
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
              </div>
            )}

            {addError && <div style={errorBox}>{addError}</div>}
            {addSuccess && <div style={okBox}>{addSuccess}</div>}

            <div style={modalFooter}>
              <button onClick={closeAddModal} style={ghostButton}>
                Cancel
              </button>
              <button onClick={handleAddUser} style={primaryButton} disabled={adding}>
                {adding ? "Adding..." : "Add User"}
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
                {importing ? "Importing..." : "Import CSV"}
              </button>
            </div>
          </div>
        </div>
      )}

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
                  onChange={(e) => setEFname(e.target.value)}
                  onBlur={() => setEFname((v) => toSentenceCaseName(v))}
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Middle Name (optional)</label>
                <input
                  value={emname}
                  onChange={(e) => setEMname(e.target.value)}
                  onBlur={() => setEMname((v) => toSentenceCaseName(v))}
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Last Name</label>
                <input
                  value={elname}
                  onChange={(e) => setELname(e.target.value)}
                  onBlur={() => setELname((v) => toSentenceCaseName(v))}
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
                  <option value="COUNSELOR">Counselor</option>
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
                </>
              )}
            </div>

            <div style={modalFooter}>
              <button onClick={closeEdit} style={ghostButton}>
                Cancel
              </button>
              <button onClick={handleSaveEdit} style={primaryButton}>
                Save Changes
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
  borderRadius: 999,
  border: active ? "1px solid var(--primary)" : "1px solid var(--border)",
  background: active ? "var(--primary)" : "white",
  color: active ? "white" : "var(--text)",
  fontWeight: 700,
  cursor: "pointer",
});

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




