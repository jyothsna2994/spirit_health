import { Platform } from "react-native";
import type { Reminder } from "./reminders";

const CHANNEL = "spirit-health-reminders";
const PREFIX = "spirit-reminder:";

const messageFor = (item: Reminder) =>
  item.type === "medicine"
    ? `Time for your medicine: ${item.displayName || item.title}`
    : `Doctor appointment: ${item.displayName || item.title}`;

function notificationId(item: Reminder, index: number) {
  return `${PREFIX}${item._id}:${index}`;
}

async function nativeNotifications() {
  return import("expo-notifications");
}

export async function syncAndroidReminders(items: Reminder[]) {
  if (Platform.OS !== "android") return;

  const Notifications = await nativeNotifications();

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });

  await Notifications.setNotificationChannelAsync(CHANNEL, {
    name: "Health Reminders",
    importance: Notifications.AndroidImportance.MAX,
    sound: "tik-tik.wav",
    vibrationPattern: [0, 200, 100, 200],
  });

  const permissions = await Notifications.getPermissionsAsync();

  if (!permissions.granted) {
    const requested = await Notifications.requestPermissionsAsync();
    if (!requested.granted) {
      throw new Error("Notification permission was not granted.");
    }
  }

  const scheduled =
    await Notifications.getAllScheduledNotificationsAsync();

  for (const entry of scheduled) {
    if (entry.identifier.startsWith(PREFIX)) {
      await Notifications.cancelScheduledNotificationAsync(
        entry.identifier
      );
    }
  }

  for (const item of items) {
    if (!item.active) continue;

    const content = {
      title:
        item.type === "medicine"
          ? "💊 Medicine Reminder"
          : "📅 Appointment Reminder",
      body: messageFor(item),
      sound: "tik-tik.wav",
      data: { reminderId: item._id },
    };

    if (item.type === "medicine") {
      for (let i = 0; i < item.times.length; i++) {
        const match = /^(\d{2}):(\d{2})$/.exec(item.times[i]);
        if (!match) continue;

        await Notifications.scheduleNotificationAsync({
          identifier: notificationId(item, i),
          content,
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DAILY,
            hour: Number(match[1]),
            minute: Number(match[2]),
            channelId: CHANNEL,
          },
        });
      }
    } else if (item.appointmentAt) {
      const appointment = new Date(item.appointmentAt);

      if (appointment.getTime() > Date.now()) {
        await Notifications.scheduleNotificationAsync({
          identifier: notificationId(item, 0),
          content,
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: appointment,
            channelId: CHANNEL,
          },
        });
      }
    }
  }
}

export function startChromeReminders(items: Reminder[]) {
  if (Platform.OS !== "web") return () => {};

  let lastTriggered = new Set<string>();

  const check = () => {
    const now = new Date();
    const today = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, "0"),
      String(now.getDate()).padStart(2, "0"),
    ].join("-");

    const currentTime = [
      String(now.getHours()).padStart(2, "0"),
      String(now.getMinutes()).padStart(2, "0"),
    ].join(":");

    for (const item of items) {
      if (!item.active) continue;

      const due =
        item.type === "medicine"
          ? item.times.includes(currentTime)
          : !!item.appointmentAt &&
            new Date(item.appointmentAt).getTime() <= now.getTime() &&
            now.getTime() - new Date(item.appointmentAt).getTime() < 60000;

      const key = `${item._id}:${today}:${currentTime}`;

      if (!due || lastTriggered.has(key)) continue;

      lastTriggered.add(key);
      playTikTik();

      if ("Notification" in window &&
          Notification.permission === "granted") {
        try {
          new Notification(
            item.type === "medicine"
              ? "💊 Medicine Reminder"
              : "📅 Appointment Reminder",
            { body: messageFor(item) }
          );
        } catch {
          // Some browsers require a service worker for notifications.
        }
      }
    }

    if (lastTriggered.size > 200) {
      lastTriggered = new Set<string>();
    }
  };

  check();
  const timer = setInterval(check, 1000);

  return () => clearInterval(timer);
}


let chromeAudio: HTMLAudioElement | null = null;

export async function enableChromeSound() {
  if (Platform.OS !== "web") return;

  if (!chromeAudio) {
    chromeAudio = new Audio(
      require("../../assets/sounds/tik-tik.mp3")
    );
    chromeAudio.preload = "auto";
  }

  chromeAudio.pause();
  chromeAudio.currentTime = 0;

  // Play directly from the user's button click.
  await chromeAudio.play();

  if (
    "Notification" in window &&
    Notification.permission === "default"
  ) {
    try {
      await Notification.requestPermission();
    } catch (error) {
      console.warn("Notification permission:", error);
    }
  }
}

export function playTikTik() {
  if (Platform.OS !== "web" || !chromeAudio) return;

  chromeAudio.pause();
  chromeAudio.currentTime = 0;

  void chromeAudio.play().catch((error) => {
    console.warn("Tik Tik sound failed:", error);
  });
}
