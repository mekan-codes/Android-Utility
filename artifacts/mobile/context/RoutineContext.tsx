import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { AppState } from "react-native";
import {
  ReminderOffsetMinutes,
  cancelNotification,
  cancelNotifications,
  loadNotificationSettings,
  scheduleTaskReminder,
} from "@/utils/notifications";
import { formatLocalDate } from "@/utils/localDate";

const KEYS = {
  DAILY_TASKS: "@resetflow/daily_tasks",
  RESET_DATE: "@resetflow/daily_reset_date",
  TEMP_TASKS: "@resetflow/temp_tasks",
};

export interface DailyTask {
  id: string;
  name: string;
  deadline?: string;
  reminderOffsetMinutes?: ReminderOffsetMinutes;
  notificationId?: string | null;
  category?: string;
  isDone: boolean;
  createdAt: string;
  completedAt?: string | null;
}

export interface TempTask {
  id: string;
  name: string;
  deadline?: string;
  reminderOffsetMinutes?: ReminderOffsetMinutes;
  notificationId?: string | null;
  isDone: boolean;
  date: string;
  createdAt: string;
  completedAt?: string | null;
}

export function getTodayStr(): string {
  return formatLocalDate(new Date());
}

export function getTomorrowStr(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return formatLocalDate(d);
}

function getNextDailyResetDelayMs(now = new Date()): number {
  const nextReset = new Date(now);
  nextReset.setDate(nextReset.getDate() + 1);
  nextReset.setHours(0, 0, 1, 0);
  return Math.max(1000, nextReset.getTime() - now.getTime());
}

