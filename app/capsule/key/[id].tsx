import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";

import api from "@/lib/api";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Fonts } from "@/constants/theme";

const BG = require("@/assets/images/brown-metallic-foil-background-texture-free-photo.jpg");

export default function KeyCapsuleUnlockScreen() {
  const params = useLocalSearchParams();
  const capsuleId = useMemo(() => {
    const raw = params?.id;
    const s = Array.isArray(raw) ? raw[0] : raw;
    return s ? Number(s) : NaN;
  }, [params]);

  const [key, setKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [error, setError] = useState<string>("");

  const canUnlock = key.trim().length > 0 && !loading;

  const unlock = async () => {
    if (!Number.isFinite(capsuleId)) {
      Alert.alert("Eroare", "ID capsulă invalid.");
      return;
    }
    const k = key.trim();
    if (!k) {
      setError("Introdu cheia/parola.");
      return;
    }

    try {
      setError("");
      setLoading(true);

      const res = await api.post(`/capsules/${capsuleId}/unlock`, { key: k });
      const url = res?.data?.media_url || null;

      if (!url) {
        setError("Capsula a fost deblocată, dar nu am primit poza.");
        return;
      }

      setMediaUrl(url);
    } catch (e: any) {
      const status = e?.response?.status;
      const msg =
        e?.response?.data?.error ||
        e?.response?.data?.message ||
        e?.message ||
        "Nu am putut debloca capsula.";

      if (status === 401) setError("Cheie greșită. Încearcă din nou.");
      else if (status === 403) setError("Cheia a expirat sau nu ai acces.");
      else setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setMediaUrl(null);
    setKey("");
    setError("");
  };

  return (
    <ImageBackground source={BG} style={styles.bg} resizeMode="cover">
      <View style={styles.bgOverlay} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.select({ ios: "padding", android: undefined })}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          {/* Header */}
          <View style={styles.headerRow}>
            <Pressable onPress={() => router.back()} style={styles.backBtn}>
              <ThemedText style={styles.backText}>←</ThemedText>
            </Pressable>

            <View style={{ flex: 1 }}>
              <ThemedText type="title" style={styles.title}>
                Key Capsule
              </ThemedText>
              <ThemedText style={styles.subtitle}>
                Introdu parola ca să vezi poza
              </ThemedText>
            </View>

            <View style={{ width: 40 }} />
          </View>

          {/* Card */}
          <ThemedView style={styles.card}>
            {!mediaUrl ? (
              <>
                <View style={styles.pillRow}>
                  <View style={styles.pill}>
                    <ThemedText style={styles.pillText}>🔒 Locked</ThemedText>
                  </View>
                  <View style={styles.pillSoft}>
                    <ThemedText style={styles.pillTextSoft}>ID: {String(params?.id ?? "")}</ThemedText>
                  </View>
                </View>

                <ThemedText style={styles.label}>Key / Password</ThemedText>
                <TextInput
                  value={key}
                  onChangeText={setKey}
                  placeholder="Introdu cheia..."
                  placeholderTextColor="#9e9e9e"
                  secureTextEntry
                  autoCapitalize="none"
                  style={styles.input}
                />

                {!!error && (
                  <ThemedView style={styles.errorBox}>
                    <ThemedText style={styles.errorText}>{error}</ThemedText>
                  </ThemedView>
                )}

                <Pressable
                  onPress={unlock}
                  disabled={!canUnlock}
                  style={({ pressed }) => [
                    styles.primaryBtn,
                    (!canUnlock || loading) && styles.btnDisabled,
                    pressed && canUnlock && { opacity: 0.92 },
                  ]}
                >
                  {loading ? (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                      <ActivityIndicator />
                      <ThemedText style={styles.primaryBtnText}>Unlocking...</ThemedText>
                    </View>
                  ) : (
                    <ThemedText style={styles.primaryBtnText}>Unlock</ThemedText>
                  )}
                </Pressable>

                <ThemedText style={styles.hint}>
                  Dacă cheia e corectă, poza se va afișa imediat aici.
                </ThemedText>
              </>
            ) : (
              <>
                <View style={styles.pillRow}>
                  <View style={styles.pillOk}>
                    <ThemedText style={styles.pillText}>✅ Unlocked</ThemedText>
                  </View>

                  <Pressable onPress={reset} style={styles.pillSoft}>
                    <ThemedText style={styles.pillTextSoft}>Reset</ThemedText>
                  </Pressable>
                </View>

                <View style={styles.imageWrap}>
                  <Image source={{ uri: mediaUrl }} style={styles.image} />
                </View>

                <Pressable
                  onPress={() => router.replace("/(tabs)/home" as any)}
                  style={({ pressed }) => [styles.secondaryBtn, pressed && { opacity: 0.92 }]}
                >
                  <ThemedText style={styles.secondaryBtnText}>Back to feed</ThemedText>
                </Pressable>
              </>
            )}
          </ThemedView>
        </ScrollView>
      </KeyboardAvoidingView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1 },
  bgOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.16)",
  },

  container: {
    padding: 16,
    paddingBottom: 28,
    gap: 12,
  },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 4,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.92)",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
  },
  backText: {
    fontFamily: Fonts.rounded,
    fontSize: 18,
    opacity: 0.9,
  },
  title: {
    fontFamily: Fonts.rounded,
    textAlign: "center",
  },
  subtitle: {
    textAlign: "center",
    opacity: 0.8,
    marginTop: 2,
  },

  card: {
    borderRadius: 22,
    padding: 16,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    gap: 12,
  },

  pillRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  pill: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    backgroundColor: "rgba(255, 235, 205, 0.92)",
  },
  pillOk: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    backgroundColor: "rgba(215, 255, 230, 0.92)",
  },
  pillSoft: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    backgroundColor: "rgba(255,255,255,0.92)",
  },
  pillText: {
    fontFamily: Fonts.rounded,
    fontSize: 12,
    color: "#1b1b1b",
    opacity: 0.92,
  },
  pillTextSoft: {
    fontFamily: Fonts.rounded,
    fontSize: 12,
    color: "#1b1b1b",
    opacity: 0.75,
  },

  label: { opacity: 0.8, fontSize: 13 },

  input: {
    backgroundColor: "rgba(255,255,255,0.98)",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.10)",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },

  errorBox: {
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,0,0,0.25)",
    backgroundColor: "rgba(255,0,0,0.06)",
  },
  errorText: { opacity: 0.9 },

  primaryBtn: {
    alignSelf: "stretch",
    paddingVertical: 12,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 220, 195, 0.95)",
    borderWidth: 1,
    borderColor: "rgba(210, 140, 80, 0.45)",
  },
  primaryBtnText: {
    fontFamily: Fonts.rounded,
    fontSize: 16,
    color: "#1b1b1b",
  },
  btnDisabled: { opacity: 0.6 },

  hint: { opacity: 0.7, fontSize: 12, textAlign: "center" },

  imageWrap: {
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    backgroundColor: "rgba(0,0,0,0.04)",
  },
  image: {
    width: "100%",
    height: 320,
  },

  secondaryBtn: {
    alignSelf: "center",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
  },
  secondaryBtnText: {
    fontFamily: Fonts.rounded,
    opacity: 0.9,
  },
});