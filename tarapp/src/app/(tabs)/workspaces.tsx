import { useState, useEffect, useCallback, useRef } from 'react';
import { StyleSheet, View, Text, Pressable, ScrollView, TextInput, ActivityIndicator, Modal, Platform, TouchableOpacity } from 'react-native';
import { KeyboardAwareScrollView, KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
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
import { buildModuleLayout, parseYamlFrontmatter, parseCanvasMarkdown } from '@/lib/layout-engine';
import { resolveIntent } from '@/lib/intent-resolver';
import { getCurrentUser } from '@/lib/auth';
import { filterModulesByRole } from '@/lib/role-filter';
import WorkspaceCanvas from '@/components/WorkspaceCanvas';
import LinearInboxList, { LinearInboxItem } from '@/components/LinearInboxList';
import { fetchInbox, markTaskDone } from '@/lib/inbox';
import AdBanner from '@/components/AdBanner';
import EventComposeModal from '@/components/EventComposeModal';
import EntityDetailsModal from '@/components/EntityDetailsModal';
import DirectoryModal from '@/components/DirectoryModal';

interface Workspace {
  scope: string;
  subdomain: string;
  role: string;
  name?: string;
  type?: string;
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

const BUSINESS_VERTICALS = [
  { id: 'business', label: 'General Business', icon: 'briefcase-outline' },
  { id: 'retail', label: 'Retail & Store', icon: 'cart-outline' },
  { id: 'restaurant', label: 'Restaurant & Cafe', icon: 'restaurant-outline' },
  { id: 'salon', label: 'Salon & Spa', icon: 'cut-outline' },
  { id: 'clinic', label: 'Clinic & Healthcare', icon: 'medical-outline' },
  { id: 'logistics', label: 'Logistics & Fleet', icon: 'car-outline' },
];

export const PLAN5_EVENT_MOTIONS = [
  { event: 'Sale', actionName: 'action_record_sale', whatHappened: 'Transaction completed', linksTo: 'Order', params: [{ name: 'items', type: 'text', required: true }, { name: 'payment_method', type: 'text', required: true }, { name: 'total', type: 'number', required: true }, { name: 'customer_id', type: 'text', required: false }] },
  { event: 'Refund', actionName: 'action_refund_order', whatHappened: 'Money returned', linksTo: 'Order', params: [{ name: 'order_id', type: 'text', required: true }, { name: 'amount', type: 'number', required: true }, { name: 'reason', type: 'text', required: false }] },
  { event: 'Status Change', actionName: 'action_update_status', whatHappened: 'State updated', linksTo: 'Any entity', params: [{ name: 'entity_id', type: 'text', required: true }, { name: 'status', type: 'text', required: true }] },
  { event: 'Booking', actionName: 'action_book_slot', whatHappened: 'Appointment made', linksTo: 'Booking', params: [{ name: 'service', type: 'text', required: true }, { name: 'date', type: 'text', required: true }, { name: 'slot', type: 'text', required: true }, { name: 'customer_id', type: 'text', required: false }] },
  { event: 'Cancel', actionName: 'action_cancel_booking', whatHappened: 'Booking cancelled', linksTo: 'Booking', params: [{ name: 'booking_id', type: 'text', required: true }, { name: 'reason', type: 'text', required: false }] },
  { event: 'Clock In', actionName: 'action_clock_in', whatHappened: 'Staff arrived', linksTo: 'Person', params: [{ name: 'staff_id', type: 'text', required: true }] },
  { event: 'Clock Out', actionName: 'action_clock_out', whatHappened: 'Staff left', linksTo: 'Person', params: [{ name: 'staff_id', type: 'text', required: true }] },
  { event: 'Tracking', actionName: 'action_update_tracking', whatHappened: 'Shipment updated', linksTo: 'Shipment', params: [{ name: 'shipment_id', type: 'text', required: true }, { name: 'status', type: 'text', required: true }, { name: 'location', type: 'text', required: false }] },
  { event: 'Delivered', actionName: 'action_complete_delivery', whatHappened: 'Shipment fulfilled', linksTo: 'Shipment', params: [{ name: 'shipment_id', type: 'text', required: true }, { name: 'recipient_signature', type: 'text', required: false }] },
  { event: 'Stage', actionName: 'action_update_deal_stage', whatHappened: 'Deal advanced', linksTo: 'Deal', params: [{ name: 'deal_id', type: 'text', required: true }, { name: 'stage', type: 'text', required: true }, { name: 'win_loss_reason', type: 'text', required: false }] },
  { event: 'Activity', actionName: 'action_log_activity', whatHappened: 'Call/meeting logged', linksTo: 'Deal, Person', params: [{ name: 'type', type: 'text', required: true }, { name: 'description', type: 'text', required: true }, { name: 'contact_id', type: 'text', required: false }, { name: 'deal_id', type: 'text', required: false }] },
  { event: 'Adjust', actionName: 'action_adjust_stock', whatHappened: 'Stock changed', linksTo: 'Product', params: [{ name: 'product_id', type: 'text', required: true }, { name: 'qty', type: 'number', required: true }, { name: 'reason', type: 'text', required: false }] },
  { event: 'Write Off', actionName: 'action_write_off', whatHappened: 'Stock removed', linksTo: 'Product', params: [{ name: 'product_id', type: 'text', required: true }, { name: 'qty', type: 'number', required: true }, { name: 'reason', type: 'text', required: false }] },
  { event: 'Expense', actionName: 'action_record_expense', whatHappened: 'Cost recorded', linksTo: 'Expense', params: [{ name: 'category', type: 'text', required: true }, { name: 'amount', type: 'number', required: true }, { name: 'description', type: 'text', required: false }, { name: 'date', type: 'text', required: false }] },
  { event: 'Assignment', actionName: 'action_create_task', whatHappened: 'Task assigned', linksTo: 'Project', params: [{ name: 'title', type: 'text', required: true }, { name: 'description', type: 'text', required: false }, { name: 'assignee_id', type: 'text', required: false }, { name: 'due_date', type: 'text', required: false }] },
];

export default function WorkspacesScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams();
  const paramSubdomain = typeof params.subdomain === 'string' ? params.subdomain : undefined;
  const paramCode = typeof params.code === 'string' ? params.code : undefined;
  const paramAction = typeof params.action === 'string' ? params.action : undefined;

  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null);
  const [loadingWorkspaces, setLoadingWorkspaces] = useState(true);

  const [sessionId] = useState(() => 'sess_' + Date.now());
  const [products, setProducts] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [agentFeedback, setAgentFeedback] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Auto-dismiss feedback toast after 4 seconds
  useEffect(() => {
    if (agentFeedback) {
      const timer = setTimeout(() => setAgentFeedback(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [agentFeedback]);
  const [input, setInput] = useState('');
  const [executing, setExecuting] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  
  // Dynamic workspace blueprints/modules
  const [loadingIndex, setLoadingIndex] = useState(false);
  const [activeModules, setActiveModules] = useState<string[]>([]);
  const [detectedVertical, setDetectedVertical] = useState('general');
  const [parsedToolsList, setParsedToolsList] = useState<any[]>([]);
  const [workspaceName, setWorkspaceName] = useState('');
  
  const [designTokens, setDesignTokens] = useState<any>(null);
  const [canvasLayouts, setCanvasLayouts] = useState<any[]>([]);
  const [canvasBlocks, setCanvasBlocks] = useState<any[]>([]);
  const [loadingCanvas, setLoadingCanvas] = useState(false);
  const [activeWidget, setActiveWidget] = useState<{ moduleName: string } | null>(null);
  const [isCreatingWorkspace, setIsCreatingWorkspace] = useState(false);
  const [newWsName, setNewWsName] = useState('');
  const [newWsCreating, setNewWsCreating] = useState(false);
  const [selectedVertical, setSelectedVertical] = useState<string>('business');
  const [selectedEntityDetails, setSelectedEntityDetails] = useState<any | null>(null);
  const [showDirectoryModal, setShowDirectoryModal] = useState(false);
  const [showCanvasModal, setShowCanvasModal] = useState(false);
  const [inboxTasks, setInboxTasks] = useState<LinearInboxItem[]>([]);
  const [loadingInbox, setLoadingInbox] = useState(false);
  const [allEntities, setAllEntities] = useState<any[]>([]);


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

  // Load workspace index.md and dynamic module files from S3 when workspace changes
  useEffect(() => {
    if (currentWorkspace?.scope) {
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

      Promise.all([
        tar.okf.readIndex(scope).catch(() => null),
        tar.okf.read(scope, 'team/members.md').catch(() => null),
        getCurrentUser().catch(() => null)
      ]).then(async ([indexRes, membersRes, currentUser]) => {
        if (indexRes && indexRes.content) {
          const { name, type, modules } = parseIndexMarkdown(indexRes.content);
          
          const userEmail = currentUser?.email || 'owner@gmail.com';
          const allowedModules = filterModulesByRole(userEmail, modules, membersRes?.content || null);

          try {
            const fetchedTools = await Promise.all(
              allowedModules.map(async (mod) => {
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

            workspaceToolsCache.current[scope] = {
              workspaceName: name || '',
              detectedVertical: type,
              activeModules: allowedModules,
              parsedToolsList: validTools
            };

            setDetectedVertical(type);
            setActiveModules(allowedModules);
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
          setDetectedVertical(currentWorkspace.type || 'business');
          setActiveModules([]);
          setParsedToolsList([]);
        }
      })
      .finally(() => {
        setLoadingIndex(false);
      });
    }
  }, [currentWorkspace?.scope]);

  // Fetch workspaces list on mount
  const fetchWorkspacesList = useCallback(async () => {
    setLoadingWorkspaces(true);
    try {
      const data = await tar.listWorkspaces();
      const list: Workspace[] = data.workspaces || [];
      setWorkspaces(list);

      if (list.length > 0) {
        // Prioritize route parameters (deep-linking), fallback to SecureStore
        const targetSub = paramSubdomain || await SecureStore.getItemAsync('active_workspace_subdomain').catch(() => null);
        const found = list.find((w) => w.subdomain === targetSub);
        if (found) {
          setCurrentWorkspace(found);
          if (paramSubdomain) {
            await SecureStore.setItemAsync('active_workspace_subdomain', paramSubdomain).catch(() => null);
          }
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
  }, [paramSubdomain]);

  useEffect(() => {
    fetchWorkspacesList();
  }, [fetchWorkspacesList]);

  // Handle native deep link account verification
  useEffect(() => {
    if (paramCode && currentWorkspace?.scope) {
      const scope = currentWorkspace.scope;
      getCurrentUser().then(async (user) => {
        if (user && user.email) {
          try {
            const membersRes = await tar.okf.read(scope, 'team/members.md');
            if (membersRes && membersRes.content) {
              const { frontmatter, markdownBody } = parseYamlFrontmatter(membersRes.content);
              const membersList = frontmatter.members || [];
              
              const memberIdx = membersList.findIndex((m: any) => String(m.code) === String(paramCode) && m.status === 'pending');
              if (memberIdx !== -1) {
                membersList[memberIdx].email = user.email;
                membersList[memberIdx].status = 'verified';
                delete membersList[memberIdx].code;
                
                const rolesYaml = Object.entries(frontmatter.roles || {})
                  .map(([r, skills]) => `  ${r}: [${(skills as any).join(', ')}]`)
                  .join('\n');
                
                const membersYaml = membersList
                  .map((m: any) => {
                    let lines = `  - email: "${m.email}"\n    role: "${m.role}"\n    status: "${m.status}"`;
                    if (m.platform) lines += `\n    platform: "${m.platform}"`;
                    if (m.channelId) lines += `\n    channelId: "${m.channelId}"`;
                    return lines;
                  })
                  .join('\n');

                const updatedYaml = `---
type: TeamConfiguration
title: Team Access & Channel Mappings
timestamp: ${new Date().toISOString()}
roles:
${rolesYaml}
members:
${membersYaml}
---
`;
                
                await tar.okf.edit(scope, 'team/members.md', updatedYaml + markdownBody);
                setAgentFeedback({ text: 'Successfully linked your chat channel account!', type: 'success' });
              } else {
                setAgentFeedback({ text: 'Invalid or expired linking code.', type: 'error' });
              }
            }
          } catch (err: any) {
            console.warn('[LinkVerification] Code verification failed:', err);
            setAgentFeedback({ text: err.message || 'Failed to link account.', type: 'error' });
          }
        }
      });
    }
  }, [paramCode, currentWorkspace?.scope]);

  const [newWsDesc, setNewWsDesc] = useState('');

  const closeCreateModal = useCallback(() => {
    setIsCreatingWorkspace(false);
    if (paramAction === 'new') {
      router.setParams({ action: undefined });
    }
  }, [paramAction, router]);

  const handleCreateInlineWorkspace = async () => {
    if (!newWsName.trim() || newWsCreating) return;
    setNewWsCreating(true);
    try {
      const name = newWsName.trim();
      const desc = newWsDesc.trim() || name;
      let slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30);
      if (!slug) {
        slug = `ws-${Date.now().toString(36)}`;
      }
      await tar.createWorkspace({
        name,
        subdomain: slug,
        description: desc,
        type: selectedVertical,
      });
      await SecureStore.setItemAsync('active_workspace_subdomain', slug).catch(() => null);
      setNewWsName('');
      setNewWsDesc('');
      closeCreateModal();
      await fetchWorkspacesList();
    } catch (err: any) {
      setAgentFeedback({ text: err.message || 'Failed to create workspace', type: 'error' });
    } finally {
      setNewWsCreating(false);
    }
  };

  // Update current workspace if the route parameter changes while screen is mounted
  useEffect(() => {
    if (paramSubdomain && workspaces.length > 0) {
      const found = workspaces.find((w) => w.subdomain === paramSubdomain);
      if (found && found.subdomain !== currentWorkspace?.subdomain) {
        setCurrentWorkspace(found);
        SecureStore.setItemAsync('active_workspace_subdomain', paramSubdomain).catch(() => null);
        setActiveWidget(null);
        setAgentFeedback(null);
      }
    }
  }, [paramSubdomain, workspaces]);

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
        scope
      });
      setProducts(result?.rows || []);
    } catch (e) {
      console.warn('[Workspace] Failed to fetch products:', e);
    }
  };

  const refreshOrders = async (scope: string) => {
    try {
      const result = await tar.tool('read', { table: 'matter', type: 'order', scope });
      if (result?.rows && result.rows.length > 0) {
        setOrders(result.rows);
      } else {
        const motionRes = await tar.tool('read', { table: 'motion', scope });
        setOrders(motionRes?.rows || []);
      }
    } catch (e) {
      console.warn('[Workspace] Failed to fetch orders:', e);
    }
  };

  const refreshEntities = async (scope: string) => {
    try {
      const result = await tar.tool('read', { table: 'matter', scope });
      setAllEntities(result?.rows || []);
    } catch (e) {
      console.warn('[Workspace] Failed to fetch directory entities:', e);
    }
  };

  const refreshInboxTasks = useCallback(async (scope: string) => {
    setLoadingInbox(true);
    try {
      // 1. Query Turso `inbox` table directly
      const inboxRes = await tar.tool('read', { table: 'inbox', scope }).catch(() => null);
      const dbInboxRows = (inboxRes?.rows || []).filter((r: any) => !r.status || r.status === 'open' || r.status === 'pending');

      if (dbInboxRows.length > 0) {
        setInboxTasks(dbInboxRows.map((t: any) => {
          let parsedData = t.data;
          if (typeof t.data === 'string') {
            try { parsedData = JSON.parse(t.data); } catch (e) { parsedData = t.data; }
          }
          let rawTitle = t.title || t.name || 'Inbox Event';
          if (rawTitle.startsWith('New Order:')) rawTitle = 'New Order';
          else if (rawTitle.startsWith('Appointment Booked:')) rawTitle = 'Appointment Booked';
          else if (rawTitle.includes('Low Stock Alert:')) {
            const m = rawTitle.match(/Low Stock Alert:\s*([^(]+)/i);
            if (m) rawTitle = `Low Stock Alert: ${m[1].trim()}`;
          }

          return {
            id: t.id,
            type: t.type || 'task',
            title: rawTitle,
            status: t.status || 'open',
            ref: t.ref,
            due: t.due,
            created_at: t.at ? new Date(t.at * (t.at > 1e10 ? 1 : 1000)).toISOString() : undefined,
            data: parsedData,
          };
        }));
        return;
      }

      // 2. Fallback to fetchInbox worker endpoint
      const fetched = await fetchInbox(scope).catch(() => []);
      if (fetched && fetched.length > 0) {
        setInboxTasks(fetched.map(t => ({
          id: t.id,
          type: t.event_type || 'task',
          title: t.title,
          status: t.status || 'open',
          created_at: t.created_at,
          data: t.event_data,
        })));
        return;
      }

      // 3. Fallback to open orders & stock alerts from matter table
      const res = await tar.tool('read', { table: 'matter', scope }).catch(() => null);
      const rows = res?.rows || [];
      const synthesized: LinearInboxItem[] = [];
      rows.filter((r: any) => r.type === 'order' && (r.status === 'open' || r.status === 'pending' || !r.status)).slice(0, 10).forEach((o: any, i: number) => {
        synthesized.push({
          id: o.id || `ibx_ord_${i}`,
          type: 'order',
          title: `Order #${o.id?.slice(-4) || i + 1} — ${o.title || o.name || 'Items'}`,
          status: o.status || 'open',
          created_at: o.created_at,
        });
      });
      rows.filter((r: any) => r.type === 'product' && (r.stock ?? 10) < 5).forEach((p: any, i: number) => {
        synthesized.push({
          id: p.id || `ibx_stk_${i}`,
          type: 'stock',
          title: `Low Stock Alert: ${p.title || p.name} (${p.stock ?? 0} remaining)`,
          status: 'open',
        });
      });
      setInboxTasks(synthesized);
    } catch (e) {
      console.warn('[Workspace] Failed to fetch inbox tasks:', e);
    } finally {
      setLoadingInbox(false);
    }
  }, []);

  // Load products, orders, entities, and inbox when workspace changes
  useEffect(() => {
    if (currentWorkspace?.scope) {
      const scope = currentWorkspace.scope;
      refreshProducts(scope);
      refreshOrders(scope);
      refreshEntities(scope);
      refreshInboxTasks(scope);
      setAgentFeedback(null);
      setActiveWidget(null);
    }
  }, [currentWorkspace?.scope]);

  // Load DESIGN.md + modules SKILL.md specs from S3 whenever workspace changes
  useEffect(() => {
    if (currentWorkspace?.scope) {
      const scope = currentWorkspace.scope;
      setLoadingCanvas(true);
      
      Promise.all([
        tar.okf.read(scope, 'DESIGN.md').catch(() => null),
        tar.okf.readIndex(scope).catch(() => null),
        tar.okf.read(scope, 'team/canvas.md').catch(() => null)
      ]).then(async ([designRes, indexRes, canvasRes]) => {
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
        
        let modulesList: string[] = [];
        if (indexRes && indexRes.content) {
          const { name, modules } = parseIndexMarkdown(indexRes.content);
          modulesList = modules;
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

        if (canvasRes && canvasRes.content) {
          try {
            const { blocks } = parseCanvasMarkdown(canvasRes.content);
            setCanvasBlocks(blocks);
          } catch (err) {
            console.warn('[Canvas] Failed to parse team/canvas.md:', err);
          }
        } else {
          const activeList = modulesList.length > 0 ? modulesList : ['orders', 'inventory', 'crm', 'reports'];
          const fallbackBlocks = activeList.map(mod => ({
            title: mod.charAt(0).toUpperCase() + mod.slice(1),
            type: mod === 'orders' || mod === 'transactions' ? 'pos-sale' : 'data-grid',
            props: { type: (mod === 'orders' || mod === 'transactions') ? 'order' : mod === 'inventory' ? 'product' : mod, mode: 'table' }
          }));
          setCanvasBlocks(fallbackBlocks);
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
    setActiveWidget(null);
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
      const workspaceType = currentWorkspace.type || 'business';

      // 1. Resolve Intent via in-memory intent resolver
      const resolved = resolveIntent(textToSend, activeModules);
      if (resolved.match) {
        if (resolved.action === 'clear') {
          setActiveWidget(null);
          setExecuting(false);
          setAgentFeedback({ text: resolved.feedbackText || 'Cleared active widgets.', type: 'success' });
          return;
        } else if (resolved.action === 'show_module' && resolved.moduleName) {
          if (resolved.moduleName === 'inventory') {
            await refreshProducts(scope);
          } else if (resolved.moduleName === 'orders') {
            await refreshOrders(scope);
          }
          setActiveWidget({ moduleName: resolved.moduleName });
          setExecuting(false);
          setAgentFeedback({ text: resolved.feedbackText || `Loaded ${resolved.moduleName} widget.`, type: 'success' });
          return;
        } else if (resolved.action === 'add_module' && resolved.moduleName) {
          await tar.canvas.add(scope, resolved.moduleName);
          const canvasRes = await tar.okf.read(scope, 'team/canvas.md').catch(() => null);
          if (canvasRes && canvasRes.content) {
            const { blocks } = parseCanvasMarkdown(canvasRes.content);
            setCanvasBlocks(blocks);
          }
          setActiveWidget({ moduleName: resolved.moduleName });
          setExecuting(false);
          setAgentFeedback({ text: resolved.feedbackText || `Added ${resolved.moduleName} skill to canvas.`, type: 'success' });
          return;
        } else if (resolved.action === 'remove_module' && resolved.moduleName) {
          await tar.canvas.remove(scope, resolved.moduleName);
          const canvasRes = await tar.okf.read(scope, 'team/canvas.md').catch(() => null);
          if (canvasRes && canvasRes.content) {
            const { blocks } = parseCanvasMarkdown(canvasRes.content);
            setCanvasBlocks(blocks);
          }
          if (activeWidget?.moduleName === resolved.moduleName) {
            setActiveWidget(null);
          }
          setExecuting(false);
          setAgentFeedback({ text: resolved.feedbackText || `Removed ${resolved.moduleName} skill from canvas.`, type: 'success' });
          return;
        }
      }

      if (/^(show|view|get)\s+(site|storefront|web|website)/i.test(cleanText)) {
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
        const newLayout = await generateSiteLayout(name, currentProducts, instruction, draft);
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
          setActiveWidget({ moduleName: 'inventory' });
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
          await refreshEntities(scope);
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
    if (action.moduleName) {
      setActiveWidget({ moduleName: action.moduleName });
    }
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
      console.log(`[Agent] Executing action "${actionName}" for scope: ${currentWorkspace?.scope}`);
      tar.executeAITask(actionName, {}, currentWorkspace?.scope!)
        .then(async (res) => {
          console.log(`[Agent] Action "${actionName}" completed successfully:`, res);
          // Refresh records
          if (currentWorkspace?.scope) {
            await refreshProducts(currentWorkspace.scope);
            await refreshOrders(currentWorkspace.scope);
            await refreshEntities(currentWorkspace.scope);
            await refreshInboxTasks(currentWorkspace.scope);
          }
        })
        .catch((err) => {
          console.error(`[Agent] Action "${actionName}" failed:`, err);
        })
        .finally(() => setExecuting(false));
    }
  };

  const handleActionFormSubmit = async (submittedParams?: Record<string, string>) => {
    if (!selectedAction || !currentWorkspace) return;
    setSubmittingAction(true);
    setActionResultMessage(null);
    try {
      const activeParams = submittedParams || formParams;
      const cleanParams: Record<string, any> = {};
      selectedAction.params.forEach((p: any) => {
        const paramName = typeof p === 'string' ? p : p.name;
        const paramType = typeof p === 'string' ? 'text' : p.type;
        const val = activeParams[paramName] || '';
        if (paramType === 'number') {
          cleanParams[paramName] = parseFloat(val) || 0;
        } else {
          cleanParams[paramName] = val;
        }
      });
      if (activeParams.notes) {
        cleanParams.notes = activeParams.notes;
        cleanParams.description = activeParams.notes;
      }

      // Direct entity & inbox creation fallback
      if (
        selectedAction.name === 'action_add_contact' ||
        selectedAction.name === 'action_add_company' ||
        selectedAction.name === 'action_add_product' ||
        selectedAction.name === 'create_entity'
      ) {
        const titleVal = cleanParams.name || cleanParams.title || cleanParams.to || 'New Entity';
        const typeVal = cleanParams.role || cleanParams.type || (selectedAction.name === 'action_add_company' ? 'company' : selectedAction.name === 'action_add_product' ? 'product' : 'customer');
        try {
          await tar.tool('create', {
            table: 'matter',
            type: typeVal,
            title: titleVal,
            value: cleanParams.value || cleanParams.price || 0,
            data: cleanParams,
            scope: currentWorkspace.scope,
          });
        } catch (errCreate) {
          console.warn('[Workspace] Fallback matter creation:', errCreate);
        }
      } else if (selectedAction.name === 'action_record_sale') {
        const titleVal = 'New Order';
        try {
          await tar.tool('create', {
            table: 'matter',
            type: 'order',
            title: titleVal,
            value: cleanParams.total || 0,
            data: cleanParams,
            scope: currentWorkspace.scope,
          });
          await tar.tool('create', {
            table: 'inbox',
            type: 'order',
            title: titleVal,
            status: 'open',
            data: cleanParams,
            scope: currentWorkspace.scope,
          });
        } catch (e) {
          console.warn('[Workspace] Direct sale creation fallback:', e);
        }
      } else if (selectedAction.name === 'action_adjust_stock' || selectedAction.name === 'action_write_off') {
        const titleVal = `Low Stock Alert: ${cleanParams.product_id || 'Product'}`;
        try {
          await tar.tool('create', {
            table: 'inbox',
            type: 'stock',
            title: titleVal,
            status: 'open',
            data: cleanParams,
            scope: currentWorkspace.scope,
          });
        } catch (e) {
          console.warn('[Workspace] Direct stock alert creation fallback:', e);
        }
      } else if (selectedAction.name === 'action_book_slot') {
        const titleVal = 'Appointment Booked';
        try {
          await tar.tool('create', {
            table: 'matter',
            type: 'booking',
            title: titleVal,
            data: cleanParams,
            scope: currentWorkspace.scope,
          });
          await tar.tool('create', {
            table: 'inbox',
            type: 'booking',
            title: titleVal,
            status: 'open',
            data: cleanParams,
            scope: currentWorkspace.scope,
          });
        } catch (e) {
          console.warn('[Workspace] Direct booking creation fallback:', e);
        }
      } else if (selectedAction.name === 'action_create_task') {
        const titleVal = cleanParams.title || 'New Task Assignment';
        try {
          await tar.tool('create', {
            table: 'inbox',
            type: 'task',
            title: titleVal,
            status: 'open',
            data: cleanParams,
            scope: currentWorkspace.scope,
          });
        } catch (e) {
          console.warn('[Workspace] Direct task creation fallback:', e);
        }
      }

      const res = await tar.executeAITask(selectedAction.name, cleanParams, currentWorkspace.scope);
      setActionResultMessage(res?.message || `Successfully recorded event: ${selectedAction.name.replace(/_/g, ' ')}`);
      
      // Refresh records after action is performed
      await refreshProducts(currentWorkspace.scope);
      await refreshOrders(currentWorkspace.scope);
      await refreshEntities(currentWorkspace.scope);
      await refreshInboxTasks(currentWorkspace.scope);

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
    const resultList = PLAN5_EVENT_MOTIONS.map((item) => ({
      label: item.event,
      subtitle: `${item.whatHappened} • ${item.linksTo}`,
      action: {
        name: item.actionName,
        purpose: item.whatHappened,
        params: item.params,
      },
    }));

    if (!input.trim()) return resultList;

    const query = input.trim().toLowerCase();
    return resultList.filter(
      (h) =>
        h.label.toLowerCase().includes(query) ||
        h.subtitle.toLowerCase().includes(query) ||
        h.action.name.toLowerCase().includes(query)
    );
  };

  if (loadingWorkspaces) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  // Determine if workspace creation modal should be visible
  const showCreateModal = isCreatingWorkspace || paramAction === 'new' || (workspaces.length === 0 && !loadingWorkspaces);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <KeyboardAvoidingView
        style={{ flex: 1, paddingTop: insets.top }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Main Content — scrollable with keyboard */}
        <KeyboardAwareScrollView
          ref={scrollViewRef}
          style={{ flex: 1 }}
          contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 12, paddingTop: 12, paddingBottom: 16 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
        >
        {/* Top Sponsored Ad Banner */}
        <AdBanner />

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
        ) : activeWidget ? (
          (() => {
            const effectiveTokens = designTokens || {
              colors: { primary: theme.primary || '#0f172a', secondary: '#3b82f6', background: '#ffffff' },
              rounded: { sm: 8, md: 12, lg: 16 },
              spacing: { sm: 8, md: 16 },
              typography: {}
            };
            const modName = activeWidget.moduleName.toLowerCase();
            let widgetBlocks = canvasBlocks.filter(
              b => b.props?.type === modName || b.type === modName || b.title?.toLowerCase() === modName
            );
            let widgetLayouts = canvasLayouts.filter(l => l.moduleName.toLowerCase() === modName);

            if (widgetBlocks.length === 0 && widgetLayouts.length === 0) {
              if (['directory', 'crm', 'entity-directory', 'plan5-directory', 'people', 'companies', 'items'].includes(modName)) {
                widgetBlocks = [{ title: 'Entity Directory', type: 'entity-directory', props: {} }];
              } else if (['explore', 'explore-feed'].includes(modName)) {
                widgetBlocks = [{ title: 'Explore Public Workspaces', type: 'explore-feed', props: {} }];
              } else if (modName === 'orders') {
                widgetBlocks = [{ title: 'Orders & POS', type: 'pos-sale', props: { type: 'order' } }];
              } else if (modName === 'inventory') {
                widgetBlocks = [{ title: 'Product Catalog', type: 'catalog-grid', props: { type: 'product' } }];
              } else {
                widgetBlocks = [{ title: activeWidget.moduleName.toUpperCase(), type: 'data-grid', props: { type: activeWidget.moduleName } }];
              }
            }

            return (
              <WorkspaceCanvas
                designTokens={effectiveTokens}
                blocks={widgetBlocks}
                layouts={widgetLayouts}
                onExecuteAction={async (actionName, params) => {
                  if (actionName === 'view_entity' && params?.entity) {
                    setSelectedEntityDetails(params.entity);
                    return { success: true };
                  }
                  if (actionName.startsWith('action_add_') || actionName === 'create_entity') {
                    handleTriggerAction({
                      name: actionName,
                      params: [
                        { name: 'name', type: 'text', required: true },
                        { name: 'role', type: 'text', required: true },
                        { name: 'company', type: 'text', required: false },
                        { name: 'value', type: 'number', required: false },
                      ],
                    });
                    setFormParams({
                      role: params?.category || 'person',
                    });
                    return { success: true };
                  }
                  if (currentWorkspace?.scope) {
                    const res = await tar.executeAITask(actionName, params, currentWorkspace.scope);
                    await refreshProducts(currentWorkspace.scope);
                    await refreshOrders(currentWorkspace.scope);
                    await refreshEntities(currentWorkspace.scope);
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
                  'inventory': products,
                  'order': orders,
                  'product': products,
                  'directory': allEntities,
                  'entity-directory': allEntities,
                  'plan5-directory': allEntities
                }}
              />
            );
          })()
        ) : (
          <LinearInboxList
            tasks={inboxTasks}
            loading={loadingInbox}
            onToggleDone={async (taskId) => {
              setInboxTasks(prev => prev.filter(t => t.id !== taskId));
              if (currentWorkspace?.scope) {
                await tar.tool('update', { table: 'inbox', id: taskId, status: 'done', scope: currentWorkspace.scope }).catch(() => null);
                await markTaskDone(currentWorkspace.scope, taskId).catch(() => null);
              }
            }}
            onSelectTask={(item) => {
              if (item.data?.entity) {
                setSelectedEntityDetails(item.data.entity);
              }
            }}
          />
        )}
      </KeyboardAwareScrollView>

      {/* Input Section — confined to bottom right */}
      <View style={[styles.inputContainer, { borderTopColor: 'transparent', paddingBottom: Math.max(insets.bottom + 4, 16) }]}>




        {/* Autocomplete chips when input is empty with quick action icons at start */}
        {!input.trim() ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.hintsContainer} contentContainerStyle={{ alignItems: 'center' }}>
            {/* Directory Quick Action Icon */}
            <Pressable
              onPress={() => setShowDirectoryModal(true)}
              style={({ pressed }) => [{
                paddingHorizontal: 8,
                paddingVertical: 6,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: showDirectoryModal ? theme.primary : theme.border,
                backgroundColor: showDirectoryModal ? theme.primary + '20' : theme.backgroundElement,
                marginRight: 6,
                opacity: pressed ? 0.7 : 1,
              }]}
            >
              <Ionicons
                name={activeWidget?.moduleName === 'directory' ? 'folder' : 'folder-outline'}
                size={16}
                color={activeWidget?.moduleName === 'directory' ? theme.primary : theme.textSecondary}
              />
            </Pressable>

            {/* Explore Quick Action Icon */}
            <Pressable
              onPress={() => setActiveWidget({ moduleName: 'explore' })}
              style={({ pressed }) => [{
                paddingHorizontal: 8,
                paddingVertical: 6,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: activeWidget?.moduleName === 'explore' ? theme.primary : theme.border,
                backgroundColor: activeWidget?.moduleName === 'explore' ? theme.primary + '20' : theme.backgroundElement,
                marginRight: 6,
                opacity: pressed ? 0.7 : 1,
              }]}
            >
              <Ionicons
                name={activeWidget?.moduleName === 'explore' ? 'compass' : 'compass-outline'}
                size={16}
                color={activeWidget?.moduleName === 'explore' ? theme.primary : theme.textSecondary}
              />
            </Pressable>

            {/* Canvas Quick Action Icon */}
            <Pressable
              onPress={() => setShowCanvasModal(true)}
              style={({ pressed }) => [{
                paddingHorizontal: 8,
                paddingVertical: 6,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: showCanvasModal ? theme.primary : theme.border,
                backgroundColor: showCanvasModal ? theme.primary + '20' : theme.backgroundElement,
                marginRight: 10,
                opacity: pressed ? 0.7 : 1,
              }]}
            >
              <Ionicons
                name={showCanvasModal ? 'easel' : 'easel-outline'}
                size={16}
                color={showCanvasModal ? theme.primary : theme.textSecondary}
              />
            </Pressable>

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
            {getFilteredActions().slice(0, 5).map((hint, idx) => (
              <TouchableOpacity
                key={idx}
                style={{
                  paddingVertical: 10,
                  paddingHorizontal: 12,
                  borderBottomWidth: idx < getFilteredActions().slice(0, 5).length - 1 ? StyleSheet.hairlineWidth : 0,
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
                  {hint.subtitle && (
                    <Text style={{ fontSize: 11, color: theme.textMuted, marginTop: 1 }} numberOfLines={1}>
                      {hint.subtitle}
                    </Text>
                  )}
                </View>
                <Ionicons name="arrow-forward-outline" size={14} color={theme.textMuted} />
              </TouchableOpacity>
            ))}
          </View>
        ) : null}

        {/* Text Input Bar */}
        <View style={[styles.textInputWrapper, { borderColor: theme.border, backgroundColor: theme.background, borderWidth: 1, alignItems: 'center', flexDirection: 'row' }]}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Ask anything..."
            placeholderTextColor={theme.textMuted}
            style={[styles.textInput, { color: theme.text, flex: 1 }]}
            multiline={true}
            onSubmitEditing={() => handleSend()}
          />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingRight: 4 }}>
            {/* Send Button */}
            <Pressable
              onPress={() => handleSend()}
              style={[styles.sendButton, { backgroundColor: input.trim() ? theme.primary : theme.border }]}
              disabled={!input.trim()}
            >
              <Ionicons name="arrow-up" size={18} color="#ffffff" />
            </Pressable>
          </View>
        </View>

        {/* Bottom Bar Controls: Workspace Selector */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', marginTop: 8 }}>
          <Pressable
            onPress={() => setShowDropdown(true)}
            style={[
              styles.switcherChip,
              { backgroundColor: theme.background, borderColor: theme.border, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, marginLeft: 12 }
            ]}
          >
            <WorkspaceThumbnail name={workspaceName || currentWorkspace?.subdomain || ''} size={20} theme={theme} />
            <Text style={[styles.switcherText, { color: theme.text, fontSize: 12, marginLeft: 6 }]} numberOfLines={1}>
              {workspaceName || (currentWorkspace?.subdomain ? currentWorkspace.subdomain.charAt(0).toUpperCase() + currentWorkspace.subdomain.slice(1) : '')}
            </Text>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>

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
              <Pressable onPress={() => { setShowDropdown(false); setIsCreatingWorkspace(true); }} style={styles.dropdownAddBtn}>
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

      {/* Full Screen Workspace Canvas GenUI Modal */}
      <Modal
        visible={showCanvasModal}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setShowCanvasModal(false)}
      >
        <View style={{ flex: 1, backgroundColor: theme.background, paddingTop: insets.top }}>
          {/* Canvas Modal Header */}
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 16,
            paddingVertical: 12,
            borderBottomWidth: 1,
            borderBottomColor: theme.border,
            backgroundColor: theme.background,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <WorkspaceThumbnail name={currentWorkspace?.name || currentWorkspace?.subdomain || 'Canvas'} size={32} theme={theme} />
              <View>
                <Text style={{ fontSize: 16, fontWeight: '700', color: theme.text }}>
                  Workspace Canvas
                </Text>
                <Text style={{ fontSize: 12, color: theme.textMuted }}>
                  {currentWorkspace?.subdomain || 'Dynamic GenUI Layout'}
                </Text>
              </View>
            </View>

            <Pressable
              onPress={() => setShowCanvasModal(false)}
              style={({ pressed }) => [{
                padding: 6,
                borderRadius: 20,
                backgroundColor: theme.backgroundElement,
                opacity: pressed ? 0.7 : 1,
              }]}
            >
              <Ionicons name="close" size={22} color={theme.text} />
            </Pressable>
          </View>

          {/* Canvas GenUI Content */}
          <ScrollView contentContainerStyle={{ padding: 12 }}>
            <WorkspaceCanvas
              designTokens={designTokens || {
                colors: { primary: theme.primary || '#0f172a', secondary: '#3b82f6', background: '#ffffff' },
                rounded: { sm: 8, md: 12, lg: 16 },
                spacing: { sm: 8, md: 16 },
                typography: {}
              }}
              blocks={canvasBlocks}
              layouts={canvasLayouts}
              onExecuteAction={async (actionName, params) => {
                if (actionName === 'view_entity' && params?.entity) {
                  setSelectedEntityDetails(params.entity);
                  return { success: true };
                }
                if (actionName.startsWith('action_add_') || actionName === 'create_entity') {
                  handleTriggerAction({
                    name: actionName,
                    params: [
                      { name: 'name', type: 'text', required: true },
                      { name: 'role', type: 'text', required: true },
                      { name: 'company', type: 'text', required: false },
                      { name: 'value', type: 'number', required: false },
                    ],
                  });
                  setFormParams({
                    role: params?.category || 'person',
                  });
                  return { success: true };
                }
                if (currentWorkspace?.scope) {
                  const res = await tar.executeAITask(actionName, params, currentWorkspace.scope);
                  await refreshProducts(currentWorkspace.scope);
                  await refreshOrders(currentWorkspace.scope);
                  await refreshEntities(currentWorkspace.scope);
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
                'inventory': products,
                'order': orders,
                'product': products,
                'directory': allEntities,
                'entity-directory': allEntities,
                'plan5-directory': allEntities
              }}
            />
          </ScrollView>
        </View>
      </Modal>

      {/* Create Workspace Modal — Minimal Clean Style */}
      <Modal
        visible={showCreateModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          if (workspaces.length > 0) closeCreateModal();
        }}
      >
        <Pressable 
          style={styles.modalBackdrop} 
          onPress={() => {
            if (workspaces.length > 0) closeCreateModal();
          }}
        >
          <Pressable
            style={[
              styles.dropdownContent,
              {
                backgroundColor: theme.background,
                borderColor: theme.border,
                paddingBottom: Math.max(insets.bottom + 16, 32),
                paddingHorizontal: 20,
              }
            ]}
            onPress={() => {}}
          >
            <View style={[styles.drawerHandle, { backgroundColor: theme.textMuted + '30', marginBottom: 12 }]} />
            
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: theme.text }}>New Workspace</Text>
              {workspaces.length > 0 && (
                <Pressable onPress={closeCreateModal} hitSlop={12}>
                  <Ionicons name="close" size={20} color={theme.textMuted} />
                </Pressable>
              )}
            </View>

            <TextInput
              style={{
                height: 44,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: theme.border,
                paddingHorizontal: 14,
                fontSize: 15,
                color: theme.text,
                backgroundColor: theme.backgroundElement,
                marginBottom: 14,
              }}
              value={newWsName}
              onChangeText={setNewWsName}
              placeholder="Workspace Name"
              placeholderTextColor={theme.textMuted}
              autoFocus
            />

            {/* Business Vertical Selector */}
            <Text style={{ fontSize: 13, fontWeight: '600', color: theme.textSecondary, marginBottom: 8 }}>
              Business Vertical
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
              {BUSINESS_VERTICALS.map((vert) => {
                const selected = selectedVertical === vert.id;
                return (
                  <Pressable
                    key={vert.id}
                    onPress={() => setSelectedVertical(vert.id)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                      paddingHorizontal: 12,
                      paddingVertical: 7,
                      borderRadius: 16,
                      borderWidth: 1,
                      borderColor: selected ? theme.primary : theme.border,
                      backgroundColor: selected ? theme.primary + '15' : 'transparent',
                    }}
                  >
                    <Ionicons
                      name={vert.icon as any}
                      size={14}
                      color={selected ? theme.primary : theme.textSecondary}
                    />
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: selected ? '600' : '400',
                        color: selected ? theme.primary : theme.textSecondary,
                      }}
                    >
                      {vert.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={handleCreateInlineWorkspace}
              disabled={!newWsName.trim() || newWsCreating}
              style={{
                height: 44,
                borderRadius: 10,
                backgroundColor: newWsName.trim() ? theme.primary : theme.border,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {newWsCreating ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={{ color: newWsName.trim() ? '#ffffff' : theme.textMuted, fontSize: 15, fontWeight: '600' }}>
                  Create
                </Text>
              )}
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>


      {/* Full-Screen Gmail Mobile App Style Event Compose Modal */}
      <EventComposeModal
        visible={selectedAction !== null}
        action={selectedAction}
        formParams={formParams}
        theme={theme}
        submitting={submittingAction}
        resultMessage={actionResultMessage}
        allEntities={allEntities}
        onClose={() => {
          setSelectedAction(null);
          setFormParams({});
          setActionResultMessage(null);
        }}
        onSubmit={(submittedParams) => {
          handleActionFormSubmit(submittedParams);
        }}
        onSelectEvent={(newAction) => {
          handleTriggerAction(newAction);
        }}
      />

      {/* Full-Screen Entity Details Modal */}
      <EntityDetailsModal
        visible={selectedEntityDetails !== null}
        entity={selectedEntityDetails}
        scope={currentWorkspace?.scope}
        theme={theme}
        onClose={() => setSelectedEntityDetails(null)}
        onRefresh={async () => {
          if (currentWorkspace?.scope) {
            await refreshProducts(currentWorkspace.scope);
            await refreshOrders(currentWorkspace.scope);
            await refreshEntities(currentWorkspace.scope);
          }
        }}
        onLogEventForEntity={(ent) => {
          setSelectedEntityDetails(null);
          handleTriggerAction({
            name: 'action_record_sale',
            params: [
              { name: 'customer_id', type: 'text', required: true },
              { name: 'total', type: 'number', required: true },
              { name: 'items', type: 'text', required: true },
              { name: 'payment_method', type: 'text', required: true },
            ],
          });
          setFormParams({
            customer_id: ent.name || ent.id || '',
            items: ent.name || ent.id || '',
          });
        }}
      />

      {/* Standalone Full-Screen Directory Modal (Free from Canvas) */}
      <DirectoryModal
        visible={showDirectoryModal}
        scope={currentWorkspace?.scope}
        theme={theme}
        onClose={() => setShowDirectoryModal(false)}
        onSelectEntity={(entity) => {
          setSelectedEntityDetails(entity);
        }}
        onAddNewEntity={(category) => {
          const actionName = category === 'people' ? 'action_add_contact' : category === 'companies' ? 'action_add_company' : 'action_add_product';
          handleTriggerAction({
            name: actionName,
            params: [
              { name: 'name', type: 'text', required: true },
              { name: 'role', type: 'text', required: true },
              { name: 'email', type: 'text', required: false },
              { name: 'phone', type: 'text', required: false },
            ],
          });
          setFormParams({
            role: category === 'people' ? 'Customer' : category === 'companies' ? 'Company' : 'Product',
          });
        }}
      />
    </View>
  );
}


function parseIndexMarkdown(md: string) {
  let name = '';
  let type = 'business';
  let modules: string[] = [];

  const nameMatch = md.match(/^#\s*(.+)$/m);
  if (nameMatch) {
    name = nameMatch[1].trim();
  }

  const typeMatch = md.match(/\*\*Type:\*\*\s*(.+)/i);
  if (typeMatch) {
    type = typeMatch[1].trim().toLowerCase();
  }

  const modulesMatch = md.match(/\*\*Modules:\*\*\s*(.+)/i);
  if (modulesMatch) {
    modules = modulesMatch[1]
      .split(',')
      .map(m => m.trim().toLowerCase())
      .filter(m => m.length > 0);
  }

  return { name, type, modules };
}

function buildGitHubSentence(
  action: any,
  formParams: Record<string, string>,
  theme: any,
  activeChipField: string | null,
  onChange: (field: string, val: string) => void,
  setActive: (field: string | null) => void,
  inputRef: React.RefObject<TextInput | null>
): React.ReactNode {
  if (!action?.params || action.params.length === 0) {
    return <Text style={{ color: theme.text, fontSize: 16 }}>{action?.name?.replace(/_/g, ' ') || 'action'}</Text>;
  }

  const parts: React.ReactNode[] = [];
  const actionName = action.name?.replace(/_/g, ' ') || 'action';

  parts.push(<Text key="action" style={{ color: theme.text, fontSize: 18, lineHeight: 34 }}>{actionName}</Text>);

  const connectors = [' with ', ' for ', ' using ', ' to '];

  action.params.forEach((p: any, idx: number) => {
    const paramName = typeof p === 'string' ? p : p.name;
    const hasValue = formParams[paramName]?.trim();
    const displayName = paramName.replace(/_/g, ' ');
    const isActive = activeChipField === paramName;
    const connector = connectors[idx % connectors.length];

    parts.push(<Text key={`conn-${idx}`} style={{ color: theme.text, fontSize: 18, lineHeight: 34 }}>{connector}</Text>);

    if (isActive) {
      parts.push(
        <TextInput
          key={`chip-${paramName}`}
          ref={inputRef}
          style={{
            color: theme.text,
            backgroundColor: theme.primary + '25',
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: 10,
            fontSize: 17,
            fontWeight: '600',
            minWidth: 80,
            marginVertical: 4,
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
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: 10,
            fontSize: 17,
            fontWeight: '600',
            marginVertical: 4,
            overflow: 'hidden',
          }}
        >
          {hasValue ? formParams[paramName] : displayName}
        </Text>
      );
    }
  });

  parts.push(<Text key="end" style={{ color: theme.text, fontSize: 18, lineHeight: 34 }}>.</Text>);

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
    width: '100%',
    paddingHorizontal: 0,
    paddingTop: 8,
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
    paddingVertical: 12,
    marginHorizontal: 12,
  },
  textInput: {
    flex: 1,
    fontSize: 14,
    maxHeight: 120,
    paddingVertical: 4,
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
    height: '60%',
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
  // ── Welcome Placeholder Card ─────────────────────────────────────
  welcomeCard: {
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    marginVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 180,
  },
  welcomeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  welcomeTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  welcomeSubtitle: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 16,
  },
});

