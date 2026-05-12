import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle } from "react-native-svg";
import { StatFilter, StudySession, Subject, useStudy } from "@/context/StudyContext";
import { useColors } from "@/hooks/useColors";

const DEFAULT_DAILY_GOAL_MINUTES = 180;
const DAY_MS = 24 * 60 * 60 * 1000;

type DailyPoint = {
  date: string;
  label: string;
  dayLabel: string;
  minutes: number;
};

type SubjectBreakdownItem = {
  subjectId: string;
  name: string;
  color: string;
  minutes: number;
  subject?: Subject;
};

type RangeStats = {
  totalMinutes: number;
  activeDays: number;
  averageActiveDay: number;
  bestDay: { date: string; minutes: number } | null;
  longestStreak: number;
};

type MonthPoint = {
  key: string;
  label: string;
  minutes: number;
  goalMinutes: number;
};

type BucketPoint = {
  key: string;
  label: string;
  minutes: number;
};

type TrendSummary = {
  value: string;
  label: string;
  tone: "default" | "good" | "warn";
};

const FILTERS: { key: StatFilter; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "7days", label: "7 Days" },
  { key: "30days", label: "30 Days" },
  { key: "year", label: "Year" },
  { key: "alltime", label: "All Time" },
];

function formatMinutes(minutes: number): string {
  if (minutes === 0) return "0m";
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function dateToStr(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDate(date: string): Date {
  return new Date(`${date}T00:00:00`);
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  next.setHours(0, 0, 0, 0);
  return next;
}

function getDateRange(start: Date, end: Date): string[] {
  const dates: string[] = [];
  const cursor = new Date(start);
  cursor.setHours(0, 0, 0, 0);
  const last = new Date(end);
  last.setHours(0, 0, 0, 0);

  while (cursor <= last) {
    dates.push(dateToStr(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

function dateStrToDayNumber(date: string): number {
  const [year, month, day] = date.split("-").map(Number);
  if (!year || !month || !day) return 0;
  return Date.UTC(year, month - 1, day) / DAY_MS;
}

function formatShortDate(date: string): string {
  const parsed = parseDate(date);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatMonthKey(key: string): string {
  const parsed = new Date(`${key}-01T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return key;
  const currentYear = new Date().getFullYear();
  return parsed.toLocaleDateString("en-US", {
    month: "short",
    year: parsed.getFullYear() === currentYear ? undefined : "numeric",
  });
}

function getRangeLabel(filter: StatFilter): string {
  switch (filter) {
    case "today": return "Today";
    case "7days": return "Last 7 days";
    case "30days": return "Last 30 days";
    case "year": return "This year";
    case "alltime": return "All time";
    default: return "";
  }
}

function withOpacity(hex: string, opacity: number): string {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return hex;
  const alpha = Math.round(Math.max(0, Math.min(1, opacity)) * 255)
    .toString(16)
    .padStart(2, "0");
  return `${hex}${alpha}`;
}

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function monthKeyFromDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function addMonths(date: Date, amount: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function getMonthKeysBetween(firstKey: string, lastKey: string): string[] {
  const [firstYear, firstMonth] = firstKey.split("-").map(Number);
  const [lastYear, lastMonth] = lastKey.split("-").map(Number);
  if (!firstYear || !firstMonth || !lastYear || !lastMonth) return [];

  const keys: string[] = [];
  const cursor = new Date(firstYear, firstMonth - 1, 1);
  const last = new Date(lastYear, lastMonth - 1, 1);
  while (cursor <= last) {
    keys.push(monthKeyFromDate(cursor));
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return keys;
}

function buildDailyTotals(sessions: StudySession[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const session of sessions) {
    totals.set(session.date, (totals.get(session.date) ?? 0) + session.durationMinutes);
  }
  return totals;
}

function computeLongestStreakFromScope(dateScope: string[], dailyTotals: Map<string, number>): number {
  let best = 0;
  let current = 0;
  for (const date of dateScope) {
    if ((dailyTotals.get(date) ?? 0) > 0) {
      current += 1;
      best = Math.max(best, current);
    } else {
      current = 0;
    }
  }
  return best;
}

function computeLongestStreakFromActiveDates(activeDates: string[]): number {
  if (activeDates.length === 0) return 0;
  const sorted = [...activeDates].sort();
  let best = 1;
  let current = 1;
  for (let i = 1; i < sorted.length; i += 1) {
    const previous = dateStrToDayNumber(sorted[i - 1] as string);
    const next = dateStrToDayNumber(sorted[i] as string);
    if (next - previous === 1) {
      current += 1;
      best = Math.max(best, current);
    } else if (next !== previous) {
      current = 1;
    }
  }
  return best;
}

function computeCurrentStreak(allDailyTotals: Map<string, number>, today: Date): number {
  let streak = 0;
  let cursor = new Date(today);
  cursor.setHours(0, 0, 0, 0);

  while ((allDailyTotals.get(dateToStr(cursor)) ?? 0) > 0) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }

  return streak;
}

function computeRangeStats(sessions: StudySession[], dateScope?: string[]): RangeStats {
  const dailyTotals = buildDailyTotals(sessions);
  const totalMinutes = sessions.reduce((sum, session) => sum + session.durationMinutes, 0);
  const scopedDates = dateScope ?? [...dailyTotals.keys()].sort();
  const activeDates = scopedDates.filter((date) => (dailyTotals.get(date) ?? 0) > 0);
  let bestDay: RangeStats["bestDay"] = null;

  for (const date of activeDates) {
    const minutes = dailyTotals.get(date) ?? 0;
    if (!bestDay || minutes > bestDay.minutes) {
      bestDay = { date, minutes };
    }
  }

  return {
    totalMinutes,
    activeDays: activeDates.length,
    averageActiveDay: activeDates.length > 0 ? Math.round(totalMinutes / activeDates.length) : 0,
    bestDay,
    longestStreak: dateScope
      ? computeLongestStreakFromScope(dateScope, dailyTotals)
      : computeLongestStreakFromActiveDates(activeDates),
  };
}

function filterSessionsForRange(sessions: StudySession[], filter: StatFilter, today: Date): StudySession[] {
  const todayStr = dateToStr(today);
  if (filter === "alltime") return sessions;
  if (filter === "today") return sessions.filter((session) => session.date === todayStr);

  if (filter === "year") {
    const yearStart = `${today.getFullYear()}-01-01`;
    return sessions.filter((session) => session.date >= yearStart && session.date <= todayStr);
  }

  const daysBack = filter === "7days" ? 6 : 29;
  const start = dateToStr(addDays(today, -daysBack));
  return sessions.filter((session) => session.date >= start && session.date <= todayStr);
}

function getDateScope(filter: StatFilter, today: Date): string[] | undefined {
  if (filter === "alltime") return undefined;
  if (filter === "today") return [dateToStr(today)];
  if (filter === "year") return getDateRange(new Date(today.getFullYear(), 0, 1), today);
  const daysBack = filter === "7days" ? 6 : 29;
  return getDateRange(addDays(today, -daysBack), today);
}

function createDailyPoints(days: number, today: Date, dailyTotals: Map<string, number>): DailyPoint[] {
  return Array.from({ length: days }, (_, index) => {
    const dateObj = addDays(today, -(days - 1 - index));
    const date = dateToStr(dateObj);
    return {
      date,
      label: dateObj.toLocaleDateString("en-US", { weekday: "short" }),
      dayLabel: String(dateObj.getDate()),
      minutes: dailyTotals.get(date) ?? 0,
    };
  });
}

function buildSubjectBreakdown(
  sessions: StudySession[],
  subjects: Subject[],
  fallbackColor: string
): SubjectBreakdownItem[] {
  const subjectLookup = new Map(subjects.map((subject) => [subject.id, subject]));
  const totals = new Map<string, SubjectBreakdownItem>();

  for (const session of sessions) {
    const subject = subjectLookup.get(session.subjectId);
    const existing = totals.get(session.subjectId);
    if (existing) {
      existing.minutes += session.durationMinutes;
    } else {
      totals.set(session.subjectId, {
        subjectId: session.subjectId,
        name: subject?.name ?? session.subjectName,
        color: subject?.color ?? fallbackColor,
        minutes: session.durationMinutes,
        subject,
      });
    }
  }

  return [...totals.values()].sort((a, b) => b.minutes - a.minutes);
}

function buildMonthPoints(year: number, sessions: StudySession[], dailyGoalMinutes: number): MonthPoint[] {
  const monthTotals = new Map<string, number>();
  for (const session of sessions) {
    const key = session.date.slice(0, 7);
    monthTotals.set(key, (monthTotals.get(key) ?? 0) + session.durationMinutes);
  }

  return Array.from({ length: 12 }, (_, index) => {
    const key = `${year}-${String(index + 1).padStart(2, "0")}`;
    return {
      key,
      label: new Date(year, index, 1).toLocaleDateString("en-US", { month: "short" }),
      minutes: monthTotals.get(key) ?? 0,
      goalMinutes: dailyGoalMinutes * daysInMonth(year, index),
    };
  });
}

function getBestMonth(sessions: StudySession[]): BucketPoint | null {
  const totals = new Map<string, number>();
  for (const session of sessions) {
    const key = session.date.slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(key)) continue;
    totals.set(key, (totals.get(key) ?? 0) + session.durationMinutes);
  }

  let best: BucketPoint | null = null;
  for (const [key, minutes] of totals) {
    if (!best || minutes > best.minutes) {
      best = { key, label: formatMonthKey(key), minutes };
    }
  }
  return best;
}

function buildAllTimeBuckets(sessions: StudySession[]): { mode: "month" | "year"; points: BucketPoint[] } {
  const validSessions = sessions.filter((session) => /^\d{4}-\d{2}-\d{2}$/.test(session.date));
  if (validSessions.length === 0) return { mode: "month", points: [] };

  const sortedDates = validSessions.map((session) => session.date).sort();
  const firstMonth = (sortedDates[0] as string).slice(0, 7);
  const lastMonth = (sortedDates[sortedDates.length - 1] as string).slice(0, 7);
  const monthKeys = getMonthKeysBetween(firstMonth, lastMonth);

  if (monthKeys.length <= 18) {
    return {
      mode: "month",
      points: monthKeys.map((key) => ({
        key,
        label: formatMonthKey(key),
        minutes: validSessions
          .filter((session) => session.date.startsWith(key))
          .reduce((sum, session) => sum + session.durationMinutes, 0),
      })),
    };
  }

  const firstYear = Number(firstMonth.slice(0, 4));
  const lastYear = Number(lastMonth.slice(0, 4));
  return {
    mode: "year",
    points: Array.from({ length: lastYear - firstYear + 1 }, (_, index) => {
      const key = String(firstYear + index);
      return {
        key,
        label: key,
        minutes: validSessions
          .filter((session) => session.date.startsWith(key))
          .reduce((sum, session) => sum + session.durationMinutes, 0),
      };
    }),
  };
}

function sumBetween(dailyTotals: Map<string, number>, start: Date, end: Date): number {
  return getDateRange(start, end).reduce((sum, date) => sum + (dailyTotals.get(date) ?? 0), 0);
}

function getTrend(filter: StatFilter, allDailyTotals: Map<string, number>, today: Date): TrendSummary {
  let current = 0;
  let previous = 0;
  let label = "";

  if (filter === "today") {
    current = allDailyTotals.get(dateToStr(today)) ?? 0;
    previous = allDailyTotals.get(dateToStr(addDays(today, -1))) ?? 0;
    label = "vs yesterday";
  } else if (filter === "7days") {
    current = sumBetween(allDailyTotals, addDays(today, -6), today);
    previous = sumBetween(allDailyTotals, addDays(today, -13), addDays(today, -7));
    label = "vs previous 7d";
  } else if (filter === "30days") {
    current = sumBetween(allDailyTotals, addDays(today, -29), today);
    previous = sumBetween(allDailyTotals, addDays(today, -59), addDays(today, -30));
    label = "vs previous 30d";
  } else if (filter === "year") {
    const startThisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const startPreviousMonth = addMonths(startThisMonth, -1);
    current = sumBetween(allDailyTotals, startThisMonth, today);
    previous = sumBetween(allDailyTotals, startPreviousMonth, addDays(startThisMonth, -1));
    label = "vs previous month";
  } else {
    const startThisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const startPreviousMonth = addMonths(startThisMonth, -1);
    current = sumBetween(allDailyTotals, startThisMonth, today);
    previous = sumBetween(allDailyTotals, startPreviousMonth, addDays(startThisMonth, -1));
    label = "this month";
  }

  if (previous <= 0) {
    if (current > 0) return { value: "New", label, tone: "good" };
    return { value: "Steady", label, tone: "default" };
  }

  const pct = Math.round(((current - previous) / previous) * 100);
  if (Math.abs(pct) < 5) return { value: "Steady", label, tone: "default" };
  return { value: `${pct > 0 ? "+" : ""}${pct}%`, label, tone: pct > 0 ? "good" : "warn" };
}

function EmptyData({ colors }: { colors: ReturnType<typeof useColors> }) {
  return (
    <View style={[styles.noDataChart, { backgroundColor: colors.muted }]}>
      <Feather name="bar-chart-2" size={24} color={colors.mutedForeground} />
      <Text style={[styles.noDataTitle, { color: colors.foreground }]}>No data</Text>
      <Text style={[styles.noDataHint, { color: colors.mutedForeground }]}>Study sessions will appear here.</Text>
    </View>
  );
}

function MetricGrid({
  metrics,
  colors,
}: {
  metrics: {
    label: string;
    value: string;
    hint: string;
    icon: keyof typeof Feather.glyphMap;
    tone?: "default" | "good" | "warn";
  }[];
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={[styles.metricGrid, { borderTopColor: colors.border }]}>
      {metrics.map((metric) => {
        const iconColor =
          metric.tone === "good" ? colors.success :
          metric.tone === "warn" ? colors.warning :
          colors.primary;
        return (
          <View key={`${metric.label}-${metric.value}`} style={styles.metricItem}>
            <View style={[styles.metricIcon, { backgroundColor: withOpacity(iconColor, 0.14) }]}>
              <Feather name={metric.icon} size={14} color={iconColor} />
            </View>
            <View style={styles.metricTextBlock}>
              <Text style={[styles.metricValue, { color: colors.foreground }]} numberOfLines={1} adjustsFontSizeToFit>
                {metric.value}
              </Text>
              <Text style={[styles.metricLabel, { color: colors.mutedForeground }]} numberOfLines={1}>
                {metric.label}
              </Text>
              <Text style={[styles.metricHint, { color: colors.mutedForeground }]} numberOfLines={1}>
                {metric.hint}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

function SubjectBreakdown({
  items,
  colors,
  onOpenSubject,
}: {
  items: SubjectBreakdownItem[];
  colors: ReturnType<typeof useColors>;
  onOpenSubject: (id: string) => void;
}) {
  const maxMinutes = Math.max(...items.map((item) => item.minutes), 1);

  return (
    <>
      {items.map((item) => {
        const pct = item.minutes / maxMinutes;
        return (
          <TouchableOpacity
            key={item.subjectId}
            onPress={() => item.subject ? onOpenSubject(item.subjectId) : undefined}
            disabled={!item.subject}
            style={styles.subjectRow}
          >
            <View style={styles.subjectMeta}>
              <View style={[styles.subjectDot, { backgroundColor: item.color }]} />
              <Text style={[styles.subjectName, { color: colors.foreground }]} numberOfLines={1}>{item.name}</Text>
              <Text style={[styles.subjectMinutes, { color: colors.foreground }]}>{formatMinutes(item.minutes)}</Text>
              {item.subject ? <Feather name="chevron-right" size={14} color={colors.mutedForeground} /> : null}
            </View>
            <View style={[styles.subjectTrack, { backgroundColor: colors.muted }]}>
              <View
                style={[
                  styles.subjectFill,
                  {
                    width: `${Math.max(5, pct * 100)}%` as `${number}%`,
                    backgroundColor: item.color,
                  },
                ]}
              />
            </View>
          </TouchableOpacity>
        );
      })}
    </>
  );
}

function TodayPanel({
  totalMinutes,
  dailyGoalMinutes,
  subjectBreakdown,
  colors,
  onOpenSubject,
}: {
  totalMinutes: number;
  dailyGoalMinutes: number;
  subjectBreakdown: SubjectBreakdownItem[];
  colors: ReturnType<typeof useColors>;
  onOpenSubject: (id: string) => void;
}) {
  const size = 148;
  const strokeWidth = 13;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(totalMinutes / dailyGoalMinutes, 1);
  const remaining = Math.max(0, dailyGoalMinutes - totalMinutes);

  return (
    <View style={[styles.visualBlock, { borderTopColor: colors.border }]}>
      <View style={styles.todayLayout}>
        <View style={[styles.ringWrap, { width: size, height: size }]}>
          <Svg width={size} height={size}>
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke={colors.muted}
              strokeWidth={strokeWidth}
              fill="none"
            />
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke={totalMinutes >= dailyGoalMinutes ? colors.success : colors.primary}
              strokeWidth={strokeWidth}
              fill="none"
              strokeLinecap="round"
              strokeDasharray={`${circumference} ${circumference}`}
              strokeDashoffset={circumference * (1 - progress)}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
          </Svg>
          <View style={styles.ringCenter}>
            <Text style={[styles.ringPercent, { color: colors.foreground }]}>{Math.round(progress * 100)}%</Text>
            <Text style={[styles.ringLabel, { color: colors.mutedForeground }]}>Daily goal</Text>
          </View>
        </View>

        <View style={styles.todayNumbers}>
          <View>
            <Text style={[styles.detailLabel, { color: colors.mutedForeground }]}>Studied today</Text>
            <Text style={[styles.detailValue, { color: colors.foreground }]}>{formatMinutes(totalMinutes)}</Text>
          </View>
          <View style={[styles.detailDivider, { backgroundColor: colors.border }]} />
          <View>
            <Text style={[styles.detailLabel, { color: colors.mutedForeground }]}>Remaining goal</Text>
            <Text style={[styles.detailValue, { color: remaining === 0 ? colors.success : colors.primary }]}>
              {remaining === 0 && totalMinutes > dailyGoalMinutes
                ? `${formatMinutes(totalMinutes - dailyGoalMinutes)} over`
                : formatMinutes(remaining)}
            </Text>
          </View>
          <Text style={[styles.goalNote, { color: colors.mutedForeground }]}>
            Goal: {formatMinutes(dailyGoalMinutes)}
          </Text>
        </View>
      </View>

      <View style={styles.inlineSection}>
        <Text style={[styles.inlineTitle, { color: colors.foreground }]}>Subject Breakdown</Text>
        {subjectBreakdown.length > 0 ? (
          <SubjectBreakdown items={subjectBreakdown} colors={colors} onOpenSubject={onOpenSubject} />
        ) : (
          <Text style={[styles.emptyInlineText, { color: colors.mutedForeground }]}>No study recorded today.</Text>
        )}
      </View>
    </View>
  );
}

function SevenDayBars({
  points,
  dailyGoalMinutes,
  colors,
}: {
  points: DailyPoint[];
  dailyGoalMinutes: number;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={[styles.visualBlock, { borderTopColor: colors.border }]}>
      <View style={styles.chartHeaderRow}>
        <Text style={[styles.chartCaption, { color: colors.mutedForeground }]}>Goal scale: {formatMinutes(dailyGoalMinutes)}</Text>
        <Text style={[styles.chartCaption, { color: colors.mutedForeground }]}>+ = over goal</Text>
      </View>
      <View style={styles.goalChartWrap}>
        <View style={styles.chartScale}>
          <Text style={[styles.scaleText, { color: colors.mutedForeground }]}>Goal</Text>
          <Text style={[styles.scaleText, { color: colors.mutedForeground }]}>0m</Text>
        </View>
        <View style={styles.barChart}>
          {points.map((day) => {
            const ratio = Math.min(day.minutes / dailyGoalMinutes, 1);
            const barHeight = day.minutes > 0 ? Math.max(7, ratio * 100) : 0;
            const isOver = day.minutes > dailyGoalMinutes;
            return (
              <View key={day.date} style={styles.barCol}>
                <View style={styles.barArea}>
                  {isOver ? (
                    <View style={[styles.overGoalBadge, { backgroundColor: colors.success }]}>
                      <Text style={styles.overGoalText}>+</Text>
                    </View>
                  ) : null}
                  <View style={[styles.barTrack, { backgroundColor: colors.muted }]}>
                    <View
                      style={[
                        styles.barFill,
                        {
                          height: `${barHeight}%` as `${number}%`,
                          backgroundColor: isOver ? colors.success : colors.primary,
                        },
                      ]}
                    />
                  </View>
                </View>
                <Text style={[styles.barLabel, { color: colors.foreground }]}>{day.label.slice(0, 3)}</Text>
                <Text style={[styles.barSubLabel, { color: colors.mutedForeground }]}>{formatMinutes(day.minutes)}</Text>
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
}

function Heatmap30({
  points,
  dailyGoalMinutes,
  colors,
}: {
  points: DailyPoint[];
  dailyGoalMinutes: number;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={[styles.visualBlock, { borderTopColor: colors.border }]}>
      <View style={styles.heatmapGrid}>
        {points.map((day) => {
          const ratio = Math.min(day.minutes / dailyGoalMinutes, 1);
          const backgroundColor = day.minutes > 0
            ? withOpacity(colors.primary, 0.18 + ratio * 0.58)
            : colors.muted;
          const isOver = day.minutes > dailyGoalMinutes;
          return (
            <View
              key={day.date}
              style={[
                styles.heatCell,
                {
                  backgroundColor,
                  borderColor: isOver ? colors.success : colors.border,
                },
              ]}
            >
              <Text style={[styles.heatDay, { color: day.minutes > 0 ? colors.foreground : colors.mutedForeground }]}>
                {day.dayLabel}
              </Text>
              {isOver ? <Text style={[styles.heatPlus, { color: colors.success }]}>+</Text> : null}
            </View>
          );
        })}
      </View>
      <View style={styles.heatLegend}>
        <Text style={[styles.chartCaption, { color: colors.mutedForeground }]}>Less</Text>
        {[0.18, 0.34, 0.52, 0.76].map((opacity) => (
          <View key={opacity} style={[styles.legendCell, { backgroundColor: withOpacity(colors.primary, opacity) }]} />
        ))}
        <Text style={[styles.chartCaption, { color: colors.mutedForeground }]}>More</Text>
      </View>
    </View>
  );
}

function MonthSummary({
  points,
  colors,
}: {
  points: MonthPoint[];
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={[styles.visualBlock, { borderTopColor: colors.border }]}>
      <View style={styles.monthGrid}>
        {points.map((month) => {
          const ratio = month.goalMinutes > 0 ? Math.min(month.minutes / month.goalMinutes, 1) : 0;
          const backgroundColor = month.minutes > 0
            ? withOpacity(colors.primary, 0.16 + ratio * 0.58)
            : colors.muted;
          return (
            <View
              key={month.key}
              style={[
                styles.monthCell,
                {
                  backgroundColor,
                  borderColor: month.minutes > month.goalMinutes ? colors.success : colors.border,
                },
              ]}
            >
              <Text style={[styles.monthLabel, { color: colors.foreground }]}>{month.label}</Text>
              <Text style={[styles.monthMinutes, { color: colors.mutedForeground }]} numberOfLines={1} adjustsFontSizeToFit>
                {formatMinutes(month.minutes)}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function TimelineSummary({
  mode,
  points,
  colors,
}: {
  mode: "month" | "year";
  points: BucketPoint[];
  colors: ReturnType<typeof useColors>;
}) {
  const maxMinutes = Math.max(...points.map((point) => point.minutes), 1);

  if (points.length === 0) return <EmptyData colors={colors} />;

  return (
    <View style={[styles.visualBlock, { borderTopColor: colors.border }]}>
      <View style={styles.timelineHeader}>
        <Text style={[styles.chartCaption, { color: colors.mutedForeground }]}>
          {mode === "month" ? "Monthly summary" : "Yearly summary"}
        </Text>
      </View>
      <View style={styles.timelineList}>
        {points.map((point) => {
          const width = point.minutes > 0 ? Math.max(5, (point.minutes / maxMinutes) * 100) : 0;
          return (
            <View key={point.key} style={styles.timelineRow}>
              <Text style={[styles.timelineLabel, { color: colors.foreground }]}>{point.label}</Text>
              <View style={[styles.timelineTrack, { backgroundColor: colors.muted }]}>
                <View
                  style={[
                    styles.timelineFill,
                    {
                      width: `${width}%` as `${number}%`,
                      backgroundColor: colors.primary,
                    },
                  ]}
                />
              </View>
              <Text style={[styles.timelineValue, { color: colors.foreground }]}>{formatMinutes(point.minutes)}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

export default function StatsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [activeFilter, setActiveFilter] = useState<StatFilter>("7days");
  const { activeSubjects, subjects, sessions } = useStudy();

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : 0;
  const today = useMemo(() => {
    const current = new Date();
    current.setHours(0, 0, 0, 0);
    return current;
  }, []);

  const dailyGoalMinutes = useMemo(() => {
    const customGoal = activeSubjects.reduce((sum, subject) => sum + Math.max(0, subject.dailyGoalMinutes ?? 0), 0);
    return customGoal > 0 ? customGoal : DEFAULT_DAILY_GOAL_MINUTES;
  }, [activeSubjects]);

  const allDailyTotals = useMemo(() => buildDailyTotals(sessions), [sessions]);
  const filteredSessions = useMemo(
    () => filterSessionsForRange(sessions, activeFilter, today),
    [activeFilter, sessions, today]
  );
  const dateScope = useMemo(() => getDateScope(activeFilter, today), [activeFilter, today]);
  const rangeStats = useMemo(
    () => computeRangeStats(filteredSessions, dateScope),
    [dateScope, filteredSessions]
  );
  const currentStreak = useMemo(
    () => computeCurrentStreak(allDailyTotals, today),
    [allDailyTotals, today]
  );
  const subjectBreakdown = useMemo(
    () => buildSubjectBreakdown(filteredSessions, subjects, colors.primary),
    [colors.primary, filteredSessions, subjects]
  );
  const bestSubject = subjectBreakdown[0] ?? null;
  const bestMonth = useMemo(() => getBestMonth(filteredSessions), [filteredSessions]);
  const trend = useMemo(() => getTrend(activeFilter, allDailyTotals, today), [activeFilter, allDailyTotals, today]);
  const dailyPoints7 = useMemo(() => createDailyPoints(7, today, allDailyTotals), [allDailyTotals, today]);
  const dailyPoints30 = useMemo(() => createDailyPoints(30, today, allDailyTotals), [allDailyTotals, today]);
  const yearMonths = useMemo(
    () => buildMonthPoints(today.getFullYear(), filteredSessions, dailyGoalMinutes),
    [dailyGoalMinutes, filteredSessions, today]
  );
  const allTimeBuckets = useMemo(() => buildAllTimeBuckets(sessions), [sessions]);
  const subjectLookup = useMemo(() => new Map(subjects.map((subject) => [subject.id, subject])), [subjects]);

  const recentSessions = useMemo(() => [...filteredSessions]
    .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())
    .slice(0, 10), [filteredSessions]);

  const summaryMetrics = useMemo(() => {
    const metrics: {
      label: string;
      value: string;
      hint: string;
      icon: keyof typeof Feather.glyphMap;
      tone?: "default" | "good" | "warn";
    }[] = [
      { label: "Total", value: formatMinutes(rangeStats.totalMinutes), hint: getRangeLabel(activeFilter), icon: "clock" },
      { label: "Active days", value: String(rangeStats.activeDays), hint: "days with study", icon: "calendar" },
      { label: "Avg active day", value: formatMinutes(rangeStats.averageActiveDay), hint: "zero days ignored", icon: "activity" },
      {
        label: "Best day",
        value: rangeStats.bestDay ? formatMinutes(rangeStats.bestDay.minutes) : "None",
        hint: rangeStats.bestDay ? formatShortDate(rangeStats.bestDay.date) : "no study yet",
        icon: "award",
      },
      {
        label: "Current streak",
        value: `${currentStreak}d`,
        hint: currentStreak > 0 ? "through today" : "start today",
        icon: "zap",
        tone: currentStreak > 0 ? "good" : "default",
      },
      {
        label: "Best subject",
        value: bestSubject?.name ?? "None",
        hint: bestSubject ? formatMinutes(bestSubject.minutes) : "no time yet",
        icon: "book-open",
      },
      {
        label: "Trend",
        value: trend.value,
        hint: trend.label,
        icon: "trending-up",
        tone: trend.tone,
      },
    ];

    if (activeFilter === "year" || activeFilter === "alltime") {
      metrics.splice(5, 0, {
        label: "Best month",
        value: bestMonth ? formatMinutes(bestMonth.minutes) : "None",
        hint: bestMonth?.label ?? "no month yet",
        icon: "bar-chart-2",
      });
    }

    if (activeFilter === "year" || activeFilter === "30days") {
      metrics.splice(5, 0, {
        label: "Longest streak",
        value: `${rangeStats.longestStreak}d`,
        hint: getRangeLabel(activeFilter),
        icon: "target",
        tone: rangeStats.longestStreak > 0 ? "good" : "default",
      });
    }

    return metrics;
  }, [activeFilter, bestMonth, bestSubject, currentStreak, rangeStats, trend]);

  const openSubject = (id: string) => router.push(`/subject/${id}`);

  const renderVisualization = () => {
    if (activeFilter === "today") {
      return (
        <TodayPanel
          totalMinutes={rangeStats.totalMinutes}
          dailyGoalMinutes={dailyGoalMinutes}
          subjectBreakdown={subjectBreakdown}
          colors={colors}
          onOpenSubject={openSubject}
        />
      );
    }

    if (activeFilter === "7days") {
      return <SevenDayBars points={dailyPoints7} dailyGoalMinutes={dailyGoalMinutes} colors={colors} />;
    }

    if (activeFilter === "30days") {
      return <Heatmap30 points={dailyPoints30} dailyGoalMinutes={dailyGoalMinutes} colors={colors} />;
    }

    if (activeFilter === "year") {
      return <MonthSummary points={yearMonths} colors={colors} />;
    }

    return <TimelineSummary mode={allTimeBuckets.mode} points={allTimeBuckets.points} colors={colors} />;
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: topPad + 16, paddingBottom: bottomPad + 110 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.headline, { color: colors.foreground }]}>Stats</Text>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterRow}>
          {FILTERS.map((filter) => (
            <TouchableOpacity
              key={filter.key}
              onPress={() => setActiveFilter(filter.key)}
              style={[
                styles.filterTab,
                {
                  backgroundColor: activeFilter === filter.key ? colors.primary : colors.card,
                  borderColor: activeFilter === filter.key ? colors.primary : colors.border,
                },
              ]}
            >
              <Text style={[styles.filterTabText, { color: activeFilter === filter.key ? "#fff" : colors.mutedForeground }]}>
                {filter.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={[styles.card, styles.insightsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.insightsHeader}>
            <View style={styles.headerCopy}>
              <Text style={[styles.cardTitle, styles.insightsTitle, { color: colors.foreground }]}>Insights</Text>
              <Text style={[styles.rangeLabel, { color: colors.mutedForeground }]}>{getRangeLabel(activeFilter)}</Text>
            </View>
            <View style={[styles.totalPill, { backgroundColor: colors.primary + "15" }]}>
              <Text style={[styles.totalPillText, { color: colors.primary }]}>{formatMinutes(rangeStats.totalMinutes)}</Text>
            </View>
          </View>

          <MetricGrid metrics={summaryMetrics} colors={colors} />
          {renderVisualization()}
        </View>

        {activeFilter !== "today" && subjectBreakdown.length > 0 ? (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>Subject Breakdown</Text>
            <SubjectBreakdown items={subjectBreakdown} colors={colors} onOpenSubject={openSubject} />
          </View>
        ) : null}

        {recentSessions.length > 0 ? (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>Recent Sessions</Text>
            {recentSessions.map((session, idx) => {
              const subject = subjectLookup.get(session.subjectId);
              const date = new Date(session.completedAt);
              const timeStr = date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
              return (
                <View
                  key={session.id}
                  style={[
                    styles.sessionRow,
                    {
                      borderBottomColor: colors.border,
                      borderBottomWidth: idx < recentSessions.length - 1 ? StyleSheet.hairlineWidth : 0,
                    },
                  ]}
                >
                  <View style={[styles.sessionDot, { backgroundColor: subject?.color ?? colors.primary }]} />
                  <View style={styles.sessionInfo}>
                    <Text style={[styles.sessionSubject, { color: colors.foreground }]} numberOfLines={1}>
                      {session.subjectName}
                    </Text>
                    <Text style={[styles.sessionMeta, { color: colors.mutedForeground }]}>
                      {session.date} - {timeStr}
                    </Text>
                  </View>
                  <View style={styles.sessionRight}>
                    <Text style={[styles.sessionDuration, { color: colors.foreground }]}>
                      {formatMinutes(session.durationMinutes)}
                    </Text>
                    <View style={[styles.typeBadge, { backgroundColor: session.source === "pomodoro" ? colors.secondary : colors.warningLight }]}>
                      <Text style={[styles.typeText, { color: session.source === "pomodoro" ? colors.primary : colors.warning }]}>
                        {session.source === "pomodoro" ? "Pomo" : "Manual"}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        ) : null}

        {sessions.length === 0 && (
          <View style={[styles.emptyBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="bar-chart-2" size={32} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No study sessions yet</Text>
            <Text style={[styles.emptyHint, { color: colors.mutedForeground }]}>
              Start a Pomodoro session on the Study tab.
            </Text>
            <TouchableOpacity onPress={() => router.push("/study")} style={[styles.emptyBtn, { backgroundColor: colors.primary }]}>
              <Text style={styles.emptyBtnText}>Go to Study</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: 18 },
  headline: { fontSize: 28, fontFamily: "Inter_700Bold", marginBottom: 14 },
  filterScroll: { marginBottom: 14 },
  filterRow: { flexDirection: "row", gap: 8 },
  filterTab: { paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderRadius: 10 },
  filterTabText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  card: { borderRadius: 14, borderWidth: 1, padding: 16, marginBottom: 14, gap: 12 },
  cardTitle: { fontSize: 15, fontFamily: "Inter_700Bold" },
  insightsCard: { gap: 14 },
  insightsHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  headerCopy: { flex: 1, minWidth: 0 },
  insightsTitle: { fontSize: 18, marginBottom: 2 },
  rangeLabel: { fontSize: 12, fontFamily: "Inter_500Medium" },
  totalPill: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999 },
  totalPillText: { fontSize: 13, fontFamily: "Inter_700Bold" },
  metricGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 8,
    columnGap: 8,
  },
  metricItem: { width: "48%", flexDirection: "row", alignItems: "center", gap: 9, paddingVertical: 8, minWidth: 0 },
  metricIcon: { width: 28, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  metricTextBlock: { flex: 1, minWidth: 0 },
  metricValue: { fontSize: 15, fontFamily: "Inter_700Bold" },
  metricLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", marginTop: 1 },
  metricHint: { fontSize: 10, fontFamily: "Inter_400Regular", marginTop: 1 },
  visualBlock: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 14, gap: 12 },
  todayLayout: { flexDirection: "row", alignItems: "center", gap: 16 },
  ringWrap: { position: "relative", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  ringCenter: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  ringPercent: { fontSize: 26, fontFamily: "Inter_700Bold" },
  ringLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", marginTop: 1 },
  todayNumbers: { flex: 1, gap: 10, minWidth: 0 },
  detailLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  detailValue: { fontSize: 18, fontFamily: "Inter_700Bold", marginTop: 2 },
  detailDivider: { height: StyleSheet.hairlineWidth },
  goalNote: { fontSize: 12, fontFamily: "Inter_500Medium" },
  inlineSection: { gap: 10 },
  inlineTitle: { fontSize: 14, fontFamily: "Inter_700Bold" },
  emptyInlineText: { fontSize: 13, fontFamily: "Inter_400Regular" },
  chartHeaderRow: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  chartCaption: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  goalChartWrap: { flexDirection: "row", height: 176, gap: 8 },
  chartScale: { width: 34, justifyContent: "space-between", alignItems: "flex-end", paddingBottom: 37, paddingTop: 4 },
  scaleText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  barChart: { flex: 1, flexDirection: "row", alignItems: "flex-end", gap: 6 },
  barCol: { flex: 1, alignItems: "center", gap: 4, height: "100%", minWidth: 0 },
  barArea: { flex: 1, width: "100%", justifyContent: "flex-end", alignItems: "center" },
  overGoalBadge: { position: "absolute", top: 0, width: 18, height: 18, borderRadius: 9, alignItems: "center", justifyContent: "center", zIndex: 2 },
  overGoalText: { color: "#fff", fontSize: 13, fontFamily: "Inter_700Bold", lineHeight: 15 },
  barTrack: { width: "78%", flex: 1, borderRadius: 999, overflow: "hidden", justifyContent: "flex-end", marginTop: 20 },
  barFill: { width: "100%", borderRadius: 999 },
  barLabel: { fontSize: 10, fontFamily: "Inter_700Bold", textAlign: "center" },
  barSubLabel: { fontSize: 9, fontFamily: "Inter_500Medium", textAlign: "center" },
  heatmapGrid: { flexDirection: "row", flexWrap: "wrap", gap: 5 },
  heatCell: {
    width: "12.7%",
    aspectRatio: 1,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  heatDay: { fontSize: 11, fontFamily: "Inter_700Bold" },
  heatPlus: { position: "absolute", top: 2, right: 4, fontSize: 10, fontFamily: "Inter_700Bold" },
  heatLegend: { flexDirection: "row", justifyContent: "flex-end", alignItems: "center", gap: 5 },
  legendCell: { width: 12, height: 12, borderRadius: 3 },
  monthGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  monthCell: { width: "31.7%", borderRadius: 10, borderWidth: 1, paddingHorizontal: 9, paddingVertical: 10, gap: 4 },
  monthLabel: { fontSize: 12, fontFamily: "Inter_700Bold" },
  monthMinutes: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  timelineHeader: { flexDirection: "row", justifyContent: "space-between" },
  timelineList: { gap: 9 },
  timelineRow: { flexDirection: "row", alignItems: "center", gap: 9 },
  timelineLabel: { width: 62, fontSize: 12, fontFamily: "Inter_700Bold" },
  timelineTrack: { flex: 1, height: 9, borderRadius: 999, overflow: "hidden" },
  timelineFill: { height: "100%", borderRadius: 999 },
  timelineValue: { width: 62, textAlign: "right", fontSize: 12, fontFamily: "Inter_700Bold" },
  noDataChart: { alignItems: "center", justifyContent: "center", minHeight: 150, borderRadius: 12, gap: 6 },
  noDataTitle: { fontSize: 16, fontFamily: "Inter_700Bold" },
  noDataHint: { fontSize: 12, fontFamily: "Inter_400Regular" },
  subjectRow: { gap: 7 },
  subjectMeta: { flexDirection: "row", alignItems: "center", gap: 8 },
  subjectDot: { width: 10, height: 10, borderRadius: 5 },
  subjectName: { fontSize: 14, fontFamily: "Inter_600SemiBold", flex: 1 },
  subjectTrack: { height: 6, borderRadius: 3, overflow: "hidden" },
  subjectFill: { height: "100%", borderRadius: 3 },
  subjectMinutes: { fontSize: 13, fontFamily: "Inter_700Bold" },
  sessionRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10 },
  sessionDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  sessionInfo: { flex: 1, minWidth: 0 },
  sessionSubject: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  sessionMeta: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 1 },
  sessionRight: { alignItems: "flex-end", gap: 3 },
  sessionDuration: { fontSize: 13, fontFamily: "Inter_700Bold" },
  typeBadge: { paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4 },
  typeText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  emptyBox: { alignItems: "center", paddingVertical: 42, borderRadius: 14, borderWidth: 1, gap: 8, borderStyle: "dashed" },
  emptyTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold", marginTop: 4 },
  emptyHint: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", paddingHorizontal: 24 },
  emptyBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, marginTop: 6 },
  emptyBtnText: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },
});
