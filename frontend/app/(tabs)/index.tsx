import * as Clipboard from "expo-clipboard";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  Alert,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { styles } from "../styles";

import {
  collection,
  doc,
  getFirestore,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";
import { getAuth } from "firebase/auth";

interface HistoryItem extends AnalysisResult {
  id: string;
}
interface AnalysisResult {
  url: string;
  isAI: boolean;
  confidence: number;
  timestamp: string;
  visualArtifacts: number;
  audioAnomalies: number;
  motionPatterns: number;
  faceAnalysis: number;
  explanation: string;
}

export default function Home() {
  const [url, setUrl] = useState("");
  const [loading, setIsLoading] = useState(true);
  const router = useRouter();
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const db = getFirestore();
  const { currentUser } = getAuth();

  useEffect(() => {
    if (!currentUser) {
      setHistory([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const userRef = doc(db, "user", currentUser.uid);
      const searchCollectionRef = collection(userRef, "search");
      const historyQuery = query(
        searchCollectionRef,
        orderBy("timestamp", "desc")
      );
      const unsubscribe = onSnapshot(
        historyQuery,
        (snapshot) => {
          const historyData: HistoryItem[] = [];
          snapshot.forEach((doc) => {
            historyData.push({
              ...(doc.data() as HistoryItem),
              id: doc.id,
            });
          });
          setHistory(historyData);
          setIsLoading(false);
        },
        (error) => {
          console.error("Error setting up history listener:", error);
          setIsLoading(false);
        }
      );
      return () => {
        unsubscribe();
        console.log("Firestore listener unsubscribed.");
      };
    } catch (e) {
      console.error("Error setting up history fetch:", e);
      setIsLoading(false);
    }
  }, [currentUser]);

  const isValidUrl = (urlString: string) => {
    const tiktokRegex = /tiktok\.com/i;
    const instagramRegex = /instagram\.com/i;
    return tiktokRegex.test(urlString) || instagramRegex.test(urlString);
  };
  const inHistory = (url: string) => {
    const matchingItem = history.find((item) => item.url === url);
    return matchingItem?.id;
  };
  const handleAnalyze = async () => {
    if (!url.trim()) {
      Alert.alert("Error", "Please enter a URL");
      return;
    }
    if (!isValidUrl(url)) {
      Alert.alert("Error", "Please enter a valid TikTok or Instagram URL");
      return;
    }
    const data = inHistory(url);
    if (data) {
      console.log("Found in history...");
      router.push({
        pathname: "/analyze",
        params: { cachedResult: data },
      });
    } else {
      console.log("Fetching...");
      router.push({
        pathname: "/analyze",
        params: { url: url },
      });
    }
    setTimeout(() => {
      setIsLoading(false);
      setUrl("");
    }, 1000);
  };

  const pasteFromClipboard = async () => {
    const text = await Clipboard.getStringAsync();
    if (text) {
      setUrl(text);
    }
  };
  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString() + " " + date.toLocaleTimeString();
  };
  const clearHistory = () => {
    Alert.alert(
      "Clear History",
      "Are you sure you want to clear all analysis history?"
    );
  };

  const truncateUrl = (url: string) => {
    return url.length > 40 ? url.substring(0, 40) + "..." : url;
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>AI Video Analyzer</Text>
          <Text style={styles.subtitle}>
            Detect AI-generated content in TikTok and Instagram videos
          </Text>
        </View>

        <View style={styles.inputSection}>
          <Text style={styles.label}>Video URL</Text>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="https://tiktok.com/..."
              value={url}
              onChangeText={setUrl}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
            <TouchableOpacity
              style={styles.pasteButton}
              //onPress={pasteFromClipboard}
              onPress={pasteFromClipboard}
            >
              <Text style={styles.pasteButtonText}>Clear Cache</Text>
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity style={styles.analyzeButton} onPress={handleAnalyze}>
          <Text style={styles.analyzeButtonText}>Analyze Video</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.historyButton}
          onPress={() => router.push("/history")}
        >
          <Text style={styles.historyButtonText}>View History</Text>
        </TouchableOpacity>

        <View style={styles.infoSection}>
          <Text style={styles.infoTitle}>How it works:</Text>
          <Text style={styles.infoText}>
            1. Copy a TikTok or Instagram video link{"\n"}
            2. Paste it above or share it directly to this app{"\n"}
            3. Our AI will analyze the video for synthetic content{"\n"}
            4. Get detailed results on AI detection
          </Text>
        </View>

        <View style={styles.supportedPlatforms}>
          <Text style={styles.platformsTitle}>Supported Platforms:</Text>
          <View style={styles.platformTags}>
            <View style={styles.tag}>
              <Text style={styles.tagText}>TikTok</Text>
            </View>
            <View style={styles.tag}>
              <Text style={styles.tagText}>Instagram</Text>
            </View>
          </View>
        </View>
      </View>
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
                      params: { cachedResult: item.id },
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
    </ScrollView>
  );
}
