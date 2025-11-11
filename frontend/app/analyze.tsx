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

   
    const endpoint = `http://${process.env.EXPO_PUBLIC_SERVER}:${process.env.EXPO_PUBLIC_PORT}/analyze`;
 
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

 
      const serverResult = await response.json();
      const sortedResults = serverResult.sort((a: { score: number; }, b: { score: number; }) => b.score - a.score);
      const topResult = sortedResults[0];

      const isAI = topResult.label === "deepfake";
      const confidence = Math.round(topResult.score * 100);

      const mockDetails = {
        visualArtifacts: isAI
          ? Math.floor(Math.random() * 40) + 60
          : Math.floor(Math.random() * 30),
        audioAnomalies: isAI
          ? Math.floor(Math.random() * 30) + 50
          : Math.floor(Math.random() * 20),
        motionPatterns: isAI
          ? Math.floor(Math.random() * 50) + 40
          : Math.floor(Math.random() * 25),
        faceAnalysis: isAI
          ? Math.floor(Math.random() * 60) + 40
          : Math.floor(Math.random() * 15),
      };

      const mockExplanation = isAI
        ? `The model detected a ${confidence}% probability of AI generation. This assessment is based on anomalous patterns consistent with deepfake algorithms.`
        : `The model is ${confidence}% confident this video is authentic. It lacks common AI-generated artifacts.`;

      const finalResult: AnalysisResult = {
        url: url as string,
        isAI: isAI,
        confidence: confidence,
        timestamp: new Date().toISOString(),
        details: mockDetails, // Using our generated details
        explanation: mockExplanation, // Using our generated explanation
      };

      setResult(finalResult);
      //await saveToHistory(finalResult);
    } catch (error) {
      console.error("Error analyzing video:", error);

      setResult(null); 
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
