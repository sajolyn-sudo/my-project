import logoUrl from "../assets/logo.png";

export type StudentCircleAttendanceReportRow = {
  studentName: string;
  courseName: string;
  yearLevelName: string;
  phoneNumber?: string;
  email?: string;
  status: "Present" | "Absent" | "Present (not in member list)";
  submittedAt?: string;
  signatureData?: string;
  signatureSource?: string;
};

export type StudentCircleAttendanceReportPayload = {
  sessionId: number;
  topic: string;
  date: string;
  time?: string | null;
  location: string;
  facilitator?: string | null;
  academicYearName: string;
  collegeName: string;
  courseName: string;
  yearLevelName: string;
  expectedCount: number;
  presentCount: number;
  absentCount: number;
  extraSubmissionCount: number;
  rows: StudentCircleAttendanceReportRow[];
};

function escapeHtml(value: string): string {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatLongDate(value?: string | null): string {
  if (!value) return "-";
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T00:00:00`)
    : new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatDateTime(value?: string | null): string {
  if (!value) return "-";
  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatTime(value?: string | null): string {
  if (!value) return "-";
  const [hourPart, minutePart] = String(value).split(":");
  const hours = Number(hourPart);
  const minutes = Number(minutePart);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return String(value);
  const suffix = hours >= 12 ? "PM" : "AM";
  const displayHour = hours % 12 || 12;
  return `${displayHour}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

function buildStudentCircleAttendanceReportHtml(
  payload: StudentCircleAttendanceReportPayload,
  includePrintScript = true,
): string {
  const generatedAt = formatDateTime(new Date().toISOString());
  const scheduleText = `${formatLongDate(payload.date)} / ${formatTime(payload.time)}`;
  const rowsHtml = payload.rows
    .map((row, index) => {
      const isAbsent = row.status === "Absent";
      const statusClass = isAbsent ? "absent" : "present";
      const signatureHtml = row.signatureData
        ? `<img class="signature" src="${row.signatureData}" alt="Signature of ${escapeHtml(row.studentName)}" />
           <div class="signature-source">${escapeHtml(String(row.signatureSource || "").toLowerCase())}</div>`
        : "-";

      return `
        <tr class="${isAbsent ? "is-absent" : ""}">
          <td class="num">${index + 1}</td>
          <td>${escapeHtml(row.studentName || "-")}</td>
          <td>${escapeHtml(row.courseName || "-")}</td>
          <td>${escapeHtml(row.yearLevelName || "-")}</td>
          <td>${escapeHtml(row.phoneNumber || "-")}</td>
          <td>${escapeHtml(row.email || "-")}</td>
          <td><span class="status ${statusClass}">${escapeHtml(row.status)}</span></td>
          <td>${escapeHtml(formatDateTime(row.submittedAt))}</td>
          <td>${signatureHtml}</td>
        </tr>
      `;
    })
    .join("");

  const html = `
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Group Counselling Attendance Report #${escapeHtml(String(payload.sessionId))}</title>
  <style>
    * { box-sizing: border-box; }
    @page { size: A4 landscape; margin: 12mm; }
    body {
      margin: 0;
      font-family: Arial, Helvetica, sans-serif;
      color: #111;
      background: #fff;
    }
    .page { width: 100%; }
    .header {
      display: grid;
      grid-template-columns: 72px 1fr 72px;
      gap: 14px;
      align-items: center;
      text-align: center;
      border-bottom: 2px solid #111;
      padding-bottom: 10px;
      margin-bottom: 12px;
    }
    .logo { width: 70px; height: 70px; object-fit: contain; }
    .republic { font-size: 11px; font-weight: 700; }
    .university { font-size: 17px; font-weight: 900; letter-spacing: 0.3px; }
    .office { font-size: 12px; font-weight: 800; margin-top: 2px; }
    .title { font-size: 15px; font-weight: 900; margin-top: 7px; text-transform: uppercase; }
    .meta-grid {
      display: grid;
      grid-template-columns: 1.4fr 1fr 1fr 1fr;
      border: 1px solid #333;
      margin-bottom: 10px;
    }
    .meta-cell {
      min-height: 42px;
      padding: 7px 9px;
      border-right: 1px solid #333;
      border-bottom: 1px solid #333;
      font-size: 11px;
    }
    .meta-cell:nth-child(4n) { border-right: 0; }
    .meta-label {
      display: block;
      font-size: 9px;
      font-weight: 900;
      text-transform: uppercase;
      color: #444;
      margin-bottom: 3px;
    }
    .meta-value { font-weight: 800; }
    .summary {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
      margin: 9px 0 12px;
    }
    .summary-item {
      border: 1px solid #333;
      padding: 7px 9px;
      font-size: 11px;
      font-weight: 900;
    }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    th, td {
      border: 1px solid #333;
      padding: 5px 6px;
      font-size: 10px;
      vertical-align: top;
      overflow-wrap: anywhere;
    }
    th { background: #efefef; text-align: left; font-size: 9px; text-transform: uppercase; }
    .num { width: 28px; text-align: center; }
    .status {
      display: inline-block;
      padding: 3px 6px;
      border-radius: 999px;
      font-size: 9px;
      font-weight: 900;
      border: 1px solid #333;
      white-space: nowrap;
    }
    .present { background: #dcfce7; }
    .absent { background: #fee2e2; }
    .is-absent td { background: #fff7f7; }
    .signature { width: 88px; height: 34px; object-fit: contain; display: block; margin-bottom: 2px; }
    .signature-source { font-size: 8px; text-transform: uppercase; color: #555; }
    .footer {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      margin-top: 10px;
      font-size: 9px;
      color: #444;
    }
    .print-note {
      margin-top: 10px;
      text-align: center;
      font-size: 10px;
      color: #555;
    }
    @media print {
      .print-note { display: none; }
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="header">
      <img class="logo" src="${logoUrl}" alt="BISU logo" />
      <div>
        <div class="republic">Republic of the Philippines</div>
        <div class="university">BOHOL ISLAND STATE UNIVERSITY</div>
        <div class="office">Guidance and Counseling Services Center</div>
        <div class="title">Group Counselling Attendance Report</div>
      </div>
      <div></div>
    </div>

    <div class="meta-grid">
      <div class="meta-cell"><span class="meta-label">Group Counselling</span><span class="meta-value">${escapeHtml(payload.topic || "Group Counselling")}</span></div>
      <div class="meta-cell"><span class="meta-label">Schedule</span><span class="meta-value">${escapeHtml(scheduleText)}</span></div>
      <div class="meta-cell"><span class="meta-label">Location</span><span class="meta-value">${escapeHtml(payload.location || "-")}</span></div>
      <div class="meta-cell"><span class="meta-label">Facilitator</span><span class="meta-value">${escapeHtml(payload.facilitator || "-")}</span></div>
      <div class="meta-cell"><span class="meta-label">Academic Year</span><span class="meta-value">${escapeHtml(payload.academicYearName || "-")}</span></div>
      <div class="meta-cell"><span class="meta-label">College</span><span class="meta-value">${escapeHtml(payload.collegeName || "-")}</span></div>
      <div class="meta-cell"><span class="meta-label">Course</span><span class="meta-value">${escapeHtml(payload.courseName || "-")}</span></div>
      <div class="meta-cell"><span class="meta-label">Year Level</span><span class="meta-value">${escapeHtml(payload.yearLevelName || "-")}</span></div>
    </div>

    <div class="summary">
      <div class="summary-item">Expected Students: ${escapeHtml(String(payload.expectedCount))}</div>
      <div class="summary-item">Present: ${escapeHtml(String(payload.presentCount))}</div>
      <div class="summary-item">Absent: ${escapeHtml(String(payload.absentCount))}</div>
      <div class="summary-item">Extra Submissions: ${escapeHtml(String(payload.extraSubmissionCount))}</div>
    </div>

    <table>
      <thead>
        <tr>
          <th style="width:30px;">#</th>
          <th style="width:15%;">Student</th>
          <th style="width:14%;">Course</th>
          <th style="width:10%;">Year Level</th>
          <th style="width:10%;">Phone</th>
          <th style="width:16%;">Email</th>
          <th style="width:12%;">Status</th>
          <th style="width:13%;">Submitted</th>
          <th style="width:10%;">Signature</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml || `<tr><td colspan="9" style="text-align:center; padding:18px;">No students found for this report.</td></tr>`}
      </tbody>
    </table>

    <div class="footer">
      <div>GCMS - Group Counselling Attendance Report #${escapeHtml(String(payload.sessionId))}</div>
      <div>Generated: ${escapeHtml(generatedAt)}</div>
    </div>
    <div class="print-note">Use the Print dialog to print this report or choose Save as PDF to download it.</div>
  </div>
  ${includePrintScript ? `<script>
    window.onload = () => { window.print(); };
  </script>` : ""}
</body>
</html>
  `;

  return html;
}

export function openStudentCircleAttendanceReportPrint(
  payload: StudentCircleAttendanceReportPayload,
): void {
  const html = buildStudentCircleAttendanceReportHtml(payload, true);
  const w = window.open("", "_blank", "noopener,noreferrer,width=1120,height=780");
  if (!w) {
    alert("Could not open the attendance report. Please allow pop-ups for this site.");
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
}

export function downloadStudentCircleAttendanceReportWord(
  payload: StudentCircleAttendanceReportPayload,
): void {
  const html = buildStudentCircleAttendanceReportHtml(payload, false);
  const slug = `group-counselling-attendance-report-${payload.sessionId}`;
  const blob = new Blob(["\ufeff", html], {
    type: "application/msword;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${slug}.doc`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 500);
}
