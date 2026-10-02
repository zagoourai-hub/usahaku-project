export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

function errorMessage(body: unknown): string {
  // Nest error shape: { message: string | string[] }
  const raw = body && typeof body === "object" && "message" in body ? body.message : null;
  return Array.isArray(raw) ? raw.join(", ") : typeof raw === "string" ? raw : "Terjadi kesalahan. Coba lagi sebentar.";
}

// Auth rides on the backend's httpOnly cookie, so every request sends credentials.
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...init,
      credentials: "include",
      // FormData sets its own multipart boundary header.
      headers: init.body instanceof FormData ? init.headers : { "Content-Type": "application/json", ...init.headers },
    });
  } catch {
    throw new ApiError("Tidak bisa terhubung ke server. Cek koneksi internet kamu lalu coba lagi.", 0);
  }

  const body: unknown = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(errorMessage(body), res.status);
  return body as T;
}

/** Fetches a file endpoint and saves it via a temporary object URL. */
export async function download(path: string, fallbackName: string): Promise<void> {
  const res = await fetch(`${API_URL}${path}`, { credentials: "include" }).catch(() => {
    throw new ApiError("Tidak bisa terhubung ke server. Cek koneksi internet kamu lalu coba lagi.", 0);
  });
  if (!res.ok) throw new ApiError(errorMessage(await res.json().catch(() => null)), res.status);
  const name = /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") ?? "")?.[1] ?? fallbackName;
  const url = URL.createObjectURL(await res.blob());
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  a.click();
  URL.revokeObjectURL(url);
}
