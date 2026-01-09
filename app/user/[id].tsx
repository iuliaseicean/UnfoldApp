import React, { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, View } from "react-native";
import { useLocalSearchParams } from "expo-router";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { getUserById, UserItem } from "@/lib/users";

export default function UserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [user, setUser] = useState<UserItem | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        const u = await getUserById(Number(id));
        if (alive) setUser(u);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [id]);

  if (loading) {
    return (
      <ThemedView style={styles.center}>
        <ActivityIndicator />
        <ThemedText style={{ marginTop: 10 }}>Se încarcă profilul...</ThemedText>
      </ThemedView>
    );
  }

  if (!user) {
    return (
      <ThemedView style={styles.center}>
        <ThemedText>Nu am găsit user-ul.</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <ThemedText type="title">{user.username || user.name || "User"}</ThemedText>
      {!!user.email && <ThemedText style={{ opacity: 0.75 }}>{user.email}</ThemedText>}
      {!!user.bio && <ThemedText style={{ marginTop: 10 }}>{user.bio}</ThemedText>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 8 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
});
