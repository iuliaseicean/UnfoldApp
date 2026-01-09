// app/(tabs)/home.tsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  ImageBackground,
  Image,
  View,
  Alert,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import * as Linking from "expo-linking";
import QRCode from "react-native-qrcode-svg";
import Ionicons from "@expo/vector-icons/Ionicons";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Fonts } from "@/constants/theme";

import { getCapsules } from "@/lib/capsules";
import { getPosts, likePost, unlikePost, PostItem } from "@/lib/posts";

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
  qr_url?: string | null;

  // ✅ CO meta (normalizate în lib/capsules.ts)
  contributorsCount?: number | null;
  isFull?: boolean | null;
  canContribute?: boolean | null;
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

function clamp(n: number, a: number, b: number) {
  return Math.min(Math.max(n, a), b);
}

export default function HomeScreen() {
  const [capsules, setCapsules] = useState<Capsule[]>([]);
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string>("");

  // like state local (MVP)
  const [liked, setLiked] = useState<Record<number, boolean>>({});
  const [busyLike, setBusyLike] = useState<Record<number, boolean>>({});

  // ca să nu spammăm reload pe focus
  const didFirstLoad = useRef(false);

  const loadAll = useCallback(async () => {
    try {
      setError("");
      setLoading(true);

      const [caps, pst] = await Promise.all([getCapsules(), getPosts()]);
      setCapsules(Array.isArray(caps) ? (caps as any) : []);
      setPosts(Array.isArray(pst) ? pst : []);

      // init liked map only for new posts (NU resetăm ce a apăsat user-ul)
      setLiked((prev) => {
        const next = { ...prev };
        for (const p of Array.isArray(pst) ? pst : []) {
          if (next[p.id] === undefined) next[p.id] = false;
        }
        return next;
      });
    } catch (e: any) {
      setError("Nu am putut încărca feed-ul. Verifică backend-ul și API URL / token.");
      setCapsules([]);
      setPosts([]);
    } finally {
      setLoading(false);
      didFirstLoad.current = true;
    }
  }, []);

  // refresh doar la posts (util după like/comment ca să vezi count real din DB)
  const reloadPostsOnly = useCallback(async () => {
    try {
      const pst = await getPosts();
      setPosts(Array.isArray(pst) ? pst : []);
      setLiked((prev) => {
        const next = { ...prev };
        for (const p of Array.isArray(pst) ? pst : []) {
          if (next[p.id] === undefined) next[p.id] = false;
        }
        return next;
      });
    } catch {
      // ignore
    }
  }, []);

  // refresh doar capsule (util după ce contribui la co-cap)
  const reloadCapsulesOnly = useCallback(async () => {
    try {
      const caps = await getCapsules();
      setCapsules(Array.isArray(caps) ? (caps as any) : []);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useFocusEffect(
    useCallback(() => {
      if (!didFirstLoad.current) return;
      // ✅ după contribute la co-cap, când revii în home, vezi progresul
      reloadCapsulesOnly();
      reloadPostsOnly();
    }, [reloadCapsulesOnly, reloadPostsOnly])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadAll();
    } finally {
      setRefreshing(false);
    }
  }, [loadAll]);

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

  const makeKeyDeepLink = (capsuleId: number) => Linking.createURL(`/capsule/key/${capsuleId}`);

  const goToKeyUnlock = (capsuleId: number) => router.push(`/capsule/key/${capsuleId}` as any);

  const openComments = (postId: number) => {
    router.push(
      {
        pathname: "/post/[id]",
        params: { id: String(postId) },
      } as any
    );
  };

  const onToggleLike = async (postId: number) => {
    if (busyLike[postId]) return;

    const isLiked = !!liked[postId];

    // optimistic UI
    setBusyLike((m) => ({ ...m, [postId]: true }));
    setLiked((m) => ({ ...m, [postId]: !isLiked }));
    setPosts((arr) =>
      arr.map((p) =>
        p.id === postId
          ? { ...p, likeCount: Math.max(0, (p.likeCount ?? 0) + (isLiked ? -1 : 1)) }
          : p
      )
    );

    try {
      if (!isLiked) await likePost(postId);
      else await unlikePost(postId);

      // ✅ sincronizează count real din DB (și între useri)
      await reloadPostsOnly();
    } catch {
      // revert UI
      setLiked((m) => ({ ...m, [postId]: isLiked }));
      setPosts((arr) =>
        arr.map((p) =>
          p.id === postId
            ? { ...p, likeCount: Math.max(0, (p.likeCount ?? 0) + (isLiked ? 1 : -1)) }
            : p
        )
      );
      Alert.alert("Eroare", "Nu am putut actualiza like-ul. Verifică backend-ul.");
    } finally {
      setBusyLike((m) => ({ ...m, [postId]: false }));
    }
  };

  const goToCoContribute = (capsuleId: number) => {
    // ✅ ecran dedicat pentru upload & submit
    // IMPORTANT: trebuie să creezi app/capsule/co/[id].tsx
    router.push(`/capsule/co/${capsuleId}` as any);
  };

  return (
    <ImageBackground source={BG} style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing || loading} onRefresh={onRefresh} />}
      >
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

            <Pressable style={styles.retryBtn} onPress={loadAll}>
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
              const isCo = c.capsule_type === "co";

              // cover pentru time/co (poate fi cover_url sau media_url)
              const cover = !isKey ? c.cover_url || c.media_url || null : null;

              // ✅ CO meta
              const required = Number(c.required_contributors ?? 0) || 0;
              const contributed = Number(c.contributorsCount ?? 0) || 0;
              const isFull = !!c.isFull || (required > 0 && contributed >= required);

              // dacă backend nu trimite canContribute, nu arătăm "+" (ca să nu fie bug)
              const canContribute =
                isCo && !!c.canContribute && !isFull && c.status !== "archived";

              const progressPct = isCo && required > 0 ? clamp(contributed / required, 0, 1) : 0;

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
                  {isKey ? (
                    <View style={styles.keyTop}>
                      <View style={styles.keyBadgesRow}>
                        <Badge text={type} tone="neutral" />
                        <Badge text={st.text} tone={st.tone} />
                      </View>

                      <View style={styles.qrWrap}>
                        <View style={styles.qrCard}>
                          <QRCode value={qrValue} size={140} />
                        </View>
                        <ThemedText style={styles.qrHint}>Scanează QR-ul sau apasă „Unlock”</ThemedText>
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

                      {/* ✅ CO progress overlay */}
                      {isCo && required > 0 ? (
                        <View style={styles.coProgressWrap}>
                          <View style={styles.coProgressBar}>
                            <View style={[styles.coProgressFill, { width: `${progressPct * 100}%` }]} />
                          </View>
                          <ThemedText style={styles.coProgressText}>
                            {contributed}/{required} contributors
                          </ThemedText>
                        </View>
                      ) : null}

                      {/* ✅ CO + button */}
                      {canContribute ? (
                        <Pressable
                          onPress={(e) => {
                            // nu navigăm în capsule details când dai pe +
                            (e as any)?.stopPropagation?.();
                            goToCoContribute(c.capsule_id);
                          }}
                          style={({ pressed }) => [styles.coPlusBtn, pressed && { opacity: 0.85 }]}
                        >
                          <Ionicons name="add" size={20} color="#111" />
                        </Pressable>
                      ) : null}
                    </View>
                  ) : (
                    <View style={styles.capsuleTopRow}>
                      <Badge text={type} tone="neutral" />
                      <Badge text={st.text} tone={st.tone} />
                    </View>
                  )}

                  <View style={styles.capsuleBody}>
                    <ThemedText style={styles.cardTitle}>{title}</ThemedText>

                    {desc ? (
                      <ThemedText numberOfLines={2} style={styles.cardDesc}>
                        {desc}
                      </ThemedText>
                    ) : null}

                    <View style={styles.metaRow}>
                      <ThemedText style={styles.metaText}>Created: {formatDate(c.created_at)}</ThemedText>

                      {isCo && required > 0 ? (
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                          {isFull ? <Badge text="Full" tone="archived" /> : <Badge text={`${contributed}/${required}`} tone="neutral" />}

                          <Pressable
                            onPress={() => router.push(`/capsule/${c.capsule_id}` as any)}
                            style={({ pressed }) => [styles.openBtn, pressed && { opacity: 0.9 }]}
                          >
                            <ThemedText style={styles.openBtnText}>Open</ThemedText>
                          </Pressable>
                        </View>
                      ) : (
                        <Pressable
                          onPress={() => {
                            if (isKey) return goToKeyUnlock(c.capsule_id);
                            return router.push(`/capsule/${c.capsule_id}` as any);
                          }}
                          style={({ pressed }) => [styles.openBtn, pressed && { opacity: 0.9 }]}
                        >
                          <ThemedText style={styles.openBtnText}>{isKey ? "Unlock" : "Open"}</ThemedText>
                        </Pressable>
                      )}
                    </View>
                  </View>
                </Pressable>
              );
            }

            // POST
            const p = item.post;
            const img = p.media_url ?? null;

            const author = p.User?.name || p.User?.username || "User";
            const likeCount = p.likeCount ?? 0;
            const commentCount = p.commentCount ?? 0;
            const isLiked = !!liked[p.id];

            return (
              <ThemedView key={`p-${p.id}-${idx}`} style={styles.postCard}>
                <View style={styles.postHeader}>
                  <ThemedText style={styles.postAuthor}>{author}</ThemedText>
                  <ThemedText style={styles.postDate}>{formatDate(p.created_at)}</ThemedText>
                </View>

                {!!p.content_text && <ThemedText style={styles.postText}>{p.content_text}</ThemedText>}

                {!!img && (
                  <View style={styles.postImgWrap}>
                    <Image source={{ uri: img }} style={styles.postImg} />
                  </View>
                )}

                <View style={styles.actionsRow}>
                  <Pressable
                    onPress={() => onToggleLike(p.id)}
                    style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.75 }]}
                  >
                    <Ionicons
                      name={isLiked ? "heart" : "heart-outline"}
                      size={18}
                      color={isLiked ? "#d64545" : "#111"}
                    />
                    <ThemedText style={styles.actionText}>{likeCount}</ThemedText>
                  </Pressable>

                  <Pressable
                    onPress={() => openComments(p.id)}
                    style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.75 }]}
                  >
                    <Ionicons name="chatbubble-outline" size={18} color="#111" />
                    <ThemedText style={styles.actionText}>{commentCount}</ThemedText>
                  </Pressable>
                </View>
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

  // ✅ CO progress overlay
  coProgressWrap: {
    position: "absolute",
    left: 12,
    right: 12,
    top: 12,
    gap: 6,
  },
  coProgressBar: {
    height: 8,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.45)",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
  },
  coProgressFill: {
    height: "100%",
    backgroundColor: "rgba(255, 220, 195, 0.95)",
  },
  coProgressText: {
    fontSize: 12,
    color: "#111",
    opacity: 0.9,
    fontFamily: Fonts.rounded,
  },

  // ✅ CO plus button
  coPlusBtn: {
    position: "absolute",
    right: 12,
    top: 46,
    width: 42,
    height: 42,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.92)",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.10)",
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
  postHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    gap: 12,
  },
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

  actionsRow: { flexDirection: "row", gap: 12, marginTop: 2 },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.06)",
  },
  actionText: { color: "#111", fontWeight: "700" },

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