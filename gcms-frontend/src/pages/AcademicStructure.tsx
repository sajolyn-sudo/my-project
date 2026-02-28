import { useMemo, useState } from "react";
import Colleges from "./Colleges";
import AcademicYears from "./AcademicYears";
import YearLevels from "./YearLevels";

type TabKey = "colleges" | "academicYears" | "yearLevels";

export default function AcademicStructure() {
  const [tab, setTab] = useState<TabKey>("colleges");

  const tabs = useMemo(
    () =>
      [
        { key: "colleges", label: "Colleges" },
        { key: "academicYears", label: "Academic Years" },
        { key: "yearLevels", label: "Year Levels" },
      ] as const,
    [],
  );

  const tabBtn = (active: boolean): React.CSSProperties => ({
    height: 40,
    padding: "0 14px",
    borderRadius: 12,
    border: active
      ? "1px solid rgba(37,99,235,0.35)"
      : "1px solid rgba(15,23,42,0.12)",
    background: active
      ? "linear-gradient(135deg, rgba(37,99,235,0.95), rgba(30,58,138,0.95))"
      : "rgba(255,255,255,0.75)",
    color: active ? "white" : "rgba(15,23,42,0.85)",
    fontWeight: 900,
    cursor: "pointer",
  });

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div
        style={{
          display: "flex",
          gap: 10,
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ fontSize: 26, fontWeight: 950, letterSpacing: -0.4 }}>
          Academic Structure
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {tabs.map((t) => {
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                style={tabBtn(active)}
                onClick={() => setTab(t.key)}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        {tab === "colleges" && <Colleges />}
        {tab === "academicYears" && <AcademicYears />}
        {tab === "yearLevels" && <YearLevels />}
      </div>
    </div>
  );
}
