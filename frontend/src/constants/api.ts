import { Platform } from "react-native";
import Constants from "expo-constants";

/*
  Web / iOS simulator -> localhost.
  Android emulator    -> 10.0.2.2.
  Real phone (Expo Go)-> the PC's LAN IP, taken from the Expo dev server host.
  Override with EXPO_PUBLIC_API_URL if the backend runs elsewhere.
*/
const BACKEND_PORT = 5000;

function resolveApiUrl(): string {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }

  if (Platform.OS === "web") {
    return `http://localhost:${BACKEND_PORT}`;
  }

  const hostUri =
    Constants.expoConfig?.hostUri ||
    (Constants as any).expoGoConfig?.debuggerHost;

  const host = hostUri?.split(":")[0];

  if (host) {
    return `http://${host}:${BACKEND_PORT}`;
  }

  return Platform.OS === "android"
    ? `http://10.0.2.2:${BACKEND_PORT}`
    : `http://localhost:${BACKEND_PORT}`;
}

export const API_URL = "https://spirit-health-api-x78j.onrender.com";
