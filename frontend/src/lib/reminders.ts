import { API_URL } from "../constants/api";
import { getSession } from "./session";

export type ReminderType = "medicine" | "appointment";
export type ReminderLanguage = "en" | "te" | "hi" | "ta";

export type Reminder = {
  _id: string;
  familyMemberId: string | null;
  type: ReminderType;
  title: string;
  displayName: string;
  identification: {
    color: string;
    shape: string;
    notes: string;
    photoUrl: string;
  };
  dosage: string;
  dosageConfirmed: boolean;
  instructions: string;
  timezone: string;
  times: string[];
  startDate: string;
  endDate: string;
  appointmentAt: string | null;
  language: ReminderLanguage;
  notificationEnabled: boolean;
  active: boolean;
  createdAt: string;
};

export type ReminderInput = {
  familyMemberId?: string;
  type: ReminderType;
  title: string;
  displayName?: string;
  identification?: {
    color?: string;
    shape?: string;
    notes?: string;
    photoUrl?: string;
  };
  dosage?: string;
  dosageConfirmed?: boolean;
  instructions?: string;
  timezone?: string;
  times?: string[];
  startDate?: string;
  endDate?: string;
  appointmentAt?: string;
  language?: ReminderLanguage;
  notificationEnabled?: boolean;
  active?: boolean;
};

async function reminderRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const session = await getSession();

  if (!session?.token) {
    throw new Error("Session expired. Please log in again.");
  }

  const response = await fetch(`${API_URL}/api/reminders${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${session.token}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.message || "Reminder request failed.");
  }

  return data as T;
}

export async function getReminders(
  familyMemberId = ""
): Promise<Reminder[]> {
  const query = familyMemberId
    ? `?familyMemberId=${encodeURIComponent(familyMemberId)}`
    : "";

  const data = await reminderRequest<{
    success: boolean;
    reminders: Reminder[];
  }>(query);

  return data.reminders;
}

export async function createReminder(
  input: ReminderInput
): Promise<Reminder> {
  const data = await reminderRequest<{
    success: boolean;
    reminder: Reminder;
  }>("/", {
    method: "POST",
    body: JSON.stringify(input),
  });

  return data.reminder;
}

export async function updateReminder(
  id: string,
  updates: Partial<ReminderInput>
): Promise<Reminder> {
  const data = await reminderRequest<{
    success: boolean;
    reminder: Reminder;
  }>(`/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(updates),
  });

  return data.reminder;
}

export async function deleteReminder(
  id: string
): Promise<void> {
  await reminderRequest(`/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}
