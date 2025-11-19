import { Tabs } from "expo-router";

import { Platform } from "react-native";

import React from "react";
import { createStackNavigator } from "@react-navigation/stack";

export default function LogInLayout() {
  const Stack = createStackNavigator();
  return (
    <Tabs
      initialRouteName="login"
      screenOptions={{
        tabBarActiveTintColor: "black",
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
        name="register"
        options={{
          headerTitleAlign: "center",
          title: "Register",
        }}
      />

      <Tabs.Screen
        name="login"
        options={{
          headerTitleAlign: "center",
          title: "Log In",
        }}
      />
    </Tabs>
  );
}
