import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  ImageBackground,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Fonts } from "@/constants/theme";

import { getUserById, UserItem } from "@/lib/users";
import { getPostsByUserId, PostItem } from "@/lib/posts";

const BG = require("@/assets/images/brown-metallic-foil-background-texture-free-photo.jpg");

function initials(name?: string) {
  const s = (name || "").trim();
  return s ? s[0].toUpperCase() : "U";
}

export default function ProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = Number(id);

  const [user, setUser] = useState<UserItem | null>(null);
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!userId) return;

    setLoading(true);
    try {
      const [u, p] = await Promise.all([
        getUserById(userId),
        getPostsByUserId(userId).catch(() => []),
      ]);
      setUser(u);
      setPosts(Array.isArray(p) ? p : []);
    } catch {
      Alert.alert("Eroare", "Nu am putut încărca profilul.");
      setUser(null);
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  if (!userId) {
    return (
      <ImageBackground source={BG} style={{ flex: 1 }}>
        <ThemedView style={styles.center}>
          <ThemedText style={{ color: "#fff" }}>Invalid user id.</ThemedText>
        </ThemedView>
      </ImageBackground>
    );
  }

  const displayName = user?.username || user?.name || user?.email || "User";

  return (
    <ImageBackground source={BG} style={{ flex: 1 }}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color="#111" />
        </Pressable>

        <ThemedText style={styles.headerTitle}>Profile</ThemedText>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing || loading} onRefresh={onRefresh} />}
      >
        {loading ? (
          <ThemedView style={styles.center}>
            <ActivityIndicator />
            <ThemedText style={{ marginTop: 8, color: "#111" }}>Loading…</ThemedText>
          </ThemedView>
        ) : !user ? (
          <ThemedText style={styles.empty}>User not found.</ThemedText>
        ) : (
          <>
            <ThemedView style={styles.profileCard}>
              {user.avatar_url ? (
                <Image source={{ uri: user.avatar_url }} style={styles.avatarImg} />
              ) : (
                <View style={styles.avatar}>
                  <ThemedText style={styles.avatarText}>{initials(displayName)}</ThemedText>
                </View>
              )}

              <View style={{ flex: 1 }}>
                <ThemedText style={styles.name}>{displayName}</ThemedText>
                {!!user.email && <ThemedText style={styles.meta}>{user.email}</ThemedText>}
                {!!user.bio && <ThemedText style={styles.bio}>{user.bio}</ThemedText>}
              </View>
            </ThemedView>

            <ThemedText style={styles.sectionTitle}>Posts</ThemedText>

            {posts.length === 0 ? (
              <ThemedText style={styles.empty}>Nu are postări încă.</ThemedText>
            ) : (
              posts.map((p) => (
                <Pressable
                  key={`p-${p.id}`}
                  onPress={() => router.push(`/post/${p.id}` as any)}
                  style={({ pressed }) => [styles.postCard, pressed && { opacity: 0.95 }]}
                >
                  <ThemedText style={styles.postText} numberOfLines={2}>
                    {p.content_text || "Post"}
                  </ThemedText>
                  <ThemedText style={styles.meta}>
                    {p.created_at ? new Date(p.created_at).toLocaleString() : ""}
                  </ThemedText>
                </Pressable>
              ))
            )}
          </>
        )}
      </ScrollView>
    </ImageBackground>
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

  container: { padding: 16, paddingBottom: 28, gap: 12 },
  center: { marginTop: 24, alignItems: "center", justifyContent: "center" },
  empty: { opacity: 0.85, color: "#fff", marginTop: 10 },

  profileCard: {
    borderRadius: 18,
    padding: 12,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  avatar: {
    width: 62,
    height: 62,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.06)",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
  },
  avatarText: { fontFamily: Fonts.rounded, fontSize: 22, opacity: 0.85 },
  avatarImg: { width: 62, height: 62, borderRadius: 18 },

  name: { fontFamily: Fonts.rounded, fontSize: 18, color: "#111" },
  meta: { fontSize: 12, opacity: 0.65, color: "#111" },
  bio: { marginTop: 6, opacity: 0.85, color: "#111" },

  sectionTitle: { fontFamily: Fonts.rounded, fontSize: 16, color: "#fff", marginTop: 6 },

  postCard: {
    borderRadius: 18,
    padding: 12,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    gap: 6,
  },
  postText: { fontFamily: Fonts.rounded, fontSize: 14, color: "#111" },
});