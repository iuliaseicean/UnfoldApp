// hooks/useSecureStore.ts
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const TOKEN_KEY = "token";

/**
 * Salvează token-ul JWT în SecureStore (mobil) sau localStorage (web).
 */
export async function saveToken(token: string): Promise<void> {
  if (Platform.OS === "web") {
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch (e) {
      console.warn("Failed to save token in localStorage:", e);
    }
  } else {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
  }
}

/**
 * Citește token-ul JWT din SecureStore / localStorage.
 */
export async function getToken(): Promise<string | null> {
  if (Platform.OS === "web") {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch (e) {
      console.warn("Failed to read token from localStorage:", e);
      return null;
    }
  } else {
    return await SecureStore.getItemAsync(TOKEN_KEY);
  }
}

/**
 * Șterge token-ul (logout).
 */
export async function deleteToken(): Promise<void> {
  if (Platform.OS === "web") {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch (e) {
      console.warn("Failed to remove token from localStorage:", e);
    }
  } else {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  }
}

/**
 * Helper simplu: spune dacă avem un token salvat.
 */
export async function isLoggedIn(): Promise<boolean> {
  const token = await getToken();
  return !!token;
}
