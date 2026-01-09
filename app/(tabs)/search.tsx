import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  ImageBackground,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { router, useFocusEffect } from "expo-router";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Fonts } from "@/constants/theme";

import type { PostItem } from "@/lib/posts";
import { searchPosts } from "@/lib/posts";

import type { Capsule } from "@/types/capsule";
import { searchCapsules } from "@/lib/capsules";

import type { UserItem } from "@/lib/users";
import { searchUsers } from "@/lib/users";

const BG = require("@/assets/images/brown-metallic-foil-background-texture-free-photo.jpg");

function formatDate(value?: string | null) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString();
}

function norm(s?: string | null) {
  return (s ?? "").toLowerCase().trim();
}

function getUserId(u: UserItem): number | null {
  const id = Number((u as any)?.id ?? (u as any)?.user_id);
  return Number.isFinite(id) && id > 0 ? id : null;
}

function getCapsuleId(c: any): number | null {
  const id = Number(c?.capsule_id ?? c?.id);
  return Number.isFinite(id) && id > 0 ? id : null;
}

function getPostId(p: any): number | null {
  const id = Number(p?.id ?? p?.post_id);
  return Number.isFinite(id) && id > 0 ? id : null;
}

/**
 * Încearcă mai multe rute posibile pentru profil.
 * Păstrează doar cea corectă la tine, când știi sigur care e.
 */
function goToUserProfile(userId: number) {
  // 1) ruta recomandată de tine în codul existent
  const routes = [`/profile/${userId}`, `/user/${userId}`, `/users/${userId}`];

  // expo-router nu aruncă ușor erori la push, dar dacă o rută nu există vei vedea warning.
  // În practică, păstrează doar una (cea reală).
  router.push(routes[0] as any);
}

