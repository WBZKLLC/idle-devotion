import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useGameStore, useHydration } from '../../stores/gameStore';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
// Phase 3.19.11: Confirm modal hook
import { useConfirmModal } from '../../components/ui/useConfirmModal';
// Phase 3.18.4: Toast for non-blocking feedback
import { toast } from '../../components/ui/Toast';
// Phase 3.19.7: Cinematic loading screen
import { CinematicLoading } from '../../components/ui/CinematicLoading';
// Single source of truth for login hero
import { LOGIN_HERO_URI } from '../../lib/assets/loginHero';

/**
 * Login Screen - Separate from tabs, no tab bar visible here
 * Phase 3.22.2: Route restructure for proper auth/tabs separation
 */
export default function LoginScreen() {
  const { isLoading, registerUser, loginWithPassword, setPasswordForLegacyAccount } = useGameStore();
  const hydrated = useHydration();
  
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  // Phase 3.19.11: Confirm modal hook
  const { openConfirm, confirmNode } = useConfirmModal();

  const handleStartGame = async () => {
    const trimmedUsername = username.trim();
    if (!trimmedUsername) { 
      toast.warning('Please enter a username to begin');
      return; 
    }
    if (!password) {
      toast.warning('Please enter a password to secure your account');
      return;
    }
    if (password.length < 6) {
      toast.warning('Password must be at least 6 characters');
      return;
    }
    
    setAuthError('');
    
    if (isRegistering) {
      // Registration flow
      if (password !== confirmPassword) {
        toast.error('Passwords do not match');
        return;
      }
      
      const result = await registerUser(trimmedUsername, password);
      if (!result.success) {
        setAuthError(result.error || 'Registration failed');
      }
      // On success, the root layout will redirect to (tabs)
    } else {
      // Login flow
      const result = await loginWithPassword(trimmedUsername, password);
      if (!result.success) {
        if (result.error === 'NEEDS_PASSWORD') {
          // Legacy account - prompt to set password
          openConfirm({
            title: 'Account Security Upgrade',
            message: 'This account was created before passwords were required. Please set a password to secure your account.',
            tone: 'neutral',
            confirmText: 'Set Password',
            cancelText: 'Cancel',
            icon: 'shield-checkmark-outline',
            onConfirm: async () => {
              const setResult = await setPasswordForLegacyAccount(trimmedUsername, password);
              if (!setResult.success) {
                setAuthError(setResult.error || 'Failed to set password');
              } else {
                toast.success('Password set successfully! Your account is now secure.');
              }
            },
          });
        } else if (result.error?.includes('Invalid username')) {
          // User doesn't exist - offer to register
          openConfirm({
            title: 'Account Not Found',
            message: 'No account with this username exists. Would you like to create a new account?',
            tone: 'neutral',
            confirmText: 'Create Account',
            cancelText: 'Cancel',
            icon: 'person-add-outline',
            onConfirm: () => setIsRegistering(true),
          });
        } else {
          setAuthError(result.error || 'Login failed');
        }
      }
      // On success, the root layout will redirect to (tabs)
    }
  };

  // Phase 3.19.7: Cinematic loading screen for initial hydration
  if (!hydrated || isLoading) {
    return <CinematicLoading />;
  }

  return (
    <View style={styles.screenContainer}>
      {/* Background: Login hero - MATH-CENTERED (Login "wow" moment) */}
      <CenteredBackground
        source={{ uri: LOGIN_HERO_URI }}
        mode="contain"
        zoom={1.06}
        opacity={1}
      />
      
      {/* Divine Overlays - premium celestial aesthetic */}
      <DivineOverlays vignette rays grain />
      
      {/* Additional gradient overlays for text readability */}
      <View style={styles.topGradientA} />
      <View style={styles.topGradientB} />
      <View style={styles.bottomGradientA} />
      <View style={styles.bottomGradientB} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoid}
      >
        <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
          <ScrollView 
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* TOP BRAND BLOCK */}
            <View style={styles.brandContainer}>
              {/* Brand Circle */}
              <View style={styles.brandCircle}>
                <Text style={styles.brandText}>DH</Text>
              </View>
              
              {/* Title */}
              <Text style={styles.title}>IDLE DEVOTION</Text>
              
              {/* Subtitle */}
              <Text style={styles.subtitle}>A SOUL BOUND FANTASY</Text>
            </View>

            {/* LOGIN CARD */}
            <View style={styles.card}>
              {/* Card Header */}
              <Text style={styles.cardTitle}>
                {isRegistering ? 'Create Account' : 'Welcome Back'}
              </Text>
              <Text style={styles.cardSubtitle}>
                {isRegistering ? 'Begin your divine journey' : 'Your heroes await'}
              </Text>
              
              {/* Error Display */}
              {authError ? (
                <View style={styles.errorBox}>
                  <Ionicons name="alert-circle" size={14} color="rgba(255,210,215,0.95)" style={{ opacity: 0.9 }} />
                  <Text style={styles.errorText}>{authError}</Text>
                </View>
              ) : null}
              
              {/* Username Input */}
              <View style={styles.inputContainer}>
                <Ionicons name="person" size={18} color="rgba(255,255,255,0.7)" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={username}
                  onChangeText={setUsername}
                  placeholder="Username"
                  placeholderTextColor="rgba(255,255,255,0.40)"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
              
              {/* Password Input */}
              <View style={styles.inputContainer}>
                <Ionicons name="lock-closed" size={18} color="rgba(255,255,255,0.7)" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Password"
                  placeholderTextColor="rgba(255,255,255,0.40)"
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                />
                <TouchableOpacity 
                  style={styles.eyeButton} 
                  onPress={() => setShowPassword(!showPassword)}
                >
                  <Ionicons 
                    name={showPassword ? 'eye-off' : 'eye'} 
                    size={18} 
                    color="rgba(255,255,255,0.6)" 
                  />
                </TouchableOpacity>
              </View>
              
              {/* Confirm Password (Registration) */}
              {isRegistering && (
                <View style={styles.inputContainer}>
                  <Ionicons name="shield-checkmark" size={18} color="rgba(255,255,255,0.7)" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    placeholder="Confirm Password"
                    placeholderTextColor="rgba(255,255,255,0.40)"
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                  />
                </View>
              )}
              
              {/* Primary Button */}
              <TouchableOpacity style={styles.primaryButton} onPress={handleStartGame}>
                <View style={styles.buttonHighlight} />
                <Text style={styles.buttonText}>
                  {isRegistering ? 'CREATE ACCOUNT →' : 'BEGIN JOURNEY →'}
                </Text>
              </TouchableOpacity>
              
              {/* Secondary Link */}
              <TouchableOpacity 
                style={styles.secondaryLink} 
                onPress={() => {
                  setIsRegistering(!isRegistering);
                  setAuthError('');
                  setConfirmPassword('');
                }}
              >
                <Text style={styles.secondaryText}>
                  {isRegistering ? 'Already have an account? ' : 'New player? '}
                  <Text style={styles.secondaryHighlight}>
                    {isRegistering ? 'Login' : 'Create Account'}
                  </Text>
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
      
      {/* Confirm Modal */}
      {confirmNode}
    </View>
  );
}

