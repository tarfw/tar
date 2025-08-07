import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, Modal, ActivityIndicator, Button, FlatList, Keyboard, Alert, Animated, PanResponder, Image } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { FileUpload, FileItem, FileUploadRef } from '../components/FileUpload';
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
  // Snackbar state
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const snackbarOpacity = new Animated.Value(0);
  // Drag state
  const [draggedOptionId, setDraggedOptionId] = useState<string | null>(null);
  const [draggedGroupId, setDraggedGroupId] = useState<string | null>(null);
  const [dragTargetIndex, setDragTargetIndex] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  
  // File upload refs
  const imageUploadRef = useRef<FileUploadRef>(null);
  const documentUploadRef = useRef<FileUploadRef>(null);
  
  // Option type suggestions for quick input
  const optionTypeSuggestions = [
    'red blue green',
    'small medium large',
    'cotton leather silk',
    'nike adidas puma',
    '@brand ',
    '@color ',
    '@size ',
    '@material '
  ];
  
  // Add some test data for scrolling
  useEffect(() => {
    if (optionGroups.length === 0) {
      // Add some test data to verify scrolling
      const testGroups = [
        {
          id: 'test1',
          type: 'Color',
          options: [
            { id: 'c1', name: 'Red', value: 'red', color: '#ef4444' },
            { id: 'c2', name: 'Blue', value: 'blue', color: '#3b82f6' },
            { id: 'c3', name: 'Green', value: 'green', color: '#10b981' },
            { id: 'c4', name: 'Yellow', value: 'yellow', color: '#f59e0b' },
            { id: 'c5', name: 'Purple', value: 'purple', color: '#8b5cf6' },
          ]
        },
        {
          id: 'test2',
          type: 'Size',
          options: [
            { id: 's1', name: 'Small', value: 'small', textId: 'S' },
            { id: 's2', name: 'Medium', value: 'medium', textId: 'M' },
            { id: 's3', name: 'Large', value: 'large', textId: 'L' },
            { id: 's4', name: 'X-Large', value: 'xlarge', textId: 'XL' },
          ]
        },
        {
          id: 'test3',
          type: 'Material',
          options: [
            { id: 'm1', name: 'Cotton', value: 'cotton', textId: 'C' },
            { id: 'm2', name: 'Leather', value: 'leather', textId: 'L' },
            { id: 'm3', name: 'Silk', value: 'silk', textId: 'S' },
            { id: 'm4', name: 'Polyester', value: 'polyester', textId: 'P' },
          ]
        },
        {
          id: 'test4',
          type: 'Brand',
          options: [
            { id: 'b1', name: 'Nike', value: 'nike', textId: 'N' },
            { id: 'b2', name: 'Adidas', value: 'adidas', textId: 'A' },
            { id: 'b3', name: 'Puma', value: 'puma', textId: 'P' },
            { id: 'b4', name: 'Under Armour', value: 'underarmour', textId: 'U' },
          ]
        }
      ];
      setOptionGroups(testGroups);
    }
  }, []);
  
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

const showSnackbar = (message: string) => {
  setSnackbarMessage(message);
  setSnackbarVisible(true);
  Animated.timing(snackbarOpacity, {
    toValue: 1,
    duration: 300,
    useNativeDriver: true,
  }).start();

  setTimeout(() => {
    Animated.timing(snackbarOpacity, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setSnackbarVisible(false);
    });
  }, 2000);
};

const handleLongPressDelete = (groupId: string, optionId: string, optionValue: string) => {
  Alert.alert(
    'Delete Option',
    `Are you sure you want to delete "${optionValue}"?`,
    [
      {
        text: 'Cancel',
        style: 'cancel',
      },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteOption(groupId, optionId);
          showSnackbar('Option deleted');
        },
      },
    ]
  );
};

const handleModalAiInput = () => {
    if (!modalAiInput.trim()) return;
    
    setModalAiInput('');
  };

