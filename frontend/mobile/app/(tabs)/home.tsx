import React, { useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, ScrollView, Text, TextInput, TouchableOpacity, LayoutChangeEvent, ActivityIndicator } from 'react-native';
import { IconSymbol } from '@/components/ui/icon-symbol';
import MarketCard, { type MarketOutcome as CardOutcome } from '@/components/market-card';
import { apiFetch, API_BASE_URL } from '@/constants/api';
import { type ApiResponse, type Market } from '@/types/market';
import { useRouter } from 'expo-router';

export default function HomeScreen() {
  const router = useRouter();
  const tabs = useMemo(() => ['Trending', 'Breaking', 'News', 'Politics', 'Sports'], []);
  const [activeIdx, setActiveIdx] = useState(0);
  const [tabsWidth, setTabsWidth] = useState(0);
  const [tabTextWidths, setTabTextWidths] = useState<number[]>(Array(tabs.length).fill(0));
  const chips = useMemo(() => ['All', 'Trump', 'Ukraine', 'FIFA', 'Tech', 'Colosseum'], []);
  const [activeChipIdx, setActiveChipIdx] = useState(0);
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const handleTabsLayout = (e: LayoutChangeEvent) => {
    setTabsWidth(e.nativeEvent.layout.width);
  };

  const horizontalPadding = 20; // must match tabsRow paddingHorizontal
  const contentWidth = Math.max(0, tabsWidth - horizontalPadding * 2);
  const segmentWidth = contentWidth > 0 ? contentWidth / tabs.length : 0;
  const activeTextWidth = tabTextWidths[activeIdx] ?? 0;
  const indicatorLeft = horizontalPadding + segmentWidth * activeIdx + Math.max(0, (segmentWidth - activeTextWidth) / 2);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        // Quick reachability check
        await apiFetch('/health');
        const res = await apiFetch<ApiResponse<Market[]>>('/api/markets/trending?page=1&limit=20');
        if (!mounted) return;
        setMarkets(res.data || []);
      } catch (e: any) {
        if (!mounted) return;
        setError(e?.message || 'Failed to load markets');
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
          <Text style={styles.brand}>Octamarket</Text>
          <View style={styles.headerActions}>
            <TouchableOpacity accessibilityRole="button" style={styles.headerBtn} activeOpacity={0.85}>
              <IconSymbol size={20} name="bell" color="#ffffff" />
            </TouchableOpacity>
            <TouchableOpacity accessibilityRole="button" style={styles.headerBtn} activeOpacity={0.85}>
              <IconSymbol size={20} name="tray.full" color="#ffffff" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.tabsWrap} onLayout={handleTabsLayout}>
          <View style={styles.tabsRow}>
            {tabs.map((t, i) => (
              <TouchableOpacity
                key={t}
                accessibilityRole="button"
                onPress={() => setActiveIdx(i)}
                style={styles.tabItem}
                activeOpacity={0.8}
              >
                <Text
                  style={[styles.topTab, i === activeIdx && styles.topTabActive]}
                  onLayout={(e) => {
                    const w = e.nativeEvent.layout.width;
                    setTabTextWidths((prev) => {
                      if (prev[i] === w) return prev;
                      const next = [...prev];
                      next[i] = w;
                      return next;
                    });
                  }}
                >
                  {t}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {/* Divider line */}
          <View pointerEvents="none" style={styles.tabsDivider} />
          {/* Active underline */}
          {tabsWidth > 0 && activeTextWidth > 0 && (
            <View pointerEvents="none" style={[styles.tabsIndicator, { left: indicatorLeft, width: activeTextWidth }]} />
          )}
        </View>

        <View style={styles.searchRow}>
          <View style={styles.searchBox}>
            <View style={styles.searchInner}>
              <IconSymbol size={20} name="magnifyingglass" color="#a3a3a3" />
              <TextInput
                placeholder="search"
                placeholderTextColor="#a3a3a3"
                style={styles.searchInput}
                accessibilityLabel="Search"
                returnKeyType="search"
              />
            </View>
          </View>
          <TouchableOpacity accessibilityRole="button" style={styles.filterButton}>
            <IconSymbol size={20} name="line.3.horizontal.decrease" color="#cbd5e1" />
          </TouchableOpacity>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsRow}
        >
          {chips.map((c, i) => (
            <TouchableOpacity
              key={c}
              accessibilityRole="button"
              onPress={() => setActiveChipIdx(i)}
              style={[styles.chip, i === activeChipIdx && styles.chipActive]}
              activeOpacity={0.85}
            >
              <Text style={i === activeChipIdx ? styles.chipTextActive : styles.chipText}>{c}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.listGap} />

        {loading && (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color="#ffffff" />
            <Text style={styles.loadingText}>Loading markets…</Text>
          </View>
        )}
        {!!error && !loading && (
          <View style={[styles.centerWrap, styles.errorWrap]}>
            <IconSymbol size={22} name="wifi.exclamationmark" color="#ef4444" />
            <Text style={styles.errorTitle}>We can’t reach the server</Text>
            <Text style={styles.errorText}>Please check your connection and try again.</Text>
            <Text style={styles.errorHint}>URL: {API_BASE_URL}</Text>
            <TouchableOpacity accessibilityRole="button" onPress={() => {
              // retry
              setError(null);
              setLoading(true);
              // trigger effect by re-running inline fetch
              (async () => {
                try {
                  await apiFetch('/health');
                  const res = await apiFetch<ApiResponse<Market[]>>('/api/markets/trending?page=1&limit=20');
                  setMarkets(res.data || []);
                } catch (e: any) {
                  setError(e?.message || 'Failed to load markets');
                } finally {
                  setLoading(false);
                }
              })();
            }} style={styles.retryBtn} activeOpacity={0.85}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}
        {!loading && !error && markets.length === 0 && (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyText}>No markets found</Text>
          </View>
        )}
        {!loading && !error && markets.map((m) => {
          const avatar = require('@/assets/images/market.png');
          const outcomes: CardOutcome[] = (m.outcomes || []).slice(0, 2).map((o) => ({
            id: o.id,
            label: o.title,
            percent: `${Math.round((o.currentPrice || 0) * 100)}%`,
          }));
          const volume = `$${Math.round(m.totalVolume).toLocaleString()} Vol.`;
          return (
            <View key={m.id} style={styles.cardWrap}>
              <MarketCard
                avatar={avatar}
                title={m.title}
                outcomes={outcomes}
                volume={volume}
                onPress={() => router.push(`/market/${m.id}`)}
              />
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

// Removed all content to show only the global background image

type Market = {
  id: string;
  avatar: any;
  title: string;
  outcomes: MarketOutcome[];
  volume: string;
};

// API replaces previous mock data

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  content: {
    paddingHorizontal: 0,
    paddingTop: 76,
    paddingBottom: 24,
    gap: 16,
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 12,
    paddingRight: 20,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  tabsRow: {
    marginTop: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 24,
    justifyContent: 'space-between',
  },
  tabsWrap: {
    position: 'relative',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
  },
  topTab: {
    color: '#cbd5e1',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400',
    minWidth: 55,
  },
  topTabActive: {
    color: '#ffffff',
  },
  tabsDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.25)',
    marginTop: 10,
    width: '100%',
  },
  tabsIndicator: {
    position: 'absolute',
    height: 2,
    backgroundColor: '#ffffff',
    bottom: -1, // slightly overlaps divider like in design
  },
  searchRow: {
    marginTop: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  searchBox: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 14,
    paddingVertical: 12, // 12 + 12 + 20(lineHeight) = 44 total height
    minHeight: 44,
  },
  searchInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchInput: {
    color: '#e5e7eb',
    fontSize: 14,
    lineHeight: 20,
    minWidth: 55,
  },
  filterButton: {
    width: 64,
    height: 44,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  filterIcon: {
    color: '#cbd5e1',
    fontSize: 18,
  },
  chipsRow: {
    marginTop: 8,
    paddingHorizontal: 20,
    flexDirection: 'row',
    gap: 12,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  chipActive: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderColor: 'rgba(255,255,255,0.35)',
  },
  chipText: {
    color: '#a3a3a3',
    fontSize: 16,
  },
  chipTextActive: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  listGap: {
    height: 8,
  },
  cardWrap: {
    marginBottom: 16,
    paddingHorizontal: 20,
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
  emptyWrap: {
    paddingHorizontal: 20,
    paddingVertical: 24,
    alignItems: 'center',
  },
  emptyText: {
    color: '#a3a3a3',
  },
});


