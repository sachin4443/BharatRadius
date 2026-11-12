import axios from "axios";

//const API_BASE_URL = "https://localhost:7045/api";
const API_BASE_URL = "https://api.bharatradius.com/api";
export const SIGNALR_BASE_URL = "https://api.bharatradius.com";

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

export default apiClient;