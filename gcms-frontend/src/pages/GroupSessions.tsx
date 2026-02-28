import { useEffect, useMemo, useRef, useState } from "react";
import { Printer } from "lucide-react";
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

type GroupSession = {
  id: number;
  academicYearId: number;
  collegeId: number;
  yearLevelId: number;

  counselorUserId: number;
  date: string;
  location: string;
  topic: string;
  notes?: string;
  attachment?: string;
  createdAt: string;
};

type GroupSessionMember = {
  id: number;
  groupSessionId: number;
  studentUserId: number;
};

const USERS_KEY = "gcms_mock_users_v1";
const COLLEGES_KEY = "gcms_mock_colleges_v1";
const YEARS_KEY = "gcms_mock_academic_years_v1";
const YL_KEY = "gcms_mock_year_levels_v1";
const GS_KEY = "gcms_mock_group_sessions_v1";
const GSM_KEY = "gcms_mock_group_session_members_v1";

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

export default function GroupSessions() {
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

  const counselors = useMemo(
    () => users.filter((u) => u.role === "COUNSELOR"),
    [users],
  );
  const students = useMemo(
    () => users.filter((u) => u.role === "STUDENT"),
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

  useEffect(() => {
    if (filteredYearLevels.length)
      setFilterYearLevelId(filteredYearLevels[0].id);
  }, [filteredYearLevels]);

  const [sessions, setSessions] = useState<GroupSession[]>(() =>
    load<GroupSession[]>(GS_KEY, []),
  );
  const [members, setMembers] = useState<GroupSessionMember[]>(() =>
    load<GroupSessionMember[]>(GSM_KEY, []),
  );

  const visibleSessions = useMemo(() => {
    return sessions
      .filter((s) => s.academicYearId === selectedAyId)
      .filter((s) => (filterCollegeId ? s.collegeId === filterCollegeId : true))
      .filter((s) =>
        filterYearLevelId ? s.yearLevelId === filterYearLevelId : true,
      )
      .sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [sessions, selectedAyId, filterCollegeId, filterYearLevelId]);

  const labelUser = (id: number) => {
    const u = users.find((x) => x.id === id);
    if (!u) return "Unknown";
    const full = `${u.fname} ${u.mname ? u.mname + " " : ""}${u.lname}`;
    return `${full} (${u.email})`;
  };

  const labelCollege = (id: number) =>
    colleges.find((c) => c.id === id)?.name ?? "—";
  const labelAy = (id: number) => years.find((y) => y.id === id)?.name ?? "—";
  const labelYL = (id: number) =>
    yearLevels.find((y) => y.id === id)?.name ?? "—";

  const memberCount = (sessionId: number) =>
    members.filter((m) => m.groupSessionId === sessionId).length;

  // ===== Create Session Modal State =====
  const [open, setOpen] = useState(false);

  const filteredStudents = useMemo(() => {
    return students.filter(
      (s) =>
        s.collegeId === filterCollegeId && s.yearLevelId === filterYearLevelId,
    );
  }, [students, filterCollegeId, filterYearLevelId]);

  const [counselorUserId, setCounselorUserId] = useState<number>(
    counselors[0]?.id ?? 0,
  );
  const [date, setDate] = useState("");
  const [location, setLocation] = useState("");
  const [topic, setTopic] = useState("");
  const [notes, setNotes] = useState("");
  const [attachment, setAttachment] = useState("");
  const [selectedStudentIds, setSelectedStudentIds] = useState<number[]>([]);

  useEffect(() => {
    setSelectedStudentIds([]);
  }, [filterCollegeId, filterYearLevelId, selectedAyId]);

  // ===== Refs for auto-scroll / focus =====
  const counselorRef = useRef<HTMLSelectElement | null>(null);
  const dateRef = useRef<HTMLInputElement | null>(null);
  const locationRef = useRef<HTMLInputElement | null>(null);
  const topicRef = useRef<HTMLInputElement | null>(null);
  const membersRef = useRef<HTMLDivElement | null>(null);

  const toggleStudent = (id: number) => {
    setSelectedStudentIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  // ✅ Live validation
  const missing: string[] = [];
  if (!counselorUserId) missing.push("Counselor");
  if (!date) missing.push("Date");
  if (!location.trim()) missing.push("Location");
  if (!topic.trim()) missing.push("Topic");
  if (selectedStudentIds.length === 0) missing.push("At least 1 Member");
  const canCreate = missing.length === 0;

  const focusAndScroll = (el: HTMLElement | null) => {
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    if ("focus" in el) (el as any).focus();
  };

  const scrollToFirstMissing = () => {
    if (!counselorUserId) return focusAndScroll(counselorRef.current);
    if (!date) return focusAndScroll(dateRef.current);
    if (!location.trim()) return focusAndScroll(locationRef.current);
    if (!topic.trim()) return focusAndScroll(topicRef.current);
    if (selectedStudentIds.length === 0)
      return focusAndScroll(membersRef.current);
  };

  const handleCreate = () => {
    // safety
    if (!canCreate) return;

    const nextId = sessions.length
      ? Math.max(...sessions.map((s) => s.id)) + 1
      : 1;

    const newSession: GroupSession = {
      id: nextId,
      academicYearId: selectedAyId,
      collegeId: filterCollegeId,
      yearLevelId: filterYearLevelId,
      counselorUserId,
      date,
      location: location.trim(),
      topic: topic.trim(),
      notes: notes.trim() ? notes.trim() : undefined,
      attachment: attachment.trim() ? attachment.trim() : undefined,
      createdAt: new Date().toISOString().slice(0, 10),
    };

    const nextSessions = [newSession, ...sessions];
    setSessions(nextSessions);
    save(GS_KEY, nextSessions);

    const nextMemberIdStart = members.length
      ? Math.max(...members.map((m) => m.id)) + 1
      : 1;

    const newMembers: GroupSessionMember[] = selectedStudentIds.map(
      (sid, idx) => ({
        id: nextMemberIdStart + idx,
        groupSessionId: nextId,
        studentUserId: sid,
      }),
    );

    const nextMembers = [...newMembers, ...members];
    setMembers(nextMembers);
    save(GSM_KEY, nextMembers);

    // reset
    setDate("");
    setLocation("");
    setTopic("");
    setNotes("");
    setAttachment("");
    setSelectedStudentIds([]);
    setOpen(false);
  };

  // ===== Call Slip Print =====
  const escapeHtml = (s: string) =>
    s
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");

  const fmtLongDate = (yyyy_mm_dd: string) => {
    const parts = yyyy_mm_dd.split("-");
    if (parts.length !== 3) return yyyy_mm_dd;
    const y = Number(parts[0]);
    const m = Number(parts[1]);
    const d = Number(parts[2]);
    if (!y || !m || !d) return yyyy_mm_dd;
    const months = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];
    return `${months[m - 1]} ${d}, ${y}`;
  };

  const openCallSlipPrint = (session: GroupSession) => {
    const sessionMembers = members
      .filter((m) => m.groupSessionId === session.id)
      .map((m) => users.find((u) => u.id === m.studentUserId))
      .filter(Boolean) as User[];

    const counselor = users.find((u) => u.id === session.counselorUserId);
    const counselorName = counselor
      ? `${counselor.fname} ${counselor.mname ? counselor.mname + " " : ""}${counselor.lname}`
      : "Guidance Counselor";

    const collegeName = labelCollege(session.collegeId);
    const ylName = labelYL(session.yearLevelId);
    const courseYear = `${collegeName} • ${ylName}`;

    const chunkSize = 10;
    const chunks: User[][] = [];
    for (let i = 0; i < sessionMembers.length; i += chunkSize) {
      chunks.push(sessionMembers.slice(i, i + chunkSize));
    }
    if (chunks.length === 0) chunks.push([]);

    const dateIssued = fmtLongDate(new Date().toISOString().slice(0, 10));
    const scheduleText = `${fmtLongDate(session.date)} (see counselor)`;
    const reasonText = session.topic;

    const pages = chunks
      .map((chunk) => {
        const rows = chunk
          .map((s) => {
            const full = `${s.fname} ${s.mname ? s.mname + " " : ""}${s.lname}`;
            return `
              <tr>
                <td>${escapeHtml(full)}</td>
                <td style="text-align:center;">${escapeHtml(courseYear)}</td>
              </tr>
            `;
          })
          .join("");

        return `
          <div class="page">
            <div class="grid">
              <div class="card">
                <div class="header">
                  <div class="uni">BOHOL ISLAND STATE UNIVERSITY</div>
                  <div class="office">Guidance and Counseling Services Center</div>
                </div>

                <div class="title">CALL SLIP – GUIDANCE</div>

                <div class="meta">
                  <div>To: <span class="line"></span></div>
                  <div>Date: <b>${escapeHtml(dateIssued)}</b></div>
                </div>

                <div class="para">
                  Please see your guidance counselor at the Guidance and Counseling Services Center on
                  <b>${escapeHtml(scheduleText)}</b>. This is in connection with
                  <b>${escapeHtml(reasonText)}</b>.
                  <br/>Please bring this paper with you upon your visit. See you!
                </div>

                <table>
                  <thead>
                    <tr>
                      <th>Student's Name</th>
                      <th style="text-align:center;">Course &amp; Year</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${rows || `<tr><td colspan="2" style="opacity:.7">No members.</td></tr>`}
                  </tbody>
                </table>

                <div class="conf">CONFIDENTIAL</div>

                <div class="sig">
                  <div class="name">
                    ${escapeHtml(counselorName)}
                    <div style="font-size:11px; opacity:.8">Guidance Counselor</div>
                  </div>
                </div>

                <div class="foot">
                  <div>GCMS • Call Slip</div>
                  <div>Page 1 of 2</div>
                </div>
              </div>

              <div class="card appearance">
                <div class="header">
                  <div class="uni">BOHOL ISLAND STATE UNIVERSITY</div>
                  <div class="office">Guidance and Counseling Services Center</div>
                </div>

                <div class="title">CALL SLIP – GUIDANCE</div>
                <div class="subtitle">APPEARANCE</div>

                <div class="meta">
                  <div>To: <span class="line"></span></div>
                  <div>Date: <span class="line"></span></div>
                </div>

                <div class="meta">
                  <div>Time Started: <span class="line"></span></div>
                  <div>Time Ended: <span class="line"></span></div>
                </div>

                <div class="para">
                  This is to certify that <span class="line" style="min-width:260px;"></span>
                  has visited the Guidance Office last <span class="line" style="min-width:140px;"></span>
                  per referral of <span class="line" style="min-width:180px;"></span>.
                </div>

                <div class="para" style="margin-top:14px;">
                  Remarks:
                </div>
                <div class="ln"></div>
                <div class="ln"></div>
                <div class="ln"></div>

                <div class="sig" style="margin-top:24px;">
                  <div class="name">Name and Signature of Guidance Counselor</div>
                </div>

                <div class="foot">
                  <div>GCMS • Appearance</div>
                  <div>Page 2 of 2</div>
                </div>
              </div>
            </div>
          </div>
        `;
      })
      .join("");

    const html = `
<!doctype html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Call Slip - Guidance</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; margin: 0; padding: 14px; color: #111; }
    .page { margin-bottom: 14px; page-break-after: always; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .card { border: 2px solid #222; padding: 12px; border-radius: 6px; background: #fff; }
    .header { text-align: center; line-height: 1.2; }
    .uni { font-weight: 800; font-size: 12px; }
    .office { font-size: 11px; margin-top: 2px; }
    .title { text-align: center; font-weight: 900; margin: 10px 0 6px; }
    .subtitle { text-align: center; font-weight: 800; margin-top: 0; font-size: 12px; }
    .meta { display: flex; justify-content: space-between; gap: 10px; font-size: 12px; margin: 8px 0; }
    .line { border-bottom: 1px solid #333; min-width: 140px; display: inline-block; height: 14px; vertical-align: baseline; }
    .para { font-size: 12px; line-height: 1.35; margin: 10px 0; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    th, td { border: 1px solid #333; padding: 6px; font-size: 12px; }
    th { background: #f3f3f3; text-align: left; }
    .conf { font-size: 11px; font-weight: 800; margin-top: 10px; }
    .sig { margin-top: 16px; display: flex; justify-content: center; }
    .sig .name { border-top: 1px solid #111; padding-top: 6px; width: 80%; text-align: center; font-size: 12px; }
    .foot { font-size: 10px; margin-top: 6px; opacity: 0.85; display: flex; justify-content: space-between; }
    .appearance .ln { border-bottom: 1px solid #333; height: 18px; margin: 10px 0; }
    @media print {
      body { padding: 0; }
      .page { margin: 0; }
    }
  </style>
</head>
<body>
  ${pages}
  <script>
    window.onload = () => { window.print(); };
  </script>
</body>
</html>
    `;

    const w = window.open("", "_blank");
    if (!w) return;
    w.document.open();
    w.document.write(html);
    w.document.close();
  };

  // ===== Styles =====
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
  };

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {/* Header + Filters */}
      <div
        style={{
          display: "flex",
          gap: 12,
          alignItems: "flex-end",
          flexWrap: "wrap",
        }}
      >
        <h2 style={{ fontWeight: 800, marginRight: "auto" }}>Group Sessions</h2>

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
          + Create Session
        </button>
      </div>

      {/* List */}
      <div style={card}>
        <h3 style={{ marginBottom: 10 }}>Session List</h3>

        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={th}>Topic</th>
              <th style={th}>Date</th>
              <th style={th}>Counselor</th>
              <th style={th}>Members</th>
              <th style={th}>College / Year</th>
              <th style={th}></th>
            </tr>
          </thead>
          <tbody>
            {visibleSessions.length === 0 ? (
              <tr>
                <td style={td} colSpan={6}>
                  <span style={{ opacity: 0.8 }}>
                    No group sessions found for this filter.
                  </span>
                </td>
              </tr>
            ) : (
              visibleSessions.map((s) => (
                <tr key={s.id}>
                  <td style={td}>
                    <div style={{ fontWeight: 900 }}>{s.topic}</div>
                    <div style={{ opacity: 0.8, fontSize: 13 }}>
                      {s.location}
                    </div>
                  </td>
                  <td style={td}>{s.date}</td>
                  <td style={td}>{labelUser(s.counselorUserId)}</td>
                  <td style={td}>
                    <b>{memberCount(s.id)}</b>
                  </td>
                  <td style={td}>
                    <div style={{ fontWeight: 800 }}>
                      {labelCollege(s.collegeId)}
                    </div>
                    <div style={{ opacity: 0.8, fontSize: 13 }}>
                      {labelAy(s.academicYearId)} • {labelYL(s.yearLevelId)}
                    </div>
                  </td>
                  <td style={td}>
                    <button
                      style={iconButton}
                      title="Print Call Slip"
                      onClick={() => openCallSlipPrint(s)}
                    >
                      <Printer size={18} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Create Modal */}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Create Group Session"
      >
        <div style={{ display: "grid", gap: 12 }}>
          {/* 🔴 Live validation reminder */}
          {!canCreate && (
            <div
              style={{
                border: "1px solid rgba(217,83,79,0.35)",
                background: "rgba(217,83,79,0.10)",
                color: "#b42318",
                padding: "10px 12px",
                borderRadius: 12,
                fontWeight: 800,
                fontSize: 13,
                display: "flex",
                gap: 10,
                alignItems: "flex-start",
              }}
            >
              <span style={{ fontSize: 16, lineHeight: "16px" }}>⚠️</span>
              <div>
                <div style={{ fontWeight: 900 }}>
                  Before you can create a session:
                </div>
                <div style={{ marginTop: 4 }}>
                  Missing: <b>{missing.join(", ")}</b>
                </div>
                <div style={{ marginTop: 6, opacity: 0.9, fontWeight: 700 }}>
                  Click <b>Create</b> and we’ll jump to the first missing field.
                </div>
              </div>
            </div>
          )}

          <div>
            <div style={label}>Counselor</div>
            <select
              ref={counselorRef}
              value={counselorUserId}
              onChange={(e) => setCounselorUserId(Number(e.target.value))}
              style={inputStyle}
            >
              {counselors.map((c) => (
                <option key={c.id} value={c.id}>
                  {`${c.fname} ${c.mname ? c.mname + " " : ""}${c.lname}`} (
                  {c.email})
                </option>
              ))}
            </select>
            {counselors.length === 0 && (
              <div style={{ marginTop: 8, opacity: 0.8, fontSize: 13 }}>
                No counselors found. Add counselor users in User Management.
              </div>
            )}
          </div>

          <div
            style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr" }}
          >
            <div>
              <div style={label}>Date</div>
              <input
                ref={dateRef}
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                style={inputStyle}
              />
            </div>

            <div>
              <div style={label}>Location</div>
              <input
                ref={locationRef}
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g., Guidance Office"
                style={inputStyle}
              />
            </div>
          </div>

          <div>
            <div style={label}>Topic</div>
            <input
              ref={topicRef}
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g., Stress Management"
              style={inputStyle}
            />
          </div>

          <div>
            <div style={label}>Attachment (optional)</div>
            <input
              value={attachment}
              onChange={(e) => setAttachment(e.target.value)}
              placeholder="filename or link (mock)"
              style={inputStyle}
            />
          </div>

          <div>
            <div style={label}>Notes (optional)</div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              style={textareaStyle}
            />
          </div>

          <div>
            <div style={label}>
              Members (Students filtered by College + Year Level)
            </div>

            <div
              ref={membersRef}
              style={{
                border: "1px solid var(--border)",
                borderRadius: 12,
                padding: 10,
                maxHeight: 220,
                overflow: "auto",
                background: "rgba(255,255,255,0.6)",
              }}
            >
              {filteredStudents.length === 0 ? (
                <div style={{ opacity: 0.8, fontSize: 13 }}>
                  No students found in this College + Year Level. Add students
                  in User Management.
                </div>
              ) : (
                filteredStudents.map((s) => {
                  const checked = selectedStudentIds.includes(s.id);
                  const full = `${s.fname} ${s.mname ? s.mname + " " : ""}${s.lname}`;
                  return (
                    <label
                      key={s.id}
                      style={{
                        display: "flex",
                        gap: 10,
                        alignItems: "center",
                        padding: "6px 4px",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleStudent(s.id)}
                      />
                      <span style={{ fontWeight: 800 }}>{full}</span>
                      <span style={{ opacity: 0.8 }}>({s.email})</span>
                    </label>
                  );
                })
              )}
            </div>

            <div
              style={{
                marginTop: 10,
                padding: "8px 10px",
                borderRadius: 12,
                border: "1px solid var(--border)",
                background: "rgba(255,255,255,0.7)",
                fontSize: 13,
                fontWeight: 900,
                display: "inline-flex",
                gap: 8,
                alignItems: "center",
                width: "fit-content",
              }}
            >
              ✅ Selected Members:{" "}
              <span style={{ fontSize: 14 }}>{selectedStudentIds.length}</span>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              gap: 10,
              justifyContent: "flex-end",
              position: "sticky",
              bottom: 0,
              paddingTop: 12,
              background:
                "linear-gradient(180deg, rgba(255,255,255,0) 0%, var(--card) 40%)",
            }}
          >
            <button onClick={() => setOpen(false)} style={ghostButton}>
              Cancel
            </button>

            <button
              onClick={() => {
                if (!canCreate) {
                  scrollToFirstMissing();
                  return;
                }
                handleCreate();
              }}
              style={{
                ...primaryButton,
                opacity: canCreate ? 1 : 0.75,
              }}
              title={
                !canCreate ? `Missing: ${missing.join(", ")}` : "Create session"
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
