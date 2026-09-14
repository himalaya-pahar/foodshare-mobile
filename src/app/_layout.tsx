import {
  DarkTheme,
  DefaultTheme,
  Stack,
  ThemeProvider,
} from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useColorScheme } from "react-native";

import { AnimatedSplashOverlay } from "@/components/animated-icon";
import { AuthProvider, useAuth } from "@/providers/auth-provider";

SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { status, user } = useAuth();
  const hasApprovedAccount =
    status === "signedIn" && user?.approval_status === "APPROVED";

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={hasApprovedAccount}>
        <Stack.Screen name="(tabs)" />
      </Stack.Protected>

      <Stack.Protected guard={!hasApprovedAccount}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <AuthProvider>
      <ThemeProvider
        value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}
      >
        <AnimatedSplashOverlay />
        <RootNavigator />
      </ThemeProvider>
    </AuthProvider>
  );
}
