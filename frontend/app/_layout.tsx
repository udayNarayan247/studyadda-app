import { QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter, useSegments } from "expo-router";
import { LogBox, View, ActivityIndicator } from "react-native";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useEffect } from "react";

import { ErrorBoundary } from "@/src/components/error-boundary";
import { queryClient } from "@/src/query-client";
import { AuthProvider, useAuth } from "@/src/auth-context";
import { LanguageProvider } from "@/src/lang-context";
import { colors } from "@/src/theme";

LogBox.ignoreAllLogs(true);

function Gate() {
  const { user, loading, isGuest } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (loading) return;
    const onLogin = segments[0] === "login";
    const onPublic = segments[0] === "privacy";
    const authed = !!user || isGuest;
    if (!authed && !onLogin && !onPublic) {
      router.replace("/login");
    } else if (authed && onLogin) {
      router.replace("/(tabs)");
    }
  }, [user, loading, isGuest, segments]);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface }}>
        <ActivityIndicator color={colors.brandPrimary} size="large" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.surface } }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="exam/[examId]" />
      <Stack.Screen name="quiz/[sessionId]" options={{ gestureEnabled: false }} />
      <Stack.Screen name="result/[sessionId]" />
      <Stack.Screen name="review/[sessionId]" />
      <Stack.Screen name="admin/index" />
      <Stack.Screen name="admin/question-form" />
      <Stack.Screen name="bookmarks" />
      <Stack.Screen name="privacy" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <QueryClientProvider client={queryClient}>
            <KeyboardProvider>
              <AuthProvider>
                <LanguageProvider>
                  <Gate />
                </LanguageProvider>
              </AuthProvider>
            </KeyboardProvider>
          </QueryClientProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
