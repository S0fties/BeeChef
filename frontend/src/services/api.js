const API_URL = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000";
const TOKEN_KEY = "access_token";

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (token) =>
  token ? localStorage.setItem(TOKEN_KEY, token) : localStorage.removeItem(TOKEN_KEY);

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// The backend returns `detail` as a string (e.g. duplicate email, bad login)
// or as a list of validation errors (e.g. invalid email format).
function errorMessage(detail) {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail.map((d) => `${d.loc?.slice(1).join(".")}: ${d.msg}`).join("; ");
  }
  return "Something went wrong";
}

async function request(path, { method = "GET", body, auth = true } = {}) {
  const headers = {};
  if (body) headers["Content-Type"] = "application/json";
  const token = getToken();
  if (auth && token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, errorMessage(data?.detail));
  return data;
}

export const api = {
  register: (body)       => request("/api/v1/auth/register", { method: "POST", body, auth: false }),
  login: (body)          => request("/api/v1/auth/login", { method: "POST", body, auth: false }),
  changePassword: (body) => request("/api/v1/auth/change-password", { method: "POST", body }),
  me: ()                 => request("/api/v1/auth/me"),
};