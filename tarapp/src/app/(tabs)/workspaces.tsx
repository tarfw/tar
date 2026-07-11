import { useState, useEffect, useCallback, useRef } from 'react';
import { StyleSheet, View, Text, Pressable, ScrollView, TextInput, ActivityIndicator, Modal, Platform, TouchableOpacity } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
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
  const [workspaceName, setWorkspaceName] = useState('');
  
  const [designTokens, setDesignTokens] = useState<any>(null);
  const [canvasLayouts, setCanvasLayouts] = useState<any[]>([]);
  const [loadingCanvas, setLoadingCanvas] = useState(false);

  const [selectedAction, setSelectedAction] = useState<any | null>(null);
  const [formParams, setFormParams] = useState<Record<string, string>>({});
  const [submittingAction, setSubmittingAction] = useState(false);
  const [actionResultMessage, setActionResultMessage] = useState<string | null>(null);
  const [activeChipField, setActiveChipField] = useState<string | null>(null);
  const chipInputRef = useRef<TextInput>(null);

  const hasAnyValue = selectedAction?.params?.some((p: any) => {
    const paramName = typeof p === 'string' ? p : p.name;
    return formParams[paramName]?.trim();
  }) ?? false;

  const scrollViewRef = useRef<any>(null);
  const workspaceToolsCache = useRef<Record<string, { workspaceName: string; detectedVertical: string; activeModules: string[]; parsedToolsList: any[] }>>({});

  useEffect(() => {
    if (currentWorkspace) {
      setWorkspaceName(currentWorkspace.subdomain ? currentWorkspace.subdomain.charAt(0).toUpperCase() + currentWorkspace.subdomain.slice(1) : '');
    } else {
      setWorkspaceName('');
    }
  }, [currentWorkspace]);
  
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
        if (cached.workspaceName) {
          setWorkspaceName(cached.workspaceName);
        }
        setLoadingIndex(false);
      } else {
        // First-time loading indicator
        setLoadingIndex(true);
      }

      tar.okf.readIndex(scope)
        .then(async (res: any) => {
          if (res && res.content) {
            const { name, vertical, modules } = parseIndexMarkdown(res.content);

            // Fetch each module's markdown content in parallel
            try {
              const fetchedTools = await Promise.all(
                modules.map(async (mod) => {
                  try {
                    const fileRes = await tar.okf.read(scope, `skills/${mod}.md`);
                    if (fileRes && fileRes.content) {
                      return parseModuleMarkdown(mod, fileRes.content);
                    }
                  } catch (e) {
                    console.warn(`[OKF] Failed to fetch module skills/${mod}.md:`, e);
                  }
                  return null;
                })
              );
              
              const validTools = fetchedTools.filter(t => t !== null) as any[];

              // Update cache
              workspaceToolsCache.current[scope] = {
                workspaceName: name || '',
                detectedVertical: vertical,
                activeModules: modules,
                parsedToolsList: validTools
              };

              // Update states
              setDetectedVertical(vertical);
              setActiveModules(modules);
              setParsedToolsList(validTools);
              if (name) {
                setWorkspaceName(name);
              }
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
          const { name, modules } = parseIndexMarkdown(indexRes.content);
          if (name) {
            setWorkspaceName(name);
          }
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

  const handleTriggerAction = (action: any) => {
    if (action.params && action.params.length > 0) {
      const initialParams: Record<string, string> = {};
      action.params.forEach((p: any) => {
        const paramName = typeof p === 'string' ? p : p.name;
        initialParams[paramName] = '';
      });
      setFormParams(initialParams);
      setSelectedAction(action);
      setActionResultMessage(null);
    } else {
      // Execute directly
      setExecuting(true);
      const actionName = action.name || action.actionId;
      tar.executeAITask(actionName, {}, currentWorkspace?.scope!)
        .then(async (res) => {
          alert(`Successfully executed ${actionName.replace(/_/g, ' ')}`);
          // Refresh records
          if (currentWorkspace?.scope) {
            await refreshProducts(currentWorkspace.scope);
            await refreshOrders(currentWorkspace.scope);
          }
        })
        .catch((err) => {
          alert(`Error: ${err.message}`);
        })
        .finally(() => setExecuting(false));
    }
  };

  const handleActionFormSubmit = async () => {
    if (!selectedAction || !currentWorkspace) return;
    setSubmittingAction(true);
    setActionResultMessage(null);
    try {
      const cleanParams: Record<string, any> = {};
      selectedAction.params.forEach((p: any) => {
        const paramName = typeof p === 'string' ? p : p.name;
        const paramType = typeof p === 'string' ? 'text' : p.type;
        const val = formParams[paramName] || '';
        if (paramType === 'number') {
          cleanParams[paramName] = parseFloat(val) || 0;
        } else {
          cleanParams[paramName] = val;
        }
      });

      const res = await tar.executeAITask(selectedAction.name, cleanParams, currentWorkspace.scope);
      setActionResultMessage(res?.message || `Successfully executed ${selectedAction.name.replace(/_/g, ' ')}`);
      
      // Refresh records after action is performed
      await refreshProducts(currentWorkspace.scope);
      await refreshOrders(currentWorkspace.scope);

      setTimeout(() => {
        setSelectedAction(null);
        setFormParams({});
        setActionResultMessage(null);
      }, 1500);
    } catch (err: any) {
      setActionResultMessage(`Error: ${err.message || 'Execution failed'}`);
    } finally {
      setSubmittingAction(false);
    }
  };

  const getFilteredActions = () => {
    const resultList: any[] = [];
    
    // Dynamic actions from layouts
    canvasLayouts.forEach(layout => {
      if (layout && layout.actions) {
        Object.values(layout.actions).forEach((action: any) => {
          if (!action || !action.name) return;
          // Label is clean name: e.g. "Record Sale"
          const cleanName = action.name
            .replace('action_report_', '')
            .replace('action_', '')
            .split('_')
            .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
            .join(' ');
          
          if (!resultList.some(r => r.label === cleanName)) {
            resultList.push({
              label: cleanName,
              action: action
            });
          }
        });
      }
    });
    
    if (!input.trim()) return resultList;
    
    const query = input.toLowerCase();
    return resultList.filter(h => 
      h.label.toLowerCase().includes(query) ||
      (h.text && h.text.toLowerCase().includes(query)) ||
      (h.action && h.action.name.toLowerCase().includes(query))
    );
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
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header with Switcher */}
      <View style={[styles.header, { paddingTop: insets.top + 8, borderBottomColor: theme.border }]}>
        <Pressable
          onPress={() => setShowDropdown(true)}
          style={[
            styles.switcherChip,
            { backgroundColor: theme.background, borderColor: theme.border + '80' }
          ]}
        >
          <WorkspaceThumbnail name={workspaceName || currentWorkspace?.subdomain || ''} size={24} theme={theme} />
          <Text style={[styles.switcherText, { color: theme.text }]} numberOfLines={1}>
            {workspaceName || (currentWorkspace?.subdomain ? currentWorkspace.subdomain.charAt(0).toUpperCase() + currentWorkspace.subdomain.slice(1) : '')}
          </Text>
        </Pressable>

        <View style={{ flex: 1 }} />

        <Pressable onPress={() => setShowInfo(true)} style={styles.headerTextButton}>
          <Text style={[styles.headerTextButtonLabel, { color: theme.primary }]}>Skills</Text>
        </Pressable>
      </View>

      {/* Main Content — scrollable with keyboard */}
      <KeyboardAwareScrollView
        ref={scrollViewRef}
        style={{ flex: 1 }}
        contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 12, paddingTop: 12, paddingBottom: 8 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        bottomOffset={80}
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

        {/* Input Section — inside scroll view for keyboard avoidance */}
        <View style={[styles.inputContainer, { borderTopColor: theme.border, backgroundColor: theme.background, paddingBottom: 4 }]}>
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

        {/* Autocomplete chips when input is empty */}
        {!input.trim() ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.hintsContainer}>
            {getFilteredActions().map((hint, idx) => (
              <Pressable
                key={idx}
                onPress={() => {
                  if (hint.action) {
                    handleTriggerAction(hint.action);
                  } else if (hint.text) {
                    handleSend(hint.text);
                  }
                }}
                style={[styles.hintChip, { borderColor: theme.border, backgroundColor: theme.backgroundElement, borderWidth: 1 }]}
              >
                <Text style={[styles.hintText, { color: theme.textSecondary }]}>{hint.label}</Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : getFilteredActions().length > 0 ? (
          <View style={{
            backgroundColor: theme.backgroundElement,
            borderColor: theme.border,
            borderWidth: 1,
            borderRadius: 12,
            marginBottom: 8,
            marginHorizontal: 12,
            padding: 4,
          }}>
            <Text style={{ fontSize: 10, fontWeight: '700', color: theme.textMuted, paddingHorizontal: 12, paddingVertical: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Suggested Actions
            </Text>
            {getFilteredActions().slice(0, 3).map((hint, idx) => (
              <TouchableOpacity
                key={idx}
                style={{
                  paddingVertical: 10,
                  paddingHorizontal: 12,
                  borderBottomWidth: idx < getFilteredActions().slice(0, 3).length - 1 ? StyleSheet.hairlineWidth : 0,
                  borderBottomColor: theme.border,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
                onPress={() => {
                  setInput('');
                  if (hint.action) {
                    handleTriggerAction(hint.action);
                  } else if (hint.text) {
                    handleSend(hint.text);
                  }
                }}
              >
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={{ fontSize: 13, color: theme.text, fontWeight: '600' }} numberOfLines={1}>
                    {hint.label}
                  </Text>
                  {hint.action && (
                    <Text style={{ fontSize: 11, color: theme.textMuted, marginTop: 1 }} numberOfLines={1}>
                      {hint.action.purpose || `Execute ${hint.action.name}`}
                    </Text>
                  )}
                </View>
                <Ionicons name="arrow-forward-outline" size={14} color={theme.textMuted} />
              </TouchableOpacity>
            ))}
          </View>
        ) : null}

        {/* Text Input Bar */}
        <View style={[styles.textInputWrapper, { borderColor: theme.border, backgroundColor: theme.background, borderWidth: 1 }]}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Ask anything..."
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
      </KeyboardAwareScrollView>

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
          {/* Full Screen Header */}
          <View style={{ 
            flexDirection: 'row', 
            alignItems: 'flex-start', 
            justifyContent: 'space-between',
            paddingVertical: 16, 
            borderBottomWidth: StyleSheet.hairlineWidth, 
            borderBottomColor: theme.border 
          }}>
            <View style={{ flex: 1, marginRight: 16 }}>
              <Text numberOfLines={1} style={{ fontSize: 26, fontWeight: '900', color: theme.text, letterSpacing: -0.5 }}>
                {workspaceName || (currentWorkspace?.subdomain ? currentWorkspace.subdomain.charAt(0).toUpperCase() + currentWorkspace.subdomain.slice(1) : '')}
              </Text>
              <Text numberOfLines={1} style={{ fontSize: 11, color: theme.textMuted, marginTop: 4, textTransform: 'uppercase', fontWeight: '600' }}>
                {currentWorkspace?.vertical} • {currentWorkspace?.scope}
              </Text>
            </View>
            
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
              <Ionicons name="globe-outline" size={15} color={theme.primary} style={{ marginRight: 5 }} />
              <Text selectable style={{ fontSize: 13, color: theme.primary, fontWeight: '600' }}>
                {currentWorkspace?.subdomain}.tarai.space
              </Text>
            </View>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1, marginTop: 16 }}>
            {/* Skills Section */}
            <Text style={{ fontSize: 13, fontWeight: '700', color: theme.primary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>
              Workspace Skills
            </Text>

            {loadingIndex ? (
              <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                <ActivityIndicator size="small" color={theme.primary} />
                <Text style={{ color: theme.textMuted, fontSize: 13, marginTop: 8 }}>Loading workspace skills...</Text>
              </View>
            ) : parsedToolsList.length === 0 ? (
              <View style={{ paddingVertical: 24, alignItems: 'center' }}>
                <Text style={{ color: theme.textMuted, fontSize: 14 }}>No skills installed in this workspace.</Text>
              </View>
            ) : (
              parsedToolsList.map((skill: any, idx: number) => {
                const title = skill.category.replace(/\s+Skill$/i, '').replace(/\s+Module$/i, '');
                return (
                  <View 
                    key={idx} 
                    style={{ 
                      marginBottom: 16,
                      padding: 16,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: theme.border,
                      backgroundColor: theme.backgroundElement
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                      <Ionicons 
                        name={
                          title.toLowerCase().includes('crm') ? 'person-outline' :
                          title.toLowerCase().includes('logistics') ? 'car-outline' :
                          title.toLowerCase().includes('booking') ? 'calendar-outline' :
                          title.toLowerCase().includes('inventory') ? 'cube-outline' :
                          title.toLowerCase().includes('order') ? 'receipt-outline' :
                          title.toLowerCase().includes('report') ? 'bar-chart-outline' :
                          title.toLowerCase().includes('document') ? 'document-text-outline' :
                          title.toLowerCase().includes('expense') ? 'wallet-outline' :
                          'extension-puzzle-outline'
                        } 
                        size={20} 
                        color={theme.primary} 
                        style={{ marginRight: 8 }}
                      />
                      <Text style={{ fontSize: 16, fontWeight: '700', color: theme.text }}>
                        {title}
                      </Text>
                    </View>
                    
                    {skill.items && skill.items.length > 0 ? (
                      skill.items.map((action: any, actionIdx: number) => (
                        <View 
                          key={actionIdx} 
                          style={{ 
                            paddingVertical: 8, 
                            borderTopWidth: actionIdx > 0 ? StyleSheet.hairlineWidth : 0, 
                            borderTopColor: theme.border 
                          }}
                        >
                          <Text style={{ fontSize: 14, fontWeight: '600', color: theme.textSecondary }}>
                            {action.name}
                          </Text>
                          <Text style={{ fontSize: 12, color: theme.textMuted, marginTop: 2 }}>
                            {action.desc}
                          </Text>
                        </View>
                      ))
                    ) : (
                      <Text style={{ fontSize: 12, color: theme.textMuted }}>No actions defined.</Text>
                    )}
                  </View>
                );
              })
            )}
          </ScrollView>
        </View>
      </Modal>

      {/* Dynamic Action Modal — GitHub notification style */}
      <Modal visible={selectedAction !== null} transparent={true} animationType="slide">
        <View style={styles.githubModalOverlay}>
          <View style={[styles.githubModalContainer, { backgroundColor: theme.background }]}>
            {/* Handle bar */}
            <View style={styles.githubHandleBarContainer}>
              <View style={styles.githubHandleBar} />
            </View>

            {/* Header */}
            <View style={styles.githubModalHeader}>
              <TouchableOpacity onPress={() => setSelectedAction(null)} disabled={submittingAction} hitSlop={12}>
                <Ionicons name="chevron-down" size={24} color={theme.textMuted} />
              </TouchableOpacity>
              <Text style={[styles.githubModalTitle, { color: theme.text }]}>
                {selectedAction?.name?.replace(/_/g, ' ') || 'Action'}
              </Text>
              <View style={{ width: 24 }} />
            </View>

            {/* Sentence with inline chips */}
            <View style={styles.githubModalBody}>
              {buildGitHubSentence(selectedAction, formParams, theme, activeChipField, (field, val) => {
                setFormParams(prev => ({ ...prev, [field]: val }));
              }, setActiveChipField, chipInputRef)}
            </View>

            {/* Submit — text button */}
            <View style={[styles.githubSubmitRow, { borderTopColor: theme.border, paddingBottom: Math.max(insets.bottom, 24) + 8 }]}>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={handleActionFormSubmit}
                disabled={submittingAction || !hasAnyValue}
              >
                {submittingAction ? (
                  <ActivityIndicator color={theme.primary} size="small" />
                ) : (
                  <Text style={[styles.githubSubmitText, { color: hasAnyValue ? theme.primary : theme.border }]}>
                    submit
                  </Text>
                )}
              </TouchableOpacity>
            </View>

            {actionResultMessage && (
              <View style={[styles.githubResultBanner, { backgroundColor: actionResultMessage.includes('Error') ? '#fef2f2' : '#f0fdf4', marginBottom: insets.bottom }]}>
                <Text style={{ fontSize: 13, color: actionResultMessage.includes('Error') ? '#dc2626' : '#16a34a', textAlign: 'center' }}>
                  {actionResultMessage}
                </Text>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}


function parseIndexMarkdown(md: string) {
  let name = '';
  let vertical = 'general';
  let modules: string[] = [];

  const nameMatch = md.match(/^#\s*(.+)$/m);
  if (nameMatch) {
    name = nameMatch[1].trim();
  }

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

  return { name, vertical, modules };
}

function buildGitHubSentence(
  action: any,
  formParams: Record<string, string>,
  theme: any,
  activeChipField: string | null,
  onChange: (field: string, val: string) => void,
  setActive: (field: string | null) => void,
  inputRef: React.RefObject<TextInput>
): React.ReactNode {
  if (!action?.params || action.params.length === 0) {
    return <Text style={{ color: theme.text, fontSize: 16 }}>{action?.name?.replace(/_/g, ' ') || 'action'}</Text>;
  }

  const parts: React.ReactNode[] = [];
  const actionName = action.name?.replace(/_/g, ' ') || 'action';

  parts.push(<Text key="action" style={{ color: theme.text, fontSize: 16 }}>{actionName}</Text>);

  const connectors = [' with ', ' for ', ' using ', ' to '];

  action.params.forEach((p: any, idx: number) => {
    const paramName = typeof p === 'string' ? p : p.name;
    const hasValue = formParams[paramName]?.trim();
    const displayName = paramName.replace(/_/g, ' ');
    const isActive = activeChipField === paramName;
    const connector = connectors[idx % connectors.length];

    parts.push(<Text key={`conn-${idx}`} style={{ color: theme.text, fontSize: 16 }}>{connector}</Text>);

    if (isActive) {
      parts.push(
        <TextInput
          key={`chip-${paramName}`}
          ref={inputRef}
          style={{
            color: theme.text,
            backgroundColor: theme.primary + '20',
            paddingHorizontal: 10,
            paddingVertical: 4,
            borderRadius: 8,
            fontSize: 16,
            fontWeight: '600',
            minWidth: 60,
            borderBottomWidth: 2,
            borderBottomColor: theme.primary,
          }}
          value={formParams[paramName]}
          onChangeText={val => onChange(paramName, val)}
          placeholder={displayName}
          placeholderTextColor={theme.textMuted + '80'}
          autoFocus
          onBlur={() => setActive(null)}
          returnKeyType="next"
        />
      );
    } else {
      parts.push(
        <Text
          key={`chip-${paramName}`}
          onPress={() => {
            setActive(paramName);
          }}
          style={{
            color: hasValue ? '#fff' : theme.textMuted,
            backgroundColor: hasValue ? theme.primary : theme.backgroundElement,
            paddingHorizontal: 10,
            paddingVertical: 4,
            borderRadius: 8,
            fontSize: 16,
            fontWeight: '600',
            overflow: 'hidden',
          }}
        >
          {hasValue ? formParams[paramName] : displayName}
        </Text>
      );
    }
  });

  parts.push(<Text key="end" style={{ color: theme.text, fontSize: 16 }}>.</Text>);

  return parts;
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
    paddingHorizontal: 0,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  hintsContainer: {
    flexDirection: 'row',
    marginBottom: 8,
    paddingHorizontal: 12,
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
    paddingVertical: 14,
    marginHorizontal: 12,
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    maxHeight: 140,
    paddingVertical: 8,
  },
  sendButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  formInput: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
  },
  submitBtn: {
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  // ── Action Modal — GitHub notification style ────────────────────
  githubModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  githubModalContainer: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '60%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 20,
  },
  githubHandleBarContainer: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 4,
  },
  githubHandleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  githubModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
  },
  githubModalTitle: {
    fontSize: 16,
    fontWeight: '700',
    textTransform: 'capitalize',
    letterSpacing: -0.3,
  },
  githubModalBody: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  githubSubmitRow: {
    alignItems: 'flex-end',
    paddingHorizontal: 24,
    paddingTop: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  githubSubmitText: {
    fontSize: 15,
    fontWeight: '600',
  },
  githubResultBanner: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    marginHorizontal: 24,
    borderRadius: 10,
  },
});
