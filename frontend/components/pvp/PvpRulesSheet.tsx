/**
 * Phase E4: PvP Rules Sheet
 * 
 * Transparent explanation of PvP mechanics:
 * - Attempts per day (tickets)
 * - Reward types (medals, rating)
 * - Normalization explanation
 * - "No pay-to-win" ethics statement
 * 
 * NO shop links. NO purchase CTAs. NO external links.
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import COLORS from '../../theme/colors';
import { track, Events } from '../../lib/telemetry/events';

export interface PvpRulesSheetProps {
  visible: boolean;
  onClose: () => void;
}

export function PvpRulesSheet({ visible, onClose }: PvpRulesSheetProps) {
  const hasTracked = useRef(false);
  
  useEffect(() => {
    if (visible && !hasTracked.current) {
      track(Events.PVP_RULES_SHEET_OPENED, {});
      hasTracked.current = true;
    }
    if (!visible) {
      hasTracked.current = false;
    }
  }, [visible]);
  
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <LinearGradient
            colors={[COLORS.navy.dark, COLORS.navy.darkest]}
            style={styles.gradient}
          >
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>⚔️ Arena Rules</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Ionicons name="close" size={24} color={COLORS.cream.soft} />
              </TouchableOpacity>
            </View>
            
            <ScrollView 
              style={styles.content} 
              contentContainerStyle={styles.contentInner}
              showsVerticalScrollIndicator={false}
            >
              {/* Attempts Section */}
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="ticket" size={20} color={COLORS.gold.primary} />
                  <Text style={styles.sectionTitle}>Attempts</Text>
                </View>
                <Text style={styles.sectionText}>
                  You receive <Text style={styles.highlight}>5 arena tickets</Text> per day.
                  Tickets refresh daily at server reset.
                </Text>
                <Text style={styles.sectionText}>
                  Each match costs 1 ticket. Use them wisely to climb the rankings!
                </Text>
              </View>
              
              {/* Rewards Section */}
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="trophy" size={20} color={COLORS.gold.primary} />
                  <Text style={styles.sectionTitle}>Rewards</Text>
                </View>
                <View style={styles.rewardsList}>
                  <View style={styles.rewardItem}>
                    <Ionicons name="medal" size={16} color={COLORS.gold.light} />
                    <Text style={styles.rewardText}>
                      <Text style={styles.highlight}>Arena Medals</Text> - Earned from victories
                    </Text>
                  </View>
                  <View style={styles.rewardItem}>
                    <Ionicons name="trending-up" size={16} color={COLORS.gold.light} />
                    <Text style={styles.rewardText}>
                      <Text style={styles.highlight}>Rating Points</Text> - Determines your rank
                    </Text>
                  </View>
                  <View style={styles.rewardItem}>
                    <Ionicons name="calendar" size={16} color={COLORS.gold.light} />
                    <Text style={styles.rewardText}>
                      <Text style={styles.highlight}>Daily Rewards</Text> - Claim once per day
                    </Text>
                  </View>
                  <View style={styles.rewardItem}>
                    <Ionicons name="ribbon" size={16} color={COLORS.gold.light} />
                    <Text style={styles.rewardText}>
                      <Text style={styles.highlight}>Season Rewards</Text> - Based on final rank
                    </Text>
                  </View>
                </View>
              </View>
              
              {/* Normalization Section */}
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="scale" size={20} color={COLORS.gold.primary} />
                  <Text style={styles.sectionTitle}>Normalization</Text>
                </View>
                <Text style={styles.sectionText}>
                  Arena battles use <Text style={styles.highlight}>power normalization</Text> to 
                  ensure fair competition.
                </Text>
                <Text style={styles.sectionText}>
                  While team composition and synergy matter, raw power differences are 
                  balanced to keep matches competitive. Strategy beats stats!
                </Text>
              </View>
              
              {/* Match Rules Section */}
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="document-text" size={20} color={COLORS.gold.primary} />
                  <Text style={styles.sectionTitle}>Match Rules</Text>
                </View>
                <View style={styles.rulesList}>
                  <Text style={styles.ruleItem}>• Best team formation wins</Text>
                  <Text style={styles.ruleItem}>• Elemental advantages apply</Text>
                  <Text style={styles.ruleItem}>• Win streaks grant bonus rating</Text>
                  <Text style={styles.ruleItem}>• No time limit per match</Text>
                </View>
              </View>
              
              {/* Ethics Statement */}
              <View style={[styles.section, styles.ethicsSection]}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="shield-checkmark" size={20} color={COLORS.success} />
                  <Text style={[styles.sectionTitle, styles.ethicsTitle]}>Fair Play Guarantee</Text>
                </View>
                <Text style={styles.ethicsText}>
                  Arena is designed to be <Text style={styles.highlight}>skill-based</Text>. 
                  There are no pay-to-win mechanics in PvP. Your success depends on 
                  team strategy, not spending.
                </Text>
                <Text style={styles.ethicsText}>
                  All players compete on equal footing. May the best tactician win! 🏆
                </Text>
              </View>
            </ScrollView>
            
            {/* Close Button */}
            <Pressable
              style={({ pressed }) => [
                styles.doneButton,
                pressed && styles.doneButtonPressed,
              ]}
              onPress={onClose}
            >
              <Text style={styles.doneButtonText}>Got It</Text>
            </Pressable>
          </LinearGradient>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  container: {
    maxHeight: '85%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  gradient: {
    padding: 20,
    paddingBottom: 32,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: COLORS.cream.pure,
  },
  closeButton: {
    padding: 4,
  },
  content: {
    maxHeight: 400,
  },
  contentInner: {
    paddingBottom: 16,
  },
  section: {
    backgroundColor: COLORS.navy.primary + '60',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.gold.primary,
  },
  sectionText: {
    fontSize: 14,
    color: COLORS.cream.soft,
    lineHeight: 20,
    marginBottom: 6,
  },
  highlight: {
    color: COLORS.gold.light,
    fontWeight: '600',
  },
  rewardsList: {
    gap: 8,
  },
  rewardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rewardText: {
    fontSize: 13,
    color: COLORS.cream.soft,
    flex: 1,
  },
  rulesList: {
    gap: 6,
  },
  ruleItem: {
    fontSize: 13,
    color: COLORS.cream.soft,
    lineHeight: 18,
  },
  ethicsSection: {
    backgroundColor: COLORS.success + '15',
    borderWidth: 1,
    borderColor: COLORS.success + '30',
  },
  ethicsTitle: {
    color: COLORS.success,
  },
  ethicsText: {
    fontSize: 13,
    color: COLORS.cream.soft,
    lineHeight: 19,
    marginBottom: 6,
  },
  doneButton: {
    backgroundColor: COLORS.gold.primary,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 8,
  },
  doneButtonPressed: {
    opacity: 0.8,
  },
  doneButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.navy.darkest,
    textAlign: 'center',
  },
});

export default PvpRulesSheet;
