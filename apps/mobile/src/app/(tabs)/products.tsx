import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, getExpandedProducts, Product } from '../../constants';
import { useCatalogue } from '../../hooks/use-catalogue';
import ProductCard from '../../components/product/ProductCard';

const CATEGORIES = [
  { id: 'All', label: 'All Products' },
  { id: 'A2 Desi Ghee', label: 'Ghee' },
  { id: 'Wood-Pressed Oils', label: 'Oils' },
  { id: 'A2 Cow Milk', label: 'Milk' },
  { id: 'Raw Honey', label: 'Honey' },
];

export default function ProductsScreen() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');

  const { products } = useCatalogue();

  // One card per size, so a shopper picks the jar rather than the product.
  const allVariantProducts = useMemo(() => getExpandedProducts(products), [products]);

  const filteredProducts = useMemo(() => {
    return allVariantProducts.filter((product) => {
      const matchesCategory =
        activeCategory === 'All' || product.category === activeCategory;
      const matchesSearch =
        product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.description.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [allVariantProducts, activeCategory, searchQuery]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.forest} />
        </TouchableOpacity>
        
        <View style={styles.brandContainer} pointerEvents="none">
          <Text style={styles.headerTitle}>Complete Catalog</Text>
        </View>

        <TouchableOpacity style={styles.headerButton} onPress={() => setSearchQuery('')}>
          {searchQuery ? (
            <Ionicons name="close-circle" size={22} color={COLORS.muted} />
          ) : null}
        </TouchableOpacity>
      </View>

      <View style={styles.container}>
        {/* Search Bar */}
        <View style={styles.searchBarContainer}>
          <Ionicons name="search-outline" size={18} color={COLORS.muted} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search milk, ghee, oils, honey..."
            placeholderTextColor="#9e9a93"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {/* Category Pills */}
        <View style={styles.categoriesWrapper}>
          <FlatList
            data={CATEGORIES}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.categoriesList}
            renderItem={({ item }) => {
              const isActive = activeCategory === item.id;
              return (
                <TouchableOpacity
                  onPress={() => setActiveCategory(item.id)}
                  style={[styles.categoryPill, isActive && styles.categoryPillActive]}
                >
                  <Text style={[styles.categoryPillText, isActive && styles.categoryPillTextActive]}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              );
            }}
          />
        </View>

        {/* Products 2-Column Grid */}
        <FlatList
          data={filteredProducts}
          numColumns={2}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.gridContent}
          columnWrapperStyle={styles.gridRow}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="search" size={40} color={COLORS.muted} />
              <Text style={styles.emptyText}>No products found matching "{searchQuery}"</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.cardWrapper}>
              <ProductCard product={item} />
            </View>
          )}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0EFEA',
    backgroundColor: '#FFFFFF',
    position: 'relative',
  },
  brandContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.forest,
  },
  headerButton: {
    padding: 6,
  },
  backButton: {
    padding: 6,
  },
  container: {
    flex: 1,
    backgroundColor: COLORS.cream,
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 42,
    borderWidth: 1,
    borderColor: '#e8e5df',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: COLORS.charcoal,
    height: '100%',
  },
  categoriesWrapper: {
    marginBottom: 12,
  },
  categoriesList: {
    paddingHorizontal: 16,
    gap: 8,
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
  gridContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  gridRow: {
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  cardWrapper: {
    width: '48.5%',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 14,
    color: COLORS.muted,
    textAlign: 'center',
  },
});