export function deadlineToMinutes(deadline?: string): number | null {
  if (!deadline) return null;
  const match = deadline.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hours = parseInt(match[1] as string, 10);
  const minutes = parseInt(match[2] as string, 10);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

export function isValidDeadline(deadline?: string): boolean {
  if (!deadline) return true;
  return deadlineToMinutes(deadline) !== null;
}

export type DeadlineStatus = "normal" | "due_soon" | "overdue";

export function getDeadlineStatus(deadline?: string, isDone?: boolean): DeadlineStatus {
  if (!deadline || isDone) return "normal";
  const dl = deadlineToMinutes(deadline);
  if (dl === null) return "normal";
  const now = new Date();
  const nowMins = now.getHours() * 60 + now.getMinutes();
  if (nowMins > dl) return "overdue";
  if (dl - nowMins <= 60) return "due_soon";
  return "normal";
}

export function sortTasks<T extends { isDone: boolean; deadline?: string }>(tasks: T[]): T[] {
  return [...tasks].sort((a, b) => {
    if (a.isDone !== b.isDone) return a.isDone ? 1 : -1;
    const statusA = getDeadlineStatus(a.deadline, a.isDone);
    const statusB = getDeadlineStatus(b.deadline, b.isDone);
    const priority = { overdue: 0, due_soon: 1, normal: 2 } as const;
    if (priority[statusA] !== priority[statusB]) return priority[statusA] - priority[statusB];
    const aDeadline = deadlineToMinutes(a.deadline) ?? Number.MAX_SAFE_INTEGER;
    const bDeadline = deadlineToMinutes(b.deadline) ?? Number.MAX_SAFE_INTEGER;
    return aDeadline - bDeadline;
  });
}

function genId(): string {
  return `${Date.now()}${Math.random().toString(36).slice(2, 9)}`;
}

function normalizeReminder(value: unknown): ReminderOffsetMinutes {
  return value === 0 || value === 5 || value === 10 || value === 30 ? value : null;
}

function normalizeDailyTask(value: unknown): DailyTask | null {
  const t = value as Partial<DailyTask> | null;
  if (!t || typeof t !== "object" || typeof t.id !== "string" || typeof t.name !== "string") return null;
  return {
    id: t.id,
    name: t.name,
    deadline: typeof t.deadline === "string" && isValidDeadline(t.deadline) ? t.deadline : undefined,
    reminderOffsetMinutes: normalizeReminder(t.reminderOffsetMinutes),
    notificationId: typeof t.notificationId === "string" ? t.notificationId : null,
    category: typeof t.category === "string" ? t.category : undefined,
    isDone: t.isDone === true,
    createdAt: typeof t.createdAt === "string" ? t.createdAt : new Date().toISOString(),
    completedAt: typeof t.completedAt === "string" ? t.completedAt : null,
  };
}

function normalizeTempTask(value: unknown): TempTask | null {
  const t = value as Partial<TempTask> | null;
  if (!t || typeof t !== "object" || typeof t.id !== "string" || typeof t.name !== "string") return null;
  return {
    id: t.id,
    name: t.name,
    deadline: typeof t.deadline === "string" && isValidDeadline(t.deadline) ? t.deadline : undefined,
    reminderOffsetMinutes: normalizeReminder(t.reminderOffsetMinutes),
    notificationId: typeof t.notificationId === "string" ? t.notificationId : null,
    isDone: t.isDone === true,
    date: typeof t.date === "string" ? t.date : getTodayStr(),
    createdAt: typeof t.createdAt === "string" ? t.createdAt : new Date().toISOString(),
    completedAt: typeof t.completedAt === "string" ? t.completedAt : null,
  };
}

async function persistDaily(tasks: DailyTask[]) {
  await AsyncStorage.setItem(KEYS.DAILY_TASKS, JSON.stringify(tasks));
}

async function persistTemp(tasks: TempTask[]) {
  await AsyncStorage.setItem(KEYS.TEMP_TASKS, JSON.stringify(tasks));
}

interface RoutineContextValue {
  dailyTasks: DailyTask[];
  tempTasks: TempTask[];
  allTempTasks: TempTask[];
  loaded: boolean;
  carryForwardTasks: TempTask[];
  resolveCarryForward: (action: "move" | "delete" | "keep", ids?: string[]) => void;
  addDailyTask: (name: string, deadline?: string, reminderOffsetMinutes?: ReminderOffsetMinutes, category?: string) => void;
  toggleDailyTask: (id: string) => void;
  deleteDailyTask: (id: string) => void;
  editDailyTask: (
    id: string,
    updates: Partial<Pick<DailyTask, "name" | "deadline" | "reminderOffsetMinutes" | "category">>
  ) => void;
  addTempTask: (name: string, deadline?: string, reminderOffsetMinutes?: ReminderOffsetMinutes) => void;
  toggleTempTask: (id: string) => void;
  deleteTempTask: (id: string) => void;
  editTempTask: (
    id: string,
    updates: Partial<Pick<TempTask, "name" | "deadline" | "reminderOffsetMinutes">>
  ) => void;
  moveTempToTomorrow: (id: string) => void;
  rescheduleTaskNotifications: () => Promise<void>;
  exportRoutineData: () => object;
  importRoutineData: (data: { dailyTasks?: unknown[]; tempTasks?: unknown[] }) => Promise<void>;
  resetRoutineData: () => Promise<void>;
}

const RoutineContext = createContext<RoutineContextValue | null>(null);

export function RoutineProvider({ children }: { children: React.ReactNode }) {
  const [dailyTasks, setDailyTasks] = useState<DailyTask[]>([]);
  const [allTempTasks, setAllTempTasks] = useState<TempTask[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [currentDate, setCurrentDate] = useState(getTodayStr());
  const [carryForwardTasks, setCarryForwardTasks] = useState<TempTask[]>([]);

  const tempTasks = useMemo(
    () => allTempTasks.filter((t) => t.date === currentDate),
    [allTempTasks, currentDate]
  );

  const scheduleForTask = useCallback(async (task: DailyTask | TempTask, date: string) => {
    const settings = await loadNotificationSettings();
    if (task.notificationId) await cancelNotification(task.notificationId);
    if (task.isDone || !task.deadline) return null;
    return scheduleTaskReminder({
      settings,
      taskName: task.name,
      taskDate: date,
      deadline: task.deadline,
      reminderOffsetMinutes: task.reminderOffsetMinutes ?? null,
    });
  }, []);

  const runDailyReset = useCallback(async () => {
    const today = getTodayStr();
    setCurrentDate(today);

    const [dailyRaw, resetDate, tempRaw] = await Promise.all([
      AsyncStorage.getItem(KEYS.DAILY_TASKS),
      AsyncStorage.getItem(KEYS.RESET_DATE),
      AsyncStorage.getItem(KEYS.TEMP_TASKS),
    ]);

    let daily = dailyRaw ? (JSON.parse(dailyRaw) as unknown[]).map(normalizeDailyTask).filter(Boolean) as DailyTask[] : [];
    let temp = tempRaw ? (JSON.parse(tempRaw) as unknown[]).map(normalizeTempTask).filter(Boolean) as TempTask[] : [];

    if (resetDate !== today) {
      const completedOld = temp.filter((t) => t.date !== today && t.isDone);
      const unfinishedOld = temp.filter((t) => t.date !== today && !t.isDone);

      await cancelNotifications([
        ...daily.map((t) => t.notificationId),
        ...completedOld.map((t) => t.notificationId),
      ]);

      daily = daily.map((t) => ({
        ...t,
        isDone: false,
        completedAt: null,
        notificationId: null,
      }));

      temp = temp
        .filter((t) => t.date === today || !t.isDone)
        .map((t) => (t.date === today ? t : { ...t, notificationId: null }));

      const rescheduledDaily = await Promise.all(
        daily.map(async (task) => ({ ...task, notificationId: await scheduleForTask(task, today) }))
      );
      daily = rescheduledDaily;

      await Promise.all([
        persistDaily(daily),
        persistTemp(temp),
        AsyncStorage.setItem(KEYS.RESET_DATE, today),
      ]);

      setCarryForwardTasks(unfinishedOld);
    }

    setDailyTasks(daily);
    setAllTempTasks(temp);
  }, [scheduleForTask]);

  useEffect(() => {
    runDailyReset().catch(() => {}).finally(() => setLoaded(true));
  }, [runDailyReset]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") runDailyReset().catch(() => {});
    });
    return () => subscription.remove();
  }, [runDailyReset]);

  useEffect(() => {
    let cancelled = false;
    let timeout: ReturnType<typeof setTimeout> | null = null;

    const scheduleNextReset = () => {
      timeout = setTimeout(() => {
        runDailyReset().catch(() => {}).finally(() => {
          if (!cancelled) scheduleNextReset();
        });
      }, getNextDailyResetDelayMs());
    };

    scheduleNextReset();

    return () => {
      cancelled = true;
      if (timeout) clearTimeout(timeout);
    };
  }, [runDailyReset]);

  const updateDaily = useCallback((updater: (prev: DailyTask[]) => DailyTask[]) => {
    setDailyTasks((prev) => {
      const next = updater(prev);
      persistDaily(next).catch(() => {});
      return next;
    });
  }, []);

  const updateTemp = useCallback((updater: (prev: TempTask[]) => TempTask[]) => {
    setAllTempTasks((prev) => {
      const next = updater(prev);
      persistTemp(next).catch(() => {});
      return next;
    });
  }, []);

  const resolveCarryForward = useCallback((action: "move" | "delete" | "keep", ids?: string[]) => {
    const chosenIds = new Set(ids ?? carryForwardTasks.map((t) => t.id));
    if (chosenIds.size === 0) return;

    updateTemp((prev) => {
      let next = prev;
      if (action === "move") {
        next = prev.map((t) =>
          chosenIds.has(t.id)
            ? { ...t, date: currentDate, isDone: false, completedAt: null, notificationId: null }
            : t
        );
        next
          .filter((t) => chosenIds.has(t.id))
          .forEach((task) => {
            scheduleForTask(task, currentDate).then((notificationId) => {
              if (!notificationId) return;
              setAllTempTasks((latest) => {
                const patched = latest.map((item) => item.id === task.id ? { ...item, notificationId } : item);
                persistTemp(patched).catch(() => {});
                return patched;
              });
            });
          });
      } else if (action === "delete") {
        const toDelete = prev.filter((t) => chosenIds.has(t.id));
        cancelNotifications(toDelete.map((t) => t.notificationId)).catch(() => {});
        next = prev.filter((t) => !chosenIds.has(t.id));
      }
      return next;
    });

    setCarryForwardTasks((prev) => prev.filter((t) => !chosenIds.has(t.id)));
  }, [carryForwardTasks, currentDate, scheduleForTask, updateTemp]);

  const addDailyTask = useCallback((
    name: string,
    deadline?: string,
    reminderOffsetMinutes?: ReminderOffsetMinutes,
    category?: string
  ) => {
    const task: DailyTask = {
      id: genId(),
      name,
      deadline: isValidDeadline(deadline) ? deadline : undefined,
      reminderOffsetMinutes: normalizeReminder(reminderOffsetMinutes),
      notificationId: null,
      category,
      isDone: false,
      createdAt: new Date().toISOString(),
      completedAt: null,
    };
    updateDaily((prev) => [...prev, task]);
    scheduleForTask(task, currentDate).then((notificationId) => {
      if (!notificationId) return;
      updateDaily((prev) => prev.map((t) => t.id === task.id ? { ...t, notificationId } : t));
    });
  }, [currentDate, scheduleForTask, updateDaily]);

  const toggleDailyTask = useCallback((id: string) => {
    let changed: DailyTask | undefined;
    updateDaily((prev) => prev.map((t) => {
      if (t.id !== id) return t;
      const isDone = !t.isDone;
      changed = { ...t, isDone, completedAt: isDone ? new Date().toISOString() : null };
      if (isDone) {
        cancelNotification(t.notificationId).catch(() => {});
        changed.notificationId = null;
      }
      return changed;
    }));
    setTimeout(() => {
      if (changed && !changed.isDone) {
        scheduleForTask(changed, currentDate).then((notificationId) => {
          if (notificationId) updateDaily((prev) => prev.map((t) => t.id === id ? { ...t, notificationId } : t));
        });
      }
    }, 0);
  }, [currentDate, scheduleForTask, updateDaily]);

  const deleteDailyTask = useCallback((id: string) => {
    updateDaily((prev) => {
      const task = prev.find((t) => t.id === id);
      cancelNotification(task?.notificationId).catch(() => {});
      return prev.filter((t) => t.id !== id);
    });
  }, [updateDaily]);

  const editDailyTask = useCallback((
    id: string,
    updates: Partial<Pick<DailyTask, "name" | "deadline" | "reminderOffsetMinutes" | "category">>
  ) => {
    let edited: DailyTask | undefined;
    updateDaily((prev) => prev.map((t) => {
      if (t.id !== id) return t;
      cancelNotification(t.notificationId).catch(() => {});
      edited = {
        ...t,
        ...updates,
        deadline:
          "deadline" in updates
            ? isValidDeadline(updates.deadline) ? updates.deadline : undefined
            : t.deadline,
        reminderOffsetMinutes:
          "reminderOffsetMinutes" in updates
            ? normalizeReminder(updates.reminderOffsetMinutes)
            : t.reminderOffsetMinutes,
        notificationId: null,
      };
      return edited;
    }));
    setTimeout(() => {
      if (edited) {
        scheduleForTask(edited, currentDate).then((notificationId) => {
          if (notificationId) updateDaily((prev) => prev.map((t) => t.id === id ? { ...t, notificationId } : t));
        });
      }
    }, 0);
  }, [currentDate, scheduleForTask, updateDaily]);

  const addTempTask = useCallback((name: string, deadline?: string, reminderOffsetMinutes?: ReminderOffsetMinutes) => {
    const task: TempTask = {
      id: genId(),
      name,
      deadline: isValidDeadline(deadline) ? deadline : undefined,
      reminderOffsetMinutes: normalizeReminder(reminderOffsetMinutes),
      notificationId: null,
      isDone: false,
      date: currentDate,
      createdAt: new Date().toISOString(),
      completedAt: null,
    };
    updateTemp((prev) => [...prev, task]);
    scheduleForTask(task, currentDate).then((notificationId) => {
      if (!notificationId) return;
      updateTemp((prev) => prev.map((t) => t.id === task.id ? { ...t, notificationId } : t));
    });
  }, [currentDate, scheduleForTask, updateTemp]);

  const toggleTempTask = useCallback((id: string) => {
    let changed: TempTask | undefined;
    updateTemp((prev) => prev.map((t) => {
      if (t.id !== id) return t;
      const isDone = !t.isDone;
      changed = { ...t, isDone, completedAt: isDone ? new Date().toISOString() : null };
      if (isDone) {
        cancelNotification(t.notificationId).catch(() => {});
        changed.notificationId = null;
      }
      return changed;
    }));
    setTimeout(() => {
      if (changed && !changed.isDone) {
        scheduleForTask(changed, changed.date).then((notificationId) => {
          if (notificationId) updateTemp((prev) => prev.map((t) => t.id === id ? { ...t, notificationId } : t));
        });
      }
    }, 0);
  }, [scheduleForTask, updateTemp]);

  const deleteTempTask = useCallback((id: string) => {
    updateTemp((prev) => {
      const task = prev.find((t) => t.id === id);
      cancelNotification(task?.notificationId).catch(() => {});
      return prev.filter((t) => t.id !== id);
    });
  }, [updateTemp]);

  const editTempTask = useCallback((
    id: string,
    updates: Partial<Pick<TempTask, "name" | "deadline" | "reminderOffsetMinutes">>
  ) => {
    let edited: TempTask | undefined;
    updateTemp((prev) => prev.map((t) => {
      if (t.id !== id) return t;
      cancelNotification(t.notificationId).catch(() => {});
      edited = {
        ...t,
        ...updates,
        deadline:
          "deadline" in updates
            ? isValidDeadline(updates.deadline) ? updates.deadline : undefined
            : t.deadline,
        reminderOffsetMinutes:
          "reminderOffsetMinutes" in updates
            ? normalizeReminder(updates.reminderOffsetMinutes)
            : t.reminderOffsetMinutes,
        notificationId: null,
      };
      return edited;
    }));
    setTimeout(() => {
      if (edited) {
        scheduleForTask(edited, edited.date).then((notificationId) => {
          if (notificationId) updateTemp((prev) => prev.map((t) => t.id === id ? { ...t, notificationId } : t));
        });
      }
    }, 0);
  }, [scheduleForTask, updateTemp]);

  const moveTempToTomorrow = useCallback((id: string) => {
    const tomorrow = getTomorrowStr();
    let moved: TempTask | undefined;
    updateTemp((prev) => prev.map((t) => {
      if (t.id !== id) return t;
      cancelNotification(t.notificationId).catch(() => {});
      moved = { ...t, date: tomorrow, isDone: false, completedAt: null, notificationId: null };
      return moved;
    }));
    setTimeout(() => {
      if (!moved) return;
      scheduleForTask(moved, tomorrow).then((notificationId) => {
        if (notificationId) updateTemp((prev) => prev.map((t) => t.id === id ? { ...t, notificationId } : t));
      });
    }, 0);
  }, [scheduleForTask, updateTemp]);

  const rescheduleTaskNotifications = useCallback(async () => {
    const settings = await loadNotificationSettings();
    const nextDaily = await Promise.all(dailyTasks.map(async (task) => {
      await cancelNotification(task.notificationId);
      if (!settings.enabled || task.isDone) return { ...task, notificationId: null };
      return { ...task, notificationId: await scheduleTaskReminder({
        settings,
        taskName: task.name,
        taskDate: currentDate,
        deadline: task.deadline,
        reminderOffsetMinutes: task.reminderOffsetMinutes ?? null,
      }) };
    }));
    const nextTemp = await Promise.all(allTempTasks.map(async (task) => {
      await cancelNotification(task.notificationId);
      if (!settings.enabled || task.isDone || task.date !== currentDate) return { ...task, notificationId: null };
      return { ...task, notificationId: await scheduleTaskReminder({
        settings,
        taskName: task.name,
        taskDate: task.date,
        deadline: task.deadline,
        reminderOffsetMinutes: task.reminderOffsetMinutes ?? null,
      }) };
    }));

    setDailyTasks(nextDaily);
    setAllTempTasks(nextTemp);
    await Promise.all([persistDaily(nextDaily), persistTemp(nextTemp)]);
  }, [allTempTasks, currentDate, dailyTasks]);

  const exportRoutineData = useCallback(() => ({ dailyTasks, tempTasks: allTempTasks }), [dailyTasks, allTempTasks]);

  const importRoutineData = useCallback(async (data: { dailyTasks?: unknown[]; tempTasks?: unknown[] }) => {
    const importedDaily = Array.isArray(data.dailyTasks)
      ? data.dailyTasks.map(normalizeDailyTask).filter(Boolean) as DailyTask[]
      : [];
    const importedTemp = Array.isArray(data.tempTasks)
      ? data.tempTasks.map(normalizeTempTask).filter(Boolean) as TempTask[]
      : [];
    const today = getTodayStr();

    await cancelNotifications([
      ...dailyTasks.map((t) => t.notificationId),
      ...allTempTasks.map((t) => t.notificationId),
    ]);

    const dailyWithoutNotifications = importedDaily.map((t) => ({ ...t, notificationId: null }));
    const tempWithoutNotifications = importedTemp.map((t) => ({ ...t, notificationId: null }));
    const scheduledDaily = await Promise.all(
      dailyWithoutNotifications.map(async (task) => ({
        ...task,
        notificationId: await scheduleForTask(task, today),
      }))
    );
    const scheduledTemp = await Promise.all(
      tempWithoutNotifications.map(async (task) => ({
        ...task,
        notificationId: task.date === today ? await scheduleForTask(task, task.date) : null,
      }))
    );

    setCurrentDate(today);
    setDailyTasks(scheduledDaily);
    setAllTempTasks(scheduledTemp);
    setCarryForwardTasks([]);
    await Promise.all([
      persistDaily(scheduledDaily),
      persistTemp(scheduledTemp),
      AsyncStorage.setItem(KEYS.RESET_DATE, today),
    ]);
  }, [allTempTasks, dailyTasks, scheduleForTask]);

  const resetRoutineData = useCallback(async () => {
    await cancelNotifications([
      ...dailyTasks.map((t) => t.notificationId),
      ...allTempTasks.map((t) => t.notificationId),
    ]);
    setDailyTasks([]);
    setAllTempTasks([]);
    setCarryForwardTasks([]);
    await Promise.all([
      AsyncStorage.removeItem(KEYS.DAILY_TASKS),
      AsyncStorage.removeItem(KEYS.TEMP_TASKS),
      AsyncStorage.removeItem(KEYS.RESET_DATE),
    ]);
  }, [allTempTasks, dailyTasks]);

  return (
    <RoutineContext.Provider
      value={{
        dailyTasks,
        tempTasks,
        allTempTasks,
        loaded,
        carryForwardTasks,
        resolveCarryForward,
        addDailyTask,
        toggleDailyTask,
        deleteDailyTask,
        editDailyTask,
        addTempTask,
        toggleTempTask,
        deleteTempTask,
        editTempTask,
        moveTempToTomorrow,
        rescheduleTaskNotifications,
        exportRoutineData,
        importRoutineData,
        resetRoutineData,
      }}
    >
      {children}
    </RoutineContext.Provider>
  );
}

export function useRoutine() {
  const ctx = useContext(RoutineContext);
  if (!ctx) throw new Error("useRoutine must be used within RoutineProvider");
  return ctx;
}
