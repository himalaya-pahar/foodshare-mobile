import {
  DarkTheme,
  DefaultTheme,
  Stack,
  ThemeProvider,
} from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar, useColorScheme } from "react-native";

import { AnimatedSplashOverlay } from "@/components/animated-icon";
import { AiAssistant } from "@/components/ai-assistant";
import { AuthProvider, useAuth } from "@/providers/auth-provider";

SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { status, user } = useAuth();
  const hasApprovedAccount =
    status === "signedIn" && user?.approval_status === "APPROVED";

  return (
    <>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: "#F4F7F3" },
        }}
      >
        <Stack.Protected guard={hasApprovedAccount}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="donation/[id]" />
        </Stack.Protected>

        <Stack.Protected guard={!hasApprovedAccount}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>
      </Stack>

      {/*
        Floating AI Assistant. Rendered outside the Stack (and conditionally
        for approved users only) so it sits on top of every screen — both the
        tabs and the donation detail route — without the FAB needing to know
        which route is currently active.
      */}
      {hasApprovedAccount ? <AiAssistant /> : null}
    </>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <AuthProvider>
      <ThemeProvider
        value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}
      >
        <StatusBar
          animated
          backgroundColor="#F4F7F3"
          barStyle="dark-content"
          hidden={false}
          translucent={false}
        />
        <AnimatedSplashOverlay />
        <RootNavigator />
      </ThemeProvider>
    </AuthProvider>
  );
}
