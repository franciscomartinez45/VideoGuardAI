import * as Clipboard from "expo-clipboard";
import * as Linking from "expo-linking";
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
import { styles } from "./styles";

export default function Home() {
  const [url, setUrl] = useState("");
  const router = useRouter();

  useEffect(() => {
    Linking.getInitialURL().then((initialUrl) => {
      if (initialUrl) {
        handleIncomingUrl(initialUrl);
      }
    });

    const subscription = Linking.addEventListener("url", ({ url }) => {
      handleIncomingUrl(url);
    });

    return () => subscription.remove();
  }, []);

  const handleIncomingUrl = (incomingUrl: string) => {
    const params = Linking.parse(incomingUrl);
    if (params.queryParams?.url) {
      setUrl(params.queryParams.url as string);
    }
  };

  const isValidUrl = (urlString: string) => {
    const tiktokRegex = /tiktok\.com/i;
    const instagramRegex = /instagram\.com/i;
    return tiktokRegex.test(urlString) || instagramRegex.test(urlString);
  };

  const handleAnalyze = () => {
    if (!url.trim()) {
      Alert.alert("Error", "Please enter a URL");
      return;
    }

    if (!isValidUrl(url)) {
      Alert.alert("Error", "Please enter a valid TikTok or Instagram URL");
      return;
    }

    router.push({
      pathname: "/analyze",
      params: { url: url.trim() },
    });
  };

  const pasteFromClipboard = async () => {
    const text = await Clipboard.getStringAsync();
    if (text) {
      setUrl(text);
    }
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
              onPress={pasteFromClipboard}
            >
              <Text style={styles.pasteButtonText}>Paste</Text>
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
    </ScrollView>
  );
}
