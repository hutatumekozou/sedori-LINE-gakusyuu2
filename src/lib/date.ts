import { addDays, endOfDay, startOfDay } from "date-fns";
import { formatInTimeZone, fromZonedTime, toZonedTime } from "date-fns-tz";

import { getAppSettings } from "@/lib/env";

function getTimeZone() {
  return getAppSettings().appTimeZone;
}

export function formatDate(date: Date | string) {
  return formatInTimeZone(date, getTimeZone(), "yyyy/MM/dd");
}

export function formatDateTime(date: Date | string) {
  return formatInTimeZone(date, getTimeZone(), "yyyy/MM/dd HH:mm");
}

export function formatDateInputValue(date: Date | string) {
  return formatInTimeZone(date, getTimeZone(), "yyyy-MM-dd");
}

export function getAppDayStart(date: Date | string = new Date()) {
  const zoned = toZonedTime(date, getTimeZone());
  return fromZonedTime(startOfDay(zoned), getTimeZone());
}

export function getAppDayEnd(date: Date | string = new Date()) {
  const zoned = toZonedTime(date, getTimeZone());
  return fromZonedTime(endOfDay(zoned), getTimeZone());
}

export function parseDateInput(value: string) {
  return fromZonedTime(`${value}T00:00:00`, getTimeZone());
}

export function scheduleNextReview(daysToAdd: number, baseDate: Date = new Date()) {
  const zoned = toZonedTime(baseDate, getTimeZone());
  return fromZonedTime(startOfDay(addDays(zoned, daysToAdd)), getTimeZone());
}

export function isDueToday(date: Date, now: Date = new Date()) {
  return date <= getAppDayEnd(now);
}
