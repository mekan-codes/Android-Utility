import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

const KEYS = {
  SUBJECTS: "@resetflow/subjects",
  SESSIONS: "@resetflow/study_sessions",
  SETTINGS: "@resetflow/pomodoro_settings",
};

export interface Subject {
  id: string;
  name: string;
  color: string;
  createdAt: string;
}

export interface StudySession {
  id: string;
  subjectId: string;
  subjectName: string;
  durationMinutes: number;
  date: string;
  completedAt: string;
  type: "pomodoro" | "manual";
}

export interface PomodoroSettings {
  workMinutes: number;
  breakMinutes: number;
}

export interface PomodoroState {
  subjectId: string;
  subjectName: string;
  phase: "work" | "break";
  totalSeconds: number;
  remainingSeconds: number;
  isRunning: boolean;
}

function genId(): string {
  return Date.now().toString() + Math.random().toString(36).substring(2, 9);
}

function getTodayStr(): string {
  return new Date().toISOString().split("T")[0] as string;
}

interface StudyContextValue {
  subjects: Subject[];
  sessions: StudySession[];
  settings: PomodoroSettings;
  pomodoro: PomodoroState | null;
  addSubject: (name: string, color: string) => void;
  deleteSubject: (id: string) => void;
  startPomodoro: (subjectId: string, subjectName: string) => void;
  pausePomodoro: () => void;
  resumePomodoro: () => void;
  stopPomodoro: () => void;
  updateSettings: (s: Partial<PomodoroSettings>) => void;
  getTodayMinutes: (subjectId: string) => number;
  getAllTimeMinutes: (subjectId: string) => number;
  getTodayTotalMinutes: () => number;
  getWeekTotalMinutes: () => number;
  exportStudyData: () => object;
  importStudyData: (data: {
    subjects?: Subject[];
    sessions?: StudySession[];
    settings?: PomodoroSettings;
  }) => Promise<void>;
  resetStudyData: () => Promise<void>;
}

const StudyContext = createContext<StudyContextValue | null>(null);

