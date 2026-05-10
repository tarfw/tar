import React from "react";
import { 
  StyleSheet, 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity, 
  TextInput,
  Image,
  KeyboardAvoidingView,
  Platform
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";

export default function HomePage() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const items = [
    { id: "1", icon: "heart", iconColor: "#ff4d4d", title: "35", type: "ion" },
    { id: "2", icon: "heart", iconColor: "#ff4d4d", title: "Raven", type: "ion" },
    { id: "divider1", isHeader: true, title: "Private" },
    { id: "3", icon: "planet", iconColor: "#ff9f43", title: "par db", type: "ion" },
    { id: "4", icon: "file-document-outline", iconColor: "#8395a7", title: "PC SETUP", type: "material" },
    { id: "5", icon: "file-document-outline", iconColor: "#8395a7", title: "This week", type: "material" },
    { id: "6", icon: "file-document-outline", iconColor: "#8395a7", title: "Creator", type: "material" },
    { id: "7", icon: "file-document-outline", iconColor: "#8395a7", title: "Creator", type: "material" },
    { id: "8", icon: "file-document-outline", iconColor: "#8395a7", title: "Creator", type: "material" },
    { id: "9", icon: "table", iconColor: "#1dd1a1", title: "TIME LINE", type: "material" },
    { id: "10", icon: "file-document-outline", iconColor: "#8395a7", title: "caste", type: "material" },
    { id: "11", icon: "twitter", iconColor: "#1da1f2", title: "Twitter Slides", type: "material" },
    { id: "12", icon: "file-document-outline", iconColor: "#8395a7", title: "Blog", type: "material" },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      
      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.userInfo}>
            <Image 
              source={{ uri: "https://api.dicebear.com/7.x/avataaars/svg?seed=prabha" }} 
              style={styles.avatar} 
            />
            <Text style={styles.userName}>prabha</Text>
            <Ionicons name="chevron-down" size={16} color="#666" />
          </View>
          <View style={styles.headerIcons}>
            <TouchableOpacity style={styles.iconBtn}>
              <Ionicons name="archive-outline" size={24} color="#333" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn}>
              <Ionicons name="ellipsis-horizontal" size={24} color="#333" />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView 
          style={styles.scrollView} 
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {items.map((item) => {
            if (item.isHeader) {
              return (
                <Text key={item.id} style={styles.sectionHeader}>
                  {item.title}
                </Text>
              );
            }
            return (
              <TouchableOpacity key={item.id} style={styles.listItem}>
                <View style={styles.listItemLeft}>
                  {item.type === "ion" ? (
                    <Ionicons name={item.icon as any} size={20} color={item.iconColor} style={styles.itemIcon} />
                  ) : (
                    <MaterialCommunityIcons name={item.icon as any} size={20} color={item.iconColor} style={styles.itemIcon} />
                  )}
                  <Text style={styles.itemTitle}>{item.title}</Text>
                </View>
                <View style={styles.listItemRight}>
                  <Ionicons name="ellipsis-horizontal" size={16} color="#ccc" style={styles.moreIcon} />
                  <Ionicons name="add" size={20} color="#ccc" />
                </View>
              </TouchableOpacity>
            );
          })}
          
          <TouchableOpacity style={styles.viewMore}>
            <Ionicons name="ellipsis-horizontal" size={16} color="#999" />
            <Text style={styles.viewMoreText}>View more</Text>
          </TouchableOpacity>
          
          <View style={{ height: 20 }} />
        </ScrollView>

        {/* Bottom Search Bar */}
        <View style={styles.footer}>
          <View style={styles.searchBarContainer}>
            <TouchableOpacity style={styles.footerIcon}>
              <Ionicons name="search" size={24} color="#666" />
            </TouchableOpacity>
            
            <View style={styles.inputWrapper}>
              <TextInput 
                placeholder="Ask AI" 
                style={styles.input} 
                placeholderTextColor="#999"
              />
            </View>

            <TouchableOpacity style={styles.createBtn} onPress={() => router.push('/space')}>
              <Ionicons name="add" size={24} color="#666" />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "white",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  userInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#000",
    marginRight: 10,
  },
  userName: {
    fontSize: 18,
    fontWeight: "600",
    marginRight: 4,
  },
  headerIcons: {
    flexDirection: "row",
  },
  iconBtn: {
    marginLeft: 20,
  },
  scrollView: {
    flex: 1,
  },
  sectionHeader: {
    fontSize: 14,
    color: "#999",
    paddingHorizontal: 20,
    marginTop: 25,
    marginBottom: 10,
  },
  listItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 15,
    paddingVertical: 12,
  },
  listItemLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  arrow: {
    marginRight: 10,
  },
  itemIcon: {
    marginRight: 12,
  },
  itemTitle: {
    fontSize: 16,
    color: "#333",
    fontWeight: "500",
  },
  listItemRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  moreIcon: {
    marginRight: 15,
  },
  viewMore: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  viewMoreText: {
    color: "#999",
    marginLeft: 10,
    fontSize: 16,
  },
  footer: {
    width: "100%",
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 10,
    backgroundColor: "rgba(255,255,255,0.9)",
  },
  searchBarContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
    borderRadius: 30,
    paddingHorizontal: 15,
    height: 55,
  },
  footerIcon: {
    marginRight: 10,
  },
  inputWrapper: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },

  input: {
    flex: 1,
    fontSize: 16,
    color: "#333",
  },
  createBtn: {
    marginLeft: 10,
  }
});
