import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Modal,
  Animated,
  FlatList,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useGameStore, useHydration } from '../stores/gameStore';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import axios from 'axios';
import COLORS from '../theme/colors';

const API_BASE = process.env.EXPO_PUBLIC_BACKEND_URL 
  ? `${process.env.EXPO_PUBLIC_BACKEND_URL}/api` 
  : '/api';

interface ChatMessage {
  id: string;
  sender_id: string;
  sender_username: string;
  message: string;
  timestamp: string;
  language: string;
  bubble?: ChatBubble;
}

interface ChatBubble {
  bubble_id: string;
  name: string;
  colors: string[];
  text_color: string;
  border_color: string;
  icon?: string;
  glow_effect?: boolean;
  animated?: boolean;
}

const CHANNELS = [
  { id: 'world', name: 'World', icon: 'globe', color: COLORS.gold.primary },
  { id: 'local', name: 'Local', icon: 'location', color: '#22c55e' },
  { id: 'guild', name: 'Guild', icon: 'shield', color: '#8b5cf6' },
];

const LANGUAGES = [
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'zh-CN', name: '简体中文', flag: '🇨🇳' },
  { code: 'ru', name: 'Русский', flag: '🇷🇺' },
];

// Default bubble for users without a custom one
const DEFAULT_BUBBLE: ChatBubble = {
  bubble_id: 'default',
  name: 'Basic Bubble',
  colors: ['#FAF9F6', '#F5F5DC'],
  text_color: '#1a1a1a',
  border_color: '#d4d4d4',
};

// Cache for user bubbles
const bubbleCache: { [username: string]: ChatBubble } = {};

