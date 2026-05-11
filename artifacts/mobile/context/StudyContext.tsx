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
  LAST_BACKUP: "@resetflow/last_backup_date",
};

export interface Subject {
  id: string;
  name: string;
  color: string;
  dailyGoalMinutes?: number;
  weeklyGoalMinutes?: number;
  createdAt: string;
  archived?: boolean;
}

export interface StudySession {
  id: string;
  subjectId: string;
  subjectName: string;
  durationMinutes: number;
  date: string;
  completedAt: string;
  type: "pomodoro" | "manual";
  note?: string;
}

export interface PomodoroSettings {
  workMinutes: number;
  breakMinutes: number;
  cycles: number;
}

export interface PomodoroState {
  subjectId: string;
  subjectName: string;
  phase: "work" | "break";
  currentCycle: number;
  totalCycles: number;
  totalSeconds: number;
  remainingSeconds: number;
  isRunning: boolean;
}

export type StatFilter = "today" | "7days" | "30days" | "year" | "alltime";

function genId(): string {
  return Date.now().toString() + Math.random().toString(36).substring(2, 9);
}

function getTodayStr(): string {
  return new Date().toISOString().split("T")[0] as string;
}

function getDateDaysAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(0, 0, 0, 0);
  return d;
}

interface StudyContextValue {
  subjects: Subject[];
  sessions: StudySession[];
  settings: PomodoroSettings;
  pomodoro: PomodoroState | null;
  lastSavedSession: StudySession | null;
  lastBackupDate: string | null;
  addSubject: (name: string, color: string, opts?: Partial<Pick<Subject, "dailyGoalMinutes" | "weeklyGoalMinutes">>) => void;
  deleteSubject: (id: string) => void;
  editSubject: (id: string, updates: Partial<Pick<Subject, "name" | "color" | "dailyGoalMinutes" | "weeklyGoalMinutes">>) => void;
  startPomodoro: (subjectId: string, subjectName: string) => void;
  pausePomodoro: () => void;
  resumePomodoro: () => void;
  stopPomodoro: () => void;
  undoLastSession: () => void;
  addManualSession: (subjectId: string, subjectName: string, durationMinutes: number, date: string, note?: string) => void;
  deleteSession: (id: string) => void;
  updateSettings: (s: Partial<PomodoroSettings>) => void;
  getMinutesForDate: (subjectId: string, date: string) => number;
  getTodayMinutes: (subjectId: string) => number;
  getWeekMinutes: (subjectId: string) => number;
  getAllTimeMinutes: (subjectId: string) => number;
  getTodayTotalMinutes: () => number;
  getFilterMinutes: (filter: StatFilter, subjectId?: string) => number;
  getFilterDailyAverage: (filter: StatFilter) => number;
  getBestSubjectForFilter: (filter: StatFilter) => Subject | null;
  getSessionsForFilter: (filter: StatFilter, subjectId?: string) => StudySession[];
  getLast7DaysData: () => { label: string; date: string; minutes: number }[];
  exportStudyData: () => object;
  importStudyData: (data: { subjects?: Subject[]; sessions?: StudySession[]; settings?: PomodoroSettings }) => Promise<void>;
  resetStudyData: () => Promise<void>;
  setLastBackupDate: (date: string) => void;
}

const StudyContext = createContext<StudyContextValue | null>(null);

