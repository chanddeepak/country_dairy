import React, { useState, useRef } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  ScrollView, 
  Image, 
  TouchableOpacity, 
  Dimensions, 
  NativeSyntheticEvent, 
  NativeScrollEvent,
  ActivityIndicator,
  RefreshControl
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, HERO_IMAGE, WHATSAPP_BANNER_IMAGE, ENABLE_USER_ACCOUNTS } from '../constants';
import { useCatalogue } from '../hooks/use-catalogue';
import ValueBanner from '../components/home/ValueBanner';
import ProductGrid from '../components/home/ProductGrid';

const { width: screenWidth } = Dimensions.get('window');
const SLIDER_WIDTH = screenWidth - 32;

const CAROUSEL_ITEMS = [
  {
    key: '1',
    image: HERO_IMAGE,
    title: 'Farm Fresh. Organic. Pure Happiness.',
    subtitle: 'PREMIUM A2 MILK & GHEE',
    badge: '100% Certified Purity',
    cta: 'Explore Shop',
    ctaIcon: 'arrow-forward' as const,
  },
  {
    key: '2',
    image: WHATSAPP_BANNER_IMAGE,
    title: 'Order Fresh on WhatsApp',
    subtitle: 'DIRECT FARM-TO-HOME DELIVERY',
    badge: 'Express Ordering',
    cta: 'Order Now',
    ctaIcon: 'logo-whatsapp' as const,
  }
];

export default function HomeScreen() {
  const [activeSlide, setActiveSlide] = useState(0);
  // The shelf comes from the database. It used to be a hardcoded array, which
  // looks identical on screen right up until a price changes.
  const { products, isLoading, isStale, reload } = useCatalogue();
  const scrollRef = useRef<ScrollView>(null);

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const slide = Math.round(event.nativeEvent.contentOffset.x / SLIDER_WIDTH);
    if (slide !== activeSlide) {
      setActiveSlide(slide);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Custom Premium Header */}
      <View style={styles.header}>
        <View style={styles.brandContainer}>
          <Text style={styles.brandTitleGreen}>
            Country <Text style={styles.brandTitleGold}>Dairy</Text>
          </Text>
        </View>
        {ENABLE_USER_ACCOUNTS && (
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.headerButton}>
              <Ionicons name="notifications-outline" size={22} color={COLORS.forest} />
              <View style={styles.badgeDot} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerButton}>
              <Ionicons name="person-outline" size={22} color={COLORS.forest} />
            </TouchableOpacity>
          </View>
        )}
      </View>

      <ScrollView 
        style={styles.container} 
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Swipable Hero Carousel */}
        <View style={styles.carouselContainer}>
          <ScrollView
            ref={scrollRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            snapToInterval={SLIDER_WIDTH + 12} // width + margin
            decelerationRate="fast"
            onScroll={handleScroll}
            scrollEventThrottle={16}
            contentContainerStyle={styles.carouselContent}
          >
            {CAROUSEL_ITEMS.map((item, index) => (
              <View key={item.key} style={styles.slideCard}>
                {/* Image Hero Slide */}
                <View style={styles.imageCard}>
                  <Image source={item.image} style={styles.slideImage} resizeMode="cover" />
                  <View style={styles.imageOverlay} />
                  <View style={styles.imageContent}>
                    <View style={styles.slideBadge}>
                      <Text style={styles.slideBadgeText}>{item.badge}</Text>
                    </View>
                    <Text style={styles.slideTitle}>{item.title}</Text>
                    <Text style={styles.slideSubtitle}>{item.subtitle}</Text>
                    <TouchableOpacity style={styles.slideCTA}>
                      <Text style={styles.slideCTAText}>{item.cta}</Text>
                      <Ionicons name={item.ctaIcon} size={13} color={COLORS.forest} />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ))}
          </ScrollView>

          {/* Dots Indicator */}
          <View style={styles.dotsContainer}>
            {CAROUSEL_ITEMS.map((_, index) => (
              <View 
                key={index} 
                style={[
                  styles.dot, 
                  activeSlide === index ? styles.activeDot : styles.inactiveDot
                ]} 
              />
            ))}
          </View>
        </View>

        {/* Value Propositions */}
        <ValueBanner />

        {/* Product Catalogue */}
        {isStale && (
          <TouchableOpacity onPress={() => void reload()} style={styles.staleBanner}>
            <Ionicons name="cloud-offline-outline" size={14} color={COLORS.gold} />
            <Text style={styles.staleText}>
              Showing saved products — could not reach the shop. Tap to retry.
            </Text>
          </TouchableOpacity>
        )}
        {isLoading && products.length === 0 ? (
          <ActivityIndicator color={COLORS.forest} style={{ marginVertical: 32 }} />
        ) : (
          <ProductGrid products={products} />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  staleBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginHorizontal: 16,
    marginBottom: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(197,155,39,0.12)',
  },
  staleText: {
    flex: 1,
    fontSize: 11,
    color: COLORS.charcoal,
  },
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF', // Clean White Header background
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
  },
  brandContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  brandTitleGreen: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.forest,
    letterSpacing: 0.5,
  },
  brandTitleGold: {
    color: COLORS.gold,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerButton: {
    marginLeft: 16,
    padding: 4,
    position: 'relative',
  },
  badgeDot: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.gold,
  },
  container: {
    flex: 1,
    backgroundColor: COLORS.cream, // Warm cream for page content
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  carouselContainer: {
    marginBottom: 20,
    position: 'relative',
  },
  carouselContent: {
    paddingRight: 16, // balance ending slide offset
  },
  slideCard: {
    width: SLIDER_WIDTH,
    height: 180,
    borderRadius: 16,
    overflow: 'hidden',
    marginRight: 12,
  },
  imageCard: {
    flex: 1,
    position: 'relative',
  },
  slideImage: {
    width: '100%',
    height: '100%',
  },
  imageOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.35)', // Dim overlay for text readability
  },
  imageContent: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
  },
  slideBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    marginBottom: 8,
  },
  slideBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#FFFFFF',
    textTransform: 'uppercase',
  },
  slideTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 4,
    lineHeight: 22,
  },
  slideSubtitle: {
    fontSize: 10,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.8)',
    letterSpacing: 0.5,
  },
  slideCTA: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginTop: 10,
  },
  slideCTAText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.forest,
    marginRight: 4,
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  dot: {
    height: 6,
    borderRadius: 3,
    marginHorizontal: 3,
  },
  activeDot: {
    width: 16,
    backgroundColor: COLORS.forest,
  },
  inactiveDot: {
    width: 6,
    backgroundColor: '#D1CDCE',
  },
});
