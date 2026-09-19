export async function authFetch(
  url: string,
  options: RequestInit = {}
) {
  // Keep each tab/window authenticated independently; refresh retains this storage.
  const token = sessionStorage.getItem("cipd_token");

  if (!token) {
    sessionStorage.removeItem("cipd_user");
    window.location.replace("/login");
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
    sessionStorage.removeItem("cipd_user");
    sessionStorage.removeItem("cipd_token");
    window.location.replace("/login");
  }

  return response;
}
