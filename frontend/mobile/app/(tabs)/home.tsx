import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, TextInput } from 'react-native';

const HomeScreen = () => {
  const handleSearchFocus = () => {};
  const handleCategoryPress = (category: string) => {};
  const handleMarketPress = (id: string) => {};
  const handleCreateMarket = () => {};

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        accessibilityRole="scrollbar"
      >
        {/* Top Bar */}
        <View style={styles.topBar}>
          <Text accessibilityRole="header" accessibilityLabel="Colosseum" style={styles.appTitle}>Colosseum</Text>
          <TouchableOpacity
            onPress={handleCreateMarket}
            accessibilityRole="button"
            accessibilityLabel="Create Market"
            style={styles.createBtn}
          >
            <Text style={styles.createBtnText}>Create</Text>
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View style={styles.searchWrap}>
          <TextInput
            placeholder="Search markets"
            placeholderTextColor="#9ca3af"
            onFocus={handleSearchFocus}
            accessibilityLabel="Search markets"
            style={styles.searchInput}
          />
        </View>

        {/* Highlights Banner */}
        <View style={styles.banner}>
          <View style={styles.bannerContent}>
            <Text style={styles.bannerTitle}>Trade the future</Text>
            <Text style={styles.bannerSubtitle}>Predict outcomes. Earn when you’re right.</Text>
            <TouchableOpacity
              onPress={handleCreateMarket}
              accessibilityRole="button"
              accessibilityLabel="Get Started"
              style={styles.bannerCta}
            >
              <Text style={styles.bannerCtaText}>Get started</Text>
            </TouchableOpacity>
          </View>
          <Image
            source={require('@/assets/images/onboard.png')}
            resizeMode="cover"
            style={styles.bannerImage}
          />
        </View>

        {/* Categories */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categories}
          accessibilityRole="tablist"
        >
          {['Trending', 'Crypto', 'AI', 'Sports', 'Politics', 'Tech'].map((c) => (
            <TouchableOpacity
              key={c}
              onPress={() => handleCategoryPress(c)}
              accessibilityRole="tab"
              accessibilityLabel={`Category ${c}`}
              style={styles.categoryPill}
            >
              <Text style={styles.categoryText}>{c}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Markets List */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Trending Markets</Text>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="See all markets">
            <Text style={styles.sectionAction}>See all</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.cards}>
          {[1, 2, 3, 4].map((n) => (
            <TouchableOpacity
              key={n}
              onPress={() => handleMarketPress(String(n))}
              accessibilityRole="button"
              accessibilityLabel={`Open market ${n}`}
              style={styles.card}
            >
              <View style={styles.cardTopRow}>
                <Text style={styles.cardBadge}>Yes/No</Text>
                <Text style={styles.cardVolume}>$12.3k</Text>
              </View>
              <Text style={styles.cardTitle} numberOfLines={2}>
                Will BTC close above $75k this month?
              </Text>
              <View style={styles.cardBottomRow}>
                <View style={styles.progressBarBg}>
                  <View style={styles.progressBarFill} />
                </View>
                <Text style={styles.cardPercent}>62% Yes</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
};

export default HomeScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b0f1a' },
  scrollContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 24 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  appTitle: { color: '#fff', fontSize: 22, fontWeight: '700', letterSpacing: 0.2 },
  createBtn: { backgroundColor: '#e2e8f0', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 9999 },
  createBtnText: { color: '#0b0f1a', fontSize: 14, fontWeight: '700' },
  searchWrap: { marginBottom: 16 },
  searchInput: {
    backgroundColor: '#111827',
    borderColor: '#1f2937',
    borderWidth: 1,
    color: '#fff',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
  },
  banner: {
    backgroundColor: '#111827',
    borderColor: '#1f2937',
    borderWidth: 1,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
  },
  bannerContent: { padding: 16 },
  bannerTitle: { color: '#fff', fontSize: 18, fontWeight: '800', marginBottom: 6 },
  bannerSubtitle: { color: '#cbd5e1', fontSize: 13, lineHeight: 18, marginBottom: 10 },
  bannerCta: { backgroundColor: '#e2e8f0', alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 9999 },
  bannerCtaText: { color: '#0b0f1a', fontSize: 13, fontWeight: '700' },
  bannerImage: { width: '100%', height: 120 },
  categories: { gap: 8, paddingVertical: 4, paddingHorizontal: 2, marginBottom: 8 },
  categoryPill: { backgroundColor: '#0f172a', borderColor: '#1f2937', borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 9999, marginRight: 8 },
  categoryText: { color: '#e5e7eb', fontSize: 13, fontWeight: '600' },
  sectionHeader: { marginTop: 8, marginBottom: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { color: '#fff', fontSize: 16, fontWeight: '800' },
  sectionAction: { color: '#93c5fd', fontSize: 13, fontWeight: '700' },
  cards: { marginTop: 4 },
  card: { backgroundColor: '#0f172a', borderColor: '#1f2937', borderWidth: 1, padding: 14, borderRadius: 14, marginBottom: 12 },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  cardBadge: { color: '#93c5fd', backgroundColor: 'rgba(59,130,246,0.15)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, overflow: 'hidden', fontSize: 12, fontWeight: '700' },
  cardVolume: { color: '#9ca3af', fontSize: 12, fontWeight: '600' },
  cardTitle: { color: '#e5e7eb', fontSize: 15, lineHeight: 20, fontWeight: '700', marginBottom: 10 },
  cardBottomRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  progressBarBg: { flex: 1, height: 6, backgroundColor: '#1f2937', borderRadius: 9999 },
  progressBarFill: { width: '62%', height: 6, backgroundColor: '#60a5fa', borderRadius: 9999 },
  cardPercent: { color: '#cbd5e1', fontSize: 12, fontWeight: '700' },
});


