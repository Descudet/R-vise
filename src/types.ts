import { LucideIcon } from 'lucide-react';

export type ColorOption = {
  name: string;
  value: string;
};

export const CATEGORY_COLORS: ColorOption[] = [
  { name: 'Red', value: '#FF3B30' },
  { name: 'Orange', value: '#FF9500' },
  { name: 'Yellow', value: '#FFCC00' },
  { name: 'Green', value: '#34C759' },
  { name: 'Blue', value: '#007AFF' },
  { name: 'Purple', value: '#AF52DE' },
];

export type Theme = 'light' | 'dark' | 'system';
export type AccentColor = 'black' | 'red' | 'blue' | 'green' | 'yellow';

export type TimePeriod = 
  | 'all_day' 
  | 'early_morning' 
  | 'morning' 
  | 'late_morning' 
  | 'noon' 
  | 'early_afternoon' 
  | 'afternoon' 
  | 'late_afternoon' 
  | 'evening'
  | 'specific_time';

export const TIME_PERIOD_ORDER: Record<TimePeriod, number> = {
  all_day: 0,
  early_morning: 1,
  morning: 2,
  late_morning: 3,
  noon: 4,
  early_afternoon: 5,
  afternoon: 6,
  late_afternoon: 7,
  evening: 8,
  specific_time: 9,
};

export const TIME_PERIOD_LABELS: Record<TimePeriod, string> = {
  all_day: 'Toute la journée',
  specific_time: 'Heure précise',
  early_morning: 'Début de matinée',
  morning: 'Matinée',
  late_morning: 'Fin de matinée',
  noon: 'Midi',
  early_afternoon: "Début d'après-midi",
  afternoon: 'Après-midi',
  late_afternoon: "Fin d'après-midi",
  evening: 'Soirée',
};

export interface Category {
  id: string;
  name: string;
  color: string;
  iconName: string;
}

export interface Task {
  id: string;
  name: string;
  location?: string;
  date: string; // ISO string
  timePeriod: TimePeriod;
  specificTime?: string; // HH:mm
  description?: string;
  categoryId: string;
  completed: boolean;
}
