import logoUrl from "../assets/logo.png";

export type ReferralFormPrintPayload = {
  studentName: string;
  courseYearSection: string;
  reasons: string[];
  details?: string;
  previousInterventions?: string[];
  bestTimeFirstChoice?: string;
  bestTimeSecondChoice?: string;
  facultyStaffName: string;
  referralDate?: string;
};

const LEFT_REASONS = [
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
  "Others (Please specify.)",
];

const RIGHT_REASONS = [
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
];

const META_FIELD_RE = /^(name|type|college|course|notes)\s*:/i;

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizeReason(s: string): string {
  return String(s || "")
    .toLowerCase()
    .replace(/[\s/,-]+/g, " ")
    .trim();
}

function formatDate(iso?: string): string {
  if (!iso) return "";
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return iso;
  return dt.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function renderReasonRows(list: string[], selected: Set<string>): string {
  return list
    .map((reason) => {
      const checked = selected.has(normalizeReason(reason));
      return `
        <div class="reason-row">
          <span class="box">${checked ? "&#10003;" : ""}</span>
          <span>${escapeHtml(reason)}</span>
        </div>
      `;
    })
    .join("");
}

function detailsLines(text: string): string[] {
  const chunks = String(text || "")
    .split(/\r?\n|\|/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !META_FIELD_RE.test(line));

  if (chunks.length === 0) return ["", "", "", ""];
  return [...chunks.slice(0, 4), "", "", "", ""].slice(0, 4);
}

function interventionLines(values?: string[]): string[] {
  const clean = (values ?? []).map((x) => String(x || "").trim()).filter(Boolean);
  return [...clean.slice(0, 3), "", "", ""].slice(0, 3);
}

export function openReferralFormPrint(payload: ReferralFormPrintPayload): void {
  const w = window.open("", "_blank", "noopener,noreferrer,width=960,height=1180");
  if (!w) {
    alert("Could not open print window. Please allow pop-ups for this site.");
    return;
  }

  const selectedReasons = new Set(
    (payload.reasons ?? []).map((reason) => normalizeReason(reason)),
  );
  const details = detailsLines(payload.details ?? "");
  const interventions = interventionLines(payload.previousInterventions);
  const dateDisplay = formatDate(payload.referralDate);
  const logoSrc = String(logoUrl || "");

  const html = `
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Counseling Referral Form - Internal</title>
  <style>
    * { box-sizing: border-box; }
    @page { size: A4; margin: 14mm; }
    body {
      margin: 0;
      font-family: Arial, Helvetica, sans-serif;
      color: #111;
      background: #fff;
    }
    .paper {
      width: 100%;
      margin: 0 auto;
      border: 1px solid #222;
      padding: 16px 18px;
    }
    .head {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      align-items: start;
    }
    .head-left {
      display: grid;
      grid-template-columns: 84px 1fr;
      gap: 10px;
      align-items: start;
    }
    .head-left .logo-wrap {
      width: 84px;
      height: 84px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .head-left .logo-wrap img {
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
    }
    .head-left .gov { font-size: 13px; }
    .head-left .uni { font-weight: 800; font-size: 31px; line-height: 1.05; }
    .head-left .meta { font-size: 13px; line-height: 1.25; }
    .head-right {
      text-align: right;
      font-size: 12px;
      line-height: 1.2;
    }
    .title {
      margin: 14px 0 16px;
      text-align: center;
      font-size: 22px;
      font-weight: 800;
      letter-spacing: 0.2px;
    }
    .row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px;
      margin-bottom: 10px;
      font-size: 16px;
    }
    .line-field {
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 0;
    }
    .line {
      flex: 1;
      border-bottom: 1px solid #111;
      min-height: 22px;
      display: inline-flex;
      align-items: flex-end;
      font-size: 14px;
      padding: 0 3px 2px;
    }
    .section-label {
      margin: 10px 0 8px;
      font-size: 16px;
      font-weight: 700;
    }
    .reason-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 18px;
      margin-bottom: 12px;
    }
    .reason-row {
      display: grid;
      grid-template-columns: 22px 1fr;
      align-items: center;
      gap: 7px;
      min-height: 24px;
      font-size: 14px;
    }
    .box {
      width: 18px;
      height: 18px;
      border: 1px solid #111;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      font-weight: 700;
      line-height: 1;
    }
    .block {
      margin-top: 4px;
      margin-bottom: 10px;
    }
    .write-line {
      border-bottom: 1px solid #111;
      height: 24px;
      margin-top: 5px;
      font-size: 13px;
      padding: 3px 2px 0;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
    }
    .small {
      font-size: 14px;
    }
    .intervention-row {
      display: grid;
      grid-template-columns: 26px 1fr;
      gap: 8px;
      align-items: center;
      margin-top: 5px;
    }
    .time-row {
      display: grid;
      grid-template-columns: 110px 1fr;
      gap: 8px;
      align-items: center;
      margin-top: 5px;
    }
    .signature {
      margin-top: 22px;
      display: grid;
      grid-template-columns: 1fr 210px;
      gap: 16px;
      align-items: end;
    }
    .signature .sig-line,
    .signature .date-line {
      border-bottom: 1px solid #111;
      min-height: 24px;
      display: inline-flex;
      align-items: flex-end;
      padding: 0 3px 2px;
      font-size: 13px;
    }
    .signature .label {
      margin-top: 4px;
      font-size: 13px;
      text-align: center;
      font-weight: 700;
    }
    .print-note {
      margin-top: 12px;
      font-size: 11px;
      opacity: 0.75;
      text-align: right;
    }
    @media print {
      .paper { border: none; padding: 0; }
      .print-note { display: none; }
    }
  </style>
</head>
<body>
  <div class="paper">
    <div class="head">
      <div class="head-left">
        <div class="logo-wrap">
          <img src="${escapeHtml(logoSrc)}" alt="BISU Logo" />
        </div>
        <div>
          <div class="gov">Republic of the Philippines</div>
          <div class="uni">BOHOL ISLAND STATE UNIVERSITY</div>
          <div class="meta">Cagayan, Candijay, Bohol, 6312, Philippines</div>
          <div class="meta">Guidance and Counseling Services Center</div>
        </div>
      </div>
      <div class="head-right">
        Management System<br />
        ISO 9001:2015
      </div>
    </div>

    <div class="title">COUNSELING REFERRAL FORM - INTERNAL</div>

    <div class="row">
      <div class="line-field">
        <span>Name of Student</span>
        <span class="line">${escapeHtml(payload.studentName || "")}</span>
      </div>
      <div class="line-field">
        <span>Course / Year/Section:</span>
        <span class="line">${escapeHtml(payload.courseYearSection || "")}</span>
      </div>
    </div>

    <div class="section-label">Reason for Referral:</div>
    <div class="reason-grid">
      <div>${renderReasonRows(LEFT_REASONS, selectedReasons)}</div>
      <div>${renderReasonRows(RIGHT_REASONS, selectedReasons)}</div>
    </div>

    <div class="block">
      <div class="section-label small">Details:</div>
      <div class="write-line">${escapeHtml(details[0])}</div>
      <div class="write-line">${escapeHtml(details[1])}</div>
      <div class="write-line">${escapeHtml(details[2])}</div>
      <div class="write-line">${escapeHtml(details[3])}</div>
    </div>

    <div class="block">
      <div class="section-label small">Previous Interventions:</div>
      <div class="intervention-row"><span>1.</span><div class="write-line">${escapeHtml(interventions[0])}</div></div>
      <div class="intervention-row"><span>2.</span><div class="write-line">${escapeHtml(interventions[1])}</div></div>
      <div class="intervention-row"><span>3.</span><div class="write-line">${escapeHtml(interventions[2])}</div></div>
    </div>

    <div class="block">
      <div class="section-label small">Best Time To Meet the Student:</div>
      <div class="time-row"><span>1st Choice</span><div class="write-line">${escapeHtml(payload.bestTimeFirstChoice || "")}</div></div>
      <div class="time-row"><span>2nd Choice</span><div class="write-line">${escapeHtml(payload.bestTimeSecondChoice || "")}</div></div>
    </div>

    <div class="signature">
      <div>
        <div class="sig-line">${escapeHtml(payload.facultyStaffName || "")}</div>
        <div class="label">Name & Signature of Faculty/Staff</div>
      </div>
      <div>
        <div class="date-line">${escapeHtml(dateDisplay)}</div>
        <div class="label">Date</div>
      </div>
    </div>

    <div class="print-note">Use your browser's Print dialog and choose "Save as PDF" to download.</div>
  </div>
</body>
</html>
  `;

  w.document.open();
  w.document.write(html);
  w.document.close();

  w.focus();
  w.setTimeout(() => {
    try {
      w.print();
    } catch {
      // Ignore print invocation errors from restricted browsers.
    }
  }, 250);
}
