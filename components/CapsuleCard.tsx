import { View, Text, Pressable, StyleSheet } from "react-native";
import { Capsule } from "../types/capsule";

type Props = {
  capsule: Capsule;
  onPress: () => void;
};

export default function CapsuleCard({ capsule, onPress }: Props) {
  return (
    <Pressable style={styles.card} onPress={onPress}>
      <Text style={styles.title}>
        {capsule.title || "Untitled capsule"}
      </Text>

      {!!capsule.description && (
        <Text style={styles.desc} numberOfLines={2}>
          {capsule.description}
        </Text>
      )}

      <View style={styles.meta}>
        <Text style={styles.metaText}>{capsule.capsule_type}</Text>
        <Text style={styles.metaText}>{capsule.status}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "white",
    padding: 14,
    borderRadius: 14,
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
  },
  desc: {
    marginTop: 6,
    opacity: 0.75,
  },
  meta: {
    marginTop: 10,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  metaText: {
    fontSize: 12,
    opacity: 0.6,
  },
});