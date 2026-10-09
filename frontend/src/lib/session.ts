import AsyncStorage from "@react-native-async-storage/async-storage";

/* "spirit_health_user" is the key the first prototype already used; the login token sits beside it. */
const USER_KEY = "spirit_health_user";
const TOKEN_KEY = "spirit_health_token";

export type SessionUser = {
  id: string;
  fullName: string;
  email: string;
  preferredLanguage?: string;
};

export type Session = { user: SessionUser; token: string };

export async function getSession(): Promise<Session | null> {
  try {
    const [user, token] = await Promise.all([
      AsyncStorage.getItem(USER_KEY),
      AsyncStorage.getItem(TOKEN_KEY),
    ]);
    /* A user saved by the first prototype has no token: treat that as logged out so they sign in again. */
    return user && token ? { user: JSON.parse(user), token } : null;
  } catch {
    return null;
  }
}

export async function saveSession(user: SessionUser, token: string) {
  await Promise.all([
    AsyncStorage.setItem(USER_KEY, JSON.stringify(user)),
    AsyncStorage.setItem(TOKEN_KEY, token),
  ]);
}

export async function clearSession() {
  await Promise.all([AsyncStorage.removeItem(USER_KEY), AsyncStorage.removeItem(TOKEN_KEY)]);
}
