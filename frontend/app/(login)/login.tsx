import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Button,
} from "react-native";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  getAuth,
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithCredential,
  signInWithPopup,
} from "firebase/auth";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { styles } from "../styles";

export default function LoginScreen() {
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [googleLoading, setGoogleLoading] = useState<boolean>(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const auth = getAuth();

  useEffect(() => {
    GoogleSignin.configure({
      webClientId: "",
    });
  }, []);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("Error", "Please enter both email and password.");
      return;
    }

    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(
        auth,
        email,
        password
      );
      const user = userCredential.user;
      if (user) {
        router.replace("../(tabs)");
      }
      if (!user.emailVerified) {
        Alert.alert(
          "Verification Required",
          "Please verify your email before logging in."
        );
        setLoading(false);
        return;
      }
    } catch (error: any) {
      setLoading(false);
      let message = "An unexpected error occurred.";
      if (error.code === "auth/invalid-credential")
        message = "Invalid email or password.";
      if (error.code === "auth/user-not-found")
        message = "No user found with this email.";
      if (error.code === "auth/wrong-password") message = "Incorrect password.";
      Alert.alert("Login Failed", message);
    }
  };

  const handleGoogleLogin = async () => {
    console.log("1. Button pressed, starting login...");
    setGoogleLoading(true);
    console.log("2. Platform detected:", Platform.OS);
    if (Platform.OS == "ios") {
      try {
        await GoogleSignin.hasPlayServices();
        const response = await GoogleSignin.signIn();
        if (response?.data?.idToken) {
          const { idToken } = response.data;
          const googleCredential = GoogleAuthProvider.credential(idToken);
          await signInWithCredential(auth, googleCredential);
          router.replace("../(tabs)");
        } else {
          setGoogleLoading(false);
          Alert.alert("Login Error", "Could not retrieve Google credentials.");
        }
      } catch (error: any) {
        setGoogleLoading(false);
        if (error.code === "SIGN_IN_CANCELLED") {
          console.log("User cancelled login");
        } else if (error.code === "IN_PROGRESS") {
          Alert.alert("Error", "Sign in already in progress");
        } else if (error.code === "PLAY_SERVICES_NOT_AVAILABLE") {
          Alert.alert("Error", "Google Play Services not available");
        } else {
          console.error(error);
          Alert.alert("Google Login Error", error.message);
        }
      }
    } else if (Platform.OS === "web") {
      try {
        const provider = new GoogleAuthProvider();
        const result = await signInWithPopup(auth, provider);
        console.log("User signed in: ", result.user.email);
        router.replace("../(tabs)");
      } catch (error: any) {
        setIsGoogleLoading(false);
        const errorMessage = error.message;
        if (error.code === "auth/popup-closed-by-user") {
          console.log("Popup closed");
        } else {
          Alert.alert("Google Sign-In Error", errorMessage);
        }
      }
    }
  };
  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <Text style={styles.appName}>Video-Guard-AI</Text>
            <Text style={styles.title}>Welcome Back!</Text>
            <Text style={styles.subtitle}>
              Log in to analyze TikTok and Instagram videos
            </Text>
          </View>
          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. ada@toromail.csudh.edu"
                placeholderTextColor="#9ca3af"
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={(text) => setEmail(text.trim())}
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={styles.passwordInput}
                  placeholder="Enter your password"
                  placeholderTextColor="#9ca3af"
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={setPassword}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.eyeIcon}
                >
                  <Ionicons
                    name={showPassword ? "eye-off-outline" : "eye-outline"}
                    size={24}
                    color="#6b7280"
                  />
                </TouchableOpacity>
              </View>
              <TouchableOpacity style={styles.forgotPassword}>
                <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={styles.loginButton}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.loginButtonText}>Log in</Text>
              )}
            </TouchableOpacity>
            <View style={styles.dividerContainer}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>OR</Text>
              <View style={styles.dividerLine} />
            </View>
            {/* <TouchableOpacity
              style={styles.googleButton}
              onPress={handleGoogleLogin}
            >
              <Ionicons
                name="logo-google"
                size={20}
                color="#111827"
                style={{ marginRight: 10 }}
              />
              <Text style={styles.googleButtonText}>Continue with Google</Text>
            </TouchableOpacity> */}
          </View>
          <View style={styles.footer}>
            <Text style={styles.footerText}>Don't have an account? </Text>
            <TouchableOpacity onPress={() => router.push("/signup")}>
              <Text style={styles.signUpLink}>Sign up</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
