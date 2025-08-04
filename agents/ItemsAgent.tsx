import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, Modal, ActivityIndicator, Button, FlatList, Keyboard } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { FileUpload, FileItem } from '../components/FileUpload';
import { r2Service } from '../lib/r2-service';
import { groq } from '@ai-sdk/groq';
import { generateObject } from 'ai';
import { z } from 'zod';
import { getGroqApiKey, logEnvironmentStatus } from '../config/env';

// File metadata interface for uploaded files
interface ItemFile {
  key: string;
  url: string;
  filename: string;
  size: number;
  contentType: string;
  uploadedAt: Date;
}

interface Option {
  id: string;
  name: string;
  value: string;
  color?: string;
  icon?: string;
  textId?: string;
}

interface OptionGroup {
  id: string;
  type: string;
  options: Option[];
}

interface Props {
  context: {
    title: string;
    id: string;
  };
}

export default function ItemsAgent() {
  const [activeTab, setActiveTab] = useState('inventory');
  const [aiInput, setAiInput] = useState('');
  const [optionGroups, setOptionGroups] = useState<OptionGroup[]>([]);
  const [modalAiInput, setModalAiInput] = useState('');
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  // File management state
  const [images, setImages] = useState<ItemFile[]>([]);
  const [documents, setDocuments] = useState<ItemFile[]>([]);
  
  const tabs = [
    { id: 'inventory', label: 'Inventory' },
    { id: 'options', label: 'Options' },
    { id: 'files', label: 'Files' },
    { id: 'notes', label: 'Notes' },
    { id: 'labels', label: 'Labels' }
  ];

  // Keyboard event listeners
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => setKeyboardHeight(e.endCoordinates.height)
    );
    
    const keyboardDidHideListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardHeight(0)
    );

    return () => {
      keyboardDidShowListener?.remove();
      keyboardDidHideListener?.remove();
    };
  }, []);

  // Check R2 configuration on mount
  useEffect(() => {
    const r2Status = r2Service.getStatus();
    console.log('R2 Configuration Status:', r2Status);
    
    if (!r2Status.configured) {
      console.error('❌ Cloudflare R2 not configured:', r2Status.error);
      console.log('Required environment variables:');
      console.log('- EXPO_PUBLIC_R2_ACCOUNT_ID');
      console.log('- EXPO_PUBLIC_R2_ACCESS_KEY_ID');
      console.log('- EXPO_PUBLIC_R2_SECRET_ACCESS_KEY');
      console.log('- EXPO_PUBLIC_R2_BUCKET_NAME');
      console.log('- EXPO_PUBLIC_R2_ENDPOINT');
    } else {
      console.log('✅ R2 configured successfully:', {
        bucket: r2Status.bucket,
        endpoint: r2Status.endpoint
      });
    }
  }, []);

  // File management functions
  const handleImageUpload = (files: ItemFile[]) => {
    setImages(prev => [...prev, ...files]);
  };

  const handleDocumentUpload = (files: ItemFile[]) => {
    setDocuments(prev => [...prev, ...files]);
  };

  const handleFileUploadError = (error: string) => {
    console.error('Upload error:', error);
  };

  const handleDeleteFile = async (key: string, fileType: 'image' | 'document') => {
    try {
      const success = await r2Service.deleteFile(key);
      if (success) {
        if (fileType === 'image') {
          setImages(prev => prev.filter(file => file.key !== key));
        } else {
          setDocuments(prev => prev.filter(file => file.key !== key));
        }
      }
    } catch (error) {
      console.error('Error deleting file:', error);
    }
  };



// Utility functions
const generateId = () => Date.now().toString() + Math.random().toString(36).substr(2, 9);

