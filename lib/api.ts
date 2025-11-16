import axios from "axios";
import { getToken } from "../hooks/useSecureStore";

const api = axios.create({
  baseURL: "http://192.168.0.108:4000",  // ← IP-ul din ipconfig + portul backend-ului
  timeout: 10000,                       // opțional, 10 secunde
});

api.interceptors.request.use(async (config) => {
  const token = await getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default api;
