import { userConfig } from "@/config/userConfig";
import { Activity } from "@/types/activity";

export async function apiPost(payload: Record<string, unknown>): Promise<any> {
  const res = await fetch(userConfig.apiUrl, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("Invalid JSON response from API");
  }
}

export const getWinnipegTimeString = (): string =>
  new Intl.DateTimeFormat("en-US", {
    timeZone: userConfig.timezone,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date());

export const getWinnipegDateString = (): string =>
  new Intl.DateTimeFormat("en-US", { timeZone: userConfig.timezone }).format(new Date());

export async function fetchCurrentActivity(): Promise<Activity | null> {
  const data = await apiPost({ action: "getCurrentActivity", user: userConfig.userId });
  if (data?.ok === true && data.activity && typeof data.activity === "object") {
    return data.activity as Activity;
  }
  return null;
}

export async function fetchRecentActivities(): Promise<Activity[]> {
  const data = await apiPost({
    action: "getRecentActivities",
    user: userConfig.userId,
    limit: userConfig.recentActivityLimit,
  });
  if (data?.ok === true && Array.isArray(data.activities)) {
    return data.activities as Activity[];
  }
  return [];
}

export async function createActivity(activity: string): Promise<Activity> {
  const payload = {
    action: "createActivity",
    recordId: crypto.randomUUID(),
    user: userConfig.userId,
    activity: activity.trim(),
    date: getWinnipegDateString(),
    startTime: getWinnipegTimeString(),
    isActive: true,
    status: "Active",
    createdAt: new Date().toISOString(),
  };
  const result = await apiPost(payload);
  if (!result || result.ok !== true) {
    throw new Error("Invalid response: " + JSON.stringify(result));
  }
  return {
    recordId: payload.recordId,
    user: payload.user,
    activity: payload.activity,
    date: payload.date,
    startTime: payload.startTime,
    endTime: "",
    isActive: true,
    status: "Active",
    createdAt: payload.createdAt,
  };
}

export async function endActivity(): Promise<void> {
  const result = await apiPost({ action: "endActivity", user: userConfig.userId });
  if (!result || result.ok !== true) {
    throw new Error("Invalid response: " + JSON.stringify(result));
  }
}

export async function updateActivity(recordId: string, fields: Partial<Activity>): Promise<void> {
  const result = await apiPost({ action: "updateActivity", recordId, ...fields });
  if (!result || result.ok !== true) {
    throw new Error("Update failed: " + JSON.stringify(result));
  }
}

export async function batchUpdateActivities(
  updates: Array<{ recordId: string } & Partial<Activity>>
): Promise<void> {
  const result = await apiPost({ action: "batchUpdate", updates });
  if (!result || result.ok !== true) {
    throw new Error("Batch update failed: " + JSON.stringify(result));
  }
}

export async function insertActivity(fields: {
  activity: string;
  date: string;
  startTime: string;
  endTime?: string;
  isActive?: boolean;
  status?: "Active" | "Completed";
}): Promise<void> {
  const result = await apiPost({
    action: "insertActivity",
    recordId: crypto.randomUUID(),
    user: userConfig.userId,
    createdAt: new Date().toISOString(),
    ...fields,
  });
  if (!result || result.ok !== true) {
    throw new Error("Insert failed: " + JSON.stringify(result));
  }
}

// ── Date / time formatting helpers ──────────────────────────────────────────

// "14:30:00" → "14:30"  (for <input type="time">)
export const timeToInput = (t: string | boolean | unknown): string => {
  const s = String(t ?? "");
  if (!s || s === "false" || s === "true") return "";
  return s.slice(0, 5);
};

// "14:30" → "14:30:00"
export const inputToTime = (t: string): string => (t ? `${t}:00` : "");

// Stored dates come back from Sheets as "M/D/YYYY" or sometimes "YYYY-MM-DD"
export const dateToInput = (d: string | unknown): string => {
  const s = String(d ?? "");
  if (!s) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const parts = s.split("/");
  if (parts.length === 3) {
    return `${parts[2]}-${parts[0].padStart(2, "0")}-${parts[1].padStart(2, "0")}`;
  }
  return s;
};

// "2026-05-15" → "5/15/2026"
export const inputToDate = (d: string): string => {
  if (!d) return "";
  const [y, m, day] = d.split("-");
  return `${parseInt(m)}/${parseInt(day)}/${y}`;
};

export const formatTimeDisplay = (t: string | unknown): string => {
  const s = String(t ?? "");
  if (!s || s === "false") return "";
  // Strip seconds for display: "14:30:00" → "2:30 PM"
  const parts = s.split(":");
  if (parts.length >= 2) {
    let h = parseInt(parts[0]);
    const min = parts[1];
    const ampm = h >= 12 ? "PM" : "AM";
    h = h % 12 || 12;
    return `${h}:${min} ${ampm}`;
  }
  return s;
};

export const formatDateDisplay = (d: string | unknown): string => {
  const input = dateToInput(d);
  if (!input) return "";
  try {
    const date = new Date(input + "T00:00:00");
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return String(d ?? "");
  }
};

export const isToday = (d: string | unknown): boolean => {
  const input = dateToInput(d);
  const todayInput = dateToInput(getWinnipegDateString());
  return input === todayInput;
};

// ── Combined initial data fetch (one round trip instead of two) ──────────────
export async function fetchInitialData(): Promise<{ current: Activity | null; recent: Activity[] }> {
  const data = await apiPost({
    action: "getInitialData",
    user: userConfig.userId,
    limit: userConfig.recentActivityLimit,
  });
  if (data?.ok === true) {
    return {
      current: data.current ?? null,
      recent: Array.isArray(data.recent) ? (data.recent as Activity[]) : [],
    };
  }
  // Fallback: fetch separately if server doesn't support combined call yet
  const [current, recent] = await Promise.all([fetchCurrentActivity(), fetchRecentActivities()]);
  return { current, recent };
}
