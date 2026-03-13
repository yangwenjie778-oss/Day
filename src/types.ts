export interface Person {
  id: number;
  name: string;
  avatar_color: string;
}

export interface NoteEntry {
  tag: string; // e.g., "张三", "李四"
  content: string;
  images: string[]; // array of base64 strings
}

export interface Note {
  id?: number;
  date: string; // YYYY-MM-DD
  entries: NoteEntry[];
}

export interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  note?: Note;
}
