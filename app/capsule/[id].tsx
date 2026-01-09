// app/capsule/[id].tsx
import { useEffect, useMemo, useState, useCallback } from "react";
import {
  ScrollView,
  RefreshControl,
  StyleSheet,
  ImageBackground,
  ActivityIndicator,
  View,
  Image,
  Pressable,
  Alert,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";

import { deleteCapsule, getCapsuleById } from "@/lib/capsules";
import type { Capsule } from "@/types/capsule";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";

const BG = require("@/assets/images/brown-metallic-foil-background-texture-free-photo.jpg");

type CapsuleContribution = {
  id?: number;
  capsule_id: number;
  user_id: number;
  content_text: string | null;
  media_url: string | null;
  created_at?: string;
  User?: {
    id?: number;
    user_id?: number;
    username?: string;
    email?: string;
    name?: string;
    avatar_url?: string | null;
  };
};

type CoMeta = {
  contributorsCount: number;
  isFull: boolean;
  canContribute: boolean;
  required_contributors: number | null;
};

export default function CapsuleDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const capsuleId = Number(id);

  const [capsule, setCapsule] = useState<(Capsule & { canDelete?: boolean; isMine?: boolean }) | null>(null);
  const [contributions, setContributions] = useState<CapsuleContribution[]>([]);
  const [co, setCo] = useState<CoMeta | null>(null);

  const [loading, setLoading] = useState(true);
  const [busyDelete, setBusyDelete] = useState(false);

  const loadCapsule = useCallback(async () => {
    if (!capsuleId) return;
    setLoading(true);
    try {
      const data: any = await getCapsuleById(capsuleId);

      setCapsule(data?.capsule ?? null);
      setContributions(Array.isArray(data?.contributions) ? data.contributions : []);
      setCo(data?.co ?? null);
    } catch {
      setCapsule(null);
      setContributions([]);
      setCo(null);
    } finally {
      setLoading(false);
    }
  }, [capsuleId]);

  useEffect(() => {
    loadCapsule();
  }, [loadCapsule]);

  const isCo = (capsule?.capsule_type as string) === "co";

  const coverUrl = useMemo(() => {
    const anyCapsule: any = capsule as any;
    return anyCapsule?.cover_url || anyCapsule?.media_url || null;
  }, [capsule]);

  const imageContribs = useMemo(() => contributions.filter((c) => !!c?.media_url), [contributions]);

  const canContribute = useMemo(() => {
    if (!isCo) return false;
    if (!co) return false;
    return !!co.canContribute;
  }, [isCo, co]);

  const progressLabel = useMemo(() => {
    if (!isCo) return null;
    const req = Number((capsule as any)?.required_contributors ?? co?.required_contributors ?? 0) || 0;
    const cnt = Number(co?.contributorsCount ?? 0) || 0;
    if (!req) return `Contributors: ${cnt}`;
    return `Contributors: ${cnt}/${req}`;
  }, [isCo, capsule, co]);

  const openCoContribute = () => {
    if (!capsuleId) return;
    router.push({
      pathname: "/capsule/co/[id]",
      params: { id: String(capsuleId) },
    } as any);
  };

  const canDelete = useMemo(() => {
    return !!(capsule as any)?.canDelete || !!(capsule as any)?.isMine;
  }, [capsule]);

  const onDelete = useCallback(() => {
    if (!capsuleId || busyDelete) return;

    Alert.alert(
      "Șterge capsula?",
      "Acțiunea este permanentă. Se șterg și contribuțiile/cheia asociată.",
      [
        { text: "Anulează", style: "cancel" },
        {
          text: "Șterge",
          style: "destructive",
          onPress: async () => {
            try {
              setBusyDelete(true);
              await deleteCapsule(capsuleId);
              Alert.alert("Șters", "Capsula a fost ștearsă.");
              router.replace("/(tabs)/home");
            } catch (e: any) {
              const msg =
                e?.response?.data?.error ||
                e?.response?.data?.message ||
                e?.message ||
                "Nu am putut șterge capsula.";
              Alert.alert("Eroare", msg);
            } finally {
              setBusyDelete(false);
            }
          },
        },
      ]
    );
  }, [capsuleId, busyDelete]);

  return (
    <ImageBackground source={BG} style={{ flex: 1 }}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color="#111" />
        </Pressable>

        <ThemedText style={styles.headerTitle}>Capsule</ThemedText>

        {canDelete ? (
          <Pressable onPress={onDelete} disabled={busyDelete} style={[styles.trashBtn, busyDelete && { opacity: 0.6 }]}>
            <Ionicons name="trash-outline" size={18} color="#111" />
          </Pressable>
        ) : (
          <View style={{ width: 40 }} />
        )}
      </View>

      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadCapsule} />}
      >
        {loading ? (
          <ThemedView style={styles.center}>
            <ActivityIndicator />
            <ThemedText style={[styles.textDark, { marginTop: 8 }]}>Loading capsule…</ThemedText>
          </ThemedView>
        ) : !capsule ? (
          <ThemedText style={[styles.notFound, styles.textDark]}>Capsule not found.</ThemedText>
        ) : (
          <ThemedView style={styles.card}>
            {/* COVER */}
            {!!coverUrl && (
              <View style={styles.coverWrap}>
                <Image source={{ uri: coverUrl }} style={styles.coverImg} />
              </View>
            )}

            {/* TITLE */}
            <ThemedText type="title" style={[styles.title, styles.textDark]}>
              {capsule.title ?? "Untitled capsule"}
            </ThemedText>

            {/* DESCRIPTION */}
            {!!capsule.description && (
              <ThemedText style={[styles.desc, styles.textDark]}>{capsule.description}</ThemedText>
            )}

            {/* META */}
            <View style={styles.metaRow}>
              <Pill text={`Type: ${capsule.capsule_type}`} />
              <Pill text={`Status: ${capsule.status}`} />
              {isCo && !!progressLabel && <Pill text={progressLabel} />}
            </View>

            {/* CO CTA */}
            {isCo && (
              <View style={{ marginTop: 10 }}>
                {co?.isFull ? (
                  <ThemedText style={[styles.metaText, styles.textDark]}>
                    ✅ Co-Caps is full. Waiting to open (or open rules).
                  </ThemedText>
                ) : null}

                {canContribute ? (
                  <Pressable onPress={openCoContribute} style={({ pressed }) => [styles.plusBtn, pressed && { opacity: 0.9 }]}>
                    <Ionicons name="add" size={18} color="#111" />
                    <ThemedText style={styles.plusBtnText}>Add contribution</ThemedText>
                  </Pressable>
                ) : (
                  <ThemedText style={[styles.metaText, styles.textDark]}>
                    {co
                      ? "Nu poți contribui (ai contribuit deja / e full / e open / e archived)."
                      : "Co meta not available (check backend)."}
                  </ThemedText>
                )}
              </View>
            )}

            {/* CONTRIBUTIONS */}
            <ThemedText style={[styles.sectionTitle, styles.textDark]}>Contributions</ThemedText>

            {contributions.length === 0 ? (
              <ThemedText style={[styles.metaText, styles.textDark]}>
                No contributions yet (or capsule still locked).
              </ThemedText>
            ) : (
              <>
                {/* COLAJ (doar dacă există poze) */}
                {imageContribs.length > 0 && (
                  <View style={styles.grid}>
                    {imageContribs.slice(0, 9).map((c, idx) => (
                      <View key={c.id ?? idx} style={styles.gridItem}>
                        <Image source={{ uri: c.media_url! }} style={styles.gridImg} />
                      </View>
                    ))}
                  </View>
                )}

                {/* LISTĂ */}
                {contributions.map((c, idx) => {
                  const author = c?.User?.username || c?.User?.name || c?.User?.email || "User";
                  return (
                    <ThemedView key={c.id ?? idx} style={styles.contribution}>
                      <ThemedText style={[styles.contributionAuthor, styles.textDark]}>{author}</ThemedText>

                      {!!c?.content_text && (
                        <ThemedText style={[styles.contributionText, styles.textDark]}>
                          {c.content_text}
                        </ThemedText>
                      )}

                      {!!c?.media_url && (
                        <View style={styles.inlineImgWrap}>
                          <Image source={{ uri: c.media_url }} style={styles.inlineImg} />
                        </View>
                      )}

                      {!!c?.created_at && (
                        <ThemedText style={[styles.contributionDate, styles.textDark]}>
                          {new Date(c.created_at).toLocaleString()}
                        </ThemedText>
                      )}
                    </ThemedView>
                  );
                })}
              </>
            )}
          </ThemedView>
        )}
      </ScrollView>
    </ImageBackground>
  );
}

