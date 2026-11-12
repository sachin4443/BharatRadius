/** Shared formatting helpers (India time / rupees). */

export const formatDate = (value?: string | null, withTime = false): string => {
  if (!value) return "—";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
};

export const formatMoney = (value?: number | null): string =>
  `₹${Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;

/** Days left until a date (negative = days since). */
export const daysUntil = (value?: string | null): number | null => {
  if (!value) return null;
  const ms = new Date(value).getTime() - Date.now();
  return Math.ceil(ms / 86_400_000);
};

export const apiError = (err: any, fallback: string): string =>
  err?.response?.data?.message || err?.message || fallback;

/** Download a file returned by the API (CSV export etc.) */
export const saveBlob = (data: BlobPart, fileName: string, type = "text/csv") => {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
};

/** Logged-in user info saved at login. */
export const currentUser = (): any => {
  try {
    return JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    return null;
  }
};

/**
 * "L0".."L4". L0 is ONLY the super admin. A company (organization) admin is
 * reported as L0 / "ClientPortal" by older data, so it is treated as L1 here.
 */
export const currentLevel = (): string => {
  const u = currentUser();
  if (u?.isSuperAdmin) return "L0";
  const t = typeof u?.orgType === "number" ? `L${u.orgType}` : u?.orgType || "L1";
  return t === "L0" || t === "ClientPortal" ? "L1" : t;
};
