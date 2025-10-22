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
import { MaterialIcons } from '@expo/vector-icons';
import AgentsDb from './agentsdb';

interface ConsoleProps {
  selectedAgentId: string;
  agents: Array<{ id: string; name: string; icon: string; data: string[] }>;
  onAgentSelect: (agentId: string) => void;
  onSendMessage?: (message: string) => void;
}

const Console: React.FC<ConsoleProps> = ({
  selectedAgentId,
  agents,
  onAgentSelect,
  onSendMessage,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [inputText, setInputText] = useState('');
  const [isAgentSelectorVisible, setIsAgentSelectorVisible] = useState(false);
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
  };

  const handleClose = () => {
    setIsExpanded(false);
    inputRef.current?.blur();
  };

  const handleAgentSelect = (agentId: string) => {
    onAgentSelect(agentId);
    setIsAgentSelectorVisible(false);
  };

  const handleSubmit = () => {
    const trimmed = inputText.trim();
    if (!trimmed || !onSendMessage) {
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

        <TouchableOpacity style={styles.slashContainer} onPress={handleOpen} activeOpacity={0.8}>
          <Text style={styles.slashText}>/</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.audioButton} activeOpacity={0.7}>
          <MaterialIcons name="mic" size={24} color="#6b7280" />
        </TouchableOpacity>
      </View>

      {isExpanded && (
        <View style={styles.overlay} pointerEvents="box-none">
          <Pressable style={styles.backdrop} onPress={handleClose} />
          <KeyboardAvoidingView
            style={styles.expandedContainer}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <View style={styles.expandedContent}>
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
                placeholder={`Ask ${selectedAgent?.name || 'Agent'}...`}
                placeholderTextColor="#9ca3af"
                multiline
                autoFocus
                textAlignVertical="top"
                returnKeyType="send"
                blurOnSubmit={false}
                onSubmitEditing={handleSubmit}
              />

              {onSendMessage && (
                <TouchableOpacity
                  style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
                  activeOpacity={0.8}
                  onPress={handleSubmit}
                  disabled={!inputText.trim()}
                >
                  <MaterialIcons name="arrow-upward" size={24} color="white" />
                </TouchableOpacity>
              )}
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
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  agentIcon: {
    fontSize: 20,
  },
  slashContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  slashText: {
    fontSize: 24,
    color: '#6b7280',
    fontWeight: 'bold',
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
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  expandedContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  expandedContent: {
    backgroundColor: 'white',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    minHeight: '70%',
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
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  sendButtonDisabled: {
    backgroundColor: '#9ca3af',
    shadowOpacity: 0,
  },
});

export default Console;
