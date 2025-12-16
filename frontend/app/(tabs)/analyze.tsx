import {
  useLocalSearchParams,
  useRouter,
  useNavigation,
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
  doc,
  getDoc,
  getFirestore,
} from "firebase/firestore";

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

export default function AnalyzePage() {
  const { cachedResult } = useLocalSearchParams<{
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
        setErrorMessage("Failed to load analysis");
      }
    }
  };

  useEffect(() => {
    if (cachedResult) {
      console.log("Loading from cached result...");
      fetchSavedInfo(cachedResult);
      setLoading(false);
    } else {
      setLoading(false);
      setResult(null);
    }
  }, [cachedResult, navigation]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366f1" />
        <Text style={styles.loadingText}>Loading analysis...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity
          style={styles.newAnalysisButton}
          onPress={() => router.back()}
        >
          <Text style={styles.newAnalysisButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!result) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>No analysis found</Text>
        <TouchableOpacity
          style={styles.newAnalysisButton}
          onPress={() => router.back()}
        >
          <Text style={styles.newAnalysisButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <View
          style={[
            styles.resultCard,
            result.isAI ? styles.aiDetected : styles.authentic,
          ]}
        >
          <Text style={styles.resultTitle}>
            {result.isAI ? "AI Generated" : "Authentic Content"}
          </Text>
          <Text style={styles.confidenceText}>
            Confidence: {result.confidence}%
          </Text>
        </View>

        <View style={styles.detailsCard}>
          <Text style={styles.sectionTitle}>Analysis Metrics</Text>

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
            <Text style={styles.metricLabel}>Audio Anomalies</Text>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${result.audioAnomalies}%` },
                ]}
              />
            </View>
            <Text style={styles.metricValue}>{result.audioAnomalies}%</Text>
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

        <View style={styles.explanationCard}>
          <Text style={styles.sectionTitle}>Explanation</Text>
          <Text style={styles.explanationText}>{result.explanation}</Text>
        </View>

        <View style={styles.detailsCard}>
          <Text style={styles.sectionTitle}>Video URL</Text>
          <Text style={styles.url}>{result.url}</Text>
        </View>

        <TouchableOpacity
          style={styles.newAnalysisButton}
          onPress={() => router.back()}
        >
          <Text style={styles.newAnalysisButtonText}>Back to Home</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
