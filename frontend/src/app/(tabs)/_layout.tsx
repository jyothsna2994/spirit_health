import { Tabs, router } from "expo-router";
import React, { useEffect } from "react";
import { Text } from "react-native";

import { palette } from "../../constants/palette";
import { useI18n } from "../../lib/i18n";
import { getSession } from "../../lib/session";

const icon = (emoji: string) =>
  function TabIcon({ focused }: { focused: boolean }) {
    return <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.55 }}>{emoji}</Text>;
  };

export default function TabsLayout() {
  const { t } = useI18n();

  /* Every tab needs a signed-in user (the first-prototype session without a token counts as signed out). */
  useEffect(() => {
    getSession().then((session) => {
      if (!session) router.replace("/auth");
    });
  }, []);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: palette.primary,
        tabBarInactiveTintColor: palette.muted,
        tabBarLabelStyle: { fontWeight: "700", fontSize: 12 },
        tabBarStyle: { backgroundColor: "#fff", borderTopColor: palette.border },
      }}
    >
      <Tabs.Screen name="index" options={{ title: t("tab.upload"), tabBarIcon: icon("📤") }} />
      <Tabs.Screen name="timeline" options={{ title: t("tab.timeline"), tabBarIcon: icon("🕒") }} />
      <Tabs.Screen name="profile" options={{ title: t("tab.profile"), tabBarIcon: icon("👤") }} />
    </Tabs>
  );
}
