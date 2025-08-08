import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, FlatList } from 'react-native';

interface Props {
  context: {
    title: string;
    id: string;
  };
}

interface FoodItem {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  image: string;
  available: boolean;
}

interface ChatMessage {
  id: string;
  type: 'user' | 'bot';
  message: string;
  timestamp: Date;
}

type TabType = 'chat' | 'menu';

export default function FoodOrderAgent({ context }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome-1',
      type: 'bot',
      message: 'Hello! I\'m your food ordering assistant. What would you like to order today?',
      timestamp: new Date(),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [activeTab, setActiveTab] = useState<TabType>('chat');

  // Sample food items
  const foodItems: FoodItem[] = [
    { id: 'food-1', name: 'Margherita Pizza', description: 'Fresh mozzarella, tomato sauce, basil', price: 12.99, category: 'pizza', image: '🍕', available: true },
    { id: 'food-2', name: 'Pepperoni Pizza', description: 'Spicy pepperoni, mozzarella, tomato sauce', price: 14.99, category: 'pizza', image: '🍕', available: true },
    { id: 'food-3', name: 'Chicken Burger', description: 'Grilled chicken, lettuce, tomato, mayo', price: 8.99, category: 'burger', image: '🍔', available: true },
    { id: 'food-4', name: 'Beef Burger', description: 'Angus beef, cheese, onion, special sauce', price: 10.99, category: 'burger', image: '🍔', available: true },
    { id: 'food-5', name: 'Caesar Salad', description: 'Romaine lettuce, parmesan, croutons, caesar dressing', price: 7.99, category: 'salad', image: '🥗', available: true },
    { id: 'food-6', name: 'Greek Salad', description: 'Mixed greens, feta, olives, cucumber, vinaigrette', price: 8.99, category: 'salad', image: '🥗', available: true },
    { id: 'food-7', name: 'Chicken Wings', description: 'Crispy wings with buffalo sauce', price: 9.99, category: 'appetizer', image: '🍗', available: true },
    { id: 'food-8', name: 'French Fries', description: 'Crispy golden fries with sea salt', price: 4.99, category: 'sides', image: '🍟', available: true },
    { id: 'food-9', name: 'Chocolate Cake', description: 'Rich chocolate cake with ganache', price: 6.99, category: 'dessert', image: '🍰', available: true },
    { id: 'food-10', name: 'Ice Cream', description: 'Vanilla ice cream with toppings', price: 5.99, category: 'dessert', image: '🍦', available: true },
  ];

  const categories = [
    { id: 'all', name: 'All', icon: '🍽️' },
    { id: 'pizza', name: 'Pizza', icon: '🍕' },
    { id: 'burger', name: 'Burgers', icon: '🍔' },
    { id: 'salad', name: 'Salads', icon: '🥗' },
    { id: 'appetizer', name: 'Appetizers', icon: '🍗' },
    { id: 'sides', name: 'Sides', icon: '🍟' },
    { id: 'dessert', name: 'Desserts', icon: '🍰' },
  ];

  const filteredItems = selectedCategory === 'all' 
    ? foodItems 
    : foodItems.filter(item => item.category === selectedCategory);

  const addMessage = (type: 'user' | 'bot', message: string) => {
    const newMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      type,
      message,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, newMessage]);
  };

  const handleSendMessage = () => {
    if (inputText.trim()) {
      addMessage('user', inputText);
      setInputText('');
      
      // Simulate bot response
      setTimeout(() => {
        addMessage('bot', 'I understand you\'re looking for food. Here are some popular options!');
      }, 1000);
    }
  };

  const handleFoodItemPress = (item: FoodItem) => {
    addMessage('user', `I'd like to order ${item.name}`);
    setTimeout(() => {
      addMessage('bot', `Great choice! ${item.name} costs $${item.price}. Would you like to add it to your cart?`);
    }, 1000);
  };

  const renderMessage = ({ item }: { item: ChatMessage }) => (
    <View style={[
      styles.messageContainer,
      item.type === 'user' ? styles.userMessage : styles.botMessage
    ]}>
      <Text style={[
        styles.messageText,
        item.type === 'user' ? styles.userMessageText : styles.botMessageText
      ]}>
        {item.message}
      </Text>
    </View>
  );

  const renderFoodItem = ({ item }: { item: FoodItem }) => (
    <TouchableOpacity
      style={styles.foodItem}
      onPress={() => handleFoodItemPress(item)}
      activeOpacity={0.8}
    >
      <Text style={styles.foodEmoji}>{item.image}</Text>
      <View style={styles.foodInfo}>
        <Text style={styles.foodName}>{item.name}</Text>
        <Text style={styles.foodDescription}>{item.description}</Text>
      </View>
      <Text style={styles.foodPrice}>${item.price}</Text>
    </TouchableOpacity>
  );

  const renderChatTab = () => (
    <View style={styles.chatTabContainer}>
      <FlatList
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        style={styles.chatList}
      />
    </View>
  );

  const renderMenuTab = () => (
    <View style={styles.menuTabContainer}>
      <View style={styles.categoriesContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoriesScroll}>
          {categories.map((category) => (
            <TouchableOpacity
              key={category.id}
              style={[
                styles.categoryButton,
                selectedCategory === category.id && styles.categoryButtonActive
              ]}
              onPress={() => setSelectedCategory(category.id)}
            >
              <Text style={styles.categoryIcon}>{category.icon}</Text>
              <Text style={[
                styles.categoryText,
                selectedCategory === category.id && styles.categoryTextActive
              ]}>
                {category.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <FlatList
        data={filteredItems}
        renderItem={renderFoodItem}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        style={styles.foodList}
      />
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'chat' && styles.tabButtonActive]}
          onPress={() => setActiveTab('chat')}
        >
          <Text style={[styles.tabText, activeTab === 'chat' && styles.tabTextActive]}>Chat</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'menu' && styles.tabButtonActive]}
          onPress={() => setActiveTab('menu')}
        >
          <Text style={[styles.tabText, activeTab === 'menu' && styles.tabTextActive]}>Menu</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.contentContainer}>
        {activeTab === 'chat' ? renderChatTab() : renderMenuTab()}
      </View>

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.textInput}
          value={inputText}
          onChangeText={setInputText}
          placeholder="Type your message..."
          placeholderTextColor="#9ca3af"
          multiline
        />
        <TouchableOpacity
          style={styles.sendButton}
          onPress={handleSendMessage}
          activeOpacity={0.8}
        >
          <Text style={styles.sendButtonText}>Send</Text>
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
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  tabButton: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  tabButtonActive: {
    borderBottomWidth: 2,
    borderBottomColor: '#3b82f6',
  },
  tabText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#6b7280',
  },
  tabTextActive: {
    color: '#3b82f6',
    fontWeight: '600',
  },
  contentContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  chatTabContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  chatList: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  menuTabContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  categoriesContainer: {
    paddingVertical: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  categoriesScroll: {
    paddingHorizontal: 20,
  },
  categoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 24,
    marginRight: 12,
  },
  categoryButtonActive: {
    backgroundColor: '#3b82f6',
  },
  categoryIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  categoryText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6b7280',
  },
  categoryTextActive: {
    color: '#ffffff',
  },
  foodList: {
    paddingHorizontal: 20,
  },
  messageContainer: {
    marginBottom: 12,
    maxWidth: '80%',
  },
  userMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#3b82f6',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderBottomRightRadius: 6,
  },
  botMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#f9fafb',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderBottomLeftRadius: 6,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
  },
  userMessageText: {
    color: '#ffffff',
  },
  botMessageText: {
    color: '#374151',
  },
  foodItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingVertical: 16,
    paddingHorizontal: 0,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  foodEmoji: {
    fontSize: 32,
    marginRight: 16,
  },
  foodInfo: {
    flex: 1,
  },
  foodName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  foodDescription: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
  },
  foodPrice: {
    fontSize: 16,
    fontWeight: '600',
    color: '#059669',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 20,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  textInput: {
    flex: 1,
    backgroundColor: '#f9fafb',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginRight: 12,
    fontSize: 14,
    color: '#111827',
    maxHeight: 80,
  },
  sendButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    justifyContent: 'center',
  },
  sendButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
});

