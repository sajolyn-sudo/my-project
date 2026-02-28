import { useMemo, useState } from "react";
import Modal from "../components/Modal";
import "./MyCounseling.css";

type Status = "Pending" | "Ongoing" | "Completed";

type CaseItem = {
  id: number;
  reasons: string[];
  details: string;
  schedule: string; // ✅ date + time
  date: string;
  status: Status;
};

const REASONS = [
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
  "Others (Please specify)",
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

export default function MyCounseling() {
  const [cases, setCases] = useState<CaseItem[]>([]);
  const currentCase = cases[0] ?? null;

  // Modal
  const [openRequest, setOpenRequest] = useState(false);

  // Form state
  const [selectedReasons, setSelectedReasons] = useState<string[]>([]);
  const [details, setDetails] = useState("");

  // ✅ Schedule
  const [preferredDate, setPreferredDate] = useState("");
  const [preferredTime, setPreferredTime] = useState("");

  const toggleReason = (reason: string) => {
    setSelectedReasons((prev) =>
      prev.includes(reason)
        ? prev.filter((r) => r !== reason)
        : [...prev, reason],
    );
  };

  const canSubmit =
    selectedReasons.length > 0 &&
    preferredDate.trim().length > 0 &&
    preferredTime.trim().length > 0;

  const submitRequest = () => {
    if (!canSubmit) return;

    const newCase: CaseItem = {
      id: Date.now(),
      reasons: selectedReasons,
      details: details.trim(),
      schedule: `${preferredDate} ${preferredTime}`,
      date: new Date().toISOString().split("T")[0],
      status: "Pending",
    };

    setCases((prev) => [newCase, ...prev]);

    // reset
    setSelectedReasons([]);
    setDetails("");
    setPreferredDate("");
    setPreferredTime("");
    setOpenRequest(false);
  };

  const totalCases = useMemo(() => cases.length, [cases]);

  const statusPill = (status: Status) => {
    const bg =
      status === "Pending"
        ? "#facc15"
        : status === "Ongoing"
          ? "#3b82f6"
          : "#22c55e";

    return (
      <span
        style={{
          padding: "6px 10px",
          borderRadius: 999,
          fontSize: 12,
          fontWeight: 900,
          color: "#0b1220",
          background: bg,
          display: "inline-flex",
          alignItems: "center",
        }}
      >
        {status}
      </span>
    );
  };

  return (
    <div style={{ padding: 24, maxWidth: 1120 }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 16,
          marginBottom: 18,
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: 30 }}>My Counseling</h1>
          <p style={{ margin: "6px 0 0", color: "#64748b", fontWeight: 600 }}>
            View your cases, track status, and request counseling when needed.
          </p>
        </div>

        <button
          onClick={() => setOpenRequest(true)}
          style={{
            height: 40,
            padding: "0 14px",
            borderRadius: 12,
            border: "1px solid rgba(37,99,235,0.25)",
            background:
              "linear-gradient(180deg, rgba(37,99,235,0.14), rgba(37,99,235,0.06))",
            color: "#1d4ed8",
            fontWeight: 900,
            cursor: "pointer",
            boxShadow: "0 8px 18px rgba(2,6,23,0.08)",
            whiteSpace: "nowrap",
          }}
        >
          + Request Counseling
        </button>
      </div>

      {/* ✅ Dashboard: only Current Case + All My Cases */}
      <div style={{ display: "grid", gap: 14 }}>
        {/* Current Case */}
        <div
          style={{
            background: "rgba(255,255,255,0.92)",
            border: "1px solid rgba(15,23,42,0.08)",
            borderRadius: 16,
            boxShadow: "0 18px 50px rgba(2,6,23,0.10)",
            padding: 16,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <div
              style={{
                fontWeight: 900,
                letterSpacing: 0.4,
                color: "#0f172a",
                fontSize: 12,
              }}
            >
              CURRENT CASE
            </div>
            <div
              style={{
                fontSize: 12,
                fontWeight: 900,
                border: "1px solid rgba(15,23,42,0.10)",
                padding: "4px 10px",
                borderRadius: 999,
                background: "rgba(255,255,255,0.85)",
              }}
            >
              Total: {currentCase ? 1 : 0}
            </div>
          </div>

          <div style={{ marginTop: 12 }}>
            {!currentCase ? (
              <>
                <div style={{ fontWeight: 900, color: "#0f172a" }}>
                  No counseling cases yet
                </div>
                <div
                  style={{
                    color: "#64748b",
                    fontWeight: 600,
                    marginTop: 6,
                    fontSize: 13,
                  }}
                >
                  Press <b>+ Request Counseling</b> to create your first
                  request.
                </div>
              </>
            ) : (
              <>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                  }}
                >
                  <div style={{ fontWeight: 900, color: "#0f172a" }}>
                    {currentCase.reasons.join(", ") || "Counseling Request"}
                  </div>
                  {statusPill(currentCase.status)}
                </div>

                <div
                  style={{
                    color: "#64748b",
                    fontWeight: 700,
                    marginTop: 6,
                    fontSize: 13,
                  }}
                >
                  Date: {currentCase.date}
                </div>

                <div
                  style={{
                    color: "#64748b",
                    fontWeight: 700,
                    marginTop: 6,
                    fontSize: 13,
                  }}
                >
                  Preferred Schedule: {currentCase.schedule}
                </div>

                {!!currentCase.details && (
                  <div
                    style={{ marginTop: 10, color: "#0f172a", fontWeight: 650 }}
                  >
                    {currentCase.details}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* All My Cases */}
        <div
          style={{
            background: "rgba(255,255,255,0.92)",
            border: "1px solid rgba(15,23,42,0.08)",
            borderRadius: 16,
            boxShadow: "0 18px 50px rgba(2,6,23,0.10)",
            padding: 16,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <div
              style={{
                fontWeight: 900,
                letterSpacing: 0.4,
                color: "#0f172a",
                fontSize: 12,
              }}
            >
              ALL MY CASES
            </div>
            <div
              style={{
                fontSize: 12,
                fontWeight: 900,
                border: "1px solid rgba(15,23,42,0.10)",
                padding: "4px 10px",
                borderRadius: 999,
                background: "rgba(255,255,255,0.85)",
              }}
            >
              Total: {totalCases}
            </div>
          </div>

          <div style={{ marginTop: 12 }}>
            {cases.length === 0 ? (
              <div style={{ color: "#64748b", fontWeight: 700 }}>
                No cases yet.
              </div>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {cases.map((c) => (
                  <div
                    key={c.id}
                    style={{
                      border: "1px solid rgba(15,23,42,0.08)",
                      borderRadius: 14,
                      padding: 12,
                      background: "rgba(248,250,252,0.8)",
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 12,
                      alignItems: "flex-start",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 900, color: "#0f172a" }}>
                        {c.reasons.join(", ") || "Counseling Request"}
                      </div>
                      <div
                        style={{
                          color: "#64748b",
                          fontWeight: 700,
                          fontSize: 13,
                          marginTop: 4,
                        }}
                      >
                        Date: {c.date}
                      </div>
                      <div
                        style={{
                          color: "#64748b",
                          fontWeight: 700,
                          fontSize: 13,
                          marginTop: 4,
                        }}
                      >
                        Schedule: {c.schedule}
                      </div>
                    </div>
                    {statusPill(c.status)}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ✅ Request Counseling Modal */}
      <Modal
        open={openRequest}
        title="Request Counseling"
        onClose={() => setOpenRequest(false)}
      >
        <div style={{ display: "grid", gap: 14 }}>
          {/* Reassurance */}
          <div
            style={{
              background: "rgba(34,197,94,0.08)",
              border: "1px solid rgba(34,197,94,0.25)",
              padding: 10,
              borderRadius: 10,
              fontSize: 12,
              fontWeight: 700,
              color: "#166534",
            }}
          >
            🔒 Your information will remain confidential.
          </div>

          {/* Reasons */}
          <div>
            <div
              style={{
                fontWeight: 800,
                color: "#334155",
                fontSize: 13,
                marginBottom: 8,
              }}
            >
              Reasons
            </div>

            <div
              className="reasonsGrid"
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 8,
              }}
            >
              {REASONS.map((reason) => {
                const checked = selectedReasons.includes(reason);

                return (
                  <label
                    key={reason}
                    style={{
                      display: "flex",
                      gap: 8,
                      alignItems: "center",
                      padding: 8,
                      borderRadius: 10,
                      border: "1px solid rgba(15,23,42,0.10)",
                      background: checked ? "rgba(37,99,235,0.08)" : "white",
                      cursor: "pointer",
                      fontSize: 12,
                      fontWeight: 800,
                      color: "#0f172a",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleReason(reason)}
                    />
                    {reason}
                  </label>
                );
              })}
            </div>

            <div
              style={{
                marginTop: 6,
                fontSize: 11,
                color: "#64748b",
                fontWeight: 700,
              }}
            >
              Selected: {selectedReasons.length}
            </div>
          </div>

          {/* Schedule */}
          <div>
            <div
              style={{
                fontWeight: 800,
                color: "#334155",
                fontSize: 13,
                marginBottom: 8,
              }}
            >
              Preferred Schedule
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 10,
              }}
            >
              <input
                type="date"
                value={preferredDate}
                onChange={(e) => setPreferredDate(e.target.value)}
                style={{
                  height: 36,
                  borderRadius: 8,
                  border: "1px solid rgba(15,23,42,0.15)",
                  padding: "0 10px",
                  fontSize: 12,
                }}
              />

              <input
                type="time"
                value={preferredTime}
                onChange={(e) => setPreferredTime(e.target.value)}
                style={{
                  height: 36,
                  borderRadius: 8,
                  border: "1px solid rgba(15,23,42,0.15)",
                  padding: "0 10px",
                  fontSize: 12,
                }}
              />
            </div>

            <div
              style={{
                marginTop: 6,
                fontSize: 11,
                color: "#64748b",
                fontWeight: 700,
              }}
            >
              Please pick your preferred date and time.
            </div>
          </div>

          {/* Notes */}
          <div>
            <div
              style={{
                fontWeight: 800,
                color: "#334155",
                fontSize: 13,
                marginBottom: 8,
              }}
            >
              Notes (optional)
            </div>

            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Write additional details here..."
              style={{
                width: "100%",
                minHeight: 80,
                borderRadius: 10,
                border: "1px solid rgba(15,23,42,0.15)",
                padding: 10,
                fontSize: 12,
              }}
            />
          </div>

          {/* Footer */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <button
              onClick={() => setOpenRequest(false)}
              style={{
                height: 36,
                padding: "0 14px",
                borderRadius: 10,
                border: "1px solid rgba(15,23,42,0.15)",
                background: "white",
                fontWeight: 900,
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>

            <button
              onClick={submitRequest}
              disabled={!canSubmit}
              style={{
                height: 36,
                padding: "0 14px",
                borderRadius: 10,
                border: "none",
                background: canSubmit ? "#2563eb" : "rgba(37,99,235,0.35)",
                color: "white",
                fontWeight: 900,
                fontSize: 12,
                cursor: canSubmit ? "pointer" : "not-allowed",
              }}
            >
              Create
            </button>
          </div>

          {!canSubmit && (
            <div style={{ fontSize: 11, color: "#ef4444", fontWeight: 700 }}>
              Please select at least one reason and choose your preferred date
              and time.
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
