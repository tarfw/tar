import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from 'react-native';
import { MaterialIcons, Foundation } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AgentsDb from './agentsdb';
import DataList from './datalist';

const INFOBAR_OFFSET = 0;

interface ConsoleProps {
  selectedAgentId: string;
  agents: Array<{ id: string; name: string; icon: string; data: string[]; fullData?: any[] }>;
  onAgentSelect: (agentId: string) => void;
  onSendMessage?: (message: string) => void;
  onItemSelect?: (item: any) => void;
  placeholder?: string;
  onExpandedChange?: (expanded: boolean) => void;
}

const Console: React.FC<ConsoleProps> = ({
  selectedAgentId,
  agents,
  onAgentSelect,
  onSendMessage,
  onItemSelect,
  placeholder,
  onExpandedChange,
}) => {
  const router = useRouter();
  const [isExpanded, setIsExpanded] = useState(false);
  const [inputText, setInputText] = useState('');
  const [isAgentSelectorVisible, setIsAgentSelectorVisible] = useState(false);
  const [isDataListVisible, setIsDataListVisible] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const selectedAgent = agents.find(agent => agent.id === selectedAgentId);

  useEffect(() => {
    if (!isExpanded) return;

    const id = setTimeout(() => {
      inputRef.current?.focus();
    }, 50);

    return () => clearTimeout(id);
  }, [isExpanded]);

  const handleOpen = () => {
    setIsExpanded(true);
    onExpandedChange?.(true);
  };

  const handleClose = () => {
    setIsExpanded(false);
    onExpandedChange?.(false);
    inputRef.current?.blur();
  };

  const handleAgentSelect = (agentId: string) => {
    onAgentSelect(agentId);
    setIsAgentSelectorVisible(false);
  };

  const handleSubmit = () => {
    if (!onSendMessage) {
      return;
    }

    const trimmed = inputText?.trim();
    if (!trimmed) {
      return;
    }

    onSendMessage(trimmed);
    setInputText('');
    handleClose();
  };

  return (
    <>
      <View style={styles.collapsedContainer}>
        <TouchableOpacity
          style={styles.agentButton}
          onPress={() => setIsAgentSelectorVisible(true)}
          activeOpacity={0.7}
        >
          <Text style={styles.agentIcon}>{selectedAgent?.icon || '🤖'}</Text>
        </TouchableOpacity>

        <View style={styles.middleContainer}>
          <TouchableOpacity style={styles.slashContainer} onPress={handleOpen} activeOpacity={0.8}>
            <Foundation name="asterisk" size={24} color="#6b7280" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.workspaceButton}
          onPress={() => setIsDataListVisible(true)}
          activeOpacity={0.7}
        >
          <Text style={styles.hashText}>#</Text>
        </TouchableOpacity>
      </View>

      {isExpanded && (
        <View style={styles.overlay} pointerEvents="box-none">
          <Pressable style={styles.backdrop} onPress={handleClose} />
          <KeyboardAvoidingView
            style={styles.expandedContainer}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
              <View style={[styles.expandedContent, { marginTop: INFOBAR_OFFSET }]}>
              <View style={styles.expandedHeader}>
                <TouchableOpacity onPress={handleClose} style={styles.closeButton} activeOpacity={0.7}>
                  <MaterialIcons name="close" size={24} color="#111827" />
                </TouchableOpacity>
                <Text style={styles.expandedTitle}>{selectedAgent?.name || 'Agent'}</Text>
              </View>

              <TextInput
                ref={inputRef}
                style={styles.expandedInput}
                value={inputText}
                onChangeText={setInputText}
                placeholder={placeholder || `Ask ${selectedAgent?.name || 'Agent'}...`}
                placeholderTextColor="#9ca3af"
                multiline
                autoFocus
                textAlignVertical="top"
                returnKeyType="send"
                blurOnSubmit={false}
                onSubmitEditing={handleSubmit}
              />

              <TouchableOpacity
                style={[
                  styles.sendButton,
                  (!onSendMessage || !inputText?.trim()) && styles.sendButtonDisabled,
                ]}
                activeOpacity={0.8}
                onPress={handleSubmit}
                disabled={!onSendMessage || !inputText?.trim()}
              >
                <MaterialIcons name="arrow-upward" size={24} color="white" />
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      )}

      <AgentsDb
        visible={isAgentSelectorVisible}
        onClose={() => setIsAgentSelectorVisible(false)}
        onSelect={handleAgentSelect}
        agents={agents}
        selectedAgentId={selectedAgentId}
      />

      {selectedAgent && (
        <DataList
          visible={isDataListVisible}
          onClose={() => setIsDataListVisible(false)}
          selectedAgent={selectedAgent}
          onItemSelect={onItemSelect}
        />
      )}
    </>
  );
};

const styles = StyleSheet.create({
  collapsedContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: Platform.OS === 'ios' ? 34 : 12,
  },
  agentButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
  },
  workspaceButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  agentIcon: {
    fontSize: 24,
    color: '#6b7280',
    fontWeight: 'bold',
  },
  middleContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  hashText: {
    fontSize: 22,
    color: '#6b7280',
    fontWeight: 'bold',
    lineHeight: 24,
  },
  slashContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 28,
    minWidth: 120,
  },
  slashText: {
    fontSize: 18,
    color: '#6b7280',
    fontWeight: 'bold',
    lineHeight: 24,
  },
  audioButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-start',
    zIndex: 100,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'white',
  },
  expandedContainer: {
    flex: 1,
    justifyContent: 'flex-start',
  },
  expandedContent: {
    flex: 1,
    backgroundColor: 'white',
    paddingHorizontal: 20,
    paddingTop: 0,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  expandedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  expandedTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginLeft: 8,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
  },
  expandedInput: {
    fontSize: 18,
    color: '#111827',
    lineHeight: 26,
    flex: 1,
  },
  sendButton: {
    marginTop: 24,
    backgroundColor: '#111827',
    borderRadius: 28,
    width: 56,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'flex-end',
  },
  sendButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
});

export default Console;
