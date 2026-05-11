import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AppState } from "react-native";
import {
  DEFAULT_NOTIFICATION_SETTINGS,
  NotificationSettings,
  cancelNotifications,
  loadNotificationSettings,
  normalizeNotificationSettings,
  rescheduleBackupReminder,
  saveNotificationSettings,
  schedulePomodoroNotification,
} from "@/utils/notifications";

const KEYS = {
  SUBJECTS: "@resetflow/subjects",
  SESSIONS: "@resetflow/study_sessions",
  SETTINGS: "@resetflow/pomodoro_settings",
  POMODORO: "@resetflow/active_pomodoro",
  LAST_BACKUP: "@resetflow/last_backup_date",
};

export interface Subject {
  id: string;
  name: string;
  color: string;
  archived: boolean;
  dailyGoalMinutes?: number;
  weeklyGoalMinutes?: number;
  createdAt: string;
}

export interface StudySession {
  id: string;
  subjectId: string;
  subjectName: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  studiedMinutes: number;
  date: string;
  source: "pomodoro" | "manual";
  type: "pomodoro" | "manual";
  completedPomodoroCycleCount?: number;
  note?: string;
  createdAt: string;
  completedAt: string;
}

export interface PomodoroSettings {
  workMinutes: number;
  breakMinutes: number;
  cycles: number;
}

export interface PomodoroState {
  id: string;
  subjectId: string;
  subjectName: string;
  phase: "work" | "break";
  currentCycle: number;
  totalCycles: number;
  workMinutes: number;
  breakMinutes: number;
  phaseStartedAt: string | null;
  pausedRemainingSeconds: number | null;
  remainingSeconds: number;
  isRunning: boolean;
  notificationIds: string[];
}

export type StatFilter = "today" | "7days" | "30days" | "year" | "alltime";

export interface ChartPoint {
  label: string;
  date: string;
  minutes: number;
}

function genId(): string {
  return `${Date.now()}${Math.random().toString(36).slice(2, 9)}`;
}

function getTodayStr(): string {
  return new Date().toISOString().split("T")[0] as string;
}

function dateToStr(date: Date): string {
  return date.toISOString().split("T")[0] as string;
}

function getDateDaysAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(0, 0, 0, 0);
  return d;
}

function minutesToSeconds(minutes: number): number {
  return Math.max(1, Math.round(minutes * 60));
}

function phaseDurationSeconds(state: PomodoroState): number {
  return minutesToSeconds(state.phase === "work" ? state.workMinutes : state.breakMinutes);
}

function remainingForState(state: PomodoroState, now = Date.now()): number {
  if (!state.isRunning || !state.phaseStartedAt) {
    return Math.max(0, state.pausedRemainingSeconds ?? state.remainingSeconds);
  }
  const elapsed = Math.floor((now - new Date(state.phaseStartedAt).getTime()) / 1000);
  return Math.max(0, phaseDurationSeconds(state) - elapsed);
}

function getFilterStart(filter: StatFilter): string | null {
  if (filter === "today") return getTodayStr();
  if (filter === "7days") return dateToStr(getDateDaysAgo(6));
  if (filter === "30days") return dateToStr(getDateDaysAgo(29));
  if (filter === "year") return dateToStr(getDateDaysAgo(364));
  return null;
}

function normalizeSubject(value: unknown): Subject | null {
  const s = value as Partial<Subject> | null;
  if (!s || typeof s !== "object" || typeof s.id !== "string" || typeof s.name !== "string") return null;
  return {
    id: s.id,
    name: s.name,
    color: typeof s.color === "string" ? s.color : "#6366F1",
    archived: s.archived === true,
    dailyGoalMinutes: typeof s.dailyGoalMinutes === "number" ? s.dailyGoalMinutes : undefined,
    weeklyGoalMinutes: typeof s.weeklyGoalMinutes === "number" ? s.weeklyGoalMinutes : undefined,
    createdAt: typeof s.createdAt === "string" ? s.createdAt : new Date().toISOString(),
  };
}

