import { useState, useEffect, useCallback, useRef } from 'react';
import { StyleSheet, View, Text, Pressable, ScrollView, TextInput, ActivityIndicator, Modal, KeyboardAvoidingView, Platform, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as SecureStore from 'expo-secure-store';

import { useTheme } from '@/hooks/use-theme';
import { tar } from '@/lib/tar';
import { useSite } from '@/hooks/use-site';
import { generateSiteLayout } from '@/lib/site-ai';
import {
  TextCard,
  ErrorCard,
  ProductListCard,
  ProductCreatedCard,
  OrderListCard,
  StatsCard,
  SiteCard,
} from '@/components/cards/ResultCards';
import { parseDesignTokens } from '@/lib/design-tokens';
import { buildModuleLayout, parseYamlFrontmatter } from '@/lib/layout-engine';
import WorkspaceCanvas from '@/components/WorkspaceCanvas';

interface Workspace {
  scope: string;
  subdomain: string;
  role: string;
  name?: string;
  vertical?: string;
}

interface CardItem {
  id: string;
  type: 'user_text' | 'assistant_text' | 'error' | 'product_list' | 'product_created' | 'order_list' | 'stats' | 'site_card';
  text?: string;
  message?: string;
  products?: any[];
  product?: any;
  orders?: any[];
  title?: string;
  value?: string | number;
  subtitle?: string;
  layout?: any;
  isDirty?: boolean;
}

const WorkspaceThumbnail = ({ name, size = 36, theme }: { name: string; size?: number; theme: any }) => {
  const firstLetter = name ? name.charAt(0).toUpperCase() : 'W';
  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const color = colors[Math.abs(hash) % colors.length];

  return (
    <View style={{
      width: size,
      height: size,
      borderRadius: Math.round(size * 0.22),
      backgroundColor: color,
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <Text style={{
        color: '#ffffff',
        fontSize: size * 0.45,
        fontWeight: '700',
      }}>
        {firstLetter}
      </Text>
    </View>
  );
};

export default function WorkspacesScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const router = useRouter();

  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null);
  const [loadingWorkspaces, setLoadingWorkspaces] = useState(true);

  const [sessionId] = useState(() => 'sess_' + Date.now());
  const [products, setProducts] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [agentFeedback, setAgentFeedback] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [input, setInput] = useState('');
  const [executing, setExecuting] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  
  // Dynamic workspace blueprints/modules
  const [loadingIndex, setLoadingIndex] = useState(false);
  const [activeModules, setActiveModules] = useState<string[]>([]);
  const [detectedVertical, setDetectedVertical] = useState('general');
  const [parsedToolsList, setParsedToolsList] = useState<any[]>([]);
  const [editableQueries, setEditableQueries] = useState<Record<string, string>>({});
  
  const [designTokens, setDesignTokens] = useState<any>(null);
  const [canvasLayouts, setCanvasLayouts] = useState<any[]>([]);
  const [loadingCanvas, setLoadingCanvas] = useState(false);
  
  const scrollViewRef = useRef<ScrollView>(null);
  const workspaceToolsCache = useRef<Record<string, { detectedVertical: string; activeModules: string[]; parsedToolsList: any[] }>>({});
  
  // Custom scope resolution to feed into useSite
  const activeScope = currentWorkspace?.scope ?? undefined;
  const { draft, publish, saveDraft, refresh: refreshSite } = useSite(activeScope);

  // Load workspace index.md and dynamic module files from S3 when info modal opens
  useEffect(() => {
    if (showInfo && currentWorkspace?.scope) {
      const scope = currentWorkspace.scope;
      const cached = workspaceToolsCache.current[scope];

      if (cached) {
        // Load immediately from cache (no loading screen)
        setDetectedVertical(cached.detectedVertical);
        setActiveModules(cached.activeModules);
        setParsedToolsList(cached.parsedToolsList);
        setLoadingIndex(false);
      } else {
        // First-time loading indicator
        setLoadingIndex(true);
      }

      tar.okf.readIndex(scope)
        .then(async (res: any) => {
          if (res && res.content) {
            const { vertical, modules } = parseIndexMarkdown(res.content);

            // Fetch each module's markdown content in parallel
            try {
              const fetchedTools = await Promise.all(
                modules.map(async (mod) => {
                  try {
                    const fileRes = await tar.okf.read(scope, `${mod}.md`);
                    if (fileRes && fileRes.content) {
                      return parseModuleMarkdown(mod, fileRes.content);
                    }
                  } catch (e) {
                    console.warn(`[OKF] Failed to fetch module ${mod}.md:`, e);
                  }
                  return null;
                })
              );
              
              const validTools = fetchedTools.filter(t => t !== null) as any[];

              // Update cache
              workspaceToolsCache.current[scope] = {
                detectedVertical: vertical,
                activeModules: modules,
                parsedToolsList: validTools
              };

              // Update states
              setDetectedVertical(vertical);
              setActiveModules(modules);
              setParsedToolsList(validTools);
            } catch (err) {
              console.warn('[OKF] Failed to load module details:', err);
            }
          }
        })
        .catch((err: any) => {
          console.warn('[OKF] Failed to fetch workspace index.md:', err);
          if (!cached) {
            setDetectedVertical(currentWorkspace.vertical || 'general');
            setActiveModules([]);
            setParsedToolsList([]);
          }
        })
        .finally(() => {
          setLoadingIndex(false);
        });
    }
  }, [showInfo, currentWorkspace?.scope]);

  const getDynamicToolsList = () => {
    const list: any[] = [];
    
    // Always include storefront website tools
    list.push(WEBSITE_TOOLS);

    // If we have successfully parsed dynamic tools from S3 md files
    if (parsedToolsList.length > 0) {
      list.push(...parsedToolsList);
    } else {
      // Fallback based on vertical (if offline or files not fetched yet)
      const vert = detectedVertical || currentWorkspace?.vertical || 'general';
      let fallbacks: string[] = [];
      if (vert === 'restaurant' || vert === 'bakery' || vert === 'retail') {
        fallbacks = ['inventory', 'orders'];
      } else if (vert === 'services') {
        fallbacks = ['bookings', 'crm'];
      } else {
        fallbacks = ['inventory', 'documents'];
      }
      fallbacks.forEach(mod => {
        const tool = MODULE_TOOLS_MAP[mod];
        if (tool) {
          list.push(tool);
        }
      });
    }

    return list;
  };

  // Fetch workspaces list on mount
  const fetchWorkspacesList = useCallback(async () => {
    setLoadingWorkspaces(true);
    try {
      const data = await tar.listWorkspaces();
      const list: Workspace[] = data.workspaces || [];
      setWorkspaces(list);

      if (list.length > 0) {
        // Read last active subdomain from SecureStore
        const activeSub = await SecureStore.getItemAsync('active_workspace_subdomain').catch(() => null);
        const found = list.find((w) => w.subdomain === activeSub);
        if (found) {
          setCurrentWorkspace(found);
        } else {
          // Default to first
          setCurrentWorkspace(list[0]);
          await SecureStore.setItemAsync('active_workspace_subdomain', list[0].subdomain).catch(() => null);
        }
      }
    } catch (e) {
      console.warn('[Workspaces] Failed to fetch workspaces:', e);
    } finally {
      setLoadingWorkspaces(false);
    }
  }, []);

  useEffect(() => {
    fetchWorkspacesList();
  }, [fetchWorkspacesList]);

  // Sync current workspace database when selected workspace changes
  useEffect(() => {
    if (currentWorkspace?.subdomain) {
      import('@/lib/db').then(({ initWorkspaceSync }) => {
        initWorkspaceSync(currentWorkspace.subdomain).catch(err => {
          console.warn('[Workspace] Failed to initialize sync for', currentWorkspace.subdomain, err);
        });
      });
    }
  }, [currentWorkspace]);

  const refreshProducts = async (scope: string) => {
    try {
      const result = await tar.tool('read', {
        table: 'matter',
        type: 'product',
        active: 1,
        scope
      });
      setProducts(result?.rows || []);
    } catch (e) {
      console.warn('[Workspace] Failed to fetch products:', e);
    }
  };

  const refreshOrders = async (scope: string) => {
    try {
      const result = await tar.tool('read', { table: 'matter', type: 'order', active: 1, scope });
      if (result?.rows && result.rows.length > 0) {
        setOrders(result.rows);
      } else {
        const motionRes = await tar.tool('read', { table: 'motion', active: 1, scope });
        setOrders(motionRes?.rows || []);
      }
    } catch (e) {
      console.warn('[Workspace] Failed to fetch orders:', e);
    }
  };

  // Load products and orders when workspace changes
  useEffect(() => {
    if (currentWorkspace?.scope) {
      const scope = currentWorkspace.scope;
      refreshProducts(scope);
      refreshOrders(scope);
      setAgentFeedback(null);
    }
  }, [currentWorkspace]);

  // Load DESIGN.md + modules SKILL.md specs from S3 whenever workspace changes
  useEffect(() => {
    if (currentWorkspace?.scope) {
      const scope = currentWorkspace.scope;
      setLoadingCanvas(true);
      
      Promise.all([
        tar.okf.read(scope, 'DESIGN.md').catch(() => null),
        tar.okf.readIndex(scope).catch(() => null)
      ]).then(async ([designRes, indexRes]) => {
        let tokens = null;
        if (designRes && designRes.content) {
          try {
            const { frontmatter } = parseYamlFrontmatter(designRes.content);
            tokens = parseDesignTokens(frontmatter);
            setDesignTokens(tokens);
          } catch (err) {
            console.warn('[Canvas] Failed to parse DESIGN.md:', err);
          }
        }
        
        if (indexRes && indexRes.content) {
          const { modules } = parseIndexMarkdown(indexRes.content);
          const fetchedLayouts = await Promise.all(
            modules.map(async (mod) => {
              try {
                const fileRes = await tar.okf.read(scope, `skills/${mod}.md`);
                if (fileRes && fileRes.content) {
                  return buildModuleLayout(mod, fileRes.content);
                }
              } catch (e) {
                console.warn(`[Canvas] Failed to fetch skill ${mod}.md:`, e);
              }
              return null;
            })
          );
          setCanvasLayouts(fetchedLayouts.filter(Boolean) as any[]);
        }
      }).catch(err => {
        console.warn('[Canvas] Failed to load workspace specs:', err);
      }).finally(() => {
        setLoadingCanvas(false);
      });
    }
  }, [currentWorkspace?.scope]);

  const handleSelectWorkspace = async (item: Workspace) => {
    setShowDropdown(false);
    if (item.subdomain === currentWorkspace?.subdomain) return;
    
    setCurrentWorkspace(item);
    await SecureStore.setItemAsync('active_workspace_subdomain', item.subdomain).catch(() => null);
    setAgentFeedback(null);
  };

  const handleSend = async (messageText?: string) => {
    const textToSend = messageText || input;
    if (!textToSend.trim() || !currentWorkspace) return;

    if (!messageText) setInput('');

    setExecuting(true);
    setAgentFeedback(null);

    try {
      const cleanText = textToSend.trim().toLowerCase();
      const scope = currentWorkspace.scope;
      const name = currentWorkspace.name || currentWorkspace.subdomain;
      const subdomain = currentWorkspace.subdomain;
      const vertical = currentWorkspace.vertical || 'restaurant';

      if (/^(show|list|get|view)\s+(products|menu|services|inventory)/i.test(cleanText)) {
        await refreshProducts(scope);
        setAgentFeedback({ text: 'Loaded latest product inventory.', type: 'success' });
      }
      else if (/^(show|list|get|view)\s+(orders|sales)/i.test(cleanText)) {
        await refreshOrders(scope);
        setAgentFeedback({ text: 'Loaded latest orders.', type: 'success' });
      }
      else if (/^(show|view|get)\s+(site|storefront|web|website)/i.test(cleanText)) {
        await refreshSite();
        setAgentFeedback({ text: 'Displayed current website draft layout.', type: 'success' });
      }
      else if (/^publish\s+(site|storefront|website)/i.test(cleanText)) {
        await publish();
        setAgentFeedback({ text: `Site published successfully! It is live at: https://${subdomain}.tarai.space`, type: 'success' });
      }
      else if (/^(make|edit|change|update|design|customize)\s+(site|storefront|web|website)(.+)/i.test(cleanText)) {
        const match = textToSend.match(/^(make|edit|change|update|design|customize)\s+(site|storefront|web|website)\s+(.+)/i);
        const instruction = match ? match[3] : textToSend;

        const currentProducts = await tar.tool('read', { table: 'matter', type: 'product', active: 1, scope }).then(r => r.rows || []).catch(() => []);
        const newLayout = await generateSiteLayout(name, vertical, currentProducts, instruction, draft);
        await saveDraft(newLayout);
        await refreshSite();

        setAgentFeedback({ text: 'Updated your website theme and draft layout! Click Publish to set it live.', type: 'success' });
      }
      else if (/^add\s+(.+?)\s+at\s+(\d+)/i.test(cleanText) || /^create\s+product\s+(.+?)\s+(\d+)/i.test(cleanText) || /^add\s+product\s+(.+?)\s+(\d+)/i.test(cleanText)) {
        const addMatch = textToSend.match(/^add\s+(.+?)\s+at\s+(\d+)/i) || 
                         textToSend.match(/^create\s+product\s+(.+?)\s+(\d+)/i) ||
                         textToSend.match(/^add\s+product\s+(.+?)\s+(\d+)/i);
        if (addMatch) {
          const title = addMatch[1].trim();
          const val = parseFloat(addMatch[2]);
          await tar.tool('create', {
            table: 'matter',
            scope,
            type: 'product',
            title,
            value: val,
            qty: 10,
            data: { category: 'General' }
          });
          await refreshProducts(scope);
          setAgentFeedback({ text: `Successfully added "${title}" at ₹${val} to your inventory.`, type: 'success' });
        }
      }
      else {
        const response = await tar.chat(sessionId, textToSend, scope);
        setAgentFeedback({ text: response.reply, type: 'info' });
        
        // Refresh states if the agent executed database modifications
        if (response.executorResult?.success || cleanText.includes('product') || cleanText.includes('item') || cleanText.includes('add') || cleanText.includes('create') || cleanText.includes('order')) {
          await refreshProducts(scope);
          await refreshOrders(scope);
          await refreshSite();
        }
      }
    } catch (e: any) {
      setAgentFeedback({ text: e.message || 'Something went wrong while executing the command.', type: 'error' });
    } finally {
      setExecuting(false);
    }
  };

  const handlePublishFromCard = async () => {
    if (!currentWorkspace) return;
    setExecuting(true);
    setAgentFeedback(null);
    try {
      await publish();
      setAgentFeedback({ text: `Site published successfully! It is live at: https://${currentWorkspace.subdomain}.tarai.space`, type: 'success' });
    } catch (e: any) {
      setAgentFeedback({ text: e.message || 'Failed to publish site.', type: 'error' });
    } finally {
      setExecuting(false);
    }
  };

  const getHints = () => {
    const list: { label: string; text: string }[] = [];
    
    const vert = detectedVertical || currentWorkspace?.vertical || 'general';
    const hasModule = (modName: string) => {
      if (activeModules.length > 0) {
        return activeModules.includes(modName);
      }
      if (vert === 'restaurant' || vert === 'bakery' || vert === 'retail') {
        return modName === 'inventory' || modName === 'orders';
      }
      if (vert === 'services' || vert === 'salon' || vert === 'clinic' || vert === 'gym') {
        return modName === 'bookings' || modName === 'crm';
      }
      return modName === 'inventory' || modName === 'documents';
    };

    const hasStorefront = hasModule('inventory') || hasModule('orders') || hasModule('bookings');

    if (hasStorefront) {
      list.push({ label: 'Show Site', text: 'show site' });
      list.push({ label: 'Publish Site', text: 'publish site' });
    }

    if (hasModule('inventory')) {
      list.push({ label: 'Menu', text: 'show products' });
    }
    if (hasModule('orders')) {
      list.push({ label: 'Orders', text: 'show orders' });
    }
    if (hasModule('bookings')) {
      list.push({ label: 'Bookings', text: 'show bookings' });
    }
    if (hasModule('crm')) {
      list.push({ label: 'Leads', text: 'show crm leads' });
    }
    if (hasModule('expenses')) {
      list.push({ label: 'Expenses', text: 'show expenses' });
    }
    
    return list;
  };

  if (loadingWorkspaces) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  // Handle case where user has no workspaces created
  if (workspaces.length === 0) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background, paddingHorizontal: 32 }]}>
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyTitle, { color: theme.text }]}>Welcome to tar.</Text>
          <Text style={[styles.emptySubtitle, { color: theme.textMuted }]}>
            Create a workspace to start managing your storefront with agentic AI.
          </Text>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => router.push('/add-workspace')}
            style={[styles.emptyButton, { backgroundColor: theme.primary }]}
          >
            <Ionicons name="add" size={20} color="#ffffff" style={{ marginRight: 4 }} />
            <Text style={styles.emptyButtonText}>Create Workspace</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.container, { backgroundColor: theme.background }]}
    >
      {/* Header with Switcher */}
      <View style={[styles.header, { paddingTop: insets.top + 8, borderBottomColor: theme.border }]}>
        <Pressable 
          onPress={() => setShowDropdown(true)} 
          style={[
            styles.switcherChip,
            { backgroundColor: theme.background, borderColor: theme.border + '80' }
          ]}
        >
          <WorkspaceThumbnail name={currentWorkspace?.name || currentWorkspace?.subdomain || ''} size={24} theme={theme} />
          <Text style={[styles.switcherText, { color: theme.text }]} numberOfLines={1}>
            {currentWorkspace?.name || currentWorkspace?.subdomain}
          </Text>
        </Pressable>

        <View style={{ flex: 1 }} />

        <Pressable onPress={() => setShowInfo(true)} style={styles.headerTextButton}>
          <Text style={[styles.headerTextButtonLabel, { color: theme.primary }]}>Skills</Text>
        </Pressable>
      </View>

      {/* Results Scroll Area */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.resultsArea}
        contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
      >
        {/* 1. Live Site Status Widget */}
        {draft && (
          <SiteCard
            storeName={currentWorkspace?.name || currentWorkspace?.subdomain || ''}
            subdomain={currentWorkspace?.subdomain || ''}
            layout={draft}
            isDirty={true}
            onPublish={handlePublishFromCard}
          />
        )}

        <View style={{ height: 12 }} />

        {loadingCanvas ? (
          <View style={{ paddingVertical: 40, alignItems: 'center' }}>
            <ActivityIndicator size="small" color={theme.primary} />
            <Text style={{ color: theme.textMuted, fontSize: 13, marginTop: 8 }}>
              Generating custom branded canvas...
            </Text>
          </View>
        ) : designTokens && canvasLayouts.length > 0 ? (
          <WorkspaceCanvas
            designTokens={designTokens}
            layouts={canvasLayouts}
            onExecuteAction={async (actionName, params) => {
              if (currentWorkspace?.scope) {
                const res = await tar.executeAITask(actionName, params, currentWorkspace.scope);
                // Refresh records after action is performed
                await refreshProducts(currentWorkspace.scope);
                await refreshOrders(currentWorkspace.scope);
                return res;
              }
              throw new Error('No active workspace scope');
            }}
            metricsData={{
              'orders': orders.length,
              'inventory': products.length,
              'bookings': orders.filter(o => o.type === 'booking').length
            }}
            tableData={{
              'orders': orders,
              'inventory': products
            }}
          />
        ) : (
          <>
            {/* 2. Inventory Section */}
            <ProductListCard products={products} />

            <View style={{ height: 12 }} />

            {/* 3. Recent Orders Section */}
            <OrderListCard orders={orders} />
          </>
        )}
      </ScrollView>

      {/* Input Section */}
      <View style={[styles.inputContainer, { borderTopColor: theme.border, backgroundColor: theme.background, paddingBottom: Platform.OS === 'ios' ? 12 : 24 }]}>
        {/* Agent Response Feedback Alert */}
        {agentFeedback && (
          <View style={[styles.feedbackContainer, { backgroundColor: theme.background, borderColor: theme.border, marginBottom: 12 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                <Ionicons 
                  name={agentFeedback.type === 'error' ? "alert-circle" : "sparkles"} 
                  size={15} 
                  color={agentFeedback.type === 'error' ? "#ff4d4f" : theme.primary} 
                />
                <Text style={[
                  styles.feedbackTitle, 
                  { 
                    color: agentFeedback.type === 'error' ? "#ff4d4f" : theme.text, 
                    marginLeft: 6 
                  }
                ]}>
                  {agentFeedback.type === 'error' ? "Error" : "Agent Response"}
                </Text>
              </View>
              <Pressable onPress={() => setAgentFeedback(null)} hitSlop={12}>
                <Ionicons name="close" size={18} color={theme.textMuted} />
              </Pressable>
            </View>
            <Text style={[styles.feedbackText, { color: theme.text }]}>
              {agentFeedback.text}
            </Text>
          </View>
        )}

        {/* Loading Spinner during execution */}
        {executing && (
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12, paddingHorizontal: 4 }}>
            <ActivityIndicator size="small" color={theme.primary} />
            <Text style={{ color: theme.textMuted, fontSize: 13, marginLeft: 8 }}>Agent executing action...</Text>
          </View>
        )}

        {/* Autocomplete chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.hintsContainer}>
          {getHints().map((hint, idx) => (
            <Pressable
              key={idx}
              onPress={() => handleSend(hint.text)}
              style={[styles.hintChip, { borderColor: theme.border, backgroundColor: theme.background, borderWidth: 1 }]}
            >
              <Text style={[styles.hintText, { color: theme.textSecondary }]}>{hint.label}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Text Input Bar */}
        <View style={[styles.textInputWrapper, { borderColor: theme.border, backgroundColor: theme.background, borderWidth: 1 }]}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Ask agent to add products, show orders, or build site..."
            placeholderTextColor={theme.textMuted}
            style={[styles.textInput, { color: theme.text }]}
            multiline={true}
            onSubmitEditing={() => handleSend()}
          />
          <Pressable
            onPress={() => handleSend()}
            style={[styles.sendButton, { backgroundColor: input.trim() ? theme.primary : theme.border }]}
            disabled={!input.trim()}
          >
            <Ionicons name="arrow-up" size={18} color="#ffffff" />
          </Pressable>
        </View>
      </View>

      {/* Workspace Switcher Dropdown Modal */}
      <Modal
        visible={showDropdown}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowDropdown(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setShowDropdown(false)}>
          <Pressable
            style={[
              styles.dropdownContent,
              {
                backgroundColor: theme.background,
                borderColor: theme.border,
                paddingBottom: Math.max(insets.bottom, 24)
              }
            ]}
            onPress={() => {}}
          >
            <View style={[styles.drawerHandle, { backgroundColor: theme.textMuted + '40' }]} />
            <View style={styles.dropdownHeader}>
              <Text style={[styles.dropdownTitle, { color: theme.text }]}>Switch Workspace</Text>
              <Pressable onPress={() => { setShowDropdown(false); router.push('/add-workspace'); }} style={styles.dropdownAddBtn}>
                <Ionicons name="add" size={20} color={theme.primary} />
              </Pressable>
            </View>

            <ScrollView style={{ maxHeight: 300 }}>
              {workspaces.map((w) => {
                const isActive = w.subdomain === currentWorkspace?.subdomain;
                const name = w.name || w.subdomain;
                return (
                  <Pressable
                    key={w.scope}
                    onPress={() => handleSelectWorkspace(w)}
                    style={({ pressed }) => [
                      styles.workspaceOption,
                      {
                        backgroundColor: isActive ? theme.border + '20' : 'transparent',
                        opacity: pressed ? 0.8 : 1
                      }
                    ]}
                  >
                    <WorkspaceThumbnail name={name} size={36} theme={theme} />
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={[styles.workspaceOptionName, { color: theme.text, fontWeight: isActive ? '700' : '500' }]}>
                        {name}
                      </Text>
                      <Text style={[styles.workspaceOptionSubdomain, { color: theme.textMuted }]}>
                        {w.subdomain}.tarai.space
                      </Text>
                    </View>
                    {isActive && (
                      <Ionicons name="checkmark" size={18} color={theme.primary} />
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
      {/* Workspace Details Info & AI Tools Full-Screen Modal */}
      <Modal
        visible={showInfo}
        transparent={false}
        animationType="slide"
        onRequestClose={() => setShowInfo(false)}
      >
        <View style={{ flex: 1, backgroundColor: theme.background, paddingTop: insets.top, paddingBottom: insets.bottom, paddingHorizontal: 16 }}>
          {/* Full Screen Header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border }}>
            <Pressable onPress={() => setShowInfo(false)} style={{ padding: 4 }}>
              <Ionicons name="close" size={26} color={theme.text} />
            </Pressable>
            <Text style={{ fontSize: 18, fontWeight: '700', color: theme.text }}>Workspace & AI Tools</Text>
            <View style={{ width: 26 }} />
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1, marginTop: 16 }}>
            {/* Info Section - Flat Design */}
            <View style={{ marginBottom: 24 }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: theme.primary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
                Workspace Information
              </Text>
              
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border }}>
                <Text style={{ fontSize: 14, color: theme.textSecondary }}>Scope ID</Text>
                <Text selectable style={{ fontSize: 14, color: theme.text, fontWeight: '500' }}>{currentWorkspace?.scope}</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border }}>
                <Text style={{ fontSize: 14, color: theme.textSecondary }}>Vertical</Text>
                <Text style={{ fontSize: 14, color: theme.text, fontWeight: '500', textTransform: 'capitalize' }}>{currentWorkspace?.vertical}</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border }}>
                <Text style={{ fontSize: 14, color: theme.textSecondary }}>Live Domain</Text>
                <Text selectable style={{ fontSize: 14, color: theme.primary, fontWeight: '500' }}>https://{currentWorkspace?.subdomain}.tarai.space</Text>
              </View>
            </View>

            {/* Tools Section Title */}
            <Text style={{ fontSize: 13, fontWeight: '700', color: theme.text, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4, marginTop: 12 }}>
              AI Agent Tools
            </Text>
            <Text style={{ color: theme.textMuted, fontSize: 13, marginBottom: 12 }}>
              Edit and run queries in real time to interact with your AI agent.
            </Text>

            {loadingIndex ? (
              <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                <ActivityIndicator size="small" color={theme.primary} />
                <Text style={{ color: theme.textMuted, fontSize: 13, marginTop: 8 }}>Reading S3 workspace blueprints...</Text>
              </View>
            ) : (
              getDynamicToolsList().map((cat: any, catIdx: number) => (
                <View key={catIdx} style={{ marginBottom: 24 }}>
                  {/* Flat category header */}
                  <Text style={{ fontSize: 13, fontWeight: '700', color: theme.primary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, marginTop: 12 }}>
                    {cat.category}
                  </Text>
                  
                  {cat.items.map((item: any, itemIdx: number) => {
                    const uniqueKey = `${cat.category}_${item.name}`;
                    const currentValue = editableQueries[uniqueKey] !== undefined ? editableQueries[uniqueKey] : item.example;

                    return (
                      <View 
                        key={itemIdx} 
                        style={{ 
                          paddingVertical: 14, 
                          borderBottomWidth: StyleSheet.hairlineWidth, 
                          borderBottomColor: theme.border 
                        }}
                      >
                        {/* Title & Description */}
                        <Text style={{ fontSize: 15, fontWeight: '600', color: theme.text }}>
                          {item.name}
                        </Text>
                        {item.desc ? (
                          <Text style={{ fontSize: 13, color: theme.textSecondary, marginTop: 2, marginBottom: 8 }}>
                            {item.desc}
                          </Text>
                        ) : null}
                        
                        {/* Dynamic editable input row */}
                        <View style={{ 
                          flexDirection: 'row', 
                          alignItems: 'center', 
                          backgroundColor: theme.backgroundElement, 
                          borderColor: theme.border, 
                          borderWidth: 1, 
                          borderRadius: 8, 
                          paddingHorizontal: 8,
                          height: 38
                        }}>
                          <TextInput
                            style={{ 
                              flex: 1, 
                              fontSize: 13, 
                              color: theme.text, 
                              paddingVertical: 0,
                              height: '100%'
                            }}
                            value={currentValue}
                            onChangeText={(text) => {
                              setEditableQueries(prev => ({
                                ...prev,
                                [uniqueKey]: text
                              }));
                            }}
                            placeholder="Enter command..."
                            placeholderTextColor={theme.textMuted}
                            autoCapitalize="none"
                            autoCorrect={false}
                          />
                          <TouchableOpacity
                            activeOpacity={0.7}
                            onPress={() => {
                              setShowInfo(false);
                              handleSend(currentValue);
                            }}
                            style={{ 
                              backgroundColor: theme.primary, 
                              paddingHorizontal: 12, 
                              paddingVertical: 4, 
                              borderRadius: 6,
                              justifyContent: 'center',
                              alignItems: 'center'
                            }}
                          >
                            <Text style={{ color: '#ffffff', fontSize: 12, fontWeight: '700' }}>Try</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })}
                </View>
              ))
            )}
          </ScrollView>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const WEBSITE_TOOLS = {
  category: 'Storefront Website',
  items: [
    {
      name: 'Generate Site',
      desc: 'Modifies the design layout or color scheme based on instructions.',
      example: 'make the website look like a luxury storefront',
    },
    {
      name: 'Preview Storefront',
      desc: 'Brings up the live storefront preview status card.',
      example: 'show site',
    },
    {
      name: 'Publish Website',
      desc: 'Deploys all local changes to the live web domain.',
      example: 'publish site',
    },
  ]
};

const MODULE_TOOLS_MAP: Record<string, {
  category: string;
  items: { name: string; desc: string; example: string }[];
}> = {
  inventory: {
    category: 'Inventory & Products',
    items: [
      {
        name: 'Add Product',
        desc: 'Creates a new product with custom price in the store database.',
        example: 'add chocolate muffin at 180',
      },
      {
        name: 'Show Inventory',
        desc: 'Fetches and displays the complete list of active products.',
        example: 'show products',
      },
    ]
  },
  orders: {
    category: 'Orders & Sales',
    items: [
      {
        name: 'Show Orders',
        desc: 'Fetches client orders list from the database.',
        example: 'show orders',
      },
    ]
  },
  bookings: {
    category: 'Bookings & Schedules',
    items: [
      {
        name: 'Show Bookings',
        desc: 'Lists scheduled customer appointments and bookings.',
        example: 'show bookings',
      },
    ]
  },
  crm: {
    category: 'Customer & Leads',
    items: [
      {
        name: 'View CRM Leads',
        desc: 'Displays active sales leads and customer contacts.',
        example: 'show crm leads',
      },
    ]
  },
  expenses: {
    category: 'Expenses & Finance',
    items: [
      {
        name: 'Track Expenses',
        desc: 'Lists tracked business expenses and financial records.',
        example: 'show expenses',
      },
    ]
  },
  reports: {
    category: 'Reports & Analytics',
    items: [
      {
        name: 'View Reports',
        desc: 'Summarizes sales performance and analytics reports.',
        example: 'show reports',
      },
    ]
  },
  documents: {
    category: 'Knowledge Base Documents',
    items: [
      {
        name: 'Semantic Query',
        desc: 'Performs natural language vector search on your workspace documents.',
        example: 'search sourdough',
      },
    ]
  }
};

function parseIndexMarkdown(md: string) {
  let vertical = 'general';
  let modules: string[] = [];

  const verticalMatch = md.match(/\*\*Vertical:\*\*\s*(.+)/i);
  if (verticalMatch) {
    vertical = verticalMatch[1].trim().toLowerCase();
  }

  const modulesMatch = md.match(/\*\*Modules:\*\*\s*(.+)/i);
  if (modulesMatch) {
    modules = modulesMatch[1]
      .split(',')
      .map(m => m.trim().toLowerCase())
      .filter(m => m.length > 0);
  }

  return { vertical, modules };
}

function cleanUserSays(phrase: string, actionId: string): string {
  let clean = phrase.split('/')[0].trim();
  
  const lowerClean = clean.toLowerCase();
  const lowerAction = actionId.toLowerCase();
  
  if (lowerAction.includes('booking') && (lowerClean === 'book' || lowerClean === 'reserve')) {
    return 'book a table';
  }
  if (lowerAction.includes('reschedule') && lowerClean === 'reschedule') {
    return 'reschedule booking';
  }
  if (lowerAction.includes('create') && lowerClean === 'add') {
    return 'add product';
  }
  if (lowerClean.endsWith('for')) {
    return clean + ' 4 people';
  }
  if (lowerClean.endsWith('at')) {
    return clean + ' 150';
  }
  
  return clean;
}

function parseModuleMarkdown(filename: string, content: string) {
  // Find title and clean it up (e.g. "Inventory module" -> "Inventory Skill")
  let categoryName = filename.charAt(0).toUpperCase() + filename.slice(1) + ' Skill';
  const h1Match = content.match(/^#\s*(.+)$/m);
  if (h1Match) {
    categoryName = h1Match[1].trim();
  }
  categoryName = categoryName.replace(/module/i, 'Skill');

  const lines = content.split('\n');
  const actionMap: Record<string, { name: string; desc: string; example: string }> = {};
  const intents: Record<string, string> = {};

  // First pass: scan for table rows to find actions and intents
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('|')) continue;
    
    const cols = trimmed.split('|').map(c => c.trim()).filter(c => c.length > 0);
    // Ignore markdown dividers like |---|---|
    if (cols.some(c => c.startsWith('---') || c.startsWith('- -'))) continue;
    
    let actionId = '';
    let otherText = '';
    let isIntentRow = false;

    // Check if this row is from an Intent matching table or action definition
    for (let i = 0; i < cols.length; i++) {
      const col = cols[i];
      const cleanCol = col.replace(/[`"']/g, '').trim();
      if (cleanCol.startsWith('action_')) {
        actionId = cleanCol;
        otherText = cols[i === 0 ? 1 : 0] || '';
        break;
      }
    }

    if (actionId) {
      const cleanOther = otherText.replace(/[`"']/g, '').trim();
      
      // Determine if this is an intent row (contains queries or is in intent section)
      if (content.toLowerCase().indexOf('intent') !== -1 && 
          content.toLowerCase().indexOf(otherText.toLowerCase()) > content.toLowerCase().indexOf('intent')) {
        isIntentRow = true;
      } else if (cleanOther.includes('sold') || cleanOther.includes('value') || cleanOther.includes('worth') || cleanOther.includes('sales') || cleanOther.includes('low') || cleanOther.includes('expiring')) {
        isIntentRow = true;
      }

      if (isIntentRow) {
        intents[actionId] = cleanUserSays(otherText, actionId);
      } else {
        // Table-based action definition (like in inventory or orders)
        const displayName = actionId
          .replace('action_report_', '')
          .replace('action_', '')
          .split('_')
          .map(w => w.charAt(0).toUpperCase() + w.slice(1))
          .join(' ');
        
        actionMap[actionId] = {
          name: displayName,
          desc: cleanOther,
          example: intents[actionId] || ''
        };
      }
    }
  }

  // Second pass: scan for Header-based actions (like ### action_...)
  const actionBlocks = content.split(/###\s+/);
  for (let i = 1; i < actionBlocks.length; i++) {
    const block = actionBlocks[i];
    const blockLines = block.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    if (blockLines.length === 0) continue;
    
    const actionId = blockLines[0].replace(/[`"']/g, '').trim();
    if (!actionId.startsWith('action_')) continue;
    
    const desc = blockLines[1] || 'Execute ' + actionId;
    const displayName = actionId
      .replace('action_report_', '')
      .replace('action_', '')
      .split('_')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');

    actionMap[actionId] = {
      name: displayName,
      desc,
      example: intents[actionId] || ''
    };
  }

  // Third pass: if we have intents (like reports) but no action definitions yet, create them dynamically
  Object.entries(intents).forEach(([actionId, example]) => {
    if (!actionMap[actionId]) {
      const displayName = actionId
        .replace('action_report_', '')
        .replace('action_', '')
        .split('_')
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
        
      actionMap[actionId] = {
        name: displayName,
        desc: `Run the ${displayName.toLowerCase()} report query.`,
        example: example
      };
    }
  });

  // Consolidate list of actions
  const items = Object.entries(actionMap).map(([actionId, act]) => {
    let example = act.example || intents[actionId];
    if (!example) {
      const base = actionId.replace('action_report_', '').replace('action_', '').replace(/_/g, ' ');
      example = base;
    }
    return {
      name: act.name,
      desc: act.desc,
      example: example
    };
  });

  // Fallback if no actions found
  if (items.length === 0) {
    items.push({
      name: `View ${categoryName}`,
      desc: `Displays active records for ${categoryName.toLowerCase()}.`,
      example: `show ${filename}`
    });
  }

  return {
    category: categoryName,
    items
  };
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  switcherChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  switcherText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
    maxWidth: 160,
  },
  headerTextButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextButtonLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  resultsArea: {
    flex: 1,
  },
  loadingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'transparent',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  inputContainer: {
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  hintsContainer: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  hintChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hintText: {
    fontSize: 12,
    fontWeight: '600',
  },
  textInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 24,
    paddingLeft: 16,
    paddingRight: 8,
    paddingVertical: 6,
  },
  textInput: {
    flex: 1,
    fontSize: 14,
    maxHeight: 120,
    paddingVertical: 4,
  },
  sendButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
  },
  dropdownContent: {
    width: '100%',
    maxWidth: Platform.OS === 'web' ? 500 : '100%',
    alignSelf: 'center',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 20,
  },
  drawerHandle: {
    width: 38,
    height: 5,
    borderRadius: 2.5,
    alignSelf: 'center',
    marginBottom: 16,
  },
  dropdownHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.08)',
  },
  dropdownTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  dropdownAddBtn: {
    padding: 4,
  },
  workspaceOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 4,
  },
  workspaceOptionName: {
    fontSize: 15,
  },
  workspaceOptionSubdomain: {
    fontSize: 12,
    marginTop: 2,
  },
  modalContent: {
    width: '90%',
    maxWidth: 400,
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
    textAlign: 'center',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  infoLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'right',
  },
  modalCloseButton: {
    marginTop: 20,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalCloseText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  emptyButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  toolsCategory: {
    marginTop: 16,
    marginBottom: 8,
  },
  toolsCategoryTitle: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  toolCard: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
  },
  toolName: {
    fontSize: 14,
    fontWeight: '600',
  },
  toolDesc: {
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  toolExampleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 8,
    borderRadius: 6,
    marginTop: 8,
    borderWidth: 1,
  },
  toolExampleText: {
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    fontSize: 11,
    flex: 1,
    marginRight: 8,
  },
  toolTryBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 4,
  },
  toolTryBtnText: {
    fontSize: 11,
    fontWeight: '600',
  },
  feedbackContainer: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  feedbackTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  feedbackText: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
});
