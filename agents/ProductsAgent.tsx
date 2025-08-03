import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useModule } from '../context/ModuleContext';
import { groq } from '@ai-sdk/groq';
import { generateObject } from 'ai';
import { z } from 'zod';
import { getGroqApiKey, logEnvironmentStatus } from '../config/env';
import { FileUpload, FileItem } from '../components/FileUpload';
import { r2Service } from '../lib/r2-service';

// Define the schema for structured output
const productFieldsSchema = z.object({
  name: z.string().default('').describe('Product name'),
  shortNote: z.string().default('').describe('Brief product note or tagline'),
  description: z.string().default('').describe('Detailed product description'),
  price: z.string().default('$0.00').describe('Product price in USD format like $29.99'),
  sku: z.string().default('').describe('Product SKU code'),
  stock: z.string().default('0').describe('Stock quantity as a number string'),
  brand: z.string().default('').describe('Product brand name'),
  material: z.string().default('').describe('Primary material of the product'),
  weight: z.string().default('').describe('Product weight with unit'),
  dimensions: z.string().default('').describe('Product dimensions in L x W x H format'),
  category: z.string().default('').describe('Product category that matches Google Shopping categories'),
  tags: z.string().default('').describe('Comma-separated tags for the product'),
  collection: z.string().default('').describe('Product collection name'),
  productType: z.string().default('Physical').describe('Type of product - Physical, Digital, or Service'),
  type: z.string().default('').describe('Specific product type like in Shopify'),
});

// Schema for AI-suggested option types
const suggestedOptionTypesSchema = z.object({
  suggestedOptions: z.array(z.string()).describe('Array of 5-6 relevant option type names like ["Size", "Color", "Material", "Style", "Fit", "Pattern"]'),
});

// Schema for generating option values with identifiers
const optionValuesSchema = z.object({
  values: z.array(z.object({
    name: z.string().describe('Display name of the option value'),
    identifier: z.string().describe('Unique identifier/code for this value (e.g., SM, MD, LG for sizes)'),
  })).describe('Array of option values with identifiers'),
});

// Schema for generating variants
const variantsSchema = z.object({
  variants: z.array(z.object({
    name: z.string().describe('Variant display name combining option values'),
    sku: z.string().describe('Unique SKU for this variant'),
    price: z.string().describe('Price for this variant'),
    stock: z.string().describe('Stock quantity for this variant'),
    identifierCombination: z.string().describe('Combination of option identifiers (e.g., SM-RED)'),
  })).describe('Array of product variants'),
});

// Product option value interface
interface OptionValue {
  id: string;
  name: string;
  identifier: string;
}

// Product option interface
interface ProductOption {
  id: string;
  name: string;
  values: OptionValue[];
}

// Product variant interface
interface ProductVariant {
  id: string;
  name: string;
  sku: string;
  price: string;
  stock: string;
  identifierCombination: string;
  optionValues: { [optionId: string]: string }; // Maps option ID to selected value ID
}

// File metadata interface for uploaded files
interface ProductFile {
  key: string;
  url: string;
  filename: string;
  size: number;
  contentType: string;
  uploadedAt: Date;
}

interface ProductData {
  name: string;
  shortNote: string;
  description: string;
  price: string;
  sku: string;
  stock: string;
  brand: string;
  material: string;
  weight: string;
  dimensions: string;
  category: string;
  tags: string;
  collection: string;
  productType: string;
  type: string;
  // File management
  images: ProductFile[];
  documents: ProductFile[];
  // Product options and variants
  options: ProductOption[];
  variants: ProductVariant[];
}

