import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Image } from 'react-native';
import { useLocalSearchParams, useRouter, useNavigation } from 'expo-router';
import { apiFetch, API_BASE_URL } from '@/constants/api';
import { type ApiResponse, type Trader } from '@/types/market';
import { IconSymbol } from '@/components/ui/icon-symbol';

type TraderStats = {
  trader: {
    id: string;
    totalTrades: number;
    totalVolume: number;
    totalPnl: number;
    winRate?: number;
    avgReturn?: number;
    currentRank?: number;
    bestRank?: number;
    rankChange?: number;
    lastActiveAt?: string;
    firstTradeAt?: string;
    lastTradeAt?: string;
  };
  additionalStats?: {
    totalTradeValue?: number;
    totalRealizedPnl?: number;
    totalTradeCount?: number;
    followerCount?: number;
    followingCount?: number;
  };
};

type Trade = {
  id: string;
  traderId: string;
  source: string;
  sourceTradeId: string;
  marketId?: string;
  sourceMarketId: string;
  side: 'BUY' | 'SELL';
  outcomeIndex?: number;
  quantity: number;
  price: number;
  totalValue: number;
  status: 'PENDING' | 'EXECUTED' | 'CANCELLED' | 'FAILED';
  executedAt: string;
  realizedPnl?: number;
  unrealizedPnl?: number;
  isCopyTrade: boolean;
  originalTradeId?: string;
  copiedByTraderId?: string;
};