export default function SearchScreen() {
  const [q, setQ] = useState("");

  const [users, setUsers] = useState<UserItem[]>([]);
  const [capsules, setCapsules] = useState<Capsule[]>([]);
  const [posts, setPosts] = useState<PostItem[]>([]);

  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingCapsules, setLoadingCapsules] = useState(false);
  const [loadingPosts, setLoadingPosts] = useState(false);

  const [refreshing, setRefreshing] = useState(false);

  const [errUsers, setErrUsers] = useState("");
  const [errCaps, setErrCaps] = useState("");
  const [errPosts, setErrPosts] = useState("");

  const query = useMemo(() => q.trim(), [q]);

  // debounce timer
  const timerRef = useRef<any>(null);

  // request guard: ca să nu scrie rezultate vechi peste cele noi
  const reqIdRef = useRef(0);

  const clearAll = useCallback(() => {
    setUsers([]);
    setCapsules([]);
    setPosts([]);
    setErrUsers("");
    setErrCaps("");
    setErrPosts("");
  }, []);

  const runSearch = useCallback(
    async (forcedQuery?: string) => {
      const qq = (forcedQuery ?? query).trim();

      // incrementează request id
      const myReqId = ++reqIdRef.current;

      if (!qq) {
        clearAll();
        return;
      }

      setErrUsers("");
      setErrCaps("");
      setErrPosts("");

      setLoadingUsers(true);
      setLoadingCapsules(true);
      setLoadingPosts(true);

      try {
        const [u, c, p] = await Promise.allSettled([
          searchUsers(qq),
          searchCapsules(qq),
          searchPosts(qq),
        ]);

        // dacă între timp s-a pornit alt search, ignorăm rezultatele
        if (myReqId !== reqIdRef.current) return;

        if (u.status === "fulfilled") setUsers(Array.isArray(u.value) ? u.value : []);
        else {
          setUsers([]);
          setErrUsers("Nu am putut încărca userii.");
        }

        if (c.status === "fulfilled") setCapsules(Array.isArray(c.value) ? c.value : []);
        else {
          setCapsules([]);
          setErrCaps("Nu am putut încărca capsulele.");
        }

        if (p.status === "fulfilled") setPosts(Array.isArray(p.value) ? p.value : []);
        else {
          setPosts([]);
          setErrPosts("Nu am putut încărca postările.");
        }
      } finally {
        // doar dacă request-ul e încă “curent”
        if (myReqId === reqIdRef.current) {
          setLoadingUsers(false);
          setLoadingCapsules(false);
          setLoadingPosts(false);
        }
      }
    },
    [query, clearAll]
  );

  // debounce când se schimbă query
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(() => {
      runSearch();
    }, 350);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [query, runSearch]);

  // când intri pe tab, refaci căutarea dacă există query
  useFocusEffect(
    useCallback(() => {
      if (query) runSearch(query);
    }, [query, runSearch])
  );

  const onRefresh = useCallback(async () => {
    if (!query) return;
    setRefreshing(true);
    try {
      await runSearch(query);
    } finally {
      setRefreshing(false);
    }
  }, [query, runSearch]);

  const anyLoading = loadingUsers || loadingCapsules || loadingPosts;

  return (
    <ImageBackground source={BG} style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl refreshing={refreshing || anyLoading} onRefresh={onRefresh} />
        }
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <ThemedText type="title" style={styles.title}>
            Search
          </ThemedText>
          <ThemedText style={styles.subtitle}>Caută users, capsule și postări</ThemedText>
        </View>

        <ThemedView style={styles.searchBox}>
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Caută... (ex: iulia, nails, summer)"
            placeholderTextColor="#9e9e9e"
            style={styles.input}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            onSubmitEditing={() => runSearch(query)}
          />
          {!!q && (
            <Pressable
              onPress={() => {
                setQ("");
                clearAll();
              }}
              style={({ pressed }) => [styles.clearBtn, pressed && { opacity: 0.85 }]}
            >
              <ThemedText style={styles.clearText}>×</ThemedText>
            </Pressable>
          )}
        </ThemedView>

        {!query ? (
          <ThemedText style={styles.emptyHint}>
            Scrie ceva în căsuța de sus ca să cauți în aplicație.
          </ThemedText>
        ) : (
          <>
            {/* USERS */}
            <SectionHeader title={`Users (${users.length})`} />
            {loadingUsers ? (
              <MiniLoading />
            ) : errUsers ? (
              <ErrorLine text={errUsers} />
            ) : users.length === 0 ? (
              <ThemedText style={styles.empty}>Nu am găsit users.</ThemedText>
            ) : (
              users.map((u, idx) => {
                const displayName =
                  (u.username?.trim() || u.name?.trim() || u.email?.trim() || "User").trim();
                const userId = getUserId(u);

                return (
                  <Pressable
                    key={`u-${userId ?? idx}`}
                    onPress={() => {
                      if (!userId) return;
                      goToUserProfile(userId);
                    }}
                    style={({ pressed }) => [styles.card, pressed && { opacity: 0.95 }]}
                  >
                    <View style={styles.userAvatar}>
                      <ThemedText style={styles.userAvatarText}>
                        {displayName[0]?.toUpperCase() ?? "U"}
                      </ThemedText>
                    </View>

                    <View style={{ flex: 1, gap: 4 }}>
                      <ThemedText style={styles.cardTitle}>{displayName}</ThemedText>
                      {!!u.email && <ThemedText style={styles.meta}>{u.email}</ThemedText>}
                      {!!u.bio && <ThemedText style={styles.cardDesc} numberOfLines={1}>{u.bio}</ThemedText>}
                    </View>
                  </Pressable>
                );
              })
            )}

            {/* CAPSULES */}
            <SectionHeader title={`Capsules (${capsules.length})`} />
            {loadingCapsules ? (
              <MiniLoading />
            ) : errCaps ? (
              <ErrorLine text={errCaps} />
            ) : capsules.length === 0 ? (
              <ThemedText style={styles.empty}>Nu am găsit capsule.</ThemedText>
            ) : (
              capsules.map((c: any, idx: number) => {
                const cover = c.cover_url || c.media_url || null;
                const title = (c.title ?? "").trim() || "Untitled capsule";
                const desc = (c.description ?? "").trim();
                const id = getCapsuleId(c);

                return (
                  <Pressable
                    key={`c-${id ?? idx}`}
                    onPress={() => {
                      if (!id) return;
                      router.push(`/capsule/${id}` as any);
                    }}
                    style={({ pressed }) => [styles.card, pressed && { opacity: 0.95 }]}
                  >
                    {!!cover && (
                      <View style={styles.thumbWrap}>
                        <Image source={{ uri: cover }} style={styles.thumb} />
                      </View>
                    )}

                    <View style={{ flex: 1, gap: 6 }}>
                      <ThemedText style={styles.cardTitle}>{title}</ThemedText>
                      {!!desc && (
                        <ThemedText numberOfLines={2} style={styles.cardDesc}>
                          {desc}
                        </ThemedText>
                      )}
                      <ThemedText style={styles.meta}>
                        {(c.capsule_type || "capsule") as string} •{" "}
                        {formatDate(c.created_at || c.open_at)}
                      </ThemedText>
                    </View>
                  </Pressable>
                );
              })
            )}

            {/* POSTS */}
            <SectionHeader title={`Posts (${posts.length})`} />
            {loadingPosts ? (
              <MiniLoading />
            ) : errPosts ? (
              <ErrorLine text={errPosts} />
            ) : posts.length === 0 ? (
              <ThemedText style={styles.empty}>Nu am găsit postări.</ThemedText>
            ) : (
              posts.map((p: any, idx: number) => {
                const img = p.media_url || p.mediaUrl || null;
                const author = p.User?.username || p.User?.name || "User";
                const id = getPostId(p);

                return (
                  <Pressable
                    key={`p-${id ?? idx}`}
                    onPress={() => {
                      if (!id) return;
                      router.push(`/post/${id}` as any);
                    }}
                    style={({ pressed }) => [styles.card, pressed && { opacity: 0.95 }]}
                  >
                    {!!img && (
                      <View style={styles.thumbWrap}>
                        <Image source={{ uri: img }} style={styles.thumb} />
                      </View>
                    )}

                    <View style={{ flex: 1, gap: 6 }}>
                      <ThemedText style={styles.cardTitle}>{author}</ThemedText>
                      {!!p.content_text && (
                        <ThemedText numberOfLines={2} style={styles.cardDesc}>
                          {p.content_text}
                        </ThemedText>
                      )}
                      <ThemedText style={styles.meta}>{formatDate(p.created_at)}</ThemedText>
                    </View>
                  </Pressable>
                );
              })
            )}
          </>
        )}
      </ScrollView>
    </ImageBackground>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <View style={styles.sectionHeader}>
      <ThemedText style={styles.sectionTitle}>{title}</ThemedText>
    </View>
  );
}

