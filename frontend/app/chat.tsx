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

interface ChatMessage {
  id: string;
  sender_username: string;
  message: string;
  timestamp: string;
  language: string;
}

const CHANNELS = [
  { id: 'world', name: 'World', icon: 'globe', color: '#3498db' },
  { id: 'local', name: 'Local', icon: 'location', color: '#2ecc71' },
  { id: 'guild', name: 'Guild', icon: 'shield', color: '#9b59b6' },
  { id: 'private', name: 'Friends', icon: 'people', color: '#e74c3c' },
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
      // Poll for new messages every 5 seconds
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
      
      // Chat unlocks after completing chapters 1 & 2 and waiting 32 hours
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
      
      // For demo purposes, allow chat if user has played for a while
      // In production, this would be strictly enforced
      if (userData.login_days > 0) {
        setChatUnlocked(true);
      }
    } catch (error) {
      console.error('Failed to check chat unlock:', error);
      // Allow chat for demo
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
      
      // Auto scroll to bottom
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
      <LinearGradient
        colors={['rgba(0,0,0,0.5)', 'rgba(0,0,0,0.8)']}
        style={styles.lockedOverlay}
      >
        <Ionicons name="lock-closed" size={64} color="#FFD700" />
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
              color={unlockInfo?.tutorialCompleted ? '#32CD32' : '#666'} 
            />
            <Text style={styles.requirementText}>Complete Chapters 1 & 2</Text>
          </View>
          <View style={styles.requirementRow}>
            <Ionicons 
              name={chatUnlocked ? 'checkmark-circle' : 'ellipse-outline'} 
              size={20} 
              color={chatUnlocked ? '#32CD32' : '#666'} 
            />
            <Text style={styles.requirementText}>Wait 32 hours after tutorial</Text>
          </View>
        </View>
      </LinearGradient>
    </View>
  );

  if (!user) {
    return (
      <LinearGradient colors={['#2C3E50', '#3498db']} style={styles.container}>
        <SafeAreaView style={styles.container}>
          <Text style={styles.errorText}>Please log in first</Text>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={['#2C3E50', '#3498db']} style={styles.container}>
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView 
          style={styles.container}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>💬 Chat</Text>
            
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
                    { borderColor: channel.color }
                  ]}
                  onPress={() => setSelectedChannel(channel.id)}
                >
                  <Ionicons 
                    name={channel.icon as any} 
                    size={16} 
                    color={selectedChannel === channel.id ? channel.color : '#FFF'} 
                  />
                  <Text style={[
                    styles.channelText,
                    selectedChannel === channel.id && { color: channel.color }
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
                    <Ionicons name="chatbubbles-outline" size={48} color="rgba(255,255,255,0.5)" />
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
                  <Ionicons name="language" size={20} color="#FFF" />
                  <Text style={styles.languageButtonText}>
                    {LANGUAGES.find(l => l.code === selectedLanguage)?.name.slice(0, 2).toUpperCase()}
                  </Text>
                </TouchableOpacity>
                
                <TextInput
                  style={styles.input}
                  value={newMessage}
                  onChangeText={setNewMessage}
                  placeholder="Type a message..."
                  placeholderTextColor="#999"
                  multiline
                  maxLength={500}
                />
                
                <TouchableOpacity
                  style={[styles.sendButton, (!newMessage.trim() || isSending) && styles.sendButtonDisabled]}
                  onPress={sendMessage}
                  disabled={!newMessage.trim() || isSending}
                >
                  {isSending ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <Ionicons name="send" size={20} color="#FFF" />
                  )}
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
  container: {
    flex: 1,
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFF',
    textAlign: 'center',
    marginBottom: 12,
    textShadowColor: '#000',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  channelContainer: {
    flexDirection: 'row',
  },
  channelTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 2,
    marginRight: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    gap: 6,
  },
  channelTabActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
  channelText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFF',
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
    paddingBottom: 20,
  },
  emptyMessages: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFF',
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: 4,
  },
  messageRow: {
    marginBottom: 12,
    alignItems: 'flex-start',
  },
  messageRowOwn: {
    alignItems: 'flex-end',
  },
  messageBubble: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 16,
    borderTopLeftRadius: 4,
    padding: 12,
    maxWidth: '80%',
  },
  messageBubbleOwn: {
    backgroundColor: '#FF1493',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 4,
  },
  messageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
    gap: 12,
  },
  messageSender: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#333',
  },
  messageSenderOwn: {
    color: 'rgba(255, 255, 255, 0.9)',
  },
  messageTime: {
    fontSize: 10,
    color: '#999',
  },
  messageText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  messageTextOwn: {
    color: '#FFF',
  },
  languageSelector: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  languageOption: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  languageOptionActive: {
    backgroundColor: '#FF1493',
  },
  languageText: {
    fontSize: 12,
    color: '#FFF',
  },
  languageTextActive: {
    fontWeight: 'bold',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    paddingBottom: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    gap: 8,
  },
  languageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 4,
  },
  languageButtonText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#FFF',
  },
  input: {
    flex: 1,
    backgroundColor: '#FFF',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    maxHeight: 100,
    color: '#333',
  },
  sendButton: {
    backgroundColor: '#FF1493',
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  lockedContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockedOverlay: {
    alignItems: 'center',
    padding: 40,
    borderRadius: 20,
    margin: 20,
  },
  lockedTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFD700',
    marginTop: 16,
    marginBottom: 8,
  },
  lockedText: {
    fontSize: 16,
    color: '#FFF',
    textAlign: 'center',
    marginBottom: 20,
  },
  unlockRequirements: {
    alignSelf: 'stretch',
  },
  requirementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  requirementText: {
    fontSize: 14,
    color: '#FFF',
  },
  errorText: {
    color: '#FFF',
    fontSize: 18,
    textAlign: 'center',
    marginTop: 100,
  },
});
