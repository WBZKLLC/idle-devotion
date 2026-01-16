import { Stack } from 'expo-router';

/**
 * Auth Layout - Simple Stack navigation for login/register screens
 * NO tab bar - users should not see tabs before logging in
 */
export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
    </Stack>
  );
}
