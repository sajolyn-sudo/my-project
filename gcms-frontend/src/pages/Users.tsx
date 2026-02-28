import { useEffect, useMemo, useState } from "react";
import { Filter, Pencil, Trash2, X, Search } from "lucide-react";

type Role = "ADMIN" | "COUNSELOR" | "STUDENT";

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

  // Only for counselor/admin (in future backend)
  password?: string;

  // Student-only fields
  collegeId?: number;
  yearLevelId?: number;
};

const USERS_KEY = "gcms_mock_users_v1";
const COLLEGES_KEY = "gcms_mock_colleges_v1";
const YEARS_KEY = "gcms_mock_academic_years_v1";
const YL_KEY = "gcms_mock_year_levels_v1";

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

export default function Users() {
  const colleges = useMemo<College[]>(
    () =>
      load<College[]>(COLLEGES_KEY, [
        { id: 1, name: "College of Computer Studies" },
        { id: 2, name: "College of Education" },
      ]),
    [],
  );

  const years = useMemo<AcademicYear[]>(
    () =>
      load<AcademicYear[]>(YEARS_KEY, [
        { id: 1, name: "2024–2025", isActive: false },
        { id: 2, name: "2025–2026", isActive: true },
      ]),
    [],
  );

  const activeYearId = useMemo(
    () => years.find((y) => y.isActive)?.id ?? years[0]?.id ?? 0,
    [years],
  );

  const yearLevels = useMemo<YearLevel[]>(
    () =>
      load<YearLevel[]>(YL_KEY, [
        { id: 1, name: "1st Year", collegeId: 1, academicYearId: activeYearId },
        { id: 2, name: "2nd Year", collegeId: 1, academicYearId: activeYearId },
      ]),
    [activeYearId],
  );

  const [users, setUsers] = useState<User[]>(() =>
    load<User[]>(USERS_KEY, [
      {
        id: 1,
        fname: "System",
        lname: "Admin",
        email: "admin@gcms.demo",
        role: "ADMIN",
        password: "",
      },
      {
        id: 2,
        fname: "Maria",
        lname: "Santos",
        email: "maria@gcms.demo",
        role: "COUNSELOR",
        password: "",
      },
      {
        id: 3,
        fname: "Ana",
        lname: "Dela Cruz",
        email: "ana@gcms.demo",
        role: "STUDENT",
        collegeId: 1,
        yearLevelId: 1,
      },
    ]),
  );

  useEffect(() => save(USERS_KEY, users), [users]);

  // ===== ADD FORM =====
  const [fname, setFname] = useState("");
  const [mname, setMname] = useState("");
  const [lname, setLname] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("STUDENT");

  const [collegeId, setCollegeId] = useState<number>(colleges[0]?.id ?? 0);

  const addFilteredYearLevels = useMemo(() => {
    return yearLevels.filter(
      (yl) => yl.collegeId === collegeId && yl.academicYearId === activeYearId,
    );
  }, [yearLevels, collegeId, activeYearId]);

  const [yearLevelId, setYearLevelId] = useState<number>(
    addFilteredYearLevels[0]?.id ?? 0,
  );

  useEffect(() => {
    setYearLevelId(addFilteredYearLevels[0]?.id ?? 0);
  }, [collegeId, addFilteredYearLevels]);

  const handleAddUser = () => {
    const f = fname.trim();
    const m = mname.trim();
    const l = lname.trim();
    const e = email.trim().toLowerCase();
    if (!f || !l || !e) return;

    const exists = users.some((u) => u.email.trim().toLowerCase() === e);
    if (exists) {
      alert("This email already exists. Please use a different email.");
      return;
    }

    if (role === "STUDENT" && (!collegeId || !yearLevelId)) return;

    const nextId = users.length ? Math.max(...users.map((u) => u.id)) + 1 : 1;

    const newUser: User = {
      id: nextId,
      fname: f,
      mname: m ? m : undefined,
      lname: l,
      email: e,
      role,
      ...(role === "STUDENT"
        ? { collegeId, yearLevelId }
        : { collegeId: undefined, yearLevelId: undefined, password: "" }),
    };

    setUsers([newUser, ...users]);

    setFname("");
    setMname("");
    setLname("");
    setEmail("");
    setRole("STUDENT");
    setCollegeId(colleges[0]?.id ?? 0);
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
  const [showFilters, setShowFilters] = useState(false);
  const [filterCollegeId, setFilterCollegeId] = useState<number>(0);
  const [filterYearLevelId, setFilterYearLevelId] = useState<number>(0);
  const [searchText, setSearchText] = useState("");

  const filterYearLevels = useMemo(() => {
    if (!filterCollegeId)
      return yearLevels.filter((yl) => yl.academicYearId === activeYearId);
    return yearLevels.filter(
      (yl) =>
        yl.collegeId === filterCollegeId && yl.academicYearId === activeYearId,
    );
  }, [yearLevels, filterCollegeId, activeYearId]);

  const visibleUsers = useMemo(() => {
    const q = searchText.trim().toLowerCase();

    return users.filter((u) => {
      // Search (name/email)
      if (q) {
        const name = `${u.fname} ${u.mname ?? ""} ${u.lname}`.toLowerCase();
        const em = u.email.toLowerCase();
        if (!name.includes(q) && !em.includes(q)) return false;
      }

      // Student filters
      if (u.role !== "STUDENT") return true;
      if (filterCollegeId && u.collegeId !== filterCollegeId) return false;
      if (filterYearLevelId && u.yearLevelId !== filterYearLevelId)
        return false;

      return true;
    });
  }, [users, filterCollegeId, filterYearLevelId, searchText]);

  const getCollegeName = (id?: number) =>
    colleges.find((c) => c.id === id)?.name ?? "—";
  const getYearLevelName = (id?: number) =>
    yearLevels.find((y) => y.id === id)?.name ?? "—";

  // ===== EDIT MODAL =====
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [efname, setEFname] = useState("");
  const [emname, setEMname] = useState("");
  const [elname, setELname] = useState("");
  const [eemail, setEEmail] = useState("");
  const [erole, setERole] = useState<Role>("STUDENT");
  const [epassword, setEPassword] = useState(""); // ✅ only counselor/admin

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

  // if role changes away from counselor/admin, clear password field
  useEffect(() => {
    if (erole === "ADMIN" || erole === "COUNSELOR") return;
    setEPassword("");
  }, [erole]);

  const openEdit = (u: User) => {
    setEditingId(u.id);
    setEFname(u.fname);
    setEMname(u.mname ?? "");
    setELname(u.lname);
    setEEmail(u.email);
    setERole(u.role);
    setEPassword(u.password ?? "");

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

    const f = efname.trim();
    const m = emname.trim();
    const l = elname.trim();
    const e = eemail.trim().toLowerCase();

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

    // counselor/admin can set password (optional)
    const shouldKeepPassword = erole === "ADMIN" || erole === "COUNSELOR";

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
          ...(shouldKeepPassword
            ? { password: epassword }
            : { password: undefined }),
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
      <h2 style={{ fontWeight: 800 }}>User Management</h2>

      {/* ===== ADD USER CARD ===== */}
      <div style={card}>
        <h3 style={{ marginBottom: 10 }}>Add User</h3>

        <div
          style={{
            display: "grid",
            gap: 10,
            gridTemplateColumns: "repeat(6, 1fr)",
            alignItems: "end",
          }}
        >
          <input
            placeholder="First name"
            value={fname}
            onChange={(e) => setFname(e.target.value)}
            style={inputStyle}
          />
          <input
            placeholder="Middle name (optional)"
            value={mname}
            onChange={(e) => setMname(e.target.value)}
            style={inputStyle}
          />
          <input
            placeholder="Last name"
            value={lname}
            onChange={(e) => setLname(e.target.value)}
            style={inputStyle}
          />
          <input
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={inputStyle}
          />

          <div style={{ display: "flex", flexDirection: "column" }}>
            <label style={labelStyle}>User Type</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
              style={inputStyle}
            >
              <option value="STUDENT">Student</option>
              <option value="COUNSELOR">Counselor</option>
              <option value="ADMIN">Admin</option>
            </select>
          </div>

          <button onClick={handleAddUser} style={primaryButton}>
            Add User
          </button>
        </div>

        {role === "STUDENT" && (
          <div
            style={{
              marginTop: 12,
              display: "grid",
              gap: 10,
              gridTemplateColumns: "2fr 2fr",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column" }}>
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

            <div style={{ display: "flex", flexDirection: "column" }}>
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
            {/* ✅ Search Input */}
            <div style={searchWrap}>
              <Search size={16} style={{ opacity: 0.7 }} />
              <input
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Search name or email..."
                style={searchInput}
              />
            </div>

            <button
              onClick={() => setShowFilters((s) => !s)}
              style={iconButton}
              title="Filter"
            >
              <Filter size={18} />
            </button>
          </div>
        </div>

        {showFilters && (
          <div
            style={{
              display: "flex",
              gap: 10,
              alignItems: "center",
              marginBottom: 12,
              flexWrap: "wrap",
            }}
          >
            <select
              value={filterCollegeId}
              onChange={(e) => {
                const val = Number(e.target.value);
                setFilterCollegeId(val);
                setFilterYearLevelId(0);
              }}
              style={{ ...inputStyle, maxWidth: 320 }}
            >
              <option value={0}>All Colleges</option>
              {colleges.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>

            <select
              value={filterYearLevelId}
              onChange={(e) => setFilterYearLevelId(Number(e.target.value))}
              style={{ ...inputStyle, maxWidth: 220 }}
            >
              <option value={0}>All Year Levels</option>
              {filterYearLevels.map((yl) => (
                <option key={yl.id} value={yl.id}>
                  {yl.name}
                </option>
              ))}
            </select>

            <button
              onClick={() => {
                setFilterCollegeId(0);
                setFilterYearLevelId(0);
              }}
              style={ghostButton}
            >
              Clear
            </button>
          </div>
        )}

        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left" }}>
              <th style={th}>ID</th>
              <th style={th}>Name</th>
              <th style={th}>Email</th>
              <th style={th}>Role</th>
              <th style={th}>College</th>
              <th style={th}>Year Level</th>
              <th style={th}></th>
            </tr>
          </thead>
          <tbody>
            {visibleUsers.map((u) => (
              <tr key={u.id} style={{ borderTop: "1px solid var(--border)" }}>
                <td style={td}>{u.id}</td>
                <td style={td}>
                  {u.fname} {u.mname ? u.mname + " " : ""}
                  {u.lname}
                </td>
                <td style={td}>{u.email}</td>
                <td style={td}>{u.role}</td>
                <td style={td}>
                  {u.role === "STUDENT" ? getCollegeName(u.collegeId) : "—"}
                </td>
                <td style={td}>
                  {u.role === "STUDENT" ? getYearLevelName(u.yearLevelId) : "—"}
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
          </tbody>
        </table>

        <div style={{ marginTop: 10, opacity: 0.8, fontSize: 13 }}>
          Student users are linked to College + Year Level (based on your setup
          flow).
        </div>
      </div>

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
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Middle Name (optional)</label>
                <input
                  value={emname}
                  onChange={(e) => setEMname(e.target.value)}
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Last Name</label>
                <input
                  value={elname}
                  onChange={(e) => setELname(e.target.value)}
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Email</label>
                <input
                  value={eemail}
                  onChange={(e) => setEEmail(e.target.value)}
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
                  <option value="ADMIN">Admin</option>
                </select>
              </div>

              {/* ✅ Password only for Admin/Counselor */}
              {(erole === "ADMIN" || erole === "COUNSELOR") && (
                <div>
                  <label style={labelStyle}>Password (optional)</label>
                  <input
                    value={epassword}
                    onChange={(e) => setEPassword(e.target.value)}
                    style={inputStyle}
                    placeholder="Set / change password"
                  />
                </div>
              )}

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

const th: React.CSSProperties = { padding: "10px 8px", opacity: 0.8 };
const td: React.CSSProperties = { padding: "10px 8px" };

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
};
