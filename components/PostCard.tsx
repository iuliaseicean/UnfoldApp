import { StyleSheet, View } from "react-native";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Fonts } from "@/constants/theme";
import { Post } from "@/types/post";

export function PostCard({ post }: { post: Post }) {
  return (
    <ThemedView style={styles.card}>
      <ThemedText style={styles.author}>
        {post.user?.username || post.user?.email || `user #${post.user_id}`}
      </ThemedText>

      {!!post.text && <ThemedText style={styles.text}>{post.text}</ThemedText>}

      <View style={styles.metaRow}>
        <ThemedText style={styles.meta}>
          {post.created_at ? new Date(post.created_at).toLocaleString() : ""}
        </ThemedText>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    padding: 14,
    backgroundColor: "rgba(255,255,255,0.82)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
    marginBottom: 12,
  },
  author: {
    fontFamily: Fonts.rounded,
    fontSize: 14,
    opacity: 0.9,
    marginBottom: 8,
  },
  text: {
    fontSize: 16,
    lineHeight: 22,
    marginBottom: 10,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  meta: {
    fontSize: 12,
    opacity: 0.65,
  },
});
