export async function authFetch(
  url: string,
  options: RequestInit = {}
) {
  const token = localStorage.getItem("cipd_token");

  if (!token) {
    localStorage.removeItem("cipd_user");
    window.location.href = "/login";
    throw new Error("No authentication token.");
  }

  const headers = new Headers(options.headers);

  headers.set("Authorization", `Bearer ${token}`);

  if (
    options.body &&
    !(options.body instanceof FormData) &&
    !headers.has("Content-Type")
  ) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    localStorage.removeItem("cipd_user");
    localStorage.removeItem("cipd_token");
    window.location.href = "/login";
  }

  return response;
}