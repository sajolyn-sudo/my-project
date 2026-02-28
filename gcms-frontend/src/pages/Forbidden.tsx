import { Link } from "react-router-dom";

export default function Forbidden() {
  return (
    <div style={{ padding: 16 }}>
      <h2>403 - Forbidden</h2>
      <p>You don’t have access to this page.</p>
      <Link to="/app/dashboard">Go back to Dashboard</Link>
    </div>
  );
}
