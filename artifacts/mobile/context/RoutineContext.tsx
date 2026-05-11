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

function getTodayStr(): string {
  return new Date().toISOString().split("T")[0] as string;
}

function getTomorrowStr(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split("T")[0] as string;
}

function genId(): string {
  return Date.now().toString() + Math.random().toString(36).substring(2, 9);
}

interface RoutineContextValue {
  dailyTasks: DailyTask[];
  tempTasks: TempTask[];
  loaded: boolean;
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

        if (resetDate !== today) {
          daily = daily.map((t) => ({ ...t, isDone: false }));
          await AsyncStorage.setItem(KEYS.DAILY_TASKS, JSON.stringify(daily));
          await AsyncStorage.setItem(KEYS.RESET_DATE, today);
        }

        const temp: TempTask[] = tempRaw ? JSON.parse(tempRaw) : [];
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

  const moveTempToTomorrow = (id: string) => {
    const tomorrow = getTomorrowStr();
    setAllTempTasks((prev) => {
      const task = prev.find((t) => t.id === id);
      if (!task) return prev;
      const removed = prev.filter((t) => t.id !== id);
      const newTask: TempTask = { ...task, id: genId(), date: tomorrow, isDone: false };
      const next = [...removed, newTask];
      saveTempTasks(next);
      return next;
    });
  };

  const exportRoutineData = () => ({ dailyTasks, tempTasks: allTempTasks });

  const importRoutineData = async (data: { dailyTasks?: DailyTask[]; tempTasks?: TempTask[] }) => {
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
        addDailyTask,
        toggleDailyTask,
        deleteDailyTask,
        editDailyTask,
        addTempTask,
        toggleTempTask,
        deleteTempTask,
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
