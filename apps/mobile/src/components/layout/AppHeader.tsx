import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, BRAND_LOGO } from '../../constants';

/**
 * The bar at the top of every screen.
 *
 * Sign in, orders and the account screen each drew their own — a bare back
 * arrow floating in cream — so moving between them felt like moving between
 * three different apps. The logo is the thing that says otherwise, and it has
 * to be in the same place every time for that to work.
 */
export default function AppHeader({
  title,
  showBack = false,
  right,
}: {
  /** Shown instead of the logo. Use on screens that are about one thing. */
  title?: string;
  showBack?: boolean;
  right?: React.ReactNode;
}) {
  const router = useRouter();

  return (
    <View style={styles.bar}>
      <View style={styles.side}>
        {showBack && (
          <TouchableOpacity
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
            hitSlop={10}
            accessibilityLabel="Back"
          >
            <Ionicons name="arrow-back" size={22} color={COLORS.charcoal} />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.middle}>
        {title ? (
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
        ) : (
          <Image source={BRAND_LOGO} style={styles.logo} resizeMode="contain" />
        )}
      </View>

      {/* Same width as the left side, so the middle stays centred whether or
          not there is a back arrow or an action. */}
      <View style={[styles.side, styles.right]}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#efeae1',
  },
  side: { width: 72, flexDirection: 'row', alignItems: 'center', gap: 12 },
  right: { justifyContent: 'flex-end' },
  middle: { flex: 1, alignItems: 'center' },
  logo: { height: 40, width: 130 },
  title: { fontSize: 15, fontWeight: '800', color: COLORS.charcoal },
});
