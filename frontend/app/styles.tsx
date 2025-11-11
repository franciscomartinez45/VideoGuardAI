import { StyleSheet } from "react-native";

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f9fafb",
  },
  content: {
    padding: 20,
  },
  header: {
    marginBottom: 30,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#111827",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#6b7280",
  },
  inputSection: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: "row",
    gap: 10,
  },
  input: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  pasteButton: {
    backgroundColor: "#6366f1",
    borderRadius: 12,
    paddingHorizontal: 20,
    justifyContent: "center",
  },
  pasteButtonText: {
    color: "#fff",
    fontWeight: "600",
  },
  analyzeButton: {
    backgroundColor: "#6366f1",
    borderRadius: 12,
    padding: 18,
    alignItems: "center",
    marginBottom: 12,
  },
  analyzeButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
  },
  historyButton: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 18,
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#6366f1",
    marginBottom: 30,
  },
  historyButtonText: {
    color: "#6366f1",
    fontSize: 18,
    fontWeight: "600",
  },
  infoSection: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 12,
  },
  infoText: {
    fontSize: 15,
    color: "#6b7280",
    lineHeight: 24,
  },
  supportedPlatforms: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 20,
  },
  platformsTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 12,
  },
  platformTags: {
    flexDirection: "row",
    gap: 10,
  },
  tag: {
    backgroundColor: "#6366f1",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  tagText: {
    color: "#fff",
    fontWeight: "600",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  loadingText: {
    fontSize: 20,
    fontWeight: "600",
    color: "#111827",
    marginTop: 20,
  },
  loadingSubtext: {
    fontSize: 14,
    color: "#6b7280",
    marginTop: 8,
    textAlign: "center",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  errorText: {
    fontSize: 18,
    color: "#ef4444",
  },
  resultCard: {
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    marginBottom: 20,
  },
  aiDetected: {
    backgroundColor: "#fef2f2",
    borderWidth: 2,
    borderColor: "#ef4444",
  },
  authentic: {
    backgroundColor: "#f0fdf4",
    borderWidth: 2,
    borderColor: "#22c55e",
  },
  resultTitle: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 8,
  },
  confidenceText: {
    fontSize: 18,
    color: "#6b7280",
  },
  detailsCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 16,
  },
  metricRow: {
    marginBottom: 16,
  },
  metricLabel: {
    fontSize: 14,
    color: "#6b7280",
    marginBottom: 6,
  },
  progressBar: {
    height: 8,
    backgroundColor: "#e5e7eb",
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: 4,
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#6366f1",
  },
  metricValue: {
    fontSize: 12,
    color: "#9ca3af",
    textAlign: "right",
  },
  explanationCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  explanationText: {
    fontSize: 15,
    color: "#374151",
    lineHeight: 24,
  },
  newAnalysisButton: {
    backgroundColor: "#6366f1",
    borderRadius: 12,
    padding: 18,
    alignItems: "center",
  },
  newAnalysisButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  emptyText: {
    fontSize: 18,
    color: "#6b7280",
    marginBottom: 20,
  },
  startButton: {
    backgroundColor: "#6366f1",
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  startButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  list: {
    flex: 1,
  },
  historyItem: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 12,
  },
  historyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 6,
    fontSize: 12,
    fontWeight: "600",
  },
  aiBadge: {
    backgroundColor: "#fef2f2",
    color: "#ef4444",
  },
  authenticBadge: {
    backgroundColor: "#f0fdf4",
    color: "#22c55e",
  },
  confidence: {
    fontSize: 16,
    fontWeight: "600",
    color: "#6b7280",
  },
  url: {
    fontSize: 14,
    color: "#374151",
    marginBottom: 4,
  },
  timestamp: {
    fontSize: 12,
    color: "#9ca3af",
  },
  clearButton: {
    margin: 20,
    backgroundColor: "#ef4444",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
  },
  clearButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
