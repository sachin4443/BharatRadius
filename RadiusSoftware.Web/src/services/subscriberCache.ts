/**
 * Small in-memory cache of subscriber records (per browser tab).
 * The list puts the row here before opening a profile, so the profile can be
 * drawn instantly and then refreshed from the server in the background.
 */
const cache = new Map<string, { data: any; at: number }>();
const MAX_ENTRIES = 200;

/** Copy the different username spellings into "pppoeUsername". */
export const normalizeSubscriber = (data: any) => {
  if (!data) return data;
  const pppoeUsername = data.pppoeUsername || data.ppPoEUsername || data.PPPoEUsername || "";
  return { ...data, pppoeUsername };
};

export const primeSubscriber = (data: any) => {
  if (!data?.id) return;
  const id = String(data.id);
  const existing = cache.get(id)?.data;
  cache.set(id, { data: normalizeSubscriber({ ...existing, ...data }), at: Date.now() });
  if (cache.size > MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
};

export const getCachedSubscriber = (id?: string) => (id ? cache.get(String(id))?.data ?? null : null);
