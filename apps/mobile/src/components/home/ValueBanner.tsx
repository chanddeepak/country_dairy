import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS } from '../../constants';

const VALUES = [
  { title: '100% Organic', icon: 'leaf' as const },
  { title: 'A2 Goodness', icon: 'cow' as const },
  { title: 'Timely Delivery', icon: 'clock-outline' as const },
  { title: 'Sustainable', icon: 'sprout' as const }
];

export default function ValueBanner() {
  return (
    <View style={styles.bannerContainer}>
      <Text style={styles.bannerTitle}>Why Country Dairy</Text>
      <View style={styles.bannerItems}>
        {VALUES.map((item, index) => (
          <View key={index} style={styles.bannerItem}>
            <View style={styles.iconContainer}>
              <MaterialCommunityIcons 
                name={item.icon} 
                size={22} 
                color={COLORS.forest} 
              />
            </View>
            <Text style={styles.bannerItemText}>{item.title}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bannerContainer: {
    backgroundColor: '#FFFFFF', // Clean White card for contrast
    borderRadius: 16,
    padding: 18,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 3,
    borderWidth: 1,
    borderColor: 'rgba(58, 96, 56, 0.1)', // Subtle forest green border
  },
  bannerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.forest,
    textAlign: 'center',
    marginBottom: 16,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  bannerItems: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  bannerItem: {
    alignItems: 'center',
    flex: 1,
    paddingHorizontal: 4,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(58, 96, 56, 0.08)', // Premium light green tint
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  bannerItemText: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.charcoal,
    textAlign: 'center',
    lineHeight: 14,
  },
});
