import { ApiResponse } from "@/types";

export async function fetchApi<T>(
  endpoint: string,
  options?: RequestInit
): Promise<ApiResponse<T>> {
  const isServer = typeof window === "undefined";

  // Use absolute URL on the server, relative on the client with /api prefix
  const baseUrl = isServer ? process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000" : "";
  const url = `${baseUrl}/api${endpoint}`;

  try {
    const res = await fetch(url, {
      credentials: "include",       // always send the auth cookie
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
    });

    // Handle non-JSON responses (e.g. HTML error pages)
    const contentType = res.headers.get("content-type");
    let data: ApiResponse<T>;

    if (contentType && contentType.includes("application/json")) {
      data = await res.json();
    } else {
      data = {
        success: false,
        message: `Server error (${res.status} ${res.statusText})`,
      };
    }

    return data;
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || "Network error — could not reach the server.",
    };
  }
}
