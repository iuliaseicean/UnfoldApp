import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const TOKEN_KEY = "token";

export async function saveToken(token: string) {
  if (Platform.OS === "web") {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
  }
}

export async function getToken() {
  if (Platform.OS === "web") {
    return localStorage.getItem(TOKEN_KEY);
  } else {
    return await SecureStore.getItemAsync(TOKEN_KEY);
  }
}

export async function deleteToken() {
  if (Platform.OS === "web") {
    localStorage.removeItem(TOKEN_KEY);
  } else {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  }
}
