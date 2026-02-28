import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Modal from "../components/Modal";

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

/** ✅ Helpers for clean list rendering */
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

export default function Referrals() {
  const users = useMemo<User[]>(() => load<User[]>(USERS_KEY, []), []);
  const colleges = useMemo<College[]>(
    () => load<College[]>(COLLEGES_KEY, []),
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
  const yearLevels = useMemo<YearLevel[]>(
    () => load<YearLevel[]>(YL_KEY, []),
    [],
  );

  const students = useMemo(
    () => users.filter((u) => u.role === "STUDENT"),
    [users],
  );
  const staff = useMemo(
    () => users.filter((u) => u.role === "COUNSELOR" || u.role === "ADMIN"),
    [users],
  );

  const activeAyId = useMemo(
    () => years.find((y) => y.isActive)?.id ?? years[0]?.id ?? 0,
    [years],
  );

  const [selectedAyId, setSelectedAyId] = useState<number>(activeAyId);
  const [filterCollegeId, setFilterCollegeId] = useState<number>(
    colleges[0]?.id ?? 0,
  );

  const filteredYearLevels = useMemo(
    () =>
      yearLevels.filter(
        (yl) =>
          yl.academicYearId === selectedAyId &&
          yl.collegeId === filterCollegeId,
      ),
    [yearLevels, selectedAyId, filterCollegeId],
  );

  const [filterYearLevelId, setFilterYearLevelId] = useState<number>(
    filteredYearLevels[0]?.id ?? 0,
  );
  useMemo(() => {
    if (filteredYearLevels.length)
      setFilterYearLevelId(filteredYearLevels[0].id);
  }, [filteredYearLevels]);

  const filteredStudents = useMemo(() => {
    return students.filter(
      (s) =>
        s.collegeId === filterCollegeId && s.yearLevelId === filterYearLevelId,
    );
  }, [students, filterCollegeId, filterYearLevelId]);

  const [referrals, setReferrals] = useState<Referral[]>(() =>
    load<Referral[]>(REF_KEY, []),
  );

  const visibleReferrals = useMemo(() => {
    return referrals
      .filter((r) => r.academicYearId === selectedAyId)
      .filter((r) => (filterCollegeId ? r.collegeId === filterCollegeId : true))
      .filter((r) =>
        filterYearLevelId ? r.yearLevelId === filterYearLevelId : true,
      )
      .sort((a, b) => (a.referredDate < b.referredDate ? 1 : -1));
  }, [referrals, selectedAyId, filterCollegeId, filterYearLevelId]);

  const labelUser = (id: number) => {
    const u = users.find((x) => x.id === id);
    if (!u) return "Unknown";
    const full = `${u.fname} ${u.mname ? u.mname + " " : ""}${u.lname}`;
    return `${full} (${u.email})`;
  };

  // ✅ Reasons list (multi-select)
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
  const [studentId, setStudentId] = useState<number>(
    filteredStudents[0]?.id ?? 0,
  );
  const [referredByUserId, setReferredByUserId] = useState<number>(
    staff[0]?.id ?? 0,
  );
  const [referredDate, setReferredDate] = useState("");
  const [selectedReasons, setSelectedReasons] = useState<string[]>([]);
  const [notes, setNotes] = useState("");

  useMemo(() => setStudentId(filteredStudents[0]?.id ?? 0), [filteredStudents]);

  const toggleReason = (r: string) => {
    setSelectedReasons((prev) =>
      prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r],
    );
  };

  const updateStatus = (id: number, status: Referral["status"]) => {
    const next = referrals.map((r) => (r.id === id ? { ...r, status } : r));
    setReferrals(next);
    save(REF_KEY, next);
  };

  const handleCreate = () => {
    if (
      !studentId ||
      !referredByUserId ||
      !referredDate ||
      selectedReasons.length === 0
    )
      return;

    const nextId = referrals.length
      ? Math.max(...referrals.map((r) => r.id)) + 1
      : 1;

    const newRef: Referral = {
      id: nextId,
      studentId,
      referredByUserId,
      academicYearId: selectedAyId,
      collegeId: filterCollegeId,
      yearLevelId: filterYearLevelId,
      referredDate,
      reason: selectedReasons.join(", "),
      notes: notes.trim() ? notes.trim() : undefined,
      status: "New",
      createdAt: new Date().toISOString().slice(0, 10),
    };

    const next = [newRef, ...referrals];
    setReferrals(next);
    save(REF_KEY, next);

    setReferredDate("");
    setSelectedReasons([]);
    setNotes("");
    setOpen(false);
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
          <div style={label}>Academic Year</div>
          <select
            value={selectedAyId}
            onChange={(e) => setSelectedAyId(Number(e.target.value))}
            style={inputStyle}
          >
            {years.map((ay) => (
              <option key={ay.id} value={ay.id}>
                {ay.name} {ay.isActive ? "(Active)" : ""}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: "grid", gap: 6 }}>
          <div style={label}>College</div>
          <select
            value={filterCollegeId}
            onChange={(e) => setFilterCollegeId(Number(e.target.value))}
            style={inputStyle}
          >
            {colleges.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: "grid", gap: 6 }}>
          <div style={label}>Year Level</div>
          <select
            value={filterYearLevelId}
            onChange={(e) => setFilterYearLevelId(Number(e.target.value))}
            style={inputStyle}
          >
            {filteredYearLevels.map((yl) => (
              <option key={yl.id} value={yl.id}>
                {yl.name}
              </option>
            ))}
          </select>
        </div>

        <button onClick={() => setOpen(true)} style={primaryButton}>
          + Create Referral
        </button>
      </div>

      <div style={card}>
        <h3 style={{ marginBottom: 10 }}>Referral List</h3>

        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={th}>Student</th>
              <th style={th}>Referred By</th>
              <th style={th}>Date</th>
              <th style={th}>Reason</th>
              <th style={th}>Status</th>
              <th style={th}></th>
            </tr>
          </thead>

          <tbody>
            {visibleReferrals.length === 0 ? (
              <tr>
                <td style={td} colSpan={6}>
                  <span style={{ opacity: 0.8 }}>
                    No referrals found for this filter.
                  </span>
                </td>
              </tr>
            ) : (
              visibleReferrals.map((r) => {
                const reasons = splitReasons(r.reason);
                const preview = reasons.slice(0, 2);
                const remaining = reasons.length - preview.length;

                return (
                  <tr key={r.id}>
                    <td style={td}>
                      <div style={{ fontWeight: 900 }}>
                        {labelUser(r.studentId)}
                      </div>
                      {r.notes && (
                        <div style={{ opacity: 0.8, fontSize: 13 }}>
                          {r.notes}
                        </div>
                      )}
                    </td>

                    <td style={td}>{labelUser(r.referredByUserId)}</td>

                    {/* ✅ Smaller Date */}
                    <td style={td}>
                      <div style={smallMuted}>
                        {formatDateShort(r.referredDate)}
                      </div>
                    </td>

                    {/* ✅ Clean Reason preview */}
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
                        {reasons.length === 0 && (
                          <span style={smallMuted}>—</span>
                        )}
                      </div>
                    </td>

                    <td style={td}>
                      <select
                        value={r.status}
                        onChange={(e) =>
                          updateStatus(
                            r.id,
                            e.target.value as Referral["status"],
                          )
                        }
                        style={inputStyle}
                      >
                        <option value="New">New</option>
                        <option value="Reviewed">Reviewed</option>
                        <option value="Closed">Closed</option>
                      </select>
                    </td>

                    <td style={td}>
                      <Link
                        to={`/app/referrals/${r.id}`}
                        style={{
                          textDecoration: "none",
                          color: "var(--primary)",
                          fontWeight: 900,
                        }}
                      >
                        View →
                      </Link>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Create Referral">
        <div style={{ display: "grid", gap: 12 }}>
          <div>
            <div style={label}>Student (filtered by College + Year Level)</div>
            <select
              value={studentId}
              onChange={(e) => setStudentId(Number(e.target.value))}
              style={inputStyle}
            >
              {filteredStudents.map((s) => (
                <option key={s.id} value={s.id}>
                  {`${s.fname} ${s.mname ? s.mname + " " : ""}${s.lname}`} (
                  {s.email})
                </option>
              ))}
            </select>
            {filteredStudents.length === 0 && (
              <div style={{ marginTop: 8, opacity: 0.8, fontSize: 13 }}>
                No students found in this College + Year Level. Add students in
                User Management.
              </div>
            )}
          </div>

          <div>
            <div style={label}>Referred By (Counselor/Admin)</div>
            <select
              value={referredByUserId}
              onChange={(e) => setReferredByUserId(Number(e.target.value))}
              style={inputStyle}
            >
              {staff.map((u) => (
                <option key={u.id} value={u.id}>
                  {`${u.fname} ${u.mname ? u.mname + " " : ""}${u.lname}`} (
                  {u.role})
                </option>
              ))}
            </select>
            {staff.length === 0 && (
              <div style={{ marginTop: 8, opacity: 0.8, fontSize: 13 }}>
                No counselor/admin users found. Add them in User Management.
              </div>
            )}
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
              disabled={filteredStudents.length === 0 || staff.length === 0}
              title={
                filteredStudents.length === 0
                  ? "No students found for this College + Year Level"
                  : staff.length === 0
                    ? "No counselor/admin users found"
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
    </div>
  );
}
