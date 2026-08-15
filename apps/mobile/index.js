import { registerRootComponent } from 'expo';
import { ExpoRoot } from 'expo-router';

// Must be a string literal for Metro's require.context to inline properly
const ctx = require.context('./src/app');

export function App() {
  return <ExpoRoot context={ctx} />;
}

registerRootComponent(App);
