// hooks/useAuthToken.ts
import { useEffect, useState } from "react";
import * as SecureStore from "expo-secure-store";

export function useAuthToken() {
  // undefined = încă încarcă, null = nu există token, string = token
  const [token, setToken] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    (async () => {
      const t = await SecureStore.getItemAsync("token");
      setToken(t);
    })();
  }, []);

  const saveToken = async (newToken: string | null) => {
    if (newToken) {
      await SecureStore.setItemAsync("token", newToken);
      setToken(newToken);
    } else {
      await SecureStore.deleteItemAsync("token");
      setToken(null);
    }
  };

  return { token, saveToken };
}
