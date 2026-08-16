import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants';
import { rupees } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import AppHeader from '../../components/layout/AppHeader';

interface OrderRow {
  id: string;
  orderNumber: string;
  status: string;
  totalAmount: string;
  createdAt: string;
  orderItems?: { productTitle: string; quantity: number }[];
}

/** What the customer is told, which is not what the database calls it. */
const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Awaiting payment',
  CONFIRMED: 'Confirmed',
  PROCESSING: 'Being packed',
  SHIPPED: 'On its way',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
  RETURNED: 'Returned',
};

const STATUS_TONE: Record<string, string> = {
  DELIVERED: COLORS.forest,
  CANCELLED: '#b4423a',
  RETURNED: '#b4423a',
};

function when(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function OrdersScreen() {
  const router = useRouter();
  const { user, isReady, authRequest } = useAuth();

  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setError('');
    try {
      setOrders(await authRequest<OrderRow[]>('/orders'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load your orders.');
    } finally {
      setLoading(false);
    }
  }, [user, authRequest]);

  useEffect(() => {
    if (isReady) void load();
  }, [isReady, load]);

  // Coming back from a tracking screen should show current state, not what
  // was true when the list was first opened.
  useFocusEffect(
    useCallback(() => {
      if (isReady && user) void load();
    }, [isReady, user, load]),
  );

  if (!isReady || loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <AppHeader title="My orders" />
        <ActivityIndicator color={COLORS.forest} style={{ marginTop: 48 }} />
      </SafeAreaView>
    );
  }

  if (!user) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <AppHeader title="My orders" />
        <View style={styles.empty}>
          <Ionicons name="receipt-outline" size={34} color={COLORS.muted} />
          <Text style={styles.emptyTitle}>Sign in to see your orders</Text>
          <TouchableOpacity onPress={() => router.push('/sign-in')} style={styles.primary}>
            <Text style={styles.primaryText}>Sign in</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <AppHeader title="My orders" />

      <FlatList
        data={orders}
        keyExtractor={(o) => o.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        refreshControl={
          <RefreshControl refreshing={false} onRefresh={load} tintColor={COLORS.forest} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="basket-outline" size={34} color={COLORS.muted} />
            <Text style={styles.emptyTitle}>No orders yet</Text>
            <Text style={styles.emptyBody}>Anything you order will show up here.</Text>
          </View>
        }
        ListHeaderComponent={
          error ? <Text style={styles.error}>{error}</Text> : null
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => router.push(`/orders/${item.id}`)}
            activeOpacity={0.7}
          >
            <View style={styles.cardTop}>
              <Text style={styles.orderNumber}>{item.orderNumber}</Text>
              <Text
                style={[
                  styles.status,
                  { color: STATUS_TONE[item.status] ?? COLORS.gold },
                ]}
              >
                {STATUS_LABEL[item.status] ?? item.status}
              </Text>
            </View>

            <Text style={styles.meta}>
              {when(item.createdAt)}
              {item.orderItems?.length
                ? ` · ${item.orderItems.length} item${item.orderItems.length > 1 ? 's' : ''}`
                : ''}
            </Text>

            <View style={styles.cardBottom}>
              <Text style={styles.total}>{rupees(item.totalAmount)}</Text>
              <Ionicons name="chevron-forward" size={16} color={COLORS.muted} />
            </View>
          </TouchableOpacity>
        )}
      />
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
  headerTitle: { fontSize: 16, fontWeight: '800', color: COLORS.charcoal },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#eee9e0',
    padding: 14,
    marginBottom: 10,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  orderNumber: { fontSize: 13, fontWeight: '800', color: COLORS.charcoal },
  status: { fontSize: 11, fontWeight: '800' },
  meta: { fontSize: 11, color: COLORS.muted, marginTop: 4 },
  cardBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
  },
  total: { fontSize: 15, fontWeight: '800', color: COLORS.charcoal },
  empty: { alignItems: 'center', paddingVertical: 64, paddingHorizontal: 24 },
  emptyTitle: { fontSize: 15, fontWeight: '800', color: COLORS.charcoal, marginTop: 12 },
  emptyBody: { fontSize: 12, color: COLORS.muted, marginTop: 4, textAlign: 'center' },
  error: { color: '#b4423a', fontSize: 12, fontWeight: '700', marginBottom: 12 },
  primary: {
    backgroundColor: COLORS.forest,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 28,
    marginTop: 16,
  },
  primaryText: { color: '#fff', fontWeight: '800', fontSize: 14 },
});
