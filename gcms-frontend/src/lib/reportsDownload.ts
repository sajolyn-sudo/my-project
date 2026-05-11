import logoUrl from "../assets/logo.png";

export type ReportDownloadRow = {
  type?: string;
  subject?: string;
  detail?: string;
  status?: string;
  facilitator: string;
  location: string;
  date: string;
  time: string;
  members: number;
  course: string;
  college: string;
  academicYear: string;
  yearLevel: string;
};

export type ReportDownloadPayload = {
  title: string;
  subtitle?: string;
  generatedAt?: string;
  rows: ReportDownloadRow[];
};

function escapeHtml(value: string): string {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function slugify(value: string): string {
  const clean = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return clean || "report";
}

function formatGeneratedAt(value?: string): string {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return value || "";
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function buildReportsHtml(payload: ReportDownloadPayload): string {
  const generatedAt = formatGeneratedAt(payload.generatedAt);
  const rowsHtml = payload.rows
    .map(
      (row, index) => `
        <tr>
          <td class="num">${index + 1}</td>
          <td>${escapeHtml(row.type || "Report")}</td>
          <td>${escapeHtml(row.subject || row.facilitator || "-")}</td>
          <td>${escapeHtml(row.detail || row.location || "-")}</td>
          <td>${escapeHtml(row.date || "-")}</td>
          <td>${escapeHtml(row.time || "-")}</td>
          <td class="center">${escapeHtml(row.status || String(row.members ?? 0))}</td>
          <td>${escapeHtml(row.course || "-")}</td>
          <td>
            <strong>${escapeHtml(row.college || "-")}</strong><br />
            <span>${escapeHtml(row.academicYear || "-")} / ${escapeHtml(row.yearLevel || "-")}</span>
          </td>
        </tr>
      `,
    )
    .join("");

  return `
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(payload.title)}</title>
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
      grid-template-columns: 70px 1fr 70px;
      gap: 14px;
      align-items: center;
      text-align: center;
      border-bottom: 2px solid #111;
      padding-bottom: 10px;
      margin-bottom: 14px;
    }
    .logo { width: 68px; height: 68px; object-fit: contain; }
    .republic { font-size: 11px; font-weight: 700; }
    .university { font-size: 17px; font-weight: 900; letter-spacing: 0.3px; }
    .office { font-size: 12px; font-weight: 800; margin-top: 2px; }
    .title { font-size: 15px; font-weight: 900; margin-top: 7px; text-transform: uppercase; }
    .subtitle {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      font-size: 11px;
      margin-bottom: 10px;
      color: #333;
      font-weight: 700;
    }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    th, td {
      border: 1px solid #333;
      padding: 7px 8px;
      font-size: 11px;
      vertical-align: top;
      overflow-wrap: anywhere;
    }
    th {
      background: #efefef;
      text-align: left;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.2px;
    }
    .num { width: 34px; text-align: center; }
    .center { text-align: center; font-weight: 900; }
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
        <div class="title">${escapeHtml(payload.title)}</div>
      </div>
      <div></div>
    </div>

    <div class="subtitle">
      <div>${escapeHtml(payload.subtitle || "Group Counselling Reports")}</div>
      <div>Generated: ${escapeHtml(generatedAt)}</div>
    </div>

    <table>
      <thead>
        <tr>
          <th style="width:34px;">#</th>
          <th style="width:13%;">Type</th>
          <th style="width:15%;">Name / Facilitator</th>
          <th style="width:18%;">Details</th>
          <th style="width:11%;">Date</th>
          <th style="width:9%;">Time</th>
          <th style="width:10%;">Status</th>
          <th style="width:18%;">Course</th>
          <th style="width:16%;">College / Year</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml || `<tr><td colspan="8" style="text-align:center; padding:18px;">No report rows available.</td></tr>`}
      </tbody>
    </table>

    <div class="footer">
      <div>GCMS - Reports</div>
      <div>Total Rows: ${escapeHtml(String(payload.rows.length))}</div>
    </div>
    <div class="print-note">Use the Print dialog to print this report or choose Save as PDF to download it.</div>
  </div>
  <script>
    window.onload = () => { window.print(); };
  </script>
</body>
</html>
  `;
}

export function openReportsPdfPrint(payload: ReportDownloadPayload): void {
  const html = buildReportsHtml(payload);
  const w = window.open("", "_blank", "noopener,noreferrer,width=1120,height=780");
  if (!w) {
    alert("Could not open the report window. Please allow pop-ups for this site.");
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
}

export function downloadReportsWord(payload: ReportDownloadPayload): void {
  const html = buildReportsHtml(payload).replace(
    "<script>\n    window.onload = () => { window.print(); };\n  </script>",
    "",
  );
  const blob = new Blob(["\ufeff", html], {
    type: "application/msword;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${slugify(payload.title)}.doc`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 500);
}