const getVisualIdentifier = (type: string, value: string, identifier?: string) => {
  const lowerType = type.toLowerCase();
  const lowerValue = value.toLowerCase();
  
  // Color-specific handling
  if (lowerType === 'color') {
    if (lowerValue.startsWith('#')) return { color: lowerValue };
    // Map common color names to hex values
    const colorMap: { [key: string]: string } = {
      red: '#ef4444', blue: '#3b82f6', green: '#10b981', yellow: '#f59e0b',
      black: '#000000', white: '#ffffff', gray: '#6b7280', pink: '#ec4899',
      purple: '#8b5cf6', orange: '#f97316', brown: '#92400e', navy: '#1e3a8a',
      lime: '#84cc16', teal: '#14b8a6', indigo: '#6366f1', violet: '#8b5cf6',
      rose: '#f43f5e', amber: '#f59e0b', emerald: '#10b981', cyan: '#06b6d4'
    };
    return { color: colorMap[lowerValue] || '#6b7280' };
  }
  
  // For non-color types, return text identifier
  const textIdentifier = identifier || value.charAt(0).toUpperCase();
  
  // Size-specific text identifiers
  if (lowerType === 'size') {
    if (['xs', 'x-small', 'extra small'].includes(lowerValue)) return { textId: 'XS' };
    if (['s', 'small'].includes(lowerValue)) return { textId: 'S' };
    if (['m', 'medium', 'med'].includes(lowerValue)) return { textId: 'M' };
    if (['l', 'large'].includes(lowerValue)) return { textId: 'L' };
    if (['xl', 'x-large', 'extra large', 'xtra large', 'xtralarge'].includes(lowerValue)) return { textId: 'XL' };
    if (['xxl', 'xx-large', 'extra extra large'].includes(lowerValue)) return { textId: 'XXL' };
    return { textId: textIdentifier };
  }
  
  // Material-specific text identifiers
  if (lowerType === 'material') {
    if (lowerValue.includes('cotton')) return { textId: 'COT' };
    if (lowerValue.includes('leather')) return { textId: 'LEA' };
    if (lowerValue.includes('metal')) return { textId: 'MET' };
    if (lowerValue.includes('wood')) return { textId: 'WOD' };
    if (lowerValue.includes('silk')) return { textId: 'SLK' };
    if (lowerValue.includes('wool')) return { textId: 'WOL' };
    return { textId: textIdentifier };
  }
  
  // Default fallback - use text identifier
  return { textId: textIdentifier };
};

const deleteOption = (groupId: string, optionId: string) => {
  setOptionGroups(prev => {
    const updatedGroups = prev.map(group => {
      if (group.id === groupId) {
        return {
          ...group,
          options: group.options.filter(option => option.id !== optionId)
        };
      }
      return group;
    }).filter(group => group.options.length > 0); // Remove empty groups
    
    return updatedGroups;
  });
};

const handleModalAiInput = () => {
    if (!modalAiInput.trim()) return;
    
    setModalAiInput('');
  };

