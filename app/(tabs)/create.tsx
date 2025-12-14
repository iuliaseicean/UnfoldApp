import React, { useMemo, useState } from "react";
import {
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
import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";

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
  const v = value.trim();
  if (!v) return "";
  if (v.includes("T")) return v;
  return v.replace(" ", "T");
}

function getFilenameFromUri(uri: string) {
  const last = uri.split("/").pop() || `upload-${Date.now()}.jpg`;
  return last.includes(".") ? last : `${last}.jpg`;
}

function guessMimeType(uri: string) {
  const lower = uri.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".heic") || lower.endsWith(".heif")) return "image/heic";
  return "image/jpeg";
}

export default function CreateScreen() {
  const [mode, setMode] = useState<CreateMode>("time");

  // Common capsule
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  // Time capsule
  const [openAt, setOpenAt] = useState("");
  const [visibilityHours, setVisibilityHours] = useState("");

  // Co-Caps
  const [requiredContributors, setRequiredContributors] = useState("");

  // Key Caps
  const [keyExpiresAt, setKeyExpiresAt] = useState("");
  const [keyPlain, setKeyPlain] = useState(""); // ✅ parola/cheia aleasă de creator
  const [keyPlain2, setKeyPlain2] = useState(""); // ✅ confirmare

  // Post normal
  const [postText, setPostText] = useState("");

  // Media
  const [localImageUri, setLocalImageUri] = useState<string | null>(null);
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

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
        return "Key Caps (QR + cheie)";
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
    setKeyPlain("");
    setKeyPlain2("");
  };

  const resetPostForm = () => {
    setPostText("");
  };

  const resetMedia = () => {
    setLocalImageUri(null);
    setUploadedImageUrl(null);
  };

  const goToCapsuleDetails = (capsuleId: number) => {
    router.push({
      pathname: "/capsule/[id]" as const,
      params: { id: String(capsuleId) },
    });
  };

  // ─────────────────────────────────────────────
  // 1) Pick / Camera
  // ─────────────────────────────────────────────
  const pickFromGallery = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permisiune lipsă", "Te rog permite acces la galerie.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
    });

    if (!result.canceled) {
      const uri = result.assets?.[0]?.uri;
      if (uri) {
        setLocalImageUri(uri);
        setUploadedImageUrl(null);
      }
    }
  };

  const takePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permisiune lipsă", "Te rog permite acces la cameră.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({ quality: 0.85 });

    if (!result.canceled) {
      const uri = result.assets?.[0]?.uri;
      if (uri) {
        setLocalImageUri(uri);
        setUploadedImageUrl(null);
      }
    }
  };

  // ─────────────────────────────────────────────
  // 2) Upload la backend → primești URL
  // ✅ Endpoint-ul tău este /upload/image
  // ─────────────────────────────────────────────
  const uploadSelectedImage = async () => {
    if (!localImageUri) {
      Alert.alert("Nu ai selectat poză", "Alege o poză din galerie sau fă una cu camera.");
      return;
    }
    if (uploading) return;

    try {
      setUploading(true);

      const filename = getFilenameFromUri(localImageUri);
      const mime = guessMimeType(localImageUri);

      const form = new FormData();
      // @ts-ignore - RN FormData file type
      form.append("file", {
        uri: localImageUri,
        name: filename,
        type: mime,
      });

      // ✅ corect: /upload/image
      const res = await api.post("/upload/image", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      const url = res?.data?.url || res?.data?.fileUrl || res?.data?.path;
      if (!url) throw new Error("Upload ok, dar serverul nu a returnat URL.");

      setUploadedImageUrl(url);
      Alert.alert("Succes", "Imaginea a fost încărcată!");
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || "Nu am putut încărca imaginea.";
      Alert.alert("Eroare upload", msg);
    } finally {
      setUploading(false);
    }
  };

  // ─────────────────────────────────────────────
  // 3) Create Post
  // ─────────────────────────────────────────────
  const handleCreatePost = async () => {
    if (loading) return;

    const text = postText.trim();
    const media_url = uploadedImageUrl || null;

    if (!text && !media_url) {
      Alert.alert("Lipsește conținutul", "Scrie un text sau încarcă o poză.");
      return;
    }

    try {
      setLoading(true);

      await api.post("/content/posts", {
        content_text: text || null,
        media_url,
        visibility: "public",
      });

      Alert.alert("Succes", "Postarea a fost creată!");
      resetPostForm();
      resetMedia();
      router.replace("/(tabs)/home");
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || "Nu am putut crea postarea.";
      Alert.alert("Eroare", msg);
    } finally {
      setLoading(false);
    }
  };

  // ─────────────────────────────────────────────
  // 4) Create Capsule
  // ─────────────────────────────────────────────
  const handleCreateCapsule = async () => {
    if (loading) return;

    const cleanTitle = title.trim();
    const cleanDesc = description.trim();

    if (!cleanTitle) {
      Alert.alert("Lipsește titlul", "Te rog completează titlul capsulei.");
      return;
    }

    // ✅ pentru key: ai nevoie de poză + cheie
    if (mode === "key") {
      if (!uploadedImageUrl) {
        Alert.alert("Lipsește poza", "Pentru Key Caps trebuie să încarci o poză (Upload).");
        return;
      }
      if (!keyPlain.trim() || keyPlain.trim().length < 4) {
        Alert.alert("Cheie invalidă", "Alege o cheie de minim 4 caractere.");
        return;
      }
      if (keyPlain.trim() !== keyPlain2.trim()) {
        Alert.alert("Cheia nu coincide", "Confirmarea cheii nu este identică.");
        return;
      }
    }

    let payload: any = {
      title: cleanTitle,
      description: cleanDesc || null,
      capsule_type: mode === "contributors" ? "co" : mode,
      cover_url: uploadedImageUrl || null,
      media_url: uploadedImageUrl || null,
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
      if (hours !== undefined) payload.visibility_duration = hours;
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
      if (exp) payload.key_expires_at = exp;

      // ✅ CHEIE trimisă la backend (exact cum am pus în route: key_plain)
      payload.key_plain = keyPlain.trim();
    }

    try {
      setLoading(true);

      const res = await api.post("/capsules", payload);

      const capsuleId: number =
        res?.data?.capsule_id ?? res?.data?.id ?? res?.data?.capsule?.capsule_id;

      Alert.alert("Succes", mode === "key" ? "Key capsule + QR creată!" : "Capsula a fost creată!");
      resetCapsuleForm();
      resetMedia();

      if (capsuleId) goToCapsuleDetails(capsuleId);
      else router.replace("/(tabs)/home");
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

  const ensureUploadedIfNeeded = async () => {
    if (localImageUri && !uploadedImageUrl) {
      await uploadSelectedImage();
    }
  };

  const photoHint = uploadedImageUrl
    ? "Uploaded ✓"
    : localImageUri
    ? "Selected • tap Upload"
    : "Optional";

  return (
    <ImageBackground source={BG} style={styles.bg} resizeMode="cover">
      <View style={styles.bgOverlay} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.select({ ios: "padding", android: undefined })}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <ThemedText type="title" style={styles.title}>
              Create
            </ThemedText>
            <ThemedText style={styles.subtitle}>{subtitle}</ThemedText>
          </View>

          <ThemedView style={styles.card}>
            {/* Pills */}
            <View style={styles.pillsRow}>
              <Pill label="Post" active={mode === "post"} onPress={() => setMode("post")} />
              <Pill label="Time" active={mode === "time"} onPress={() => setMode("time")} />
              <Pill label="Co-Caps" active={mode === "contributors"} onPress={() => setMode("contributors")} />
              <Pill label="Key" active={mode === "key"} onPress={() => setMode("key")} />
            </View>

            {/* Photo */}
            <ThemedView style={styles.photoCard}>
              <View style={styles.photoHeaderRow}>
                <ThemedText style={styles.photoTitle}>Photo</ThemedText>
                <View
                  style={[
                    styles.photoPill,
                    uploadedImageUrl ? styles.photoPillOk : localImageUri ? styles.photoPillWarn : null,
                  ]}
                >
                  <ThemedText style={styles.photoPillText}>{photoHint}</ThemedText>
                </View>
              </View>

              <View style={styles.photoButtonsRow}>
                <SmallBtn label="Gallery" onPress={pickFromGallery} />
                <SmallBtn label="Camera" onPress={takePhoto} />
                <SmallBtn
                  label={uploading ? "Uploading..." : uploadedImageUrl ? "Uploaded" : "Upload"}
                  onPress={uploadSelectedImage}
                  disabled={!localImageUri || uploading}
                  tone={!localImageUri ? "muted" : uploadedImageUrl ? "success" : "primary"}
                />
              </View>

              {!!localImageUri && (
                <View style={styles.previewFrame}>
                  <Image source={{ uri: localImageUri }} style={styles.previewImg} />
                  <View style={styles.previewFade} />
                </View>
              )}

              {(localImageUri || uploadedImageUrl) && (
                <Pressable onPress={resetMedia} style={styles.removeRow}>
                  <ThemedText style={styles.removeText}>Remove photo</ThemedText>
                </Pressable>
              )}
            </ThemedView>

            {/* CONTENT */}
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

                <Pressable
                  style={[styles.primaryBtn, (loading || uploading) && styles.disabledBtn]}
                  onPress={async () => {
                    await ensureUploadedIfNeeded();
                    await handleCreate();
                  }}
                  disabled={loading || uploading}
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
                  </ThemedView>
                )}

                {mode === "key" && (
                  <ThemedView style={styles.section}>
                    <ThemedText style={styles.sectionTitle}>Key Caps</ThemedText>

                    <ThemedText style={styles.helper}>
                      Setează o cheie. După creare, în feed va apărea un QR care se scanează pentru a debloca poza.
                    </ThemedText>

                    <Label text="Cheie (min 4 caractere)" />
                    <TextInput
                      placeholder="Ex: unfold123"
                      placeholderTextColor="#9e9e9e"
                      value={keyPlain}
                      onChangeText={setKeyPlain}
                      style={styles.input}
                      autoCapitalize="none"
                      secureTextEntry
                    />

                    <Label text="Confirmă cheia" />
                    <TextInput
                      placeholder="Repetă cheia"
                      placeholderTextColor="#9e9e9e"
                      value={keyPlain2}
                      onChangeText={setKeyPlain2}
                      style={styles.input}
                      autoCapitalize="none"
                      secureTextEntry
                    />

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
                  style={[styles.primaryBtn, (loading || uploading) && styles.disabledBtn]}
                  onPress={async () => {
                    await ensureUploadedIfNeeded();
                    await handleCreate();
                  }}
                  disabled={loading || uploading}
                >
                  <ThemedText style={styles.primaryBtnText}>
                    {loading ? "Creating..." : "Create capsule"}
                  </ThemedText>
                </Pressable>
              </>
            )}
          </ThemedView>

          <ThemedText style={styles.footerHint}>
            Backend-ul trebuie să fie pornit + ngrok (dacă testezi pe telefon).
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
    <Pressable onPress={onPress} style={[styles.pill, active ? styles.pillActive : styles.pillInactive]}>
      <ThemedText style={[styles.pillText, active && styles.pillTextActive]}>{label}</ThemedText>
    </Pressable>
  );
}

