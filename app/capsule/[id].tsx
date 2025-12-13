import { useEffect, useState } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { getCapsuleById } from "../../lib/capsules";
import { Capsule } from "../../types/capsule";

export default function CapsuleDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [capsule, setCapsule] = useState<Capsule | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCapsule();
  }, []);

  const loadCapsule = async () => {
    try {
      const data = await getCapsuleById(Number(id));
      setCapsule(data);
    } catch {
      setCapsule(null);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <ActivityIndicator style={{ marginTop: 50 }} />;
  }

  if (!capsule) {
    return <Text>Capsule not found.</Text>;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        {capsule.title}
      </Text>

      {!!capsule.description && (
        <Text style={styles.desc}>
          {capsule.description}
        </Text>
      )}

      <Text style={styles.meta}>
        Type: {capsule.capsule_type}
      </Text>
      <Text style={styles.meta}>
        Status: {capsule.status}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  title: { fontSize: 22, fontWeight: "800" },
  desc: { marginTop: 10, opacity: 0.8 },
  meta: { marginTop: 12, fontSize: 13 },
});