import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { IconSymbol } from '@/components/ui/icon-symbol';

export type MarketOutcome = {
  id: string;
  label: string;
  percent: string; // e.g. '9%'
};

export type MarketCardProps = {
  avatar: any;
  title: string;
  outcomes: MarketOutcome[];
  volume: string; // e.g. '$56m Vol.'
  onPress?: () => void;
  onPressYes?: (outcomeId: string) => void;
  onPressNo?: (outcomeId: string) => void;
};

const MarketCard: React.FC<MarketCardProps> = ({ avatar, title, outcomes, volume, onPress, onPressYes, onPressNo }) => {
  const Container: any = onPress ? TouchableOpacity : View;
  return (
    <Container
      style={styles.card}
      accessibilityRole={onPress ? 'button' : 'summary'}
      accessibilityLabel={onPress ? `Open market: ${title}` : undefined}
      onPress={onPress}
      activeOpacity={onPress ? 0.85 : undefined}
    >
      <View style={styles.headerRow}>
        <Image source={avatar} style={styles.avatar} />
        <Text style={styles.title}>{title}</Text>
      </View>

      <View style={styles.divider} />

      {outcomes.map((o) => (
        <View key={o.id} style={styles.outcomeRow}>
          <Text style={styles.outcomeLabel}>{o.label}</Text>
          <View style={styles.outcomeRight}>
            <Text style={styles.outcomePercent}>{o.percent}</Text>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={`Yes ${o.label}`}
              onPress={() => onPressYes && onPressYes(o.id)}
              style={[styles.cta, styles.ctaYes]}
              activeOpacity={0.85}
            >
              <Text style={styles.ctaYesText}>Yes</Text>
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={`No ${o.label}`}
              onPress={() => onPressNo && onPressNo(o.id)}
              style={[styles.cta, styles.ctaNo]}
              activeOpacity={0.85}
            >
              <Text style={styles.ctaNoText}>No</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}

      <View style={styles.divider} />

      <View style={styles.footerRow}>
        <Text style={styles.volume}>{volume}</Text>
        <View style={styles.iconRow}>
          <TouchableOpacity accessibilityRole="button" style={styles.iconPad}>
            <IconSymbol size={18} name="doc.on.doc" color="#e5e7eb" />
          </TouchableOpacity>
          <TouchableOpacity accessibilityRole="button" style={styles.iconPad}>
            <IconSymbol size={18} name="bookmark" color="#e5e7eb" />
          </TouchableOpacity>
        </View>
      </View>
    </Container>
  );
};

export default MarketCard;

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#101010',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 10,
  },
  title: {
    width: 262,
    color: '#BFBFBF',
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '500',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginVertical: 14,
  },
  outcomeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  outcomeLabel: {
    color: '#d1d5db',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400',
    minWidth: 35,
  },
  outcomeRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  outcomePercent: {
    color: '#e5e7eb',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400',
    minWidth: 35,
    textAlign: 'right',
  },
  cta: {
    width: 42,
    height: 28,
    paddingHorizontal: 4,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaYes: {
    borderColor: 'rgba(34,197,94,0.5)',
    backgroundColor: 'rgba(34,197,94,0.1)',
  },
  ctaNo: {
    borderColor: 'rgba(239,68,68,0.5)',
    backgroundColor: 'rgba(239,68,68,0.1)',
  },
  ctaYesText: {
    color: '#22c55e',
    fontWeight: '400',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  ctaNoText: {
    color: '#ef4444',
    fontWeight: '400',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  footerRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  volume: {
    color: '#cbd5e1',
    fontSize: 14,
  },
  iconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconPad: {
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
});


