import {
  useLocalSearchParams,
  useRouter,
  useNavigation,
  Stack,
} from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { styles } from "../styles";
import { getAuth } from "firebase/auth";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getFirestore,
} from "firebase/firestore";
import { Ionicons } from "@expo/vector-icons";

export interface AnalysisResult {
  id: string;
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

export default function analyze() {
  const { url, cachedResult } = useLocalSearchParams<{
    url?: string;
    cachedResult?: string;
  }>();
  const [error, setErrorMessage] = useState("");
  const { currentUser } = getAuth();
  const router = useRouter();
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const db = getFirestore();

  const fetchSavedInfo = async (id: string) => {
    if (currentUser?.uid) {
      try {
        const searchItemRef = doc(db, "user", currentUser?.uid, "search", id);
        const docSnap = await getDoc(searchItemRef);
        if (docSnap.exists()) {
          const data = docSnap.data() as AnalysisResult;
          setResult(data);
          console.log("Analysis extracted from DB...");
        }
      } catch (error) {
        console.error("Error fetching search item:", error);
        setResult(null);
      }
    }
  };

  useEffect(() => {
    if (cachedResult) {
      console.log("Loading from cached result...");
      fetchSavedInfo(cachedResult);
      setLoading(false);
    } else if (url) {
      analyzeVideo();
      const unsubscribe = navigation.addListener("beforeRemove", (e) => {
        if (loading) {
          e.preventDefault();
          alert(
            "Please wait for the data to finish loading before going back."
          );
        }
        return unsubscribe;
      });
    } else {
      setLoading(false);
      setResult(null);
    }
  }, [url, navigation, cachedResult]);

  const analyzeVideo = async () => {
    setLoading(true);
    const endpoint = `${process.env.EXPO_PUBLIC_SERVER}`;
    setErrorMessage("");
    try {
      console.log("Sending to Backend");
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: url as string,
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

      const finalResult: AnalysisResult = await response.json();
      setResult(finalResult);

      //await saveToDB(finalResult);
    } catch (error: any) {
      setErrorMessage(error.message);
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const saveToDB = async (analysisResult: AnalysisResult) => {
    if (currentUser) {
      try {
        const userRef = doc(db, "user", currentUser.uid);
        const searchRef = collection(userRef, "search");
        const docRef = await addDoc(searchRef, analysisResult);
        Alert.alert("Success!", "Analysis complete!", [
          { text: "OK", style: "cancel" },
        ]);
      } catch (error) {
        console.error("Error saving to history:", error);
      }
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Stack.Screen
          options={{
            title: "Analyzing...",
            headerBackVisible: false,
            headerBackButtonMenuEnabled: false,
            gestureEnabled: false,
          }}
        />
        <ActivityIndicator size="large" color="#6366f1" />
        <Text style={styles.loadingText}>Analyzing video...</Text>
        <Text style={styles.loadingSubtext}>
          Processing visual patterns, audio signatures, and motion data
        </Text>
      </View>
    );
  }

  if (!result) {
    return (
      <View style={styles.errorContainer}>
        <Stack.Screen
          options={{
            title: "Error",
            headerBackVisible: true,
            gestureEnabled: true,
          }}
        />
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }
  if (!cachedResult && !url) {
    return (
      <View style={styles.container}>
        <Stack.Screen
          options={{
            title: "Analysis",
            headerBackVisible: true,
            headerStyle: { backgroundColor: "#f9fafb" },
            headerShadowVisible: false,
          }}
        />
        <View style={styles.emptyContainer}>
          <View style={styles.iconCircle}>
            <Ionicons name="analytics-outline" size={48} color="#6366f1" />
          </View>
          <Text style={styles.emptyTitle}>No Analysis Found</Text>
          <Text style={styles.emptySubtitle}>
            Upload or paste a video URL to see AI detection results here.
          </Text>

          <TouchableOpacity
            style={styles.startButton}
            onPress={() => router.back()}
          >
            <Text style={styles.startButtonText}>Start New Analysis</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Stack.Screen
        options={{
          title: "Analysis Result",
          headerBackVisible: true,
          headerBackButtonMenuEnabled: true,
        }}
      />
      <View style={styles.content}>
        <View
          style={[
            styles.resultCard,
            result.isAI ? styles.aiDetected : styles.authentic,
          ]}
        >
          <Text style={styles.resultTitle}>
            {result.isAI ? " AI Generated" : " Likely Authentic"}
          </Text>
          <Text style={styles.confidenceText}>
            Confidence: {result.confidence}%
          </Text>
        </View>
        {result.isAI && (
          <View style={styles.detailsCard}>
            <Text style={styles.sectionTitle}>Analysis Details</Text>

            <View style={styles.metricRow}>
              <Text style={styles.metricLabel}>Visual Artifacts</Text>
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${result.visualArtifacts}%` },
                  ]}
                />
              </View>
              <Text style={styles.metricValue}>{result.visualArtifacts}%</Text>
            </View>

            <View style={styles.metricRow}>
              <Text style={styles.metricLabel}>Motion Patterns</Text>
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${result.motionPatterns}%` },
                  ]}
                />
              </View>
              <Text style={styles.metricValue}>{result.motionPatterns}%</Text>
            </View>

            <View style={styles.metricRow}>
              <Text style={styles.metricLabel}>Face Analysis</Text>
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${result.faceAnalysis}%` },
                  ]}
                />
              </View>
              <Text style={styles.metricValue}>{result.faceAnalysis}%</Text>
            </View>
          </View>
        )}
        <View style={styles.explanationCard}>
          <Text style={styles.sectionTitle}>Explanation</Text>
          <Text style={styles.explanationText}>{result.explanation}</Text>
        </View>

        <TouchableOpacity
          style={styles.newAnalysisButton}
          onPress={() => router.back()}
        >
          <Text style={styles.newAnalysisButtonText}>
            Analyze Another Video
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
