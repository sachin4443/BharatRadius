import axios from "axios";

// Backend URL comes from the .env file (VITE_API_ROOT), e.g.
//   VITE_API_ROOT=https://api.bharatradius.com      (production)
//   VITE_API_ROOT=https://uat-api.bharatradius.com  (UAT)
//   VITE_API_ROOT=https://localhost:7045            (local)
const API_ROOT = (
  (import.meta.env.VITE_API_ROOT as string | undefined) || "https://api.bharatradius.com"
).replace(/\/+$/, "");

export const API_BASE_URL = `${API_ROOT}/api`;
export const SIGNALR_BASE_URL = API_ROOT;

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// ---------------------------------------------------------------------------
// Live / polling endpoints: if the same request is already running, reuse it
// instead of sending another one. A slow or offline router can then no longer
// pile up dozens of waiting requests (that is what made the panel hang).
// ---------------------------------------------------------------------------
const LIVE_URL =
  /\/(Nas\/(live-traffic|live-ping|interface-traffic|interfaces|fetch-router-info|ppp-active)|Subscribers\/[^/]+\/connection-status|subscriber-live-speed|Dashboard\/|Subscribers\/paged)/i;
const defaultAdapter = axios.getAdapter(axios.defaults.adapter);
const inFlight = new Map<string, Promise<any>>();

apiClient.defaults.adapter = (config) => {
  if (!LIVE_URL.test(config.url || "")) return defaultAdapter(config);
  const key = [
    config.method,
    config.url,
    JSON.stringify(config.params ?? null),
    typeof config.data === "string" ? config.data : "",
  ].join("|");
  const running = inFlight.get(key);
  if (running) return running;
  const promise = defaultAdapter(config).finally(() => inFlight.delete(key));
  inFlight.set(key, promise);
  return promise;
};

apiClient.interceptors.request.use(
  (config) => {
    const token =
      localStorage.getItem("token") ||
      localStorage.getItem("accessToken") ||
      localStorage.getItem("jwtToken");

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Session expired / logged out -> back to login page
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401 && window.location.pathname !== "/") {
      localStorage.removeItem("token");
      window.location.assign("/");
    }
    return Promise.reject(error);
  }
);

export default apiClient;