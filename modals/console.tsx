import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Modal,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  InteractionManager,
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
  const [expanded, setExpanded] = useState(false);
  const [inputText, setInputText] = useState('');
  const [isAgentSelectorVisible, setIsAgentSelectorVisible] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const focusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const animationFrameRef = useRef<ReturnType<typeof requestAnimationFrame> | null>(null);
  const interactionHandleRef = useRef<ReturnType<typeof InteractionManager.runAfterInteractions> | null>(null);

  const selectedAgent = agents.find(agent => agent.id === selectedAgentId);

  const clearFocusTimers = useCallback(() => {
    if (focusTimeoutRef.current) {
      clearTimeout(focusTimeoutRef.current);
      focusTimeoutRef.current = null;
    }

    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (interactionHandleRef.current) {
      interactionHandleRef.current.cancel?.();
      interactionHandleRef.current = null;
    }
  }, []);

  const focusInput = useCallback(() => {
    const field = inputRef.current;
    if (!field) {
      return;
    }

    if (!field.isFocused()) {
      field.focus();
    }
  }, []);

  const scheduleFocus = useCallback(() => {
    clearFocusTimers();

    focusInput();

    animationFrameRef.current = requestAnimationFrame(() => {
      focusInput();
    });

    focusTimeoutRef.current = setTimeout(() => {
      focusInput();
    }, 250);

    interactionHandleRef.current = InteractionManager.runAfterInteractions(() => {
      focusInput();
      interactionHandleRef.current = null;
    });
  }, [clearFocusTimers, focusInput]);

  const handleInputPress = () => {
    setExpanded(true);
  };

  const handleCloseExpanded = () => {
    setExpanded(false);
    inputRef.current?.blur();
    clearFocusTimers();
  };

  const handleAgentSelect = (agentId: string) => {
    onAgentSelect(agentId);
    setIsAgentSelectorVisible(false);
  };

  useEffect(() => {
    if (!expanded) {
      return;
    }

    scheduleFocus();

    return () => {
      clearFocusTimers();
    };
  }, [expanded, scheduleFocus, clearFocusTimers]);

  return (
    <>
      {/* Collapsed State - Bottom Bar */}
      <View style={styles.collapsedContainer}>
        <TouchableOpacity
          style={styles.agentButton}
          onPress={() => setIsAgentSelectorVisible(true)}
          activeOpacity={0.7}
        >
          <Text style={styles.agentIcon}>{selectedAgent?.icon || '🤖'}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.slashContainer}
          onPress={handleInputPress}
          activeOpacity={0.8}
        >
          <Text style={styles.slashText}>/</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.audioButton} activeOpacity={0.7}>
          <MaterialIcons name="mic" size={24} color="#6b7280" />
        </TouchableOpacity>
      </View>

      {/* Expanded State - Full Screen Modal */}
      <Modal
        visible={expanded}
        transparent={false}
        animationType="slide"
        onRequestClose={handleCloseExpanded}
        onShow={scheduleFocus}
      >
        <StatusBar barStyle="dark-content" backgroundColor="white" />
        <KeyboardAvoidingView
          style={styles.expandedContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
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
            onLayout={() => {
              if (expanded) {
                scheduleFocus();
              }
            }}
          />

          {onSendMessage && (
            <TouchableOpacity
              style={styles.sendButton}
              activeOpacity={0.8}
              onPress={() => {
                if (inputText.trim()) {
                  onSendMessage(inputText.trim());
                  setInputText('');
                  setExpanded(false);
                }
              }}
            >
              <MaterialIcons name="arrow-upward" size={24} color="white" />
            </TouchableOpacity>
          )}
        </KeyboardAvoidingView>
      </Modal>

      {/* Agent Selector Modal */}
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
    paddingBottom: Platform.OS === 'ios' ? 34 : 12, // Account for home indicator
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
  expandedContainer: {
    flex: 1,
    backgroundColor: 'white',
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  expandedInput: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1f2937',
    lineHeight: 40,
    flex: 1,
  },
  sendButton: {
    position: 'absolute',
    bottom: 40,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'black',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
});

export default Console;
