/**
 * Phase E4: PvP Bracket Tournament Screen
 * 
 * Shows bracket-style tournament view:
 * - 8-slot Quarterfinals
 * - 4-slot Semifinals
 * - 2-slot Final
 * - Winner
 * 
 * Populated with player + NPCs (Practice A-E).
 * NO monetization hooks. NO timers/polling. Ethics-safe.
 */

import React, { useEffect, useState, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Pressable,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import COLORS from '../theme/colors';
import { useGameStore, useHydration } from '../stores/gameStore';
import { track, Events } from '../lib/telemetry/events';
import { PvpRulesSheet } from '../components/pvp/PvpRulesSheet';

// NPC Practice opponents (deterministic)
const NPC_OPPONENTS = [
  { id: 'npc_a', name: 'Practice A', power: 8500, rank: 100 },
  { id: 'npc_b', name: 'Practice B', power: 9200, rank: 85 },
  { id: 'npc_c', name: 'Practice C', power: 10100, rank: 70 },
  { id: 'npc_d', name: 'Practice D', power: 11500, rank: 55 },
  { id: 'npc_e', name: 'Practice E', power: 12800, rank: 40 },
];

// Placeholder opponents for empty slots
const PLACEHOLDER_OPPONENTS = [
  { id: 'placeholder_1', name: 'TBD', power: 0, rank: 0, isPlaceholder: true },
  { id: 'placeholder_2', name: 'TBD', power: 0, rank: 0, isPlaceholder: true },
];

type BracketParticipant = {
  id: string;
  name: string;
  power: number;
  rank: number;
  isPlayer?: boolean;
  isPlaceholder?: boolean;
};

type MatchSlot = {
  id: string;
  participant1: BracketParticipant | null;
  participant2: BracketParticipant | null;
  winner: BracketParticipant | null;
};

export default function PvpTournamentScreen() {
  const { user } = useGameStore();
  const hydrated = useHydration();
  const hasTrackedView = useRef(false);
  
  const [showRules, setShowRules] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<MatchSlot | null>(null);
  const [showMatchPreview, setShowMatchPreview] = useState(false);
  
  // Track view on mount
  useEffect(() => {
    if (hydrated && !hasTrackedView.current) {
      track(Events.PVP_TOURNAMENT_VIEWED, {});
      hasTrackedView.current = true;
    }
  }, [hydrated]);
  
  // Build bracket participants (player + NPCs + placeholders)
  const participants = useMemo((): BracketParticipant[] => {
    const player: BracketParticipant = {
      id: user?.id || 'player',
      name: user?.username || 'You',
      power: user?.power || 10000,
      rank: 1,
      isPlayer: true,
    };
    
    // Player + 5 NPCs + 2 placeholders = 8 total for Quarterfinals
    return [
      player,
      ...NPC_OPPONENTS.map(npc => ({ ...npc, isPlayer: false })),
      ...PLACEHOLDER_OPPONENTS,
    ];
  }, [user]);
  
  // Build bracket structure (Quarterfinals -> Semifinals -> Final -> Winner)
  const bracket = useMemo(() => {
    // Quarterfinals: 4 matches (8 participants)
    const quarterfinals: MatchSlot[] = [
      { id: 'qf_1', participant1: participants[0], participant2: participants[7], winner: null },
      { id: 'qf_2', participant1: participants[3], participant2: participants[4], winner: null },
      { id: 'qf_3', participant1: participants[2], participant2: participants[5], winner: null },
      { id: 'qf_4', participant1: participants[1], participant2: participants[6], winner: null },
    ];
    
    // Semifinals: 2 matches (winners of QF)
    const semifinals: MatchSlot[] = [
      { id: 'sf_1', participant1: null, participant2: null, winner: null },
      { id: 'sf_2', participant1: null, participant2: null, winner: null },
    ];
    
    // Final: 1 match
    const final: MatchSlot = { id: 'final', participant1: null, participant2: null, winner: null };
    
    return { quarterfinals, semifinals, final };
  }, [participants]);
  
  const handleMatchSelect = (match: MatchSlot) => {
    track(Events.PVP_TOURNAMENT_MATCH_SELECTED, {
      matchId: match.id,
      participant1: match.participant1?.name,
      participant2: match.participant2?.name,
    });
    setSelectedMatch(match);
    setShowMatchPreview(true);
  };
  
  const handleOpenRules = () => {
    setShowRules(true);
  };
  
  const handleStartMatch = () => {
    setShowMatchPreview(false);
    // Navigate to arena for the actual match
    router.push('/(tabs)/arena');
  };
  
  if (!hydrated) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading tournament...</Text>
        </View>
      </SafeAreaView>
    );
  }
  
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <LinearGradient
        colors={[COLORS.navy.dark, COLORS.navy.darkest]}
        style={styles.gradient}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="chevron-back" size={24} color={COLORS.cream.pure} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>🏆 Tournament</Text>
          <TouchableOpacity
            style={styles.rulesButton}
            onPress={handleOpenRules}
          >
            <Ionicons name="help-circle" size={24} color={COLORS.gold.primary} />
          </TouchableOpacity>
        </View>
        
        <ScrollView 
          style={styles.content}
          contentContainerStyle={styles.contentInner}
          showsVerticalScrollIndicator={false}
        >
          {/* Winner Slot */}
          <View style={styles.stageSection}>
            <Text style={styles.stageTitle}>🏆 Champion</Text>
            <View style={styles.winnerSlot}>
              <Ionicons name="trophy" size={32} color={COLORS.gold.primary} />
              <Text style={styles.winnerText}>Winner</Text>
            </View>
          </View>
          
          {/* Final */}
          <View style={styles.stageSection}>
            <Text style={styles.stageTitle}>Final</Text>
            <View style={styles.matchesRow}>
              <MatchCard
                match={bracket.final}
                onPress={() => handleMatchSelect(bracket.final)}
                isFinal
              />
            </View>
          </View>
          
          {/* Semifinals */}
          <View style={styles.stageSection}>
            <Text style={styles.stageTitle}>Semifinals</Text>
            <View style={styles.matchesRow}>
              {bracket.semifinals.map(match => (
                <MatchCard
                  key={match.id}
                  match={match}
                  onPress={() => handleMatchSelect(match)}
                />
              ))}
            </View>
          </View>
          
          {/* Quarterfinals */}
          <View style={styles.stageSection}>
            <Text style={styles.stageTitle}>Quarterfinals</Text>
            <View style={styles.matchesGrid}>
              {bracket.quarterfinals.map(match => (
                <MatchCard
                  key={match.id}
                  match={match}
                  onPress={() => handleMatchSelect(match)}
                />
              ))}
            </View>
          </View>
          
          {/* Info Panel */}
          <View style={styles.infoPanel}>
            <Ionicons name="information-circle" size={18} color={COLORS.gold.light} />
            <Text style={styles.infoText}>
              Tap any match to preview. Tournament matches use arena tickets.
            </Text>
          </View>
        </ScrollView>
      </LinearGradient>
      
      {/* Rules Sheet */}
      <PvpRulesSheet visible={showRules} onClose={() => setShowRules(false)} />
      
      {/* Match Preview Modal */}
      <Modal
        visible={showMatchPreview}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMatchPreview(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <LinearGradient
              colors={[COLORS.navy.dark, COLORS.navy.darkest]}
              style={styles.modalGradient}
            >
              <Text style={styles.modalTitle}>⚔️ Match Preview</Text>
              
              {selectedMatch && (
                <View style={styles.matchupContainer}>
                  <ParticipantCard
                    participant={selectedMatch.participant1}
                    side="left"
                  />
                  <Text style={styles.vsText}>VS</Text>
                  <ParticipantCard
                    participant={selectedMatch.participant2}
                    side="right"
                  />
                </View>
              )}
              
              <View style={styles.modalActions}>
                <Pressable
                  style={({ pressed }) => [
                    styles.modalButton,
                    styles.cancelButton,
                    pressed && styles.buttonPressed,
                  ]}
                  onPress={() => setShowMatchPreview(false)}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [
                    styles.modalButton,
                    styles.fightButton,
                    pressed && styles.buttonPressed,
                  ]}
                  onPress={handleStartMatch}
                >
                  <Text style={styles.fightButtonText}>Fight!</Text>
                </Pressable>
              </View>
            </LinearGradient>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// Match Card Component