const handleMainAiInput = async (input) => {
    if (!input.trim()) return;
    
    // Improved parsing to handle compound words and units
    // First split by commas, then handle spaces more intelligently
    const commaSplit = input.split(',').map(item => item.trim()).filter(item => item.length > 0);
    
    const inputs = [];
    commaSplit.forEach(phrase => {
      // Check if phrase contains compound words or known units
      const words = phrase.toLowerCase().split(/\s+/);
      
      if (words.length === 1) {
        inputs.push(phrase.trim());
      } else {
        // Handle compound size words
        const sizeCompounds = ['extra large', 'extra small', 'x large', 'x small', 'xx large', 'xx small', 'xtra large', 'xtra small'];
        const foundCompound = sizeCompounds.find(compound => 
          phrase.toLowerCase().includes(compound)
        );
        
        if (foundCompound) {
          inputs.push(phrase.trim());
        } else {
          // Check for units (number + unit should stay together)
          const unitPattern = /\d+\s*(kg|lb|lbs|g|oz|cm|mm|in|inch|inches|ft|feet|v|w|watts|gb|tb|mb)\b/i;
          if (unitPattern.test(phrase)) {
            inputs.push(phrase.trim());
          } else {
            // Split by spaces for regular words
            phrase.split(/\s+/).forEach(word => {
              if (word.trim().length > 0) {
                inputs.push(word.trim());
              }
            });
          }
        }
      }
    });
    
    // Remove existing duplicates
    const uniqueInputs = Array.from(new Set(inputs));

    try {
      // Set up API key for AI SDK
      const apiKey = getGroqApiKey();
      if (typeof process !== 'undefined' && process.env) {
        process.env.GROQ_API_KEY = apiKey;
      }

      // Define schema for AI response
      const optionClassificationSchema = z.object({
        classifications: z.array(z.object({
          option: z.string(),
          type: z.enum(['Color', 'Size', 'Material']).optional(),
          identifier: z.string().optional()
        }))
      });

      // Send request to AI to classify options
      const result = await generateObject({
        model: groq('gemma2-9b-it'),
        schema: optionClassificationSchema,
        prompt: `You are helping classify product options for e-commerce.

Options to classify: ${uniqueInputs.join(', ')}

For each option, determine the most appropriate category type. Common types include:
- Color (for colors like red, blue, black, orange, etc.)
- Size (for sizes like small, medium, large, XS, XL)
- Material (for materials like cotton, leather, wool)

For identifiers:
- Colors: Leave identifier empty (color will be shown visually)
- Sizes: Use short codes like S, M, L, XL, XXL
- Materials: Use 3-letter abbreviations like COT (cotton), LEA (leather)

Respond with a JSON array of classifications, each containing:
- option: the original option text (keep original case)
- type: the category type
- identifier: a short display identifier (2-4 characters max, leave empty for colors)

Be intelligent about classification - group similar items together under the same type. Limit to three types.`,
        maxRetries: 2,
      });

      console.log('AI Classification Result:', result.object);

      // Process AI results and update option groups
      result.object.classifications.forEach(classification => {
        const { option, type, identifier } = classification;
        const displayName = identifier || option.trim();
        const visualProps = getVisualIdentifier(type, option, identifier);
        
        // Check for duplicates before adding
        const duplicateExists = optionGroups.some(group => 
          group.options.some(opt => opt.value.toLowerCase() === option.toLowerCase())
        );
        
        if (!duplicateExists) {
          setOptionGroups(prev => {
            const updatedGroups = [...prev];
            let foundGroup = updatedGroups.find(group => group.type === type);
            
            const newOption: Option = {
              id: generateId(),
              name: displayName,
              value: option.trim(),
              ...visualProps
            };
            
            if (foundGroup) {
              foundGroup.options.push(newOption);
            } else {
              updatedGroups.push({
                id: generateId(),
                type: type,
                options: [newOption]
              });
            }
            
            return updatedGroups;
          });
        }
      });

    } catch (error) {
      console.error('AI Classification Error:', error);
      
      // Fallback to simple classification if AI fails
      uniqueInputs.forEach(singleInput => {
        const duplicateExists = optionGroups.some(group => 
          group.options.some(opt => opt.value.toLowerCase() === singleInput.toLowerCase())
        );
        
        if (!duplicateExists) {
          const defaultType = singleInput.match(/^\d+/) ? 'Size' : 'Material';
          const identifier = singleInput.trim();
          const visualProps = getVisualIdentifier(defaultType, singleInput, identifier);

          setOptionGroups(prev => {
            const updatedGroups = [...prev];
            let foundGroup = updatedGroups.find(group => group.type === defaultType);
            
            const newOption: Option = {
              id: generateId(),
              name: identifier,
              value: identifier,
              ...visualProps
            };
            
            if (foundGroup) {
              foundGroup.options.push(newOption);
            } else {
              updatedGroups.push({
                id: generateId(),
                type: defaultType,
                options: [newOption]
              });
            }
            
            return updatedGroups;
          });
        }
      });
    }

    setAiInput('');
  };


  const renderFilesContent = () => {
    return (
      <View style={styles.tabContent}>
        {/* Image Upload Section */}
        <View style={styles.fileSection}>
          <Text style={styles.sectionTitle}>Item Images</Text>
          <FileUpload
            onUploadComplete={handleImageUpload}
            onUploadError={handleFileUploadError}
            fileType="image"
            allowMultiple={true}
            maxFiles={5}
            folder="items/images"
          />

          {images.length > 0 && (
            <View style={styles.fileList}>
              <Text style={styles.fileListTitle}>
                {images.length} image(s) uploaded
              </Text>
              {images.map((file) => (
                <FileItem
                  key={file.key}
                  file={file}
                  onDelete={(key) => handleDeleteFile(key, 'image')}
                />
              ))}
            </View>
          )}
        </View>

        {/* Document Upload Section */}
        <View style={styles.fileSection}>
          <Text style={styles.sectionTitle}>Documents</Text>
          <FileUpload
            onUploadComplete={handleDocumentUpload}
            onUploadError={handleFileUploadError}
            fileType="document"
            allowMultiple={true}
            maxFiles={3}
            folder="items/documents"
          />

          {documents.length > 0 && (
            <View style={styles.fileList}>
              <Text style={styles.fileListTitle}>
                {documents.length} document(s) uploaded
              </Text>
              {documents.map((file) => (
                <FileItem
                  key={file.key}
                  file={file}
                  onDelete={(key) => handleDeleteFile(key, 'document')}
                />
              ))}
            </View>
          )}
        </View>

        {/* File Summary */}
        {(images.length > 0 || documents.length > 0) && (
          <View style={styles.fileSummary}>
            <Text style={styles.summaryText}>
              Total files: {images.length + documents.length}
            </Text>
            <Text style={styles.summarySubtext}>
              Images: {images.length} • Documents: {documents.length}
            </Text>
          </View>
        )}
      </View>
    );
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'inventory':
        return <Text style={styles.tabContent}>Inventory Content</Text>;
case 'options':
  return (
    <View style={styles.optionsContainer}>
      {optionGroups.length === 0 ? (
        <View style={styles.emptyOptionsState}>
          <Feather name="tag" size={48} color="#94a3b8" />
          <Text style={styles.emptyOptionsTitle}>No Options Yet</Text>
          <Text style={styles.emptyOptionsSubtitle}>
            Type options below to get started{"\n"}
            e.g., "red blue green" or "small medium large"
          </Text>
        </View>
      ) : (
        optionGroups.map((group) => (
          <View key={group.id} style={styles.optionSection}>
            <View style={styles.optionHeader}>
              <Text style={styles.optionTitle}>{group.type}</Text>
              <View style={styles.optionBadge}>
                <Text style={styles.optionBadgeText}>{group.options.length}</Text>
              </View>
            </View>
            <View style={styles.valuesGrid}>
              {group.options.map((option) => (
                <View key={option.id} style={styles.valueChip}>
                  {/* Visual Identifier */}
                  <View style={[
                    option.color ? styles.colorIdentifier : styles.textIdentifier,
                    option.color ? { backgroundColor: option.color } : {}
                  ]}>
                    {option.color ? (
                      option.color === '#ffffff' ? (
                        <View style={styles.whiteColorBorder} />
                      ) : null
                    ) : (
                      <Text style={styles.identifierText}>
                        {option.textId || option.name.charAt(0).toUpperCase()}
                      </Text>
                    )}
                  </View>
                  
                  {/* Option Value */}
                  <Text style={styles.valueChipText}>{option.value}</Text>
                  
                  {/* Delete Button */}
                  <TouchableOpacity 
                    style={styles.deleteOptionButton}
                    onPress={() => deleteOption(group.id, option.id)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Feather name="x" size={14} color="#6b7280" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </View>
        ))
      )}
    </View>
  );
case 'files':
        return renderFilesContent();
      case 'notes':
        return <Text style={styles.tabContent}>Notes Content</Text>;
      case 'labels':
        return <Text style={styles.tabContent}>Labels Content</Text>;
      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.tabsContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {tabs.map((tab) => (
            <TouchableOpacity
              key={tab.id}
              style={[styles.tab, activeTab === tab.id && styles.activeTab]}
              onPress={() => setActiveTab(tab.id)}
            >
              <Text style={[styles.tabText, activeTab === tab.id && styles.activeTabText]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
      <ScrollView 
        style={[
          styles.content,
          { marginBottom: keyboardHeight > 0 ? keyboardHeight + 80 : 80 }
        ]} 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {renderTabContent()}
      </ScrollView>
      {/* AI Input at the bottom similar to ChatGPT */}
      <View style={[
        styles.aiInputContainer,
        {
          position: 'absolute',
          bottom: keyboardHeight,
          left: 0,
          right: 0,
        }
      ]}>
        <TextInput
          style={styles.aiInput}
          placeholder="Type a command or ask a question..."
          placeholderTextColor="#94a3b8"
          value={aiInput}
          onChangeText={setAiInput}
          multiline={false}
          returnKeyType="send"
          onSubmitEditing={() => handleMainAiInput(aiInput)}
          blurOnSubmit={false}
        />
        <TouchableOpacity 
          style={styles.sendButton}
          onPress={() => handleMainAiInput(aiInput)}
        >
          <Feather name="send" size={20} color="#ffffff" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  tabsContainer: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingHorizontal: 20,
  },
  tab: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginRight: 8,
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#3b82f6',
  },
  tabText: {
    fontSize: 16,
    color: '#64748b',
    fontWeight: '500',
  },
  activeTabText: {
    color: '#3b82f6',
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  tabContent: {
    fontSize: 16,
    color: '#1e293b',
  },
  aiInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'android' ? 8 : 12,
    paddingBottom: Platform.OS === 'ios' ? 34 : 8,
    borderTopWidth: Platform.OS === 'android' ? 0 : 1,
    borderTopColor: '#e2e8f0',
    backgroundColor: '#ffffff',
  },
  aiInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#ffffff',
    marginRight: 10,
  },
  sendButton: {
    backgroundColor: '#3b82f6',
    padding: 10,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attributesContainer: {
    paddingVertical: 10,
  },
  optionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  optionText: {
    fontSize: 16,
    color: '#1e293b',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  modalContent: {
    padding: 20,
  },
  optionSetContainer: {
    marginBottom: 15,
  },
  optionSetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 10,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  optionSetName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
  },
  optionValuesContainer: {
    marginTop: 10,
    marginLeft: 10,
  },
  optionValue: {
    paddingVertical: 8,
  },
  optionValueText: {
    fontSize: 14,
    color: '#64748b',
  },
  modalAiInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  emptyState: {
    alignItems: 'center',
    marginVertical: 20,
  },
  emptyText: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
  },
emptySubtext: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
  },
  // AI Chat Suggestion Cards Styles
  suggestionCardsContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  suggestionCardsScrollView: {
    paddingHorizontal: 4,
  },
  suggestionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginRight: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  suggestionCardText: {
    fontSize: 14,
    color: '#3b82f6',
    fontWeight: '500',
    marginLeft: 6,
  },
  selectedSuggestionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#ecfdf5',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#a7f3d0',
    marginRight: 8,
  },
  selectedSuggestionCardText: {
    fontSize: 14,
    color: '#059669',
    fontWeight: '500',
    marginLeft: 6,
  },
  // Selected values display
  selectedValuesContainer: {
    marginTop: 16,
    padding: 16,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  selectedValuesTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 12,
  },
  selectedValuesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  selectedValueChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#3b82f6',
    borderRadius: 16,
  },
  selectedValueChipText: {
    fontSize: 14,
    color: '#ffffff',
    fontWeight: '500',
  },
  // Flat list design styles
  flatOptionSetContainer: {
    marginBottom: 4,
  },
  flatOptionSetHeader: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  flatOptionSetName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
  },
  flatOptionValuesContainer: {
    backgroundColor: '#fafafa',
  },
  flatOptionValue: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    paddingLeft: 40,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  flatOptionValueText: {
    fontSize: 15,
    color: '#374151',
    marginLeft: 12,
  },
  checkboxContainer: {
    marginRight: 8,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: '#d1d5db',
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  checkboxChecked: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  // File-related styles
  fileSection: {
    marginBottom: 32,
  },
  fileList: {
    marginTop: 16,
  },
  fileListTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 12,
  },
  fileSummary: {
    marginTop: 24,
    padding: 16,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  summaryText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 4,
  },
  summarySubtext: {
    fontSize: 14,
    color: '#64748b',
  },
  // Options title container styles
  optionsTitleContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    marginVertical: 12,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  optionsTitleText: {
    fontSize: 18,
    color: '#1e293b',
    fontWeight: 'bold',
  },
  // Generate Options Button
  generateOptionsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3b82f6',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginVertical: 8,
  },
  generateOptionsButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  // Modal Title for Option Selector
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1e293b',
    textAlign: 'center',
    marginBottom: 16,
  },
  // Options Container Styles from ProductsAgent
  optionsContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  optionSection: {
    marginBottom: 40,
  },
  optionTitle: {
    fontSize: 16,
    color: '#111827',
    marginBottom: 16,
  },
  valuesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  valueChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  valueChipText: {
    fontSize: 14,
    color: '#374151',
    marginLeft: 8,
  },
  circleIdentifier: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleIdentifierText: {
    fontSize: 10,
    color: '#ffffff',
    fontWeight: 'bold',
  },
  // Enhanced Options Styles
  emptyOptionsState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 40,
  },
  emptyOptionsTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#374151',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyOptionsSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  optionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  optionBadge: {
    backgroundColor: '#e5e7eb',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 12,
  },
  optionBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
  },
  colorIdentifier: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#6b7280',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  textIdentifier: {
    minWidth: 24,
    height: 20,
    borderRadius: 6,
    backgroundColor: '#6b7280',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    paddingHorizontal: 4,
  },
  identifierText: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
  },
  whiteColorBorder: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#ffffff',
  },
  deleteOptionButton: {
    marginLeft: 8,
    padding: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(107, 114, 128, 0.1)',
  },
});
