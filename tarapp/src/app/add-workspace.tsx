import { StyleSheet, View, Text, TouchableOpacity, TextInput, ActivityIndicator, Keyboard } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useState, useRef } from 'react';
import * as SecureStore from 'expo-secure-store';
import Ionicons from '@expo/vector-icons/Ionicons';

import { useTheme } from '@/hooks/use-theme';
import { tar } from '@/lib/tar';

export default function AddWorkspaceScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const router = useRouter();

  const [workspaceName, setWorkspaceName] = useState('');
  const [subdomain, setSubdomain] = useState('');
  const [businessMessage, setBusinessMessage] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const messageInputRef = useRef<TextInput>(null);

  const handleNameChange = (val: string) => {
    setWorkspaceName(val);
    const slug = val
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 30);
    setSubdomain(slug);
  };

  const handleCreate = async () => {
    if (!workspaceName.trim() || !subdomain.trim() || creating) return;
    Keyboard.dismiss();
    setCreating(true);
    setError('');
    try {
      const activeSubdomain = subdomain.trim();
      await tar.createWorkspace({
        name: workspaceName.trim(),
        subdomain: activeSubdomain,
        message: businessMessage.trim(),
      });

      const userId = await SecureStore.getItemAsync('google_auth_user')
        .then((u) => (u ? JSON.parse(u).id : null))
        .catch(() => null);
      if (userId) {
        await SecureStore.setItemAsync(`onb_${userId}`, 'true');
      }
      await SecureStore.setItemAsync('active_workspace_subdomain', activeSubdomain);

      // Redirect immediately to the workspaces screen
      try {
        router.replace('/(tabs)/workspaces');
      } catch (e1) {
        console.warn('[AddWorkspace] Redirect to /(tabs)/workspaces failed, trying /workspaces:', e1);
        try {
          router.replace('/workspaces');
        } catch (e2) {
          router.replace('/');
        }
      }
    } catch (e: any) {
      setError(e.message || 'Failed to create workspace');
      setCreating(false);
    }
  };

  // Extract active modules dynamically based on user prompt in real-time
  const text = businessMessage.toLowerCase().trim();
  
  const hasOrders = text.includes('order') || text.includes('sale') || text.includes('pos') || text.includes('restaurant') || text.includes('cafe') || text.includes('shop') || text.includes('store') || text.includes('retail');
  const hasInventory = text.includes('inventory') || text.includes('stock') || text.includes('product') || text.includes('warehouse') || text.includes('restaurant') || text.includes('cafe') || text.includes('shop') || text.includes('store') || text.includes('retail');
  const hasCRM = text.includes('crm') || text.includes('customer') || text.includes('client') || text.includes('lead') || text.includes('contact');
  const hasBookings = text.includes('book') || text.includes('appoint') || text.includes('calendar') || text.includes('schedule') || text.includes('salon') || text.includes('clinic') || text.includes('doctor') || text.includes('dentist');
  const hasLogistics = text.includes('logistics') || text.includes('ship') || text.includes('delivery') || text.includes('carrier') || text.includes('track');
  const hasProjects = text.includes('project') || text.includes('task') || text.includes('todo') || text.includes('board') || text.includes('kanban');
  const hasHR = text.includes('hr') || text.includes('employee') || text.includes('staff') || text.includes('payroll') || text.includes('hire');
  const hasLMS = text.includes('lms') || text.includes('course') || text.includes('learn') || text.includes('teach') || text.includes('class') || text.includes('student');
  const hasListings = text.includes('listing') || text.includes('property') || text.includes('real estate') || text.includes('house') || text.includes('apartment');
  const hasSupport = text.includes('support') || text.includes('ticket') || text.includes('helpdesk') || text.includes('issue');
  const hasReports = text.includes('report') || text.includes('chart') || text.includes('analytics') || text.includes('stat');
  const hasExpenses = text.includes('expense') || text.includes('cost') || text.includes('spend') || text.includes('bill');
  const hasDocuments = text.includes('doc') || text.includes('file') || text.includes('paper') || text.includes('drive');
  const hasTeamChat = text.includes('chat') || text.includes('message') || text.includes('slack') || text.includes('team');

  const modules = [
    { id: 'orders', icon: 'cart-outline' as const, label: 'Commerce & Sales', active: hasOrders },
    { id: 'inventory', icon: 'cube-outline' as const, label: 'Inventory & Stock', active: hasInventory },
    { id: 'crm', icon: 'people-outline' as const, label: 'CRM & Customers', active: hasCRM },
    { id: 'bookings', icon: 'calendar-outline' as const, label: 'Appointments & Booking', active: hasBookings },
    { id: 'logistics', icon: 'car-outline' as const, label: 'Logistics & Shipments', active: hasLogistics },
    { id: 'projects', icon: 'checkbox-outline' as const, label: 'Projects & Tasks', active: hasProjects },
    { id: 'hr', icon: 'people-outline' as const, label: 'HR & Employees', active: hasHR },
    { id: 'lms', icon: 'book-outline' as const, label: 'LMS & Courses', active: hasLMS },
    { id: 'listings', icon: 'pricetag-outline' as const, label: 'Listings & Catalog', active: hasListings },
    { id: 'support', icon: 'help-circle-outline' as const, label: 'Support & Tickets', active: hasSupport },
    { id: 'reports', icon: 'bar-chart-outline' as const, label: 'Analytics & Reports', active: hasReports },
    { id: 'expenses', icon: 'cash-outline' as const, label: 'Expenses & Log', active: hasExpenses },
    { id: 'documents', icon: 'document-text-outline' as const, label: 'Documents & Files', active: hasDocuments },
    { id: 'team-chat', icon: 'chatbubbles-outline' as const, label: 'Team Chat & Relays', active: hasTeamChat },
  ];

  const matchedModules = modules.filter((m) => m.active);
  const isCustomConfigured = matchedModules.length > 0;

  // Use matched modules if present, else fallback to core defaults during creation
  let activeModules = isCustomConfigured ? matchedModules : [];
  if (creating && activeModules.length === 0) {
    activeModules = [
      { id: 'orders', icon: 'cart-outline' as const, label: 'Commerce & Sales', active: true },
      { id: 'inventory', icon: 'cube-outline' as const, label: 'Inventory & Stock', active: true },
      { id: 'crm', icon: 'people-outline' as const, label: 'CRM & Customers', active: true },
      { id: 'reports', icon: 'bar-chart-outline' as const, label: 'Analytics & Reports', active: true },
    ];
  }

  const canCreate = workspaceName.trim() && subdomain.trim() && !creating;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <KeyboardAwareScrollView 
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.content, { paddingTop: insets.top + 60 }]}>
          
          {/* Notion-style Title Input */}
          <TextInput
            style={[styles.titleInput, { color: theme.text }]}
            value={workspaceName}
            onChangeText={handleNameChange}
            placeholder="Untitled Workspace"
            placeholderTextColor={theme.textMuted + '80'}
            editable={!creating}
            autoFocus
          />

          {/* Subdomain URL Preview Label */}
          {subdomain.length > 0 && (
            <Text style={[styles.urlPreview, { color: theme.primary }]}>
              {subdomain}.tarai.space
            </Text>
          )}

          {/* Notion-style Description Area + Action Button */}
          <View style={styles.descriptionContainer}>
            <TextInput
              ref={messageInputRef}
              style={[styles.textArea, { color: theme.text }]}
              value={businessMessage}
              onChangeText={setBusinessMessage}
              placeholder="Type a description or tell the AI what you want to build..."
              placeholderTextColor={theme.textMuted + '80'}
              multiline
              editable={!creating}
            />

            <TouchableOpacity
              activeOpacity={canCreate ? 0.7 : 1}
              style={[
                styles.sendButton, 
                { backgroundColor: canCreate ? theme.primary : theme.border }
              ]}
              onPress={handleCreate}
              disabled={!canCreate}
            >
              {creating ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="arrow-up" size={20} color={canCreate ? '#fff' : theme.textMuted} />
              )}
            </TouchableOpacity>
          </View>

          {/* Real-time AI Composing Preview / Final Generating list */}
          {(creating || isCustomConfigured) && (
            <View style={styles.generatingBox}>
              <View style={styles.generatingHeader}>
                <Text style={[styles.generatingSubtitle, { color: theme.text }]}>
                  {creating ? 'Generating workspace...' : 'AI Selected Modules'}
                </Text>
                {creating && <ActivityIndicator size="small" color={theme.primary} />}
              </View>

              <View style={styles.solutions}>
                {activeModules.map((item) => (
                  <View key={item.id} style={[styles.solutionRow, { opacity: creating ? 1 : 0.8 }]}>
                    {creating ? (
                      <ActivityIndicator size="small" color={theme.primary} style={{ marginRight: 6 }} />
                    ) : (
                      <Ionicons name={item.icon} size={22} color={theme.primary} style={{ marginRight: 6 }} />
                    )}
                    <Text style={[styles.solutionLabel, { color: theme.text }]}>{item.label}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, paddingHorizontal: 32 },
  titleInput: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.5,
    padding: 0,
    marginBottom: 8,
  },
  urlPreview: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 24,
  },
  descriptionContainer: {
    minHeight: 120,
    position: 'relative',
    marginBottom: 24,
  },
  textArea: {
    fontSize: 16,
    lineHeight: 24,
    padding: 0,
    textAlignVertical: 'top',
    minHeight: 120,
    paddingRight: 48,
  },
  sendButton: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  generatingBox: {
    marginTop: 10,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.06)',
  },
  generatingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  generatingSubtitle: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  solutions: { gap: 14 },
  solutionRow: { flexDirection: 'row', alignItems: 'center' },
  solutionLabel: { fontSize: 16, fontWeight: '500' },
  error: { fontSize: 14, color: '#f44336', marginTop: 16, textAlign: 'center' },
});
