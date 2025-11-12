import AsyncStorage from "@react-native-async-storage/async-storage";
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
import { styles } from "./styles";

interface AnalysisResult {
  url: string;
  isAI: boolean;
  confidence: number;
  timestamp: string;
  details: {
    visualArtifacts: number;
    audioAnomalies: number;
    motionPatterns: number;
    faceAnalysis: number;
  };
  explanation: string;
}

export default function Analyze() {
  const { url, cachedResult } = useLocalSearchParams<{
    url?: string;
    cachedResult?: string;
  }>();
  const [error, setErrorMessage] = useState("");
  
  const router = useRouter();
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<AnalysisResult | null>(null);

  useEffect(() => {
    if (cachedResult) {
      console.log("Loading from cached result...");
      setResult(JSON.parse(cachedResult));
      setLoading(false);
    } else if (url) {
      analyzeVideo();
    } else {
      setLoading(false);
      setResult(null);
    }
  }, [url]);
  const analyzeVideo = async () => {
    setLoading(true);

    const endpoint = `${process.env.EXPO_PUBLIC_SERVER}:${process.env.EXPO_PUBLIC_PORT}/analyze`;
    setErrorMessage("");
    try {
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
      await saveToHistory(finalResult);
    } catch (error: any) {
    
      setErrorMessage(error.message)
      setResult(null); 
    } finally {
      setLoading(false);
    }
  };
  const saveToHistory = async (analysisResult: AnalysisResult) => {
    try {
      const existingHistory = await AsyncStorage.getItem("analysis_history");
      const history = existingHistory ? JSON.parse(existingHistory) : [];
      history.unshift(analysisResult);
      await AsyncStorage.setItem(
        "analysis_history",
        JSON.stringify(history.slice(0, 50))
      );
    } catch (error) {
      console.error("Error saving to history:", error);
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

        <View style={styles.detailsCard}>
          <Text style={styles.sectionTitle}>Analysis Details</Text>

          <View style={styles.metricRow}>
            <Text style={styles.metricLabel}>Visual Artifacts</Text>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${result.details.visualArtifacts}%` },
                ]}
              />
            </View>
            <Text style={styles.metricValue}>
              {result.details.visualArtifacts}%
            </Text>
          </View>

          <View style={styles.metricRow}>
            <Text style={styles.metricLabel}>Audio Anomalies</Text>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${result.details.audioAnomalies}%` },
                ]}
              />
            </View>
            <Text style={styles.metricValue}>
              {result.details.audioAnomalies}%
            </Text>
          </View>

          <View style={styles.metricRow}>
            <Text style={styles.metricLabel}>Motion Patterns</Text>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${result.details.motionPatterns}%` },
                ]}
              />
            </View>
            <Text style={styles.metricValue}>
              {result.details.motionPatterns}%
            </Text>
          </View>

          <View style={styles.metricRow}>
            <Text style={styles.metricLabel}>Face Analysis</Text>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${result.details.faceAnalysis}%` },
                ]}
              />
            </View>
            <Text style={styles.metricValue}>
              {result.details.faceAnalysis}%
            </Text>
          </View>
        </View>

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
