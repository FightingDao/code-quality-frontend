import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { PeriodType } from '../types';

interface PeriodState {
  periodType: PeriodType;
  setPeriodType: (type: PeriodType) => void;
}

export const usePeriodStore = create<PeriodState>()(
  persist(
    (set) => ({
      periodType: 'week',
      setPeriodType: (type) => set({ periodType: type }),
    }),
    {
      name: 'period-storage',
    }
  )
);