function SmallBtn({
  label,
  onPress,
  disabled,
  tone = "default",
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  tone?: "default" | "primary" | "success" | "muted";
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.smallBtn,
        tone === "primary" && styles.smallBtnPrimary,
        tone === "success" && styles.smallBtnSuccess,
        tone === "muted" && styles.smallBtnMuted,
        disabled && styles.btnDisabled,
      ]}
    >
      <ThemedText style={styles.smallBtnText}>{label}</ThemedText>
    </Pressable>
  );
}

function Label({ text }: { text: string }) {
  return <ThemedText style={styles.label}>{text}</ThemedText>;
}

const styles = StyleSheet.create({
  bg: { flex: 1 },
  bgOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.16)" },

  container: { padding: 16, paddingBottom: 28, gap: 10 },

  header: { alignItems: "center", gap: 6, marginBottom: 4 },
  title: { fontFamily: Fonts.rounded, textAlign: "center" },
  subtitle: { textAlign: "center", opacity: 0.88, marginBottom: 2 },

  card: {
    borderRadius: 26,
    padding: 16,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.84)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
  },

  pillsRow: { flexDirection: "row", gap: 10, flexWrap: "wrap", justifyContent: "center", marginBottom: 14 },

  pill: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1 },
  pillActive: { backgroundColor: "rgba(255, 220, 195, 0.95)", borderColor: "rgba(210, 140, 80, 0.55)" },
  pillInactive: { backgroundColor: "rgba(255,255,255,0.58)", borderColor: "rgba(0,0,0,0.08)" },
  pillText: { fontSize: 14, opacity: 0.9, fontFamily: Fonts.rounded },
  pillTextActive: { opacity: 1 },

  photoCard: {
    borderRadius: 20,
    padding: 12,
    backgroundColor: "rgba(255,255,255,0.55)",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
    marginBottom: 12,
  },
  photoHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 },
  photoTitle: { fontFamily: Fonts.rounded, fontSize: 16 },
  photoPill: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    backgroundColor: "rgba(255,255,255,0.75)",
  },
  photoPillOk: { backgroundColor: "rgba(220, 255, 230, 0.8)" },
  photoPillWarn: { backgroundColor: "rgba(255, 240, 210, 0.85)" },
  photoPillText: { fontFamily: Fonts.rounded, fontSize: 12, opacity: 0.85 },

  photoButtonsRow: { flexDirection: "row", gap: 10, justifyContent: "center", marginTop: 10, flexWrap: "wrap" },

  smallBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    backgroundColor: "rgba(255,255,255,0.88)",
  },
  smallBtnPrimary: { backgroundColor: "rgba(255, 220, 195, 0.95)", borderColor: "rgba(210, 140, 80, 0.45)" },
  smallBtnSuccess: { backgroundColor: "rgba(220, 255, 230, 0.85)" },
  smallBtnMuted: { opacity: 0.6 },
  smallBtnText: { fontFamily: Fonts.rounded, fontSize: 14, opacity: 0.9 },
  btnDisabled: { opacity: 0.55 },

  previewFrame: {
    marginTop: 12,
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    backgroundColor: "rgba(0,0,0,0.04)",
  },
  previewImg: { width: "100%", height: 210 },
  previewFade: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.06)" },

  removeRow: { alignSelf: "center", marginTop: 10, paddingVertical: 6, paddingHorizontal: 10 },
  removeText: { textDecorationLine: "underline", opacity: 0.75, fontSize: 13 },

  section: {
    padding: 12,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.55)",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
    marginBottom: 12,
  },
  sectionTitle: { fontFamily: Fonts.rounded, fontSize: 16, marginBottom: 10 },

  label: { marginBottom: 6, opacity: 0.75, fontSize: 13 },

  input: {
    backgroundColor: "rgba(255,255,255,0.92)",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    marginBottom: 10,
  },

  multiline: { minHeight: 90, textAlignVertical: "top" },

  helper: { opacity: 0.75, fontSize: 13, marginTop: 2 },

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
  primaryBtnText: { fontFamily: Fonts.rounded, fontSize: 16 },

  disabledBtn: { opacity: 0.65 },

  footerHint: { textAlign: "center", opacity: 0.8, marginTop: 4, fontSize: 12 },
});