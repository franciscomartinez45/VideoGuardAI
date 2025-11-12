import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, ScrollView, Text, TouchableOpacity, View } from "react-native";

import { styles } from "./styles";
interface HistoryItem {
  url: string;
  isAI: boolean;
  confidence: number;
  timestamp: string;
}

export default function History() {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const router = useRouter();

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      const historyData = await AsyncStorage.getItem("analysis_history");
      if (historyData) {
        setHistory(JSON.parse(historyData));
      }
    } catch (error) {
      console.error("Error loading history:", error);
    }
  };

  const clearHistory = () => {
    Alert.alert(
      "Clear History",
      "Are you sure you want to clear all analysis history?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: async () => {
            await AsyncStorage.removeItem("analysis_history");
            setHistory([]);
          },
        },
      ]
    );
  };

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString() + " " + date.toLocaleTimeString();
  };

  const truncateUrl = (url: string) => {
    return url.length > 40 ? url.substring(0, 40) + "..." : url;
  };

  return (
    <View style={styles.container}>
      {history.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No analysis history yet</Text>
          <TouchableOpacity
            style={styles.startButton}
            onPress={() => router.back()}
          >
            <Text style={styles.startButtonText}>Start Analyzing</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <ScrollView style={styles.list}>
            {history.map((item, index) => (
              <TouchableOpacity
                key={index}
                style={styles.historyItem}
                onPress={() =>
                  router.push({
                    pathname: "/analyze",

                    params: { cachedResult: JSON.stringify(item) },
                  })
                }
              >
                <View style={styles.historyHeader}>
                  <Text
                    style={[
                      styles.badge,
                      item.isAI ? styles.aiBadge : styles.authenticBadge,
                    ]}
                  >
                    {item.isAI ? "AI" : "Authentic"}
                  </Text>
                  <Text style={styles.confidence}>{item.confidence}%</Text>
                </View>
                <Text style={styles.url}>{truncateUrl(item.url)}</Text>
                <Text style={styles.timestamp}>
                  {formatDate(item.timestamp)}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <TouchableOpacity style={styles.clearButton} onPress={clearHistory}>
            <Text style={styles.clearButtonText}>Clear History</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}
