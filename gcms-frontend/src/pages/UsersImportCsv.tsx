import type { CSSProperties } from "react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { postFormData } from "../lib/api";
import SuccessNoticeModal from "../components/SuccessNoticeModal";
import UserManagementProcessingOverlay from "../components/UserManagementProcessingOverlay";

type ImportResponse = {
  ok: boolean;
  message?: string;
  inserted: number;
  skipped: number;
  errors?: string[];
};

const sampleCsv = `first_name,middle_name,last_name,email,username,role,college_name,course_name,year_level_name,section,password
Celine,,Abao,celine.abao@bisu.edu.ph,celine.abao,STUDENT,College of Science,Bachelor of Science in Computer Science,3rd Year,A,Welcome123
Faye,,Tutor,faye.tutor@bisu.edu.ph,faye.tutor,STUDENT,College of Teacher Education,Bachelor of Secondary Education Major in English,3rd Year,A,Welcome123
Brent,,Sales,brent.sales@bisu.edu.ph,brent.sales,STUDENT,College of Business and Management,Bachelor of Science in Office Administration,3rd Year,B,Welcome123
May,,Santos,may.santos@bisu.edu.ph,may.santos,STAFF,,,,,Welcome123
Noel,,Reyes,noel.reyes@bisu.edu.ph,noel.reyes,TEACHER,,,,,Welcome123
Rica,,Flores,rica.flores@bisu.edu.ph,rica.flores,NON_TEACHING_PERSONNEL,,,,,Welcome123
`;
const PROCESSING_MIN_MS = 2000;

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function UsersImportCsv() {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResponse | null>(null);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

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
      const startedAt = Date.now();
      setLoading(true);
      const res = await postFormData<ImportResponse>("/import_users_csv.php", fd);
      const elapsed = Date.now() - startedAt;
      if (elapsed < PROCESSING_MIN_MS) {
        await wait(PROCESSING_MIN_MS - elapsed);
      }
      setResult(res);
      setSuccessMessage(
        res.message || `Import successful. Inserted ${res.inserted} user(s).`,
      );
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
          Emails are normalized to `@bisu.edu.ph`, and imported users are marked
          as approved/registered right away.
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
          `username`, `role` (ex: STUDENT, TEACHER, STAFF, ADMIN,
          NON_TEACHING_PERSONNEL), and `password`. For students include
          `college_name`, `course_name`, `year_level_name`, and `section`.
        </p>
        <pre style={preStyle}>{sampleCsv}</pre>
      </div>

      <SuccessNoticeModal
        open={successMessage.length > 0}
        onClose={() => setSuccessMessage("")}
        title="Import Successful"
        message={successMessage}
      />

      <UserManagementProcessingOverlay
        open={loading}
        title="Importing CSV"
        message="Please wait while we import users into User Management."
      />
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
