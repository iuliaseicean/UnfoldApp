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

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    console.log("▶️ Login button pressed");

    if (!email || !password) {
      setError("Please fill in both fields");
      return;
    }

    try {
      setLoading(true);
      setError("");

      console.log("📨 Sending request to /auth/login ...");
      const res = await api.post("/auth/login", {
        email,
        password,
      });

      console.log("✅ Login response:", res.data);

      if (res.data?.token) {
        await saveToken(res.data.token);
        console.log("💾 Token saved, navigating to /(tabs)/home");
        Alert.alert("Success", "You are now logged in.");
        router.replace("/(tabs)/home");
      } else {
        console.log("⚠️ No token in response, staying on login");
        setError("Invalid response from server");
      }
    } catch (e: any) {
      console.log(
        "❌ Login error:",
        e?.response?.data || e.message || e.toString()
      );

      const msg =
        e?.response?.data?.message ||
        e?.response?.data?.error ||
        "Login failed. Check your credentials.";

      setError(msg);
      Alert.alert("Error", msg);
    } finally {
      setLoading(false);
    }
  };

  const goToRegister = () => {
    router.push("/(auth)/register");
  };

  const goToResetPassword = () => {
    router.push("/(auth)/reset-password");
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
            {/* HEADER LOGIN */}
            <View style={styles.header}>
              <Text style={styles.headerText}>Login</Text>
            </View>

            {/* BACKGROUND CU CARD-URI PESTE */}
            <View style={styles.imageWrapper}>
              <ImageBackground source={bgImage} style={styles.image}>
                {/* Titlu Unfold */}
                <View style={styles.topPanel}>
                  <Text style={styles.appTitle}>Unfold</Text>
                </View>

                {/* Form */}
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

                  {error ? <Text style={styles.error}>{error}</Text> : null}

                  {/* Buton Login */}
                  <Pressable
                    style={[
                      styles.loginButton,
                      loading && { opacity: 0.6 },
                    ]}
                    onPress={handleLogin}
                    disabled={loading}
                  >
                    <Text style={styles.loginButtonText}>
                      {loading ? "Logging in..." : "Login"}
                    </Text>
                  </Pressable>

                  {/* Text Sign up */}
                  <View style={styles.rowBetween}>
                    <Text style={styles.smallText}>
                      Don’t have an account?
                    </Text>
                    <Pressable onPress={goToRegister}>
                      <Text style={[styles.smallText, styles.linkText]}>
                        Sign UP
                      </Text>
                    </Pressable>
                  </View>
                </View>

                {/* Forgot password */}
                <View style={styles.bottomPanel}>
                  <Text style={styles.smallText}>Forgot your password?</Text>
                  <Pressable onPress={goToResetPassword}>
                    <Text style={[styles.smallText, styles.resetText]}>
                      Reset Pass
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
    backgroundColor: "#000000",
    borderRadius: BORDER_RADIUS,
  },
  header: {
    backgroundColor: "#D1A686",
    paddingVertical: 16,
    alignItems: "center",
  },
  headerText: {
    fontSize: 24,
    fontWeight: "700",
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
    justifyContent: "space-between",
    paddingVertical: 24,
  },
  topPanel: {
    marginHorizontal: 24,
    paddingVertical: 18,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.75)",
    alignItems: "center",
  },
  appTitle: {
    fontSize: 32,
    fontWeight: "800",
    color: "#3a2415",
  },
  formPanel: {
    marginHorizontal: 24,
    paddingHorizontal: 16,
    paddingVertical: 20,
    borderRadius: 26,
    backgroundColor: "rgba(255,255,255,0.78)",
    gap: 16,
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
  loginButton: {
    marginTop: 8,
    alignSelf: "center",
    paddingHorizontal: 40,
    paddingVertical: 10,
    borderRadius: 24,
    backgroundColor: "rgba(255,240,225,0.95)",
    elevation: 2,
  },
  loginButtonText: {
    fontSize: 22,
    fontWeight: "700",
    color: "#3a2415",
  },
  rowBetween: {
    marginTop: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  smallText: {
    fontSize: 14,
    color: "#2c231e",
  },
  linkText: {
    fontWeight: "700",
  },
  bottomPanel: {
    marginHorizontal: 24,
    marginTop: 24,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.85)",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  resetText: {
    color: "red",
    fontWeight: "700",
  },
  error: {
    marginTop: 4,
    textAlign: "center",
    color: "red",
    fontSize: 14,
  },
});
