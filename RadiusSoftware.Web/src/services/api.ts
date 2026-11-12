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