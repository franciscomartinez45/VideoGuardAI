import { Stack } from "expo-router";
import { useEffect } from "react";
import * as Linking from "expo-linking";

export default function RootLayout() {
  useEffect(() => {
    const subscription = Linking.addEventListener("url", ({ url }) => {
      console.log("Received URL:", url);
    });

    return () => subscription.remove();
  }, []);

  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{
          title: "AI Video Analyzer",
          headerStyle: { backgroundColor: "#6366f1" },
          headerTintColor: "#fff",
        }}
      />
      <Stack.Screen
        name="analyze"
        options={{
          title: "Analysis",
          headerStyle: { backgroundColor: "#6366f1" },
          headerTintColor: "#fff",
        }}
      />
      <Stack.Screen
        name="history"
        options={{
          title: "History",
          headerStyle: { backgroundColor: "#6366f1" },
          headerTintColor: "#fff",
        }}
      />
    </Stack>
  );
}
