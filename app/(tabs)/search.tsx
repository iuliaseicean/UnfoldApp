import React, { useCallback, useEffect, useMemo, useState } from "react";
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

import { getCapsules } from "@/lib/capsules";
import { getPosts, PostItem } from "@/lib/posts";

const BG = require("@/assets/images/brown-metallic-foil-background-texture-free-photo.jpg");

type Capsule = {
  capsule_id: number;
  title?: string | null;
  description?: string | null;
  capsule_type?: string | null;
  status?: string | null;
  created_at?: string | null;
  open_at?: string | null;
  cover_url?: string | null;
  media_url?: string | null;
};

function norm(s?: string | null) {
  return (s ?? "").toLowerCase().trim();
}

function formatDate(value?: string | null) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString();
}

export default function SearchScreen() {
  const [q, setQ] = useState("");
  const [capsules, setCapsules] = useState<Capsule[]>([]);
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setError("");
      setLoading(true);
      const [caps, pst] = await Promise.all([getCapsules(), getPosts()]);
      setCapsules(Array.isArray(caps) ? caps : []);
      setPosts(Array.isArray(pst) ? pst : []);
    } catch {
      setError("Nu am putut încărca datele pentru search.");
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

  const query = norm(q);

  const filteredCapsules = useMemo(() => {
    if (!query) return capsules;
    return capsules.filter((c) => {
      const hay = [
        c.title,
        c.description,
        c.capsule_type,
        c.status,
      ]
        .map(norm)
        .join(" ");
      return hay.includes(query);
    });
  }, [capsules, query]);

  const filteredPosts = useMemo(() => {
    if (!query) return posts;
    return posts.filter((p) => {
      const author = (p as any)?.User?.username || (p as any)?.User?.name || "";
      const hay = [p.content_text, author].map(norm).join(" ");
      return hay.includes(query);
    });
  }, [posts, query]);

  return (
    <ImageBackground source={BG} style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing || loading} onRefresh={onRefresh} />}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <ThemedText type="title" style={styles.title}>
            Search
          </ThemedText>
          <ThemedText style={styles.subtitle}>Caută în capsule și postări</ThemedText>
        </View>

        <ThemedView style={styles.searchBox}>
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Caută... (ex: nails, summer, iulia)"
            placeholderTextColor="#9e9e9e"
            style={styles.input}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {!!q && (
            <Pressable onPress={() => setQ("")} style={styles.clearBtn}>
              <ThemedText style={styles.clearText}>×</ThemedText>
            </Pressable>
          )}
        </ThemedView>

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
        ) : (
          <>
            {/* Capsules */}
            <SectionHeader title={`Capsules (${filteredCapsules.length})`} />

            {filteredCapsules.length === 0 ? (
              <ThemedText style={styles.empty}>Nu am găsit capsule.</ThemedText>
            ) : (
              filteredCapsules.map((c) => {
                const cover = c.cover_url || c.media_url || null;
                const title = c.title?.trim() || "Untitled capsule";
                const desc = c.description?.trim() || "";

                return (
                  <Pressable
                    key={`c-${c.capsule_id}`}
                    onPress={() => router.push(`/capsule/${c.capsule_id}` as any)}
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
                        {c.capsule_type || "capsule"} • {formatDate(c.created_at || c.open_at)}
                      </ThemedText>
                    </View>
                  </Pressable>
                );
              })
            )}

            {/* Posts */}
            <SectionHeader title={`Posts (${filteredPosts.length})`} />

            {filteredPosts.length === 0 ? (
              <ThemedText style={styles.empty}>Nu am găsit postări.</ThemedText>
            ) : (
              filteredPosts.map((p) => {
                const img = (p as any)?.media_url || (p as any)?.mediaUrl || null;
                const author = (p as any)?.User?.username || (p as any)?.User?.name || "User";

                return (
                  <Pressable
                    key={`p-${p.id}`}
                    onPress={() => router.push(`/post/${p.id}` as any)}
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

  sectionHeader: { marginTop: 6 },
  sectionTitle: { fontFamily: Fonts.rounded, fontSize: 16, opacity: 0.9 },

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

  cardTitle: { fontFamily: Fonts.rounded, fontSize: 15, color: "#111" },
  cardDesc: { opacity: 0.78, color: "#111", lineHeight: 18 },
  meta: { fontSize: 12, opacity: 0.6, color: "#111" },

  center: { marginTop: 24, alignItems: "center", justifyContent: "center" },
  empty: { opacity: 0.7, marginBottom: 6 },

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
