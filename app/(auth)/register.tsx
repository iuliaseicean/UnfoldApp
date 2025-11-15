import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ImageBackground,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from "react-native";
import { router } from "expo-router";
import api from "../../lib/api";
import { saveToken } from "../../hooks/useSecureStore";

const bgImage = require("../../assets/images/Background_App.jpg");

export default function RegisterScreen() {
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    console.log("▶️ Create Account pressed");

    if (!email || !username || !password || !confirmPassword) {
      setError("Please fill in all fields");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    try {
      setLoading(true);
      setError("");

      console.log("📨 Sending request to /auth/register ...");
      const res = await api.post("/auth/register", {
        email,
        username,
        password,
      });

      console.log("✅ Register response:", res.data);

      // dacă backend-ul trimite token direct:
      if (res.data?.token) {
        await saveToken(res.data.token);
        console.log("💾 Token saved, navigating to /(tabs)/home");
        Alert.alert("Success", "Account created. You're logged in.");
        router.replace("/(tabs)/home");
      } else {
        // dacă backend-ul doar confirmă register-ul
        Alert.alert("Success", "Account created. Please log in.");
        console.log("ℹ️ No token returned, going back to login");
        router.replace("/(auth)/login");
      }
    } catch (e: any) {
      console.log(
        "❌ Register error:",
        e?.response?.data || e.message || e.toString()
      );

      const msg =
        e?.response?.data?.message ||
        e?.response?.data?.error ||
        "Registration failed. Please try again.";

      setError(msg);
      Alert.alert("Error", msg);
    } finally {
      setLoading(false);
    }
  };

  const goBack = () => {
    router.back();
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.cardWrapper}>
          <View style={styles.card}>
            {/* HEADER SUS */}
            <View style={styles.header}>
              <Pressable style={styles.backButton} onPress={goBack}>
                <Text style={styles.backText}>‹</Text>
              </Pressable>
              <Text style={styles.headerText}>Register</Text>
              <View style={{ width: 32 }} />
            </View>

            {/* BACKGROUND + CARD-URI */}
            <View style={styles.imageWrapper}>
              <ImageBackground source={bgImage} style={styles.image}>
                {/* panoul cu titlu Register */}
                <View style={styles.topPanel}>
                  <Text style={styles.appTitle}>Register</Text>
                </View>

                {/* FORM */}
                <View style={styles.formPanel}>
                  <View style={styles.inputWrapper}>
                    <Text style={styles.inputLabel}>Email</Text>
                    <TextInput
                      style={styles.input}
                      value={email}
                      onChangeText={setEmail}
                      placeholder="Your email"
                      placeholderTextColor="#777"
                      keyboardType="email-address"
                      autoCapitalize="none"
                    />
                  </View>

                  <View style={styles.inputWrapper}>
                    <Text style={styles.inputLabel}>Username</Text>
                    <TextInput
                      style={styles.input}
                      value={username}
                      onChangeText={setUsername}
                      placeholder="Your username"
                      placeholderTextColor="#777"
                      autoCapitalize="none"
                    />
                  </View>

                  <View style={styles.inputWrapper}>
                    <Text style={styles.inputLabel}>Password</Text>
                    <TextInput
                      style={styles.input}
                      value={password}
                      onChangeText={setPassword}
                      placeholder="Your password"
                      placeholderTextColor="#777"
                      secureTextEntry
                    />
                  </View>

                  <View style={styles.inputWrapper}>
                    <Text style={styles.inputLabel}>Re-Password</Text>
                    <TextInput
                      style={styles.input}
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      placeholder="Repeat password"
                      placeholderTextColor="#777"
                      secureTextEntry
                    />
                  </View>

                  {error ? <Text style={styles.error}>{error}</Text> : null}

                  {/* BUTON CREATE ACCOUNT */}
                  <Pressable
                    style={[
                      styles.registerButton,
                      loading && { opacity: 0.6 },
                    ]}
                    onPress={handleRegister}
                    disabled={loading}
                  >
                    <Text style={styles.registerButtonText}>
                      {loading ? "Creating..." : "Create Account"}
                    </Text>
                  </Pressable>
                </View>
              </ImageBackground>
            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const BORDER_RADIUS = 24;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1E1E1E",
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 32,
  },
  cardWrapper: {
    borderRadius: BORDER_RADIUS,
    overflow: "hidden",
  },
  card: {
    backgroundColor: "#000",
    borderRadius: BORDER_RADIUS,
  },
  header: {
    backgroundColor: "#D1A686",
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerText: {
    fontSize: 22,
    fontWeight: "700",
    color: "#2b1a10",
  },
  backButton: {
    width: 32,
    alignItems: "flex-start",
    justifyContent: "center",
  },
  backText: {
    fontSize: 26,
    fontWeight: "600",
    color: "#2b1a10",
  },
  imageWrapper: {
    borderBottomLeftRadius: BORDER_RADIUS,
    borderBottomRightRadius: BORDER_RADIUS,
    overflow: "hidden",
  },
  image: {
    width: "100%",
    minHeight: 550,
    paddingVertical: 24,
    justifyContent: "flex-start",
  },
  topPanel: {
    marginHorizontal: 24,
    paddingVertical: 18,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.75)",
    alignItems: "center",
    marginBottom: 16,
  },
  appTitle: {
    fontSize: 32,
    fontWeight: "800",
    color: "#3a2415",
  },
  formPanel: {
    marginHorizontal: 24,
    paddingHorizontal: 16,
    paddingVertical: 24,
    borderRadius: 26,
    backgroundColor: "rgba(255,255,255,0.78)",
    gap: 14,
  },
  inputWrapper: {
    gap: 4,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#3a2415",
    marginLeft: 4,
  },
  input: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#d0c0b4",
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: "rgba(255,255,255,0.9)",
  },
  registerButton: {
    marginTop: 18,
    alignSelf: "center",
    paddingHorizontal: 40,
    paddingVertical: 10,
    borderRadius: 24,
    backgroundColor: "rgba(255,240,225,0.96)",
    elevation: 2,
  },
  registerButtonText: {
    fontSize: 22,
    fontWeight: "700",
    color: "#3a2415",
  },
  error: {
    marginTop: 4,
    textAlign: "center",
    color: "red",
    fontSize: 14,
  },
});
