import { Tabs, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { Alert, Platform, Text, TouchableOpacity } from "react-native";

import { getAuth, signOut } from "firebase/auth";

import { app } from "../../firebaseConfig";
import { Ionicons } from "@expo/vector-icons";

export default function TabLayout() {
  const [isMounted, setIsMounted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    const unsubscribe = getAuth(app).onAuthStateChanged((user) => {
      setIsLoading(false);
      if (isMounted && !user) {
        router.replace("/(login)/login");
      }
    });

    return unsubscribe;
  }, [isMounted]);
  const handleLogout = async () => {
    try {
      const auth = getAuth();
      await signOut(auth);
      if (Platform.OS === "macos") {
        alert("Succesfully logged out");
      }
      Alert.alert("Login out", "Succesfully Logged out of VIDEO-GUARD-AI");
      router.replace("/");
    } catch (error: any) {
      Alert.alert("Error logging out", error.message);
    }
  };
  const LogoutButton = () => (
    <TouchableOpacity onPress={handleLogout} style={{ marginRight: 15 }}>
      <Ionicons name="log-out-outline" size={24} color="#ef4444" />
    </TouchableOpacity>
  );

  if (isLoading) return <Text style={{ paddingTop: 30 }}>Loading...</Text>;

  return (
    <Tabs
      initialRouteName="index"
      screenOptions={{
        headerTitleStyle: { fontSize: 25, fontWeight: "200" },
        headerShown: true,

        tabBarStyle: Platform.select({
          ios: {
            position: "absolute",
          },
          default: {},
        }),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          headerRight: () => <LogoutButton />,
          tabBarActiveTintColor: "#6366f1",
          headerTitleAlign: "center",
          href: null,
        }}
      />
      <Tabs.Screen
        name="analyze"
        options={{
          title: "Analysis",
          headerTitleAlign: "center",
          href: null,
        }}
      />
    </Tabs>
  );
}
