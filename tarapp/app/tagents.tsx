import React, { useState } from "react";
import { 
  StyleSheet, 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity, 
  Image, 
  TextInput,
  Platform 
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as Haptics from "expo-haptics";

const SCOPES = [
  { category: "Personal", targetDb: "user_${self_id}.db", prefix: "p" },
  { category: "Global", targetDb: "global.db", prefix: "g" },
  { category: "Family", targetDb: "user_sync_${owner_id}.db", prefix: "f:{id}" },
  { category: "Team / Work", targetDb: "user_sync_${owner_id}.db", prefix: "t:{id}" },
  { category: "Friends", targetDb: "user_sync_${owner_id}.db", prefix: "r:{id}" },
  { category: "Storefront", targetDb: "user_sync_${owner_id}.db", prefix: "s:{id}" },
  { category: "Warehouse", targetDb: "user_sync_${owner_id}.db", prefix: "w:{id}" },
  { category: "Client / CRM", targetDb: "user_sync_${owner_id}.db", prefix: "c:{id}" },
  { category: "Campaigns", targetDb: "user_sync_${owner_id}.db", prefix: "m:{id}" },
  { category: "Forms", targetDb: "user_sync_${owner_id}.db", prefix: "x:{id}" },
  { category: "HR / Staff", targetDb: "user_sync_${owner_id}.db", prefix: "h:{id}" },
  { category: "Logistics", targetDb: "user_sync_${owner_id}.db", prefix: "d" }
];

const DUMMY_MEMBERS: Record<string, { name: string; role: string; photo: string }[]> = {
  "Personal": [
    { name: "You (Private Catalog)", role: "Owner", photo: "https://api.dicebear.com/7.x/notionists/png?seed=Felix&backgroundColor=b6e3f4" }
  ],
  "Global": [
    { name: "System Admin", role: "Admin", photo: "https://api.dicebear.com/7.x/notionists/png?seed=Admin&backgroundColor=c0aede" },
    { name: "Public Catalog Sync", role: "Automation", photo: "https://api.dicebear.com/7.x/notionists/png?seed=Robot&backgroundColor=d1d4f9" }
  ],
  "Family": [
    { name: "Mom", role: "Admin", photo: "https://api.dicebear.com/7.x/notionists/png?seed=Mom&backgroundColor=ffd5dc" },
    { name: "Sister", role: "Member", photo: "https://api.dicebear.com/7.x/notionists/png?seed=Sister&backgroundColor=ffdf00" }
  ],
  "Team / Work": [
    { name: "Alice Smith", role: "Manager", photo: "https://api.dicebear.com/7.x/notionists/png?seed=Alice&backgroundColor=c2f0c2" },
    { name: "Bob Johnson", role: "Lead Developer", photo: "https://api.dicebear.com/7.x/notionists/png?seed=Bob&backgroundColor=ffe0b2" },
    { name: "Charlie Brown", role: "QA Engineer", photo: "https://api.dicebear.com/7.x/notionists/png?seed=Charlie&backgroundColor=b6e3f4" }
  ],
  "Friends": [
    { name: "Dave Miller", role: "Member", photo: "https://api.dicebear.com/7.x/notionists/png?seed=Dave&backgroundColor=c0aede" },
    { name: "Eva Green", role: "Member", photo: "https://api.dicebear.com/7.x/notionists/png?seed=Eva&backgroundColor=ffd5dc" }
  ],
  "Storefront": [
    { name: "Central Retail Store", role: "Store", photo: "https://api.dicebear.com/7.x/notionists/png?seed=Store&backgroundColor=d1d4f9" }
  ],
  "Warehouse": [
    { name: "Chennai SCM Warehouse", role: "Logistics", photo: "https://api.dicebear.com/7.x/notionists/png?seed=Warehouse&backgroundColor=ffdf00" }
  ],
  "Client / CRM": [
    { name: "Acme Corp (VIP Lead)", role: "Client", photo: "https://api.dicebear.com/7.x/notionists/png?seed=Client&backgroundColor=c2f0c2" },
    { name: "Wayne Enterprises", role: "Client", photo: "https://api.dicebear.com/7.x/notionists/png?seed=Bruce&backgroundColor=ffe0b2" }
  ],
  "Campaigns": [
    { name: "Summer Launch Campaign", role: "Campaign", photo: "https://api.dicebear.com/7.x/notionists/png?seed=Campaign&backgroundColor=b6e3f4" }
  ],
  "Forms": [
    { name: "Employee Feedback Form", role: "Form", photo: "https://api.dicebear.com/7.x/notionists/png?seed=Form&backgroundColor=c0aede" }
  ],
  "HR / Staff": [
    { name: "HR Manager Office", role: "Admin", photo: "https://api.dicebear.com/7.x/notionists/png?seed=HR&backgroundColor=ffd5dc" }
  ],
  "Logistics": [
    { name: "Fleet Dispatcher", role: "Operations", photo: "https://api.dicebear.com/7.x/notionists/png?seed=Dispatcher&backgroundColor=d1d4f9" },
    { name: "Delivery Partner 01", role: "Transit", photo: "https://api.dicebear.com/7.x/notionists/png?seed=Delivery&backgroundColor=ffdf00" }
  ]
};

function InitialAvatar({ name, size = 48 }: { name: string; size?: number }) {
  const cleanName = name.replace(/\(.*\)/, "").replace(/@\w+/, "").trim();
  const parts = cleanName.split(/\s+/);
  let initials = "";
  if (parts.length > 0 && parts[0] && parts[0][0]) {
    initials += parts[0][0];
  }
  if (parts.length > 1 && parts[1] && parts[1][0]) {
    initials += parts[1][0];
  }
  initials = initials.toUpperCase();

  const colors = [
    "#b6e3f4", // light blue
    "#c0aede", // lavender
    "#ffd5dc", // rose
    "#ffdf00", // pastel yellow
    "#c2f0c2", // pastel green
    "#ffe0b2", // peach
    "#d1d4f9", // indigo
    "#cbd5e1"  // slate
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const color = colors[Math.abs(hash) % colors.length];

  return (
    <View style={[
      styles.memberAvatar,
      {
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        justifyContent: "center",
        alignItems: "center"
      }
    ]}>
      <Text style={{
        fontSize: size * 0.38,
        fontWeight: "700",
        color: "#0f172a"
      }}>
        {initials || "?"}
      </Text>
    </View>
  );
}

export default function TeamsAgentsScreen() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");

  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  };

  // Filter scopes and members based on search
  const filteredScopes = SCOPES.map((scope) => {
    const members = DUMMY_MEMBERS[scope.category] || [];
    const filteredMembers = members.filter(
      (m) =>
        m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.role.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const isCategoryMatch = scope.category.toLowerCase().includes(searchQuery.toLowerCase());
    
    return {
      ...scope,
      members: isCategoryMatch ? members : filteredMembers
    };
  }).filter((scope) => scope.members.length > 0);

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ presentation: "modal", animation: "none", headerShown: false }} />
      <StatusBar style="dark" />
      <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
        
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Teams & Agents</Text>
        </View>

        {/* Search Input Block */}
        <View style={styles.searchContainer}>
          <View style={styles.searchBar}>
            <Ionicons name="search-outline" size={18} color="#94a3b8" style={{ marginRight: 8 }} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search agents, roles, or scopes..."
              placeholderTextColor="#94a3b8"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCorrect={false}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery("")}>
                <Ionicons name="close-circle" size={18} color="#94a3b8" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Scopes & Teams List */}
        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
          <View style={styles.settingsList}>
            {filteredScopes.length > 0 ? (
              filteredScopes.map((item, index) => (
                <View key={index} style={styles.scopeItemWrapper}>
                  <View style={styles.scopeHeaderRow}>
                    <View>
                      <Text style={styles.scopeCategoryName}>{item.category}</Text>
                      <Text style={styles.scopeDatabaseName}>{item.targetDb}</Text>
                    </View>
                    <View style={styles.scopePrefixBadge}>
                      <Text style={styles.scopePrefixText}>{item.prefix}</Text>
                    </View>
                  </View>

                  <View style={styles.membersContainer}>
                    {item.members.map((member, mIdx) => (
                      <View key={mIdx} style={styles.memberRow}>
                        {member.photo ? (
                          <Image source={{ uri: member.photo }} style={styles.memberAvatar} />
                        ) : (
                          <InitialAvatar name={member.name} />
                        )}
                        <View style={styles.memberInfo}>
                          <Text style={styles.memberName}>{member.name}</Text>
                          <Text style={styles.memberRole}>{member.role}</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                </View>
              ))
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="people-outline" size={48} color="#cbd5e1" />
                <Text style={styles.emptyText}>No teams or agents found</Text>
              </View>
            )}
          </View>
        </ScrollView>

      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#0f172a",
  },
  searchContainer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#f1f5f9",
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: "#0f172a",
    padding: 0,
  },
  settingsList: {
    paddingBottom: 40,
    paddingTop: 8,
  },
  scopeItemWrapper: {
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  scopeHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  scopeCategoryName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0f172a",
  },
  scopeDatabaseName: {
    fontSize: 11,
    color: "#64748b",
    marginTop: 2,
  },
  scopePrefixBadge: {
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  scopePrefixText: {
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    fontSize: 12,
    color: "#0f172a",
    fontWeight: "700",
  },
  membersContainer: {
    paddingHorizontal: 20,
    paddingVertical: 4,
    marginBottom: 12,
  },
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
  },
  memberAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0f172a",
  },
  memberRole: {
    fontSize: 11,
    color: "#64748b",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 80,
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 14,
    color: "#64748b",
    marginTop: 12,
    fontWeight: "500",
  },
});