export default function ProductsAgent() {
  const { pageProp, setPageProp } = useModule();
  const [activeTab, setActiveTab] = useState('core');
  const [isGenerating, setIsGenerating] = useState(false);
  const [optionValueInput, setOptionValueInput] = useState('');
  const [isGeneratingVariants, setIsGeneratingVariants] = useState(false);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [keyboardInputValue, setKeyboardInputValue] = useState('');
  const [isKeyboardInputFocused, setIsKeyboardInputFocused] = useState(false);
  const [quickInput, setQuickInput] = useState('');
  const [suggestedOptionTypes, setSuggestedOptionTypes] = useState<string[]>([]);
  const [selectedOptionTypes, setSelectedOptionTypes] = useState<string[]>([]);
  const [showOptionTypeSelector, setShowOptionTypeSelector] = useState(false);
  const [productData, setProductData] = useState<ProductData>({
    name: '',
    shortNote: '',
    description: '',
    price: '',
    sku: '',
    stock: '',
    brand: '',
    material: '',
    weight: '',
    dimensions: '',
    category: '',
    tags: '',
    collection: '',
    productType: '',
    type: '',
    images: [],
    documents: [],
    options: [],
    variants: [],
  });

  const updateField = (field: keyof ProductData, value: string) => {
    setProductData(prev => ({ ...prev, [field]: value }));
  };

  // Auto-regenerate items when base product data changes
  useEffect(() => {
    if (productData.options.some(opt => opt.values.length > 0)) {
      const timeoutId = setTimeout(() => autoGenerateItems(), 200);
      return () => clearTimeout(timeoutId);
    }
  }, [productData.name, productData.sku, productData.price]);

  // Update module context when product data changes for real-time top bar updates
  useEffect(() => {
    setPageProp({
      title: productData.name || 'Product Agent',
      id: 'products-agent',
      subtitle: productData.shortNote || undefined,
      icon: productData.images.length > 0 
        ? {
            type: 'image' as const,
            source: productData.images[0].url,
            style: 'tile' as const
          }
        : {
            type: 'icon' as const,
            name: 'package',
            style: 'tile' as const
          }
    });
  }, [productData.name, productData.shortNote, productData.images, setPageProp]);

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
  const handleImageUpload = (files: ProductFile[]) => {
    setProductData(prev => ({
      ...prev,
      images: [...prev.images, ...files],
    }));
  };

  const handleDocumentUpload = (files: ProductFile[]) => {
    setProductData(prev => ({
      ...prev,
      documents: [...prev.documents, ...files],
    }));
  };

  const handleFileUploadError = (error: string) => {
    console.error('Upload error:', error);
  };

  const handleDeleteFile = async (key: string, fileType: 'image' | 'document') => {
    try {
      const success = await r2Service.deleteFile(key);
      if (success) {
        setProductData(prev => ({
          ...prev,
          [fileType === 'image' ? 'images' : 'documents']: prev[fileType === 'image' ? 'images' : 'documents'].filter(file => file.key !== key),
        }));
      }
    } catch (error) {
      console.error('Error deleting file:', error);
    }
  };

  const generateProductFields = async () => {
    // Allow generation even with empty fields - AI will create everything
    const inputHint = productData.name.trim() || productData.shortNote.trim()
      ? `Based on: ${productData.name || 'Product'} - ${productData.shortNote || 'Description'}`
      : 'Generate a complete product from scratch';

    setIsGenerating(true);

    try {
      // Log environment status for debugging
      logEnvironmentStatus();

      // Get API key using the centralized config helper
      const apiKey = getGroqApiKey();

      // Ensure the environment variable is set for the AI SDK
      if (typeof process !== 'undefined' && process.env) {
        process.env.GROQ_API_KEY = apiKey;
      }

      console.log('API Key loaded successfully:', {
        keyLength: apiKey.length,
        keyStart: apiKey.substring(0, 10)
      });

      console.log('Generating fields with AI SDK...');

      const result = await generateObject({
        model: groq('gemma2-9b-it'),
        schema: productFieldsSchema,
        prompt: `You are a product data generator. Generate realistic e-commerce product information.

${inputHint}

Generate ALL the following fields with realistic data:

1. name: Creative product name (if not provided or improve existing)
2. shortNote: Brief catchy tagline or description (if not provided or improve existing)
3. description: Write a detailed product description (2-3 sentences)
4. price: Format as $XX.XX (e.g., $29.99)
5. sku: Generate a product SKU code (e.g., ABC-123-XYZ)
6. stock: Number as string (e.g., "25")
7. brand: Product brand name
8. material: Primary material
9. weight: Weight with unit (e.g., "1.2 lbs")
10. dimensions: L x W x H format (e.g., "10 x 8 x 2 inches")
11. category: Google Shopping format (e.g., "Electronics > Computers > Laptops")
12. tags: Comma-separated tags (e.g., "electronics, laptop, gaming")
13. collection: Product collection name
14. productType: MUST be exactly "Physical", "Digital", or "Service"
15. type: Specific type (e.g., "Laptop", "T-Shirt", "Software")

Create a cohesive product that makes sense. If input is provided, enhance it. If no input, create from scratch.

Respond with valid JSON only.`,
        maxRetries: 2,
      });

      console.log('Generated fields:', result.object);

      // Validate productType and set default if invalid
      const validProductTypes = ['Physical', 'Digital', 'Service'];
      const productType = validProductTypes.includes(result.object.productType)
        ? result.object.productType
        : 'Physical';

      // Update the product data with generated fields (including name and shortNote)
      setProductData(prev => ({
        ...prev,
        name: result.object.name || prev.name || 'Generated Product',
        shortNote: result.object.shortNote || prev.shortNote || 'AI Generated',
        description: result.object.description || '',
        price: result.object.price || '$0.00',
        sku: result.object.sku || '',
        stock: result.object.stock || '0',
        brand: result.object.brand || '',
        material: result.object.material || '',
        weight: result.object.weight || '',
        dimensions: result.object.dimensions || '',
        category: result.object.category || '',
        tags: result.object.tags || '',
        collection: result.object.collection || '',
        productType: productType,
        type: result.object.type || '',
      }));

      // Generate AI-suggested option types
      await generateSuggestedOptionTypes();
    } catch (error) {
      console.error('Error generating fields:', error);

      // Fallback: Generate basic fields manually if AI fails
      const fallbackData = {
        name: productData.name || 'Generated Product',
        shortNote: productData.shortNote || 'AI Generated Product',
        description: `${productData.name || 'Generated Product'} - ${productData.shortNote || 'AI Generated Product'}. High-quality product with excellent features and reliable performance.`,
        price: '$29.99',
        sku: `SKU-${Date.now().toString().slice(-6)}`,
        stock: '50',
        brand: 'Generic Brand',
        material: 'Mixed Materials',
        weight: '1.0 lbs',
        dimensions: '10 x 8 x 2 inches',
        category: 'General > Products',
        tags: (productData.name || 'product').toLowerCase().split(' ').join(', '),
        collection: 'Standard Collection',
        productType: 'Physical',
        type: 'Product',
      };

      setProductData(prev => ({
        ...prev,
        ...fallbackData,
      }));

      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error('AI Generation Failed:', errorMessage);
    } finally {
      setIsGenerating(false);
    }
  };

  const generateSuggestedOptionTypes = async () => {
    if (!productData.name.trim() && !productData.type.trim()) {
      return;
    }

    try {
      const apiKey = getGroqApiKey();
      if (typeof process !== 'undefined' && process.env) {
        process.env.GROQ_API_KEY = apiKey;
      }

      const result = await generateObject({
        model: groq('gemma2-9b-it'),
        schema: suggestedOptionTypesSchema,
        prompt: `You are helping suggest relevant product option types for e-commerce.

Product: ${productData.name}
Type: ${productData.type}
Category: ${productData.category}
Description: ${productData.description}

Based on this product, suggest 5-6 relevant option types that customers would typically choose from when buying this product.

Examples by category:
- Clothing: Size, Color, Material, Style, Fit, Pattern
- Electronics: Storage, Color, Model, Connectivity, Screen Size, RAM
- Food/Beverage: Size, Flavor, Quantity, Pack Size, Strength, Type
- Furniture: Size, Color, Material, Style, Finish, Configuration
- Books: Format, Language, Edition, Binding, Age Group
- Cosmetics: Shade, Size, Type, Finish, Coverage, SPF

Choose the most relevant options for this specific product. Avoid generic options that don't make sense.

Respond with valid JSON only.`,
        maxRetries: 2,
      });

      setSuggestedOptionTypes(result.object.suggestedOptions);
      setShowOptionTypeSelector(true);

    } catch (error) {
      console.error('Error generating suggested option types:', error);
      
      // Fallback to smart detection
      const productContext = `${productData.name} ${productData.type} ${productData.category}`.toLowerCase();
      let fallbackOptions: string[] = [];

      if (productContext.includes('shirt') || productContext.includes('dress') || 
          productContext.includes('pants') || productContext.includes('clothing') ||
          productContext.includes('apparel') || productContext.includes('fashion')) {
        fallbackOptions = ['Size', 'Color', 'Material', 'Style', 'Fit', 'Pattern'];
      } else if (productContext.includes('phone') || productContext.includes('laptop') || 
                 productContext.includes('electronic') || productContext.includes('device')) {
        fallbackOptions = ['Storage', 'Color', 'Model', 'Connectivity', 'Screen Size', 'RAM'];
      } else if (productContext.includes('food') || productContext.includes('drink') || 
                 productContext.includes('beverage') || productContext.includes('snack')) {
        fallbackOptions = ['Size', 'Flavor', 'Quantity', 'Pack Size', 'Type', 'Strength'];
      } else if (productContext.includes('furniture') || productContext.includes('chair') || 
                 productContext.includes('table') || productContext.includes('home')) {
        fallbackOptions = ['Size', 'Color', 'Material', 'Style', 'Finish', 'Configuration'];
      } else {
        fallbackOptions = ['Size', 'Color', 'Material', 'Style', 'Type', 'Variant'];
      }

      setSuggestedOptionTypes(fallbackOptions);
      setShowOptionTypeSelector(true);
    }
  };

  const handleOptionTypeSelection = (optionType: string) => {
    if (selectedOptionTypes.includes(optionType)) {
      setSelectedOptionTypes(prev => prev.filter(type => type !== optionType));
    } else if (selectedOptionTypes.length < 3) {
      setSelectedOptionTypes(prev => [...prev, optionType]);
    }
  };

  const confirmOptionTypes = () => {
    if (selectedOptionTypes.length === 0) {
      return;
    }

    const newOptions: ProductOption[] = selectedOptionTypes.map((optionType, index) => ({
      id: `option-${Date.now()}-${index}`,
      name: optionType,
      values: [],
    }));

    setProductData(prev => ({
      ...prev,
      options: newOptions,
    }));

    setShowOptionTypeSelector(false);
    setSelectedOptionTypes([]);
    setSuggestedOptionTypes([]);
  };

  const parseOptionValues = (input: string, optionName: string) => {
    if (!input.trim()) return [];

    // Smart parsing with unit preservation
    const values = input.split(/[,\s]+/).filter(v => v.trim());
    
    return values.map((value, index) => {
      const cleanValue = value.trim();
      let displayName = '';
      let identifier = '';

      // Handle different value formats
      if (cleanValue.match(/^\d+\s*(gb|mb|tb|kg|g|lb|oz|ml|l|cm|mm|m|ft|in|inch|inches)$/i)) {
        // Values with units: "32gb", "1kg", "500ml"
        const match = cleanValue.match(/^(\d+)\s*([a-z]+)$/i);
        if (match) {
          const [, number, unit] = match;
          displayName = `${number}${unit.toUpperCase()}`;
          identifier = `${number}${unit.substring(0, 2).toUpperCase()}`;
        }
      } else if (cleanValue.match(/^\d+$/)) {
        // Pure numbers: "32", "64", "128"
        displayName = cleanValue;
        identifier = cleanValue;
      } else if (cleanValue.match(/^[a-z]+$/i)) {
        // Text values: "small", "red", "cotton"
        displayName = cleanValue.charAt(0).toUpperCase() + cleanValue.slice(1).toLowerCase();
        
        // Smart identifier generation based on option type
        if (optionName.toLowerCase() === 'size') {
          const sizeMap: { [key: string]: string } = {
            'extra small': 'XS', 'small': 'SM', 'medium': 'MD', 'large': 'LG', 
            'extra large': 'XL', 'xxl': 'XXL', 'xxxl': 'XXXL'
          };
          identifier = sizeMap[cleanValue.toLowerCase()] || cleanValue.substring(0, 3).toUpperCase();
        } else if (optionName.toLowerCase() === 'color') {
          const colorMap: { [key: string]: string } = {
            'red': 'RED', 'blue': 'BLU', 'green': 'GRN', 'black': 'BLK', 'white': 'WHT',
            'yellow': 'YEL', 'orange': 'ORG', 'purple': 'PUR', 'pink': 'PNK', 'brown': 'BRN'
          };
          identifier = colorMap[cleanValue.toLowerCase()] || cleanValue.substring(0, 3).toUpperCase();
        } else {
          identifier = cleanValue.substring(0, 3).toUpperCase();
        }
      } else {
        // Complex values: "extra large", "dark blue"
        displayName = cleanValue.split(' ').map(word => 
          word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        ).join(' ');
        identifier = cleanValue.split(' ').map(word => word.charAt(0)).join('').toUpperCase();
      }

      return {
        id: `value-${Date.now()}-${index}`,
        name: displayName,
        identifier: identifier,
      };
    });
  };

  const generateOptionValues = (input: string) => {
    if (!input.trim() || !selectedOptionId) return;

    const option = productData.options.find(opt => opt.id === selectedOptionId);
    if (!option) return;

    const newValues = parseOptionValues(input, option.name);

    const updatedOptions = productData.options.map(opt =>
      opt.id === selectedOptionId 
        ? { ...opt, values: [...opt.values, ...newValues] }
        : opt
    );

    setProductData(prev => ({
      ...prev,
      options: updatedOptions,
    }));

    // Clear both input states
    setOptionValueInput('');
    setKeyboardInputValue('');
    
    // Auto-generate items with updated options
    setTimeout(() => autoGenerateItems(updatedOptions, productData), 50);
  };

  const handleQuickInput = (input: string) => {
    if (!input.trim()) return;

    // Determine target option
    const targetOption = selectedOptionId 
      ? productData.options.find(opt => opt.id === selectedOptionId)
      : productData.options[0]; // Default to first option

    if (!targetOption) {
      return;
    }

    // Parse and add values
    const newValues = parseOptionValues(input, targetOption.name);
    
    if (newValues.length > 0) {
      const updatedOptions = productData.options.map(opt =>
        opt.id === targetOption.id 
          ? { ...opt, values: [...opt.values, ...newValues] }
          : opt
      );

      setProductData(prev => ({
        ...prev,
        options: updatedOptions,
      }));

      // Clear input
      setQuickInput('');
      
      // Auto-generate items
      setTimeout(() => autoGenerateItems(updatedOptions, productData), 50);
    }
  };

  const deleteOptionValue = (optionId: string, valueIndex: number) => {
    const updatedOptions = productData.options.map(option =>
      option.id === optionId 
        ? { 
            ...option, 
            values: option.values.filter((_, i) => i !== valueIndex)
          }
        : option
    );

    setProductData(prev => ({
      ...prev,
      options: updatedOptions,
    }));
    
    // Auto-regenerate items with updated options
    setTimeout(() => autoGenerateItems(updatedOptions, productData), 50);
  };

  const generateVariants = async () => {
    const optionsWithValues = productData.options.filter(opt => opt.values.length > 0);
    
    if (optionsWithValues.length === 0) {
      return;
    }

    setIsGeneratingVariants(true);

    try {
      const apiKey = getGroqApiKey();
      if (typeof process !== 'undefined' && process.env) {
        process.env.GROQ_API_KEY = apiKey;
      }

      // Create all possible combinations
      const combinations = generateCombinations(optionsWithValues);
      
      const result = await generateObject({
        model: groq('gemma2-9b-it'),
        schema: variantsSchema,
        prompt: `Generate product variants for "${productData.name}" with these option combinations:

Base Product: ${productData.name}
Base SKU: ${productData.sku}
Base Price: ${productData.price}

Option Combinations:
${combinations.map(combo => `- ${combo.name} (${combo.identifierCombination})`).join('\n')}

For each combination, generate:
- name: Descriptive variant name (e.g., "T-Shirt - Large Red")
- sku: Unique SKU using base SKU + identifier combination (e.g., "TSH-001-LG-RED")
- price: Realistic price (can vary slightly from base price)
- stock: Random stock quantity (10-100)
- identifierCombination: The exact identifier combination provided

Make variants realistic for e-commerce with proper SKU formatting.

Respond with valid JSON only.`,
        maxRetries: 2,
      });

      const generatedVariants: ProductVariant[] = result.object.variants.map((variant, index) => {
        const combination = combinations.find(c => c.identifierCombination === variant.identifierCombination);
        return {
          id: `variant-${Date.now()}-${index}`,
          name: variant.name,
          sku: variant.sku,
          price: variant.price,
          stock: variant.stock,
          identifierCombination: variant.identifierCombination,
          optionValues: combination?.optionValues || {},
        };
      });

      setProductData(prev => ({
        ...prev,
        variants: generatedVariants,
      }));
    } catch (error) {
      console.error('Error generating variants:', error);
    } finally {
      setIsGeneratingVariants(false);
    }
  };

  const generateCombinations = (options: ProductOption[]) => {
    const combinations: Array<{
      name: string;
      identifierCombination: string;
      optionValues: { [optionId: string]: string };
    }> = [];

    const generateRecursive = (
      currentIndex: number,
      currentCombination: { name: string; identifier: string; optionId: string; valueId: string }[]
    ) => {
      if (currentIndex === options.length) {
        combinations.push({
          name: currentCombination.map(c => c.name).join(' '),
          identifierCombination: currentCombination.map(c => c.identifier).join('-'),
          optionValues: currentCombination.reduce((acc, c) => {
            acc[c.optionId] = c.valueId;
            return acc;
          }, {} as { [optionId: string]: string }),
        });
        return;
      }

      const option = options[currentIndex];
      for (const value of option.values) {
        generateRecursive(currentIndex + 1, [
          ...currentCombination,
          {
            name: value.name,
            identifier: value.identifier,
            optionId: option.id,
            valueId: value.id,
          },
        ]);
      }
    };

    generateRecursive(0, []);
    return combinations;
  };

  // Auto-generate items without AI - using current state
  const autoGenerateItems = (currentOptions?: ProductOption[], currentProductData?: any) => {
    // Use passed parameters or current state
    const options = currentOptions || productData.options;
    const baseProductData = currentProductData || productData;
    
    const optionsWithValues = options.filter(opt => opt.values.length > 0);
    
    if (optionsWithValues.length === 0) {
      setProductData(prev => ({ ...prev, variants: [] }));
      return;
    }

    const combinations = generateCombinations(optionsWithValues);
    
    const generatedItems: ProductVariant[] = combinations.map((combo, index) => {
      // Clean price parsing
      const priceStr = baseProductData.price || '$29.99';
      const basePrice = parseFloat(priceStr.replace(/[$,]/g, '')) || 29.99;
      const priceVariation = (Math.random() - 0.5) * 4; // ±$2 variation (smaller range)
      const finalPrice = Math.max(0.99, basePrice + priceVariation);
      
      // Ensure unique IDs
      const timestamp = Date.now();
      const uniqueId = `item-${timestamp}-${index}`;
      
      return {
        id: uniqueId,
        name: `${baseProductData.name || 'Product'} - ${combo.name}`,
        sku: `${baseProductData.sku || 'SKU'}-${combo.identifierCombination}`,
        price: `$${finalPrice.toFixed(2)}`,
        stock: `${Math.floor(Math.random() * 50) + 10}`, // String format to match interface
        identifierCombination: combo.identifierCombination,
        optionValues: combo.optionValues,
      };
    });

    setProductData(prev => ({ ...prev, variants: generatedItems }));
  };

  const handleSave = () => {
    // Basic validation
    if (!productData.name.trim()) {
      return;
    }

    // Here you would typically save to your database
    console.log('Product saved successfully');
  };

  const tabs = [
    { id: 'core', label: 'core' },
    { id: 'metafields', label: 'metafields' },
    { id: 'files', label: 'files' },
    { id: 'categorizations', label: 'categorizations' },
    { id: 'options', label: 'options' },
    { id: 'variants', label: 'items' },
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'core':
        return (
          <View style={styles.tabContent}>
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Product Name</Text>
              <TextInput
                style={styles.textInput}
                placeholder="AI will generate this or enter your own..."
                placeholderTextColor="#94a3b8"
                value={productData.name}
                onChangeText={(text) => updateField('name', text)}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Short Note</Text>
              <TextInput
                style={styles.textInput}
                placeholder="AI will generate this or enter your own..."
                placeholderTextColor="#94a3b8"
                value={productData.shortNote}
                onChangeText={(text) => updateField('shortNote', text)}
              />
            </View>

            {/* AI Generate Button */}
            <TouchableOpacity
              style={[styles.generateButton, isGenerating && styles.generateButtonDisabled]}
              onPress={generateProductFields}
              disabled={isGenerating}
            >
              {isGenerating ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Feather name="zap" size={20} color="#ffffff" />
              )}
              <Text style={styles.generateButtonText}>
                {isGenerating ? 'Generating...' : 'Generate All Fields with AI'}
              </Text>
            </TouchableOpacity>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Description</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                placeholder="AI will generate this..."
                placeholderTextColor="#94a3b8"
                multiline
                numberOfLines={4}
                value={productData.description}
                onChangeText={(text) => updateField('description', text)}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Price</Text>
              <TextInput
                style={styles.textInput}
                placeholder="AI will generate this..."
                placeholderTextColor="#94a3b8"
                keyboardType="numeric"
                value={productData.price}
                onChangeText={(text) => updateField('price', text)}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>SKU</Text>
              <TextInput
                style={styles.textInput}
                placeholder="AI will generate this..."
                placeholderTextColor="#94a3b8"
                value={productData.sku}
                onChangeText={(text) => updateField('sku', text)}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Stock Quantity</Text>
              <TextInput
                style={styles.textInput}
                placeholder="AI will generate this..."
                placeholderTextColor="#94a3b8"
                keyboardType="numeric"
                value={productData.stock}
                onChangeText={(text) => updateField('stock', text)}
              />
            </View>

            {/* Option Type Selector Modal */}
            {showOptionTypeSelector && (
              <View style={styles.optionTypeModal}>
                <View style={styles.modalContent}>
                  <Text style={styles.modalTitle}>Select Option Types</Text>
                  <Text style={styles.modalSubtitle}>
                    Choose up to 3 option types for your product (selected: {selectedOptionTypes.length}/3)
                  </Text>
                  
                  <View style={styles.optionTypeGrid}>
                    {suggestedOptionTypes.map((optionType) => (
                      <TouchableOpacity
                        key={optionType}
                        style={[
                          styles.optionTypeCard,
                          selectedOptionTypes.includes(optionType) && styles.optionTypeCardSelected,
                          selectedOptionTypes.length >= 3 && !selectedOptionTypes.includes(optionType) && styles.optionTypeCardDisabled,
                        ]}
                        onPress={() => handleOptionTypeSelection(optionType)}
                        disabled={selectedOptionTypes.length >= 3 && !selectedOptionTypes.includes(optionType)}
                      >
                        <Text style={[
                          styles.optionTypeCardText,
                          selectedOptionTypes.includes(optionType) && styles.optionTypeCardTextSelected,
                          selectedOptionTypes.length >= 3 && !selectedOptionTypes.includes(optionType) && styles.optionTypeCardTextDisabled,
                        ]}>
                          {optionType}
                        </Text>
                        {selectedOptionTypes.includes(optionType) && (
                          <View style={styles.selectedIcon}>
                            <Feather name="check" size={14} color="#ffffff" />
                          </View>
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>

                  <View style={styles.modalActions}>
                    <TouchableOpacity
                      style={styles.cancelButton}
                      onPress={() => {
                        setShowOptionTypeSelector(false);
                        setSelectedOptionTypes([]);
                        setSuggestedOptionTypes([]);
                      }}
                    >
                      <Text style={styles.cancelButtonText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.confirmButton,
                        selectedOptionTypes.length === 0 && styles.confirmButtonDisabled
                      ]}
                      onPress={confirmOptionTypes}
                      disabled={selectedOptionTypes.length === 0}
                    >
                      <Text style={styles.confirmButtonText}>
                        Confirm ({selectedOptionTypes.length})
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}
          </View>
        );

      case 'metafields':
        return (
          <View style={styles.tabContent}>
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Brand</Text>
              <TextInput
                style={styles.textInput}
                placeholder="AI will generate this..."
                placeholderTextColor="#94a3b8"
                value={productData.brand}
                onChangeText={(text) => updateField('brand', text)}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Material</Text>
              <TextInput
                style={styles.textInput}
                placeholder="AI will generate this..."
                placeholderTextColor="#94a3b8"
                value={productData.material}
                onChangeText={(text) => updateField('material', text)}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Weight</Text>
              <TextInput
                style={styles.textInput}
                placeholder="AI will generate this..."
                placeholderTextColor="#94a3b8"
                value={productData.weight}
                onChangeText={(text) => updateField('weight', text)}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Dimensions</Text>
              <TextInput
                style={styles.textInput}
                placeholder="AI will generate this..."
                placeholderTextColor="#94a3b8"
                value={productData.dimensions}
                onChangeText={(text) => updateField('dimensions', text)}
              />
            </View>
          </View>
        );

      case 'files':
        return (
          <View style={styles.tabContent}>
            {/* Image Upload Section */}
            <View style={styles.fileSection}>
              <Text style={styles.sectionTitle}>Product Images</Text>
              <FileUpload
                onUploadComplete={handleImageUpload}
                onUploadError={handleFileUploadError}
                fileType="image"
                allowMultiple={true}
                maxFiles={5}
                folder="products/images"
              />

              {productData.images.length > 0 && (
                <View style={styles.fileList}>
                  <Text style={styles.fileListTitle}>
                    {productData.images.length} image(s) uploaded
                  </Text>
                  {productData.images.map((file) => (
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
                folder="products/documents"
              />

              {productData.documents.length > 0 && (
                <View style={styles.fileList}>
                  <Text style={styles.fileListTitle}>
                    {productData.documents.length} document(s) uploaded
                  </Text>
                  {productData.documents.map((file) => (
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
            {(productData.images.length > 0 || productData.documents.length > 0) && (
              <View style={styles.fileSummary}>
                <Text style={styles.summaryText}>
                  Total files: {productData.images.length + productData.documents.length}
                </Text>
                <Text style={styles.summarySubtext}>
                  Images: {productData.images.length} • Documents: {productData.documents.length}
                </Text>
              </View>
            )}
          </View>
        );

      case 'categorizations':
        return (
          <View style={styles.tabContent}>
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Product Type</Text>
              <TextInput
                style={styles.textInput}
                placeholder="AI will generate this..."
                placeholderTextColor="#94a3b8"
                value={productData.productType}
                onChangeText={(text) => updateField('productType', text)}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Type</Text>
              <TextInput
                style={styles.textInput}
                placeholder="AI will generate this..."
                placeholderTextColor="#94a3b8"
                value={productData.type}
                onChangeText={(text) => updateField('type', text)}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Category</Text>
              <TextInput
                style={styles.textInput}
                placeholder="AI will generate this..."
                placeholderTextColor="#94a3b8"
                value={productData.category}
                onChangeText={(text) => updateField('category', text)}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Tags</Text>
              <TextInput
                style={styles.textInput}
                placeholder="AI will generate this..."
                placeholderTextColor="#94a3b8"
                value={productData.tags}
                onChangeText={(text) => updateField('tags', text)}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Collection</Text>
              <TextInput
                style={styles.textInput}
                placeholder="AI will generate this..."
                placeholderTextColor="#94a3b8"
                value={productData.collection}
                onChangeText={(text) => updateField('collection', text)}
              />
            </View>
          </View>
        );

      case 'options':
        return (
          <View style={styles.optionsContainer}>
            {productData.options.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>
                  Generate product fields first to create option types
                </Text>
              </View>
            ) : (
              <>
                {/* Option Chips */}
                <View style={styles.optionsOverview}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {productData.options.map((option) => (
                      <TouchableOpacity
                        key={option.id}
                        style={[
                          styles.optionChip,
                          selectedOptionId === option.id && styles.optionChipSelected
                        ]}
                        onPress={() => setSelectedOptionId(option.id)}
                      >
                        <Text style={[
                          styles.optionChipText,
                          selectedOptionId === option.id && styles.optionChipTextSelected
                        ]}>
                          {option.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>

                {/* Input Bar */}
                <View style={styles.singleInputBar}>
                  <TextInput
                    style={styles.singleInput}
                    placeholder="Add Values"
                    placeholderTextColor="#9ca3af"
                    value={quickInput}
                    onChangeText={setQuickInput}
                    onSubmitEditing={() => handleQuickInput(quickInput)}
                    returnKeyType="done"
                  />
                </View>

                {/* Values Display */}
                <ScrollView 
                  style={styles.valuesScrollView}
                  contentContainerStyle={styles.valuesScrollContent}
                  showsVerticalScrollIndicator={false}
                >
                  {productData.options.map((option) => (
                    <View key={option.id} style={styles.optionSection}>
                      <Text style={styles.optionTitle}>{option.name}</Text>
                      
                      {option.values.length > 0 && (
                        <View style={styles.valuesGrid}>
                          {option.values.map((value, valueIndex) => (
                            <TouchableOpacity
                              key={value.id}
                              style={styles.valueChip}
                              onLongPress={() => deleteOptionValue(option.id, valueIndex)}
                              delayLongPress={500}
                            >
                              <Text style={styles.valueChipText}>{value.name}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      )}
                    </View>
                  ))}
                </ScrollView>
              </>
            )}
          </View>
        );

      case 'variants':
        return (
          <View style={styles.tabContent}>
            {/* Items List */}
            {productData.variants.length > 0 ? (
              <>
                <Text style={styles.sectionTitle}>
                  {productData.variants.length} Items Auto-Generated
                </Text>
                {productData.variants.map((variant) => (
                  <View key={variant.id} style={styles.itemCard}>
                    <View style={styles.itemHeader}>
                      <View style={styles.itemInfo}>
                        <Text style={styles.itemName}>{variant.name}</Text>
                        <Text style={styles.itemIdentifier}>{variant.identifierCombination}</Text>
                      </View>
                      <View style={styles.itemDetails}>
                        <Text style={styles.itemPrice}>{variant.price}</Text>
                        <Text style={styles.itemStock}>Stock: {variant.stock}</Text>
                      </View>
                    </View>
                    <View style={styles.itemSku}>
                      <Text style={styles.itemSkuLabel}>SKU:</Text>
                      <Text style={styles.itemSkuText}>{variant.sku}</Text>
                    </View>
                  </View>
                ))}
              </>
            ) : (
              <View style={styles.emptyItemsContainer}>
                <Text style={styles.emptyItemsText}>
                  Items will be automatically generated when you add option values.
                </Text>
              </View>
            )}
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {tabs.map((tab) => (
            <TouchableOpacity
              key={tab.id}
              style={[
                styles.tab,
                activeTab === tab.id && styles.activeTab,
              ]}
              onPress={() => setActiveTab(tab.id)}
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === tab.id && styles.activeTabText,
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Content */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {renderTabContent()}
      </ScrollView>


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
  tabContent: {
    paddingBottom: 100,
  },
  fieldGroup: {
    marginBottom: 20,
  },
  fieldLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#ffffff',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  selectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
  },
  selectButtonText: {
    fontSize: 16,
    color: '#64748b',
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#3b82f6',
    borderStyle: 'dashed',
    borderRadius: 8,
    paddingVertical: 20,
    marginBottom: 16,
  },
  uploadButtonText: {
    fontSize: 16,
    color: '#3b82f6',
    fontWeight: '600',
    marginLeft: 8,
  },
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
  emptyText: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    paddingVertical: 20,
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
  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3b82f6',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginBottom: 20,
  },
  generateButtonDisabled: {
    backgroundColor: '#94a3b8',
  },
  generateButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  // Option Type Selector Modal Styles
  optionTypeModal: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    margin: 20,
    maxWidth: 400,
    width: '90%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1e293b',
    textAlign: 'center',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  optionTypeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginBottom: 24,
  },
  optionTypeCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    margin: 4,
    borderWidth: 2,
    borderColor: '#e2e8f0',
    minWidth: 80,
    alignItems: 'center',
    position: 'relative',
  },
  optionTypeCardSelected: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  optionTypeCardDisabled: {
    backgroundColor: '#f1f5f9',
    borderColor: '#e2e8f0',
    opacity: 0.5,
  },
  optionTypeCardText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
    textAlign: 'center',
  },
  optionTypeCardTextSelected: {
    color: '#ffffff',
  },
  optionTypeCardTextDisabled: {
    color: '#94a3b8',
  },
  selectedIcon: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#10b981',
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    paddingVertical: 12,
    marginRight: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748b',
  },
  confirmButton: {
    flex: 1,
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    paddingVertical: 12,
    marginLeft: 8,
    alignItems: 'center',
  },
  confirmButtonDisabled: {
    backgroundColor: '#cbd5e1',
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  // Ultra Minimal Options Interface
  optionsContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 14,
    color: '#9ca3af',
  },
  optionsOverview: {
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  optionChip: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 5,
  },
  optionChipSelected: {
    backgroundColor: '#ffffff',
    borderColor: '#374151',
  },
  optionChipText: {
    fontSize: 14,
    color: '#6b7280',
  },
  optionChipTextSelected: {
    color: '#374151',
  },
  valuesScrollView: {
    flex: 1,
  },
  valuesScrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
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
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  valueChipText: {
    fontSize: 14,
    color: '#374151',
  },
  singleInputBar: {
    backgroundColor: '#f8fafc',
    marginBottom: 20,
  },
  singleInput: {
    height: 44,
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    fontSize: 15,
    color: '#111827',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  // Items styles
  emptyItemsContainer: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyItemsText: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 24,
  },
  itemCard: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 2,
  },
  itemIdentifier: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '500',
  },
  itemDetails: {
    alignItems: 'flex-end',
  },
  itemPrice: {
    fontSize: 15,
    fontWeight: '600',
    color: '#059669',
    marginBottom: 2,
  },
  itemStock: {
    fontSize: 11,
    color: '#64748b',
  },
  itemSku: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  itemSkuLabel: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '500',
    marginRight: 8,
  },
  itemSkuText: {
    fontSize: 11,
    color: '#475569',
    fontFamily: 'monospace',
  },

});
