import { useEffect, useState } from "react";
import { ScrollView, RefreshControl, StyleSheet, ImageBackground } from "react-native";

import { getPosts, PostItem } from "@/lib/posts";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";

const BG = require("@/assets/images/brown-metallic-foil-background-texture-free-photo.jpg");

export default function HomeScreen() {
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const data = await getPosts();
      setPosts(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <ImageBackground source={BG} style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
      >
        {posts.length === 0 && (
          <ThemedText style={styles.empty}>Nu există postări încă.</ThemedText>
        )}

        {posts.map((post) => (
          <ThemedView key={post.id} style={styles.card}>
            <ThemedText style={styles.author}>
              {post.User?.name || "User"}
            </ThemedText>

            <ThemedText style={styles.text}>
              {post.content_text}
            </ThemedText>

            <ThemedText style={styles.date}>
              {new Date(post.created_at).toLocaleString()}
            </ThemedText>
          </ThemedView>
        ))}
      </ScrollView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12 },
  card: {
    padding: 14,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.85)",
  },
  author: { fontWeight: "600", marginBottom: 4 },
  text: { fontSize: 16 },
  date: { marginTop: 6, fontSize: 12, opacity: 0.6 },
  empty: { textAlign: "center", opacity: 0.6 },
});
