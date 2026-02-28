// gcms-frontend/src/lib/api.ts
const API_BASE =
  (import.meta as any).env?.VITE_API_URL?.toString().trim() ||
  "http://localhost:5000";

function buildUrl(path: string) {
  if (!path) return API_BASE;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  if (!path.startsWith("/")) path = "/" + path;
  return `${API_BASE}${path}`;
}

async function readJsonSafely(res: Response) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

export async function postJSON<T>(path: string, body?: any): Promise<T> {
  const url = buildUrl(path);

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
    });
  } catch (err: any) {
    // This is where "Failed to fetch" comes from (network/CORS/wrong port)
    throw new Error(
      `Failed to fetch: ${url}. Make sure backend is running and CORS allows your frontend.`,
    );
  }

  const data = await readJsonSafely(res);

  if (!res.ok) {
    const msg =
      data?.error ||
      data?.message ||
      `Request failed (${res.status} ${res.statusText})`;
    throw new Error(msg);
  }

  if (data && data.ok === false) {
    throw new Error(data.error || data.message || "Request failed");
  }

  return data as T;
}

export async function getJSON<T>(path: string): Promise<T> {
  const url = buildUrl(path);

  let res: Response;
  try {
    res = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
    });
  } catch {
    throw new Error(
      `Failed to fetch: ${url}. Make sure backend is running and reachable.`,
    );
  }

  const data = await readJsonSafely(res);

  if (!res.ok) {
    const msg =
      data?.error ||
      data?.message ||
      `Request failed (${res.status} ${res.statusText})`;
    throw new Error(msg);
  }

  return data as T;
}