export default function TraderProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const navigation = useNavigation();
  const [trader, setTrader] = useState<Trader | null>(null);
  const [stats, setStats] = useState<TraderStats | null>(null);
  const [recentTrades, setRecentTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    navigation.setOptions?.({ headerShown: false });
  }, [navigation]);

  useEffect(() => {
    if (!id) return;
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        await apiFetch('/health');
        const [traderRes, statsRes, tradesRes] = await Promise.all([
          apiFetch<ApiResponse<Trader>>(`/api/traders/${id}`),
          apiFetch<ApiResponse<TraderStats>>(`/api/traders/${id}/stats`).catch(() => null),
          apiFetch<ApiResponse<Trade[]>>(`/api/traders/${id}/trades?page=1&limit=10`).catch(() => null),
        ]);
        if (!mounted) return;
        setTrader(traderRes.data);
        if (statsRes?.data) setStats(statsRes.data);
        if (tradesRes?.data) setRecentTrades(tradesRes.data);
      } catch (e: any) {
        if (!mounted) return;
        setError(e?.message || 'Failed to load trader profile');
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [id]);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Go back"
            onPress={() => router.back()}
            style={styles.headerBtn}
            activeOpacity={0.85}
          >
            <IconSymbol size={20} name="chevron.left" color="#ffffff" />
          </TouchableOpacity>
          <Text style={styles.brand}></Text>
          <View style={{ width: 44 }} />
        </View>

        {loading && (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color="#ffffff" />
            <Text style={styles.loadingText}>Loading…</Text>
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
                    const [traderRes, statsRes, tradesRes] = await Promise.all([
                      apiFetch<ApiResponse<Trader>>(`/api/traders/${id}`),
                      apiFetch<ApiResponse<TraderStats>>(`/api/traders/${id}/stats`).catch(() => null),
                      apiFetch<ApiResponse<Trade[]>>(`/api/traders/${id}/trades?page=1&limit=10`).catch(() => null),
                    ]);
                    setTrader(traderRes.data);
                    if (statsRes?.data) setStats(statsRes.data);
                    if (tradesRes?.data) setRecentTrades(tradesRes.data);
                  } catch (e: any) {
                    setError(e?.message || 'Failed to load trader profile');
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

        {!!trader && !loading && !error && (
          <View style={styles.outerCard}>
            {/* Profile Header */}
            <View style={styles.sectionCard}>
              <View style={styles.profileHeader}>
                <Image
                  source={trader.profileImageUrl ? { uri: trader.profileImageUrl } : require('@/assets/images/market.png')}
                  style={styles.profileAvatar}
                />
                <View style={styles.profileInfo}>
                  <Text style={styles.profileName}>{trader.displayName || trader.username || 'Anonymous'}</Text>
                  <Text style={styles.profileSource}>{trader.source}</Text>
                  <View style={styles.badgeRow}>
                    {!!trader.currentRank && (
                      <View style={styles.rankBadge}>
                        <Text style={styles.rankBadgeText}>Rank #{trader.currentRank}</Text>
                        {!!trader.rankChange && trader.rankChange !== 0 && (
                          <Text style={[styles.rankChangeBadge, trader.rankChange > 0 ? styles.rankUp : styles.rankDown]}>
                            {trader.rankChange > 0 ? '↑' : '↓'} {Math.abs(trader.rankChange)}
                          </Text>
                        )}
                      </View>
                    )}
                    {!!trader.bestRank && trader.bestRank !== trader.currentRank && (
                      <View style={styles.bestRankBadge}>
                        <Text style={styles.bestRankText}>Best: #{trader.bestRank}</Text>
                      </View>
                    )}
                    {trader.allowCopyTrading && (
                      <View style={styles.copyBadge}>
                        <Text style={styles.copyBadgeText}>Copy Trading</Text>
                      </View>
                    )}
                    {trader.isPublic && (
                      <View style={styles.publicBadge}>
                        <Text style={styles.publicBadgeText}>Public</Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>
            </View>

            {/* Key Performance Metrics */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Performance</Text>
              <View style={styles.metricsRow}>
                <View style={styles.metricBox}>
                  <Text style={styles.metricLabel}>Total PnL</Text>
                  <Text style={[styles.metricValue, trader.totalPnl >= 0 ? styles.pnlPositive : styles.pnlNegative]}>
                    ${Math.round(trader.totalPnl).toLocaleString()}
                  </Text>
                </View>
                <View style={styles.metricBox}>
                  <Text style={styles.metricLabel}>Total Volume</Text>
                  <Text style={styles.metricValue}>${Math.round(trader.totalVolume / 1000000)}M</Text>
                </View>
              </View>
              {!!trader.winRate && (
                <View style={styles.winRateContainer}>
                  <View style={styles.winRateHeader}>
                    <Text style={styles.winRateLabel}>Win Rate</Text>
                    <Text style={styles.winRateValue}>{Math.round(trader.winRate * 100)}%</Text>
                  </View>
                  <View style={styles.winRateBar}>
                    <View style={[styles.winRateFill, { width: `${trader.winRate * 100}%` }]} />
                  </View>
                </View>
              )}
            </View>

            {/* Stats Overview */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Statistics</Text>
              <View style={styles.statsRowWrap}>
                <View style={styles.statBox}>
                  <Text style={styles.statLabel}>Total Trades</Text>
                  <Text style={styles.statValue}>{trader.totalTrades.toLocaleString()}</Text>
                </View>
                {!!trader.winRate && (
                  <View style={styles.statBox}>
                    <Text style={styles.statLabel}>Win Rate</Text>
                    <Text style={styles.statValue}>{Math.round(trader.winRate * 100)}%</Text>
                  </View>
                )}
                {!!trader.avgReturn && (
                  <View style={styles.statBox}>
                    <Text style={styles.statLabel}>Avg Return</Text>
                    <Text style={[styles.statValue, trader.avgReturn >= 0 ? styles.pnlPositive : styles.pnlNegative]}>
                      {Math.round(trader.avgReturn * 100)}%
                    </Text>
                  </View>
                )}
                {!!stats?.additionalStats?.totalRealizedPnl && (
                  <View style={styles.statBox}>
                    <Text style={styles.statLabel}>Realized PnL</Text>
                    <Text style={[styles.statValue, stats.additionalStats.totalRealizedPnl >= 0 ? styles.pnlPositive : styles.pnlNegative]}>
                      ${Math.round(stats.additionalStats.totalRealizedPnl).toLocaleString()}
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {/* Additional Stats */}
            {!!stats?.additionalStats && (
              <View style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>Additional Info</Text>
                <View style={styles.divider} />
                {!!stats.additionalStats.totalTradeValue && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Total Trade Value</Text>
                    <Text style={styles.detailValue}>${stats.additionalStats.totalTradeValue.toLocaleString()}</Text>
                  </View>
                )}
                {!!stats.additionalStats.followerCount !== undefined && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Followers</Text>
                    <Text style={styles.detailValue}>{stats.additionalStats.followerCount || 0}</Text>
                  </View>
                )}
                {!!stats.additionalStats.followingCount !== undefined && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Following</Text>
                    <Text style={styles.detailValue}>{stats.additionalStats.followingCount || 0}</Text>
                  </View>
                )}
              </View>
            )}

            {/* Recent Trades */}
            {recentTrades.length > 0 && (
              <View style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>Recent Trades</Text>
                <View style={styles.divider} />
                {recentTrades.map((trade) => (
                  <TouchableOpacity
                    key={trade.id}
                    accessibilityRole="button"
                    onPress={() => trade.marketId && router.push(`/market/${trade.marketId}`)}
                    style={styles.tradeRow}
                    activeOpacity={0.85}
                  >
                    <View style={styles.tradeLeft}>
                      <View style={styles.tradeHeader}>
                        <Text style={styles.tradeSide}>{trade.side}</Text>
                        {trade.isCopyTrade && (
                          <View style={styles.copyTag}>
                            <Text style={styles.copyTagText}>Copy</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.tradeDate}>{new Date(trade.executedAt).toLocaleDateString()}</Text>
                    </View>
                    <View style={styles.tradeRight}>
                      <Text style={styles.tradeValue}>${Math.round(trade.totalValue).toLocaleString()}</Text>
                      {!!trade.realizedPnl && (
                        <Text style={[styles.tradePnl, trade.realizedPnl >= 0 ? styles.pnlPositive : styles.pnlNegative]}>
                          {trade.realizedPnl >= 0 ? '+' : ''}${Math.round(trade.realizedPnl).toLocaleString()}
                        </Text>
                      )}
                      <Text style={styles.tradeStatus}>{trade.status}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Activity Dates */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Activity Timeline</Text>
              <View style={styles.divider} />
              {!!trader.firstTradeAt && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>First Trade</Text>
                  <Text style={styles.detailValue}>{new Date(trader.firstTradeAt).toLocaleDateString()}</Text>
                </View>
              )}
              {!!trader.lastTradeAt && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Last Trade</Text>
                  <Text style={styles.detailValue}>{new Date(trader.lastTradeAt).toLocaleDateString()}</Text>
                </View>
              )}
              {!!trader.lastActiveAt && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Last Active</Text>
                  <Text style={styles.detailValue}>{new Date(trader.lastActiveAt).toLocaleDateString()}</Text>
                </View>
              )}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b0b0b',
  },
  content: {
    paddingHorizontal: 0,
    paddingTop: 76,
    paddingBottom: 24,
    gap: 16,
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
    fontSize: 28,
    lineHeight: 40,
    color: '#ffffff',
    fontWeight: '400',
    letterSpacing: 0,
    textAlign: 'center',
  },
  headerBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#161616',
    shadowColor: '#000000',
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  outerCard: {
    backgroundColor: '#101214',
    borderRadius: 18,
    padding: 12,
    marginHorizontal: 20,
    shadowColor: '#000000',
    shadowOpacity: 0.45,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  sectionCard: {
    backgroundColor: '#14161a',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000000',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
  },
  profileAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  profileInfo: {
    flex: 1,
    gap: 8,
  },
  profileName: {
    color: '#e5e7eb',
    fontSize: 22,
    fontWeight: '600',
  },
  profileSource: {
    color: '#9aa5b1',
    fontSize: 14,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  rankBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(34,197,94,0.18)',
  },
  rankBadgeText: {
    color: '#e5e7eb',
    fontSize: 12,
    fontWeight: '500',
  },
  rankChangeBadge: {
    fontSize: 12,
    fontWeight: '600',
  },
  rankUp: {
    color: '#22c55e',
  },
  rankDown: {
    color: '#ef4444',
  },
  bestRankBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  bestRankText: {
    color: '#cbd5e1',
    fontSize: 12,
  },
  copyBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(59,130,246,0.18)',
  },
  copyBadgeText: {
    color: '#60a5fa',
    fontSize: 12,
    fontWeight: '500',
  },
  publicBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(148,163,184,0.18)',
  },
  publicBadgeText: {
    color: '#cbd5e1',
    fontSize: 12,
  },
  sectionTitle: {
    color: '#f3f4f6',
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginVertical: 14,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  metricBox: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#171a1f',
    shadowColor: '#000000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  metricLabel: {
    color: '#9aa5b1',
    fontSize: 11,
    marginBottom: 6,
  },
  metricValue: {
    color: '#f9fafb',
    fontSize: 18,
    fontWeight: '600',
  },
  winRateContainer: {
    marginTop: 16,
  },
  winRateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  winRateLabel: {
    color: '#9aa5b1',
    fontSize: 12,
  },
  winRateValue: {
    color: '#e5e7eb',
    fontSize: 14,
    fontWeight: '600',
  },
  winRateBar: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#171a1f',
    overflow: 'hidden',
  },
  winRateFill: {
    height: '100%',
    backgroundColor: '#22c55e',
    borderRadius: 4,
  },
  statsRowWrap: {
    marginTop: 12,
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  statBox: {
    minWidth: 100,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#171a1f',
    shadowColor: '#000000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  statLabel: {
    color: '#9aa5b1',
    fontSize: 11,
    marginBottom: 2,
  },
  statValue: {
    color: '#f9fafb',
    fontSize: 14,
    fontWeight: '600',
  },
  pnlPositive: {
    color: '#22c55e',
  },
  pnlNegative: {
    color: '#ef4444',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  detailLabel: {
    color: '#9aa5b1',
    fontSize: 14,
  },
  detailValue: {
    color: '#e5e7eb',
    fontSize: 14,
    fontWeight: '500',
  },
  tradeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  tradeLeft: {
    flex: 1,
    gap: 6,
  },
  tradeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tradeSide: {
    color: '#e5e7eb',
    fontSize: 14,
    fontWeight: '600',
  },
  copyTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: 'rgba(59,130,246,0.18)',
  },
  copyTagText: {
    color: '#60a5fa',
    fontSize: 10,
    fontWeight: '500',
  },
  tradeDate: {
    color: '#9aa5b1',
    fontSize: 12,
  },
  tradeRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  tradeValue: {
    color: '#f9fafb',
    fontSize: 14,
    fontWeight: '600',
  },
  tradePnl: {
    fontSize: 12,
    fontWeight: '500',
  },
  tradeStatus: {
    color: '#9aa5b1',
    fontSize: 11,
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
});
