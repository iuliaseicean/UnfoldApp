import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  StyleSheet,
} from "react-native";
import { router } from "expo-router";

import ParallaxScrollView from "@/components/parallax-scroll-view";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Fonts } from "@/constants/theme";

// ✅ asigură-te că există: lib/capsules.ts
import { getCapsules } from "@/lib/capsules";

// Tip minim (dacă ai deja types/capsule.ts, poți importa de acolo)
type Capsule = {
  capsule_id: number;
  title?: string | null;
  description?: string | null;
  capsule_type?: "time" | "contributors" | string;
  status?: "locked" | "open" | "archived" | string;
  open_at?: string | null;
  required_contributors?: number | null;
  created_at?: string | null;
};

function formatDate(value?: string | null) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString();
}

function statusLabel(status?: string) {
  if (!status) return "Unknown";
  if (status === "locked") return "Locked";
  if (status === "open") return "Open";
  if (status === "archived") return "Archived";
  return status;
}

export default function ExploreScreen() {
  const [capsules, setCapsules] = useState<Capsule[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string>("");

  const load = useCallback(async () => {
    try {
      setError("");
      const data = await getCapsules();
      setCapsules(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setError("Nu am putut încărca capsulele. Verifică backend-ul și EXPO_PUBLIC_API_URL.");
    } finally {
      setLoading(false);
    }
  }, []);

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

  const headerImage = useMemo(
    () => (
      <IconSymbol
        size={310}
        color="#808080"
        name="chevron.left.forwardslash.chevron.right"
        style={styles.headerImage}
      />
    ),
    []
  );

  return (
    <ParallaxScrollView
      headerBackgroundColor={{ light: "#D0D0D0", dark: "#353636" }}
      headerImage={headerImage}
    >
      <ThemedView style={styles.titleContainer}>
        <ThemedText type="title" style={{ fontFamily: Fonts.rounded }}>
          Explore
        </ThemedText>
      </ThemedView>

      <ThemedText style={styles.subtitle}>
        Capsulele tale (și cele la care ai acces). Apasă pe una ca să vezi detalii.
      </ThemedText>

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
        <ThemedView
          style={styles.list}
          // Pull-to-refresh pe scroll containerul din Parallax
        >
          <ThemedView
            style={styles.scrollHack}
            // @ts-expect-error: ParallaxScrollView forwards props to ScrollView internally
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
          />

          {capsules.length === 0 ? (
            <ThemedView style={styles.emptyBox}>
              <ThemedText style={styles.emptyTitle}>Nicio capsulă încă</ThemedText>
              <ThemedText style={styles.emptyText}>
                Creează una din tab-ul Create și va apărea aici.
              </ThemedText>
            </ThemedView>
          ) : (
            capsules.map((c) => {
              const title = c.title?.trim() || "Untitled capsule";
              const desc = c.description?.trim() || "";
              const openAt = c.open_at ? formatDate(c.open_at) : "";
              const metaLeft =
                c.capsule_type === "contributors"
                  ? `Contributors • ${c.required_contributors ?? "-"}`
                  : c.capsule_type === "time"
                  ? `Time • ${openAt ? `Open at ${openAt}` : "No date"}`
                  : c.capsule_type || "Type";

              const metaRight = statusLabel(c.status);

              return (
                <Pressable
                  key={c.capsule_id}
                  style={({ pressed }) => [
                    styles.card,
                    pressed && styles.cardPressed,
                  ]}
                  onPress={() => {
                    router.push(`/capsule/${c.capsule_id}` as any);
                  }}
                >
                  <ThemedText style={styles.cardTitle}>{title}</ThemedText>
                  {desc ? (
                    <ThemedText numberOfLines={2} style={styles.cardDesc}>
                      {desc}
                    </ThemedText>
                  ) : null}

                  <ThemedView style={styles.cardMetaRow}>
                    <ThemedText style={styles.cardMeta}>{metaLeft}</ThemedText>
                    <ThemedText style={styles.cardMeta}>{metaRight}</ThemedText>
                  </ThemedView>
                </Pressable>
              );
            })
          )}
        </ThemedView>
      )}
    </ParallaxScrollView>
  );
}

const styles = StyleSheet.create({
  headerImage: {
    color: "#808080",
    bottom: -90,
    left: -35,
    position: "absolute",
  },
  titleContainer: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  subtitle: {
    marginTop: 6,
    opacity: 0.85,
  },

  center: {
    marginTop: 24,
    alignItems: "center",
    justifyContent: "center",
  },

  list: {
    marginTop: 16,
    gap: 12,
  },

  // hack: unele template-uri de Parallax nu expun direct refreshControl;
  // asta previne warnings dacă componenta nu-l folosește.
  scrollHack: {
    height: 0,
  },

  card: {
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  cardPressed: {
    transform: [{ scale: 0.99 }],
    opacity: 0.9,
  },
  cardTitle: {
    fontSize: 18,
    fontFamily: Fonts.rounded,
  },
  cardDesc: {
    marginTop: 6,
    opacity: 0.85,
  },
  cardMetaRow: {
    marginTop: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },
  cardMeta: {
    fontSize: 12,
    opacity: 0.75,
  },

  emptyBox: {
    marginTop: 18,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  emptyTitle: {
    fontSize: 16,
    fontFamily: Fonts.rounded,
    marginBottom: 6,
  },
  emptyText: {
    opacity: 0.85,
  },

  errorBox: {
    marginTop: 18,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,0,0,0.25)",
    backgroundColor: "rgba(255,0,0,0.06)",
    gap: 10,
  },
  errorTitle: {
    fontSize: 16,
    fontFamily: Fonts.rounded,
  },
  errorText: {
    opacity: 0.9,
  },
  retryBtn: {
    alignSelf: "flex-start",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  retryText: {
    fontFamily: Fonts.rounded,
  },
});