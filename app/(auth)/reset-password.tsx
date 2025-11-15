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

const bgImage = require("../../assets/images/Background_App.jpg");

export default function ResetPasswordScreen() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSendEmail = async () => {
    console.log("▶️ Reset Password button pressed");

    if (!email) {
      setError("Please enter your email");
      setInfo("");
      return;
    }

    try {
      setLoading(true);
      setError("");
      setInfo("");

      // 👉 ajustează endpoint-ul dacă în backend e altceva!
      console.log("📨 Sending request to /auth/forgot-password ...");
      const res = await api.post("/auth/forgot-password", { email });

      console.log("✅ Reset response:", res.data);

      const msg =
        res.data?.message ||
        "If this email exists, we sent you reset instructions.";

      setInfo(msg);
      Alert.alert("Success", msg);
    } catch (e: any) {
      console.log(
        "❌ Reset error:",
        e?.response?.data || e.message || e.toString()
      );

      const msg =
        e?.response?.data?.message ||
        e?.response?.data?.error ||
        "Something went wrong. Try again.";

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
              <Text style={styles.headerText}>Reset Password</Text>
              <View style={{ width: 32 }} />
            </View>

            {/* BACKGROUND + CARD */}
            <View style={styles.imageWrapper}>
              <ImageBackground source={bgImage} style={styles.image}>
                <View style={styles.contentWrapper}>
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

                    {error ? <Text style={styles.error}>{error}</Text> : null}
                    {info ? <Text style={styles.info}>{info}</Text> : null}

                    <Pressable
                      style={[
                        styles.sendButton,
                        loading && { opacity: 0.6 },
                      ]}
                      onPress={handleSendEmail}
                      disabled={loading}
                    >
                      <Text style={styles.sendButtonText}>
                        {loading ? "Sending..." : "Send Email"}
                      </Text>
                    </Pressable>
                  </View>
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
  },
  contentWrapper: {
    flex: 1,
    justifyContent: "center",
  },
  formPanel: {
    marginHorizontal: 32,
    paddingHorizontal: 24,
    paddingVertical: 26,
    borderRadius: 26,
    backgroundColor: "rgba(255,255,255,0.82)",
    gap: 18,
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
  sendButton: {
    alignSelf: "center",
    marginTop: 4,
    paddingHorizontal: 40,
    paddingVertical: 10,
    borderRadius: 24,
    backgroundColor: "rgba(255,240,225,0.96)",
    elevation: 2,
  },
  sendButtonText: {
    fontSize: 20,
    fontWeight: "700",
    color: "#3a2415",
  },
  error: {
    color: "red",
    textAlign: "center",
    fontSize: 14,
  },
  info: {
    color: "#2b1a10",
    textAlign: "center",
    fontSize: 14,
  },
});
