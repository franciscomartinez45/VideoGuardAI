import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
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
  const { url } = useLocalSearchParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<AnalysisResult | null>(null);

  useEffect(() => {
    analyzeVideo();
  }, [url]);

  const analyzeVideo = async () => {
    setLoading(true);

    const endpoint = `${process.env.EXPO_PUBLIC_SERVER}:${process.env.EXPO_PUBLIC_PORT}/analyze`;

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
        throw new Error(`Server error: ${response.status}`);
      }


      const finalResult: AnalysisResult = await response.json();
      
      setResult(finalResult);
      //await saveToHistory(finalResult);

    } catch (error) {
      console.error("Error analyzing video:", error);
      setResult(null); // Show an error screen
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
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
        <Text style={styles.errorText}>Error analyzing video</Text>
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
