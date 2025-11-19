import { Tabs, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { Platform, Text } from "react-native";

import { getAuth } from "firebase/auth";

import { app } from "../../firebaseConfig";

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
      {/* <Tabs.Screen
        name="calendar"
        options={{
          headerTitleAlign: "center",
          title: "Calendar",
          headerTitle: "View Calendar",
        }}
      /> */}
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",

          headerTitleAlign: "center",
        }}
      />
      {/* <Tabs.Screen
        name="addPet"
        options={{
          headerTitleAlign: "center",
          title: "Add Pet",
        }}
      ></Tabs.Screen>

      <Tabs.Screen
        name="map"
        options={{
          headerTitleAlign: "center",
          title: "Find Care",
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile Settings",

          headerTitleAlign: "center",
        }}
      /> */}
    </Tabs>
  );
}
