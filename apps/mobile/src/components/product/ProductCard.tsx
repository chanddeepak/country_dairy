import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { COLORS, Product } from '../../constants';

interface ProductCardProps {
  product: Product;
  style?: any;
}

export default function ProductCard({ product, style }: ProductCardProps) {
  const router = useRouter();

  const defaultVariant = product.variants?.find((v) => v.isDefault) || product.variants?.[0];
  const displayPrice = defaultVariant ? defaultVariant.price : product.price;
  const displayOriginalPrice = defaultVariant ? defaultVariant.originalPrice : product.originalPrice;
  const discountBadge = defaultVariant?.discountPercent || product.discountBadge;
  const imageSrc = defaultVariant?.image || product.imageUrls?.[0];
  const targetSlug = product.slug || 'country-dairy-a2-cow-milk-1l';
  const targetUrl = defaultVariant ? `/${targetSlug}?variant=${defaultVariant.id}` : `/${targetSlug}`;

  return (
    <TouchableOpacity 
      style={[styles.card, style]}
      activeOpacity={0.8}
      onPress={() => router.push(targetUrl as any)}
    >
      {/* Product Image Container */}
      <View style={styles.imageContainer}>
        {/* Top Left Discount Badge */}
        {discountBadge ? (
          <View style={styles.discountBadge}>
            <Text style={styles.discountBadgeText}>{discountBadge}</Text>
          </View>
        ) : null}

        {/* Top Right Highlight Tag */}
        {product.badge ? (
          <View style={styles.highlightBadge}>
            <Text style={styles.highlightBadgeText}>{product.badge}</Text>
          </View>
        ) : null}

        <Image 
          source={imageSrc} 
          style={styles.productImage} 
          resizeMode="contain"
        />
      </View>

      {/* Product Info */}
      <View style={styles.cardContent}>
        <Text style={styles.productName} numberOfLines={1}>{product.name}</Text>
        <Text style={styles.description} numberOfLines={2}>{product.description}</Text>
        
        {/* Price & Variant Pill Row */}
        <View style={styles.priceRow}>
          <View style={styles.priceGroup}>
            <Text style={styles.price}>₹{displayPrice}</Text>
            {displayOriginalPrice ? (
              <Text style={styles.originalPrice}>₹{displayOriginalPrice}</Text>
            ) : null}
          </View>
          <View style={styles.sizePill}>
            <Text style={styles.sizePillText}>
              {defaultVariant?.volumeOrWeight || product.metadata?.volume || product.metadata?.weight || ''}
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#e8e5df',
  },
  imageContainer: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#FAF8F3',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12,
    position: 'relative',
  },
  discountBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    zIndex: 10,
    backgroundColor: COLORS.forest,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 3,
  },
  discountBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
  },
  highlightBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 10,
    backgroundColor: COLORS.gold,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 3,
  },
  highlightBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  cardContent: {
    padding: 12,
  },
  productName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.charcoal,
    marginBottom: 4,
  },
  description: {
    fontSize: 11,
    color: COLORS.muted,
    lineHeight: 15,
    marginBottom: 8,
    minHeight: 30,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 'auto',
  },
  priceGroup: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  price: {
    fontSize: 16,
    fontWeight: '900',
    color: COLORS.charcoal,
  },
  originalPrice: {
    fontSize: 11,
    color: COLORS.muted,
    textDecorationLine: 'line-through',
  },
  sizePill: {
    backgroundColor: '#f2efea',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  sizePillText: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.muted,
  },
});
