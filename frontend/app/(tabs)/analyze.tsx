import { useLocalSearchParams, useRouter, useNavigation } from "expo-router";
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
import { doc, getDoc, getFirestore } from "firebase/firestore";

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

export interface AnalysisResult {
  id?: string;
  url: string;
  isAI?: boolean;
  confidence?: number;
  timestamp?: string;
  visualArtifacts?: number;
  audioAnomalies?: number;
  motionPatterns?: number;
  faceAnalysis?: number;
  explanation?: string;
  llm_analysis?: LLMAnalysis;
  metadata?: AnalysisMetadata;
  report_id?: string;
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

  const getVerdictStyle = (verdict?: string) => {
    switch (verdict) {
      case "authentic":
        return styles.authentic;
      case "suspicious":
        return styles.suspicious;
      case "manipulated":
        return styles.aiDetected;
      default:
        return styles.authentic;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "high":
        return "#ef4444";
      case "medium":
        return "#f59e0b";
      case "low":
        return "#10b981";
      default:
        return "#6b7280";
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <View
          style={[
            styles.resultCard,
            result.llm_analysis
              ? getVerdictStyle(result.llm_analysis.authenticity_assessment.verdict)
              : result.isAI
              ? styles.aiDetected
              : styles.authentic,
          ]}
        >
          <Text style={styles.resultTitle}>
            {result.llm_analysis
              ? result.llm_analysis.authenticity_assessment.verdict.toUpperCase()
              : result.isAI
              ? "AI Generated"
              : "Authentic Content"}
          </Text>
          <Text style={styles.confidenceText}>
            Confidence: {result.confidence || 0}%
          </Text>
        </View>

        {result.llm_analysis && (
          <>
            <View style={styles.detailsCard}>
              <Text style={styles.sectionTitle}>Summary</Text>
              <Text style={styles.explanationText}>
                {result.llm_analysis.summary}
              </Text>
            </View>

            <View style={styles.detailsCard}>
              <Text style={styles.sectionTitle}>Reasoning</Text>
              <Text style={styles.explanationText}>
                {result.llm_analysis.authenticity_assessment.reasoning}
              </Text>
            </View>

            {result.llm_analysis.detailed_insights &&
              result.llm_analysis.detailed_insights.length > 0 && (
                <View style={styles.detailsCard}>
                  <Text style={styles.sectionTitle}>Detailed Insights</Text>
                  {result.llm_analysis.detailed_insights.map((insight, index) => (
                    <View key={index} style={{ marginBottom: 8 }}>
                      <Text style={styles.explanationText}>• {insight}</Text>
                    </View>
                  ))}
                </View>
              )}

            {result.llm_analysis.risk_factors &&
              result.llm_analysis.risk_factors.length > 0 && (
                <View style={styles.detailsCard}>
                  <Text style={styles.sectionTitle}>Risk Factors</Text>
                  {result.llm_analysis.risk_factors.map((risk, index) => (
                    <View
                      key={index}
                      style={{
                        marginBottom: 12,
                        padding: 12,
                        backgroundColor: "#f9fafb",
                        borderRadius: 8,
                        borderLeftWidth: 4,
                        borderLeftColor: getSeverityColor(risk.severity),
                      }}
                    >
                      <View
                        style={{
                          flexDirection: "row",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginBottom: 4,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 12,
                            fontWeight: "600",
                            color: getSeverityColor(risk.severity),
                            textTransform: "uppercase",
                          }}
                        >
                          {risk.severity} SEVERITY
                        </Text>
                      </View>
                      <Text
                        style={{
                          fontSize: 14,
                          fontWeight: "600",
                          color: "#111827",
                          marginBottom: 4,
                        }}
                      >
                        {risk.factor}
                      </Text>
                      <Text style={{ fontSize: 13, color: "#6b7280" }}>
                        {risk.impact}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
          </>
        )}

        {result.isAI && !result.llm_analysis && (
          <>
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
                <Text style={styles.metricValue}>
                  {result.visualArtifacts}%
                </Text>
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
          </>
        )}

        {result.explanation && !result.llm_analysis && (
          <View style={styles.explanationCard}>
            <Text style={styles.sectionTitle}>Explanation</Text>
            <Text style={styles.explanationText}>{result.explanation}</Text>
          </View>
        )}

        {result.metadata && (
          <View style={styles.detailsCard}>
            <Text style={styles.sectionTitle}>Analysis Metadata</Text>
            <Text style={styles.explanationText}>
              Model: {result.metadata.model_used}
            </Text>
            <Text style={styles.explanationText}>
              Processing Time: {result.metadata.processing_time_ms}ms
            </Text>
            <Text style={styles.explanationText}>
              Timestamp: {new Date(result.metadata.analysis_timestamp).toLocaleString()}
            </Text>
          </View>
        )}

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