export default function ChatScreen() {
  const router = useRouter();
  const { user } = useGameStore();
  const hydrated = useHydration();
  
  const [selectedChannel, setSelectedChannel] = useState('world');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState('en');
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const [showBubbleModal, setShowBubbleModal] = useState(false);
  const [userBubbles, setUserBubbles] = useState<{ available: any[], locked: any[] }>({ available: [], locked: [] });
  const [equippedBubble, setEquippedBubble] = useState<ChatBubble>(DEFAULT_BUBBLE);
  
  const scrollViewRef = useRef<ScrollView>(null);
  const rainbowAnim = useRef(new Animated.Value(0)).current;

  // Rainbow animation for special bubbles
  useEffect(() => {
    Animated.loop(
      Animated.timing(rainbowAnim, {
        toValue: 1,
        duration: 3000,
        useNativeDriver: false,
      })
    ).start();
  }, []);

  useEffect(() => {
    if (hydrated && user) {
      loadMessages();
      loadUserBubble();
      const interval = setInterval(loadMessages, 5000);
      return () => clearInterval(interval);
    }
  }, [hydrated, user?.username, selectedChannel]);

  const loadUserBubble = async () => {
    if (!user) return;
    try {
      const response = await axios.get(`${API_BASE}/user/${user.username}/chat-bubbles`);
      setUserBubbles({
        available: response.data.available_bubbles || [],
        locked: response.data.locked_bubbles || [],
      });
      
      const equipped = response.data.available_bubbles?.find((b: any) => b.is_equipped);
      if (equipped) {
        setEquippedBubble(equipped);
        bubbleCache[user.username] = equipped;
      }
    } catch (error) {
      console.error('Error loading bubbles:', error);
    }
  };

  const loadMessages = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE}/chat/messages`, {
        params: {
          channel_type: selectedChannel,
          limit: 50,
        }
      });
      
      // Fetch bubble info for each unique sender
      const messagesWithBubbles = await Promise.all(
        (response.data || []).map(async (msg: ChatMessage) => {
          if (!bubbleCache[msg.sender_username]) {
            try {
              const bubbleRes = await axios.get(`${API_BASE}/chat/user-bubble/${msg.sender_username}`);
              bubbleCache[msg.sender_username] = bubbleRes.data;
            } catch {
              bubbleCache[msg.sender_username] = DEFAULT_BUBBLE;
            }
          }
          return { ...msg, bubble: bubbleCache[msg.sender_username] };
        })
      );
      
      setMessages(messagesWithBubbles);
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!user || !newMessage.trim()) return;
    
    setSending(true);
    try {
      await axios.post(`${API_BASE}/chat/send`, null, {
        params: {
          username: user.username,
          channel_type: selectedChannel,
          message: newMessage.trim(),
          language: selectedLanguage,
        }
      });
      
      setNewMessage('');
      await loadMessages();
      scrollViewRef.current?.scrollToEnd({ animated: true });
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const equipBubble = async (bubbleId: string) => {
    if (!user) return;
    try {
      await axios.post(`${API_BASE}/user/${user.username}/equip-chat-bubble?bubble_id=${bubbleId}`);
      await loadUserBubble();
      setShowBubbleModal(false);
      Alert.alert('Success', 'Chat bubble equipped!');
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to equip bubble');
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Render chat bubble
  const renderMessage = (msg: ChatMessage, index: number) => {
    const isOwn = msg.sender_username === user?.username;
    const bubble = msg.bubble || DEFAULT_BUBBLE;
    const isRainbow = bubble.bubble_id === 'admin_rainbow';
    const isAnimated = bubble.animated;
    
    // Rainbow gradient interpolation
    const rainbowColors = isRainbow ? rainbowAnim.interpolate({
      inputRange: [0, 0.16, 0.33, 0.5, 0.66, 0.83, 1],
      outputRange: ['#FF0000', '#FF7F00', '#FFFF00', '#00FF00', '#0000FF', '#9400D3', '#FF0000'],
    }) : null;

    return (
      <View key={msg.id || index} style={[styles.messageRow, isOwn && styles.messageRowOwn]}>
        {/* Avatar */}
        {!isOwn && (
          <View style={[styles.avatar, { borderColor: bubble.border_color }]}>
            <Text style={styles.avatarText}>{msg.sender_username.charAt(0).toUpperCase()}</Text>
          </View>
        )}
        
        <View style={[styles.messageContainer, isOwn && styles.messageContainerOwn]}>
          {/* Username */}
          {!isOwn && (
            <View style={styles.usernameRow}>
              <Text style={[styles.username, { color: bubble.colors[0] }]}>
                {bubble.icon && `${bubble.icon} `}{msg.sender_username}
              </Text>
              {isRainbow && <Text style={styles.uniqueBadge}>✦ UNIQUE</Text>}
            </View>
          )}
          
          {/* Message Bubble */}
          <View style={[
            styles.bubbleWrapper,
            bubble.glow_effect && { shadowColor: bubble.colors[0], shadowOpacity: 0.8, shadowRadius: 10, elevation: 10 }
          ]}>
            <LinearGradient
              colors={bubble.colors.length >= 2 ? bubble.colors.slice(0, 2) : [...bubble.colors, bubble.colors[0]]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[
                styles.messageBubble,
                { borderColor: bubble.border_color },
                isOwn && styles.messageBubbleOwn,
              ]}
            >
              <Text style={[styles.messageText, { color: bubble.text_color }]}>
                {msg.message}
              </Text>
              <Text style={[styles.timestamp, { color: bubble.text_color + '80' }]}>
                {formatTime(msg.timestamp)}
              </Text>
            </LinearGradient>
          </View>
        </View>
        
        {isOwn && (
          <View style={[styles.avatar, styles.avatarOwn, { borderColor: bubble.border_color }]}>
            <Text style={styles.avatarText}>{msg.sender_username.charAt(0).toUpperCase()}</Text>
          </View>
        )}
      </View>
    );
  };

  // Render bubble option
  const renderBubbleOption = (bubble: any, isLocked: boolean) => (
    <TouchableOpacity
      key={bubble.id}
      style={[
        styles.bubbleOption,
        bubble.is_equipped && styles.bubbleOptionEquipped,
        isLocked && styles.bubbleOptionLocked,
      ]}
      onPress={() => !isLocked && equipBubble(bubble.id)}
      disabled={isLocked}
    >
      <LinearGradient
        colors={bubble.colors.slice(0, 2)}
        style={styles.bubblePreview}
      >
        {bubble.icon && <Text style={styles.bubbleIcon}>{bubble.icon}</Text>}
        {isLocked && (
          <View style={styles.lockOverlay}>
            <Ionicons name="lock-closed" size={16} color="#fff" />
          </View>
        )}
      </LinearGradient>
      <Text style={styles.bubbleName} numberOfLines={1}>{bubble.name}</Text>
      {bubble.is_equipped && <Text style={styles.equippedLabel}>EQUIPPED</Text>}
      {isLocked && bubble.unlock_hint && (
        <Text style={styles.unlockHint} numberOfLines={2}>{bubble.unlock_hint}</Text>
      )}
      {bubble.unique && <Text style={styles.uniqueLabel}>???</Text>}
    </TouchableOpacity>
  );

  if (!hydrated) {
    return (
      <LinearGradient colors={[COLORS.navy.darkest, COLORS.navy.dark]} style={styles.container}>
        <SafeAreaView style={styles.centerContainer}>
          <ActivityIndicator size="large" color={COLORS.gold.primary} />
        </SafeAreaView>
      </LinearGradient>
    );
  }

  if (!user) {
    return (
      <LinearGradient colors={[COLORS.navy.darkest, COLORS.navy.dark]} style={styles.container}>
        <SafeAreaView style={styles.centerContainer}>
          <Ionicons name="chatbubbles" size={64} color={COLORS.cream.dark} />
          <Text style={styles.noUserText}>Please log in to chat</Text>
          <TouchableOpacity style={styles.loginBtn} onPress={() => router.push('/')}>
            <Text style={styles.loginBtnText}>Go to Login</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={[COLORS.navy.darkest, COLORS.navy.dark]} style={styles.container}>
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView 
          style={styles.container} 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color={COLORS.cream.pure} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>💬 Chat</Text>
            <TouchableOpacity onPress={() => setShowBubbleModal(true)} style={styles.bubbleButton}>
              <LinearGradient
                colors={equippedBubble.colors.slice(0, 2)}
                style={styles.bubbleButtonGradient}
              >
                {equippedBubble.icon && <Text style={{ fontSize: 12 }}>{equippedBubble.icon}</Text>}
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* Channel Tabs */}
          <View style={styles.channelTabs}>
            {CHANNELS.map(channel => (
              <TouchableOpacity
                key={channel.id}
                style={[
                  styles.channelTab,
                  selectedChannel === channel.id && { borderBottomColor: channel.color, borderBottomWidth: 2 }
                ]}
                onPress={() => setSelectedChannel(channel.id)}
              >
                <Ionicons 
                  name={channel.icon as any} 
                  size={16} 
                  color={selectedChannel === channel.id ? channel.color : COLORS.cream.dark} 
                />
                <Text style={[
                  styles.channelTabText,
                  selectedChannel === channel.id && { color: channel.color }
                ]}>
                  {channel.name}
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.languageButton} onPress={() => setShowLanguageModal(true)}>
              <Text style={styles.languageFlag}>
                {LANGUAGES.find(l => l.code === selectedLanguage)?.flag || '🌐'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Messages */}
          <ScrollView 
            ref={scrollViewRef}
            style={styles.messagesContainer}
            contentContainerStyle={styles.messagesContent}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: false })}
          >
            {loading && messages.length === 0 ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color={COLORS.gold.primary} />
                <Text style={styles.loadingText}>Loading messages...</Text>
              </View>
            ) : messages.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="chatbubble-ellipses-outline" size={48} color={COLORS.cream.dark} />
                <Text style={styles.emptyText}>No messages yet</Text>
                <Text style={styles.emptySubtext}>Be the first to say something!</Text>
              </View>
            ) : (
              messages.map((msg, idx) => renderMessage(msg, idx))
            )}
          </ScrollView>

          {/* Input Area */}
          <View style={styles.inputArea}>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                value={newMessage}
                onChangeText={setNewMessage}
                placeholder="Type a message..."
                placeholderTextColor={COLORS.cream.dark}
                maxLength={500}
                multiline
              />
              <TouchableOpacity 
                style={[styles.sendButton, !newMessage.trim() && styles.sendButtonDisabled]}
                onPress={sendMessage}
                disabled={sending || !newMessage.trim()}
              >
                {sending ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Ionicons name="send" size={20} color="#fff" />
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Language Modal */}
          <Modal
            visible={showLanguageModal}
            transparent
            animationType="slide"
            onRequestClose={() => setShowLanguageModal(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.languageModal}>
                <Text style={styles.modalTitle}>Select Language</Text>
                {LANGUAGES.map(lang => (
                  <TouchableOpacity
                    key={lang.code}
                    style={[
                      styles.languageOption,
                      selectedLanguage === lang.code && styles.languageOptionSelected
                    ]}
                    onPress={() => {
                      setSelectedLanguage(lang.code);
                      setShowLanguageModal(false);
                    }}
                  >
                    <Text style={styles.languageOptionFlag}>{lang.flag}</Text>
                    <Text style={styles.languageOptionText}>{lang.name}</Text>
                    {selectedLanguage === lang.code && (
                      <Ionicons name="checkmark" size={20} color={COLORS.gold.primary} />
                    )}
                  </TouchableOpacity>
                ))}
                <TouchableOpacity 
                  style={styles.closeModalBtn}
                  onPress={() => setShowLanguageModal(false)}
                >
                  <Text style={styles.closeModalText}>Close</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>

          {/* Bubble Selection Modal */}
          <Modal
            visible={showBubbleModal}
            transparent
            animationType="slide"
            onRequestClose={() => setShowBubbleModal(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.bubbleModal}>
                <View style={styles.bubbleModalHeader}>
                  <Text style={styles.modalTitle}>🎨 Chat Bubbles</Text>
                  <TouchableOpacity onPress={() => setShowBubbleModal(false)}>
                    <Ionicons name="close" size={24} color={COLORS.cream.pure} />
                  </TouchableOpacity>
                </View>
                
                <ScrollView showsVerticalScrollIndicator={false}>
                  {/* Available Bubbles */}
                  <Text style={styles.bubbleSectionTitle}>Available</Text>
                  <View style={styles.bubblesGrid}>
                    {userBubbles.available.map(bubble => renderBubbleOption(bubble, false))}
                  </View>
                  
                  {/* Locked Bubbles */}
                  {userBubbles.locked.length > 0 && (
                    <>
                      <Text style={styles.bubbleSectionTitle}>Locked</Text>
                      <View style={styles.bubblesGrid}>
                        {userBubbles.locked.map(bubble => renderBubbleOption(bubble, true))}
                      </View>
                    </>
                  )}
                </ScrollView>
              </View>
            </View>
          </Modal>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  noUserText: { color: COLORS.cream.dark, fontSize: 16, marginTop: 16 },
  loginBtn: { marginTop: 16, backgroundColor: COLORS.gold.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 },
  loginBtnText: { color: COLORS.navy.darkest, fontWeight: 'bold' },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gold.primary + '30',
  },
  backButton: { padding: 8 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.cream.pure },
  bubbleButton: { padding: 4 },
  bubbleButtonGradient: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.gold.primary,
  },

  // Channel Tabs
  channelTabs: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    backgroundColor: COLORS.navy.primary,
  },
  channelTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 4,
  },
  channelTabText: { fontSize: 12, color: COLORS.cream.dark, fontWeight: '600' },
  languageButton: { paddingHorizontal: 12, justifyContent: 'center' },
  languageFlag: { fontSize: 18 },

  // Messages
  messagesContainer: { flex: 1 },
  messagesContent: { padding: 12, paddingBottom: 20 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 40 },
  loadingText: { color: COLORS.cream.dark, marginTop: 8 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },
  emptyText: { color: COLORS.cream.pure, fontSize: 16, marginTop: 12 },
  emptySubtext: { color: COLORS.cream.dark, fontSize: 13, marginTop: 4 },

  // Message Row
  messageRow: { flexDirection: 'row', marginBottom: 12, alignItems: 'flex-end' },
  messageRowOwn: { flexDirection: 'row-reverse' },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.navy.medium,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    marginRight: 8,
  },
  avatarOwn: { marginRight: 0, marginLeft: 8 },
  avatarText: { color: COLORS.cream.pure, fontWeight: 'bold', fontSize: 14 },
  messageContainer: { flex: 1, maxWidth: '75%' },
  messageContainerOwn: { alignItems: 'flex-end' },
  usernameRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4, gap: 6 },
  username: { fontSize: 12, fontWeight: 'bold' },
  uniqueBadge: { fontSize: 8, color: COLORS.gold.primary, fontWeight: 'bold' },
  bubbleWrapper: { borderRadius: 16 },
  messageBubble: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderTopLeftRadius: 4,
  },
  messageBubbleOwn: { borderTopLeftRadius: 16, borderTopRightRadius: 4 },
  messageText: { fontSize: 14, lineHeight: 20 },
  timestamp: { fontSize: 10, marginTop: 4, textAlign: 'right' },

  // Input
  inputArea: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.navy.medium,
    backgroundColor: COLORS.navy.primary,
  },
  inputContainer: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  input: {
    flex: 1,
    backgroundColor: COLORS.navy.dark,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: COLORS.cream.pure,
    fontSize: 14,
    maxHeight: 100,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.gold.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: { backgroundColor: COLORS.navy.medium },

  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'flex-end',
  },
  languageModal: {
    backgroundColor: COLORS.navy.primary,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
  },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.cream.pure, marginBottom: 16, textAlign: 'center' },
  languageOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: COLORS.navy.dark,
  },
  languageOptionSelected: { backgroundColor: COLORS.gold.primary + '30', borderWidth: 1, borderColor: COLORS.gold.primary },
  languageOptionFlag: { fontSize: 24, marginRight: 12 },
  languageOptionText: { flex: 1, fontSize: 16, color: COLORS.cream.pure },
  closeModalBtn: { marginTop: 12, paddingVertical: 14, alignItems: 'center' },
  closeModalText: { color: COLORS.cream.dark, fontSize: 16 },

  // Bubble Modal
  bubbleModal: {
    backgroundColor: COLORS.navy.primary,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
    maxHeight: '80%',
  },
  bubbleModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  bubbleSectionTitle: { fontSize: 14, fontWeight: 'bold', color: COLORS.gold.primary, marginBottom: 12, marginTop: 8 },
  bubblesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  bubbleOption: {
    width: 90,
    alignItems: 'center',
    padding: 10,
    backgroundColor: COLORS.navy.dark,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  bubbleOptionEquipped: { borderColor: COLORS.gold.primary, backgroundColor: COLORS.gold.dark + '20' },
  bubbleOptionLocked: { opacity: 0.6 },
  bubblePreview: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  bubbleIcon: { fontSize: 20 },
  lockOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bubbleName: { fontSize: 10, color: COLORS.cream.pure, textAlign: 'center' },
  equippedLabel: { fontSize: 8, color: COLORS.gold.primary, fontWeight: 'bold', marginTop: 2 },
  unlockHint: { fontSize: 8, color: COLORS.cream.dark, textAlign: 'center', marginTop: 2 },
  uniqueLabel: { fontSize: 8, color: '#8b5cf6', fontWeight: 'bold', marginTop: 2 },
});
