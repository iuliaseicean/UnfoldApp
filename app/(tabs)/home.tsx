import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  ImageBackground,
  Image,
  View,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import * as Linking from "expo-linking";
import QRCode from "react-native-qrcode-svg";

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

  cover_url?: string | null;
  media_url?: string | null;

  // opțional (dacă backend returnează direct qr_url ca DataURL base64)
  qr_url?: string | null;
};

type FeedItem =
  | { kind: "capsule"; ts: number; capsule: Capsule }
  | { kind: "post"; ts: number; post: PostItem };

function parseTs(value?: string | null) {
  if (!value) return 0;
  const t = Date.parse(value);
  return Number.isNaN(t) ? 0 : t;
}

function formatDate(value?: string | null) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString();
}

function typeLabel(t?: string, req?: number | null) {
  if (t === "time") return "⏳ Time Capsule";
  if (t === "co") return `👥 Co-Caps${req ? ` • ${req}` : ""}`;
  if (t === "key") return "🔑 Key Capsule";
  return `📦 ${t || "Capsule"}`;
}

function statusPill(status?: string) {
  if (status === "open") return { text: "Open", tone: "open" as const };
  if (status === "locked") return { text: "Locked", tone: "locked" as const };
  if (status === "archived") return { text: "Archived", tone: "archived" as const };
  return { text: status || "Unknown", tone: "default" as const };
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
      setError("Nu am putut încărca feed-ul. Verifică backend-ul și API URL.");
      setCapsules([]);
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

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
      const ts = parseTs(c.created_at) || parseTs(c.open_at);
      a.push({ kind: "capsule", ts, capsule: c });
    }

    for (const p of posts) {
      const ts = parseTs(p.created_at);
      a.push({ kind: "post", ts, post: p });
    }

    a.sort((x, y) => (y.ts || 0) - (x.ts || 0));
    return a;
  }, [capsules, posts]);

  // ✅ QR pentru key capsule trebuie să ducă la ruta REALĂ din app:
  // app/capsule/key/[id].tsx  => "/capsule/key/:id"
  const makeKeyDeepLink = (capsuleId: number) => {
    // exp://.../--/capsule/key/123
    return Linking.createURL(`/capsule/key/${capsuleId}`);
  };

  const goToKeyUnlock = (capsuleId: number) => {
    router.push(`/capsule/key/${capsuleId}` as any);
  };

  return (
    <ImageBackground source={BG} style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl refreshing={refreshing || loading} onRefresh={onRefresh} />
        }
      >
        {/* Header */}
        <View style={styles.headerRow}>
          <View>
            <ThemedText type="title" style={styles.title}>
              Home
            </ThemedText>
            <ThemedText style={styles.subtitle}>Feed mixt: capsule + postări</ThemedText>
          </View>

          <Pressable
            onPress={() => router.push("/(tabs)/create" as any)}
            style={({ pressed }) => [styles.fabMini, pressed && { opacity: 0.85 }]}
          >
            <ThemedText style={styles.fabMiniText}>＋</ThemedText>
          </Pressable>
        </View>

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
          <ThemedText style={styles.empty}>Nu există capsule sau postări încă.</ThemedText>
        ) : (
          feed.map((item, idx) => {
            if (item.kind === "capsule") {
              const c = item.capsule;

              const title = c.title?.trim() || "Untitled capsule";
              const desc = c.description?.trim() || "";

              const type = typeLabel(c.capsule_type, c.required_contributors);
              const st = statusPill(c.status);

              const isKey = c.capsule_type === "key";

              // ✅ Key capsule: nu arăta poza; arată QR (sau qr_url din backend dacă e DataURL)
              const cover = !isKey ? c.cover_url || c.media_url || null : null;

              const qrValue = makeKeyDeepLink(c.capsule_id);

              return (
                <Pressable
                  key={`c-${c.capsule_id}-${idx}`}
                  onPress={() => {
                    if (isKey) return goToKeyUnlock(c.capsule_id);
                    return router.push(`/capsule/${c.capsule_id}` as any);
                  }}
                  style={({ pressed }) => [styles.capsuleCard, pressed && styles.cardPressed]}
                >
                  {/* TOP / COVER */}
                  {isKey ? (
                    <View style={styles.keyTop}>
                      <View style={styles.keyBadgesRow}>
                        <Badge text={type} tone="neutral" />
                        <Badge text={st.text} tone={st.tone} />
                      </View>

                      <View style={styles.qrWrap}>
                        <View style={styles.qrCard}>
                          {/* dacă backend-ul returnează qr_url ca DataURL -> îl poți afișa ca <Image>.
                              DAR tu folosești generator local, deci folosim QRCode cu deep link intern */}
                          <QRCode value={qrValue} size={140} />
                        </View>

                        <ThemedText style={styles.qrHint}>
                          Scanează QR-ul sau apasă „Unlock”
                        </ThemedText>
                      </View>
                    </View>
                  ) : cover ? (
                    <View style={styles.coverWrap}>
                      <Image source={{ uri: cover }} style={styles.coverImg} />
                      <View style={styles.coverShade} />
                      <View style={styles.coverBadges}>
                        <Badge text={type} tone="neutral" />
                        <Badge text={st.text} tone={st.tone} />
                      </View>
                    </View>
                  ) : (
                    <View style={styles.capsuleTopRow}>
                      <Badge text={type} tone="neutral" />
                      <Badge text={st.text} tone={st.tone} />
                    </View>
                  )}

                  {/* BODY */}
                  <View style={styles.capsuleBody}>
                    <ThemedText style={styles.cardTitle}>{title}</ThemedText>

                    {desc ? (
                      <ThemedText numberOfLines={2} style={styles.cardDesc}>
                        {desc}
                      </ThemedText>
                    ) : null}

                    <View style={styles.metaRow}>
                      <ThemedText style={styles.metaText}>
                        Created: {formatDate(c.created_at)}
                      </ThemedText>

                      <Pressable
                        onPress={() => {
                          if (isKey) return goToKeyUnlock(c.capsule_id);
                          return router.push(`/capsule/${c.capsule_id}` as any);
                        }}
                        style={({ pressed }) => [styles.openBtn, pressed && { opacity: 0.9 }]}
                      >
                        <ThemedText style={styles.openBtnText}>
                          {isKey ? "Unlock" : "Open"}
                        </ThemedText>
                      </Pressable>
                    </View>
                  </View>
                </Pressable>
              );
            }

            // POST
            const p = item.post;
            const img = (p as any)?.media_url || (p as any)?.mediaUrl || null;

            return (
              <ThemedView key={`p-${p.id}-${idx}`} style={styles.postCard}>
                <View style={styles.postHeader}>
                  <ThemedText style={styles.postAuthor}>{p.User?.name || "User"}</ThemedText>
                  <ThemedText style={styles.postDate}>{formatDate(p.created_at)}</ThemedText>
                </View>

                {!!p.content_text && (
                  <ThemedText style={styles.postText}>{p.content_text}</ThemedText>
                )}

                {!!img && (
                  <View style={styles.postImgWrap}>
                    <Image source={{ uri: img }} style={styles.postImg} />
                  </View>
                )}
              </ThemedView>
            );
          })
        )}
      </ScrollView>
    </ImageBackground>
  );
}

