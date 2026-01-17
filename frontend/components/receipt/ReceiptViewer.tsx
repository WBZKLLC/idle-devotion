// /app/frontend/components/receipt/ReceiptViewer.tsx
// Phase 3.38: Unified Receipt Viewer Component
//
// Shared component used by: Mail, Bond, Events, Idle, Shop, Gacha
// Displays canonical receipt data in a consistent format.
// No balance recomputation - uses receipt.items and receipt.balances only.

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RewardReceipt, RewardItem, formatReceiptItems } from '../../lib/types/receipt';
import { haptic } from '../../lib/ui/interaction';

const COLORS = {
  navy: { darkest: '#0a1628', dark: '#0d1b2a', primary: '#1b263b', medium: '#283845' },
  gold: { dark: '#b8860b', primary: '#c9a227', light: '#e6c666' },
  cream: { pure: '#ffffff', soft: '#f8f6f0' },
  green: { primary: '#2ecc71' },
};

// Reward type icons
const REWARD_ICONS: Record<string, string> = {
  gold: '🪙',
  coins: '💰',
  gems: '💎',
  divine_gems: '✨💎',
  crystals: '💎',
  stamina: '⚡',
  divine_essence: '✨',
  soul_dust: '🌟',
  skill_essence: '📚',
  enhancement_stones: '💎',
  hero_shards: '⭐',
  hero_shard: '⭐',
  hero_unlock: '🧙',
  rune_essence: '🔮',
};

interface ReceiptViewerProps {
  visible: boolean;
  onClose: () => void;
  receipt: RewardReceipt | null;
  title?: string;
  showBalances?: boolean;
}

export function ReceiptViewer({
  visible,
  onClose,
  receipt,
  title = 'Rewards Received',
  showBalances = false,
}: ReceiptViewerProps) {
  const handleClose = () => {
    haptic('selection');
    onClose();
  };
  
  if (!receipt) return null;
  
  const hasItems = receipt.items.length > 0;
  const alreadyClaimed = receipt.alreadyClaimed === true;
  
  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <Pressable onPress={handleClose} hitSlop={8}>
              <Ionicons name="close" size={24} color={COLORS.cream.soft} />
            </Pressable>
          </View>
          
          {/* Already Claimed Notice */}
          {alreadyClaimed && (
            <View style={styles.claimedNotice}>
              <Ionicons name="checkmark-circle" size={16} color={COLORS.green.primary} />
              <Text style={styles.claimedText}>Already claimed</Text>
            </View>
          )}
          
          {/* Source Badge */}
          <View style={styles.sourceBadge}>
            <Text style={styles.sourceText}>
              {formatSourceName(receipt.source)}
            </Text>
          </View>
          
          {/* Items List */}
          <ScrollView style={styles.itemsScroll} showsVerticalScrollIndicator={false}>
            {hasItems ? (
              receipt.items.map((item, index) => (
                <RewardItemRow key={index} item={item} />
              ))
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>
                  {alreadyClaimed ? 'Rewards were claimed previously' : 'No rewards'}
                </Text>
              </View>
            )}
            
            {/* Balances Section */}
            {showBalances && receipt.balances && (
              <View style={styles.balancesSection}>
                <Text style={styles.balancesTitle}>Updated Balances</Text>
                <View style={styles.balancesGrid}>
                  {Object.entries(receipt.balances)
                    .filter(([_, value]) => value > 0)
                    .slice(0, 6) // Show top 6
                    .map(([key, value]) => (
                      <View key={key} style={styles.balanceItem}>
                        <Text style={styles.balanceIcon}>
                          {REWARD_ICONS[key] || '💰'}
                        </Text>
                        <Text style={styles.balanceValue}>
                          {typeof value === 'number' ? value.toLocaleString() : value}
                        </Text>
                      </View>
                    ))
                  }
                </View>
              </View>
            )}
          </ScrollView>
          
          {/* Message */}
          {receipt.message && (
            <Text style={styles.message}>{receipt.message}</Text>
          )}
          
          {/* Close Button */}
          <Pressable
            style={({ pressed }) => [
              styles.closeButton,
              pressed && styles.closeButtonPressed,
            ]}
            onPress={handleClose}
          >
            <Text style={styles.closeButtonText}>Done</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

// Individual reward item row
function RewardItemRow({ item }: { item: RewardItem }) {
  const icon = REWARD_ICONS[item.type] || '💰';
  const name = formatRewardTypeName(item.type);
  
  return (
    <View style={styles.itemRow}>
      <View style={styles.itemLeft}>
        <Text style={styles.itemIcon}>{icon}</Text>
        <Text style={styles.itemName}>{name}</Text>
      </View>
      <Text style={styles.itemAmount}>+{item.amount.toLocaleString()}</Text>
    </View>
  );
}

// Helpers
function formatSourceName(source: string): string {
  const sourceNames: Record<string, string> = {
    bond_tribute: 'Bond Tribute',
    mail_reward_claim: 'Mail Reward',
    mail_gift_claim: 'Gift',
    mail_receipt_claim: 'Receipt Queue',
    daily_login_claim: 'Daily Login',
    daily_claim: 'Daily Login',
    idle_claim: 'Idle Rewards',
    admin_grant: 'Admin Grant',
    event_claim: 'Event Reward',
    store_redeem: 'Store Purchase',
    summon_single: 'Single Summon',
    summon_multi: 'Multi Summon',
    pity_reward: 'Pity Reward',
  };
  return sourceNames[source] || source.replace(/_/g, ' ');
}

function formatRewardTypeName(type: string): string {
  const typeNames: Record<string, string> = {
    gold: 'Gold',
    coins: 'Coins',
    gems: 'Gems',
    divine_gems: 'Divine Gems',
    crystals: 'Crystals',
    stamina: 'Stamina',
    divine_essence: 'Divine Essence',
    soul_dust: 'Soul Dust',
    skill_essence: 'Skill Essence',
    enhancement_stones: 'Enhancement Stones',
    hero_shards: 'Hero Shards',
    hero_shard: 'Hero Shards',
    hero_unlock: 'Hero Unlock',
    rune_essence: 'Rune Essence',
  };
  return typeNames[type] || type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  container: {
    backgroundColor: COLORS.navy.dark,
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 340,
    maxHeight: '80%',
    borderWidth: 1,
    borderColor: COLORS.gold.primary + '30',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.cream.pure,
  },
  claimedNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.green.primary + '20',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginBottom: 12,
    gap: 6,
  },
  claimedText: {
    fontSize: 12,
    color: COLORS.green.primary,
    fontWeight: '500',
  },
  sourceBadge: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.navy.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 16,
  },
  sourceText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '500',
  },
  itemsScroll: {
    maxHeight: 200,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  itemIcon: {
    fontSize: 20,
  },
  itemName: {
    fontSize: 14,
    color: COLORS.cream.soft,
  },
  itemAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.gold.light,
  },
  emptyState: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
  },
  balancesSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  balancesTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 12,
  },
  balancesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  balanceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.navy.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  balanceIcon: {
    fontSize: 12,
  },
  balanceValue: {
    fontSize: 11,
    color: COLORS.cream.soft,
    fontWeight: '500',
  },
  message: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  closeButton: {
    backgroundColor: COLORS.gold.primary,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 16,
  },
  closeButtonPressed: {
    opacity: 0.9,
  },
  closeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.navy.darkest,
  },
});

export default ReceiptViewer;
