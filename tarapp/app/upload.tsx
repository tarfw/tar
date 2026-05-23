import React, { useState } from "react";
import { 
  StyleSheet, 
  View, 
  Text, 
  TouchableOpacity, 
  Image, 
  ActivityIndicator, 
  Switch,
  ScrollView,
  Alert,
  Platform
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import { uploadFileToS3 } from "../lib/s3";

export default function UploadScreen() {
  const router = useRouter();
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isPublic, setIsPublic] = useState<boolean>(true);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploadedKey, setUploadedKey] = useState<string | null>(null);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);

  const handlePickImage = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert("Permission Denied", "Camera roll permissions are required to select photos.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets[0]) {
      setSelectedImage(result.assets[0].uri);
      // Reset previous upload state on new pick
      setUploadedKey(null);
      setUploadedUrl(null);
      setUploadProgress(0);
    }
  };

  const handleUpload = async () => {
    if (!selectedImage) {
      Alert.alert("Error", "Please select an image first.");
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

    try {
      const filename = `photo_${Date.now()}.jpg`;
      const contentType = "image/jpeg";

      const result = await uploadFileToS3(
        selectedImage,
        filename,
        contentType,
        isPublic,
        (progress) => {
          setUploadProgress(progress);
        }
      );

      setUploadedKey(result.key);
      setUploadedUrl(result.downloadUrl);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Success", "Image successfully uploaded to S3!");
    } catch (e: any) {
      console.error(e);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Upload Failed", e.message || "Failed to upload image.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#fff" }}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.container} edges={["top", "bottom", "left", "right"]}>
        
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#000" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>S3 Upload Test</Text>
          <View style={{ width: 40 }} /> {/* Spacer */}
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          
          {/* Picker Area */}
          <TouchableOpacity 
            style={styles.pickerBox} 
            onPress={handlePickImage}
            disabled={isUploading}
            activeOpacity={0.8}
          >
            {selectedImage ? (
              <Image source={{ uri: selectedImage }} style={styles.previewImage} />
            ) : (
              <View style={styles.pickerPlaceholder}>
                <Ionicons name="image-outline" size={48} color="#999" />
                <Text style={styles.pickerText}>Tap to select an image</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Settings Area */}
          <View style={styles.settingsContainer}>
            <View style={styles.switchRow}>
              <View style={styles.switchLabels}>
                <Text style={styles.settingLabel}>Public Visibility</Text>
                <Text style={styles.settingSub}>Public uploads can be read directly via S3 CDN link</Text>
              </View>
              <Switch 
                value={isPublic} 
                onValueChange={setIsPublic}
                disabled={isUploading}
                trackColor={{ false: "#e0e0e0", true: "#000" }}
                thumbColor={Platform.OS === 'ios' ? undefined : "#fff"}
              />
            </View>
          </View>

          {/* Progress Indicator */}
          {isUploading && (
            <View style={styles.progressContainer}>
              <ActivityIndicator size="small" color="#000" />
              <Text style={styles.progressText}>
                Uploading: {Math.round(uploadProgress * 100)}%
              </Text>
              <View style={styles.progressBarBg}>
                <View style={[styles.progressBarFill, { width: `${uploadProgress * 100}%` }]} />
              </View>
            </View>
          )}

          {/* Action Button */}
          {selectedImage && !isUploading && (
            <TouchableOpacity style={styles.uploadBtn} onPress={handleUpload}>
              <Text style={styles.uploadBtnText}>Upload to S3</Text>
              <Ionicons name="cloud-upload" size={20} color="#fff" />
            </TouchableOpacity>
          )}

          {/* Upload Success Info */}
          {uploadedKey && uploadedUrl && (
            <View style={styles.successContainer}>
              <Text style={styles.successHeader}>Upload Successful</Text>
              
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>S3 Key:</Text>
                <Text style={styles.metaValue} numberOfLines={1}>{uploadedKey}</Text>
              </View>

              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>URL Expiration:</Text>
                <Text style={styles.metaValue}>90 Days</Text>
              </View>

              <Text style={styles.renderHeader}>Rendered directly from S3 download link:</Text>
              <View style={styles.s3PreviewBox}>
                <Image source={{ uri: uploadedUrl }} style={styles.s3PreviewImage} />
              </View>
            </View>
          )}

        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#000",
    letterSpacing: -0.5,
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 60,
  },
  pickerBox: {
    width: "100%",
    height: 240,
    borderRadius: 20,
    backgroundColor: "#f5f5f5",
    borderWidth: 2,
    borderColor: "#e5e5e5",
    borderStyle: "dashed",
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
  },
  previewImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  pickerPlaceholder: {
    alignItems: "center",
  },
  pickerText: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: "600",
    color: "#888",
  },
  settingsContainer: {
    width: "100%",
    backgroundColor: "#fafafa",
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  switchLabels: {
    flex: 1,
    paddingRight: 16,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111",
    marginBottom: 4,
  },
  settingSub: {
    fontSize: 12,
    color: "#666",
    lineHeight: 16,
  },
  progressContainer: {
    alignItems: "center",
    marginBottom: 24,
  },
  progressText: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
  },
  progressBarBg: {
    width: "100%",
    height: 6,
    borderRadius: 3,
    backgroundColor: "#eee",
    marginTop: 12,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "#000",
  },
  uploadBtn: {
    backgroundColor: "#000",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 30,
    width: "100%",
    gap: 8,
  },
  uploadBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  successContainer: {
    marginTop: 32,
    padding: 20,
    borderRadius: 20,
    backgroundColor: "#f7f7f7",
    borderWidth: 1,
    borderColor: "#eee",
  },
  successHeader: {
    fontSize: 18,
    fontWeight: "800",
    color: "#000",
    marginBottom: 16,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  metaLabel: {
    fontSize: 14,
    color: "#666",
    fontWeight: "500",
  },
  metaValue: {
    fontSize: 14,
    color: "#000",
    fontWeight: "600",
    flex: 1,
    textAlign: "right",
    paddingLeft: 20,
  },
  renderHeader: {
    fontSize: 14,
    color: "#444",
    fontWeight: "700",
    marginTop: 16,
    marginBottom: 12,
  },
  s3PreviewBox: {
    width: "100%",
    height: 180,
    borderRadius: 12,
    overflow: "hidden",
  },
  s3PreviewImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  }
});
