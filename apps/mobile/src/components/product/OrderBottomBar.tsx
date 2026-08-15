import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WHATSAPP_NUMBER } from '../../constants';
import { COLORS } from '../../constants';

interface OrderBottomBarProps {
  productName: string;
  price: string;
}

export default function OrderBottomBar({ productName, price }: OrderBottomBarProps) {
  const [quantity, setQuantity] = useState(1);
  const itemPrice = parseFloat(price);
  const totalPrice = itemPrice * quantity;

  const handleOrderOnWhatsApp = async () => {
    const message = `Hi! I'd like to order:\n- ${quantity} x ${productName} (₹${price} each)\nTotal: ₹${totalPrice}\n\nPlease help me place this order. Thank you!`;
    const url = `whatsapp://send?phone=${WHATSAPP_NUMBER}&text=${encodeURIComponent(message)}`;
    
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      } else {
        // Fallback to web WhatsApp if app is not installed
        const webUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
        await Linking.openURL(webUrl);
      }
    } catch (error) {
      Alert.alert('Error', 'Could not open WhatsApp. Please try again.');
    }
  };

  const increment = () => setQuantity(q => q + 1);
  const decrement = () => setQuantity(q => Math.max(1, q - 1));

  return (
    <View style={styles.bottomBar}>
      <View style={styles.row}>
        {/* Quantity Selector */}
        <View style={styles.quantitySelector}>
          <TouchableOpacity 
            style={[styles.qtyButton, quantity === 1 && styles.qtyButtonDisabled]} 
            onPress={decrement}
            disabled={quantity === 1}
          >
            <Ionicons 
              name="remove" 
              size={18} 
              color={quantity === 1 ? '#D1CDCE' : COLORS.forest} 
            />
          </TouchableOpacity>
          <Text style={styles.qtyText}>{quantity}</Text>
          <TouchableOpacity style={styles.qtyButton} onPress={increment}>
            <Ionicons name="add" size={18} color={COLORS.forest} />
          </TouchableOpacity>
        </View>

        {/* WhatsApp Button */}
        <TouchableOpacity 
          style={styles.whatsappButton} 
          activeOpacity={0.8}
          onPress={handleOrderOnWhatsApp}
        >
          <Ionicons name="logo-whatsapp" size={18} color="#fff" style={styles.buttonIcon} />
          <Text style={styles.whatsappButtonText}>Order • ₹{totalPrice}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    padding: 16,
    paddingBottom: 32, // Safe area for iOS
    borderTopWidth: 1,
    borderTopColor: '#F0EFEA',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  quantitySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAF8F3', // Warm Cream background
    borderWidth: 1,
    borderColor: 'rgba(58, 96, 56, 0.15)',
    borderRadius: 12,
    marginRight: 12,
    height: 52,
  },
  qtyButton: {
    width: 40,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  qtyButtonDisabled: {
    opacity: 0.6,
  },
  qtyText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.charcoal,
    minWidth: 24,
    textAlign: 'center',
  },
  whatsappButton: {
    flex: 1,
    backgroundColor: '#25D366',
    flexDirection: 'row',
    height: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonIcon: {
    marginRight: 6,
  },
  whatsappButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
