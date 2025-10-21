import React, { useEffect, useState } from 'react';
import { Text, View, TextInput, TouchableOpacity, StyleSheet, Modal, ScrollView, StatusBar, Linking } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { fetch as expoFetch } from 'expo/fetch';
import { generateAPIUrl } from '../../utils';

const INFOBAR_PROMOS = [
  { text: 'Discover the wonders of the universe 🌌', url: 'https://www.nasa.gov/universe' },
  { text: 'Explore distant planets and galaxies 🚀', url: 'https://www.nasa.gov/planetary-science' },
  { text: 'Learn about black holes and cosmic mysteries 🕳️', url: 'https://www.nasa.gov/universe/black-holes' },
  { text: 'Stay updated on space missions and discoveries 🛰️', url: 'https://www.nasa.gov/missions' },
  { text: 'Journey through space exploration history 📜', url: 'https://www.nasa.gov/history' },
];

export default function Agents() {
  const [isAgentSelectorVisible, setIsAgentSelectorVisible] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState('space');
  const [searchText, setSearchText] = useState('');
  const [inputText, setInputText] = useState('');
  const [viewingDataForAgent, setViewingDataForAgent] = useState<string | null>(null);
  const [currentPromo, setCurrentPromo] = useState<{ text: string; url: string } | null>(null);
  const [showControls, setShowControls] = useState(false);

  const agents = [
    {
      id: 'space',
      name: 'Space',
      icon: '🌌',
      data: ['Explore planets', 'Black hole facts', 'Mars mission updates', 'Space exploration history'],
    },
    {
      id: 'sales',
      name: 'Sales',
      icon: '📈',
      data: ['Revenue summary', 'Top opportunities', 'Pipeline at risk', 'Regional leaderboard'],
    },
    {
      id: 'orders',
      name: 'Orders',
      icon: '🛒',
      data: ['Order #4832', 'Order #5921', 'Order #6103', 'Order #7018'],
    },
    {
      id: 'products',
      name: 'Products',
      icon: '🛍️',
      data: ['Product Alpha', 'Product Sigma', 'Product Echo', 'Product Delta'],
    },
    {
      id: 'items',
      name: 'Items',
      icon: '📦',
      data: ['Item K21-B', 'Item R04-C', 'Item Q88', 'Item L10'],
    },
    {
      id: 'stores',
      name: 'Stores',
      icon: '🎈',
      data: ['Store Downtown', 'Store Uptown', 'Store Westside', 'Store Riverside'],
    },
    {
      id: 'files',
      name: 'Files',
      icon: '📁',
      data: ['Q1 Report.pdf', 'SupplierContract.docx', 'OnboardingChecklist.md', 'BrandGuidelines.pptx'],
    },
  ];

  const handleAgentTap = (agentId: string) => {
    setViewingDataForAgent(agentId);
  };

  const handleDataSelect = (agentId: string, data: string) => {
    setSelectedAgentId(agentId);
    setInputText(data);
    setIsAgentSelectorVisible(false);
    setViewingDataForAgent(null);
  };

  const handleBack = () => {
    setViewingDataForAgent(null);
  };

  const filteredAgents = agents.filter(agent => agent.name.toLowerCase().includes(searchText.toLowerCase()));
  const selectedAgent = agents.find(agent => agent.id === selectedAgentId);
  const viewingAgent = viewingDataForAgent ? agents.find(agent => agent.id === viewingDataForAgent) : null;

  const { messages, error, sendMessage } = useChat({
    transport: new DefaultChatTransport({
      fetch: expoFetch as unknown as typeof globalThis.fetch,
      api: generateAPIUrl('/api/chat'),
    }),
    onError: error => console.error(error, 'ERROR'),
  });

  useEffect(() => {
    if (selectedAgentId === 'space') {
      const changePromo = () => {
        const randomIndex = Math.floor(Math.random() * INFOBAR_PROMOS.length);
        setCurrentPromo(INFOBAR_PROMOS[randomIndex]);
      };
      changePromo(); // Set initial
      const interval = setInterval(changePromo, 5000);
      return () => clearInterval(interval);
    } else {
      setCurrentPromo(null);
    }
  }, [selectedAgentId]);

  useEffect(() => {
    if (isAgentSelectorVisible) {
      StatusBar.setHidden(true, 'slide');
    } else {
      StatusBar.setHidden(false, 'slide');
      setViewingDataForAgent(null); // Reset when closing
    }

    return () => {
      StatusBar.setHidden(false, 'slide');
    };
  }, [isAgentSelectorVisible]);

  return (
    <View style={styles.container}>
      {selectedAgentId === 'space' && currentPromo ? (
        <TouchableOpacity
          style={styles.infobar}
          onPress={() => Linking.openURL(currentPromo.url)}
          activeOpacity={0.8}
        >
          <Text style={styles.infobarText}>{currentPromo.text}</Text>
          <MaterialIcons name="chevron-right" size={20} color="white" />
        </TouchableOpacity>
      ) : null}

      <View style={styles.content}>
        {selectedAgentId === 'space' ? (
          error ? (
            <Text>{error.message}</Text>
          ) : (
            <ScrollView style={{ flex: 1 }}>
              {messages.map(m => (
                <View key={m.id} style={{ marginVertical: 8, paddingHorizontal: 16 }}>
                  <View>
                    <Text style={{ fontWeight: 700 }}>{m.role}</Text>
                    {m.parts.map((part, i) => {
                      switch (part.type) {
                        case 'text':
                          return <Text key={`${m.id}-${i}`}>{part.text}</Text>;
                      }
                    })}
                  </View>
                </View>
              ))}
            </ScrollView>
          )
        ) : (
          <Text>Agents Screen</Text>
        )}
      </View>

      {/* Controls Container */}
      {showControls && (
        <View style={styles.controlsContainer}>
          <Text style={{ color: 'black', fontSize: 16 }}>Controls</Text>
        </View>
      )}

      {/* AI Console */}
      <View style={styles.aiconsoleContainer}>
        <View style={styles.inputBar}>
          <TouchableOpacity
            style={styles.leadingButton}
            onPress={() => setIsAgentSelectorVisible(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.agentText}>{selectedAgent?.icon}</Text>
          </TouchableOpacity>

          <TextInput
            style={styles.textInput}
            placeholder="Ask anything"
            placeholderTextColor="#9ca3af"
            value={inputText}
            onChangeText={setInputText}
            onSubmitEditing={e => {
              if (selectedAgentId === 'space') {
                sendMessage({ text: inputText });
                setInputText('');
              }
            }}
            autoFocus={true}
          />

          <TouchableOpacity style={styles.iconButton}>
            <MaterialIcons name="graphic-eq" size={20} color="#6b7280" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => setShowControls(!showControls)}
            activeOpacity={0.7}
          >
            <MaterialIcons name="more-vert" size={20} color="#6b7280" />
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
            {viewingDataForAgent && (
              <TouchableOpacity style={styles.backButton} onPress={handleBack} activeOpacity={0.7}>
                <MaterialIcons name="arrow-back" size={24} color="#4b5563" />
              </TouchableOpacity>
            )}
            <TextInput
              style={styles.modalTextInput}
              placeholder={viewingDataForAgent ? `Search ${viewingAgent?.name} data...` : "Search agents..."}
              placeholderTextColor="#9ca3af"
              value={searchText}
              onChangeText={setSearchText}
            />
            <TouchableOpacity style={styles.modalIconButton} activeOpacity={0.7}>
              <MaterialIcons name="qr-code-scanner" size={20} color="#4b5563" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent} contentContainerStyle={styles.modalContentContainer}>
            {viewingDataForAgent ? (
              viewingAgent?.data.filter(item => item.toLowerCase().includes(searchText.toLowerCase())).length ? (
                viewingAgent.data.filter(item => item.toLowerCase().includes(searchText.toLowerCase())).map((data) => (
                  <TouchableOpacity
                    key={data}
                    style={styles.dataItem}
                    onPress={() => handleDataSelect(viewingDataForAgent, data)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.dataContent}>
                      <Text style={styles.dataBullet}>•</Text>
                      <Text style={styles.dataText}>{data}</Text>
                    </View>
                  </TouchableOpacity>
                ))
              ) : (
                <Text style={styles.noData}>No data found</Text>
              )
            ) : (
              filteredAgents.length ? (
                filteredAgents.map((agent) => {
                  const isSelected = selectedAgentId === agent.id;
                  return (
                    <TouchableOpacity
                      key={agent.id}
                      style={styles.agentItem}
                      onPress={() => handleAgentTap(agent.id)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.agentContent}>
                        <Text style={styles.agentIcon}>{agent.icon}</Text>
                        <Text style={styles.agentName}>{agent.name}</Text>
                        {isSelected && (
                          <MaterialIcons name="check-circle" size={20} color="#6366f1" />
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })
              ) : (
                <Text style={styles.noAgents}>No agents found</Text>
              )
            )}
          </ScrollView>
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
  infobar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 60,
    padding: 12,
    backgroundColor: 'black',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 0,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  infobarText: {
    fontSize: 14,
    color: 'white',
    fontWeight: '600',
    flex: 1,
  },
  controlsContainer: {
    position: 'absolute',
    bottom: 84, // Above aiconsole height (68 minHeight + 16 padding)
    left: 0,
    right: 0,
    height: 200,
    backgroundColor: '#f0f9ff',
    borderTopWidth: 1,
    borderTopColor: '#e0e7ff',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 5,
  },
  aiconsoleContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: 16,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    zIndex: 10,
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
  backButton: {
    marginRight: 12,
    padding: 8,
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

  modalContent: {
    flex: 1,
  },
  modalContentContainer: {
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  agentItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  agentContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  agentIcon: {
    fontSize: 24,
  },
  agentName: {
    flex: 1,
    fontSize: 16,
    color: '#1f2937',
  },
  noAgents: {
    fontSize: 16,
    color: '#9ca3af',
    textAlign: 'center',
    paddingVertical: 40,
  },
  dataItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  dataContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dataBullet: {
    fontSize: 18,
    color: '#6366f1',
    width: 24,
  },
  dataText: {
    fontSize: 16,
    color: '#1f2937',
  },
  noData: {
    fontSize: 16,
    color: '#9ca3af',
    textAlign: 'center',
    paddingVertical: 40,
  },
});
