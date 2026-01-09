import React, { useCallback, useEffect, useMemo, useState } from "react";
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
import { useLocalSearchParams, router } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";

import { getPostById, likePost, unlikePost, PostItem } from "@/lib/posts";

const BG = require("@/assets/images/brown-metallic-foil-background-texture-free-photo.jpg");

function toIso(v: any) {
  const s = String(v ?? "");
  const t = Date.parse(s);
  return Number.isNaN(t) ? new Date().toISOString() : new Date(t).toISOString();
}

export default function PostDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const postId = Number(id);

  const [post, setPost] = useState<PostItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // MVP: fără "likedByMe" din backend -> îl ținem local
  const [liked, setLiked] = useState(false);
  const [liking, setLiking] = useState(false);

  const authorName = useMemo(() => {
    return post?.User?.name || post?.User?.username || "User";
  }, [post]);

  const authorId = useMemo(() => {
    // suportă id sau user_id
    const u = post?.User as any;
    return u?.id ?? u?.user_id ?? null;
  }, [post]);

  const created = useMemo(() => {
    const raw = (post as any)?.created_at ?? (post as any)?.createdAt ?? null;
    return raw ? toIso(raw) : null;
  }, [post]);

  const load = useCallback(async () => {
    if (!postId) return;

    try {
      setLoading(true);
      const data = await getPostById(postId);
      if (!data) {
        setPost(null);
      } else {
        setPost(data);
      }
    } catch (e: any) {
      Alert.alert("Eroare", "Nu am putut încărca postarea.");
      setPost(null);
    } finally {
      setLoading(false);
    }
  }, [postId]);

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

  const toggleLike = useCallback(async () => {
    if (!postId) return;
    if (liking) return;

    try {
      setLiking(true);

      // optimistic UI
      setLiked((prev) => !prev);
      setPost((prev) => {
        if (!prev) return prev;
        const nextLiked = !liked;
        const delta = nextLiked ? 1 : -1;
        return { ...prev, likeCount: Math.max(0, (prev.likeCount ?? 0) + delta) };
      });

      if (!liked) {
        await likePost(postId);
      } else {
        await unlikePost(postId);
      }
    } catch (e) {
      // rollback
      setLiked((prev) => !prev);
      setPost((prev) => {
        if (!prev) return prev;
        const delta = liked ? 1 : -1; // invers pentru rollback
        return { ...prev, likeCount: Math.max(0, (prev.likeCount ?? 0) + delta) };
      });
      Alert.alert("Eroare", "Nu am putut modifica like-ul.");
    } finally {
      setLiking(false);
    }
  }, [postId, liking, liked]);

  if (!postId) {
    return (
      <ThemedView style={styles.center}>
        <ThemedText>Invalid post id.</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ImageBackground source={BG} style={{ flex: 1 }}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color="#111" />
        </Pressable>
        <ThemedText style={styles.headerTitle}>Post</ThemedText>
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
        ) : !post ? (
          <ThemedView style={styles.center}>
            <ThemedText style={{ color: "#111" }}>Post not found.</ThemedText>
          </ThemedView>
        ) : (
          <>
            {/* Author row */}
            <Pressable
              onPress={() => {
                if (!authorId) return;
                router.push(`/user/${authorId}` as any);
              }}
              style={({ pressed }) => [styles.authorRow, pressed && { opacity: 0.9 }]}
            >
              <View style={styles.avatarFake}>
                <Ionicons name="person" size={18} color="#111" />
              </View>

              <View style={{ flex: 1 }}>
                <ThemedText style={styles.authorName}>{authorName}</ThemedText>
                <ThemedText style={styles.dateText}>
                  {created ? new Date(created).toLocaleString() : ""}
                </ThemedText>
              </View>

              <Ionicons name="chevron-forward" size={18} color="#111" style={{ opacity: 0.6 }} />
            </Pressable>

            {/* Image */}
            {!!post.media_url && (
              <View style={styles.imgWrap}>
                <Image source={{ uri: post.media_url }} style={styles.img} />
              </View>
            )}

            {/* Text */}
            {!!post.content_text && (
              <ThemedView style={styles.textCard}>
                <ThemedText style={styles.postText}>{post.content_text}</ThemedText>
              </ThemedView>
            )}

            {/* Actions */}
            <ThemedView style={styles.actionsRow}>
              <Pressable
                onPress={toggleLike}
                disabled={liking}
                style={({ pressed }) => [
                  styles.actionBtn,
                  pressed && { opacity: 0.8 },
                  liking && { opacity: 0.6 },
                ]}
              >
                <Ionicons
                  name={liked ? "heart" : "heart-outline"}
                  size={18}
                  color="#111"
                />
                <ThemedText style={styles.actionText}>
                  {post.likeCount ?? 0}
                </ThemedText>
              </Pressable>

              <Pressable
                onPress={() => router.push(`/post/${postId}/comments` as any)}
                style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.8 }]}
              >
                <Ionicons name="chatbubble-outline" size={18} color="#111" />
                <ThemedText style={styles.actionText}>
                  {post.commentCount ?? 0}
                </ThemedText>
              </Pressable>
            </ThemedView>
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
  center: { marginTop: 24, alignItems: "center" },

  authorRow: {
    padding: 12,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.90)",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  avatarFake: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.06)",
  },
  authorName: { fontWeight: "800", color: "#111" },
  dateText: { fontSize: 12, opacity: 0.65, color: "#111", marginTop: 2 },

  imgWrap: {
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    backgroundColor: "rgba(0,0,0,0.04)",
  },
  img: { width: "100%", height: 340 },

  textCard: {
    padding: 12,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.90)",
  },
  postText: { color: "#111", lineHeight: 20 },

  actionsRow: {
    padding: 12,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.90)",
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between",
  },
  actionBtn: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    backgroundColor: "rgba(0,0,0,0.04)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  actionText: { fontWeight: "800", color: "#111" },
});