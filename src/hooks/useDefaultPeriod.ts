import { useState, useEffect } from 'react';
import { request } from '../api/client';
import dayjs from 'dayjs';

// Module-level cache: key = `${apiPath}:${periodType}`, value = most-recent periodValue string
const cache: Record<string, string | null> = {};

/**
 * Fetches the most recent period with data and returns it as a dayjs object.
 * Results are cached per (apiPath + periodType) for the lifetime of the page session —
 * cleared on full page refresh, reused on route changes.
 *
 * @param apiPath  e.g. '/tasks/periods' or '/bugs/periods'
 * @param periodType 'week' | 'month'
 * @returns [selectedDate, setSelectedDate] — drop-in replacement for useState(dayjs())
 */
export function useDefaultPeriod(
  apiPath: string,
  periodType: 'week' | 'month',
): [dayjs.Dayjs, React.Dispatch<React.SetStateAction<dayjs.Dayjs>>] {
  const [selectedDate, setSelectedDate] = useState<dayjs.Dayjs>(dayjs());

  useEffect(() => {
    const cacheKey = `${apiPath}:${periodType}`;

    if (cacheKey in cache) {
      const cached = cache[cacheKey];
      if (cached) setSelectedDate(parsePeriod(cached, periodType));
      return;
    }

    request.get<{ success: boolean; data: string[] }>(apiPath, { periodType })
      .then((res: any) => {
        const periods: string[] = res?.data ?? [];
        const latest = periods[0] ?? null;
        cache[cacheKey] = latest;
        if (latest) setSelectedDate(parsePeriod(latest, periodType));
      })
      .catch(() => {
        cache[cacheKey] = null;
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiPath, periodType]);

  return [selectedDate, setSelectedDate];
}

function parsePeriod(value: string, periodType: 'week' | 'month'): dayjs.Dayjs {
  if (periodType === 'month' && value.length === 6) {
    return dayjs(`${value.slice(0, 4)}-${value.slice(4, 6)}-01`);
  }
  // week: YYYYMMDD (Thursday of the week)
  return dayjs(`${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`);
}
