import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { styles, colors } from "../styles";

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getFirestore,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";
import { getAuth, signOut } from "firebase/auth";

interface HistoryItem extends AnalysisResult {
  id: string;
}

interface RiskFactor {
  factor: string;
  impact: string;
  severity: string;
}

interface AuthenticityAssessment {
  confidence_score: number;
  reasoning: string;
  verdict: string;
}

interface LLMAnalysis {
  authenticity_assessment: AuthenticityAssessment;
  detailed_insights: string[];
  risk_factors: RiskFactor[];
  summary: string;
}

interface AnalysisMetadata {
  analysis_timestamp: string;
  model_used: string;
  processing_time_ms: number;
}

interface AnalysisResult {
  url: string;
  llm_analysis?: LLMAnalysis;
  metadata?: AnalysisMetadata;
  report_id?: string;
  timestamp?: string;
  isAI?: boolean;
  confidence?: number;
}

export default function Home() {
  const [url, setUrl] = useState("");
  const [loading, setIsLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(
    null
  );
  const [analysisResultId, setAnalysisResultId] = useState<string | null>(null);
  const [analysisError, setAnalysisError] = useState("");
  const [showDeleteToast, setShowDeleteToast] = useState(false);
  const [recentlyAddedId, setRecentlyAddedId] = useState<string | null>(null);
  const router = useRouter();
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const db = getFirestore();
  const { currentUser } = getAuth();
  if (!currentUser) {
    console.log("no LOGIN");
  }

  useEffect(() => {
    setIsLoading(true);
    try {
      if (currentUser) {
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
      }
    } catch (e) {
      console.error("Error setting up history fetch:", e);
      setIsLoading(false);
    }
  }, [currentUser]);

  const saveToDB = async (analysisResult: AnalysisResult) => {
    if (currentUser) {
      try {
        // Remove undefined values as Firestore doesn't handle them well
        const cleanedResult = JSON.parse(JSON.stringify(analysisResult));

        const userRef = doc(db, "user", currentUser.uid);
        const searchRef = collection(userRef, "search");
        const docRef = await addDoc(searchRef, cleanedResult);
        console.log("Successfully saved to DB with ID:", docRef.id);
        return docRef.id;
      } catch (error) {
        console.error("Error saving to history:", error);
        console.error("Failed to save data:", analysisResult);
        return null;
      }
    }
    return null;
  };

  const fetchSavedInfo = async (id: string) => {
    if (currentUser?.uid) {
      try {
        const searchItemRef = doc(db, "user", currentUser?.uid, "search", id);
        const docSnap = await getDoc(searchItemRef);
        if (docSnap.exists()) {
          const data = docSnap.data() as AnalysisResult;
          setAnalysisResult(data);
          setAnalysisResultId(id);
          console.log("Analysis extracted from DB...");
        }
      } catch (error) {
        console.error("Error fetching search item:", error);
        setAnalysisResult(null);
        setAnalysisResultId(null);
      }
    }
  };

  const analyzeVideo = async (urlToAnalyze: string) => {
    setAnalyzing(true);
    setAnalysisError("");
    setAnalysisResult(null);
    const analyzeEndpoint = `${process.env.EXPO_PUBLIC_ANALYZE_ENDPOINT}`;
    const reportEndpoint = `${process.env.EXPO_PUBLIC_REPORT_ENDPOINT}`;

    try {
      console.log("Sending to Backend - Step 1: Initial analysis");
      const response = await fetch(analyzeEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: urlToAnalyze,
        }),
      });

      if (!response.ok) {
        let errorMsg = "An unknown server error occurred.";
        try {
          const errorData = await response.json();
          if (errorData.error) {
            errorMsg = errorData.error;
          }
        } catch (e) {
          errorMsg = `Server error: ${response.status}`;
        }
        throw new Error(errorMsg);
      }

      const initialResult = await response.json();
      const reportId = initialResult.report_id || initialResult.id;

      if (!reportId) {
        throw new Error("No report ID received from backend");
      }

      console.log("Step 2: Fetching LLM analysis report with ID:", reportId);
      const reportResponse = await fetch(reportEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          report_id: reportId,
        }),
      });

      if (!reportResponse.ok) {
        let errorMsg = "Failed to fetch analysis report.";
        try {
          const errorData = await reportResponse.json();
          if (errorData.error) {
            errorMsg = errorData.error;
          }
        } catch (e) {
          errorMsg = `Report error: ${reportResponse.status}`;
        }
        throw new Error(errorMsg);
      }

      const reportData = await reportResponse.json();

      console.log("Received report data:", reportData);

      const finalResult: AnalysisResult = {
        url: urlToAnalyze,
        timestamp:
          reportData.metadata?.analysis_timestamp || new Date().toISOString(),
        isAI:
          reportData.llm_analysis?.authenticity_assessment?.verdict !==
          "authentic",
        confidence: Math.round(
          (reportData.llm_analysis?.authenticity_assessment?.confidence_score ||
            0) * 100
        ),
      };

      // Only add these fields if they exist to avoid undefined values
      if (reportData.report_id || reportId) {
        finalResult.report_id = reportData.report_id || reportId;
      }
      if (reportData.llm_analysis) {
        finalResult.llm_analysis = reportData.llm_analysis;
      }
      if (reportData.metadata) {
        finalResult.metadata = reportData.metadata;
      }

      console.log("Final result to save:", finalResult);

      setAnalysisResult(finalResult);
      const docId = await saveToDB(finalResult);
      setAnalysisResultId(docId);

      if (docId) {
        setRecentlyAddedId(docId);
        setTimeout(() => setRecentlyAddedId(null), 5000);
      }
    } catch (error: any) {
      setAnalysisError(error.message);
      setAnalysisResult(null);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleAnalyze = async () => {
    if (!currentUser) {
      router.push({
        pathname: "/(login)/login",
      });
      return;
    }
    if (!url.trim()) {
      if (Platform.OS === "web") {
        alert("Please enter a URL");
      } else {
        Alert.alert("Error", "Please enter a URL");
      }
      return;
    }

    if (!isValidUrl(url)) {
      if (Platform.OS === "web") {
        alert("Please enter a valid TikTok or Instagram URL");
      } else {
        Alert.alert("Error", "Please enter a valid TikTok or Instagram URL");
      }
      return;
    }

    const data = inHistory(url);
    if (data) {
      console.log("Found in history...");
      await fetchSavedInfo(data);
    } else {
      console.log("Fetching...");
      await analyzeVideo(url);
    }
    setUrl("");
  };
  const isValidUrl = (urlString: string) => {
    const tiktokRegex = /tiktok\.com/i;
    const instagramRegex = /instagram\.com/i;
    return tiktokRegex.test(urlString) || instagramRegex.test(urlString);
  };
  const inHistory = (url: string) => {
    const matchingItem = history.find((item) => item.url === url);
    return matchingItem?.id;
  };

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString() + " " + date.toLocaleTimeString();
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const formatDateHeader = (timestamp: string) => {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return "Today";
    } else if (date.toDateString() === yesterday.toDateString()) {
      return "Yesterday";
    } else {
      return date.toLocaleDateString([], {
        weekday: "long",
        month: "long",
        day: "numeric",
      });
    }
  };

  const groupHistoryByDate = () => {
    const grouped: { [key: string]: HistoryItem[] } = {};

    history.forEach((item) => {
      const dateKey = new Date(item.timestamp).toDateString();
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(item);
    });

    return grouped;
  };

  const handleLogout = async () => {
    if (Platform.OS === "web") {
      const confirmed = window.confirm("Are you sure you want to log out?");
      if (!confirmed) return;
    } else {
      Alert.alert("Log Out", "Are you sure you want to log out?", [
        { text: "Cancel", style: "cancel" },
        { text: "Log Out", style: "destructive", onPress: performLogout },
      ]);
      return;
    }
    await performLogout();
  };

  const performLogout = async () => {
    try {
      const auth = getAuth();
      await signOut(auth);
      router.replace("/(login)/login");
    } catch (error: any) {
      if (Platform.OS === "web") {
        alert("Error logging out: " + error.message);
      } else {
        Alert.alert("Error", "Failed to log out: " + error.message);
      }
    }
  };

  const deleteHistoryItem = async (itemId: string) => {
    if (!currentUser) return;

    const performDelete = async () => {
      setHistory((prevHistory) =>
        prevHistory.filter((item) => item.id !== itemId)
      );

      try {
        const searchItemRef = doc(
          db,
          "user",
          currentUser.uid,
          "search",
          itemId
        );
        await deleteDoc(searchItemRef);
        console.log("Analysis deleted successfully");

        setShowDeleteToast(true);
        setTimeout(() => setShowDeleteToast(false), 3000);
      } catch (error) {
        console.error("Error deleting analysis:", error);
        if (Platform.OS === "web") {
          alert("Failed to delete analysis");
        } else {
          Alert.alert("Error", "Failed to delete analysis");
        }
      }
    };

    if (Platform.OS === "web") {
      const confirmed = window.confirm(
        "Are you sure you want to delete this analysis from your history?"
      );
      if (confirmed) {
        await performDelete();
      }
    } else {
      Alert.alert(
        "Delete Analysis",
        "Are you sure you want to delete this analysis from your history?",
        [
          {
            text: "Cancel",
            style: "cancel",
          },
          {
            text: "Delete",
            style: "destructive",
            onPress: performDelete,
          },
        ]
      );
    }
  };

  return (
    <ScrollView style={styles.container}>
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Ionicons name="log-out-outline" size={24} color={colors.danger} />
      </TouchableOpacity>

      <View style={styles.content}>
        <View style={styles.heroSection}>
          <Text style={styles.heroTitle}>Video Guard AI</Text>
          <Text style={styles.heroSubtitle}>
            Detect AI-generated content in videos
          </Text>
        </View>

        <View style={styles.mainInputCard}>
          <TextInput
            style={styles.mainInput}
            placeholder="Paste TikTok or Instagram video URL..."
            placeholderTextColor={colors.textTertiary}
            value={url}
            onChangeText={setUrl}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            multiline={false}
          />
          <View style={styles.platformTagsInline}>
            <View style={styles.tagSmall}>
              <Text style={styles.tagSmallText}>TikTok</Text>
            </View>
            <View style={styles.tagSmall}>
              <Text style={styles.tagSmallText}>Instagram</Text>
            </View>
          </View>
        </View>

        <TouchableOpacity
          style={[
            styles.analyzeButton,
            analyzing && styles.analyzeButtonDisabled,
          ]}
          onPress={handleAnalyze}
          disabled={analyzing}
        >
          <Text style={styles.analyzeButtonText}>
            {analyzing ? "Analyzing..." : "Analyze Video"}
          </Text>
        </TouchableOpacity>
        {analyzing && (
          <View style={styles.analysisSection}>
            <Text style={styles.analysisSectionTitle}>Current Analysis</Text>
            <View style={styles.loadingCard}>
              <ActivityIndicator size="large" color="#6366f1" />
              <Text style={styles.loadingText}>Analyzing video...</Text>
            </View>
          </View>
        )}
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
              {Object.entries(groupHistoryByDate()).map(([dateKey, items]) => (
                <View key={dateKey}>
                  <View style={styles.dateHeader}>
                    <Text style={styles.dateHeaderText}>
                      {formatDateHeader(items[0].timestamp)}
                    </Text>
                  </View>
                  {items.map((item) => (
                    <View
                      key={item.id}
                      style={[
                        styles.historyItem,
                        item.id === recentlyAddedId && styles.historyItemNew,
                      ]}
                    >
                      <TouchableOpacity
                        style={styles.historyItemContent}
                        onPress={() =>
                          router.push({
                            pathname: "/analyze",
                            params: { cachedResult: item.id },
                          })
                        }
                      >
                        <View style={styles.historyHeader}>
                          <Text style={styles.historyTime}>
                            {formatTime(item.timestamp)}
                          </Text>
                          <View style={styles.historyBadgeContainer}>
                            <Text
                              style={[
                                styles.badge,
                                item.isAI
                                  ? styles.aiBadge
                                  : styles.authenticBadge,
                              ]}
                            >
                              {item.isAI ? "AI" : "Authentic"}
                            </Text>
                            <Text style={styles.confidence}>
                              {item.confidence}%
                            </Text>
                          </View>
                        </View>
                        <Text style={styles.urlSecondary} numberOfLines={1}>
                          {item.url}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.deleteIconButton}
                        onPress={() => deleteHistoryItem(item.id)}
                      >
                        <Ionicons
                          name="trash-outline"
                          size={20}
                          color={colors.danger}
                        />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              ))}
            </ScrollView>
          </>
        )}
      </View>
      {showDeleteToast && (
        <View style={styles.toast}>
          <Text style={styles.toastText}>Analysis deleted</Text>
        </View>
      )}
    </ScrollView>
  );
}
