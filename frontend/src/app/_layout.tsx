import { Stack } from "expo-router";

import { LanguageProvider } from "../lib/i18n";

export default function RootLayout() {
  return (
    <LanguageProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="auth" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="record/[id]" />
        <Stack.Screen name="trend/[key]" />
      </Stack>
    </LanguageProvider>
  );
}
