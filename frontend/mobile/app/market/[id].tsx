import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Image } from 'react-native';
import { useLocalSearchParams, useRouter, useNavigation } from 'expo-router';
import { apiFetch, API_BASE_URL } from '@/constants/api';
import { type ApiResponse, type Market, type MarketOutcome } from '@/types/market';
import { IconSymbol } from '@/components/ui/icon-symbol';

export default function MarketDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const navigation = useNavigation();
  const [market, setMarket] = useState<Market | null>(null);
  const [outcomes, setOutcomes] = useState<MarketOutcome[] | null>(null);
  const [recentHistory, setRecentHistory] = useState<Record<string, { price: number; ts: string }[]>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Hide default header to avoid double appbars
    navigation.setOptions?.({ headerShown: false });
  }, [navigation]);

  useEffect(() => {
    if (!id) return;
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        // Health check helps early erroring for clearer UX
        await apiFetch('/health');
        const res = await apiFetch<ApiResponse<Market>>(`/api/markets/${id}`);
        if (!mounted) return;
        setMarket(res.data);
        // Outcomes (richer fields including descriptions)
        try {
          const outRes = await apiFetch<ApiResponse<MarketOutcome[]>>(`/api/markets/${id}/outcomes`);
          if (mounted) setOutcomes(outRes.data);
        } catch (e) {
          // fallback to market.outcomes if outcomes endpoint fails
          if (mounted) setOutcomes(res.data?.outcomes ?? []);
        }
        // Fetch small recent price history for each outcome (up to 5 entries)
        const oc = (res.data?.outcomes ?? []).slice(0, 3);
        const historyEntries: Record<string, { price: number; ts: string }[]> = {};
        for (const o of oc) {
          try {
            const h = await apiFetch<ApiResponse<{ id: string; marketId: string; outcomeId: string; source: string; price: number; volume: number; liquidity: number; timestamp: string; }[]>>(`/api/markets/${id}/price-history?outcomeId=${o.id}&limit=5`);
            historyEntries[o.id] = (h.data || []).map((row) => ({ price: row.price, ts: row.timestamp }));
          } catch {
            historyEntries[o.id] = [];
          }
        }
        if (mounted) setRecentHistory(historyEntries);
      } catch (e: any) {
        if (!mounted) return;
        setError(e?.message || 'Failed to load market');
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [id]);

  const volumeStr = useMemo(() => {
    if (!market) return '';
    return `$${Math.round(market.totalVolume).toLocaleString()} Vol.`;
  }, [market]);

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
            <Text style={styles.errorTitle}>We can’t reach the server</Text>
            <Text style={styles.errorText}>Please check your connection and try again.</Text>
            <Text style={styles.errorHint}>URL: {API_BASE_URL}</Text>
            <TouchableOpacity
              accessibilityRole="button"
              onPress={() => {
                // trigger refetch
                setError(null);
                setLoading(true);
                (async () => {
                  try {
                    await apiFetch('/health');
                    const res = await apiFetch<ApiResponse<Market>>(`/api/markets/${id}`);
                    setMarket(res.data);
                    try {
                      const outRes = await apiFetch<ApiResponse<MarketOutcome[]>>(`/api/markets/${id}/outcomes`);
                      setOutcomes(outRes.data);
                    } catch {
                      setOutcomes(res.data?.outcomes ?? []);
                    }
                  } catch (e: any) {
                    setError(e?.message || 'Failed to load market');
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

        {!!market && !loading && !error && (
          <View style={styles.outerCard}>
            {/* Title + Status/Dates */}
            <View style={styles.sectionCard}>
              <View style={styles.titleRow}>
                <Image
                  source={(market as any)?.imageUrl ? { uri: (market as any).imageUrl } : require('@/assets/images/market.png')}
                  style={styles.thumb}
                />
                <View style={styles.titleCol}>
                  <Text style={styles.title}>{market.title}</Text>
                </View>
              </View>
              <View style={styles.divider} />
              <View style={styles.metaPillRow}>
                <Text style={[styles.statusPill, market.status === 'ACTIVE' ? styles.statusActive : styles.statusInactive]}>
                  {market.status === 'ACTIVE' ? 'Active' : market.status}
                </Text>
                {!!market.endDate && (
                  <Text style={styles.metaPill}>Ends {new Date(market.endDate).toLocaleDateString()}</Text>
                )}
              </View>
              {!!market.description && (<Text style={styles.description}>{market.description}</Text>)}
              {!!(market.tags?.length || market.category) && (
                <View style={[styles.metaRow, { marginTop: 10 }]}>
                  {!!market.category && (<Text style={styles.metaChip}>{market.category}</Text>)}
                  {market.tags?.slice(0, 6).map((t) => (
                    <Text key={t} style={styles.metaChip}>{t}</Text>
                  ))}
                </View>
              )}
            </View>

            {/* Stats */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Overview</Text>
              <View style={styles.statsRowWrap}>
                <View style={styles.statBox}><Text style={styles.statLabel}>Volume</Text><Text style={styles.statValue}>{`$${Math.round(market.totalVolume).toLocaleString()}`}</Text></View>
                <View style={styles.statBox}><Text style={styles.statLabel}>Liquidity</Text><Text style={styles.statValue}>{`$${Math.round(market.totalLiquidity).toLocaleString()}`}</Text></View>
                <View style={styles.statBox}><Text style={styles.statLabel}>Participants</Text><Text style={styles.statValue}>{market.participantCount}</Text></View>
              </View>
            </View>

            {/* Outcomes */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Outcomes</Text>
              <View style={styles.divider} />
              {(outcomes ?? market.outcomes)?.map((o) => (
                <View key={o.id} style={styles.outcomeRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.outcomeLabel}>{o.title}</Text>
                    {!!o.description && (<Text style={styles.outcomeSub}>{o.description}</Text>)}
                  </View>
                  <View style={styles.outcomeRight}>
                    <Text style={styles.outcomePercent}>{`${Math.round((o.currentPrice || 0) * 100)}%`}</Text>
                    <TouchableOpacity accessibilityRole="button" style={[styles.cta, styles.ctaYes]} activeOpacity={0.85}>
                      <Text style={styles.ctaYesText}>Yes</Text>
                    </TouchableOpacity>
                    <TouchableOpacity accessibilityRole="button" style={[styles.cta, styles.ctaNo]} activeOpacity={0.85}>
                      <Text style={styles.ctaNoText}>No</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>

            {/* Recent Prices (hidden) */}

            {/* Source Markets */}
            {!!market.sourceMarkets?.length && (
              <View style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>Sources</Text>
                <View style={styles.divider} />
                {market.sourceMarkets.map((s) => (
                  <View key={s.id} style={styles.sourceRow}>
                    <Text style={styles.sourceLeft}>{s.source}</Text>
                    <Text style={styles.sourceRight} numberOfLines={1}>
                      {(s.tokenId || s.sourceMarketId || '').toString().slice(0, 12)}…
                    </Text>
                  </View>
                ))}
              </View>
            )}
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
  title: {
    color: '#e5e7eb',
    fontSize: 18,
    lineHeight: 26,
    fontWeight: '500',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  thumb: {
    width: 48,
    height: 48,
    borderRadius: 10,
    marginTop: 2,
  },
  titleCol: {
    flex: 1,
  },
  sectionTitle: {
    color: '#f3f4f6',
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '600',
  },
  description: {
    color: '#cbd5e1',
    fontSize: 14,
    lineHeight: 20,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginVertical: 14,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  metaChip: {
    color: '#e5e7eb',
    fontSize: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 0,
  },
  metaPillRow: {
    marginTop: 8,
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  statusPill: {
    color: '#e5e7eb',
    fontSize: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 0,
  },
  statusActive: {
    backgroundColor: 'rgba(34,197,94,0.22)',
  },
  statusInactive: {
    backgroundColor: 'rgba(148,163,184,0.18)',
  },
  metaPill: {
    color: '#d1d5db',
    fontSize: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 0,
  },
  statsRow: {
    marginTop: 8,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  statText: {
    color: '#cbd5e1',
    fontSize: 12,
  },
  statsRowWrap: {
    marginTop: 8,
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  statBox: {
    minWidth: 100,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#1C1C1C',
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
  outcomeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  outcomeLabel: {
    color: '#e5e7eb',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400',
    minWidth: 35,
  },
  outcomeSub: {
    color: '#9aa5b1',
    fontSize: 12,
    marginTop: 2,
  },
  outcomeRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  outcomePercent: {
    color: '#f3f4f6',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400',
    minWidth: 35,
    textAlign: 'right',
  },
  cta: {
    width: 48,
    height: 32,
    paddingHorizontal: 6,
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  ctaYes: {
    backgroundColor: 'rgba(34,197,94,0.18)',
  },
  ctaNo: {
    backgroundColor: 'rgba(239,68,68,0.18)',
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
  loadingWrap: {
    paddingHorizontal: 20,
    paddingVertical: 24,
    gap: 8,
    alignItems: 'center',
  },
  loadingText: {
    color: '#e5e7eb',
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
  centerWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 40,
    paddingBottom: 40,
    gap: 8,
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
  historyLabel: {
    color: '#cbd5e1',
    fontSize: 13,
    marginBottom: 6,
  },
  priceHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  priceNowWrap: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  priceNow: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  priceDelta: {
    fontSize: 12,
    fontWeight: '600',
  },
  sparkRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
    paddingVertical: 8,
  },
  sparkBar: {
    width: 8,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  historyTs: {
    color: '#9ca3af',
    fontSize: 12,
  },
  historyPx: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  historyEmpty: {
    color: '#9ca3af',
    fontSize: 12,
  },
  historyHint: {
    color: '#9ca3af',
    fontSize: 11,
  },
  sourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  sourceLeft: {
    color: '#e5e7eb',
    fontSize: 14,
    fontWeight: '500',
  },
  sourceRight: {
    color: '#9ca3af',
    fontSize: 12,
    maxWidth: '60%',
  },
});