function normalizeSession(value: unknown): StudySession | null {
  const s = value as Partial<StudySession> & { type?: "pomodoro" | "manual" } | null;
  if (!s || typeof s !== "object" || typeof s.id !== "string" || typeof s.subjectId !== "string") return null;
  const source = s.source === "manual" || s.type === "manual" ? "manual" : "pomodoro";
  const duration = typeof s.durationMinutes === "number"
    ? s.durationMinutes
    : typeof s.studiedMinutes === "number"
    ? s.studiedMinutes
    : 0;
  if (duration < 1) return null;
  const completedAt = typeof s.completedAt === "string" ? s.completedAt : new Date().toISOString();
  return {
    id: s.id,
    subjectId: s.subjectId,
    subjectName: typeof s.subjectName === "string" ? s.subjectName : "Subject",
    startTime: typeof s.startTime === "string" ? s.startTime : completedAt,
    endTime: typeof s.endTime === "string" ? s.endTime : completedAt,
    durationMinutes: Math.round(duration),
    studiedMinutes: Math.round(duration),
    date: typeof s.date === "string" ? s.date : completedAt.split("T")[0] as string,
    source,
    type: source,
    completedPomodoroCycleCount:
      typeof s.completedPomodoroCycleCount === "number" ? s.completedPomodoroCycleCount : undefined,
    note: typeof s.note === "string" ? s.note : undefined,
    createdAt: typeof s.createdAt === "string" ? s.createdAt : completedAt,
    completedAt,
  };
}

function normalizeSettings(value: unknown): PomodoroSettings {
  const s = typeof value === "object" && value !== null ? value as Partial<PomodoroSettings> : {};
  const workMinutes = typeof s.workMinutes === "number" && s.workMinutes >= 1 && s.workMinutes <= 120 ? s.workMinutes : 25;
  const breakMinutes = typeof s.breakMinutes === "number" && s.breakMinutes >= 1 && s.breakMinutes <= 60 ? s.breakMinutes : 5;
  const cycles = typeof s.cycles === "number" && s.cycles >= 1 && s.cycles <= 10 ? s.cycles : 4;
  return { workMinutes, breakMinutes, cycles };
}

interface StudyContextValue {
  subjects: Subject[];
  activeSubjects: Subject[];
  sessions: StudySession[];
  settings: PomodoroSettings;
  notificationSettings: NotificationSettings;
  pomodoro: PomodoroState | null;
  lastSavedSession: StudySession | null;
  lastBackupDate: string | null;
  addSubject: (name: string, color: string, opts?: Partial<Pick<Subject, "dailyGoalMinutes" | "weeklyGoalMinutes">>) => void;
  deleteSubject: (id: string) => void;
  archiveSubject: (id: string) => void;
  editSubject: (id: string, updates: Partial<Pick<Subject, "name" | "color" | "dailyGoalMinutes" | "weeklyGoalMinutes" | "archived">>) => void;
  startPomodoro: (subjectId: string, subjectName: string, workMinutesOverride?: number, cyclesOverride?: number) => void;
  pausePomodoro: () => void;
  resumePomodoro: () => void;
  stopPomodoro: (savePartial?: boolean) => void;
  getPartialStudyMinutes: () => number;
  undoLastSession: () => void;
  addManualSession: (subjectId: string, subjectName: string, durationMinutes: number, date: string, note?: string) => void;
  deleteSession: (id: string) => void;
  updateSettings: (s: Partial<PomodoroSettings>) => void;
  updateNotificationSettings: (settings: Partial<NotificationSettings>) => Promise<NotificationSettings>;
  getMinutesForDate: (subjectId: string, date: string) => number;
  getTodayMinutes: (subjectId: string) => number;
  getWeekMinutes: (subjectId: string) => number;
  getAllTimeMinutes: (subjectId: string) => number;
  getTodayTotalMinutes: () => number;
  getFilterMinutes: (filter: StatFilter, subjectId?: string) => number;
  getFilterDailyAverage: (filter: StatFilter) => number;
  getBestSubjectForFilter: (filter: StatFilter) => Subject | null;
  getSessionsForFilter: (filter: StatFilter, subjectId?: string) => StudySession[];
  getChartData: (filter: StatFilter) => ChartPoint[];
  getLast7DaysData: () => ChartPoint[];
  exportStudyData: () => object;
  importStudyData: (data: { subjects?: unknown[]; sessions?: unknown[]; settings?: unknown; notificationSettings?: unknown }) => Promise<void>;
  resetStudyData: () => Promise<void>;
  setLastBackupDate: (date: string) => void;
}

