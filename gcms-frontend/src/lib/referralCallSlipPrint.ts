export type ReferralCallSlipPrintPayload = {
  referralId: number;
  studentName: string;
  studentEmail?: string;
  courseYearSection?: string;
  scheduleDate: string;
  scheduleTime: string;
  reason: string;
  referredByName: string;
  issuedDate?: string;
};

function escapeHtml(value: string): string {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatLongDate(value?: string): string {
  if (!value) return "-";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T00:00:00`)
    : new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatTime(value?: string): string {
  if (!value) return "-";
  const [hourPart, minutePart] = String(value).split(":");
  const hours = Number(hourPart);
  const minutes = Number(minutePart);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return value;
  const suffix = hours >= 12 ? "PM" : "AM";
  const displayHour = hours % 12 || 12;
  return `${displayHour}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

export function canPrintReferralCallSlip(referral: {
  status?: string;
  referredDate?: string | null;
  referredTime?: string | null;
}): boolean {
  const status = String(referral.status || "").toLowerCase();
  const approved = status === "approved" || status === "complete";
  return Boolean(
    approved &&
      String(referral.referredDate || "").trim() &&
      String(referral.referredTime || "").trim(),
  );
}

function slugify(value: string): string {
  const clean = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return clean || "student";
}

function buildReferralCallSlipHtml(
  payload: ReferralCallSlipPrintPayload,
  includePrintScript: boolean,
): string {
  const scheduleText = `${formatLongDate(payload.scheduleDate)} - ${formatTime(
    payload.scheduleTime,
  )}`;
  const issuedDate = formatLongDate(
    payload.issuedDate || new Date().toISOString().slice(0, 10),
  );
  const studentName = payload.studentName || "Student";
  const courseYear = payload.courseYearSection || "-";
  const reasonText = payload.reason || "guidance referral";
  const referredByName = payload.referredByName || "Guidance Office";

  const html = `
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Call Slip - Referral #${escapeHtml(String(payload.referralId))}</title>
  <style>
    * { box-sizing: border-box; }
    @page { size: A4; margin: 14mm; }
    body {
      margin: 0;
      padding: 14px;
      font-family: Arial, Helvetica, sans-serif;
      color: #111;
      background: #fff;
    }
    .page { max-width: 920px; margin: 0 auto; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .card {
      min-height: 430px;
      border: 2px solid #222;
      border-radius: 6px;
      padding: 12px;
      background: #fff;
    }
    .header { text-align: center; line-height: 1.2; }
    .uni { font-weight: 800; font-size: 12px; }
    .office { font-size: 11px; margin-top: 2px; }
    .title { text-align: center; font-weight: 900; margin: 10px 0 6px; }
    .subtitle { text-align: center; font-weight: 800; margin-top: 0; font-size: 12px; }
    .meta { display: flex; justify-content: space-between; gap: 10px; font-size: 12px; margin: 8px 0; }
    .line { border-bottom: 1px solid #333; min-width: 140px; display: inline-block; height: 14px; vertical-align: baseline; }
    .para { font-size: 12px; line-height: 1.35; margin: 10px 0; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    th, td { border: 1px solid #333; padding: 6px; font-size: 12px; vertical-align: top; }
    th { background: #f3f3f3; text-align: left; }
    .muted { color: #555; font-size: 10px; }
    .conf { font-size: 11px; font-weight: 800; margin-top: 10px; }
    .sig { margin-top: 16px; display: flex; justify-content: center; }
    .sig .name { border-top: 1px solid #111; padding-top: 6px; width: 80%; text-align: center; font-size: 12px; }
    .foot { font-size: 10px; margin-top: 6px; opacity: 0.85; display: flex; justify-content: space-between; }
    .appearance .ln { border-bottom: 1px solid #333; height: 18px; margin: 10px 0; }
    .print-note { margin-top: 12px; font-size: 11px; color: #555; text-align: center; }
    @media print {
      body { padding: 0; }
      .print-note { display: none; }
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="grid">
      <div class="card">
        <div class="header">
          <div class="uni">BOHOL ISLAND STATE UNIVERSITY</div>
          <div class="office">Guidance and Counseling Services Center</div>
        </div>

        <div class="title">CALL SLIP - GUIDANCE</div>

        <div class="meta">
          <div>To: <span class="line"></span></div>
          <div>Date: <b>${escapeHtml(issuedDate)}</b></div>
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
            <tr>
              <td>
                ${escapeHtml(studentName)}
                ${
                  payload.studentEmail
                    ? `<br /><span class="muted">${escapeHtml(payload.studentEmail)}</span>`
                    : ""
                }
              </td>
              <td style="text-align:center;">${escapeHtml(courseYear)}</td>
            </tr>
          </tbody>
        </table>

        <div class="conf">CONFIDENTIAL</div>

        <div class="sig">
          <div class="name">Guidance Counselor</div>
        </div>

        <div class="foot">
          <div>GCMS - Call Slip</div>
          <div>Referral #${escapeHtml(String(payload.referralId))}</div>
        </div>
      </div>

      <div class="card appearance">
        <div class="header">
          <div class="uni">BOHOL ISLAND STATE UNIVERSITY</div>
          <div class="office">Guidance and Counseling Services Center</div>
        </div>

        <div class="title">CALL SLIP - GUIDANCE</div>
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

        <div class="para" style="margin-top:14px;">Remarks:</div>
        <div class="ln"></div>
        <div class="ln"></div>
        <div class="ln"></div>

        <div class="sig" style="margin-top:24px;">
          <div class="name">Name and Signature of Guidance Counselor</div>
        </div>

        <div class="foot">
          <div>GCMS - Appearance</div>
          <div>Referred by: ${escapeHtml(referredByName)}</div>
        </div>
      </div>
    </div>
    ${
      includePrintScript
        ? `<div class="print-note">Use the Print dialog to print this call slip or choose Save as PDF to download it.</div>`
        : ""
    }
  </div>
  ${
    includePrintScript
      ? `<script>
    window.onload = () => { window.print(); };
  </script>`
      : ""
  }
</body>
</html>
  `;

  return html;
}

export function openReferralCallSlipPrint(
  payload: ReferralCallSlipPrintPayload,
): void {
  const html = buildReferralCallSlipHtml(payload, true);
  const w = window.open("", "_blank", "noopener,noreferrer,width=980,height=760");
  if (!w) {
    alert("Could not open the call slip window. Please allow pop-ups for this site.");
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
}

export function downloadReferralCallSlipWord(
  payload: ReferralCallSlipPrintPayload,
): void {
  const html = buildReferralCallSlipHtml(payload, false);
  const studentSlug = slugify(payload.studentName);
  const blob = new Blob(["\ufeff", html], {
    type: "application/msword;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `referral-${payload.referralId}-call-slip-${studentSlug}.doc`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
