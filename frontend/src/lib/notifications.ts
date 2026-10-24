import { Platform } from "react-native";
export type ReminderNotification = {
  title: string;
  body: string;
  reminderId?: string;
};
export async function requestReminderNotificationPermission() {
  // Browser notifications will be implemented separately
  // using Web Push and a service worker.
  if (Platform.OS === "web") {
    return {
      granted: false,
      reason: "Web Push setup is not yet configured.",
    };
  }
  const Notifications = await import("expo-notifications");

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync(
      "spirit-reminders",
      {
        name: "Spirit Health Reminders",
        importance:
          Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        enableVibrate: true,
      }
    );
  }

  const existing =
    await Notifications.getPermissionsAsync();

  if (existing.granted) {
    return { granted: true };
  }

  const requested =
    await Notifications.requestPermissionsAsync();

  return { granted: requested.granted };
}

export async function showReminderNotification(
  reminder: ReminderNotification
) {
  if (Platform.OS === "web") {
    throw new Error(
      "Web Push notifications are not configured yet."
    );
  }

  const Notifications = await import("expo-notifications");

  const permission =
    await requestReminderNotificationPermission();

  if (!permission.granted) {
    throw new Error(
      "Notification permission was not granted."
    );
  }

  await Notifications.scheduleNotificationAsync({
    content: {
      title: reminder.title,
      body: reminder.body,
      data: {
        reminderId: reminder.reminderId || "",
      },
      ...(Platform.OS === "android"
        ? { channelId: "spirit-reminders" }
        : {}),
    },
    trigger: null,
  });
}