const StudyContext = createContext<StudyContextValue | null>(null);

export function StudyProvider({ children }: { children: React.ReactNode }) {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [settings, setSettings] = useState<PomodoroSettings>({ workMinutes: 25, breakMinutes: 5, cycles: 4 });
  const [notificationSettings, setNotificationSettingsState] =
    useState<NotificationSettings>(DEFAULT_NOTIFICATION_SETTINGS);
  const [pomodoro, setPomodoro] = useState<PomodoroState | null>(null);
  const [lastSavedSession, setLastSavedSession] = useState<StudySession | null>(null);
  const [lastBackupDate, setLastBackupDateState] = useState<string | null>(null);
  const pomodoroRef = useRef<PomodoroState | null>(null);

  useEffect(() => { pomodoroRef.current = pomodoro; }, [pomodoro]);

  const persistPomodoro = useCallback(async (state: PomodoroState | null) => {
    if (state) await AsyncStorage.setItem(KEYS.POMODORO, JSON.stringify(state));
    else await AsyncStorage.removeItem(KEYS.POMODORO);
  }, []);

  const persistSessions = useCallback(async (next: StudySession[]) => {
    await AsyncStorage.setItem(KEYS.SESSIONS, JSON.stringify(next));
  }, []);

  const saveSession = useCallback((
    subjectId: string,
    subjectName: string,
    durationMinutes: number,
    source: "pomodoro" | "manual",
    date?: string,
    note?: string,
    startTime?: string,
    endTime?: string,
    completedPomodoroCycleCount?: number
  ) => {
    const rounded = Math.floor(durationMinutes);
    if (rounded < 1) return null;
    const completedAt = endTime ?? new Date().toISOString();
    const session: StudySession = {
      id: genId(),
      subjectId,
      subjectName,
      startTime: startTime ?? completedAt,
      endTime: completedAt,
      durationMinutes: rounded,
      studiedMinutes: rounded,
      date: date ?? completedAt.split("T")[0] as string,
      source,
      type: source,
      completedPomodoroCycleCount,
      note,
      createdAt: new Date().toISOString(),
      completedAt,
    };
    setSessions((prev) => {
      const next = [...prev, session];
      persistSessions(next).catch(() => {});
      return next;
    });
    setLastSavedSession(session);
    return session;
  }, [persistSessions]);

  const schedulePhaseNotification = useCallback(async (state: PomodoroState): Promise<PomodoroState> => {
    const seconds = remainingForState(state);
    const isWork = state.phase === "work";
    const title = isWork ? "Study session done" : "Break done";
    const body = isWork
      ? state.currentCycle >= state.totalCycles
        ? `${state.subjectName}: all cycles finished`
        : `${state.subjectName}: time for a break`
      : `${state.subjectName}: start the next focus session`;
    const id = await schedulePomodoroNotification({ settings: notificationSettings, title, body, seconds });
    return id ? { ...state, notificationIds: [...state.notificationIds, id] } : state;
  }, [notificationSettings]);

  const setAndPersistPomodoro = useCallback((state: PomodoroState | null) => {
    setPomodoro(state);
    persistPomodoro(state).catch(() => {});
  }, [persistPomodoro]);

  const advancePomodoro = useCallback(async () => {
    let state = pomodoroRef.current;
    if (!state || !state.isRunning || !state.phaseStartedAt) return;

    const now = Date.now();
    let changed = false;
    let guard = 0;

    while (state && state.isRunning && state.phaseStartedAt && remainingForState(state, now) <= 0 && guard < 20) {
      guard += 1;
      const phaseStartMs = new Date(state.phaseStartedAt).getTime();
      const durationSeconds = phaseDurationSeconds(state);
      const phaseEnd = new Date(phaseStartMs + durationSeconds * 1000).toISOString();

      if (state.phase === "work") {
        saveSession(
          state.subjectId,
          state.subjectName,
          state.workMinutes,
          "pomodoro",
          phaseEnd.split("T")[0] as string,
          undefined,
          state.phaseStartedAt,
          phaseEnd,
          state.currentCycle
        );

        if (state.currentCycle >= state.totalCycles) {
          await cancelNotifications(state.notificationIds);
          state = null;
          changed = true;
          break;
        }

        state = {
          ...state,
          phase: "break",
          phaseStartedAt: phaseEnd,
          pausedRemainingSeconds: null,
          remainingSeconds: minutesToSeconds(state.breakMinutes),
          notificationIds: [],
        };
        changed = true;
      } else {
        state = {
          ...state,
          phase: "work",
          currentCycle: state.currentCycle + 1,
          phaseStartedAt: phaseEnd,
          pausedRemainingSeconds: null,
          remainingSeconds: minutesToSeconds(state.workMinutes),
          notificationIds: [],
        };
        changed = true;
      }
    }

    if (state) {
      const next = { ...state, remainingSeconds: remainingForState(state, Date.now()) };
      if (changed) {
        const withNotification = await schedulePhaseNotification(next);
        setAndPersistPomodoro(withNotification);
      } else {
        setPomodoro(next);
      }
    } else if (changed) {
      setAndPersistPomodoro(null);
    }
  }, [saveSession, schedulePhaseNotification, setAndPersistPomodoro]);

  useEffect(() => {
    (async () => {
      try {
        const [subjectsRaw, sessionsRaw, settingsRaw, lastBackupRaw, notificationRaw, pomodoroRaw] =
          await Promise.all([
            AsyncStorage.getItem(KEYS.SUBJECTS),
            AsyncStorage.getItem(KEYS.SESSIONS),
            AsyncStorage.getItem(KEYS.SETTINGS),
            AsyncStorage.getItem(KEYS.LAST_BACKUP),
            loadNotificationSettings().then((s) => JSON.stringify(s)),
            AsyncStorage.getItem(KEYS.POMODORO),
          ]);
        if (subjectsRaw) setSubjects((JSON.parse(subjectsRaw) as unknown[]).map(normalizeSubject).filter(Boolean) as Subject[]);
        if (sessionsRaw) setSessions((JSON.parse(sessionsRaw) as unknown[]).map(normalizeSession).filter(Boolean) as StudySession[]);
        if (settingsRaw) setSettings(normalizeSettings(JSON.parse(settingsRaw)));
        if (lastBackupRaw) setLastBackupDateState(lastBackupRaw);
        if (notificationRaw) setNotificationSettingsState(normalizeNotificationSettings(JSON.parse(notificationRaw)));
        if (pomodoroRaw) {
          const restored = JSON.parse(pomodoroRaw) as PomodoroState;
          setPomodoro(restored);
          pomodoroRef.current = restored;
          setTimeout(() => advancePomodoro().catch(() => {}), 0);
        }
      } catch {}
    })();
  }, [advancePomodoro]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (pomodoroRef.current?.isRunning) advancePomodoro().catch(() => {});
    }, 1000);
    return () => clearInterval(interval);
  }, [advancePomodoro]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") advancePomodoro().catch(() => {});
    });
    return () => subscription.remove();
  }, [advancePomodoro]);

  const activeSubjects = useMemo(() => subjects.filter((s) => !s.archived), [subjects]);

  const addSubject = useCallback((
    name: string,
    color: string,
    opts?: Partial<Pick<Subject, "dailyGoalMinutes" | "weeklyGoalMinutes">>
  ) => {
    const subject: Subject = {
      id: genId(),
      name,
      color,
      archived: false,
      createdAt: new Date().toISOString(),
      ...opts,
    };
    setSubjects((prev) => {
      const next = [...prev, subject];
      AsyncStorage.setItem(KEYS.SUBJECTS, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const editSubject = useCallback((
    id: string,
    updates: Partial<Pick<Subject, "name" | "color" | "dailyGoalMinutes" | "weeklyGoalMinutes" | "archived">>
  ) => {
    setSubjects((prev) => {
      const next = prev.map((s) => s.id === id ? { ...s, ...updates } : s);
      AsyncStorage.setItem(KEYS.SUBJECTS, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const archiveSubject = useCallback((id: string) => editSubject(id, { archived: true }), [editSubject]);

  const deleteSubject = useCallback((id: string) => {
    setSubjects((prev) => {
      const next = prev.filter((s) => s.id !== id);
      AsyncStorage.setItem(KEYS.SUBJECTS, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const startPomodoro = useCallback((
    subjectId: string,
    subjectName: string,
    workMinutesOverride?: number,
    cyclesOverride?: number
  ) => {
    const workMinutes = workMinutesOverride ?? settings.workMinutes;
    const totalCycles = cyclesOverride ?? settings.cycles;
    const state: PomodoroState = {
      id: genId(),
      subjectId,
      subjectName,
      phase: "work",
      currentCycle: 1,
      totalCycles,
      workMinutes,
      breakMinutes: settings.breakMinutes,
      phaseStartedAt: new Date().toISOString(),
      pausedRemainingSeconds: null,
      remainingSeconds: minutesToSeconds(workMinutes),
      isRunning: true,
      notificationIds: [],
    };
    cancelNotifications(pomodoroRef.current?.notificationIds ?? []).catch(() => {});
    schedulePhaseNotification(state).then(setAndPersistPomodoro).catch(() => setAndPersistPomodoro(state));
  }, [schedulePhaseNotification, setAndPersistPomodoro, settings.breakMinutes, settings.cycles, settings.workMinutes]);

  const pausePomodoro = useCallback(() => {
    const state = pomodoroRef.current;
    if (!state) return;
    const remaining = remainingForState(state);
    const next: PomodoroState = {
      ...state,
      isRunning: false,
      phaseStartedAt: null,
      pausedRemainingSeconds: remaining,
      remainingSeconds: remaining,
    };
    cancelNotifications(state.notificationIds).catch(() => {});
    setAndPersistPomodoro({ ...next, notificationIds: [] });
  }, [setAndPersistPomodoro]);

  const resumePomodoro = useCallback(() => {
    const state = pomodoroRef.current;
    if (!state) return;
    const remaining = state.pausedRemainingSeconds ?? state.remainingSeconds;
    const elapsedSeconds = phaseDurationSeconds(state) - remaining;
    const phaseStartedAt = new Date(Date.now() - elapsedSeconds * 1000).toISOString();
    const next: PomodoroState = {
      ...state,
      isRunning: true,
      phaseStartedAt,
      pausedRemainingSeconds: null,
      remainingSeconds: remaining,
      notificationIds: [],
    };
    schedulePhaseNotification(next).then(setAndPersistPomodoro).catch(() => setAndPersistPomodoro(next));
  }, [schedulePhaseNotification, setAndPersistPomodoro]);

  const getPartialStudyMinutes = useCallback(() => {
    const state = pomodoroRef.current;
    if (!state || state.phase !== "work") return 0;
    const remaining = remainingForState(state);
    const elapsed = phaseDurationSeconds(state) - remaining;
    return Math.max(0, Math.floor(elapsed / 60));
  }, []);

  const stopPomodoro = useCallback((savePartial = false) => {
    const state = pomodoroRef.current;
    if (!state) return;
    cancelNotifications(state.notificationIds).catch(() => {});
    if (savePartial && state.phase === "work") {
      const studiedMinutes = getPartialStudyMinutes();
      if (studiedMinutes >= 1) {
        const endTime = new Date().toISOString();
        saveSession(
          state.subjectId,
          state.subjectName,
          studiedMinutes,
          "pomodoro",
          endTime.split("T")[0] as string,
          "Partial session",
          state.phaseStartedAt ?? endTime,
          endTime,
          state.currentCycle - 1
        );
      }
    }
    setAndPersistPomodoro(null);
  }, [getPartialStudyMinutes, saveSession, setAndPersistPomodoro]);

  const undoLastSession = useCallback(() => {
    if (!lastSavedSession) return;
    setSessions((prev) => {
      const next = prev.filter((s) => s.id !== lastSavedSession.id);
      persistSessions(next).catch(() => {});
      return next;
    });
    setLastSavedSession(null);
  }, [lastSavedSession, persistSessions]);

  const addManualSession = useCallback((
    subjectId: string,
    subjectName: string,
    durationMinutes: number,
    date: string,
    note?: string
  ) => {
    const end = new Date(`${date}T12:00:00`).toISOString();
    const start = new Date(new Date(end).getTime() - durationMinutes * 60000).toISOString();
    saveSession(subjectId, subjectName, durationMinutes, "manual", date, note, start, end);
  }, [saveSession]);

  const deleteSession = useCallback((id: string) => {
    setSessions((prev) => {
      const next = prev.filter((s) => s.id !== id);
      persistSessions(next).catch(() => {});
      return next;
    });
  }, [persistSessions]);

  const updateSettings = useCallback((s: Partial<PomodoroSettings>) => {
    setSettings((prev) => {
      const next = normalizeSettings({ ...prev, ...s });
      AsyncStorage.setItem(KEYS.SETTINGS, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const updateNotificationSettings = useCallback(async (patch: Partial<NotificationSettings>) => {
    const merged = normalizeNotificationSettings({ ...notificationSettings, ...patch });
    const withBackup = await rescheduleBackupReminder(merged, lastBackupDate);
    setNotificationSettingsState(withBackup);
    await saveNotificationSettings(withBackup);
    return withBackup;
  }, [lastBackupDate, notificationSettings]);

  const setLastBackupDate = useCallback((date: string) => {
    setLastBackupDateState(date);
    AsyncStorage.setItem(KEYS.LAST_BACKUP, date).catch(() => {});
    rescheduleBackupReminder(notificationSettings, date)
      .then((next) => {
        setNotificationSettingsState(next);
        saveNotificationSettings(next).catch(() => {});
      })
      .catch(() => {});
  }, [notificationSettings]);

  const getSessionsForFilter = useCallback((filter: StatFilter, subjectId?: string): StudySession[] => {
    const start = getFilterStart(filter);
    return sessions.filter((s) => {
      if (subjectId && s.subjectId !== subjectId) return false;
      if (!start) return true;
      if (filter === "today") return s.date === start;
      return s.date >= start && s.date <= getTodayStr();
    });
  }, [sessions]);

  const getFilterMinutes = useCallback((filter: StatFilter, subjectId?: string): number => {
    return getSessionsForFilter(filter, subjectId).reduce((sum, s) => sum + s.durationMinutes, 0);
  }, [getSessionsForFilter]);

  const getFilterDailyAverage = useCallback((filter: StatFilter): number => {
    const filtered = getSessionsForFilter(filter);
    if (filtered.length === 0) return 0;
    const total = filtered.reduce((sum, s) => sum + s.durationMinutes, 0);
    const activeStudyDays = new Set(filtered.filter((s) => s.durationMinutes > 0).map((s) => s.date)).size;
    return activeStudyDays === 0 ? 0 : Math.round(total / activeStudyDays);
  }, [getSessionsForFilter]);

  const getBestSubjectForFilter = useCallback((filter: StatFilter): Subject | null => {
    let best: Subject | null = null;
    let bestMins = 0;
    for (const sub of subjects) {
      const mins = getFilterMinutes(filter, sub.id);
      if (mins > bestMins) {
        bestMins = mins;
        best = sub;
      }
    }
    return best;
  }, [getFilterMinutes, subjects]);

  const getMinutesForDate = useCallback((subjectId: string, date: string): number => {
    return sessions
      .filter((s) => s.subjectId === subjectId && s.date === date)
      .reduce((sum, s) => sum + s.durationMinutes, 0);
  }, [sessions]);

  const getTodayMinutes = useCallback((subjectId: string): number => {
    return getMinutesForDate(subjectId, getTodayStr());
  }, [getMinutesForDate]);

  const getWeekMinutes = useCallback((subjectId: string): number => {
    return getSessionsForFilter("7days", subjectId).reduce((sum, s) => sum + s.durationMinutes, 0);
  }, [getSessionsForFilter]);

  const getAllTimeMinutes = useCallback((subjectId: string): number => {
    return sessions.filter((s) => s.subjectId === subjectId).reduce((sum, s) => sum + s.durationMinutes, 0);
  }, [sessions]);

  const getTodayTotalMinutes = useCallback((): number => {
    const today = getTodayStr();
    return sessions.filter((s) => s.date === today).reduce((sum, s) => sum + s.durationMinutes, 0);
  }, [sessions]);

  const getChartData = useCallback((filter: StatFilter): ChartPoint[] => {
    const today = new Date();
    const points =
      filter === "today" ? 1 :
      filter === "7days" ? 7 :
      filter === "30days" ? 30 :
      filter === "year" ? 12 :
      7;

    if (filter === "year") {
      return Array.from({ length: 12 }, (_, i) => {
        const d = new Date(today.getFullYear(), today.getMonth() - (11 - i), 1);
        const month = d.toISOString().slice(0, 7);
        const minutes = sessions
          .filter((s) => s.date.startsWith(month))
          .reduce((sum, s) => sum + s.durationMinutes, 0);
        return {
          label: d.toLocaleDateString("en-US", { month: "short" }),
          date: month,
          minutes,
        };
      });
    }

    const visiblePoints = filter === "alltime" ? Math.min(30, points) : points;
    return Array.from({ length: visiblePoints }, (_, i) => {
      const d = new Date(today);
      d.setDate(d.getDate() - (visiblePoints - 1 - i));
      const date = dateToStr(d);
      const minutes = sessions
        .filter((s) => s.date === date)
        .reduce((sum, s) => sum + s.durationMinutes, 0);
      return {
        label: filter === "today" ? "Today" : d.toLocaleDateString("en-US", { weekday: "short" }),
        date,
        minutes,
      };
    });
  }, [sessions]);

  const getLast7DaysData = useCallback(() => getChartData("7days"), [getChartData]);

  const exportStudyData = useCallback(() => ({
    subjects,
    sessions,
    settings,
    notificationSettings,
  }), [notificationSettings, sessions, settings, subjects]);

  const importStudyData = useCallback(async (data: {
    subjects?: unknown[];
    sessions?: unknown[];
    settings?: unknown;
    notificationSettings?: unknown;
  }) => {
    const importedSubjects = Array.isArray(data.subjects)
      ? data.subjects.map(normalizeSubject).filter(Boolean) as Subject[]
      : [];
    const importedSessions = Array.isArray(data.sessions)
      ? data.sessions.map(normalizeSession).filter(Boolean) as StudySession[]
      : [];
    const importedSettings = normalizeSettings(data.settings);
    const importedNotificationSettings = normalizeNotificationSettings(data.notificationSettings);

    await cancelNotifications(pomodoroRef.current?.notificationIds ?? []);
    setSubjects(importedSubjects);
    setSessions(importedSessions);
    setSettings(importedSettings);
    setNotificationSettingsState(importedNotificationSettings);
    setPomodoro(null);
    setLastSavedSession(null);

    await Promise.all([
      AsyncStorage.setItem(KEYS.SUBJECTS, JSON.stringify(importedSubjects)),
      AsyncStorage.setItem(KEYS.SESSIONS, JSON.stringify(importedSessions)),
      AsyncStorage.setItem(KEYS.SETTINGS, JSON.stringify(importedSettings)),
      saveNotificationSettings(importedNotificationSettings),
      AsyncStorage.removeItem(KEYS.POMODORO),
    ]);
  }, []);

  const resetStudyData = useCallback(async () => {
    await cancelNotifications(pomodoroRef.current?.notificationIds ?? []);
    setSubjects([]);
    setSessions([]);
    setSettings({ workMinutes: 25, breakMinutes: 5, cycles: 4 });
    setPomodoro(null);
    setLastSavedSession(null);
    await Promise.all([
      AsyncStorage.removeItem(KEYS.SUBJECTS),
      AsyncStorage.removeItem(KEYS.SESSIONS),
      AsyncStorage.removeItem(KEYS.SETTINGS),
      AsyncStorage.removeItem(KEYS.POMODORO),
    ]);
  }, []);

  return (
    <StudyContext.Provider value={{
      subjects,
      activeSubjects,
      sessions,
      settings,
      notificationSettings,
      pomodoro,
      lastSavedSession,
      lastBackupDate,
      addSubject,
      deleteSubject,
      archiveSubject,
      editSubject,
      startPomodoro,
      pausePomodoro,
      resumePomodoro,
      stopPomodoro,
      getPartialStudyMinutes,
      undoLastSession,
      addManualSession,
      deleteSession,
      updateSettings,
      updateNotificationSettings,
      getMinutesForDate,
      getTodayMinutes,
      getWeekMinutes,
      getAllTimeMinutes,
      getTodayTotalMinutes,
      getFilterMinutes,
      getFilterDailyAverage,
      getBestSubjectForFilter,
      getSessionsForFilter,
      getChartData,
      getLast7DaysData,
      exportStudyData,
      importStudyData,
      resetStudyData,
      setLastBackupDate,
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
