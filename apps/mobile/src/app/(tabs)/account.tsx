import {
  ActivityIndicator,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, WHATSAPP_NUMBER } from '../../constants';
import { useAuth } from '../../context/AuthContext';
import AppHeader from '../../components/layout/AppHeader';

/**
 * The account screen.
 *
 * Deliberately short. Everything here is a door to somewhere else, and the
 * screen exists so a returning customer has one obvious place to look rather
 * than remembering which tab held what.
 */
export default function AccountScreen() {
  const router = useRouter();
  const { user, isReady, signOut } = useAuth();

  if (!isReady) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <AppHeader title="Account" />
        <ActivityIndicator color={COLORS.forest} style={{ marginTop: 48 }} />
      </SafeAreaView>
    );
  }

  if (!user) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <AppHeader title="Account" />

        <View style={styles.empty}>
          <Ionicons name="person-circle-outline" size={40} color={COLORS.muted} />
          <Text style={styles.emptyTitle}>Sign in to Country Dairy</Text>
          <Text style={styles.emptyBody}>
            Track your orders, keep your addresses, and reorder in two taps.
          </Text>
          <TouchableOpacity onPress={() => router.push('/sign-in')} style={styles.primary}>
            <Text style={styles.primaryText}>Sign in or create an account</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const initial = (user.name || user.email || '?').charAt(0).toUpperCase();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <AppHeader title="Account" />

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <View style={styles.identity}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{user.name || 'Your account'}</Text>
            <Text style={styles.email}>{user.email ?? user.phone ?? ''}</Text>
          </View>
        </View>

        <Row
          icon="receipt-outline"
          label="My orders"
          onPress={() => router.push('/orders')}
        />
        <Row
          icon="logo-whatsapp"
          label="Talk to us"
          onPress={() =>
            Linking.openURL(
              `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent('Hello Country Dairy,')}`,
            )
          }
        />

        {/* Not yet built in the app; saying so is better than a door that
            opens onto nothing. */}
        <Text style={styles.soon}>Addresses and saved questions are coming next.</Text>

        <TouchableOpacity
          onPress={async () => {
            await signOut();
            router.replace('/');
          }}
          style={styles.signOut}
        >
          <Ionicons name="log-out-outline" size={16} color="#b4423a" />
          <Text style={styles.signOutText}>Sign out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
      <Ionicons name={icon} size={18} color={COLORS.forest} />
      <Text style={styles.rowLabel}>{label}</Text>
      <Ionicons name="chevron-forward" size={16} color={COLORS.muted} />
    </TouchableOpacity>
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
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#eee9e0',
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: COLORS.forest,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontSize: 18, fontWeight: '800' },
  name: { fontSize: 15, fontWeight: '800', color: COLORS.charcoal },
  email: { fontSize: 12, color: COLORS.muted, marginTop: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#eee9e0',
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
  },
  rowLabel: { flex: 1, fontSize: 14, fontWeight: '700', color: COLORS.charcoal },
  soon: { fontSize: 11, color: COLORS.muted, marginTop: 6, marginBottom: 20, textAlign: 'center' },
  signOut: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(180,66,58,0.3)',
    borderRadius: 12,
    paddingVertical: 14,
  },
  signOutText: { color: '#b4423a', fontWeight: '800', fontSize: 13 },
  empty: { alignItems: 'center', paddingVertical: 56, paddingHorizontal: 28 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: COLORS.charcoal, marginTop: 12 },
  emptyBody: { fontSize: 12, color: COLORS.muted, marginTop: 6, textAlign: 'center' },
  primary: {
    backgroundColor: COLORS.forest,
    borderRadius: 12,
    paddingVertical: 15,
    paddingHorizontal: 24,
    marginTop: 20,
  },
  primaryText: { color: '#fff', fontWeight: '800', fontSize: 14 },
});
