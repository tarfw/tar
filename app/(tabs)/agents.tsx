import React, { useEffect, useRef, useState } from 'react';
import { Text, View, TextInput, TouchableOpacity, StyleSheet, Modal, ScrollView, Dimensions, NativeSyntheticEvent, NativeScrollEvent, LayoutChangeEvent, StatusBar } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

export default function Agents() {
  const [isAgentSelectorVisible, setIsAgentSelectorVisible] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState('products');
  const [viewAgentId, setViewAgentId] = useState('products');
  const [searchText, setSearchText] = useState('');
  const sampleScrollRef = useRef<ScrollView | null>(null);
  const tabsScrollRef = useRef<ScrollView | null>(null);
  const [tabsContentWidth, setTabsContentWidth] = useState(0);
  const [tabLayouts, setTabLayouts] = useState<Record<string, { x: number; width: number }>>({});
  const windowWidth = Dimensions.get('window').width;
  const samplePageWidth = windowWidth - 40;

  const agents = [
    {
      id: 'sales',
      name: 'Sales',
      icon: '📈',
      samples: ['Revenue summary', 'Top opportunities', 'Pipeline at risk', 'Regional leaderboard'],
    },
    {
      id: 'orders',
      name: 'Orders',
      icon: '🛒',
      samples: ['Order #4832', 'Order #5921', 'Order #6103', 'Order #7018'],
    },
    {
      id: 'products',
      name: 'Products',
      icon: '🛍️',
      samples: ['Product Alpha', 'Product Sigma', 'Product Echo', 'Product Delta'],
    },
    {
      id: 'items',
      name: 'Items',
      icon: '📦',
      samples: ['Item K21-B', 'Item R04-C', 'Item Q88', 'Item L10'],
    },
    {
      id: 'stores',
      name: 'Stores',
      icon: '🎈',
      samples: ['Store Downtown', 'Store Uptown', 'Store Westside', 'Store Riverside'],
    },
    {
      id: 'files',
      name: 'Files',
      icon: '📁',
      samples: ['Q1 Report.pdf', 'SupplierContract.docx', 'OnboardingChecklist.md', 'BrandGuidelines.pptx'],
    },
  ];

  const handleAgentSelect = (agentId: string) => {
    setSelectedAgentId(agentId);
    setViewAgentId(agentId);
    setIsAgentSelectorVisible(false);
  };

  const filteredAgents = agents.filter(agent => agent.name.toLowerCase().includes(searchText.toLowerCase()));
  const hasViewAgent = filteredAgents.some(agent => agent.id === viewAgentId);
  const effectiveViewAgentId = hasViewAgent ? viewAgentId : filteredAgents[0]?.id;
  const selectedAgent = agents.find(agent => agent.id === selectedAgentId);

  useEffect(() => {
    if (!sampleScrollRef.current || !filteredAgents.length) return;
    const index = filteredAgents.findIndex(agent => agent.id === effectiveViewAgentId);
    if (index >= 0) {
      sampleScrollRef.current.scrollTo({ x: index * samplePageWidth, animated: true });
    }
  }, [effectiveViewAgentId, filteredAgents, samplePageWidth]);

  useEffect(() => {
    if (!tabsScrollRef.current) return;
    const layout = effectiveViewAgentId ? tabLayouts[effectiveViewAgentId] : undefined;
    if (!layout) return;
    const containerWidth = windowWidth;
    const desiredOffset = layout.x - (containerWidth - layout.width) / 2;
    const maxOffset = Math.max(0, tabsContentWidth - containerWidth);
    const clamped = Math.max(0, Math.min(desiredOffset, maxOffset));
    tabsScrollRef.current.scrollTo({ x: clamped, animated: true });
  }, [effectiveViewAgentId, tabLayouts, tabsContentWidth, windowWidth]);

  const handleTabLayout = (id: string) => (event: LayoutChangeEvent) => {
    const { x, width } = event.nativeEvent.layout;
    setTabLayouts(prev => {
      if (prev[id] && prev[id].x === x && prev[id].width === width) {
        return prev;
      }
      return { ...prev, [id]: { x, width } };
    });
  };

  const handleSampleScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / samplePageWidth);
    const next = filteredAgents[index];
    if (next && next.id !== effectiveViewAgentId) {
      setViewAgentId(next.id);
    }
  };

  useEffect(() => {
    if (isAgentSelectorVisible) {
      StatusBar.setHidden(true, 'slide');
    } else {
      StatusBar.setHidden(false, 'slide');
    }

    return () => {
      StatusBar.setHidden(false, 'slide');
    };
  }, [isAgentSelectorVisible]);

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text>Agents Screen</Text>
      </View>

      {/* AI Chat Input Container */}
      <View style={styles.inputBarContainer}>
        <View style={styles.inputBar}>
          <TouchableOpacity
            style={styles.leadingButton}
            onPress={() => {
              setViewAgentId(selectedAgentId);
              setIsAgentSelectorVisible(true);
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.agentText}>{selectedAgent?.icon}</Text>
          </TouchableOpacity>

          <TextInput
            style={styles.textInput}
            placeholder="Ask anything"
            placeholderTextColor="#9ca3af"
          />

          <TouchableOpacity style={styles.iconButton}>
            <MaterialIcons name="graphic-eq" size={20} color="#6b7280" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Agent Selector Modal */}
      <Modal
        visible={isAgentSelectorVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsAgentSelectorVisible(false)}
      >
        <View style={styles.fullscreenOverlay}>
          <View style={styles.modalContainer}>
          <View style={styles.modalInputBar}>
            <TextInput
              style={styles.modalTextInput}
              placeholder="Search agents..."
              placeholderTextColor="#9ca3af"
              value={searchText}
              onChangeText={setSearchText}
            />
            <TouchableOpacity style={styles.modalIconButton} activeOpacity={0.7}>
              <MaterialIcons name="qr-code-scanner" size={20} color="#4b5563" />
            </TouchableOpacity>
          </View>

          <View style={styles.modalContent}>
            <View style={styles.tabsWrapper}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                ref={tabsScrollRef}
                contentContainerStyle={styles.tabsRow}
                onContentSizeChange={(contentWidth) => setTabsContentWidth(contentWidth)}
              >
                {filteredAgents.map((item) => {
                  const isActive = effectiveViewAgentId === item.id;
                  const isSelected = selectedAgentId === item.id;
                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={styles.tabButton}
                      onPress={() => setViewAgentId(item.id)}
                      activeOpacity={0.7}
                      onLayout={handleTabLayout(item.id)}
                    >
                      <View style={styles.tabContent}>
                        <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                          {item.icon} {item.name}
                        </Text>
                        {isSelected && (
                          <MaterialIcons name="check-circle" size={16} color="#6366f1" style={styles.tabCheck} />
                        )}
                      </View>
                      <View style={[styles.tabIndicator, isActive && styles.tabIndicatorActive]} />
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            <View style={styles.sampleSection}>
              {filteredAgents.length ? (
                <ScrollView
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  ref={sampleScrollRef}
                  onMomentumScrollEnd={handleSampleScrollEnd}
                  contentContainerStyle={styles.samplePager}
                >
                  {filteredAgents.map((agent) => (
                    <View key={agent.id} style={[styles.samplePage, { width: samplePageWidth }]}> 
                      {agent.samples.map((sample) => (
                        <TouchableOpacity
                          key={sample}
                          style={styles.sampleListItem}
                          onPress={() => handleAgentSelect(agent.id)}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.sampleBullet}>•</Text>
                          <Text style={styles.sampleText}>{sample}</Text>
                        </TouchableOpacity>
                      ))}
                      {!agent.samples.length && (
                        <Text style={styles.sampleEmpty}>No suggestions available</Text>
                      )}
                    </View>
                  ))}
                </ScrollView>
              ) : (
                <Text style={styles.sampleEmpty}>No agents found</Text>
              )}
            </View>
          </View>
        </View>
      </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inputBarContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: 16,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    paddingHorizontal: 24,
    paddingVertical: 16,
    minHeight: 68,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: '#1f2937',
    paddingVertical: 6,
  },
  iconButton: {
    marginLeft: 16,
    padding: 8,
  },
  agentText: {
    fontSize: 16,
    color: '#4b5563',
  },
  leadingButton: {
    marginRight: 12,
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
  },
  fullscreenOverlay: {
    flex: 1,
    backgroundColor: 'white',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'white',
    paddingTop: 0,
  },
  modalInputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    paddingHorizontal: 20,
    paddingVertical: 20,
    minHeight: 64,
  },
  modalTextInput: {
    flex: 1,
    fontSize: 16,
    color: '#1f2937',
    paddingVertical: 0,
  },
  modalIconButton: {
    marginLeft: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  tabsWrapper: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  tabsRow: {
    flexDirection: 'row',
    gap: 24,
    paddingRight: 24,
  },
  tabButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  tabContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tabText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#6b7280',
  },
  tabTextActive: {
    color: '#6366f1',
  },
  tabCheck: {
    marginLeft: 2,
  },
  tabIndicator: {
    marginTop: 8,
    height: 3,
    width: '100%',
    borderRadius: 999,
    backgroundColor: 'transparent',
  },
  tabIndicatorActive: {
    backgroundColor: '#6366f1',
  },
  sampleSection: {
    flex: 1,
    paddingVertical: 20,
  },
  samplePager: {
    flexGrow: 1,
  },
  samplePage: {
    paddingRight: 20,
  },
  sampleListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  sampleBullet: {
    fontSize: 18,
    color: '#6366f1',
    width: 24,
  },
  sampleText: {
    fontSize: 16,
    color: '#1f2937',
  },
  sampleEmpty: {
    fontSize: 16,
    color: '#9ca3af',
  },
});
