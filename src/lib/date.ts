import { addDays, differenceInCalendarDays, endOfDay, set, startOfDay, subDays } from "date-fns";
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

export function formatDebugDateTime(date: Date | string) {
  return formatInTimeZone(date, getTimeZone(), "yyyy-MM-dd HH:mm:ss XXX");
}

export function formatDateInputValue(date: Date | string) {
  return formatInTimeZone(date, getTimeZone(), "yyyy-MM-dd");
}

export function getAppDayStart(date: Date | string = new Date()) {
  const zoned = toZonedTime(date, getTimeZone());
  return fromZonedTime(startOfDay(zoned), getTimeZone());
}

export function getDaysSince(date: Date | string, now: Date | string = new Date()) {
  const zonedDate = startOfDay(toZonedTime(date, getTimeZone()));
  const zonedNow = startOfDay(toZonedTime(now, getTimeZone()));

  return differenceInCalendarDays(zonedNow, zonedDate);
}

export function getAppDayEnd(date: Date | string = new Date()) {
  const zoned = toZonedTime(date, getTimeZone());
  return fromZonedTime(endOfDay(zoned), getTimeZone());
}

export function getAppDispatchDateTime(date: Date | string = new Date()) {
  const zoned = toZonedTime(date, getTimeZone());
  return fromZonedTime(
    set(zoned, {
      hours: 12,
      minutes: 0,
      seconds: 0,
      milliseconds: 0,
    }),
    getTimeZone(),
  );
}

export function getLatestDispatchCheckpoint(date: Date | string = new Date()) {
  const targetDate = new Date(date);
  const checkpoint = getAppDispatchDateTime(targetDate);
  return checkpoint <= targetDate ? checkpoint : getAppDispatchDateTime(subDays(targetDate, 1));
}

export function parseDateInput(value: string) {
  return fromZonedTime(`${value}T12:00:00`, getTimeZone());
}

export function scheduleNextReview(daysToAdd: number, baseDate: Date = new Date()) {
  const zoned = toZonedTime(baseDate, getTimeZone());
  return fromZonedTime(
    set(addDays(zoned, daysToAdd), {
      hours: 12,
      minutes: 0,
      seconds: 0,
      milliseconds: 0,
    }),
    getTimeZone(),
  );
}

export function isDueToday(date: Date, now: Date = new Date()) {
  return date <= getAppDayEnd(now);
}
