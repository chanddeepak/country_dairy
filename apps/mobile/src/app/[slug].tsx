import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  Image, 
  TouchableOpacity, 
  Dimensions,
  Linking,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { 
  COLORS, 
  WHATSAPP_NUMBER,
  WHATSAPP_MESSAGE_TEMPLATE,
  ENABLE_CART,
  ENABLE_SEARCH,
  ENABLE_PRODUCT_RATINGS,
  ENABLE_SUBSCRIPTIONS,
  ProductVariant
} from '../constants';
import { useCatalogue } from '../hooks/use-catalogue';
import NutritionFacts from '../components/product/NutritionFacts';

const { width: screenWidth } = Dimensions.get('window');

export default function ProductDetailsScreen() {
  const { slug, variant: variantQuery } = useLocalSearchParams<{ slug: string; variant?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  // Falling back to the first product when the slug is unknown would show
  // someone a different jar than the one they tapped, at a different price.
  const { products, isLoading } = useCatalogue();
  const product = products.find((p) => p.slug === slug) ?? null;

  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [activeImage, setActiveImage] = useState<any>(null);
  const [quantity, setQuantity] = useState(1);
  const [purchaseOption, setPurchaseOption] = useState<'once' | 'subscribe'>('once');
  const [activeTab, setActiveTab] = useState<'nutrition' | 'details'>('nutrition');

  useEffect(() => {
    if (product) {
      const defaultVar = (variantQuery && product.variants?.find((v) => v.id === variantQuery))
        || product.variants?.find((v) => v.isDefault)
        || product.variants?.[0]
        || null;
      setSelectedVariant(defaultVar);
      setActiveImage(defaultVar?.image || product.imageUrls?.[0]);
    }
  }, [slug, variantQuery, product]);

  // Rendering nothing is better than rendering the wrong jar: a stale or
  // mistyped slug used to fall through to the first product in the list, so
  // the page showed a product the customer had not asked for, at its price.
  if (!product) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          {isLoading ? (
            <ActivityIndicator color={COLORS.forest} />
          ) : (
            <>
              <Ionicons name="basket-outline" size={32} color={COLORS.muted} />
              <Text style={{ marginTop: 12, fontWeight: '700', color: COLORS.charcoal }}>
                We could not find that product.
              </Text>
              <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 16 }}>
                <Text style={{ color: COLORS.forest, fontWeight: '700' }}>Go back</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </SafeAreaView>
    );
  }

  const handleVariantSelect = (variant: ProductVariant) => {
    setSelectedVariant(variant);
    if (variant.image) {
      setActiveImage(variant.image);
    }
  };

  if (!product) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Product not found</Text>
      </View>
    );
  }

  const currentPrice = selectedVariant ? selectedVariant.price : product.price;
  const currentOriginalPrice = selectedVariant ? selectedVariant.originalPrice : product.originalPrice;
  const currentDiscountBadge = selectedVariant?.discountPercent || product.discountBadge;

  const basePrice = parseFloat(currentPrice);
  const discountedPrice = Math.round(basePrice * 0.9); // 10% off for subscription
  const activePrice = purchaseOption === 'subscribe' ? discountedPrice : basePrice;
  const totalPrice = activePrice * quantity;

  // Dynamic packaging based on selected variant
  const currentVolumeOrWeight = selectedVariant?.volumeOrWeight || product.metadata?.volume || product.metadata?.weight || '1 Litre';
  const currentPackaging = (
    selectedVariant?.volumeOrWeight.includes('Dolchi') ? 'Traditional Metal Dolchi' :
    selectedVariant?.volumeOrWeight.includes('Tin') ? 'Food-Grade Tin Can' :
    selectedVariant?.volumeOrWeight.includes('Bottle') ? 'Glass Bottle' :
    selectedVariant?.volumeOrWeight.includes('Canister') ? 'Family Canister' :
    product.metadata?.packaging || 'Glass Jar'
  );

  const dynamicDetails = {
    'Net Quantity / Volume': currentVolumeOrWeight,
    'Packaging Type': currentPackaging,
    'Standard Serving Size': '100g / 100ml',
    'Shelf Life': product.metadata?.shelfLife || '12 months',
    'Storage Instructions': 'Store in a cool, dry place away from direct sunlight.',
  };

  const handleOrderOnWhatsApp = async () => {
    const message = WHATSAPP_MESSAGE_TEMPLATE(
      product.name,
      activePrice.toString(),
      selectedVariant?.volumeOrWeight,
      quantity
    );
    const url = `whatsapp://send?phone=${WHATSAPP_NUMBER}&text=${encodeURIComponent(message)}`;
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      } else {
        const webUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
        await Linking.openURL(webUrl);
      }
    } catch (error) {
      Alert.alert('Error', 'Could not open WhatsApp. Please try again.');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.forest} />
        </TouchableOpacity>
        
        <View style={styles.brandContainer} pointerEvents="none">
          <Text style={styles.brandTitleGreen}>
            Country <Text style={styles.brandTitleGold}>Dairy</Text>
          </Text>
        </View>

        <View style={styles.headerRight}>
          {ENABLE_SEARCH && (
            <TouchableOpacity style={styles.headerButton}>
              <Ionicons name="search-outline" size={22} color={COLORS.forest} />
            </TouchableOpacity>
          )}
          {ENABLE_CART && (
            <TouchableOpacity style={styles.headerButton}>
              <Ionicons name="cart-outline" size={22} color={COLORS.forest} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={styles.container}>
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Main Product Image Container */}
          <View style={styles.carouselContainer}>
            <View style={styles.imageCard}>
              {currentDiscountBadge ? (
                <View style={styles.discountBadge}>
                  <Text style={styles.discountBadgeText}>{currentDiscountBadge}</Text>
                </View>
              ) : null}
              {product.badge ? (
                <View style={styles.highlightBadge}>
                  <Text style={styles.highlightBadgeText}>{product.badge}</Text>
                </View>
              ) : null}
              <Image 
                source={activeImage || product.imageUrls[0]} 
                style={styles.productImage} 
                resizeMode="contain"
              />
            </View>
          </View>

          {/* Details Section */}
          <View style={styles.detailsSection}>
            <View style={styles.categoryPillsRow}>
              <View style={styles.categoryPill}>
                <Text style={styles.categoryPillText}>{product.category || 'A2 Dairy'}</Text>
              </View>
              <Text style={styles.dotSeparator}>•</Text>
              <Text style={styles.metaSubText}>{currentPackaging}</Text>
              <Text style={styles.dotSeparator}>•</Text>
              <View style={styles.sizePill}>
                <Text style={styles.sizePillText}>{currentVolumeOrWeight}</Text>
              </View>
            </View>
            
            <Text style={styles.title}>{product.name}</Text>
            <Text style={styles.subtitleTag}>BILONA CHURNED | A2-VERIFIED MILK | 70+ QUALITY CHECKS</Text>

            {/* Price Display */}
            <View style={styles.priceRow}>
              <Text style={styles.price}>₹{activePrice}</Text>
              {currentOriginalPrice ? (
                <Text style={styles.strikePrice}>₹{currentOriginalPrice}</Text>
              ) : null}
              {currentDiscountBadge ? (
                <View style={styles.discountBadgeInline}>
                  <Text style={styles.discountBadgeInlineText}>{currentDiscountBadge}</Text>
                </View>
              ) : null}
            </View>

            {/* Description */}
            <Text style={styles.description}>{product.description}</Text>

            {/* VARIANT SELECTOR */}
            {product.variants && product.variants.length > 0 ? (
              <View style={styles.variantContainer}>
                <Text style={styles.sectionLabel}>SELECT VARIANT:</Text>
                <View style={styles.variantGrid}>
                  {product.variants.map((v) => {
                    const isSelected = selectedVariant?.id === v.id;
                    return (
                      <TouchableOpacity
                        key={v.id}
                        onPress={() => handleVariantSelect(v)}
                        style={[styles.variantChip, isSelected && styles.variantChipSelected]}
                      >
                        <Text style={[styles.variantTitle, isSelected && styles.variantTitleSelected]}>
                          {v.volumeOrWeight}
                        </Text>
                        <View style={styles.variantPriceRow}>
                          <Text style={[styles.variantPrice, isSelected && styles.variantPriceSelected]}>
                            ₹{v.price}
                          </Text>
                          {v.originalPrice ? (
                            <Text style={styles.variantOriginalPrice}>₹{v.originalPrice}</Text>
                          ) : null}
                        </View>
                        {v.discountPercent ? (
                          <Text style={styles.variantDiscount}>{v.discountPercent}</Text>
                        ) : null}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ) : null}

            {/* Quantity Selector */}
            <View style={styles.qtyContainer}>
              <Text style={styles.sectionLabel}>SELECT QUANTITY:</Text>
              <View style={styles.quantitySelector}>
                <TouchableOpacity 
                  style={[styles.qtyButton, quantity === 1 && styles.qtyButtonDisabled]} 
                  onPress={() => setQuantity(q => Math.max(1, q - 1))}
                  disabled={quantity === 1}
                >
                  <Ionicons name="remove" size={16} color={quantity === 1 ? '#D1CDCE' : COLORS.forest} />
                </TouchableOpacity>
                <Text style={styles.qtyText}>{quantity}</Text>
                <TouchableOpacity style={styles.qtyButton} onPress={() => setQuantity(q => q + 1)}>
                  <Ionicons name="add" size={16} color={COLORS.forest} />
                </TouchableOpacity>
              </View>
            </View>

            {/* DETAILED DESCRIPTION & TRUST BADGES GRID */}
            <View style={styles.descriptionBlock}>
              <Text style={styles.descriptionBlockTitle}>PRODUCT DESCRIPTION</Text>
              <Text style={styles.descriptionParagraph}>
                Made in our farms, our {product.name} is crafted with uncompromised dedication to traditional purity. Our cows graze freely in natural open pastures and are never injected with artificial hormones.
              </Text>
              <Text style={styles.descriptionParagraph}>
                Our A2 milk is set into cultured curd and traditional bilona-churned in small batches. Every batch is lab-tested so what reaches your kitchen is pure, wholesome quality that boosts immunity.
              </Text>

              {/* Trust Badges Grid */}
              <View style={styles.trustBadgesGrid}>
                <View style={styles.trustCard}>
                  <Ionicons name="car-outline" size={24} color={COLORS.forest} />
                  <Text style={styles.trustTitle}>Free Shipping</Text>
                  <Text style={styles.trustSub}>Orders Above ₹499</Text>
                </View>
                <View style={styles.trustCard}>
                  <Ionicons name="headset-outline" size={24} color={COLORS.forest} />
                  <Text style={styles.trustTitle}>360° Support</Text>
                  <Text style={styles.trustSub}>Always Here to Help</Text>
                </View>
                <View style={styles.trustCard}>
                  <Ionicons name="refresh-outline" size={24} color={COLORS.forest} />
                  <Text style={styles.trustTitle}>100% Purity</Text>
                  <Text style={styles.trustSub}>Guaranteed Fresh</Text>
                </View>
                <View style={styles.trustCard}>
                  <Ionicons name="checkmark-done-circle-outline" size={24} color={COLORS.forest} />
                  <Text style={styles.trustTitle}>70+ Checks</Text>
                  <Text style={styles.trustSub}>Lab Tested Quality</Text>
                </View>
              </View>
            </View>

            {/* Tabs: Nutrition / Details */}
            <View style={styles.tabsContainer}>
              <View style={styles.tabsHeader}>
                <TouchableOpacity
                  onPress={() => setActiveTab('nutrition')}
                  style={[styles.tabButton, activeTab === 'nutrition' && styles.tabButtonActive]}
                >
                  <Text style={[styles.tabText, activeTab === 'nutrition' && styles.tabTextActive]}>
                    Nutrition Facts
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setActiveTab('details')}
                  style={[styles.tabButton, activeTab === 'details' && styles.tabButtonActive]}
                >
                  <Text style={[styles.tabText, activeTab === 'details' && styles.tabTextActive]}>
                    Details
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.tabCard}>
                {activeTab === 'nutrition' ? (
                  <NutritionFacts nutritionFacts={product.nutritionFacts as unknown as Record<string, string>} />
                ) : (
                  <View style={styles.detailsList}>
                    {Object.entries(dynamicDetails).map(([key, value]) => (
                      <View key={key} style={styles.detailItem}>
                        <Text style={styles.detailKey}>{key}</Text>
                        <Text style={styles.detailValue}>{value as string}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </View>

          </View>
        </ScrollView>

        {/* Bottom Order Bar */}
        <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <View style={styles.bottomRow}>
            <View style={styles.totalContainer}>
              <Text style={styles.totalLabel}>Total Amount</Text>
              <Text style={styles.totalPrice}>₹{totalPrice}</Text>
            </View>
            
            <TouchableOpacity 
              style={styles.orderButton} 
              activeOpacity={0.8}
              onPress={handleOrderOnWhatsApp}
            >
              <Ionicons name="logo-whatsapp" size={18} color="#fff" style={styles.buttonIcon} />
              <Text style={styles.orderButtonText}>ORDER ON WHATSAPP</Text>
            </TouchableOpacity>
          </View>
        </View>
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
  brandTitleGreen: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.forest,
  },
  brandTitleGold: {
    color: COLORS.gold,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerButton: {
    padding: 6,
    marginLeft: 8,
  },
  backButton: {
    padding: 6,
  },
  container: {
    flex: 1,
    backgroundColor: COLORS.cream,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.cream,
  },
  errorText: {
    fontSize: 16,
    color: COLORS.muted,
  },
  scrollContent: {
    paddingBottom: 120,
  },
  carouselContainer: {
    width: '100%',
  },
  imageCard: {
    width: '100%',
    height: 280,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    position: 'relative',
  },
  discountBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    zIndex: 10,
    backgroundColor: COLORS.forest,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
  },
  discountBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
  },
  highlightBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 10,
    backgroundColor: COLORS.gold,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
  },
  highlightBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  detailsSection: {
    paddingHorizontal: 20,
    marginTop: 20,
  },
  categoryPillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    flexWrap: 'wrap',
    gap: 6,
  },
  categoryPill: {
    backgroundColor: 'rgba(58, 96, 56, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  categoryPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.forest,
    textTransform: 'uppercase',
  },
  dotSeparator: {
    fontSize: 12,
    color: COLORS.muted,
  },
  metaSubText: {
    fontSize: 12,
    color: COLORS.muted,
  },
  sizePill: {
    backgroundColor: '#f2efea',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  sizePillText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.muted,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.charcoal,
    lineHeight: 30,
    marginBottom: 4,
  },
  subtitleTag: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.muted,
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 14,
  },
  price: {
    fontSize: 28,
    fontWeight: '900',
    color: COLORS.charcoal,
    marginRight: 8,
  },
  strikePrice: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.muted,
    textDecorationLine: 'line-through',
    marginRight: 8,
  },
  discountBadgeInline: {
    backgroundColor: 'rgba(58, 96, 56, 0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  discountBadgeInlineText: {
    color: COLORS.forest,
    fontSize: 11,
    fontWeight: '800',
  },
  description: {
    fontSize: 14,
    color: COLORS.muted,
    lineHeight: 22,
    marginBottom: 18,
  },
  variantContainer: {
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.charcoal,
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  variantGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  variantChip: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#e8e5df',
    borderRadius: 10,
    padding: 10,
  },
  variantChipSelected: {
    borderColor: COLORS.forest,
    backgroundColor: 'rgba(58, 96, 56, 0.04)',
  },
  variantTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.charcoal,
    marginBottom: 4,
  },
  variantTitleSelected: {
    color: COLORS.forest,
  },
  variantPriceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  variantPrice: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.charcoal,
  },
  variantPriceSelected: {
    color: COLORS.forest,
  },
  variantOriginalPrice: {
    fontSize: 10,
    color: COLORS.muted,
    textDecorationLine: 'line-through',
  },
  variantDiscount: {
    fontSize: 9,
    fontWeight: '700',
    color: COLORS.forest,
    marginTop: 2,
  },
  qtyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  quantitySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EAE6DD',
    borderRadius: 24,
    height: 40,
  },
  qtyButton: {
    width: 36,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  qtyButtonDisabled: {
    opacity: 0.5,
  },
  qtyText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.charcoal,
    minWidth: 20,
    textAlign: 'center',
  },
  descriptionBlock: {
    borderTopWidth: 1,
    borderTopColor: '#EAE6DD',
    paddingTop: 18,
    marginBottom: 24,
  },
  descriptionBlockTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.charcoal,
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  descriptionParagraph: {
    fontSize: 13,
    color: COLORS.muted,
    lineHeight: 20,
    marginBottom: 10,
  },
  trustBadgesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 12,
  },
  trustCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#e8e5df',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
  },
  trustTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.charcoal,
    marginTop: 6,
    marginBottom: 2,
  },
  trustSub: {
    fontSize: 10,
    color: COLORS.muted,
  },
  tabsContainer: {
    marginBottom: 24,
  },
  tabsHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#EAE6DD',
  },
  tabButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    marginBottom: -1,
  },
  tabButtonActive: {
    borderBottomColor: COLORS.forest,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.muted,
  },
  tabTextActive: {
    color: COLORS.forest,
  },
  tabCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: '#EAE6DD',
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    padding: 16,
  },
  detailsList: {
    gap: 10,
  },
  detailItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#f4f2ee',
    paddingBottom: 8,
  },
  detailKey: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.charcoal,
  },
  detailValue: {
    fontSize: 12,
    color: COLORS.muted,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0EFEA',
    elevation: 10,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  totalContainer: {
    justifyContent: 'center',
  },
  totalLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.muted,
    textTransform: 'uppercase',
  },
  totalPrice: {
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.charcoal,
  },
  orderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#25D366', // WhatsApp green button
    height: 46,
    paddingHorizontal: 18,
    borderRadius: 12,
  },
  buttonIcon: {
    marginRight: 8,
  },
  orderButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