// ============ HELPER COMPONENTS ============

type CenterFitMode = "contain" | "native";

/**
 * CenteredBackground - Hardened version with no-jump, truly deterministic centering
 */
function CenteredBackground(props: {
  source: any;
  mode?: CenterFitMode;
  zoom?: number;
  opacity?: number;
  waitForSize?: boolean;
}) {
  const { width: screenW, height: screenH } = useWindowDimensions();
  const mode = props.mode ?? "contain";
  const zoom = props.zoom ?? 1;
  const opacity = props.opacity ?? 1;
  const waitForSize = props.waitForSize ?? true;

  const resolvedLocal = React.useMemo(() => {
    try {
      return Image.resolveAssetSource(props.source);
    } catch {
      return undefined;
    }
  }, [props.source]);

  const uri = props.source?.uri as string | undefined;
  const [remoteSize, setRemoteSize] = React.useState<{ w: number; h: number } | null>(null);
  const [remoteReady, setRemoteReady] = React.useState(false);

  React.useEffect(() => {
    let alive = true;

    if (!uri) {
      setRemoteSize(null);
      setRemoteReady(true);
      return;
    }

    setRemoteReady(false);
    Image.getSize(
      uri,
      (w, h) => {
        if (!alive) return;
        setRemoteSize({ w, h });
        setRemoteReady(true);
      },
      () => {
        if (!alive) return;
        setRemoteSize(null);
        setRemoteReady(true);
      }
    );

    return () => { alive = false; };
  }, [uri]);

  if (uri && waitForSize && !remoteReady) return null;

  const imgW = resolvedLocal?.width ?? remoteSize?.w ?? screenW;
  const imgH = resolvedLocal?.height ?? remoteSize?.h ?? screenH;

  let scale = 1;
  if (mode === "contain") {
    const sx = screenW / imgW;
    const sy = screenH / imgH;
    scale = Math.min(sx, sy) * zoom;
  } else {
    scale = zoom;
  }

  const scaledW = imgW * scale;
  const scaledH = imgH * scale;
  const left = (screenW - scaledW) / 2;
  const top = (screenH - scaledH) / 2;

  return (
    <Image
      source={props.source}
      style={{
        position: "absolute",
        width: scaledW,
        height: scaledH,
        left,
        top,
        opacity,
      }}
      resizeMode="stretch"
    />
  );
}