function MatchCard({
  match,
  onPress,
  isFinal = false,
}: {
  match: MatchSlot;
  onPress: () => void;
  isFinal?: boolean;
}) {
  const hasParticipants = match.participant1 || match.participant2;
  
  return (
    <TouchableOpacity
      style={[styles.matchCard, isFinal && styles.matchCardFinal]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.matchSlot}>
        <Text
          style={[
            styles.matchParticipant,
            match.participant1?.isPlayer && styles.playerName,
            match.participant1?.isPlaceholder && styles.placeholderName,
          ]}
          numberOfLines={1}
        >
          {match.participant1?.name || 'TBD'}
        </Text>
      </View>
      <View style={styles.matchDivider}>
        <Text style={styles.matchVs}>vs</Text>
      </View>
      <View style={styles.matchSlot}>
        <Text
          style={[
            styles.matchParticipant,
            match.participant2?.isPlayer && styles.playerName,
            match.participant2?.isPlaceholder && styles.placeholderName,
          ]}
          numberOfLines={1}
        >
          {match.participant2?.name || 'TBD'}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

// Participant Card for Preview Modal
function ParticipantCard({
  participant,
  side,
}: {
  participant: BracketParticipant | null;
  side: 'left' | 'right';
}) {
  if (!participant) {
    return (
      <View style={styles.participantCard}>
        <Text style={styles.participantTbd}>TBD</Text>
      </View>
    );
  }
  
  return (
    <View style={styles.participantCard}>
      <View style={[
        styles.participantAvatar,
        participant.isPlayer && styles.playerAvatar,
      ]}>
        <Ionicons
          name={participant.isPlayer ? 'person' : 'skull'}
          size={24}
          color={participant.isPlayer ? COLORS.gold.primary : COLORS.cream.dark}
        />
      </View>
      <Text
        style={[
          styles.participantName,
          participant.isPlayer && styles.playerName,
        ]}
        numberOfLines={1}
      >
        {participant.name}
      </Text>
      {participant.power > 0 && (
        <Text style={styles.participantPower}>
          ⚔️ {participant.power.toLocaleString()}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.navy.darkest,
  },
  gradient: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: COLORS.cream.dark,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.cream.pure + '10',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.cream.pure,
  },
  rulesButton: {
    padding: 4,
  },
  content: {
    flex: 1,
  },
  contentInner: {
    padding: 16,
    paddingBottom: 40,
  },
  stageSection: {
    marginBottom: 24,
  },
  stageTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.gold.primary,
    marginBottom: 12,
    textAlign: 'center',
  },
  winnerSlot: {
    alignItems: 'center',
    backgroundColor: COLORS.gold.primary + '20',
    paddingVertical: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.gold.primary + '40',
  },
  winnerText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.gold.light,
    marginTop: 8,
  },
  matchesRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  matchesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
  },
  matchCard: {
    backgroundColor: COLORS.navy.primary,
    borderRadius: 10,
    padding: 12,
    minWidth: 140,
    borderWidth: 1,
    borderColor: COLORS.cream.pure + '15',
  },
  matchCardFinal: {
    minWidth: 180,
    borderColor: COLORS.gold.primary + '40',
  },
  matchSlot: {
    paddingVertical: 6,
  },
  matchParticipant: {
    fontSize: 13,
    color: COLORS.cream.soft,
    textAlign: 'center',
  },
  matchDivider: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  matchVs: {
    fontSize: 10,
    color: COLORS.cream.dark,
    fontWeight: '600',
  },
  playerName: {
    color: COLORS.gold.primary,
    fontWeight: '600',
  },
  placeholderName: {
    color: COLORS.cream.dark,
    fontStyle: 'italic',
  },
  infoPanel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.navy.primary + '60',
    padding: 12,
    borderRadius: 10,
    marginTop: 8,
  },
  infoText: {
    fontSize: 12,
    color: COLORS.cream.dark,
    flex: 1,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 16,
    overflow: 'hidden',
  },
  modalGradient: {
    padding: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.cream.pure,
    textAlign: 'center',
    marginBottom: 20,
  },
  matchupContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  vsText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.gold.primary,
  },
  participantCard: {
    alignItems: 'center',
    flex: 1,
  },
  participantAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.navy.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  playerAvatar: {
    backgroundColor: COLORS.gold.primary + '30',
    borderWidth: 2,
    borderColor: COLORS.gold.primary,
  },
  participantName: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.cream.soft,
    textAlign: 'center',
  },
  participantPower: {
    fontSize: 12,
    color: COLORS.cream.dark,
    marginTop: 4,
  },
  participantTbd: {
    fontSize: 14,
    color: COLORS.cream.dark,
    fontStyle: 'italic',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: COLORS.navy.primary,
  },
  fightButton: {
    backgroundColor: COLORS.gold.primary,
  },
  buttonPressed: {
    opacity: 0.8,
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.cream.soft,
  },
  fightButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.navy.darkest,
  },
});
