import { TextInput, Text, TouchableOpacity, Alert } from "react-native";
import {
  getAuth,
  createUserWithEmailAndPassword,
  sendEmailVerification,
} from "firebase/auth";
import { useState } from "react";
import { router } from "expo-router";
import { doc, setDoc } from "firebase/firestore";
import { db } from "../../firebaseConfig";
import { SafeAreaView } from "react-native-safe-area-context";

export default function RegisterScreen() {
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [firstName, setFirstName] = useState<string>("");
  const [lastName, setLastName] = useState<string>("");

  const handleRegister = () => {
    createUserWithEmailAndPassword(getAuth(), email, password)
      .then(async (userCredential) => {
        const user = userCredential.user;
        if (user) {
          await setDoc(doc(db, "user", user.uid), {
            firstName: firstName,
            lastName: lastName,
            email: email,
          })
            .then(() => router.replace("../(tabs)"))
            .catch((err) => {
              alert(err?.message);
            });
          await sendEmailVerification(user);
          Alert.alert(
            "Email Verification Sent!",
            "Email verification will be required",
            [{ text: "OK" }]
          );
        }
      })
      .catch((err) => {
        alert(err?.message);
      });
  };

  return (
    <SafeAreaView>
      <Text>Purrfect Health</Text>
      <Text>New to the App? Register for a free account!</Text>
      <Text>First Name:</Text>
      <TextInput
        onChangeText={(text) => setFirstName(text)}
        placeholder="Alan"
        placeholderTextColor={"#D3D3D3"}
      />
      <Text>Last Name:</Text>
      <TextInput
        onChangeText={(text) => setLastName(text)}
        placeholder="Turing"
        placeholderTextColor={"#D3D3D3"}
      />
      <Text>Email:</Text>
      <TextInput
        placeholder="e.g. AlanTuring110@toromail.csudh.edu"
        keyboardType="email-address"
        onChangeText={(text) => setEmail(text)}
        placeholderTextColor={"#D3D3D3"}
      />
      <Text>Password</Text>
      <TextInput
        placeholder="Password"
        secureTextEntry
        onChangeText={(text) => setPassword(text)}
        placeholderTextColor={"#D3D3D3"}
      />
      <TouchableOpacity onPress={handleRegister}>
        <Text>Register</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}