/**
 * DivineOverlays - Premium overlay effects for celestial gacha aesthetic
 */
function DivineOverlays(props: { vignette?: boolean; rays?: boolean; grain?: boolean }) {
  return (
    <>
      {props.rays ? (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: -120,
            top: -120,
            right: -120,
            bottom: -120,
            transform: [{ rotate: "-12deg" }],
            backgroundColor: "rgba(255,255,255,0.04)",
          }}
        />
      ) : null}

      {props.vignette ? (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.28)",
          }}
        />
      ) : null}

      {props.grain ? (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(255,255,255,0.02)",
          }}
        />
      ) : null}
    </>
  );
}

// ============ STYLES ============

const styles = StyleSheet.create({
  screenContainer: {
    flex: 1,
    backgroundColor: '#080614',
  },
  
  topGradientA: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 120,
    backgroundColor: 'rgba(8,6,20,0.65)',
  },
  topGradientB: {
    position: 'absolute',
    top: 120,
    left: 0,
    right: 0,
    height: 100,
    backgroundColor: 'rgba(8,6,20,0.25)',
  },
  
  bottomGradientA: {
    position: 'absolute',
    bottom: 160,
    left: 0,
    right: 0,
    height: 160,
    backgroundColor: 'rgba(8,6,20,0.20)',
  },
  bottomGradientB: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 160,
    backgroundColor: 'rgba(8,6,20,0.70)',
  },
  
  keyboardAvoid: { flex: 1 },
  safeArea: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 26,
  },
  
  brandContainer: {
    alignItems: 'center',
    marginTop: 14,
  },
  
  brandCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    marginBottom: 10,
    backgroundColor: 'rgba(124,58,237,0.25)',
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 10,
    shadowColor: '#a855f7',
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  brandText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#E9D5FF',
  },
  
  title: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 3.2,
    marginTop: 6,
    color: '#F5F3FF',
    textShadowColor: 'rgba(168,85,247,0.55)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 12,
  },
  
  subtitle: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 2.0,
    marginTop: 6,
    marginBottom: 18,
    color: 'rgba(253,230,138,0.92)',
  },
  
  card: {
    width: '92%',
    maxWidth: 420,
    alignSelf: 'center',
    marginTop: 6,
    marginBottom: 14,
    paddingHorizontal: 18,
    paddingVertical: 18,
    borderRadius: 18,
    backgroundColor: 'rgba(12,10,30,0.62)',
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.35)',
    elevation: 16,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
  },
  
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  cardSubtitle: {
    fontSize: 12,
    marginTop: 4,
    marginBottom: 16,
    color: 'rgba(255,255,255,0.65)',
    textAlign: 'center',
  },
  
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    borderRadius: 14,
    marginTop: 12,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(8,6,20,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  inputIcon: {
    marginRight: 10,
    opacity: 0.7,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: '#FFFFFF',
  },
  eyeButton: {
    padding: 8,
  },
  
  primaryButton: {
    height: 52,
    borderRadius: 14,
    marginTop: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(124,58,237,0.95)',
    overflow: 'hidden',
  },
  buttonHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 26,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.10)',
    opacity: 0.45,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1.4,
    color: '#F5F3FF',
  },
  
  secondaryLink: {
    marginTop: 12,
    alignItems: 'center',
  },
  secondaryText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.70)',
  },
  secondaryHighlight: {
    color: 'rgba(253,230,138,0.95)',
    fontWeight: '700',
  },
  
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    padding: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(120,20,30,0.35)',
    borderWidth: 1,
    borderColor: 'rgba(255,120,140,0.35)',
    gap: 8,
  },
  errorText: {
    flex: 1,
    fontSize: 12,
    color: 'rgba(255,210,215,0.95)',
  },
});
