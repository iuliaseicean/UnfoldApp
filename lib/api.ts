import axios from "axios";
import { getToken } from "../hooks/useSecureStore";

const baseURL = process.env.EXPO_PUBLIC_API_URL ?? "http://192.168.1.78:4000";

const api = axios.create({
  baseURL,
  timeout: 10000,
});

api.interceptors.request.use(async (config) => {
  const token = await getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default api;
