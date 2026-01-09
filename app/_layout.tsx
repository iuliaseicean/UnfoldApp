// app/_layout.tsx
import { DarkTheme, DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import "react-native-reanimated";

import { useColorScheme } from "@/hooks/use-color-scheme";

export const unstable_settings = {
  anchor: "(tabs)",
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        {/* Tabs */}
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />

        {/* Modals */}
        <Stack.Screen name="modal" options={{ presentation: "modal", title: "Modal" }} />

        {/* ✅ Dynamic routes (outside tabs) */}
        <Stack.Screen name="post/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="post/[id]/comments" options={{ headerShown: false }} />
        <Stack.Screen name="profile/[id]" options={{ headerShown: false }} />

        {/* Dacă ai capsule în afara tabs, poți activa și astea: */}
        {/* <Stack.Screen name="capsule/[id]" options={{ headerShown: false }} /> */}
        {/* <Stack.Screen name="capsule/key/[id]" options={{ headerShown: false }} /> */}
      </Stack>

      <StatusBar style="auto" />
    </ThemeProvider>
  );
}