function MiniLoading() {
  return (
    <View style={styles.miniLoading}>
      <ActivityIndicator />
      <ThemedText style={{ opacity: 0.75 }}>Se încarcă...</ThemedText>
    </View>
  );
}

function ErrorLine({ text }: { text: string }) {
  return <ThemedText style={styles.errorLine}>{text}</ThemedText>;
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 28, gap: 12 },

  header: { alignItems: "center", gap: 6, marginBottom: 2 },
  title: { fontFamily: Fonts.rounded },
  subtitle: { opacity: 0.78 },

  searchBox: {
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  input: { flex: 1, fontSize: 16 },

  clearBtn: {
    width: 34,
    height: 34,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.06)",
  },
  clearText: { fontSize: 22, fontFamily: Fonts.rounded, opacity: 0.85 },

  emptyHint: { textAlign: "center", opacity: 0.7, marginTop: 10 },

  sectionHeader: { marginTop: 6 },
  sectionTitle: { fontFamily: Fonts.rounded, fontSize: 16, opacity: 0.9 },

  miniLoading: { paddingVertical: 8, flexDirection: "row", gap: 10, alignItems: "center" },
  errorLine: { opacity: 0.95, color: "#b00020" },

  card: {
    borderRadius: 18,
    padding: 12,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },

  thumbWrap: {
    width: 64,
    height: 64,
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    backgroundColor: "rgba(0,0,0,0.04)",
  },
  thumb: { width: "100%", height: "100%" },

  userAvatar: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.06)",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
  },
  userAvatarText: { fontFamily: Fonts.rounded, fontSize: 18, opacity: 0.85 },

  cardTitle: { fontFamily: Fonts.rounded, fontSize: 15, color: "#111" },
  cardDesc: { opacity: 0.78, color: "#111", lineHeight: 18 },
  meta: { fontSize: 12, opacity: 0.6, color: "#111" },

  empty: { opacity: 0.7, marginBottom: 6 },
});
