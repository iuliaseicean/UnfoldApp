import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ImageBackground,
  Pressable,
  Switch,
  ActivityIndicator,
  Image,
  Alert,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import api from "../../lib/api";
import { deleteToken } from "../../hooks/useSecureStore";

const bgImage = require("../../assets/images/brown-metallic-foil-background-texture-free-photo.jpg");

type MeResponse = {
  id: number;
  username: string;
  email: string;
  bio?: string | null;
};

export default function ProfileScreen() {
  const [user, setUser] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [publicAccount, setPublicAccount] = useState(true); // momentan doar local
  const [error, setError] = useState("");
  const [avatarUri, setAvatarUri] = useState<string | null>(null);

  useEffect(() => {
    const fetchMe = async () => {
      try {
        setError("");
        setLoading(true);

        const res = await api.get<MeResponse>("/auth/me");
        setUser(res.data);
      } catch (e: any) {
        console.log("Error loading /auth/me:", e?.message || e);
        setError("Couldn't load profile. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchMe();
  }, []);

  const handleLogout = async () => {
    try {
      await deleteToken();
      router.replace("/(auth)/login");
    } catch (e) {
      console.log("Logout error:", e);
    }
  };

  // Alege poza de profil din galerie
  const handlePickAvatar = async () => {
    try {
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (status !== "granted") {
        Alert.alert(
          "Permission needed",
          "We need access to your photos to set a profile picture."
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled) {
        const uri = result.assets[0].uri;
        setAvatarUri(uri);
      }
    } catch (e) {
      console.log("Avatar pick error:", e);
    }
  };

  const username = user?.username ?? "unfold_user";
  const email = user?.email ?? "unfolduser@example.com";

  return (
    <View style={styles.root}>
      <View style={styles.cardWrapper}>
        {/* HEADER SUS CU USERNAME */}
        <View style={styles.header}>
          <Text style={styles.headerText}>{username}</Text>
        </View>

        {/* BACKGROUND CU TEXTURA */}
        <View style={styles.imageWrapper}>
          <ImageBackground source={bgImage} style={styles.image}>
            <View style={styles.content}>
              {/* CARD AVATAR */}
              <View style={styles.avatarCard}>
                <Pressable
                  style={styles.avatarPressable}
                  onPress={handlePickAvatar}
                >
                  {avatarUri ? (
                    <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
                  ) : (
                    <View style={styles.avatarCircle} />
                  )}
                </Pressable>
                <Text style={styles.tapToChangeText}>
                  Tap to change photo
                </Text>
              </View>

              {/* EMAIL */}
              <Text style={styles.emailText}>{email}</Text>

              {/* TOGGLE PUBLIC ACCOUNT */}
              <View style={styles.toggleContainer}>
                <View style={styles.toggleTrack}>
                  <Text style={styles.toggleLabel}>Public Account</Text>
                  <View style={styles.toggleSwitchWrapper}>
                    <Switch
                      value={publicAccount}
                      onValueChange={setPublicAccount}
                      thumbColor="#f28f3b"
                      trackColor={{ false: "#f3e1c8", true: "#f3e1c8" }}
                    />
                  </View>
                </View>
              </View>

              {/* LOADING / ERROR */}
              {loading && (
                <View style={{ marginTop: 12 }}>
                  <ActivityIndicator color="#3a2415" />
                </View>
              )}

              {error ? <Text style={styles.error}>{error}</Text> : null}

              {/* BUTON LOGOUT */}
              <Pressable style={styles.logoutButton} onPress={handleLogout}>
                <Text style={styles.logoutButtonText}>Logout</Text>
              </Pressable>
            </View>
          </ImageBackground>
        </View>
      </View>
    </View>
  );
}

const BORDER_RADIUS = 26;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#1E1E1E",
    paddingHorizontal: 16,
    paddingVertical: 32,
  },
  cardWrapper: {
    flex: 1,
    borderRadius: BORDER_RADIUS,
    overflow: "hidden",
  },
  header: {
    backgroundColor: "#D1A686",
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: {
    fontSize: 20,
    fontWeight: "700",
    color: "#2b1a10",
  },
  imageWrapper: {
    flex: 1,
    backgroundColor: "#000",
  },
  image: {
    flex: 1,
    justifyContent: "flex-start",
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 24,
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 24,
  },
  avatarCard: {
    width: "100%",
    paddingVertical: 32,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.65)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarPressable: {
    width: 120,
    height: 120,
    borderRadius: 60,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "#d0c0b4",
  },
  avatarImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  tapToChangeText: {
    marginTop: 8,
    fontSize: 12,
    color: "#3a2415",
    opacity: 0.8,
  },
  emailText: {
    marginTop: 8,
    fontSize: 18,
    fontWeight: "700",
    color: "#ffffff",
    textShadowColor: "rgba(0,0,0,0.4)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  toggleContainer: {
    width: "100%",
  },
  toggleTrack: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.85)",
  },
  toggleLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
    color: "#3a2415",
  },
  toggleSwitchWrapper: {
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 20,
    backgroundColor: "#f3e1c8",
  },
  logoutButton: {
    marginTop: 32,
    paddingHorizontal: 40,
    paddingVertical: 12,
    borderRadius: 26,
    backgroundColor: "rgba(255,240,225,0.96)",
  },
  logoutButtonText: {
    fontSize: 20,
    fontWeight: "700",
    color: "#3a2415",
  },
  error: {
    marginTop: 8,
    color: "red",
    fontSize: 14,
    textAlign: "center",
  },
});
