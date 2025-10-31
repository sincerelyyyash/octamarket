import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, Text, TouchableOpacity, ActivityIndicator, Image } from 'react-native';
import { apiFetch, API_BASE_URL } from '@/constants/api';
import { type ApiResponse, type Trader } from '@/types/market';
import { useRouter } from 'expo-router';
import { IconSymbol } from '@/components/ui/icon-symbol';

export default function LeaderboardScreen() {
  const router = useRouter();
  const [traders, setTraders] = useState<Trader[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        await apiFetch('/health');
        const res = await apiFetch<ApiResponse<Trader[]>>('/api/leaderboard?page=1&limit=50');
        if (!mounted) return;
        setTraders(res.data || []);
      } catch (e: any) {
        if (!mounted) return;
        setError(e?.message || 'Failed to load leaderboard');
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <Text style={styles.brand}>Leaderboard</Text>
          <View style={styles.headerActions}>
            <View style={{ width: 44 }} />
            <View style={{ width: 44 }} />
          </View>
        </View>

        {loading && (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color="#ffffff" />
            <Text style={styles.loadingText}>Loading leaderboard…</Text>
          </View>
        )}
        {!!error && !loading && (
          <View style={[styles.centerWrap, styles.errorWrap]}>
            <IconSymbol size={22} name="wifi.exclamationmark" color="#ef4444" />
            <Text style={styles.errorTitle}>We can't reach the server</Text>
            <Text style={styles.errorText}>Please check your connection and try again.</Text>
            <Text style={styles.errorHint}>URL: {API_BASE_URL}</Text>
            <TouchableOpacity
              accessibilityRole="button"
              onPress={() => {
                setError(null);
                setLoading(true);
                (async () => {
                  try {
                    await apiFetch('/health');
                    const res = await apiFetch<ApiResponse<Trader[]>>('/api/leaderboard?page=1&limit=50');
                    setTraders(res.data || []);
                  } catch (e: any) {
                    setError(e?.message || 'Failed to load leaderboard');
                  } finally {
                    setLoading(false);
                  }
                })();
              }}
              style={styles.retryBtn}
              activeOpacity={0.85}
            >
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}
        {!loading && !error && traders.length === 0 && (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyText}>No traders found</Text>
          </View>
        )}
        {!loading && !error && traders.map((trader, index) => (
          <TouchableOpacity
            key={trader.id}
            accessibilityRole="button"
            onPress={() => router.push(`/trader/${trader.id}`)}
            style={styles.traderCard}
            activeOpacity={0.85}
          >
            <View style={styles.rankBadge}>
              <Text style={styles.rankText}>{index + 1}</Text>
            </View>
            <Image
              source={trader.profileImageUrl ? { uri: trader.profileImageUrl } : require('@/assets/images/market.png')}
              style={styles.avatar}
            />
            <View style={styles.traderInfo}>
              <Text style={styles.traderName}>{trader.displayName || trader.username || 'Anonymous'}</Text>
              <Text style={styles.traderSource}>{trader.source}</Text>
            </View>
            <View style={styles.statsCol}>
              <Text style={styles.pnlText}>${Math.round(trader.totalPnl).toLocaleString()}</Text>
              <Text style={styles.volumeText}>{Math.round(trader.totalVolume / 1000000)}M Vol</Text>
              {!!trader.winRate && (
                <Text style={styles.winRateText}>{Math.round(trader.winRate * 100)}% Win</Text>
              )}
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  content: {
    paddingHorizontal: 0,
    paddingTop: 76,
    paddingBottom: 24,
    gap: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 12,
    paddingRight: 20,
  },
  brand: {
    width: 185,
    height: 40,
    marginLeft: 12,
    fontSize: 36,
    lineHeight: 40,
    color: '#ffffff',
    fontWeight: '400',
    letterSpacing: 0,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  loadingWrap: {
    paddingHorizontal: 20,
    paddingVertical: 24,
    gap: 8,
    alignItems: 'center',
  },
  loadingText: {
    color: '#e5e7eb',
  },
  centerWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 40,
    paddingBottom: 40,
    gap: 8,
  },
  errorWrap: {
    paddingHorizontal: 20,
    paddingVertical: 24,
    backgroundColor: 'rgba(239,68,68,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.25)',
    borderRadius: 12,
    marginHorizontal: 20,
  },
  errorTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  errorText: {
    color: '#ef4444',
  },
  errorHint: {
    color: '#9ca3af',
    fontSize: 12,
  },
  retryBtn: {
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  retryText: {
    color: '#ffffff',
    fontWeight: '600',
  },
  emptyWrap: {
    paddingHorizontal: 20,
    paddingVertical: 24,
    alignItems: 'center',
  },
  emptyText: {
    color: '#a3a3a3',
  },
  traderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#14161a',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 12,
    shadowColor: '#000000',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
    gap: 12,
  },
  rankBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#171a1f',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  rankText: {
    color: '#f3f4f6',
    fontSize: 14,
    fontWeight: '600',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  traderInfo: {
    flex: 1,
    gap: 4,
  },
  traderName: {
    color: '#e5e7eb',
    fontSize: 16,
    fontWeight: '600',
  },
  traderSource: {
    color: '#9aa5b1',
    fontSize: 12,
  },
  statsCol: {
    alignItems: 'flex-end',
    gap: 4,
  },
  pnlText: {
    color: '#f9fafb',
    fontSize: 16,
    fontWeight: '600',
  },
  volumeText: {
    color: '#9aa5b1',
    fontSize: 12,
  },
  winRateText: {
    color: '#9aa5b1',
    fontSize: 12,
  },
});