export function StudyProvider({ children }: { children: React.ReactNode }) {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [settings, setSettings] = useState<PomodoroSettings>({
    workMinutes: 25,
    breakMinutes: 5,
  });
  const [pomodoro, setPomodoro] = useState<PomodoroState | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const elapsedAtPauseRef = useRef<number>(0);

  useEffect(() => {
    (async () => {
      try {
        const [subjectsRaw, sessionsRaw, settingsRaw] = await Promise.all([
          AsyncStorage.getItem(KEYS.SUBJECTS),
          AsyncStorage.getItem(KEYS.SESSIONS),
          AsyncStorage.getItem(KEYS.SETTINGS),
        ]);
        if (subjectsRaw) setSubjects(JSON.parse(subjectsRaw));
        if (sessionsRaw) setSessions(JSON.parse(sessionsRaw));
        if (settingsRaw) setSettings(JSON.parse(settingsRaw));
      } catch {}
    })();
  }, []);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const clearTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const saveSession = useCallback(
    (
      subjectId: string,
      subjectName: string,
      durationMinutes: number,
      type: "pomodoro" | "manual"
    ) => {
      if (durationMinutes < 1) return;
      const session: StudySession = {
        id: genId(),
        subjectId,
        subjectName,
        durationMinutes,
        date: getTodayStr(),
        completedAt: new Date().toISOString(),
        type,
      };
      setSessions((prev) => {
        const next = [...prev, session];
        AsyncStorage.setItem(KEYS.SESSIONS, JSON.stringify(next));
        return next;
      });
    },
    []
  );

  const startPomodoro = useCallback(
    (subjectId: string, subjectName: string) => {
      clearTimer();
      startedAtRef.current = Date.now();
      elapsedAtPauseRef.current = 0;
      const totalSeconds = settings.workMinutes * 60;

      const pom: PomodoroState = {
        subjectId,
        subjectName,
        phase: "work",
        totalSeconds,
        remainingSeconds: totalSeconds,
        isRunning: true,
      };
      setPomodoro(pom);

      intervalRef.current = setInterval(() => {
        const elapsed =
          elapsedAtPauseRef.current +
          (Date.now() - (startedAtRef.current ?? Date.now())) / 1000;
        const remaining = Math.max(0, totalSeconds - elapsed);

        setPomodoro((prev) => {
          if (!prev) return null;
          return { ...prev, remainingSeconds: Math.ceil(remaining) };
        });

        if (remaining <= 0) {
          clearTimer();
          saveSession(subjectId, subjectName, totalSeconds / 60, "pomodoro");
          setPomodoro(null);
        }
      }, 500);
    },
    [settings.workMinutes, clearTimer, saveSession]
  );

  const pausePomodoro = useCallback(() => {
    if (startedAtRef.current) {
      elapsedAtPauseRef.current +=
        (Date.now() - startedAtRef.current) / 1000;
      startedAtRef.current = null;
    }
    clearTimer();
    setPomodoro((prev) => (prev ? { ...prev, isRunning: false } : null));
  }, [clearTimer]);

  const resumePomodoro = useCallback(() => {
    setPomodoro((prev) => {
      if (!prev) return null;
      const totalSeconds = prev.totalSeconds;
      const elapsedSoFar = elapsedAtPauseRef.current;

      startedAtRef.current = Date.now();
      clearTimer();

      intervalRef.current = setInterval(() => {
        const elapsed =
          elapsedSoFar +
          (Date.now() - (startedAtRef.current ?? Date.now())) / 1000;
        const remaining = Math.max(0, totalSeconds - elapsed);

        setPomodoro((p) => {
          if (!p) return null;
          return { ...p, remainingSeconds: Math.ceil(remaining) };
        });

        if (remaining <= 0) {
          clearTimer();
          setPomodoro((p) => {
            if (p) saveSession(p.subjectId, p.subjectName, totalSeconds / 60, "pomodoro");
            return null;
          });
        }
      }, 500);

      return { ...prev, isRunning: true };
    });
  }, [clearTimer, saveSession]);

  const stopPomodoro = useCallback(() => {
    setPomodoro((prev) => {
      if (prev) {
        const elapsed =
          elapsedAtPauseRef.current +
          (startedAtRef.current
            ? (Date.now() - startedAtRef.current) / 1000
            : 0);
        const workedMinutes = Math.floor(elapsed / 60);
        if (workedMinutes >= 1) {
          saveSession(prev.subjectId, prev.subjectName, workedMinutes, "manual");
        }
      }
      return null;
    });
    clearTimer();
    startedAtRef.current = null;
    elapsedAtPauseRef.current = 0;
  }, [clearTimer, saveSession]);

  const addSubject = useCallback((name: string, color: string) => {
    const subject: Subject = {
      id: genId(),
      name,
      color,
      createdAt: new Date().toISOString(),
    };
    setSubjects((prev) => {
      const next = [...prev, subject];
      AsyncStorage.setItem(KEYS.SUBJECTS, JSON.stringify(next));
      return next;
    });
  }, []);

  const deleteSubject = useCallback((id: string) => {
    setSubjects((prev) => {
      const next = prev.filter((s) => s.id !== id);
      AsyncStorage.setItem(KEYS.SUBJECTS, JSON.stringify(next));
      return next;
    });
  }, []);

  const updateSettings = useCallback((s: Partial<PomodoroSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...s };
      AsyncStorage.setItem(KEYS.SETTINGS, JSON.stringify(next));
      return next;
    });
  }, []);

  const getTodayMinutes = useCallback(
    (subjectId: string) => {
      const today = getTodayStr();
      return sessions
        .filter((s) => s.subjectId === subjectId && s.date === today)
        .reduce((sum, s) => sum + s.durationMinutes, 0);
    },
    [sessions]
  );

  const getAllTimeMinutes = useCallback(
    (subjectId: string) => {
      return sessions
        .filter((s) => s.subjectId === subjectId)
        .reduce((sum, s) => sum + s.durationMinutes, 0);
    },
    [sessions]
  );

  const getTodayTotalMinutes = useCallback(() => {
    const today = getTodayStr();
    return sessions
      .filter((s) => s.date === today)
      .reduce((sum, s) => sum + s.durationMinutes, 0);
  }, [sessions]);

  const getWeekTotalMinutes = useCallback(() => {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return sessions
      .filter((s) => new Date(s.completedAt) >= weekAgo)
      .reduce((sum, s) => sum + s.durationMinutes, 0);
  }, [sessions]);

  const exportStudyData = useCallback(
    () => ({ subjects, sessions, settings }),
    [subjects, sessions, settings]
  );

  const importStudyData = useCallback(
    async (data: {
      subjects?: Subject[];
      sessions?: StudySession[];
      settings?: PomodoroSettings;
    }) => {
      if (data.subjects) {
        setSubjects(data.subjects);
        await AsyncStorage.setItem(KEYS.SUBJECTS, JSON.stringify(data.subjects));
      }
      if (data.sessions) {
        setSessions(data.sessions);
        await AsyncStorage.setItem(KEYS.SESSIONS, JSON.stringify(data.sessions));
      }
      if (data.settings) {
        setSettings(data.settings);
        await AsyncStorage.setItem(KEYS.SETTINGS, JSON.stringify(data.settings));
      }
    },
    []
  );

  const resetStudyData = useCallback(async () => {
    clearTimer();
    setSubjects([]);
    setSessions([]);
    setSettings({ workMinutes: 25, breakMinutes: 5 });
    setPomodoro(null);
    startedAtRef.current = null;
    elapsedAtPauseRef.current = 0;
    await Promise.all([
      AsyncStorage.removeItem(KEYS.SUBJECTS),
      AsyncStorage.removeItem(KEYS.SESSIONS),
      AsyncStorage.removeItem(KEYS.SETTINGS),
    ]);
  }, [clearTimer]);

  return (
    <StudyContext.Provider
      value={{
        subjects,
        sessions,
        settings,
        pomodoro,
        addSubject,
        deleteSubject,
        startPomodoro,
        pausePomodoro,
        resumePomodoro,
        stopPomodoro,
        updateSettings,
        getTodayMinutes,
        getAllTimeMinutes,
        getTodayTotalMinutes,
        getWeekTotalMinutes,
        exportStudyData,
        importStudyData,
        resetStudyData,
      }}
    >
      {children}
    </StudyContext.Provider>
  );
}

export function useStudy() {
  const ctx = useContext(StudyContext);
  if (!ctx) throw new Error("useStudy must be used within StudyProvider");
  return ctx;
}
