import { useEffect, useState, useCallback } from "react";
import {
  ScrollView,
  RefreshControl,
  StyleSheet,
  ImageBackground,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams } from "expo-router";

import { getCapsuleById } from "../../lib/capsules";
import { Capsule } from "../../types/capsule";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";

const BG = require("@/assets/images/brown-metallic-foil-background-texture-free-photo.jpg");

export default function CapsuleDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const [capsule, setCapsule] = useState<Capsule | null>(null);
  const [contributions, setContributions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadCapsule = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await getCapsuleById(Number(id));
      setCapsule(data.capsule ?? null);
      setContributions(data.contributions ?? []);
    } catch {
      setCapsule(null);
      setContributions([]);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadCapsule();
  }, [loadCapsule]);

  return (
    <ImageBackground source={BG} style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={loadCapsule} />
        }
      >
        {loading ? (
          <ThemedView style={styles.center}>
            <ActivityIndicator />
            <ThemedText style={[styles.textDark, { marginTop: 8 }]}>
              Loading capsule…
            </ThemedText>
          </ThemedView>
        ) : !capsule ? (
          <ThemedText style={[styles.notFound, styles.textDark]}>
            Capsule not found.
          </ThemedText>
        ) : (
          <ThemedView style={styles.card}>
            {/* TITLE */}
            <ThemedText type="title" style={[styles.title, styles.textDark]}>
              {capsule.title ?? "Untitled capsule"}
            </ThemedText>

            {/* DESCRIPTION */}
            {!!capsule.description && (
              <ThemedText style={[styles.desc, styles.textDark]}>
                {capsule.description}
              </ThemedText>
            )}

            {/* META */}
            <ThemedText style={[styles.meta, styles.textDark]}>
              Type: {capsule.capsule_type}
            </ThemedText>
            <ThemedText style={[styles.meta, styles.textDark]}>
              Status: {capsule.status}
            </ThemedText>

            {/* CONTRIBUTIONS */}
            <ThemedText style={[styles.sectionTitle, styles.textDark]}>
              Contributions
            </ThemedText>

            {contributions.length === 0 ? (
              <ThemedText style={[styles.meta, styles.textDark]}>
                No contributions yet (or capsule still locked).
              </ThemedText>
            ) : (
              contributions.map((c, idx) => (
                <ThemedView key={idx} style={styles.contribution}>
                  <ThemedText
                    style={[styles.contributionAuthor, styles.textDark]}
                  >
                    {c?.User?.username ??
                      c?.User?.email ??
                      "User"}
                  </ThemedText>

                  {!!c?.content_text && (
                    <ThemedText
                      style={[styles.contributionText, styles.textDark]}
                    >
                      {c.content_text}
                    </ThemedText>
                  )}

                  {!!c?.media_url && (
                    <ThemedText
                      style={[styles.contributionText, styles.textDark]}
                    >
                      📎 {c.media_url}
                    </ThemedText>
                  )}

                  {!!c?.created_at && (
                    <ThemedText
                      style={[styles.contributionDate, styles.textDark]}
                    >
                      {new Date(c.created_at).toLocaleString()}
                    </ThemedText>
                  )}
                </ThemedView>
              ))
            )}
          </ThemedView>
        )}
      </ScrollView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 28,
  },

  center: {
    marginTop: 40,
    alignItems: "center",
  },

  textDark: {
    color: "#000",
  },

  notFound: {
    padding: 16,
  },

  card: {
    borderRadius: 18,
    padding: 14,
    backgroundColor: "rgba(255,255,255,0.88)",
  },

  title: {
    marginBottom: 8,
  },

  desc: {
    opacity: 0.85,
    marginBottom: 10,
  },

  meta: {
    marginTop: 6,
    fontSize: 13,
    opacity: 0.8,
  },

  sectionTitle: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: "700",
  },

  contribution: {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.06)",
  },

  contributionAuthor: {
    fontWeight: "700",
    marginBottom: 6,
  },

  contributionText: {
    fontSize: 14,
  },

  contributionDate: {
    marginTop: 6,
    fontSize: 12,
    opacity: 0.6,
  },
});
