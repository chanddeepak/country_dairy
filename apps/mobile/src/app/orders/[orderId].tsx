import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { trackingLabelFor, trackingUrlFor } from '@country-dairy/types';
import { COLORS, WHATSAPP_NUMBER } from '../../constants';
import { rupees } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import AppHeader from '../../components/layout/AppHeader';

interface OrderDetail {
  id: string;
  orderNumber: string;
  status: string;
  totalAmount: string;
  subtotal?: string;
  deliveryCharges?: string;
  taxAmount?: string;
  createdAt: string;
  confirmedAt?: string | null;
  shippedAt?: string | null;
  deliveredAt?: string | null;
  trackingNumber?: string | null;
  shippingCarrier?: string | null;
  orderItems?: {
    id: string;
    productTitle: string;
    variantSizeLabel: string;
    quantity: number;
    unitPrice: string;
  }[];
}

function stamp(iso?: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function OrderDetailScreen() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const router = useRouter();
  const { user, isReady, authRequest } = useAuth();

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!user || !orderId) return;
    setError('');
    try {
      setOrder(await authRequest<OrderDetail>(`/orders/${orderId}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load that order.');
    } finally {
      setLoading(false);
    }
  }, [user, orderId, authRequest]);

  useEffect(() => {
    if (isReady) void load();
  }, [isReady, load]);

  if (loading || !isReady) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <AppHeader showBack />
        <ActivityIndicator color={COLORS.forest} style={{ marginTop: 48 }} />
      </SafeAreaView>
    );
  }

  if (!order) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <AppHeader showBack />
        <View style={styles.empty}>
          <Ionicons name="alert-circle-outline" size={34} color={COLORS.muted} />
          <Text style={styles.emptyTitle}>{error || 'We could not find that order.'}</Text>
          <TouchableOpacity onPress={() => router.back()} style={styles.primary}>
            <Text style={styles.primaryText}>Go back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Named after the carrier that actually has the parcel. Saying "Track on
  // Delhivery" above a DTDC waybill sends people to a site that has never
  // heard of their order — which happened on the web.
  const trackUrl = trackingUrlFor(order.shippingCarrier, order.trackingNumber);
  const trackLabel = trackingLabelFor(order.shippingCarrier);

  const steps = [
    { label: 'Order placed', at: order.createdAt },
    { label: 'Confirmed', at: order.confirmedAt },
    { label: 'On its way', at: order.shippedAt },
    { label: 'Delivered', at: order.deliveredAt },
  ];

  const helpUrl =
    `https://wa.me/${WHATSAPP_NUMBER}?text=` +
    encodeURIComponent(`Hello, I need help with my order ${order.orderNumber}.`);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <AppHeader title={order.orderNumber} showBack />

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={
          <RefreshControl refreshing={false} onRefresh={load} tintColor={COLORS.forest} />
        }
      >
        {/* The question people open this screen to answer, in words, before
            any timeline. */}
        <Text style={styles.headline}>
          {order.status === 'DELIVERED'
            ? 'Delivered'
            : order.status === 'SHIPPED'
              ? 'On its way to you'
              : order.status === 'CANCELLED'
                ? 'Cancelled'
                : 'We are getting it ready'}
        </Text>
        {order.deliveredAt && (
          <Text style={styles.headlineSub}>Delivered {stamp(order.deliveredAt)}</Text>
        )}

        <View style={styles.card}>
          {steps.map((step, i) => (
            <View key={step.label} style={styles.step}>
              <View style={[styles.dot, step.at ? styles.dotDone : null]} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.stepLabel, !step.at && { color: COLORS.muted }]}>
                  {step.label}
                </Text>
                {/* A tick with no time against it tells you nothing you did
                    not already know. */}
                <Text style={styles.stepTime}>{step.at ? stamp(step.at) : '—'}</Text>
              </View>
              {i < steps.length - 1 && <View style={styles.rail} />}
            </View>
          ))}
        </View>

        {(trackUrl || true) && (
          <View style={styles.actions}>
            {trackUrl && (
              <TouchableOpacity
                style={styles.ghost}
                onPress={() => Linking.openURL(trackUrl)}
              >
                <Ionicons name="navigate-outline" size={15} color={COLORS.forest} />
                <Text style={styles.ghostText}>Track on {trackLabel}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.ghost} onPress={() => Linking.openURL(helpUrl)}>
              <Ionicons name="logo-whatsapp" size={15} color={COLORS.forest} />
              <Text style={styles.ghostText}>Need help</Text>
            </TouchableOpacity>
          </View>
        )}

        <Text style={styles.sectionTitle}>What you ordered</Text>
        <View style={styles.card}>
          {order.orderItems?.map((item) => (
            <View key={item.id} style={styles.itemRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemTitle}>{item.productTitle}</Text>
                <Text style={styles.itemMeta}>
                  {item.variantSizeLabel} × {item.quantity}
                </Text>
              </View>
              <Text style={styles.itemPrice}>
                {rupees(Number(item.unitPrice) * item.quantity)}
              </Text>
            </View>
          ))}

          {/* Every figure comes from the API. The app never adds money up —
              that mistake cost ₹100 a line once already. */}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total paid</Text>
            <Text style={styles.totalValue}>{rupees(order.totalAmount)}</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.cream },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: { fontSize: 15, fontWeight: '800', color: COLORS.charcoal },
  headline: { fontSize: 22, fontWeight: '800', color: COLORS.charcoal },
  headlineSub: { fontSize: 12, color: COLORS.muted, marginTop: 2 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#eee9e0',
    padding: 14,
    marginTop: 14,
  },
  step: { flexDirection: 'row', gap: 12, paddingBottom: 14, position: 'relative' },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#ddd6cc',
    marginTop: 2,
  },
  dotDone: { backgroundColor: COLORS.forest, borderColor: COLORS.forest },
  rail: {
    position: 'absolute',
    left: 6,
    top: 18,
    bottom: 0,
    width: 2,
    backgroundColor: '#eee9e0',
  },
  stepLabel: { fontSize: 13, fontWeight: '700', color: COLORS.charcoal },
  stepTime: { fontSize: 11, color: COLORS.muted, marginTop: 1 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  ghost: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#eee9e0',
    borderRadius: 12,
    paddingVertical: 12,
  },
  ghostText: { fontSize: 12, fontWeight: '800', color: COLORS.forest },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.charcoal,
    marginTop: 22,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  itemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  itemTitle: { fontSize: 13, fontWeight: '700', color: COLORS.charcoal },
  itemMeta: { fontSize: 11, color: COLORS.muted, marginTop: 1 },
  itemPrice: { fontSize: 13, fontWeight: '800', color: COLORS.charcoal },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#f0ece4',
    marginTop: 8,
    paddingTop: 12,
  },
  totalLabel: { fontSize: 13, fontWeight: '700', color: COLORS.charcoal },
  totalValue: { fontSize: 15, fontWeight: '800', color: COLORS.charcoal },
  empty: { alignItems: 'center', paddingVertical: 64, paddingHorizontal: 24 },
  emptyTitle: { fontSize: 14, fontWeight: '800', color: COLORS.charcoal, marginTop: 12, textAlign: 'center' },
  primary: {
    backgroundColor: COLORS.forest,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 28,
    marginTop: 16,
  },
  primaryText: { color: '#fff', fontWeight: '800', fontSize: 14 },
});
