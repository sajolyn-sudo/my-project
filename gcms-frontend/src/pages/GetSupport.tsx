import React, { useMemo, useState } from "react";
import Modal from "../components/Modal";

const pageWrap: React.CSSProperties = {
  padding: 24,
  maxWidth: 1120,
};

const headerTitle: React.CSSProperties = {
  margin: 0,
  fontSize: 30,
  color: "#0f172a",
};

const headerSub: React.CSSProperties = {
  margin: "6px 0 0",
  color: "#64748b",
  fontWeight: 650,
};

const card: React.CSSProperties = {
  background: "rgba(255,255,255,0.92)",
  border: "1px solid rgba(15,23,42,0.08)",
  borderRadius: 16,
  boxShadow: "0 18px 50px rgba(2,6,23,0.10)",
  padding: 16,
};

const sectionLabel: React.CSSProperties = {
  fontWeight: 900,
  letterSpacing: 0.4,
  color: "#0f172a",
  fontSize: 12,
  textTransform: "uppercase",
};

const text: React.CSSProperties = {
  color: "#334155",
  fontWeight: 650,
  fontSize: 13,
  lineHeight: 1.5,
};

const pill: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 900,
  border: "1px solid rgba(15,23,42,0.10)",
  padding: "4px 10px",
  borderRadius: 999,
  background: "rgba(255,255,255,0.85)",
  color: "#0f172a",
  whiteSpace: "nowrap",
};

const btn: React.CSSProperties = {
  height: 40,
  padding: "0 14px",
  borderRadius: 12,
  border: "1px solid rgba(15,23,42,0.12)",
  background: "white",
  fontWeight: 900,
  cursor: "pointer",
  color: "#0f172a",
};

const btnPrimary: React.CSSProperties = {
  ...btn,
  border: "1px solid rgba(37,99,235,0.25)",
  background:
    "linear-gradient(180deg, rgba(37,99,235,0.14), rgba(37,99,235,0.06))",
  color: "#1d4ed8",
};

const btnDanger: React.CSSProperties = {
  ...btn,
  border: "1px solid rgba(239,68,68,0.25)",
  background:
    "linear-gradient(180deg, rgba(239,68,68,0.14), rgba(239,68,68,0.06))",
  color: "#b91c1c",
};

const input: React.CSSProperties = {
  height: 38,
  borderRadius: 10,
  border: "1px solid rgba(15,23,42,0.15)",
  padding: "0 10px",
  fontSize: 12,
  fontWeight: 700,
  outline: "none",
  width: "100%",
};

const textarea: React.CSSProperties = {
  width: "100%",
  minHeight: 90,
  borderRadius: 10,
  border: "1px solid rgba(15,23,42,0.15)",
  padding: 10,
  fontSize: 12,
  fontWeight: 650,
  outline: "none",
};

type ReportType = "Bullying" | "Harassment" | "Misconduct" | "Other";

