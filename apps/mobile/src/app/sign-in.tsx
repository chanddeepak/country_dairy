import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants';
import { useAuth } from '../context/AuthContext';
import AppHeader from '../components/layout/AppHeader';

/**
 * Sign in, or start an account.
 *
 * One screen with a toggle rather than two, because the difference is a single
 * field. Someone who cannot remember whether they signed up should not have to
 * go back and choose a different door to find out.
 */
export default function SignInScreen() {
  const router = useRouter();
  const { signIn, register, sessionExpired } = useAuth();

  const [isRegistering, setIsRegistering] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    if (isRegistering && !name.trim()) {
      setError('Tell us your name.');
      return;
    }

    setBusy(true);
    setError('');
    try {
      if (isRegistering) {
        await register(name, email, password);
      } else {
        await signIn(email, password);
      }
      // back() rather than a fixed route: this screen is reached from the
      // product page, the account tab and an expired session, and each should
      // return to where the person actually was.
      if (router.canGoBack()) router.back();
      else router.replace('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That did not work. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <AppHeader showBack />
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>
            {isRegistering ? 'Create your account' : 'Welcome back'}
          </Text>
          <Text style={styles.subtitle}>
            {isRegistering
              ? 'So your orders and addresses are waiting next time.'
              : 'Sign in to track orders and reorder in two taps.'}
          </Text>

          {sessionExpired && !error && (
            <View style={styles.notice}>
              <Text style={styles.noticeText}>
                You were signed out for security. Sign in again to carry on.
              </Text>
            </View>
          )}

          {isRegistering && (
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Your name"
              placeholderTextColor={COLORS.muted}
              autoCapitalize="words"
              style={styles.field}
            />
          )}

          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="Email"
            placeholderTextColor={COLORS.muted}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            style={styles.field}
          />

          <View style={styles.passwordRow}>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="Password"
              placeholderTextColor={COLORS.muted}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              style={[styles.field, styles.passwordField]}
            />
            {/* Typing a password blind on a phone keyboard is how people end
                up locked out of an account they know the password to. */}
            <TouchableOpacity
              onPress={() => setShowPassword((v) => !v)}
              style={styles.reveal}
              hitSlop={8}
            >
              <Ionicons
                name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                size={18}
                color={COLORS.muted}
              />
            </TouchableOpacity>
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity
            onPress={submit}
            disabled={busy}
            style={[styles.primary, busy && { opacity: 0.6 }]}
          >
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryText}>
                {isRegistering ? 'Create account' : 'Sign in'}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              setIsRegistering((v) => !v);
              setError('');
            }}
            style={styles.toggle}
          >
            <Text style={styles.toggleText}>
              {isRegistering
                ? 'I already have an account'
                : 'New here? Create an account'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.cream },
  scroll: { padding: 24, paddingTop: 8 },
  back: { width: 40, height: 40, justifyContent: 'center' },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: COLORS.charcoal,
    marginTop: 12,
  },
  subtitle: { fontSize: 13, color: COLORS.muted, marginTop: 6, marginBottom: 24 },
  field: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e7e5e4',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 15,
    color: COLORS.charcoal,
    marginBottom: 12,
  },
  passwordRow: { position: 'relative' },
  passwordField: { paddingRight: 44 },
  reveal: { position: 'absolute', right: 14, top: 15 },
  error: {
    color: '#b4423a',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 12,
  },
  notice: {
    backgroundColor: 'rgba(197,155,39,0.12)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  noticeText: { fontSize: 12, color: COLORS.charcoal },
  primary: {
    backgroundColor: COLORS.forest,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  primaryText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  toggle: { alignItems: 'center', marginTop: 18 },
  toggleText: { color: COLORS.forest, fontWeight: '700', fontSize: 13 },
});