function Badge({
  text,
  tone,
}: {
  text: string;
  tone: "neutral" | "open" | "locked" | "archived" | "default";
}) {
  return (
    <View
      style={[
        styles.badge,
        tone === "neutral" && styles.badgeNeutral,
        tone === "open" && styles.badgeOpen,
        tone === "locked" && styles.badgeLocked,
        tone === "archived" && styles.badgeArchived,
        tone === "default" && styles.badgeNeutral,
      ]}
    >
      <ThemedText style={styles.badgeText}>{text}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 28, gap: 14 },

  headerRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    marginBottom: 2,
  },

  title: { fontFamily: Fonts.rounded },
  subtitle: { opacity: 0.78, marginTop: -2 },

  fabMini: {
    width: 44,
    height: 44,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.92)",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
  },
  fabMiniText: { fontFamily: Fonts.rounded, fontSize: 22, opacity: 0.9 },

  center: { marginTop: 24, alignItems: "center", justifyContent: "center" },
  empty: { textAlign: "center", opacity: 0.7, marginTop: 18 },
  cardPressed: { transform: [{ scale: 0.995 }], opacity: 0.96 },

  capsuleCard: {
    borderRadius: 22,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.92)",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
  },

  keyTop: { padding: 12, gap: 12, backgroundColor: "rgba(255,255,255,0.92)" },
  keyBadgesRow: { flexDirection: "row", justifyContent: "space-between", gap: 10 },
  qrWrap: { alignItems: "center", gap: 8, paddingBottom: 6 },
  qrCard: {
    padding: 12,
    borderRadius: 18,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
  },
  qrHint: { opacity: 0.75, fontSize: 12, textAlign: "center" },

  coverWrap: { height: 140, position: "relative", backgroundColor: "rgba(0,0,0,0.06)" },
  coverImg: { width: "100%", height: "100%" },
  coverShade: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.14)" },
  coverBadges: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },

  capsuleTopRow: {
    padding: 12,
    paddingBottom: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },

  capsuleBody: { padding: 14, gap: 8 },

  cardTitle: { fontSize: 18, fontFamily: Fonts.rounded, color: "#1b1b1b" },
  cardDesc: { opacity: 0.8, color: "#1b1b1b", lineHeight: 19 },

  metaRow: {
    marginTop: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  metaText: { fontSize: 12, opacity: 0.65, color: "#1b1b1b" },

  openBtn: {
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: "rgba(255, 220, 195, 0.95)",
    borderWidth: 1,
    borderColor: "rgba(210, 140, 80, 0.45)",
  },
  openBtnText: { fontFamily: Fonts.rounded, fontSize: 13, color: "#1b1b1b" },

  badge: { paddingVertical: 7, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1 },
  badgeText: { fontFamily: Fonts.rounded, fontSize: 12, opacity: 0.92, color: "#1b1b1b" },
  badgeNeutral: { backgroundColor: "rgba(255,255,255,0.92)", borderColor: "rgba(0,0,0,0.08)" },
  badgeOpen: { backgroundColor: "rgba(215, 255, 230, 0.92)", borderColor: "rgba(0,0,0,0.08)" },
  badgeLocked: { backgroundColor: "rgba(255, 235, 205, 0.92)", borderColor: "rgba(0,0,0,0.08)" },
  badgeArchived: { backgroundColor: "rgba(235, 235, 245, 0.92)", borderColor: "rgba(0,0,0,0.08)" },

  postCard: {
    borderRadius: 22,
    padding: 14,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    gap: 10,
  },
  postHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: 12 },
  postAuthor: { fontFamily: Fonts.rounded, fontSize: 16, color: "#111" },
  postDate: { fontSize: 12, opacity: 0.65, color: "#111" },
  postText: { fontSize: 16, color: "#111", lineHeight: 20 },
  postImgWrap: {
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    backgroundColor: "rgba(0,0,0,0.04)",
  },
  postImg: { width: "100%", height: 240 },

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
    borderColor: "rgba(0,0,0,0.08)",
    backgroundColor: "rgba(255,255,255,0.85)",
  },
  retryText: { fontFamily: Fonts.rounded },
});