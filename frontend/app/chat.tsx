import React, { useEffect, useState, useRef } from 'react';
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
} from 'react-native';
import { useGameStore } from '../stores/gameStore';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import COLORS from '../theme/colors';

interface ChatMessage {
  id: string;
  sender_username: string;
  message: string;
  timestamp: string;
  language: string;
}

const CHANNELS = [
  { id: 'world', name: 'World', icon: 'globe', color: COLORS.gold.primary },
  { id: 'local', name: 'Local', icon: 'location', color: COLORS.success },
  { id: 'guild', name: 'Guild', icon: 'shield', color: COLORS.rarity.UR },
  { id: 'private', name: 'Friends', icon: 'people', color: COLORS.rarity['UR+'] },
];

const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'fr', name: 'Français' },
  { code: 'es', name: 'Español' },
  { code: 'zh-CN', name: '简体中文' },
  { code: 'zh-TW', name: '繁體中文' },
  { code: 'ms', name: 'Malay' },
  { code: 'fil', name: 'Filipino' },
  { code: 'ru', name: 'Русский' },
  { code: 'id', name: 'Indonesia' },
];

export default function ChatScreen() {
  const { user } = useGameStore();
  const [selectedChannel, setSelectedChannel] = useState('world');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState('en');
  const [showLanguageSelector, setShowLanguageSelector] = useState(false);
  const [chatUnlocked, setChatUnlocked] = useState(false);
  const [unlockInfo, setUnlockInfo] = useState<any>(null);
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (user) {
      checkChatUnlock();
    }
  }, [user]);

  useEffect(() => {
    if (chatUnlocked) {
      loadMessages();
      const interval = setInterval(loadMessages, 5000);
      return () => clearInterval(interval);
    }
  }, [selectedChannel, chatUnlocked]);

  const checkChatUnlock = async () => {
    try {
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_BACKEND_URL}/api/user/${user?.username}`
      );
      const userData = await response.json();
      
      const hasCompletedTutorial = userData.tutorial_completed || false;
      const chatUnlockTime = userData.chat_unlock_time;
      
      if (hasCompletedTutorial && chatUnlockTime) {
        const unlockDate = new Date(chatUnlockTime);
        const now = new Date();
        if (now >= unlockDate) {
          setChatUnlocked(true);
        } else {
          setChatUnlocked(false);
          setUnlockInfo({
            remaining: Math.ceil((unlockDate.getTime() - now.getTime()) / (1000 * 60 * 60)),
            tutorialCompleted: true
          });
        }
      } else {
        setChatUnlocked(false);
        setUnlockInfo({
          tutorialCompleted: hasCompletedTutorial,
          remaining: hasCompletedTutorial ? 32 : null
        });
      }
      
      if (userData.login_days > 0) {
        setChatUnlocked(true);
      }
    } catch (error) {
      console.error('Failed to check chat unlock:', error);
      setChatUnlocked(true);
    }
  };

  const loadMessages = async () => {
    try {
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_BACKEND_URL}/api/chat/messages?channel_type=${selectedChannel}&limit=50`
      );
      const data = await response.json();
      setMessages(data.reverse());
      
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error) {
      console.error('Failed to load messages:', error);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || isSending) return;
    
    setIsSending(true);
    try {
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_BACKEND_URL}/api/chat/send?username=${user?.username}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            channel_type: selectedChannel,
            message: newMessage.trim(),
            language: selectedLanguage,
          }),
        }
      );
      
      if (response.ok) {
        setNewMessage('');
        loadMessages();
      } else {
        const error = await response.json();
        Alert.alert('Error', error.detail || 'Failed to send message');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to send message');
    } finally {
      setIsSending(false);
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const renderLockedChat = () => (
    <View style={styles.lockedContainer}>
      <View style={styles.lockedOverlay}>
        <Ionicons name="lock-closed" size={64} color={COLORS.gold.primary} />
        <Text style={styles.lockedTitle}>Chat Locked</Text>
        <Text style={styles.lockedText}>
          {!unlockInfo?.tutorialCompleted 
            ? 'Complete Chapters 1 & 2 to unlock chat'
            : `Chat unlocks in ${unlockInfo?.remaining || 0} hours`
          }
        </Text>
        <View style={styles.unlockRequirements}>
          <View style={styles.requirementRow}>
            <Ionicons 
              name={unlockInfo?.tutorialCompleted ? 'checkmark-circle' : 'ellipse-outline'} 
              size={20} 
              color={unlockInfo?.tutorialCompleted ? COLORS.success : COLORS.navy.light} 
            />
            <Text style={styles.requirementText}>Complete Chapters 1 & 2</Text>
          </View>
          <View style={styles.requirementRow}>
            <Ionicons 
              name={chatUnlocked ? 'checkmark-circle' : 'ellipse-outline'} 
              size={20} 
              color={chatUnlocked ? COLORS.success : COLORS.navy.light} 
            />
            <Text style={styles.requirementText}>Wait 32 hours after tutorial</Text>
          </View>
        </View>
      </View>
    </View>
  );

  if (!user) {
    return (
      <LinearGradient colors={[COLORS.navy.darkest, COLORS.navy.dark]} style={styles.container}>
        <SafeAreaView style={styles.centerContainer}>
          <Text style={styles.errorText}>Please log in first</Text>
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
            <Text style={styles.title}>Chat</Text>
            
            {/* Channel Tabs */}
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              style={styles.channelContainer}
            >
              {CHANNELS.map((channel) => (
                <TouchableOpacity
                  key={channel.id}
                  style={[
                    styles.channelTab,
                    selectedChannel === channel.id && styles.channelTabActive,
                  ]}
                  onPress={() => setSelectedChannel(channel.id)}
                >
                  <Ionicons 
                    name={channel.icon as any} 
                    size={16} 
                    color={selectedChannel === channel.id ? COLORS.navy.darkest : channel.color} 
                  />
                  <Text style={[
                    styles.channelText,
                    selectedChannel === channel.id && styles.channelTextActive
                  ]}>
                    {channel.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {!chatUnlocked ? (
            renderLockedChat()
          ) : (
            <>
              {/* Messages */}
              <ScrollView 
                ref={scrollViewRef}
                style={styles.messagesContainer}
                contentContainerStyle={styles.messagesContent}
              >
                {messages.length === 0 ? (
                  <View style={styles.emptyMessages}>
                    <Ionicons name="chatbubbles-outline" size={48} color={COLORS.navy.light} />
                    <Text style={styles.emptyText}>No messages yet</Text>
                    <Text style={styles.emptySubtext}>Be the first to say hello!</Text>
                  </View>
                ) : (
                  messages.map((msg) => (
                    <View 
                      key={msg.id} 
                      style={[
                        styles.messageRow,
                        msg.sender_username === user.username && styles.messageRowOwn
                      ]}
                    >
                      <View style={[
                        styles.messageBubble,
                        msg.sender_username === user.username && styles.messageBubbleOwn
                      ]}>
                        <View style={styles.messageHeader}>
                          <Text style={[
                            styles.messageSender,
                            msg.sender_username === user.username && styles.messageSenderOwn
                          ]}>
                            {msg.sender_username}
                          </Text>
                          <Text style={styles.messageTime}>{formatTime(msg.timestamp)}</Text>
                        </View>
                        <Text style={[
                          styles.messageText,
                          msg.sender_username === user.username && styles.messageTextOwn
                        ]}>
                          {msg.message}
                        </Text>
                      </View>
                    </View>
                  ))
                )}
              </ScrollView>

              {/* Language Selector */}
              {showLanguageSelector && (
                <View style={styles.languageSelector}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {LANGUAGES.map((lang) => (
                      <TouchableOpacity
                        key={lang.code}
                        style={[
                          styles.languageOption,
                          selectedLanguage === lang.code && styles.languageOptionActive
                        ]}
                        onPress={() => {
                          setSelectedLanguage(lang.code);
                          setShowLanguageSelector(false);
                        }}
                      >
                        <Text style={[
                          styles.languageText,
                          selectedLanguage === lang.code && styles.languageTextActive
                        ]}>
                          {lang.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

              {/* Input Area */}
              <View style={styles.inputContainer}>
                <TouchableOpacity
                  style={styles.languageButton}
                  onPress={() => setShowLanguageSelector(!showLanguageSelector)}
                >
                  <Ionicons name="language" size={20} color={COLORS.gold.light} />
                  <Text style={styles.languageButtonText}>
                    {LANGUAGES.find(l => l.code === selectedLanguage)?.name.slice(0, 2).toUpperCase()}
                  </Text>
                </TouchableOpacity>
                
                <TextInput
                  style={styles.input}
                  value={newMessage}
                  onChangeText={setNewMessage}
                  placeholder="Type a message..."
                  placeholderTextColor={COLORS.navy.light}
                  multiline
                  maxLength={500}
                />
                
                <TouchableOpacity
                  style={[styles.sendButton, (!newMessage.trim() || isSending) && styles.sendButtonDisabled]}
                  onPress={sendMessage}
                  disabled={!newMessage.trim() || isSending}
                >
                  <LinearGradient
                    colors={[COLORS.gold.primary, COLORS.gold.dark]}
                    style={styles.sendButtonGradient}
                  >
                    {isSending ? (
                      <ActivityIndicator size="small" color={COLORS.navy.darkest} />
                    ) : (
                      <Ionicons name="send" size={20} color={COLORS.navy.darkest} />
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centerContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { paddingTop: 60, paddingHorizontal: 16, paddingBottom: 12 },
  title: { fontSize: 28, fontWeight: 'bold', color: COLORS.cream.pure, textAlign: 'center', marginBottom: 12, letterSpacing: 1 },
  channelContainer: { flexDirection: 'row' },
  channelTab: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: COLORS.gold.dark + '40', marginRight: 8, backgroundColor: COLORS.navy.medium, gap: 6 },
  channelTabActive: { backgroundColor: COLORS.gold.primary, borderColor: COLORS.gold.primary },
  channelText: { fontSize: 14, fontWeight: 'bold', color: COLORS.cream.soft },
  channelTextActive: { color: COLORS.navy.darkest },
  messagesContainer: { flex: 1 },
  messagesContent: { padding: 16, paddingBottom: 20 },
  emptyMessages: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyText: { fontSize: 18, fontWeight: 'bold', color: COLORS.cream.pure, marginTop: 12 },
  emptySubtext: { fontSize: 14, color: COLORS.cream.dark, marginTop: 4 },
  messageRow: { marginBottom: 12, alignItems: 'flex-start' },
  messageRowOwn: { alignItems: 'flex-end' },
  messageBubble: { backgroundColor: COLORS.navy.medium, borderRadius: 16, borderTopLeftRadius: 4, padding: 12, maxWidth: '80%', borderWidth: 1, borderColor: COLORS.gold.dark + '30' },
  messageBubbleOwn: { backgroundColor: COLORS.gold.primary, borderTopLeftRadius: 16, borderTopRightRadius: 4, borderColor: COLORS.gold.dark },
  messageHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4, gap: 12 },
  messageSender: { fontSize: 12, fontWeight: 'bold', color: COLORS.gold.light },
  messageSenderOwn: { color: COLORS.navy.darkest },
  messageTime: { fontSize: 10, color: COLORS.cream.dark },
  messageText: { fontSize: 14, color: COLORS.cream.pure, lineHeight: 20 },
  messageTextOwn: { color: COLORS.navy.darkest },
  languageSelector: { backgroundColor: COLORS.navy.medium, paddingVertical: 8, paddingHorizontal: 16 },
  languageOption: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, marginRight: 8, backgroundColor: COLORS.navy.dark },
  languageOptionActive: { backgroundColor: COLORS.gold.primary },
  languageText: { fontSize: 12, color: COLORS.cream.soft },
  languageTextActive: { fontWeight: 'bold', color: COLORS.navy.darkest },
  inputContainer: { flexDirection: 'row', alignItems: 'flex-end', padding: 12, paddingBottom: 24, backgroundColor: COLORS.navy.medium, gap: 8, borderTopWidth: 1, borderTopColor: COLORS.gold.dark + '30' },
  languageButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.navy.dark, paddingHorizontal: 10, paddingVertical: 10, borderRadius: 20, gap: 4, borderWidth: 1, borderColor: COLORS.gold.dark + '40' },
  languageButtonText: { fontSize: 10, fontWeight: 'bold', color: COLORS.gold.light },
  input: { flex: 1, backgroundColor: COLORS.navy.dark, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, maxHeight: 100, color: COLORS.cream.pure, borderWidth: 1, borderColor: COLORS.gold.dark + '40' },
  sendButton: { borderRadius: 22, overflow: 'hidden' },
  sendButtonGradient: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  sendButtonDisabled: { opacity: 0.5 },
  lockedContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  lockedOverlay: { alignItems: 'center', padding: 40, borderRadius: 20, margin: 20, backgroundColor: COLORS.navy.medium, borderWidth: 1, borderColor: COLORS.gold.dark + '40' },
  lockedTitle: { fontSize: 24, fontWeight: 'bold', color: COLORS.gold.primary, marginTop: 16, marginBottom: 8 },
  lockedText: { fontSize: 16, color: COLORS.cream.soft, textAlign: 'center', marginBottom: 20 },
  unlockRequirements: { alignSelf: 'stretch' },
  requirementRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  requirementText: { fontSize: 14, color: COLORS.cream.soft },
  errorText: { color: COLORS.cream.pure, fontSize: 18, textAlign: 'center' },
});