function Pill({ text }: { text: string }) {
  return (
    <View style={styles.pill}>
      <ThemedText style={styles.pillText}>{text}</ThemedText>
    </View>
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
  trashBtn: {
    width: 40,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.06)",
  },

  container: { padding: 16, paddingBottom: 28 },
  center: { marginTop: 40, alignItems: "center" },
  textDark: { color: "#000" },
  notFound: { padding: 16 },

  card: {
    borderRadius: 18,
    padding: 14,
    backgroundColor: "rgba(255,255,255,0.88)",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
  },

  coverWrap: {
    borderRadius: 16,
    overflow: "hidden",
    height: 200,
    backgroundColor: "rgba(0,0,0,0.04)",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    marginBottom: 12,
  },
  coverImg: { width: "100%", height: "100%" },

  title: { marginBottom: 8 },
  desc: { opacity: 0.85, marginBottom: 10 },

  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 6 },
  pill: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.06)",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
  },
  pillText: { fontSize: 12, opacity: 0.85, color: "#111", fontWeight: "700" },
  metaText: { marginTop: 8, fontSize: 13, opacity: 0.85 },

  plusBtn: {
    marginTop: 10,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    backgroundColor: "rgba(255, 220, 195, 0.95)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  plusBtnText: { fontWeight: "800", color: "#111" },

  sectionTitle: { marginTop: 16, fontSize: 16, fontWeight: "800" },

  grid: {
    marginTop: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  gridItem: {
    width: "31%",
    aspectRatio: 1,
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    backgroundColor: "rgba(0,0,0,0.04)",
  },
  gridImg: { width: "100%", height: "100%" },

  contribution: {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.06)",
  },
  contributionAuthor: { fontWeight: "800", marginBottom: 6 },
  contributionText: { fontSize: 14 },

  inlineImgWrap: {
    marginTop: 10,
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    backgroundColor: "rgba(0,0,0,0.04)",
  },
  inlineImg: { width: "100%", height: 220 },

  contributionDate: { marginTop: 6, fontSize: 12, opacity: 0.6 },
});