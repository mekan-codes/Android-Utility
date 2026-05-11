import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useState } from "react";

const KEYS = {
  DAILY_TASKS: "@resetflow/daily_tasks",
  RESET_DATE: "@resetflow/daily_reset_date",
  TEMP_TASKS: "@resetflow/temp_tasks",
};

export interface DailyTask {
  id: string;
  name: string;
  deadline?: string;
  category?: string;
  isDone: boolean;
  createdAt: string;
}

export interface TempTask {
  id: string;
  name: string;
  deadline?: string;
  isDone: boolean;
  date: string;
}

export function getTodayStr(): string {
  return new Date().toISOString().split("T")[0] as string;
}

export function getTomorrowStr(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split("T")[0] as string;
}

export function deadlineToMinutes(deadline?: string): number | null {
  if (!deadline) return null;
  const match = deadline.match(/(\d{1,2}):(\d{2})/);
  if (!match) return null;
  return parseInt(match[1] as string, 10) * 60 + parseInt(match[2] as string, 10);
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
    return priority[statusA] - priority[statusB];
  });
}

function genId(): string {
  return Date.now().toString() + Math.random().toString(36).substring(2, 9);
}

interface RoutineContextValue {
  dailyTasks: DailyTask[];
  tempTasks: TempTask[];
  loaded: boolean;
  carryForwardTasks: TempTask[];
  resolveCarryForward: (action: "move" | "delete" | "keep") => void;
  addDailyTask: (name: string, deadline?: string, category?: string) => void;
  toggleDailyTask: (id: string) => void;
  deleteDailyTask: (id: string) => void;
  editDailyTask: (
    id: string,
    updates: Partial<Pick<DailyTask, "name" | "deadline" | "category">>
  ) => void;
  addTempTask: (name: string, deadline?: string) => void;
  toggleTempTask: (id: string) => void;
  deleteTempTask: (id: string) => void;
  editTempTask: (
    id: string,
    updates: Partial<Pick<TempTask, "name" | "deadline">>
  ) => void;
  moveTempToTomorrow: (id: string) => void;
  exportRoutineData: () => object;
  importRoutineData: (data: { dailyTasks?: DailyTask[]; tempTasks?: TempTask[] }) => Promise<void>;
  resetRoutineData: () => Promise<void>;
}

const RoutineContext = createContext<RoutineContextValue | null>(null);

