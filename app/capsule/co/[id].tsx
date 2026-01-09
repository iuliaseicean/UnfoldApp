// app/capsule/co/[id].tsx
import React, { useMemo, useState } from "react";
import {
  Alert,
  Image,
  ImageBackground,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import * as ImagePicker from "expo-image-picker";

import api from "@/lib/api";
import { addCapsuleContribution, getCapsuleById } from "@/lib/capsules";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Fonts } from "@/constants/theme";

const BG = require("@/assets/images/brown-metallic-foil-background-texture-free-photo.jpg");

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

function getImagePickerMediaTypes(): any {
  const anyPicker: any = ImagePicker as any;
  if (anyPicker?.MediaType?.Images) return [anyPicker.MediaType.Images];
  return anyPicker?.MediaTypeOptions?.Images;
}

export default function CoCapsContributeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const capsuleId = Number(id);

  const [localUri, setLocalUri] = useState<string | null>(null);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const hint = useMemo(() => {
    if (uploadedUrl) return "Uploaded ✓";
    if (localUri) return "Selected • tap Upload";
    return "Pick an image";
  }, [localUri, uploadedUrl]);

  const pickFromGallery = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permisiune lipsă", "Te rog permite acces la galerie.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: getImagePickerMediaTypes(),
      quality: 0.85,
    });

    if (!result.canceled) {
      const uri = result.assets?.[0]?.uri;
      if (uri) {
        setLocalUri(uri);
        setUploadedUrl(null);
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
        setLocalUri(uri);
        setUploadedUrl(null);
      }
    }
  };

  const uploadSelectedImage = async (): Promise<string> => {
    if (!localUri) throw new Error("Nu ai selectat poză.");
    if (uploading) {
      if (uploadedUrl) return uploadedUrl;
      throw new Error("Upload în desfășurare...");
    }

    setUploading(true);
    try {
      const filename = getFilenameFromUri(localUri);
      const mime = guessMimeType(localUri);

      const form = new FormData();
      // @ts-ignore
      form.append("file", {
        uri: localUri,
        name: filename,
        type: mime,
      });

      const res = await api.post("/upload/image", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      const url = res?.data?.url || res?.data?.fileUrl || res?.data?.path;
      if (!url) throw new Error("Upload ok, dar serverul nu a returnat URL.");

      setUploadedUrl(url);
      return url;
    } finally {
      setUploading(false);
    }
  };

  const submit = async () => {
    if (!capsuleId) return;

    try {
      setSaving(true);

      // 1) asigură-te că ai url
      let url = uploadedUrl;
      if (localUri && !uploadedUrl) url = await uploadSelectedImage();
      if (!url) {
        Alert.alert("Lipsește poza", "Selectează o poză și apasă Upload.");
        return;
      }

      // 2) încearcă să postezi contribution
      await addCapsuleContribution(capsuleId, { media_url: url });

      Alert.alert("Succes", "Ai contribuit la Co-Caps!");
      router.back();
    } catch (e: any) {
      const msg =
        e?.response?.data?.error ||
        e?.response?.data?.message ||
        e?.message ||
        "Nu am putut salva contribuția.";
      Alert.alert("Eroare", msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ImageBackground source={BG} style={{ flex: 1 }}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color="#111" />
        </Pressable>
        <ThemedText style={styles.headerTitle}>Co-Caps • Contribute</ThemedText>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        <ThemedView style={styles.card}>
          <View style={styles.hintRow}>
            <ThemedText style={styles.hintTitle}>Photo</ThemedText>
            <View style={styles.hintPill}>
              <ThemedText style={styles.hintPillText}>{hint}</ThemedText>
            </View>
          </View>

          <View style={styles.btnRow}>
            <SmallBtn label="Gallery" onPress={pickFromGallery} />
            <SmallBtn label="Camera" onPress={takePhoto} />
            <SmallBtn
              label={uploading ? "Uploading..." : uploadedUrl ? "Uploaded" : "Upload"}
              onPress={async () => {
                try {
                  await uploadSelectedImage();
                  Alert.alert("Succes", "Imaginea a fost încărcată!");
                } catch (e: any) {
                  Alert.alert("Eroare upload", e?.message || "Nu am putut încărca imaginea.");
                }
              }}
              disabled={!localUri || uploading}
              tone={!localUri ? "muted" : uploadedUrl ? "success" : "primary"}
            />
          </View>

          {!!localUri && (
            <View style={styles.previewFrame}>
              <Image source={{ uri: localUri }} style={styles.previewImg} />
            </View>
          )}

          <Pressable
            onPress={submit}
            disabled={saving || uploading}
            style={({ pressed }) => [
              styles.primaryBtn,
              pressed && { opacity: 0.9 },
              (saving || uploading) && { opacity: 0.6 },
            ]}
          >
            <ThemedText style={styles.primaryBtnText}>
              {saving ? "Saving..." : "Submit contribution"}
            </ThemedText>
          </Pressable>
        </ThemedView>
      </ScrollView>
    </ImageBackground>
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

const styles = StyleSheet.create({
  header: {
    paddingTop: 56,
    paddingHorizontal: 14,
    paddingBottom: 12,
    backgroundColor: "rgba(255,255,255,0.90)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backBtn: {
    width: 40,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.06)",
  },
  headerTitle: { fontSize: 16, fontWeight: "800", color: "#111" },

  container: { padding: 16, paddingBottom: 28 },

  card: {
    borderRadius: 20,
    padding: 14,
    backgroundColor: "rgba(255,255,255,0.90)",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    gap: 12,
  },

  hintRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  hintTitle: { fontFamily: Fonts.rounded, fontSize: 16, color: "#111" },
  hintPill: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    backgroundColor: "rgba(0,0,0,0.04)",
  },
  hintPillText: { fontFamily: Fonts.rounded, fontSize: 12, opacity: 0.85, color: "#111" },

  btnRow: { flexDirection: "row", gap: 10, flexWrap: "wrap", justifyContent: "center" },

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
  smallBtnText: { fontFamily: Fonts.rounded, fontSize: 14, opacity: 0.9, color: "#111" },
  btnDisabled: { opacity: 0.55 },

  previewFrame: {
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    backgroundColor: "rgba(0,0,0,0.04)",
  },
  previewImg: { width: "100%", height: 260 },

  primaryBtn: {
    marginTop: 4,
    height: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    backgroundColor: "rgba(255, 220, 195, 0.95)",
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnText: { fontFamily: Fonts.rounded, fontSize: 16, color: "#111" },
});