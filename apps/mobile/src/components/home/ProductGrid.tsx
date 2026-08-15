import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, Product } from '../../constants';
import ProductCard from '../product/ProductCard';

interface ProductGridProps {
  products: Product[];
}

const CATEGORIES = [
  { id: 'All', label: 'All Products' },
  { id: 'A2 Desi Ghee', label: 'Ghee' },
  { id: 'Wood-Pressed Oils', label: 'Oils' },
  { id: 'A2 Cow Milk', label: 'Milk' },
  { id: 'Raw Honey', label: 'Honey' },
];

export default function ProductGrid({ products }: ProductGridProps) {
  const router = useRouter();
  const [activeCategory, setActiveCategory] = useState<string>('All');

  const filteredProducts = activeCategory === 'All'
    ? products
    : products.filter((p) => p.category === activeCategory);

  return (
    <View style={styles.container}>
      {/* Title Header */}
      <View style={styles.headerContainer}>
        <Text style={styles.sectionTitle}>Welcome To Country Dairy!</Text>
        <Text style={styles.sectionSubtitle}>You're One Step Closer to Purity</Text>
      </View>

      {/* Category Filter Pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoryContainer}
      >
        {CATEGORIES.map((cat) => {
          const isActive = activeCategory === cat.id;
          return (
            <TouchableOpacity
              key={cat.id}
              onPress={() => setActiveCategory(cat.id)}
              style={[styles.categoryPill, isActive && styles.categoryPillActive]}
            >
              <Text style={[styles.categoryPillText, isActive && styles.categoryPillTextActive]}>
                {cat.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Single Row Horizontal Scroll Container */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={282} // card width + margin
        decelerationRate="fast"
        contentContainerStyle={styles.horizontalRow}
      >
        {filteredProducts.map((product) => (
          <View key={product.id} style={styles.cardWrapper}>
            <ProductCard product={product} />
          </View>
        ))}
      </ScrollView>

      {/* Explore Complete Catalog Button */}
      <View style={styles.ctaWrapper}>
        <TouchableOpacity
          style={styles.exploreButton}
          activeOpacity={0.8}
          onPress={() => router.push('/products' as any)}
        >
          <Text style={styles.exploreButtonText}>EXPLORE COMPLETE CATALOG</Text>
          <Ionicons name="arrow-forward" size={14} color={COLORS.forest} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 16,
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.charcoal,
    fontFamily: 'serif',
    textAlign: 'center',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    fontStyle: 'italic',
    fontWeight: '600',
    color: COLORS.forest,
    textAlign: 'center',
  },
  categoryContainer: {
    paddingHorizontal: 4,
    gap: 8,
    marginBottom: 16,
  },
  categoryPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e8e5df',
  },
  categoryPillActive: {
    backgroundColor: COLORS.forest,
    borderColor: COLORS.forest,
  },
  categoryPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.muted,
  },
  categoryPillTextActive: {
    color: '#fff',
  },
  horizontalRow: {
    paddingRight: 16,
    gap: 14,
  },
  cardWrapper: {
    width: 268,
  },
  ctaWrapper: {
    alignItems: 'center',
    marginTop: 20,
  },
  exploreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: 'rgba(58, 96, 56, 0.3)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 24,
    gap: 6,
  },
  exploreButtonText: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.forest,
    letterSpacing: 0.5,
  },
});
