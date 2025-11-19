import { Alert, TextInput, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { Text } from "react-native";
import React, { useState } from "react";
import { router } from "expo-router";

export default function LoginScreen() {
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");

  const handleLogin = () => {
    signInWithEmailAndPassword(getAuth(), email, password)
      .then((user) => {
        if (!user.user.emailVerified) {
          Alert.alert(
            "Email Verification required",
            "Please verify your email",
            [{ text: "OK" }]
          );
        }
        if (user) router.replace("../(tabs)");
      })
      .catch((Error) => {
        Alert.alert("User not found", "Email and Password are incorrect", [
          { text: "OK" },
        ]);
      });
  };
  return (
    <SafeAreaView>
      <Text>Purrfect Health</Text>
      <Text>Welcome Back!</Text>
      <Text>Email:</Text>
      <TextInput
        placeholder="e.g. AdaLovelace@toromail.csudh.edu"
        keyboardType="email-address"
        onChangeText={(text) => setEmail(text.toLowerCase())}
        autoCorrect={false}
        placeholderTextColor={"#D3D3D3"}
      />
      <Text>Password</Text>
      <TextInput
        placeholder="Password"
        secureTextEntry
        onChangeText={(text) => setPassword(text)}
        placeholderTextColor={"#D3D3D3"}
      />

      <TouchableOpacity onPress={handleLogin}>
        <Text>Log in</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}
