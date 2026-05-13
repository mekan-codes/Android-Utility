import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { parseLocalDate } from "@/utils/localDate";

export type ReminderOffsetMinutes = null | 0 | 5 | 10 | 30;
export type BackupReminderIntervalDays = null | 7 | 14 | 30;

export interface NotificationSettings {
  enabled: boolean;
  taskRemindersEnabled: boolean;
  pomodoroNotificationsEnabled: boolean;
  backupReminderIntervalDays: BackupReminderIntervalDays;
  backupReminderNotificationId: string | null;
}

export const NOTIFICATION_SETTINGS_KEY = "@resetflow/notification_settings";

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  enabled: false,
  taskRemindersEnabled: true,
  pomodoroNotificationsEnabled: true,
  backupReminderIntervalDays: null,
  backupReminderNotificationId: null,
};

Notifications.setNotificationHandler({
  handleNotification: async () =>
    ({
      shouldShowAlert: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }) as Notifications.NotificationBehavior,
});

export async function loadNotificationSettings(): Promise<NotificationSettings> {
  try {
    const raw = await AsyncStorage.getItem(NOTIFICATION_SETTINGS_KEY);
    if (!raw) return DEFAULT_NOTIFICATION_SETTINGS;
    return normalizeNotificationSettings(JSON.parse(raw));
  } catch {
    return DEFAULT_NOTIFICATION_SETTINGS;
  }
}

export async function saveNotificationSettings(settings: NotificationSettings): Promise<void> {
  await AsyncStorage.setItem(NOTIFICATION_SETTINGS_KEY, JSON.stringify(settings));
}

export function normalizeNotificationSettings(value: unknown): NotificationSettings {
  const data = typeof value === "object" && value !== null ? (value as Partial<NotificationSettings>) : {};
  const interval = data.backupReminderIntervalDays;
  return {
    enabled: data.enabled === true,
    taskRemindersEnabled: data.taskRemindersEnabled !== false,
    pomodoroNotificationsEnabled: data.pomodoroNotificationsEnabled !== false,
    backupReminderIntervalDays: interval === 7 || interval === 14 || interval === 30 ? interval : null,
    backupReminderNotificationId:
      typeof data.backupReminderNotificationId === "string" ? data.backupReminderNotificationId : null,
  };
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    const requested = await Notifications.requestPermissionsAsync();
    return requested.granted;
  } catch {
    return false;
  }
}

export async function cancelNotification(notificationId?: string | null): Promise<void> {
  if (!notificationId) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  } catch {
    // Notification ids can become stale after restore or OS cleanup.
  }
}

export async function cancelNotifications(ids: Array<string | null | undefined>): Promise<void> {
  await Promise.all(ids.filter(Boolean).map((id) => cancelNotification(id)));
}

function timeStringToMinutes(deadline?: string): number | null {
  if (!deadline) return null;
  const match = deadline.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function dateFromLocalDateAndDeadline(date: string, deadline: string, offset: ReminderOffsetMinutes): Date | null {
  const deadlineMinutes = timeStringToMinutes(deadline);
  if (deadlineMinutes === null) return null;

  const [year, month, day] = date.split("-").map(Number);
  if (!year || !month || !day) return null;

  const adjusted = deadlineMinutes - (offset ?? 0);
  const due = new Date(year, month - 1, day, 0, adjusted, 0, 0);
  if (due.getTime() <= Date.now()) return null;
  return due;
}

export async function scheduleTaskReminder(params: {
  settings: NotificationSettings;
  taskName: string;
  taskDate: string;
  deadline?: string;
  reminderOffsetMinutes?: ReminderOffsetMinutes;
}): Promise<string | null> {
  const { settings, taskName, taskDate, deadline, reminderOffsetMinutes } = params;
  if (!settings.enabled || !settings.taskRemindersEnabled || !deadline || reminderOffsetMinutes === null) {
    return null;
  }

  const hasPermission = await requestNotificationPermission();
  if (!hasPermission) return null;

  const fireAt = dateFromLocalDateAndDeadline(taskDate, deadline, reminderOffsetMinutes ?? 0);
  if (!fireAt) return null;

  const seconds = Math.max(1, Math.round((fireAt.getTime() - Date.now()) / 1000));
  const prefix =
    reminderOffsetMinutes && reminderOffsetMinutes > 0
      ? `${reminderOffsetMinutes} min left`
      : "Task due";

  try {
    return await Notifications.scheduleNotificationAsync({
      content: {
        title: prefix,
        body: taskName,
        sound: false,
      },
      trigger: { seconds } as Notifications.NotificationTriggerInput,
    });
  } catch {
    return null;
  }
}

export async function schedulePomodoroNotification(params: {
  settings: NotificationSettings;
  title: string;
  body: string;
  seconds: number;
}): Promise<string | null> {
  const { settings, title, body, seconds } = params;
  if (!settings.enabled || !settings.pomodoroNotificationsEnabled || seconds <= 0) return null;
  const hasPermission = await requestNotificationPermission();
  if (!hasPermission) return null;
  try {
    return await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: false },
      trigger: { seconds: Math.max(1, Math.round(seconds)) } as Notifications.NotificationTriggerInput,
    });
  } catch {
    return null;
  }
}

export async function rescheduleBackupReminder(
  settings: NotificationSettings,
  lastBackupDate: string | null
): Promise<NotificationSettings> {
  await cancelNotification(settings.backupReminderNotificationId);
  if (!settings.enabled || !settings.backupReminderIntervalDays) {
    return { ...settings, backupReminderNotificationId: null };
  }

  const hasPermission = await requestNotificationPermission();
  if (!hasPermission) return { ...settings, backupReminderNotificationId: null };

  const base = lastBackupDate ? parseLocalDate(lastBackupDate) ?? new Date() : new Date();
  base.setDate(base.getDate() + settings.backupReminderIntervalDays);
  base.setHours(9, 0, 0, 0);
  const seconds = Math.max(60, Math.round((base.getTime() - Date.now()) / 1000));

  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: "Backup reminder",
        body: "Export a ResetFlow backup when you have a minute.",
        sound: false,
      },
      trigger: { seconds } as Notifications.NotificationTriggerInput,
    });

    return { ...settings, backupReminderNotificationId: id };
  } catch {
    return { ...settings, backupReminderNotificationId: null };
  }
}