export function RoutineProvider({ children }: { children: React.ReactNode }) {
  const [dailyTasks, setDailyTasks] = useState<DailyTask[]>([]);
  const [allTempTasks, setAllTempTasks] = useState<TempTask[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [carryForwardTasks, setCarryForwardTasks] = useState<TempTask[]>([]);
  const today = getTodayStr();
  const tempTasks = allTempTasks.filter((t) => t.date === today);

  useEffect(() => {
    (async () => {
      try {
        const [dailyRaw, resetDate, tempRaw] = await Promise.all([
          AsyncStorage.getItem(KEYS.DAILY_TASKS),
          AsyncStorage.getItem(KEYS.RESET_DATE),
          AsyncStorage.getItem(KEYS.TEMP_TASKS),
        ]);

        let daily: DailyTask[] = dailyRaw ? JSON.parse(dailyRaw) : [];
        let temp: TempTask[] = tempRaw ? JSON.parse(tempRaw) : [];

        if (resetDate !== today) {
          // New day: reset daily tasks
          daily = daily.map((t) => ({ ...t, isDone: false }));
          await AsyncStorage.setItem(KEYS.DAILY_TASKS, JSON.stringify(daily));
          await AsyncStorage.setItem(KEYS.RESET_DATE, today);

          // Find unfinished temp tasks from previous days
          const unfinishedOld = temp.filter(
            (t) => t.date !== today && !t.isDone
          );

          // Remove all old completed tasks, keep today's and unfinished old
          temp = temp.filter((t) => t.date === today || !t.isDone);

          if (unfinishedOld.length > 0) {
            setCarryForwardTasks(unfinishedOld);
          }
        }

        setDailyTasks(daily);
        setAllTempTasks(temp);
      } catch {
        // ignore
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  const saveDailyTasks = (tasks: DailyTask[]) => {
    AsyncStorage.setItem(KEYS.DAILY_TASKS, JSON.stringify(tasks));
  };

  const saveTempTasks = (tasks: TempTask[]) => {
    AsyncStorage.setItem(KEYS.TEMP_TASKS, JSON.stringify(tasks));
  };

  const resolveCarryForward = (action: "move" | "delete" | "keep") => {
    setAllTempTasks((prev) => {
      let next = prev;
      if (action === "move") {
        // Move unfinished tasks to today
        next = prev.map((t) =>
          carryForwardTasks.find((c) => c.id === t.id)
            ? { ...t, date: today, isDone: false }
            : t
        );
      } else if (action === "delete") {
        // Remove the carry-forward tasks
        const ids = new Set(carryForwardTasks.map((t) => t.id));
        next = prev.filter((t) => !ids.has(t.id));
      }
      // "keep" → do nothing, they stay in their old date (won't show today)
      saveTempTasks(next);
      return next;
    });
    setCarryForwardTasks([]);
  };

  const addDailyTask = (name: string, deadline?: string, category?: string) => {
    const task: DailyTask = {
      id: genId(),
      name,
      deadline,
      category,
      isDone: false,
      createdAt: new Date().toISOString(),
    };
    setDailyTasks((prev) => {
      const next = [...prev, task];
      saveDailyTasks(next);
      return next;
    });
  };

  const toggleDailyTask = (id: string) => {
    setDailyTasks((prev) => {
      const next = prev.map((t) =>
        t.id === id ? { ...t, isDone: !t.isDone } : t
      );
      saveDailyTasks(next);
      return next;
    });
  };

  const deleteDailyTask = (id: string) => {
    setDailyTasks((prev) => {
      const next = prev.filter((t) => t.id !== id);
      saveDailyTasks(next);
      return next;
    });
  };

  const editDailyTask = (
    id: string,
    updates: Partial<Pick<DailyTask, "name" | "deadline" | "category">>
  ) => {
    setDailyTasks((prev) => {
      const next = prev.map((t) => (t.id === id ? { ...t, ...updates } : t));
      saveDailyTasks(next);
      return next;
    });
  };

  const addTempTask = (name: string, deadline?: string) => {
    const task: TempTask = {
      id: genId(),
      name,
      deadline,
      isDone: false,
      date: today,
    };
    setAllTempTasks((prev) => {
      const next = [...prev, task];
      saveTempTasks(next);
      return next;
    });
  };

  const toggleTempTask = (id: string) => {
    setAllTempTasks((prev) => {
      const next = prev.map((t) =>
        t.id === id ? { ...t, isDone: !t.isDone } : t
      );
      saveTempTasks(next);
      return next;
    });
  };

  const deleteTempTask = (id: string) => {
    setAllTempTasks((prev) => {
      const next = prev.filter((t) => t.id !== id);
      saveTempTasks(next);
      return next;
    });
  };

  const editTempTask = (
    id: string,
    updates: Partial<Pick<TempTask, "name" | "deadline">>
  ) => {
    setAllTempTasks((prev) => {
      const next = prev.map((t) => (t.id === id ? { ...t, ...updates } : t));
      saveTempTasks(next);
      return next;
    });
  };

  const moveTempToTomorrow = (id: string) => {
    const tomorrow = getTomorrowStr();
    setAllTempTasks((prev) => {
      const task = prev.find((t) => t.id === id);
      if (!task) return prev;
      const next = prev.map((t) =>
        t.id === id ? { ...t, date: tomorrow, isDone: false } : t
      );
      saveTempTasks(next);
      return next;
    });
  };

  const exportRoutineData = () => ({ dailyTasks, tempTasks: allTempTasks });

  const importRoutineData = async (data: {
    dailyTasks?: DailyTask[];
    tempTasks?: TempTask[];
  }) => {
    if (data.dailyTasks) {
      setDailyTasks(data.dailyTasks);
      await AsyncStorage.setItem(KEYS.DAILY_TASKS, JSON.stringify(data.dailyTasks));
    }
    if (data.tempTasks) {
      setAllTempTasks(data.tempTasks);
      await AsyncStorage.setItem(KEYS.TEMP_TASKS, JSON.stringify(data.tempTasks));
    }
  };

  const resetRoutineData = async () => {
    setDailyTasks([]);
    setAllTempTasks([]);
    setCarryForwardTasks([]);
    await Promise.all([
      AsyncStorage.removeItem(KEYS.DAILY_TASKS),
      AsyncStorage.removeItem(KEYS.TEMP_TASKS),
      AsyncStorage.removeItem(KEYS.RESET_DATE),
    ]);
  };

  return (
    <RoutineContext.Provider
      value={{
        dailyTasks,
        tempTasks,
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
