import { useMemo, useState } from "react";
import {
  Building2,
  BookOpen,
  Layers3,
  CalendarDays,
} from "lucide-react";
import Colleges from "./Colleges";
import Courses from "./Courses";
import AcademicYears from "./AcademicYears";
import YearLevels from "./YearLevels";

type TabKey = "colleges" | "courses" | "yearLevels" | "academicYears";

export default function AcademicStructure() {
  const [tab, setTab] = useState<TabKey>("colleges");

  const tabs = useMemo(
    () =>
      [
        { key: "colleges", label: "Colleges", icon: <Building2 size={16} /> },
        { key: "courses", label: "Courses", icon: <BookOpen size={16} /> },
        {
          key: "yearLevels",
          label: "Year Levels",
          icon: <Layers3 size={16} />,
        },
        {
          key: "academicYears",
          label: "Academic Years",
          icon: <CalendarDays size={16} />,
        },
      ] as const,
    [],
  );

  const tabBtn = (active: boolean): React.CSSProperties => ({
    height: 40,
    padding: "0 14px",
    borderRadius: 12,
    border: active
      ? "1px solid rgba(15,23,42,0.65)"
      : "1px solid rgba(15,23,42,0.12)",
    background: active
      ? "linear-gradient(135deg, rgba(15,23,42,0.96), rgba(2,6,23,0.98))"
      : "rgba(255,255,255,0.75)",
    color: active ? "white" : "rgba(15,23,42,0.85)",
    fontWeight: 900,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: 10,
  });

  const iconBox = (active: boolean): React.CSSProperties => ({
    width: 24,
    height: 24,
    borderRadius: 9,
    display: "grid",
    placeItems: "center",
    background: active ? "rgba(251,191,36,0.2)" : "rgba(15,23,42,0.07)",
    border: active
      ? "1px solid rgba(251,191,36,0.28)"
      : "1px solid rgba(15,23,42,0.12)",
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
                <span style={iconBox(active)}>{t.icon}</span>
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        {tab === "colleges" && <Colleges />}
        {tab === "courses" && <Courses />}
        {tab === "academicYears" && <AcademicYears />}
        {tab === "yearLevels" && <YearLevels />}
      </div>
    </div>
  );
}
