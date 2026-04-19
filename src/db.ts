import Dexie, { type Table } from 'dexie';
import type { Person, Note } from './types';

export interface Setting {
  key: string;
  value: any;
}

export class CalendarDatabase extends Dexie {
  people!: Table<Person>;
  notes!: Table<Note>;
  settings!: Table<Setting>;

  constructor() {
    super('CalendarDatabase');
    this.version(1).stores({
      people: '++id, name',
      notes: '++id, person_id, date, [person_id+date]',
      settings: 'key'
    });
  }
}

export const db = new CalendarDatabase();