export default function GetSupport() {
  // ✅ Customize these (real office info)
  const officeEmail = "guidance.office@school.edu";
  const officeNumber = "09XX-XXX-XXXX";
  const officeHours = "Mon–Fri, 8:00 AM – 5:00 PM";
  const officeLocation = "Guidance Office, Main Building – 2nd Floor";

  // Modals
  const [openContact, setOpenContact] = useState(false);
  const [openResources, setOpenResources] = useState(false);
  const [openReport, setOpenReport] = useState(false);

  // Report form
  const [reportType, setReportType] = useState<ReportType>("Bullying");
  const [anonymous, setAnonymous] = useState(true);
  const [reportDetails, setReportDetails] = useState("");

  const canSubmitReport = reportDetails.trim().length >= 10;

  const submitReportDemo = () => {
    if (!canSubmitReport) return;
    alert(
      `Report submitted (demo).\nType: ${reportType}\nAnonymous: ${
        anonymous ? "Yes" : "No"
      }`,
    );
    setOpenReport(false);
    setReportDetails("");
    setAnonymous(true);
    setReportType("Bullying");
  };

  const resources = useMemo(
    () => [
      {
        title: "Stress Management Guides",
        desc: "Breathing techniques, grounding exercises, and daily routines.",
      },
      {
        title: "Time Management Tips",
        desc: "Prioritize tasks using simple planners and weekly goals.",
      },
      {
        title: "Study Skills Resources",
        desc: "Effective note-taking, active recall, and exam preparation tips.",
      },
      {
        title: "Mental Wellness Materials",
        desc: "Healthy habits, sleep hygiene, and emotional regulation basics.",
      },
      {
        title: "FAQs about Counseling",
        desc: "What happens in a session, confidentiality, and how to schedule.",
      },
    ],
    [],
  );

  return (
    <div style={pageWrap}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 16,
          alignItems: "flex-start",
          marginBottom: 18,
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1 style={headerTitle}>Get Support</h1>
          <p style={headerSub}>
            Help is available. Choose what you need—contact the guidance office,
            view resources, or report a concern.
          </p>
        </div>

        <span style={pill}>Support & Safety</span>
      </div>

      {/* Grid */}
      <div style={{ display: "grid", gap: 14 }}>
        {/* 2️⃣ Contact the Guidance Office */}
        <div style={card}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <div style={sectionLabel}>Contact the Guidance Office</div>
            <span style={pill}>Office Info</span>
          </div>

          <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
            <div style={text}>
              <b>Office email address:</b> {officeEmail}
            </div>
            <div style={text}>
              <b>Contact number:</b> {officeNumber}
            </div>
            <div style={text}>
              <b>Office hours:</b> {officeHours}
            </div>
            <div style={text}>
              <b>Office location:</b> {officeLocation}
            </div>
          </div>

          <div
            style={{
              marginTop: 12,
              display: "flex",
              justifyContent: "flex-end",
            }}
          >
            <button style={btnPrimary} onClick={() => setOpenContact(true)}>
              Contact Now
            </button>
          </div>
        </div>

        {/* 3️⃣ Immediate / Urgent Concern */}
        <div style={card}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <div style={sectionLabel}>Immediate / Urgent Concern</div>
            <span style={pill}>Important</span>
          </div>

          <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
            <div style={text}>
              If you feel unsafe or in immediate danger, seek help right away.
              Contact a trusted adult, guidance staff, or emergency services.
            </div>

            <div style={text}>
              <b>Emergency contact number:</b> 911 (or your local emergency
              line)
            </div>

            <div style={text}>
              <b>Guidance office direct line:</b> {officeNumber}
            </div>

            <div style={{ ...text, color: "#64748b" }}>
              <b>Note:</b> Guidance office replies may take time outside office
              hours.
            </div>
          </div>

          <div
            style={{
              marginTop: 12,
              display: "flex",
              justifyContent: "flex-end",
            }}
          >
            <button
              style={btnDanger}
              onClick={() => alert("Call emergency services if needed.")}
            >
              Urgent Help
            </button>
          </div>
        </div>

        {/* 4️⃣ Self-Help Resources */}
        <div style={card}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <div style={sectionLabel}>Self-Help Resources</div>
            <span style={pill}>Learn & Improve</span>
          </div>

          <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
            {resources.map((r) => (
              <div
                key={r.title}
                style={{
                  border: "1px solid rgba(15,23,42,0.08)",
                  borderRadius: 14,
                  padding: 12,
                  background: "rgba(248,250,252,0.80)",
                }}
              >
                <div
                  style={{ fontWeight: 900, color: "#0f172a", marginBottom: 4 }}
                >
                  {r.title}
                </div>
                <div style={{ ...text, color: "#64748b" }}>{r.desc}</div>
              </div>
            ))}
          </div>

          <div
            style={{
              marginTop: 12,
              display: "flex",
              justifyContent: "flex-end",
            }}
          >
            <button style={btnPrimary} onClick={() => setOpenResources(true)}>
              View Resources
            </button>
          </div>
        </div>

        {/* 5️⃣ Report a Concern */}
        <div style={card}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <div style={sectionLabel}>Report a Concern</div>
            <span style={pill}>Optional</span>
          </div>

          <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
            <div style={text}>
              You may report bullying, harassment, misconduct, or any concern.
              Reports are reviewed by authorized personnel only.
            </div>

            <div style={{ ...text, color: "#64748b" }}>
              You can choose to submit anonymously.
            </div>
          </div>

          <div
            style={{
              marginTop: 12,
              display: "flex",
              justifyContent: "flex-end",
            }}
          >
            <button style={btnPrimary} onClick={() => setOpenReport(true)}>
              Submit Report
            </button>
          </div>
        </div>

        {/* 6️⃣ Confidentiality Notice */}
        <div style={card}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <div style={sectionLabel}>Confidentiality Notice</div>
            <span style={pill}>Privacy</span>
          </div>

          <div style={{ marginTop: 10, ...text }}>
            Your information is confidential and handled by authorized guidance
            personnel only.
          </div>

          <div style={{ marginTop: 10 }}>
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                alert("Privacy policy link (add your real link later).");
              }}
              style={{ fontSize: 12, fontWeight: 900, color: "#1d4ed8" }}
            >
              View Privacy Policy
            </a>
          </div>
        </div>

        {/* 7️⃣ Encouraging Message */}
        <div
          style={{
            ...card,
            background:
              "linear-gradient(180deg, rgba(99,102,241,0.10), rgba(255,255,255,0.92))",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <div style={sectionLabel}>A Gentle Reminder</div>
            <span style={pill}>You Matter</span>
          </div>

          <div
            style={{
              marginTop: 10,
              fontSize: 14,
              fontWeight: 900,
              color: "#0f172a",
            }}
          >
            “It’s okay to ask for help. We’re here for you.”
          </div>
          <div style={{ marginTop: 6, ...text, color: "#64748b" }}>
            Small steps count. Reach out anytime you feel ready.
          </div>
        </div>
      </div>

      {/* CONTACT MODAL */}
      <Modal
        open={openContact}
        title="Contact the Guidance Office"
        onClose={() => setOpenContact(false)}
      >
        <div style={{ display: "grid", gap: 12 }}>
          <div
            style={{
              background: "rgba(34,197,94,0.08)",
              border: "1px solid rgba(34,197,94,0.25)",
              padding: 10,
              borderRadius: 10,
              fontSize: 12,
              fontWeight: 800,
              color: "#166534",
            }}
          >
            🔒 Your message will remain confidential.
          </div>

          <div style={text}>
            You can contact the office through email or phone:
          </div>

          <div style={{ display: "grid", gap: 8 }}>
            <div style={text}>
              <b>Email:</b> {officeEmail}
            </div>
            <div style={text}>
              <b>Phone:</b> {officeNumber}
            </div>
            <div style={{ ...text, color: "#64748b" }}>
              Office hours: {officeHours}
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <button style={btn} onClick={() => setOpenContact(false)}>
              Close
            </button>
            <button
              style={btnPrimary}
              onClick={() => alert("Demo: Add mailto: / tel: behavior here.")}
            >
              Contact Now
            </button>
          </div>
        </div>
      </Modal>

      {/* RESOURCES MODAL */}
      <Modal
        open={openResources}
        title="Self-Help Resources"
        onClose={() => setOpenResources(false)}
      >
        <div style={{ display: "grid", gap: 10 }}>
          {resources.map((r) => (
            <div
              key={r.title}
              style={{
                border: "1px solid rgba(15,23,42,0.08)",
                borderRadius: 14,
                padding: 12,
                background: "rgba(248,250,252,0.80)",
              }}
            >
              <div
                style={{ fontWeight: 900, color: "#0f172a", marginBottom: 4 }}
              >
                {r.title}
              </div>
              <div style={{ ...text, color: "#64748b" }}>{r.desc}</div>
            </div>
          ))}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <button style={btn} onClick={() => setOpenResources(false)}>
              Close
            </button>
            <button
              style={btnPrimary}
              onClick={() => alert("Demo: open real resources page.")}
            >
              View Resources
            </button>
          </div>
        </div>
      </Modal>

      {/* REPORT MODAL */}
      <Modal
        open={openReport}
        title="Submit a Report"
        onClose={() => setOpenReport(false)}
      >
        <div style={{ display: "grid", gap: 12 }}>
          <div
            style={{
              background: "rgba(34,197,94,0.08)",
              border: "1px solid rgba(34,197,94,0.25)",
              padding: 10,
              borderRadius: 10,
              fontSize: 12,
              fontWeight: 800,
              color: "#166534",
            }}
          >
            🔒 Your report is confidential and reviewed by authorized guidance
            personnel.
          </div>

          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}
          >
            <div>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 900,
                  color: "#334155",
                  marginBottom: 6,
                }}
              >
                Report Type
              </div>
              <select
                value={reportType}
                onChange={(e) => setReportType(e.target.value as ReportType)}
                style={input}
              >
                <option>Bullying</option>
                <option>Harassment</option>
                <option>Misconduct</option>
                <option>Other</option>
              </select>
            </div>

            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                border: "1px solid rgba(15,23,42,0.12)",
                borderRadius: 12,
                padding: "0 12px",
                height: 38,
                background: "white",
                fontSize: 12,
                fontWeight: 900,
                color: "#0f172a",
                userSelect: "none",
              }}
            >
              <input
                type="checkbox"
                checked={anonymous}
                onChange={(e) => setAnonymous(e.target.checked)}
              />
              Submit anonymously
            </label>
          </div>

          <div>
            <div
              style={{
                fontSize: 12,
                fontWeight: 900,
                color: "#334155",
                marginBottom: 6,
              }}
            >
              Details
            </div>
            <textarea
              value={reportDetails}
              onChange={(e) => setReportDetails(e.target.value)}
              style={textarea}
              placeholder="Describe what happened (who, what, when, where). Avoid sharing passwords or sensitive personal data."
            />
            <div
              style={{
                marginTop: 6,
                fontSize: 11,
                color: "#64748b",
                fontWeight: 700,
              }}
            >
              Tip: Provide clear details so the guidance office can act faster.
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <button style={btn} onClick={() => setOpenReport(false)}>
              Cancel
            </button>
            <button
              style={{
                ...btnPrimary,
                opacity: canSubmitReport ? 1 : 0.45,
                cursor: canSubmitReport ? "pointer" : "not-allowed",
              }}
              disabled={!canSubmitReport}
              onClick={submitReportDemo}
            >
              Submit Report
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
