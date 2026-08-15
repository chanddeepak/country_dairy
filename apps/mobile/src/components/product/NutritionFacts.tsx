import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../../constants';

interface NutritionFactsProps {
  nutritionFacts: Record<string, string>;
}

export default function NutritionFacts({ nutritionFacts }: NutritionFactsProps) {
  if (!nutritionFacts) return null;

  return (
    <View style={styles.nutritionSection}>
      <Text style={styles.sectionTitle}>Nutrition Facts</Text>
      <View style={styles.nutritionGrid}>
        {Object.entries(nutritionFacts).map(([key, value]) => (
          <View key={key} style={styles.nutritionBox}>
            <Text style={styles.nutritionKey}>{key}</Text>
            <Text style={styles.nutritionValue}>{value as string}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  nutritionSection: {
    marginTop: 8,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: '#e5e5e5',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.charcoal,
    marginBottom: 16,
  },
  nutritionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  nutritionBox: {
    width: '48%',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#eee',
  },
  nutritionKey: {
    fontSize: 10,
    fontWeight: 'bold',
    color: COLORS.muted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  nutritionValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.charcoal,
  },
});
