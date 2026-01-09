import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ImageBackground,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { addPostComment, getPostComments, PostCommentItem } from "@/lib/posts";

const BG = require("@/assets/images/brown-metallic-foil-background-texture-free-photo.jpg");

function formatDate(v?: string | null) {
  if (!v) return "";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString();
}

export default function PostCommentsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const postId = Number(id);

  const [items, setItems] = useState<PostCommentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    if (!Number.isFinite(postId) || postId <= 0) return;

    setLoading(true);
    try {
      const data = await getPostComments(postId);
      setItems(Array.isArray(data) ? data : []);
    } catch {
      setItems([]);
      Alert.alert("Eroare", "Nu am putut încărca comentariile.");
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

  const submit = useCallback(async () => {
    const t = text.trim();
    if (!t) return;

    try {
      setSending(true);
      await addPostComment(postId, t);
      setText("");
      await load();
    } catch {
      Alert.alert("Eroare", "Nu am putut trimite comentariul.");
    } finally {
      setSending(false);
    }
  }, [text, postId, load]);

  return (
    <ImageBackground source={BG} style={{ flex: 1 }}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color="#111" />
        </Pressable>
        <ThemedText style={styles.headerTitle}>Comments</ThemedText>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing || loading} onRefresh={onRefresh} />}
        keyboardShouldPersistTaps="handled"
      >
        {loading ? (
          <ThemedView style={styles.center}>
            <ActivityIndicator />
            <ThemedText style={{ marginTop: 8, color: "#111" }}>Loading…</ThemedText>
          </ThemedView>
        ) : items.length === 0 ? (
          <ThemedText style={styles.empty}>No comments yet.</ThemedText>
        ) : (
          items.map((c) => {
            const author = c.User?.name || c.User?.username || "User";
            return (
              <ThemedView key={c.id} style={styles.commentCard}>
                <ThemedText style={styles.commentAuthor}>{author}</ThemedText>
                <ThemedText style={styles.commentText}>{c.content_text}</ThemedText>
                <ThemedText style={styles.commentDate}>{formatDate(c.created_at)}</ThemedText>
              </ThemedView>
            );
          })
        )}
      </ScrollView>

      <View style={styles.composer}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Write a comment…"
          placeholderTextColor="#777"
          style={styles.input}
          multiline
        />

        <Pressable
          onPress={submit}
          disabled={sending}
          style={({ pressed }) => [
            styles.sendBtn,
            pressed && { opacity: 0.8 },
            sending && { opacity: 0.6 },
          ]}
        >
          <Ionicons name="send" size={18} color="#111" />
        </Pressable>
      </View>
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

  container: { padding: 16, paddingBottom: 120, gap: 10 },
  center: { marginTop: 24, alignItems: "center" },
  empty: { textAlign: "center", color: "#fff", opacity: 0.9, marginTop: 14 },

  commentCard: {
    padding: 12,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.90)",
    gap: 6,
  },
  commentAuthor: { fontWeight: "800", color: "#111" },
  commentText: { color: "#111", lineHeight: 19 },
  commentDate: { fontSize: 12, opacity: 0.65, color: "#111" },

  composer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: 12,
    backgroundColor: "rgba(255,255,255,0.92)",
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-end",
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 110,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.10)",
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#111",
    backgroundColor: "#fff",
  },
  sendBtn: {
    width: 46,
    height: 46,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.06)",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
  },
});