const handleMainAiInput = async (input: string) => {
    if (!input.trim()) return;
    
    // Track all existing options to prevent duplicates
    const existingOptions = new Set<string>();
    optionGroups.forEach(group => {
      group.options.forEach(option => {
        existingOptions.add(option.value.toLowerCase());
      });
    });
    
    // Parse input for @ custom option names - improved pattern
    const customOptionPattern = /@(\w+)\s*([^,]+?)(?=,|$|@)/g;
    const customOptions: { name: string; value: string }[] = [];
    
    // Extract custom options with @ symbol
    let match: RegExpExecArray | null;
    while ((match = customOptionPattern.exec(input)) !== null) {
      const optionType = match[1].trim();
      const values = match[2].trim().split(/\s+/).filter(val => val.length > 0);
      
      values.forEach(value => {
        const trimmedValue = value.trim();
        if (trimmedValue && !existingOptions.has(trimmedValue.toLowerCase())) {
          customOptions.push({
            name: optionType,
            value: trimmedValue
          });
          existingOptions.add(trimmedValue.toLowerCase());
        }
      });
    }
    
    // Remove @ custom options from input for regular processing
    let processedInput = input.replace(customOptionPattern, '').trim();
    
    // Process regular inputs (non-@ options)
    const commaSplit = processedInput.split(',').map((item: string) => item.trim()).filter((item: string) => item.length > 0);
    
    const inputs: string[] = [];
    commaSplit.forEach((phrase: string) => {
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
            phrase.split(/\s+/).forEach((word: string) => {
              if (word.trim().length > 0) {
                inputs.push(word.trim());
              }
            });
          }
        }
      }
    });
    
    // Remove duplicates from regular inputs
    const uniqueInputs = Array.from(new Set(inputs)).filter(input => 
      !existingOptions.has(input.toLowerCase())
    );

    // Process custom @ options first
    customOptions.forEach(customOption => {
      const { name, value } = customOption;
      
      setOptionGroups(prev => {
        const updatedGroups = [...prev];
        let foundGroup = updatedGroups.find(group => group.type === name);
        
        const newOption: Option = {
          id: generateId(),
          name: name,
          value: value,
          textId: name.charAt(0).toUpperCase()
        };
        
        if (foundGroup) {
          foundGroup.options.push(newOption);
        } else {
          updatedGroups.push({
            id: generateId(),
            type: name,
            options: [newOption]
          });
        }
        
        return updatedGroups;
      });
    });

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
          type: z.string(),
          identifier: z.string().optional()
        }))
      });

      // Send request to AI to classify options with more specific prompt
      const result = await generateObject({
        model: groq('gemma2-9b-it'),
        schema: optionClassificationSchema,
        prompt: `Classify these items into appropriate categories. For each item, provide the item name, category type, and optionally a short identifier.

Items to classify: ${uniqueInputs.join(', ')}

Please categorize them into logical groups like Color, Size, Material, Brand, etc. For each item, return:
- option: the original item name
- type: the category it belongs to
- identifier: a short code (optional)

Example format:
- "red" → type: "Color", identifier: "RED"
- "large" → type: "Size", identifier: "L"
- "cotton" → type: "Material", identifier: "COT"`,
        maxRetries: 3,
      });

      console.log('AI Classification Result:', result.object);

             // Process AI results and update option groups
       if (result.object && result.object.classifications) {
         result.object.classifications.forEach(classification => {
           const { option, type, identifier } = classification;
           const displayName = identifier || option.trim();
           const visualProps = getVisualIdentifier(type, option, identifier || '');
           
           // Check for duplicates before adding
           if (!existingOptions.has(option.toLowerCase())) {
             existingOptions.add(option.toLowerCase());
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
       } else {
         // If AI response is invalid, fall back to simple classification
         throw new Error('Invalid AI response format');
       }

    } catch (error) {
      console.error('AI Classification Error:', error);
      
      // Show user-friendly error message
      showSnackbar('AI classification failed, using fallback grouping');
      
             // Fallback to simple classification if AI fails
       uniqueInputs.forEach(singleInput => {
         // Check for duplicates before adding
         if (!existingOptions.has(singleInput.toLowerCase())) {
           existingOptions.add(singleInput.toLowerCase());
           
           // Improved fallback classification
           let defaultType = 'Other';
           const lowerInput = singleInput.toLowerCase();
           
           // Color detection
           if (['red', 'blue', 'green', 'yellow', 'black', 'white', 'gray', 'pink', 'purple', 'orange', 'brown', 'navy', 'lime', 'teal', 'indigo', 'violet', 'rose', 'amber', 'emerald', 'cyan'].includes(lowerInput)) {
             defaultType = 'Color';
           }
           // Size detection
           else if (['xs', 's', 'm', 'l', 'xl', 'xxl', 'small', 'medium', 'large', 'extra small', 'extra large', 'x-small', 'x-large'].includes(lowerInput)) {
             defaultType = 'Size';
           }
           // Material detection
           else if (['cotton', 'leather', 'metal', 'wood', 'silk', 'wool', 'polyester', 'nylon', 'denim', 'linen'].includes(lowerInput)) {
             defaultType = 'Material';
           }
           // Brand detection
           else if (['nike', 'adidas', 'puma', 'reebok', 'under armour', 'apple', 'samsung', 'sony'].includes(lowerInput)) {
             defaultType = 'Brand';
           }
           // Number-based items are likely sizes
           else if (singleInput.match(/^\d+/) || singleInput.includes('cm') || singleInput.includes('inch')) {
             defaultType = 'Size';
           }
           
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

const handleOptionDragStart = (groupId: string, optionId: string) => {
  setDraggedGroupId(groupId);
  setDraggedOptionId(optionId);
  setIsDragging(true);
  showSnackbar('Drag to reorder');
};

const handleOptionDragOver = (targetIndex: number) => {
  setDragTargetIndex(targetIndex);
};

const handleOptionDragEnd = (fromIndex: number, toIndex: number, groupId: string) => {
  if (fromIndex !== toIndex && toIndex !== null && fromIndex !== null) {
    setOptionGroups(prev => {
      const newGroups = [...prev];
      const groupIndex = newGroups.findIndex(g => g.id === groupId);
      
      if (groupIndex !== -1) {
        const group = { ...newGroups[groupIndex] };
        const options = [...group.options];
        
        // Ensure indices are within bounds
        if (fromIndex >= 0 && fromIndex < options.length && 
            toIndex >= 0 && toIndex < options.length) {
          const [draggedOption] = options.splice(fromIndex, 1);
          options.splice(toIndex, 0, draggedOption);
          
          newGroups[groupIndex] = {
            ...group,
            options
          };
          
          // Show success message
          showSnackbar('Option reordered successfully');
        }
      }
      
      return newGroups;
    });
  }
  setDraggedGroupId(null);
  setDraggedOptionId(null);
  setDragTargetIndex(null);
  setIsDragging(false);
};

const renderDraggableItem = ({ item: group, index }: { item: OptionGroup, index: number }) => {
  return (
    <View style={styles.flatOptionSetContainer}>
      <View style={styles.flatOptionSetHeader}>
        <Text style={styles.flatOptionSetName}>{group.type}</Text>
      </View>
      <View style={styles.flatOptionValuesContainer}>
        {group.options.map((option, optionIndex) => {
          const isDragging = draggedOptionId === option.id;
          const isDragTarget = dragTargetIndex === optionIndex && draggedGroupId === group.id;
          
          return (
                         <TouchableOpacity 
               key={option.id} 
               style={[
                 styles.flatOptionValue,
                 draggedOptionId === option.id && styles.draggingOption,
                 isDragTarget && styles.dragTarget,
                 isDragging && draggedOptionId !== option.id && { opacity: 0.7 }
               ]}
              onLongPress={() => handleOptionDragStart(group.id, option.id)}
              onPress={() => {
                if (draggedOptionId && draggedOptionId !== option.id) {
                  // If dragging, handle drop
                  const draggedIndex = group.options.findIndex(opt => opt.id === draggedOptionId);
                  if (draggedIndex !== -1) {
                    handleOptionDragEnd(draggedIndex, optionIndex, group.id);
                  }
                } else {
                  // If not dragging, handle delete
                  handleLongPressDelete(group.id, option.id, option.value);
                }
              }}
              onPressIn={() => {
                if (draggedOptionId && draggedOptionId !== option.id) {
                  handleOptionDragOver(optionIndex);
                }
              }}
              activeOpacity={0.7}
              delayLongPress={300}
            >
              
              
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
              <Text style={styles.flatOptionValueText}>{option.value}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

  // File drag state
  const [draggedFileKey, setDraggedFileKey] = useState<string | null>(null);
  const [dragTargetFileIndex, setDragTargetFileIndex] = useState<number | null>(null);
  const [isDraggingFile, setIsDraggingFile] = useState(false);

  // ImageThumbnail component for handling presigned URLs
  const ImageThumbnail = ({ 
    file, 
    isDragging, 
    isDragTarget, 
    isDraggingFile, 
    onLongPress, 
    onPress, 
    onPressIn 
  }: {
    file: ItemFile;
    isDragging: boolean;
    isDragTarget: boolean;
    isDraggingFile: boolean;
    onLongPress: () => void;
    onPress: () => void;
    onPressIn: () => void;
  }) => {
    const [signedUrl, setSignedUrl] = useState<string | null>(null);
    const [imageError, setImageError] = useState(false);
    const [isLoadingUrl, setIsLoadingUrl] = useState(false);

    // Generate presigned URL for the image
    useEffect(() => {
      if (!signedUrl && !isLoadingUrl && !imageError) {
        setIsLoadingUrl(true);
        r2Service.getSignedUrl(file.key)
          .then(url => {
            console.log('Got presigned URL for', file.key, ':', url);
            setSignedUrl(url);
          })
          .catch(error => {
            console.error('Failed to get presigned URL for', file.key, ':', error);
            setImageError(true);
          })
          .finally(() => {
            setIsLoadingUrl(false);
          });
      }
    }, [file.key, signedUrl, isLoadingUrl, imageError]);

    return (
      <TouchableOpacity
        style={[
          styles.flatFileItem,
          isDragging && styles.draggingFile,
          isDragTarget && styles.dragTarget,
          isDraggingFile && { opacity: 0.7 }
        ]}
        onLongPress={onLongPress}
        onPress={onPress}
        onPressIn={onPressIn}
        activeOpacity={0.7}
        delayLongPress={300}
      >
        <View style={styles.fileItemContent}>
          <View style={styles.fileThumbnail}>
            {isLoadingUrl ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color="#3b82f6" />
              </View>
            ) : signedUrl && !imageError ? (
              <Image 
                source={{ uri: signedUrl }} 
                style={styles.thumbnailImage}
                resizeMode="cover"
                onError={() => {
                  console.error('Image failed to load:', signedUrl);
                  setImageError(true);
                }}
              />
            ) : (
              <View style={styles.errorContainer}>
                <Feather name="image" size={16} color="#94a3b8" />
              </View>
            )}
          </View>
          <Text style={styles.fileItemText}>{file.filename}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const handleFileDragStart = (fileKey: string) => {
    setDraggedFileKey(fileKey);
    setIsDraggingFile(true);
    showSnackbar('Drag to reorder files');
  };

  const handleFileDragOver = (targetIndex: number) => {
    setDragTargetFileIndex(targetIndex);
  };

  const handleFileDragEnd = (fromIndex: number, toIndex: number, fileType: 'image' | 'document') => {
    if (fromIndex !== toIndex && toIndex !== null && fromIndex !== null) {
      if (fileType === 'image') {
        setImages(prev => {
          const newImages = [...prev];
          if (fromIndex >= 0 && fromIndex < newImages.length && 
              toIndex >= 0 && toIndex < newImages.length) {
            const [draggedFile] = newImages.splice(fromIndex, 1);
            newImages.splice(toIndex, 0, draggedFile);
            showSnackbar('Image reordered successfully');
          }
          return newImages;
        });
      } else {
        setDocuments(prev => {
          const newDocuments = [...prev];
          if (fromIndex >= 0 && fromIndex < newDocuments.length && 
              toIndex >= 0 && toIndex < newDocuments.length) {
            const [draggedFile] = newDocuments.splice(fromIndex, 1);
            newDocuments.splice(toIndex, 0, draggedFile);
            showSnackbar('Document reordered successfully');
          }
          return newDocuments;
        });
      }
    }
    setDraggedFileKey(null);
    setDragTargetFileIndex(null);
    setIsDraggingFile(false);
};

  const renderFilesContent = () => {
    return (
      <View style={styles.filesContainer}>
        {/* Files List */}
        <View style={styles.filesListContainer}>
          {/* Primary Image */}
          {images.length > 0 && (
        <View style={styles.fileSection}>
              <Text style={styles.fileSectionTitle}>Primary Image</Text>
              <ImageThumbnail
                file={images[0]}
                isDragging={draggedFileKey === images[0].key}
                isDragTarget={dragTargetFileIndex === 0 && draggedFileKey !== images[0].key}
                isDraggingFile={isDraggingFile && draggedFileKey !== images[0].key}
                onLongPress={() => handleFileDragStart(images[0].key)}
                onPress={() => {
                  if (draggedFileKey && draggedFileKey !== images[0].key) {
                    const draggedIndex = images.findIndex(file => file.key === draggedFileKey);
                    if (draggedIndex !== -1) {
                      handleFileDragEnd(draggedIndex, 0, 'image');
                    }
                  } else {
                    handleDeleteFile(images[0].key, 'image');
                  }
                }}
                onPressIn={() => {
                  if (draggedFileKey && draggedFileKey !== images[0].key) {
                    handleFileDragOver(0);
                  }
                }}
              />
            </View>
          )}

          {/* Additional Images */}
          {images.length > 1 && (
            <View style={styles.fileSection}>
              <Text style={styles.fileSectionTitle}>Additional Images</Text>
              {images.slice(1).map((file, index) => (
                <ImageThumbnail
                  key={file.key}
                  file={file}
                  isDragging={draggedFileKey === file.key}
                  isDragTarget={dragTargetFileIndex === index + 1 && draggedFileKey !== file.key}
                  isDraggingFile={isDraggingFile && draggedFileKey !== file.key}
                  onLongPress={() => handleFileDragStart(file.key)}
                  onPress={() => {
                    if (draggedFileKey && draggedFileKey !== file.key) {
                      const draggedIndex = images.findIndex(f => f.key === draggedFileKey);
                      if (draggedIndex !== -1) {
                        handleFileDragEnd(draggedIndex, index + 1, 'image');
                      }
                    } else {
                      handleDeleteFile(file.key, 'image');
                    }
                  }}
                  onPressIn={() => {
                    if (draggedFileKey && draggedFileKey !== file.key) {
                      handleFileDragOver(index + 1);
                    }
                  }}
                />
              ))}
            </View>
          )}

          {/* Documents */}
          {documents.length > 0 && (
        <View style={styles.fileSection}>
              <Text style={styles.fileSectionTitle}>Documents</Text>
              {documents.map((file, index) => (
                <TouchableOpacity
                  key={file.key}
                  style={[
                    styles.flatFileItem,
                    draggedFileKey === file.key && styles.draggingFile,
                    dragTargetFileIndex === index && draggedFileKey !== file.key && styles.dragTarget,
                    isDraggingFile && draggedFileKey !== file.key && { opacity: 0.7 }
                  ]}
                  onLongPress={() => handleFileDragStart(file.key)}
                  onPress={() => {
                    if (draggedFileKey && draggedFileKey !== file.key) {
                      const draggedIndex = documents.findIndex(f => f.key === draggedFileKey);
                      if (draggedIndex !== -1) {
                        handleFileDragEnd(draggedIndex, index, 'document');
                      }
                    } else {
                      handleDeleteFile(file.key, 'document');
                    }
                  }}
                  onPressIn={() => {
                    if (draggedFileKey && draggedFileKey !== file.key) {
                      handleFileDragOver(index);
                    }
                  }}
                  activeOpacity={0.7}
                  delayLongPress={300}
                >
                  <View style={styles.fileItemContent}>
                    <Feather name="file" size={20} color="#3b82f6" />
                    <Text style={styles.fileItemText}>{file.filename}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Empty State */}
          {images.length === 0 && documents.length === 0 && (
            <View style={styles.filesEmptyState}>
              <Feather name="folder" size={48} color="#94a3b8" />
              <Text style={styles.filesEmptyTitle}>No Files Yet</Text>
              <Text style={styles.filesEmptySubtitle}>
                Use the upload buttons below to add images and documents
              </Text>
            </View>
          )}
        </View>

        {/* File Upload Components (Hidden) */}
        <View style={styles.hiddenFileUploads}>
          <FileUpload
            onUploadComplete={handleImageUpload}
            onUploadError={handleFileUploadError}
            fileType="image"
            allowMultiple={true}
            maxFiles={5}
            folder="items/images"
            ref={imageUploadRef}
          />
          <FileUpload
            onUploadComplete={handleDocumentUpload}
            onUploadError={handleFileUploadError}
            fileType="document"
            allowMultiple={true}
            maxFiles={3}
            folder="items/documents"
            ref={documentUploadRef}
          />
            </View>
      </View>
    );
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'inventory':
        return <View style={styles.tabContentContainer}><Text style={styles.tabContentText}>Inventory Content</Text></View>;
case 'options':
  return (
    <View style={styles.optionsContainer}>
      {optionGroups.length === 0 ? (
        <View style={styles.emptyOptionsState}>
          <Feather name="tag" size={48} color="#94a3b8" />
          <Text style={styles.emptyOptionsTitle}>No Options Yet</Text>
          <Text style={styles.emptyOptionsSubtitle}>
            Type options below to get started{"\n"}
            e.g., "red blue green" or "small medium large"{"\n"}
            Use @ to create custom groups: "@brand Nike Adidas"
          </Text>
        </View>
      ) : (
        <FlatList
          data={optionGroups}
          keyExtractor={(item) => item.id}
          renderItem={renderDraggableItem}
          showsVerticalScrollIndicator={false}
          scrollEnabled={true}
          contentContainerStyle={styles.optionsListContainer}
          style={{ flex: 1 }}
        />
      )}
    </View>
  );
case 'files':
        return (
          <View style={styles.filesContainer}>
            {renderFilesContent()}
            <View style={styles.fileUploadButtonsContainer}>
              <TouchableOpacity
                style={styles.fileUploadButton}
                onPress={() => imageUploadRef.current?.handleUpload()}
              >
                <Feather name="image" size={20} color="#3b82f6" />
                <Text style={styles.fileUploadButtonText}>Add Images</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.fileUploadButton}
                onPress={() => documentUploadRef.current?.handleUpload()}
              >
                <Feather name="file-text" size={20} color="#3b82f6" />
                <Text style={styles.fileUploadButtonText}>Add Documents</Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      case 'notes':
        return <View style={styles.tabContentContainer}><Text style={styles.tabContentText}>Notes Content</Text></View>;
      case 'labels':
        return <View style={styles.tabContentContainer}><Text style={styles.tabContentText}>Labels Content</Text></View>;
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
                           <View 
          style={[
            styles.content,
            { marginBottom: activeTab === 'options' ? 0 : 20 }
          ]} 
        >
         {renderTabContent()}
       </View>
             
       
                               {/* Perfect AI Input Bar - Only show on options tab */}
         {activeTab === 'options' && (
           <View style={[
             styles.perfectAiInputContainer,
             {
               position: 'absolute',
               bottom: keyboardHeight,
               left: 0,
               right: 0,
             }
           ]}>
             {/* Main Input Area */}
             <View style={styles.perfectInputWrapper}>
               <View style={styles.perfectInputInner}>
                 <TextInput
                   style={styles.perfectInput}
                   placeholder="Type options or use @ to create custom groups..."
                   placeholderTextColor="#9ca3af"
                   value={aiInput}
                   onChangeText={setAiInput}
                   multiline={true}
                   maxLength={500}
                   returnKeyType="default"
                   blurOnSubmit={false}
                 />
                 <TouchableOpacity 
                   style={[
                     styles.perfectSendButton,
                     !aiInput.trim() && styles.perfectSendButtonDisabled
                   ]}
                   onPress={() => handleMainAiInput(aiInput)}
                   disabled={!aiInput.trim()}
                   activeOpacity={0.7}
                   hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                 >
                   <Feather name="send" size={18} color="#ffffff" />
                 </TouchableOpacity>
               </View>
             </View>
             
             {/* Suggestion Chips at Bottom */}
             <View style={styles.perfectSuggestionsContainer}>
               <ScrollView 
                 horizontal 
                 showsHorizontalScrollIndicator={false}
                 contentContainerStyle={styles.perfectSuggestionsScrollContent}
               >
                 {optionTypeSuggestions.map((suggestion, index) => (
                                    <TouchableOpacity
                   key={index}
                   style={styles.perfectSuggestionChip}
                   onPress={() => setAiInput(prev => prev + suggestion)}
                   activeOpacity={0.6}
                   hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                 >
                     <Text style={styles.perfectSuggestionChipText}>{suggestion}</Text>
                   </TouchableOpacity>
                 ))}
               </ScrollView>
             </View>
           </View>
         )}


       
       {/* Snackbar */}
       {snackbarVisible && (
         <Animated.View 
           style={[
             styles.snackbar,
             { opacity: snackbarOpacity }
           ]}
         >
           <Text style={styles.snackbarText}>{snackbarMessage}</Text>
         </Animated.View>
       )}
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
  tabContentContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
  },
  tabContentText: {
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
           aiInputWrapper: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        backgroundColor: '#ffffff',
        borderRadius: 24,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        paddingHorizontal: 16,
        paddingVertical: 8,
      },
   aiInput: {
     flex: 1,
     fontSize: 16,
     backgroundColor: 'transparent',
     paddingVertical: 8,
     paddingHorizontal: 0,
     marginRight: 8,
     maxHeight: 100,
     textAlignVertical: 'top',
   },
   sendButton: {
     backgroundColor: '#3b82f6',
     padding: 8,
     borderRadius: 20,
     alignItems: 'center',
     justifyContent: 'center',
     minWidth: 36,
     minHeight: 36,
   },
   sendButtonDisabled: {
     backgroundColor: '#d1d5db',
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
    flexDirection: 'row',
    alignItems: 'center',
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
    backgroundColor: '#ffffff',
  },
  flatOptionValue: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    paddingLeft: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    backgroundColor: '#ffffff',
  },
  flatOptionValueText: {
    fontSize: 15,
    color: '#374151',
    marginLeft: 12,
    flex: 1,
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
    marginBottom: 20,
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
    height: '100%',
    minHeight: 0,
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
   // Snackbar styles
   snackbar: {
     position: 'absolute',
     bottom: 100,
     left: 20,
     right: 20,
     backgroundColor: '#1f2937',
     paddingHorizontal: 16,
     paddingVertical: 12,
     borderRadius: 8,
     shadowColor: '#000',
     shadowOffset: {
       width: 0,
       height: 2,
     },
     shadowOpacity: 0.25,
     shadowRadius: 4,
     elevation: 5,
   },
   snackbarText: {
     color: '#ffffff',
     fontSize: 14,
     fontWeight: '500',
     textAlign: 'center',
   },
  draggingOption: {
    opacity: 0.7,
    transform: [{ scale: 1.02 }],
    backgroundColor: '#f8fafc',
  },
     dragTarget: {
     backgroundColor: '#fef3c7',
     borderColor: '#f59e0b',
     borderWidth: 1,
   },
         optionsListContainer: {
    paddingBottom: 20,
    flexGrow: 1,
    minHeight: '100%',
  },
                   suggestionsContainer: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderTopWidth: 1,
        borderTopColor: '#e5e7eb',
        backgroundColor: '#fafafa',
      },
    suggestionsScrollContent: {
      paddingHorizontal: 4,
    },
         suggestionChip: {
       paddingHorizontal: 12,
       paddingVertical: 8,
       backgroundColor: '#ffffff',
       borderRadius: 20,
       borderWidth: 1,
       borderColor: '#d1d5db',
       marginRight: 8,
       shadowColor: '#000',
       shadowOffset: {
         width: 0,
         height: 1,
       },
       shadowOpacity: 0.1,
       shadowRadius: 2,
       elevation: 1,
     },
           suggestionChipText: {
        fontSize: 14,
        color: '#374151',
        fontWeight: '500',
      },
             suggestionsTitle: {
         fontSize: 12,
         color: '#6b7280',
         fontWeight: '600',
         marginBottom: 8,
         marginLeft: 4,
       },
       // Cursor AI Input Styles
       cursorInputWrapper: {
         backgroundColor: '#ffffff',
         borderTopWidth: 1,
         borderTopColor: '#e5e7eb',
         paddingHorizontal: 16,
         paddingVertical: 12,
       },
       cursorInputInner: {
         flexDirection: 'row',
         alignItems: 'flex-end',
         backgroundColor: '#f9fafb',
         borderRadius: 12,
         borderWidth: 1,
         borderColor: '#d1d5db',
         paddingHorizontal: 12,
         paddingVertical: 8,
         minHeight: 44,
       },
       cursorInput: {
         flex: 1,
         fontSize: 15,
         color: '#374151',
         backgroundColor: 'transparent',
         paddingVertical: 8,
         paddingHorizontal: 0,
         marginRight: 8,
         maxHeight: 120,
         textAlignVertical: 'top',
       },
       cursorSendButton: {
         backgroundColor: '#3b82f6',
         padding: 8,
         borderRadius: 8,
         alignItems: 'center',
         justifyContent: 'center',
         minWidth: 32,
         minHeight: 32,
       },
       cursorSendButtonDisabled: {
         backgroundColor: '#d1d5db',
       },
       cursorSuggestionsContainer: {
         paddingHorizontal: 16,
         paddingVertical: 8,
         backgroundColor: '#ffffff',
         borderTopWidth: 1,
         borderTopColor: '#f3f4f6',
       },
       cursorSuggestionsScrollContent: {
         paddingHorizontal: 4,
       },
       cursorSuggestionChip: {
         paddingHorizontal: 10,
         paddingVertical: 6,
         backgroundColor: '#f3f4f6',
         borderRadius: 16,
         borderWidth: 1,
         borderColor: '#e5e7eb',
         marginRight: 8,
       },
               cursorSuggestionChipText: {
          fontSize: 13,
          color: '#6b7280',
          fontWeight: '500',
        },
                 // Perfect AI Input Styles - Flat Design
         perfectAiInputContainer: {
           backgroundColor: '#ffffff',
           borderTopWidth: 1,
           borderTopColor: '#f1f5f9',
           position: 'relative',
           zIndex: 1000,
         },
         perfectInputWrapper: {
           paddingHorizontal: 16,
           paddingVertical: 8,
           backgroundColor: '#ffffff',
           position: 'relative',
         },
         perfectInputInner: {
           flexDirection: 'row',
           alignItems: 'flex-end',
           backgroundColor: '#ffffff',
           borderRadius: 8,
           borderWidth: 1,
           borderColor: '#e5e7eb',
           paddingHorizontal: 12,
           paddingVertical: 8,
           minHeight: 44,
           position: 'relative',
         },
         perfectInput: {
           flex: 1,
           fontSize: 15,
           color: '#374151',
           backgroundColor: 'transparent',
           paddingVertical: 6,
           paddingHorizontal: 0,
           marginRight: 8,
           maxHeight: 100,
           textAlignVertical: 'top',
           includeFontPadding: false,
         },
         perfectSendButton: {
           backgroundColor: '#3b82f6',
           padding: 8,
           borderRadius: 6,
           alignItems: 'center',
           justifyContent: 'center',
           minWidth: 36,
           minHeight: 36,
         },
         perfectSendButtonDisabled: {
           backgroundColor: '#d1d5db',
         },
         perfectSuggestionsContainer: {
           paddingHorizontal: 16,
           paddingVertical: 8,
           backgroundColor: '#ffffff',
           borderTopWidth: 1,
           borderTopColor: '#f8fafc',
         },
         perfectSuggestionsScrollContent: {
           paddingHorizontal: 4,
         },
         perfectSuggestionChip: {
           paddingHorizontal: 10,
           paddingVertical: 6,
           backgroundColor: '#ffffff',
           borderRadius: 16,
           borderWidth: 1,
           borderColor: '#e5e7eb',
           marginRight: 8,
         },
         perfectSuggestionChipText: {
           fontSize: 13,
           color: '#6b7280',
           fontWeight: '500',
         },
  // Files AI Input Styles
  filesAiInputContainer: {
    width: '100%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  filesInputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#ffffff',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  filesInputInner: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#ffffff',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  filesInput: {
    flex: 1,
    fontSize: 16,
    backgroundColor: 'transparent',
    paddingVertical: 8,
    paddingHorizontal: 0,
    marginRight: 8,
    maxHeight: 100,
    textAlignVertical: 'top',
  },
  filesSendButton: {
    backgroundColor: '#3b82f6',
    padding: 8,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 36,
    minHeight: 36,
  },
  filesSendButtonDisabled: {
    backgroundColor: '#d1d5db',
  },
  filesSuggestionsContainer: {
    marginTop: 10,
    paddingHorizontal: 4,
  },
  filesSuggestionsScrollContent: {
    paddingHorizontal: 4,
  },
  filesSuggestionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginRight: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  filesSuggestionChipText: {
    fontSize: 14,
    color: '#3b82f6',
    fontWeight: '500',
    marginLeft: 6,
  },
  // Hidden File Uploads (for actual file upload components)
  hiddenFileUploads: {
    display: 'none', // Hide these components from the main UI
  },
  // Files List Container
  filesListContainer: {
    width: '100%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    paddingBottom: 80, // Add padding for the buttons
  },
  fileSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 12,
  },
  filesEmptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 40,
  },
  filesEmptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#374151',
    marginTop: 16,
    marginBottom: 8,
  },
  filesEmptySubtitle: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  // Files Container
  filesContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
    height: '100%',
    minHeight: 0,
  },
  // File Upload Buttons (at bottom)
  fileUploadButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  fileUploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  fileUploadButtonText: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '500',
    marginLeft: 6,
  },
  // Flat File Items (similar to flat options)
  flatFileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    marginBottom: 4,
  },
  draggingFile: {
    backgroundColor: '#dbeafe',
    borderColor: '#3b82f6',
    borderWidth: 1,
  },
  fileItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  fileItemText: {
    fontSize: 14,
    color: '#1e293b',
    marginLeft: 12,
    flex: 1,
  },
  // File thumbnail styles
  fileThumbnail: {
    width: 40,
    height: 40,
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: '#f1f5f9',
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  loadingContainer: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
  },
  errorContainer: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
  },
});
