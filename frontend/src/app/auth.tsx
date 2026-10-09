import React, { useState } from "react";
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { router } from "expo-router";
import { API_URL } from "../constants/api";
import { notify } from "../lib/dialog";
import { saveSession } from "../lib/session";

export default function AuthScreen() {
  const [isLogin, setIsLogin] = useState(true);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const handleSubmit = async () => {
  const cleanName = fullName.trim();
  const cleanEmail = email.trim().toLowerCase();

  /* =========================
     BASIC VALIDATION
     ========================= */

  if (!cleanEmail || !password) {
    notify(
      "Missing Details",
      "Please enter your email and password."
    );
    return;
  }

  if (!cleanEmail.includes("@")) {
    notify(
      "Invalid Email",
      "Please enter a valid email address."
    );
    return;
  }

  if (password.length < 6) {
    notify(
      "Password Too Short",
      "Password must contain at least 6 characters."
    );
    return;
  }

  /* =========================
     REGISTER
     ========================= */

  if (!isLogin) {
    if (!cleanName) {
      notify(
        "Missing Name",
        "Please enter your full name."
      );
      return;
    }

    if (password !== confirmPassword) {
      notify(
        "Password Mismatch",
        "Passwords do not match."
      );
      return;
    }

    try {
      setLoading(true);

      console.log(
        "Sending registration request..."
      );

      const response = await fetch(
        `${API_URL}/api/auth/register`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            fullName: cleanName,
            email: cleanEmail,
            password: password,
          }),
        }
      );

      const data = await response.json();

      /* Never log `data` here: it contains the login token. */
      console.log(
        "Registration response:",
        data.success ? "success" : data.message
      );

      if (!response.ok || !data.success) {
        throw new Error(
          data.message ||
            "Could not create your account."
        );
      }

      if (Platform.OS === "web") {
        notify(
          "Registration Successful",
          "Your Spirit Health account has been created."
        );
        setIsLogin(true);
        setPassword("");
        setConfirmPassword("");
      } else {
        Alert.alert(
          "Registration Successful",
          "Your Spirit Health account has been created.",
          [
            {
              text: "Continue to Login",
              onPress: () => {
                setIsLogin(true);
                setPassword("");
                setConfirmPassword("");
              },
            },
          ]
        );
      }

    } catch (error: any) {
      console.error(
        "Registration error:",
        error
      );

      notify(
        "Registration Failed",
        error?.message ||
          "Could not connect to the Spirit Health server."
      );

    } finally {
      setLoading(false);
    }

    return;
  }

  /* =========================
     LOGIN
     ========================= */

  try {
    setLoading(true);

    console.log(
      "Sending login request..."
    );

    const response = await fetch(
      `${API_URL}/api/auth/login`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: cleanEmail,
          password: password,
        }),
      }
    );

    const data = await response.json();

    /* Never log `data` here: it contains the login token. */
    console.log(
      "Login response:",
      data.success ? "success" : data.message
    );

    if (!response.ok || !data.success) {
      throw new Error(
        data.message ||
          "Login failed."
      );
    }

    /* SAVE USER */

    if (!data.token) {
      throw new Error(
        "The server did not return a login token. Please update the backend."
      );
    }

    await saveSession(data.user, data.token);

    setLoading(false);

    /* GO TO DASHBOARD */

    router.replace("/");

  } catch (error: any) {
    console.error(
      "Login error:",
      error
    );

    notify(
      "Login Failed",
      error?.message ||
        "Could not connect to the Spirit Health server."
    );

    setLoading(false);
  }
};

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.mainCard}>
          {/* LOGO */}
          <View style={styles.logoContainer}>
            <Image
              source={require("../../assets/images/spirit-health.png")}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>

          <Text style={styles.title}>
            {isLogin ? "Welcome Back!" : "Create Your Account"}
          </Text>

          <Text style={styles.subtitle}>
            {isLogin
              ? "Sign in to continue your health journey"
              : "Start managing your health with Spirit Health"}
          </Text>

          {/* LOGIN / REGISTER TABS */}
          <View style={styles.tabs}>
            <TouchableOpacity
              style={[styles.tab, isLogin && styles.activeTab]}
              onPress={() => setIsLogin(true)}
            >
              <Text
                style={[
                  styles.tabText,
                  isLogin && styles.activeTabText,
                ]}
              >
                Login
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tab, !isLogin && styles.activeTab]}
              onPress={() => setIsLogin(false)}
            >
              <Text
                style={[
                  styles.tabText,
                  !isLogin && styles.activeTabText,
                ]}
              >
                Register
              </Text>
            </TouchableOpacity>
          </View>

          {/* FULL NAME */}
          {!isLogin && (
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Full Name</Text>

              <TextInput
                value={fullName}
                onChangeText={setFullName}
                placeholder="Enter your full name"
                placeholderTextColor="#94A3B8"
                style={styles.input}
                autoCapitalize="words"
              />
            </View>
          )}

          {/* EMAIL */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Email</Text>

            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="Enter your email"
              placeholderTextColor="#94A3B8"
              style={styles.input}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          {/* PASSWORD */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Password</Text>

            <View style={styles.passwordBox}>
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="Enter your password"
                placeholderTextColor="#94A3B8"
                style={styles.passwordInput}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
              />

              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
              >
                <Text style={styles.showText}>
                  {showPassword ? "Hide" : "Show"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* CONFIRM PASSWORD */}
          {!isLogin && (
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Confirm Password</Text>

              <View style={styles.passwordBox}>
                <TextInput
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Confirm your password"
                  placeholderTextColor="#94A3B8"
                  style={styles.passwordInput}
                  secureTextEntry={!showConfirmPassword}
                  autoCapitalize="none"
                />

                <TouchableOpacity
                  onPress={() =>
                    setShowConfirmPassword(!showConfirmPassword)
                  }
                >
                  <Text style={styles.showText}>
                    {showConfirmPassword ? "Hide" : "Show"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* SUBMIT */}
          <TouchableOpacity
            style={[
              styles.submitButton,
              loading && { opacity: 0.6 },
            ]}
            onPress={handleSubmit}
            activeOpacity={0.8}
            disabled={loading}
          >
            <Text style={styles.submitText}>
              {loading
                ? "Please wait..."
                : isLogin
                ? "Login to Spirit Health"
                : "Create Account"}
            </Text>
          </TouchableOpacity>

          {/* SWITCH */}
          <View style={styles.switchRow}>
            <Text style={styles.switchText}>
              {isLogin
                ? "Don't have an account?"
                : "Already have an account?"}
            </Text>

            <TouchableOpacity
              onPress={() => setIsLogin(!isLogin)}
            >
              <Text style={styles.switchLink}>
                {isLogin ? " Register" : " Login"}
              </Text>
            </TouchableOpacity>
          </View>

          {/* FEATURES */}
          <View style={styles.features}>
            <View style={styles.feature}>
              <Text style={styles.featureIcon}>📄</Text>
              <Text style={styles.featureText}>Medical Records</Text>
            </View>

            <View style={styles.feature}>
              <Text style={styles.featureIcon}>🤖</Text>
              <Text style={styles.featureText}>AI Analysis</Text>
            </View>

            <View style={styles.feature}>
              <Text style={styles.featureIcon}>🔊</Text>
              <Text style={styles.featureText}>Voice Support</Text>
            </View>
          </View>

          <Text style={styles.demoNote}>
            Prototype authentication • Hackathon MVP
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#EEF6FF",
  },

  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },

  mainCard: {
    width: "100%",
    maxWidth: 480,
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    padding: 28,
    shadowColor: "#173F67",
    shadowOpacity: 0.12,
    shadowRadius: 20,
    shadowOffset: {
      width: 0,
      height: 8,
    },
    elevation: 6,
  },

  logoContainer: {
    alignItems: "center",
    marginBottom: 8,
  },

  logo: {
    width: 170,
    height: 90,
  },

  title: {
    textAlign: "center",
    fontSize: 27,
    fontWeight: "800",
    color: "#173F67",
  },

  subtitle: {
    textAlign: "center",
    color: "#718096",
    marginTop: 7,
    marginBottom: 22,
    fontSize: 14,
  },

  tabs: {
    flexDirection: "row",
    backgroundColor: "#F1F5F9",
    borderRadius: 12,
    padding: 4,
    marginBottom: 22,
  },

  tab: {
    flex: 1,
    paddingVertical: 11,
    alignItems: "center",
    borderRadius: 9,
  },

  activeTab: {
    backgroundColor: "#2468A8",
  },

  tabText: {
    fontWeight: "700",
    color: "#64748B",
  },

  activeTabText: {
    color: "#FFFFFF",
  },

  inputContainer: {
    marginBottom: 16,
  },

  label: {
    fontSize: 13,
    fontWeight: "700",
    color: "#334E68",
    marginBottom: 7,
  },

  input: {
    height: 50,
    borderWidth: 1,
    borderColor: "#D8E2EC",
    borderRadius: 11,
    paddingHorizontal: 14,
    fontSize: 14,
    color: "#243B53",
    backgroundColor: "#FBFDFF",
  },

  passwordBox: {
    height: 50,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#D8E2EC",
    borderRadius: 11,
    paddingLeft: 14,
    paddingRight: 12,
    backgroundColor: "#FBFDFF",
  },

  passwordInput: {
    flex: 1,
    fontSize: 14,
    color: "#243B53",
  },

  showText: {
    color: "#2468A8",
    fontWeight: "700",
    fontSize: 12,
  },

  submitButton: {
    height: 52,
    backgroundColor: "#2468A8",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },

  submitText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },

  switchRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 18,
  },

  switchText: {
    color: "#718096",
    fontSize: 13,
  },

  switchLink: {
    color: "#2468A8",
    fontWeight: "800",
    fontSize: 13,
  },

  features: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 24,
    paddingTop: 18,
    borderTopWidth: 1,
    borderTopColor: "#EEF2F6",
  },

  feature: {
    alignItems: "center",
    flex: 1,
  },

  featureIcon: {
    fontSize: 21,
    marginBottom: 4,
  },

  featureText: {
    fontSize: 10,
    color: "#718096",
    fontWeight: "600",
    textAlign: "center",
  },

  demoNote: {
    textAlign: "center",
    color: "#A0AEC0",
    fontSize: 10,
    marginTop: 18,
  },
});