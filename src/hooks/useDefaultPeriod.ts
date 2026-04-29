import { useState, useEffect } from 'react';
import { request } from '../api/client';
import dayjs from 'dayjs';

// Module-level cache: key = `${apiPath}:${periodType}`, value = most-recent periodValue string
const cache: Record<string, string | null> = {};

/**
 * Fetches the most recent period with data and returns it as a dayjs object.
 * Returns a `ready` flag — consumers MUST gate their data-fetch effects on it,
 * otherwise the initial render fires a wasted fetch with today's date that can
 * race-overwrite the second (correct) fetch's result.
 *
 * @param apiPath  e.g. '/tasks/periods' or '/bugs/periods'
 * @param periodType 'week' | 'month'
 * @returns [selectedDate, setSelectedDate, ready]
 */
export function useDefaultPeriod(
  apiPath: string,
  periodType: 'week' | 'month',
): [dayjs.Dayjs, React.Dispatch<React.SetStateAction<dayjs.Dayjs>>, boolean] {
  const [selectedDate, setSelectedDate] = useState<dayjs.Dayjs>(dayjs());
  const [ready, setReady] = useState<boolean>(false);

  useEffect(() => {
    const cacheKey = `${apiPath}:${periodType}`;

    if (cacheKey in cache) {
      const cached = cache[cacheKey];
      if (cached) setSelectedDate(parsePeriod(cached, periodType));
      setReady(true);
      return;
    }

    setReady(false);
    request.get<{ success: boolean; data: string[] }>(apiPath, { periodType })
      .then((res: any) => {
        const periods: string[] = res?.data ?? [];
        const latest = periods[0] ?? null;
        cache[cacheKey] = latest;
        if (latest) setSelectedDate(parsePeriod(latest, periodType));
        setReady(true);
      })
      .catch(() => {
        cache[cacheKey] = null;
        setReady(true);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiPath, periodType]);

  return [selectedDate, setSelectedDate, ready];
}

function parsePeriod(value: string, periodType: 'week' | 'month'): dayjs.Dayjs {
  if (periodType === 'month' && value.length === 6) {
    return dayjs(`${value.slice(0, 4)}-${value.slice(4, 6)}-01`);
  }
  // week: YYYYMMDD (Thursday of the week)
  return dayjs(`${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`);
}
