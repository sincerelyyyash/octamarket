import React, { useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, ScrollView, Text, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { IconSymbol } from '@/components/ui/icon-symbol';
import MarketCard, { type MarketOutcome as CardOutcome } from '@/components/market-card';
import { apiFetch, API_BASE_URL } from '@/constants/api';
import { type ApiResponse, type Market } from '@/types/market';
import { useRouter } from 'expo-router';

const STATUS_OPTIONS = ['All', 'Active', 'Resolved', 'Cancelled'];
const SORT_OPTIONS = [
  { label: 'Volume', value: 'volume' },
  { label: 'Liquidity', value: 'liquidity' },
  { label: 'End Date', value: 'endDate' },
  { label: 'Newest', value: 'createdAt' },
];

export default function MarketsScreen() {
  const router = useRouter();
  const [markets, setMarkets] = useState<Market[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeStatusIdx, setActiveStatusIdx] = useState(0);
  const [activeCategoryIdx, setActiveCategoryIdx] = useState(0);
  const [sortBy, setSortBy] = useState<string>('volume');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [searchQuery, setSearchQuery] = useState<string>('');

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        await apiFetch('/health');
        const categoriesRes = await apiFetch<ApiResponse<string[]>>('/api/markets/categories').catch(() => ({ success: true, data: [] }));
        if (!mounted) return;
        setCategories(['All', ...(categoriesRes.data || [])]);
      } catch (e: any) {
        if (!mounted) return;
        setError(e?.message || 'Failed to load categories');
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (categories.length === 0) return;
    let mounted = true;
    const loadMarkets = async () => {
      try {
        setLoading(true);
        setError(null);
        const status = activeStatusIdx === 0 ? '' : STATUS_OPTIONS[activeStatusIdx].toUpperCase();
        const category = activeCategoryIdx === 0 ? '' : categories[activeCategoryIdx];
        const params = new URLSearchParams();
        if (status) params.set('status', status);
        if (category) params.set('category', category);
        if (searchQuery) params.set('search', searchQuery);
        params.set('sortBy', sortBy);
        params.set('sortOrder', sortOrder);
        params.set('page', '1');
        params.set('limit', '50');

        await apiFetch('/health');
        const res = await apiFetch<ApiResponse<Market[]>>(`/api/markets?${params.toString()}`);
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
    loadMarkets();
    return () => {
      mounted = false;
    };
  }, [activeStatusIdx, activeCategoryIdx, sortBy, sortOrder, searchQuery, categories]);

  const handleSortChange = () => {
    setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <Text style={styles.brand}>Markets</Text>
          <View style={styles.headerActions}>
            <TouchableOpacity
              accessibilityRole="button"
              onPress={handleSortChange}
              style={styles.headerBtn}
              activeOpacity={0.85}
            >
              <IconSymbol size={20} name={sortOrder === 'desc' ? 'arrow.down' : 'arrow.up'} color="#ffffff" />
            </TouchableOpacity>
            <TouchableOpacity accessibilityRole="button" style={styles.headerBtn} activeOpacity={0.85}>
              <IconSymbol size={20} name="line.3.horizontal.decrease" color="#ffffff" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Search */}
        <View style={styles.searchRow}>
          <View style={styles.searchBox}>
            <View style={styles.searchInner}>
              <IconSymbol size={20} name="magnifyingglass" color="#a3a3a3" />
              <TextInput
                placeholder="search markets..."
                placeholderTextColor="#a3a3a3"
                style={styles.searchInput}
                value={searchQuery}
                onChangeText={setSearchQuery}
                accessibilityLabel="Search markets"
                returnKeyType="search"
              />
            </View>
          </View>
        </View>

        {/* Status Tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.statusRow}
        >
          {STATUS_OPTIONS.map((status, i) => (
            <TouchableOpacity
              key={status}
              accessibilityRole="button"
              onPress={() => setActiveStatusIdx(i)}
              style={[styles.statusChip, i === activeStatusIdx && styles.statusChipActive]}
              activeOpacity={0.85}
            >
              <Text style={i === activeStatusIdx ? styles.statusChipTextActive : styles.statusChipText}>
                {status}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Category Chips */}
        {categories.length > 1 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsRow}
          >
            {categories.map((cat, i) => (
              <TouchableOpacity
                key={cat}
                accessibilityRole="button"
                onPress={() => setActiveCategoryIdx(i)}
                style={[styles.chip, i === activeCategoryIdx && styles.chipActive]}
                activeOpacity={0.85}
              >
                <Text style={i === activeCategoryIdx ? styles.chipTextActive : styles.chipText}>{cat}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* Sort Indicator */}
        <View style={styles.sortRow}>
          <Text style={styles.sortLabel}>Sort by: {SORT_OPTIONS.find((s) => s.value === sortBy)?.label || sortBy}</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.sortChipsRow}
          >
            {SORT_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                accessibilityRole="button"
                onPress={() => setSortBy(opt.value)}
                style={[styles.sortChip, sortBy === opt.value && styles.sortChipActive]}
                activeOpacity={0.85}
              >
                <Text style={sortBy === opt.value ? styles.sortChipTextActive : styles.sortChipText}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={styles.listGap} />

        {/* Markets List */}
        {loading && (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color="#ffffff" />
            <Text style={styles.loadingText}>Loading markets…</Text>
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
                    const params = new URLSearchParams();
                    if (activeStatusIdx > 0) params.set('status', STATUS_OPTIONS[activeStatusIdx].toUpperCase());
                    if (activeCategoryIdx > 0) params.set('category', categories[activeCategoryIdx]);
                    if (searchQuery) params.set('search', searchQuery);
                    params.set('sortBy', sortBy);
                    params.set('sortOrder', sortOrder);
                    params.set('page', '1');
                    params.set('limit', '50');
                    const res = await apiFetch<ApiResponse<Market[]>>(`/api/markets?${params.toString()}`);
                    setMarkets(res.data || []);
                  } catch (e: any) {
                    setError(e?.message || 'Failed to load markets');
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
    paddingVertical: 12,
    minHeight: 44,
  },
  searchInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchInput: {
    flex: 1,
    color: '#e5e7eb',
    fontSize: 14,
    lineHeight: 20,
    minWidth: 55,
  },
  statusRow: {
    marginTop: 8,
    paddingHorizontal: 20,
    flexDirection: 'row',
    gap: 12,
  },
  statusChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  statusChipActive: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderColor: 'rgba(255,255,255,0.35)',
  },
  statusChipText: {
    color: '#a3a3a3',
    fontSize: 14,
  },
  statusChipTextActive: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
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
  sortRow: {
    marginTop: 8,
    paddingHorizontal: 20,
    gap: 8,
  },
  sortLabel: {
    color: '#cbd5e1',
    fontSize: 12,
    marginBottom: 4,
  },
  sortChipsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  sortChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  sortChipActive: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderColor: 'rgba(255,255,255,0.35)',
  },
  sortChipText: {
    color: '#a3a3a3',
    fontSize: 12,
  },
  sortChipTextActive: {
    color: '#ffffff',
    fontSize: 12,
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
});