export function StudyProvider({ children }: { children: React.ReactNode }) {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [settings, setSettings] = useState<PomodoroSettings>({ workMinutes: 25, breakMinutes: 5, cycles: 4 });
  const [pomodoro, setPomodoro] = useState<PomodoroState | null>(null);
  const [lastSavedSession, setLastSavedSession] = useState<StudySession | null>(null);
  const [lastBackupDate, setLastBackupDateState] = useState<string | null>(null);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const elapsedAtPauseRef = useRef<number>(0);

  useEffect(() => {
    (async () => {
      try {
        const [subjectsRaw, sessionsRaw, settingsRaw, lastBackupRaw] = await Promise.all([
          AsyncStorage.getItem(KEYS.SUBJECTS),
          AsyncStorage.getItem(KEYS.SESSIONS),
          AsyncStorage.getItem(KEYS.SETTINGS),
          AsyncStorage.getItem(KEYS.LAST_BACKUP),
        ]);
        if (subjectsRaw) setSubjects(JSON.parse(subjectsRaw));
        if (sessionsRaw) setSessions(JSON.parse(sessionsRaw));
        if (settingsRaw) setSettings({ workMinutes: 25, breakMinutes: 5, cycles: 4, ...JSON.parse(settingsRaw) });
        if (lastBackupRaw) setLastBackupDateState(lastBackupRaw);
      } catch {}
    })();
  }, []);

  useEffect(() => () => { if (intervalRef.current) clearInterval(intervalRef.current); }, []);

  const clearTimer = useCallback(() => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
  }, []);

  const doSaveSession = useCallback((
    subjectId: string, subjectName: string, durationMinutes: number, type: "pomodoro" | "manual", date?: string, note?: string
  ) => {
    if (durationMinutes < 1) return null;
    const session: StudySession = {
      id: genId(), subjectId, subjectName, durationMinutes,
      date: date ?? getTodayStr(), completedAt: new Date().toISOString(), type, note,
    };
    setSessions((prev) => {
      const next = [...prev, session];
      AsyncStorage.setItem(KEYS.SESSIONS, JSON.stringify(next));
      return next;
    });
    setLastSavedSession(session);
    return session;
  }, []);

  const startPomodoro = useCallback((subjectId: string, subjectName: string) => {
    clearTimer();
    startedAtRef.current = Date.now();
    elapsedAtPauseRef.current = 0;
    const totalSeconds = settings.workMinutes * 60;
    const totalCycles = settings.cycles;

    const pom: PomodoroState = {
      subjectId, subjectName, phase: "work",
      currentCycle: 1, totalCycles,
      totalSeconds, remainingSeconds: totalSeconds, isRunning: true,
    };
    setPomodoro(pom);

    const tick = (currentPom: PomodoroState) => {
      intervalRef.current = setInterval(() => {
        const elapsed = elapsedAtPauseRef.current + (Date.now() - (startedAtRef.current ?? Date.now())) / 1000;
        const remaining = Math.max(0, currentPom.totalSeconds - elapsed);

        setPomodoro((prev) => prev ? { ...prev, remainingSeconds: Math.ceil(remaining) } : null);

        if (remaining <= 0) {
          clearTimer();
          if (currentPom.phase === "work") {
            doSaveSession(currentPom.subjectId, currentPom.subjectName, currentPom.totalSeconds / 60, "pomodoro");
            const nextCycle = currentPom.currentCycle + 1;
            if (currentPom.currentCycle < currentPom.totalCycles) {
              // Start break
              startedAtRef.current = Date.now();
              elapsedAtPauseRef.current = 0;
              const breakSeconds = settings.breakMinutes * 60;
              const breakPom: PomodoroState = {
                ...currentPom, phase: "break",
                totalSeconds: breakSeconds, remainingSeconds: breakSeconds, isRunning: true,
              };
              setPomodoro(breakPom);
              tick(breakPom);
            } else {
              setPomodoro(null);
            }
          } else {
            // Break done → start next work cycle
            const workSeconds = settings.workMinutes * 60;
            const nextPom: PomodoroState = {
              ...currentPom, phase: "work",
              currentCycle: currentPom.currentCycle + 1,
              totalSeconds: workSeconds, remainingSeconds: workSeconds, isRunning: true,
            };
            startedAtRef.current = Date.now();
            elapsedAtPauseRef.current = 0;
            setPomodoro(nextPom);
            tick(nextPom);
          }
        }
      }, 500);
    };
    tick(pom);
  }, [settings.workMinutes, settings.breakMinutes, settings.cycles, clearTimer, doSaveSession]);

  const pausePomodoro = useCallback(() => {
    if (startedAtRef.current) {
      elapsedAtPauseRef.current += (Date.now() - startedAtRef.current) / 1000;
      startedAtRef.current = null;
    }
    clearTimer();
    setPomodoro((prev) => prev ? { ...prev, isRunning: false } : null);
  }, [clearTimer]);

  const resumePomodoro = useCallback(() => {
    setPomodoro((prev) => {
      if (!prev) return null;
      const totalSeconds = prev.totalSeconds;
      const elapsedSoFar = elapsedAtPauseRef.current;
      startedAtRef.current = Date.now();
      clearTimer();
      intervalRef.current = setInterval(() => {
        const elapsed = elapsedSoFar + (Date.now() - (startedAtRef.current ?? Date.now())) / 1000;
        const remaining = Math.max(0, totalSeconds - elapsed);
        setPomodoro((p) => p ? { ...p, remainingSeconds: Math.ceil(remaining) } : null);
        if (remaining <= 0) {
          clearTimer();
          setPomodoro((p) => {
            if (p?.phase === "work") doSaveSession(p.subjectId, p.subjectName, totalSeconds / 60, "pomodoro");
            return null;
          });
        }
      }, 500);
      return { ...prev, isRunning: true };
    });
  }, [clearTimer, doSaveSession]);

  const stopPomodoro = useCallback(() => {
    setPomodoro((prev) => {
      if (prev?.phase === "work") {
        const elapsed = elapsedAtPauseRef.current + (startedAtRef.current ? (Date.now() - startedAtRef.current) / 1000 : 0);
        const workedMinutes = Math.floor(elapsed / 60);
        if (workedMinutes >= 1) doSaveSession(prev.subjectId, prev.subjectName, workedMinutes, "manual");
      }
      return null;
    });
    clearTimer();
    startedAtRef.current = null;
    elapsedAtPauseRef.current = 0;
  }, [clearTimer, doSaveSession]);

  const undoLastSession = useCallback(() => {
    if (!lastSavedSession) return;
    setSessions((prev) => {
      const next = prev.filter((s) => s.id !== lastSavedSession.id);
      AsyncStorage.setItem(KEYS.SESSIONS, JSON.stringify(next));
      return next;
    });
    setLastSavedSession(null);
  }, [lastSavedSession]);

  const addManualSession = useCallback((
    subjectId: string, subjectName: string, durationMinutes: number, date: string, note?: string
  ) => {
    doSaveSession(subjectId, subjectName, durationMinutes, "manual", date, note);
  }, [doSaveSession]);

  const deleteSession = useCallback((id: string) => {
    setSessions((prev) => {
      const next = prev.filter((s) => s.id !== id);
      AsyncStorage.setItem(KEYS.SESSIONS, JSON.stringify(next));
      return next;
    });
  }, []);

  const addSubject = useCallback((
    name: string, color: string,
    opts?: Partial<Pick<Subject, "dailyGoalMinutes" | "weeklyGoalMinutes">>
  ) => {
    const subject: Subject = { id: genId(), name, color, createdAt: new Date().toISOString(), ...opts };
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

  const editSubject = useCallback((
    id: string,
    updates: Partial<Pick<Subject, "name" | "color" | "dailyGoalMinutes" | "weeklyGoalMinutes">>
  ) => {
    setSubjects((prev) => {
      const next = prev.map((s) => s.id === id ? { ...s, ...updates } : s);
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

  const setLastBackupDate = useCallback((date: string) => {
    setLastBackupDateState(date);
    AsyncStorage.setItem(KEYS.LAST_BACKUP, date);
  }, []);

  // --- Stats helpers ---

  const getFilterDateRange = (filter: StatFilter): Date | null => {
    if (filter === "today") return getDateDaysAgo(0);
    if (filter === "7days") return getDateDaysAgo(7);
    if (filter === "30days") return getDateDaysAgo(30);
    if (filter === "year") return getDateDaysAgo(365);
    return null; // alltime
  };

  const getSessionsForFilter = useCallback((filter: StatFilter, subjectId?: string): StudySession[] => {
    const since = getFilterDateRange(filter);
    const today = getTodayStr();
    return sessions.filter((s) => {
      if (subjectId && s.subjectId !== subjectId) return false;
      if (filter === "today") return s.date === today;
      if (!since) return true;
      return new Date(s.completedAt) >= since;
    });
  }, [sessions]);

  const getFilterMinutes = useCallback((filter: StatFilter, subjectId?: string): number => {
    return getSessionsForFilter(filter, subjectId).reduce((sum, s) => sum + s.durationMinutes, 0);
  }, [getSessionsForFilter]);

  const getFilterDailyAverage = useCallback((filter: StatFilter): number => {
    const filtered = getSessionsForFilter(filter);
    if (filtered.length === 0) return 0;
    const total = filtered.reduce((sum, s) => sum + s.durationMinutes, 0);
    if (filter === "today") return total;
    const activeDates = new Set(filtered.map((s) => s.date));
    const activeStudyDays = activeDates.size;
    if (activeStudyDays === 0) return 0;
    return Math.round(total / activeStudyDays);
  }, [getSessionsForFilter]);

  const getBestSubjectForFilter = useCallback((filter: StatFilter): Subject | null => {
    if (subjects.length === 0) return null;
    let best: Subject | null = null;
    let bestMins = 0;
    for (const sub of subjects) {
      const mins = getFilterMinutes(filter, sub.id);
      if (mins > bestMins) { bestMins = mins; best = sub; }
    }
    return best;
  }, [subjects, getFilterMinutes]);

  const getMinutesForDate = useCallback((subjectId: string, date: string): number => {
    return sessions
      .filter((s) => s.subjectId === subjectId && s.date === date)
      .reduce((sum, s) => sum + s.durationMinutes, 0);
  }, [sessions]);

  const getTodayMinutes = useCallback((subjectId: string): number => {
    return getMinutesForDate(subjectId, getTodayStr());
  }, [getMinutesForDate]);

  const getWeekMinutes = useCallback((subjectId: string): number => {
    const weekAgo = getDateDaysAgo(7);
    return sessions
      .filter((s) => s.subjectId === subjectId && new Date(s.completedAt) >= weekAgo)
      .reduce((sum, s) => sum + s.durationMinutes, 0);
  }, [sessions]);

  const getAllTimeMinutes = useCallback((subjectId: string): number => {
    return sessions.filter((s) => s.subjectId === subjectId).reduce((sum, s) => sum + s.durationMinutes, 0);
  }, [sessions]);

  const getTodayTotalMinutes = useCallback((): number => {
    const today = getTodayStr();
    return sessions.filter((s) => s.date === today).reduce((sum, s) => sum + s.durationMinutes, 0);
  }, [sessions]);

  const getLast7DaysData = useCallback((): { label: string; date: string; minutes: number }[] => {
    const today = new Date();
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today);
      d.setDate(d.getDate() - (6 - i));
      const dateStr = d.toISOString().split("T")[0] as string;
      const label = i === 6 ? "Today" : d.toLocaleDateString("en-US", { weekday: "short" });
      const minutes = sessions.filter((s) => s.date === dateStr).reduce((sum, s) => sum + s.durationMinutes, 0);
      return { label, date: dateStr, minutes };
    });
  }, [sessions]);

  const exportStudyData = useCallback(() => ({ subjects, sessions, settings }), [subjects, sessions, settings]);

  const importStudyData = useCallback(async (data: {
    subjects?: Subject[]; sessions?: StudySession[]; settings?: PomodoroSettings;
  }) => {
    if (data.subjects) { setSubjects(data.subjects); await AsyncStorage.setItem(KEYS.SUBJECTS, JSON.stringify(data.subjects)); }
    if (data.sessions) { setSessions(data.sessions); await AsyncStorage.setItem(KEYS.SESSIONS, JSON.stringify(data.sessions)); }
    if (data.settings) { setSettings(data.settings); await AsyncStorage.setItem(KEYS.SETTINGS, JSON.stringify(data.settings)); }
  }, []);

  const resetStudyData = useCallback(async () => {
    clearTimer();
    setSubjects([]); setSessions([]); setSettings({ workMinutes: 25, breakMinutes: 5, cycles: 4 });
    setPomodoro(null); setLastSavedSession(null);
    startedAtRef.current = null; elapsedAtPauseRef.current = 0;
    await Promise.all([
      AsyncStorage.removeItem(KEYS.SUBJECTS),
      AsyncStorage.removeItem(KEYS.SESSIONS),
      AsyncStorage.removeItem(KEYS.SETTINGS),
    ]);
  }, [clearTimer]);

  return (
    <StudyContext.Provider value={{
      subjects, sessions, settings, pomodoro, lastSavedSession, lastBackupDate,
      addSubject, deleteSubject, editSubject,
      startPomodoro, pausePomodoro, resumePomodoro, stopPomodoro, undoLastSession,
      addManualSession, deleteSession,
      updateSettings,
      getMinutesForDate, getTodayMinutes, getWeekMinutes, getAllTimeMinutes, getTodayTotalMinutes,
      getFilterMinutes, getFilterDailyAverage, getBestSubjectForFilter, getSessionsForFilter,
      getLast7DaysData,
      exportStudyData, importStudyData, resetStudyData, setLastBackupDate,
    }}>
      {children}
    </StudyContext.Provider>
  );
}

export function useStudy() {
  const ctx = useContext(StudyContext);
  if (!ctx) throw new Error("useStudy must be used within StudyProvider");
  return ctx;
}
