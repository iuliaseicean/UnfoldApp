import { useEffect } from "react";
import { Redirect } from "expo-router";
import { deleteToken } from "../../hooks/useSecureStore";

export default function AuthIndex() {
  useEffect(() => {
    (async () => {
      await deleteToken();   // ✔️ FĂRĂ PARAMETRI
    })();
  }, []);

  return <Redirect href="/(auth)/login" />;
}
