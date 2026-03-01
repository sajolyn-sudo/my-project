// gcms-frontend/src/lib/api.ts
const envApiBase = (import.meta.env.VITE_API_URL as string | undefined)
  ?.toString()
  .trim();
const normalizedEnvBase = envApiBase?.replace(/\/+$/, "");
const RAW_API_BASE =
  !normalizedEnvBase || /localhost:5000/i.test(normalizedEnvBase)
    ? "/gcms-api"
    : normalizedEnvBase;
const API_BASE = RAW_API_BASE.replace(/\/+$/, "");

function buildUrl(path: string) {
  if (!path) return API_BASE;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  if (!path.startsWith("/")) path = "/" + path;
  return `${API_BASE}${path}`;
}

async function readJsonSafely(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

export async function postJSON<T>(path: string, body?: unknown): Promise<T> {
  const url = buildUrl(path);

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
    });
  } catch {
    throw new Error(
      `Failed to fetch: ${url}. Make sure XAMPP Apache is running and the API path is correct.`,
    );
  }

  const data = await readJsonSafely(res);

  if (!res.ok) {
    const err = data as { error?: string; message?: string } | null;
    const msg =
      err?.error ||
      err?.message ||
      `Request failed (${res.status} ${res.statusText})`;
    throw new Error(msg);
  }

  const maybe = data as { ok?: boolean; error?: string; message?: string } | null;
  if (maybe && maybe.ok === false) {
    throw new Error(maybe.error || maybe.message || "Request failed");
  }

  return data as T;
}

export async function postFormData<T>(path: string, formData: FormData): Promise<T> {
  const url = buildUrl(path);

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      body: formData,
    });
  } catch {
    throw new Error(
      `Failed to fetch: ${url}. Make sure XAMPP Apache is running and the API path is correct.`,
    );
  }

  const data = await readJsonSafely(res);

  if (!res.ok) {
    const err = data as { error?: string; message?: string } | null;
    const msg =
      err?.error ||
      err?.message ||
      `Request failed (${res.status} ${res.statusText})`;
    throw new Error(msg);
  }

  const maybe = data as { ok?: boolean; error?: string; message?: string } | null;
  if (maybe && maybe.ok === false) {
    throw new Error(maybe.error || maybe.message || "Request failed");
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
      `Failed to fetch: ${url}. Make sure XAMPP Apache is running and reachable.`,
    );
  }

  const data = await readJsonSafely(res);

  if (!res.ok) {
    const err = data as { error?: string; message?: string } | null;
    const msg =
      err?.error ||
      err?.message ||
      `Request failed (${res.status} ${res.statusText})`;
    throw new Error(msg);
  }

  return data as T;
}
