import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  ImageBackground,
} from "react-native";
import { router, useFocusEffect } from "expo-router";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Fonts } from "@/constants/theme";

import { getCapsules } from "@/lib/capsules";
import { getPosts, PostItem } from "@/lib/posts";

const BG = require("@/assets/images/brown-metallic-foil-background-texture-free-photo.jpg");

type Capsule = {
  capsule_id: number;
  title?: string | null;
  description?: string | null;
  capsule_type?: "time" | "co" | "key" | string;
  status?: "locked" | "open" | "archived" | string;
  open_at?: string | null;
  created_at?: string | null;
  required_contributors?: number | null;
};

type FeedItem =
  | { kind: "capsule"; ts: number; capsule: Capsule }
  | { kind: "post"; ts: number; post: PostItem };

function parseTs(value?: string | null) {
  if (!value) return 0;
  const t = Date.parse(value);
  return Number.isNaN(t) ? 0 : t;
}

function statusLabel(status?: string) {
  if (!status) return "Unknown";
  if (status === "locked") return "Locked";
  if (status === "open") return "Open";
  if (status === "archived") return "Archived";
  return status;
}

export default function HomeScreen() {
  const [capsules, setCapsules] = useState<Capsule[]>([]);
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string>("");

  const load = useCallback(async () => {
    try {
      setError("");
      setLoading(true);

      const [caps, pst] = await Promise.all([getCapsules(), getPosts()]);
      setCapsules(Array.isArray(caps) ? caps : []);
      setPosts(Array.isArray(pst) ? pst : []);
    } catch {
      setError("Nu am putut încărca feed-ul. Verifică backend-ul și EXPO_PUBLIC_API_URL.");
      setCapsules([]);
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // ✅ reîncarcă automat când revii din Create/Details
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const feed: FeedItem[] = useMemo(() => {
    const a: FeedItem[] = [];

    for (const c of capsules) {
      // prioritizăm created_at; fallback open_at
      const ts = parseTs(c.created_at) || parseTs(c.open_at);
      a.push({ kind: "capsule", ts, capsule: c });
    }

    for (const p of posts) {
      const ts = parseTs(p.created_at);
      a.push({ kind: "post", ts, post: p });
    }

    // cele mai noi sus
    a.sort((x, y) => (y.ts || 0) - (x.ts || 0));
    return a;
  }, [capsules, posts]);

  return (
    <ImageBackground source={BG} style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing || loading} onRefresh={onRefresh} />}
      >
        <ThemedText type="title" style={styles.title}>
          Home
        </ThemedText>

        <ThemedText style={styles.subtitle}>
          Feed mixt: capsule + postări
        </ThemedText>

        {loading ? (
          <ThemedView style={styles.center}>
            <ActivityIndicator />
            <ThemedText style={{ marginTop: 8 }}>Se încarcă...</ThemedText>
          </ThemedView>
        ) : error ? (
          <ThemedView style={styles.errorBox}>
            <ThemedText style={styles.errorTitle}>Eroare</ThemedText>
            <ThemedText style={styles.errorText}>{error}</ThemedText>

            <Pressable style={styles.retryBtn} onPress={load}>
              <ThemedText style={styles.retryText}>Reîncearcă</ThemedText>
            </Pressable>
          </ThemedView>
        ) : feed.length === 0 ? (
          <ThemedText style={styles.empty}>
            Nu există capsule sau postări încă.
          </ThemedText>
        ) : (
          feed.map((item, idx) => {
            if (item.kind === "capsule") {
              const c = item.capsule;
              const title = c.title?.trim() || "Untitled capsule";
              const desc = c.description?.trim() || "";
              const metaLeft =
                c.capsule_type === "co"
                  ? `Capsule • Co • req ${c.required_contributors ?? "-"}`
                  : c.capsule_type === "time"
                  ? `Capsule • Time`
                  : `Capsule • ${c.capsule_type || "type"}`;

              const metaRight = statusLabel(c.status);

              return (
                <Pressable
                  key={`c-${c.capsule_id}-${idx}`}
                  style={({ pressed }) => [styles.card, styles.capsuleCard, pressed && styles.cardPressed]}
                  onPress={() => router.push(`/capsule/${c.capsule_id}` as any)}
                >
                  <ThemedText style={styles.cardTitle}>{title}</ThemedText>

                  {desc ? (
                    <ThemedText numberOfLines={2} style={styles.cardDesc}>
                      {desc}
                    </ThemedText>
                  ) : null}

                  <ThemedView style={styles.cardMetaRow}>
                    <ThemedText style={styles.cardMeta}>{metaLeft}</ThemedText>
                    <ThemedText style={styles.cardMeta}>{metaRight}</ThemedText>
                  </ThemedView>
                </Pressable>
              );
            }

            // post
            const p = item.post;
            return (
              <ThemedView key={`p-${p.id}-${idx}`} style={[styles.card, styles.postCard]}>
                <ThemedText style={styles.postAuthor}>
                  {p.User?.name || "User"}
                </ThemedText>

                {!!p.content_text && (
                  <ThemedText style={styles.postText}>{p.content_text}</ThemedText>
                )}

                <ThemedText style={styles.postDate}>
                  {p.created_at ? new Date(p.created_at).toLocaleString() : ""}
                </ThemedText>
              </ThemedView>
            );
          })
        )}
      </ScrollView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 28, gap: 12 },

  title: { fontFamily: Fonts.rounded },
  subtitle: { opacity: 0.8, marginTop: -4, marginBottom: 6 },

  center: { marginTop: 24, alignItems: "center", justifyContent: "center" },

  empty: { textAlign: "center", opacity: 0.7, marginTop: 18 },

  card: {
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },

  capsuleCard: {
    backgroundColor: "rgba(255,255,255,0.06)",
  },

  postCard: {
    backgroundColor: "rgba(255,255,255,0.85)",
    borderColor: "rgba(255,255,255,0.35)",
  },

  cardPressed: {
    transform: [{ scale: 0.995 }],
    opacity: 0.92,
  },

  cardTitle: { fontSize: 18, fontFamily: Fonts.rounded },
  cardDesc: { marginTop: 6, opacity: 0.85 },

  cardMetaRow: {
    marginTop: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },
  cardMeta: { fontSize: 12, opacity: 0.75 },

  postAuthor: { fontWeight: "700", marginBottom: 4, color: "#000" },
  postText: { fontSize: 16, color: "#000" },
  postDate: { marginTop: 6, fontSize: 12, opacity: 0.65, color: "#000" },

  errorBox: {
    marginTop: 18,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,0,0,0.25)",
    backgroundColor: "rgba(255,0,0,0.06)",
    gap: 10,
  },
  errorTitle: { fontSize: 16, fontFamily: Fonts.rounded },
  errorText: { opacity: 0.9 },
  retryBtn: {
    alignSelf: "flex-start",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  retryText: { fontFamily: Fonts.rounded },
});
