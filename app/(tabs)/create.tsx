import React, { useMemo, useState } from "react";
import {
  Alert,
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";

import api from "@/lib/api";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Fonts } from "@/constants/theme";

type CreateMode = "post" | "time" | "contributors" | "key";

const BG = require("@/assets/images/brown-metallic-foil-background-texture-free-photo.jpg");

function parseOptionalInt(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const n = Number(trimmed);
  if (Number.isNaN(n)) return undefined;
  return n;
}

function normalizeIsoDate(value: string) {
  // Acceptă: "YYYY-MM-DD HH:mm" sau "YYYY-MM-DDTHH:mm"
  const v = value.trim();
  if (!v) return "";
  if (v.includes("T")) return v;
  return v.replace(" ", "T");
}

export default function CreateScreen() {
  const [mode, setMode] = useState<CreateMode>("time");

  // Common capsule
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  // Time capsule
  const [openAt, setOpenAt] = useState(""); // "2025-12-31 18:30" / "2025-12-31T18:30"
  const [visibilityHours, setVisibilityHours] = useState(""); // opțional

  // Co-Caps
  const [requiredContributors, setRequiredContributors] = useState("");

  // Key Caps (MVP UI)
  const [keyExpiresAt, setKeyExpiresAt] = useState(""); // opțional

  // Post normal
  const [postText, setPostText] = useState("");
  const [postMediaUrl, setPostMediaUrl] = useState(""); // opțional (URL)

  const [loading, setLoading] = useState(false);

  const subtitle = useMemo(() => {
    switch (mode) {
      case "post":
        return "Postare normală (mereu în feed)";
      case "time":
        return "Time Capsule (se deschide la o dată/oră)";
      case "contributors":
        return "Co-Caps (se deschide când contribuie N persoane)";
      case "key":
        return "Key Caps (acces cu cheie / QR)";
      default:
        return "";
    }
  }, [mode]);

  const resetCapsuleForm = () => {
    setTitle("");
    setDescription("");
    setOpenAt("");
    setVisibilityHours("");
    setRequiredContributors("");
    setKeyExpiresAt("");
  };

  const resetPostForm = () => {
    setPostText("");
    setPostMediaUrl("");
  };

  const goToCapsuleDetails = (capsuleId: number) => {
    router.push({
      pathname: "/capsule/[id]" as const,
      params: { id: String(capsuleId) },
    });
  };

  const handleCreatePost = async () => {
    if (loading) return;

    const text = postText.trim();
    const media_url = postMediaUrl.trim() || null;

    if (!text && !media_url) {
      Alert.alert("Lipsește conținutul", "Scrie un text sau adaugă un media_url.");
      return;
    }

    try {
      setLoading(true);

      // ✅ presupunere: backend are POST /posts
      await api.post("/content/posts", { content_text: text || null, media_url });


      Alert.alert("Succes", "Postarea a fost creată!");
      resetPostForm();

      // du-te la feed
      router.replace("/(tabs)/home");
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || "Nu am putut crea postarea.";
      Alert.alert("Eroare", msg);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCapsule = async () => {
    if (loading) return;

    const cleanTitle = title.trim();
    const cleanDesc = description.trim();

    if (!cleanTitle) {
      Alert.alert("Lipsește titlul", "Te rog completează titlul capsulei.");
      return;
    }

    // Validări pe tip
    let payload: any = {
    title: cleanTitle,
    description: cleanDesc || null,
    capsule_type: mode === "contributors" ? "co" : mode,
    };


    if (mode === "time") {
      const iso = normalizeIsoDate(openAt);
      if (!iso) {
        Alert.alert(
          "Lipsește data",
          'Pentru Time Capsule completează "Open at" (ex: 2025-12-31 18:30).'
        );
        return;
      }
      payload.open_at = iso;

      const hours = parseOptionalInt(visibilityHours);
      if (visibilityHours.trim() && hours === undefined) {
        Alert.alert("Valoare invalidă", "Visibility hours trebuie să fie un număr.");
        return;
      }
      if (hours !== undefined) payload.visibility_duration = hours; // ore
    }

    if (mode === "contributors") {
      const req = parseOptionalInt(requiredContributors);
      if (req === undefined || req < 2) {
        Alert.alert("Valoare invalidă", "Required contributors trebuie să fie un număr (minim 2).");
        return;
      }
      payload.required_contributors = req;
    }

    if (mode === "key") {
      const exp = normalizeIsoDate(keyExpiresAt);
      if (exp) payload.key_expires_at = exp; // dacă backend-ul nu folosește încă, îl ignoră
    }

    try {
      setLoading(true);

      const res = await api.post("/capsules", payload);

      const capsuleId: number =
        res?.data?.capsule_id ?? res?.data?.id ?? res?.data?.capsule?.capsule_id;

      Alert.alert("Succes", "Capsula a fost creată!");
      resetCapsuleForm();

      if (capsuleId) {
        goToCapsuleDetails(capsuleId);
      } else {
        router.replace("/(tabs)/home");
      }
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || "Nu am putut crea capsula.";
      Alert.alert("Eroare", msg);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (mode === "post") return handleCreatePost();
    return handleCreateCapsule();
  };

  return (
    <ImageBackground source={BG} style={styles.bg} resizeMode="cover">
      <View style={styles.bgOverlay} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.select({ ios: "padding", android: undefined })}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <ThemedText
            type="title"
            style={{ fontFamily: Fonts.rounded, textAlign: "center", marginBottom: 6 }}
          >
            Create
          </ThemedText>

          <ThemedText style={styles.subtitle}>{subtitle}</ThemedText>

          <ThemedView style={styles.card}>
            {/* Mode pills */}
            <View style={styles.pillsRow}>
              <Pill label="Post" active={mode === "post"} onPress={() => setMode("post")} />
              <Pill label="Time" active={mode === "time"} onPress={() => setMode("time")} />
              <Pill
                label="Co-Caps"
                active={mode === "contributors"}
                onPress={() => setMode("contributors")}
              />
              <Pill label="Key" active={mode === "key"} onPress={() => setMode("key")} />
            </View>

            {/* Content */}
            {mode === "post" ? (
              <ThemedView style={styles.section}>
                <ThemedText style={styles.sectionTitle}>Postare normală</ThemedText>

                <Label text="Text (optional)" />
                <TextInput
                  placeholder="Scrie ceva..."
                  placeholderTextColor="#9e9e9e"
                  value={postText}
                  onChangeText={setPostText}
                  style={[styles.input, styles.multiline]}
                  multiline
                />

                <Label text="Media URL (optional)" />
                <TextInput
                  placeholder="https://..."
                  placeholderTextColor="#9e9e9e"
                  value={postMediaUrl}
                  onChangeText={setPostMediaUrl}
                  style={styles.input}
                  autoCapitalize="none"
                />

                <Pressable
                  style={[styles.primaryBtn, loading && styles.disabledBtn]}
                  onPress={handleCreate}
                >
                  <ThemedText style={styles.primaryBtnText}>
                    {loading ? "Creating..." : "Create post"}
                  </ThemedText>
                </Pressable>
              </ThemedView>
            ) : (
              <>
                <ThemedView style={styles.section}>
                  <Label text="Title" />
                  <TextInput
                    placeholder="Ex: Summer memories"
                    placeholderTextColor="#9e9e9e"
                    value={title}
                    onChangeText={setTitle}
                    style={styles.input}
                  />

                  <Label text="Description (optional)" />
                  <TextInput
                    placeholder="Short description..."
                    placeholderTextColor="#9e9e9e"
                    value={description}
                    onChangeText={setDescription}
                    style={[styles.input, styles.multiline]}
                    multiline
                  />
                </ThemedView>

                {mode === "time" && (
                  <ThemedView style={styles.section}>
                    <ThemedText style={styles.sectionTitle}>Time Capsule</ThemedText>

                    <Label text="Open at" />
                    <TextInput
                      placeholder="YYYY-MM-DD HH:mm (ex: 2025-12-31 18:30)"
                      placeholderTextColor="#9e9e9e"
                      value={openAt}
                      onChangeText={setOpenAt}
                      style={styles.input}
                      autoCapitalize="none"
                    />

                    <Label text="Visibility hours (optional)" />
                    <TextInput
                      placeholder="Ex: 24"
                      placeholderTextColor="#9e9e9e"
                      value={visibilityHours}
                      onChangeText={setVisibilityHours}
                      style={styles.input}
                      keyboardType="numeric"
                    />

                    <ThemedText style={styles.helper}>
                      Tip: poți scrie și cu „T” (ex: 2025-12-31T18:30).
                    </ThemedText>
                  </ThemedView>
                )}

                {mode === "contributors" && (
                  <ThemedView style={styles.section}>
                    <ThemedText style={styles.sectionTitle}>Co-Caps</ThemedText>

                    <Label text="Required contributors" />
                    <TextInput
                      placeholder="Ex: 3"
                      placeholderTextColor="#9e9e9e"
                      value={requiredContributors}
                      onChangeText={setRequiredContributors}
                      style={styles.input}
                      keyboardType="numeric"
                    />

                    <ThemedText style={styles.helper}>
                      Capsula se va deschide când contribuie cel puțin N persoane.
                    </ThemedText>
                  </ThemedView>
                )}

                {mode === "key" && (
                  <ThemedView style={styles.section}>
                    <ThemedText style={styles.sectionTitle}>Key Caps</ThemedText>

                    <ThemedText style={styles.helper}>
                      În MVP creăm capsula ca tip "key". După ce backend-ul returnează cheia/QR,
                      o afișăm aici.
                    </ThemedText>

                    <Label text="Key expires at (optional)" />
                    <TextInput
                      placeholder="YYYY-MM-DD HH:mm (optional)"
                      placeholderTextColor="#9e9e9e"
                      value={keyExpiresAt}
                      onChangeText={setKeyExpiresAt}
                      style={styles.input}
                      autoCapitalize="none"
                    />
                  </ThemedView>
                )}

                <Pressable
                  style={[styles.primaryBtn, loading && styles.disabledBtn]}
                  onPress={handleCreate}
                >
                  <ThemedText style={styles.primaryBtnText}>
                    {loading ? "Creating..." : "Create capsule"}
                  </ThemedText>
                </Pressable>
              </>
            )}
          </ThemedView>

          <ThemedText style={styles.footerHint}>
            Ca să funcționeze “Create”, backend-ul trebuie să fie pornit (altfel primești Network
            Error).
          </ThemedText>
        </ScrollView>
      </KeyboardAvoidingView>
    </ImageBackground>
  );
}

function Pill({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.pill, active ? styles.pillActive : styles.pillInactive]}
    >
      <ThemedText style={[styles.pillText, active && styles.pillTextActive]}>{label}</ThemedText>
    </Pressable>
  );
}

