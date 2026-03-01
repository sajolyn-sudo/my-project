import type { CSSProperties } from "react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { postFormData } from "../lib/api";

type ImportResponse = {
  ok: boolean;
  message?: string;
  inserted: number;
  skipped: number;
  errors?: string[];
};

const sampleCsv = `first_name,middle_name,last_name,email,role,college_name,year_level_name,password
Juan,,Dela Cruz,juan.delacruz@bisu.edu.ph,STUDENT,College of Computer Studies,1st Year,
Maria,,Santos,maria.santos@bisu.edu.ph,COUNSELOR,,,
Natan,,Paxley,natan.paxley@bisu.edu.ph,TEACHER,,,
Luna,,Gonzales,luna.gonzales@bisu.edu.ph,NON_TEACHING_PERSONNEL,,,
`;

export default function UsersImportCsv() {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResponse | null>(null);
  const [error, setError] = useState("");

  const fileName = useMemo(() => file?.name || "No file selected", [file]);

  const handleUpload = async () => {
    setError("");
    setResult(null);

    if (!file) {
      setError("Please choose a CSV file first.");
      return;
    }
    if (loading) return;

    const fd = new FormData();
    fd.append("csv", file);

    try {
      setLoading(true);
      const res = await postFormData<ImportResponse>("/import_users_csv.php", fd);
      setResult(res);
    } catch (e: any) {
      setError(e?.message || "CSV upload failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
        <h2 style={{ margin: 0, fontWeight: 800 }}>Import Users (CSV)</h2>
        <button style={ghostButton} onClick={() => navigate("/app/users")}>
          Back to User Management
        </button>
      </div>

      <div style={card}>
        <p style={{ marginTop: 0, opacity: 0.82, fontSize: 13 }}>
          Upload a CSV file to bulk create users directly in the database.
          Emails are normalized to `@bisu.edu.ph`.
        </p>

        <div style={{ display: "grid", gap: 8 }}>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          <div style={{ fontSize: 13, opacity: 0.8 }}>Selected: {fileName}</div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
          <button onClick={handleUpload} style={primaryButton} disabled={loading}>
            {loading ? "Importing..." : "Import CSV"}
          </button>
        </div>

        {error && <div style={errorBox}>{error}</div>}
        {result && (
          <div style={okBox}>
            <div>{result.message || "Import completed."}</div>
            <div style={{ marginTop: 6 }}>
              Inserted: <b>{result.inserted}</b> | Skipped: <b>{result.skipped}</b>
            </div>
            {(result.errors?.length ?? 0) > 0 && (
              <div style={{ marginTop: 8 }}>
                <div style={{ fontWeight: 800 }}>Issues:</div>
                <ul style={{ margin: "6px 0 0 18px", padding: 0 }}>
                  {(result.errors ?? []).slice(0, 12).map((x, i) => (
                    <li key={`${x}-${i}`}>{x}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      <div style={card}>
        <h3 style={{ marginTop: 0 }}>CSV Template</h3>
        <p style={{ marginTop: 0, opacity: 0.82, fontSize: 13 }}>
          Required columns: `email`. Recommended: `first_name`, `last_name`,
          `role` (ex: STUDENT, TEACHER, COUNSELOR, ADMIN, NON_TEACHING_PERSONNEL).
          For students include `college_name` and `year_level_name`.
        </p>
        <pre style={preStyle}>{sampleCsv}</pre>
      </div>
    </div>
  );
}

const card: CSSProperties = {
  background: "var(--card)",
  padding: 16,
  borderRadius: 16,
  boxShadow: "var(--shadow)",
  border: "1px solid var(--border)",
};

const primaryButton: CSSProperties = {
  height: 40,
  padding: "0 16px",
  borderRadius: 10,
  border: "none",
  background: "var(--primary)",
  color: "white",
  fontWeight: 700,
  cursor: "pointer",
};

const ghostButton: CSSProperties = {
  height: 36,
  padding: "0 12px",
  borderRadius: 10,
  border: "1px solid var(--border)",
  background: "white",
  cursor: "pointer",
  fontWeight: 700,
};

const preStyle: CSSProperties = {
  margin: 0,
  background: "#0b1020",
  color: "#e5e7eb",
  borderRadius: 12,
  padding: 12,
  overflowX: "auto",
  fontSize: 12,
  lineHeight: 1.45,
};

const errorBox: CSSProperties = {
  marginTop: 10,
  border: "1px solid #fecaca",
  background: "#fee2e2",
  color: "#991b1b",
  borderRadius: 10,
  padding: "10px 12px",
  fontWeight: 700,
  fontSize: 13,
};

const okBox: CSSProperties = {
  marginTop: 10,
  border: "1px solid #bbf7d0",
  background: "#dcfce7",
  color: "#166534",
  borderRadius: 10,
  padding: "10px 12px",
  fontWeight: 700,
  fontSize: 13,
};