function Label({ text }: { text: string }) {
  return <ThemedText style={styles.label}>{text}</ThemedText>;
}

const styles = StyleSheet.create({
  bg: { flex: 1 },
  bgOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.18)",
  },

  container: {
    padding: 16,
    paddingBottom: 28,
    gap: 10,
  },

  subtitle: {
    textAlign: "center",
    opacity: 0.9,
    marginBottom: 8,
  },

  card: {
    borderRadius: 26,
    padding: 16,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.82)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
  },

  pillsRow: {
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
    justifyContent: "center",
    marginBottom: 14,
  },

  pill: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
  },
  pillActive: {
    backgroundColor: "rgba(255, 220, 195, 0.95)",
    borderColor: "rgba(210, 140, 80, 0.55)",
  },
  pillInactive: {
    backgroundColor: "rgba(255,255,255,0.55)",
    borderColor: "rgba(0,0,0,0.08)",
  },
  pillText: {
    fontSize: 14,
    opacity: 0.9,
    fontFamily: Fonts.rounded,
  },
  pillTextActive: {
    opacity: 1,
  },

  section: {
    padding: 12,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.55)",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
    marginBottom: 12,
  },

  sectionTitle: {
    fontFamily: Fonts.rounded,
    fontSize: 16,
    marginBottom: 10,
  },

  label: {
    marginBottom: 6,
    opacity: 0.75,
    fontSize: 13,
  },

  input: {
    backgroundColor: "rgba(255,255,255,0.9)",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    marginBottom: 10,
  },

  multiline: {
    minHeight: 90,
    textAlignVertical: "top",
  },

  helper: {
    opacity: 0.75,
    fontSize: 13,
    marginTop: 2,
  },

  primaryBtn: {
    marginTop: 6,
    alignSelf: "center",
    paddingVertical: 12,
    paddingHorizontal: 26,
    borderRadius: 999,
    backgroundColor: "rgba(255, 220, 195, 0.95)",
    borderWidth: 1,
    borderColor: "rgba(210, 140, 80, 0.55)",
  },
  primaryBtnText: {
    fontFamily: Fonts.rounded,
    fontSize: 16,
  },

  disabledBtn: {
    opacity: 0.65,
  },

  footerHint: {
    textAlign: "center",
    opacity: 0.8,
    marginTop: 4,
    fontSize: 12,
  },
});