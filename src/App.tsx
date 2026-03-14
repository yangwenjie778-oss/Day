import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  format, 
  addMonths, 
  subMonths, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  isSameMonth, 
  isSameDay, 
  setYear,
  setMonth,
  getYear,
  getMonth
} from 'date-fns';
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon, 
  Plus, 
  Image as ImageIcon, 
  X, 
  Save,
  Trash2,
  Search,
  ChevronUp,
  ChevronDown,
  Edit2,
  Check,
  MoreVertical,
  User,
  Users,
  CheckCircle2,
  Settings
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from './lib/utils';
import { Note, CalendarDay, NoteEntry, Person } from './types';

// --- Components ---

interface YearMonthPickerProps {
  currentDate: Date;
  onSelect: (date: Date) => void;
  onClose: () => void;
}

function YearMonthPicker({ currentDate, onSelect, onClose }: YearMonthPickerProps) {
  const [viewYear, setViewYear] = useState(getYear(currentDate));
  const months = Array.from({ length: 12 }, (_, i) => i);
  const currentMonth = getMonth(currentDate);

  return (
    <motion.div 
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="absolute top-full left-0 mt-2 z-50 bg-[var(--color-calendar-surface)] border border-[var(--color-calendar-border)] rounded-xl shadow-2xl p-4 w-64"
    >
      <div className="flex items-center justify-between mb-4 px-2">
        <span className="text-lg font-semibold">{viewYear}年</span>
        <div className="flex gap-1">
          <button onClick={() => setViewYear(v => v - 1)} className="p-1 hover:bg-[var(--color-calendar-surface-hover)] rounded"><ChevronUp size={16} /></button>
          <button onClick={() => setViewYear(v => v + 1)} className="p-1 hover:bg-[var(--color-calendar-surface-hover)] rounded"><ChevronDown size={16} /></button>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {months.map(m => (
          <button
            key={m}
            onClick={() => {
              const newDate = setMonth(setYear(currentDate, viewYear), m);
              onSelect(newDate);
              onClose();
            }}
            className={cn(
              "py-2 rounded text-sm transition-colors",
              m === currentMonth && viewYear === getYear(currentDate)
                ? "bg-[var(--color-calendar-accent)] text-white"
                : "hover:bg-[var(--color-calendar-surface-hover)] text-[var(--color-calendar-text-muted)] hover:text-white"
            )}
          >
            {m + 1}月
          </button>
        ))}
      </div>
    </motion.div>
  );
}

interface ContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  onDelete: () => void;
  onAdd: () => void;
}

function ContextMenu({ x, y, onClose, onDelete, onAdd }: ContextMenuProps) {
  useEffect(() => {
    const handleClick = () => onClose();
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, [onClose]);

  return (
    <div 
      className="fixed z-[100] bg-[var(--color-calendar-surface)] border border-[var(--color-calendar-border)] rounded-lg shadow-xl py-1 w-32"
      style={{ top: y, left: x }}
      onClick={(e) => e.stopPropagation()}
    >
      <button 
        onClick={() => { onAdd(); onClose(); }}
        className="w-full text-left px-4 py-2 text-sm hover:bg-[var(--color-calendar-surface-hover)] flex items-center gap-2"
      >
        <Plus size={14} /> 新增人员
      </button>
      <button 
        onClick={() => { onDelete(); onClose(); }}
        className="w-full text-left px-4 py-2 text-sm hover:bg-[var(--color-calendar-surface-hover)] text-red-500 flex items-center gap-2"
      >
        <Trash2 size={14} /> 删除人员
      </button>
    </div>
  );
}

// --- Main App ---

// Memoized Day Component to prevent unnecessary re-renders
const CalendarDayCell = React.memo(({ 
  day, 
  note, 
  isSelected, 
  onClick, 
  onContextMenu 
}: { 
  day: CalendarDay, 
  note: any, 
  isSelected: boolean, 
  onClick: (date: Date) => void,
  onContextMenu: (e: React.MouseEvent, date: Date) => void
}) => {
  const isToday = isSameDay(day.date, new Date());
  
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      onClick={() => onClick(day.date)}
      onContextMenu={(e) => onContextMenu(e, day.date)}
      className={cn(
        "min-h-[100px] p-2 border-r border-b border-[var(--color-calendar-border)] transition-all cursor-pointer group relative overflow-hidden",
        !day.isCurrentMonth && "bg-[var(--color-calendar-page-bg)] opacity-30",
        day.isCurrentMonth && "bg-[var(--color-calendar-surface)] hover:bg-[var(--color-calendar-surface-hover)]",
        isSelected && "ring-2 ring-inset ring-[var(--color-calendar-accent)] bg-[var(--color-calendar-accent)]/5 z-10"
      )}
    >
      <div className="flex justify-between items-start mb-1">
        <span className={cn(
          "text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full transition-colors",
          isToday ? "bg-[var(--color-calendar-accent)] text-white" : "text-[var(--color-calendar-text-dim)] group-hover:text-[var(--color-calendar-text-muted)]"
        )}>
          {format(day.date, 'd')}
        </span>
      </div>
      
      <div className="space-y-1 overflow-hidden">
        {note && note.entries && note.entries.slice(0, 3).map((entry: any, eIdx: number) => (
          <div key={eIdx} className="space-y-0.5">
            {entry.content && (
              <p className="text-[10px] text-[var(--color-calendar-text-secondary)] line-clamp-1 leading-tight">
                {entry.tag && <span className="text-[var(--color-calendar-accent)]/70 font-bold">[{entry.tag}] </span>}
                {entry.content}
              </p>
            )}
            {entry.images && entry.images.length > 0 && eIdx === 0 && (
              <div className="flex gap-0.5 mt-0.5">
                {entry.images.slice(0, 3).map((img: string, i: number) => (
                  <div key={i} className="w-4 h-4 rounded-sm bg-[var(--color-calendar-border)] overflow-hidden shrink-0">
                    <img src={img} alt="" className="w-full h-full object-cover opacity-50" referrerPolicy="no-referrer" />
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
        {note && note.entries && note.entries.length > 3 && (
          <p className="text-[9px] text-[var(--color-calendar-accent)] font-bold">+{note.entries.length - 3} 更多...</p>
        )}
      </div>
    </motion.div>
  );
});

export default function App() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [notes, setNotes] = useState<Record<string, Note>>({});
  const [people, setPeople] = useState<Person[]>([]);
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isAddPersonModalOpen, setIsAddPersonModalOpen] = useState(false);
  const [newPersonName, setNewPersonName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [themeColor, setThemeColor] = useState('#3b82f6');
  const [themeMode, setThemeMode] = useState<'dark' | 'light'>('dark');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Modal Editing State
  const [entries, setEntries] = useState<NoteEntry[]>([]);
  const [activeEntryIdx, setActiveEntryIdx] = useState(0);
  const [isEditingTagName, setIsEditingTagName] = useState(false);
  const [tempTagName, setTempTagName] = useState('');

  // Context Menu State
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, personId: number } | null>(null);

  const pickerRef = useRef<HTMLDivElement>(null);

  // --- Local Storage Helpers ---
  const STORAGE_KEYS = {
    PEOPLE: 'calendar_people',
    NOTES: 'calendar_notes',
    THEME: 'calendar_theme',
    THEME_MODE: 'calendar_theme_mode'
  };

  const getLocalPeople = (): Person[] => {
    const stored = localStorage.getItem(STORAGE_KEYS.PEOPLE);
    if (!stored) {
      const defaultPeople = [{ id: 1, name: '我的日历', avatar_color: '#3b82f6' }];
      localStorage.setItem(STORAGE_KEYS.PEOPLE, JSON.stringify(defaultPeople));
      return defaultPeople;
    }
    return JSON.parse(stored);
  };

  const getLocalNotes = (): Record<string, Note> => {
    const stored = localStorage.getItem(STORAGE_KEYS.NOTES);
    return stored ? JSON.parse(stored) : {};
  };

  const saveLocalPeople = (newPeople: Person[]) => {
    localStorage.setItem(STORAGE_KEYS.PEOPLE, JSON.stringify(newPeople));
    setPeople(newPeople);
  };

  const saveLocalNotes = (newNotes: Record<string, Note>) => {
    localStorage.setItem(STORAGE_KEYS.NOTES, JSON.stringify(newNotes));
    setNotes(newNotes);
  };

  // Fetch people on mount
  useEffect(() => {
    const initialPeople = getLocalPeople();
    setPeople(initialPeople);
    if (initialPeople.length > 0) {
      setSelectedPerson(initialPeople[0]);
    }
    
    const savedTheme = localStorage.getItem(STORAGE_KEYS.THEME);
    if (savedTheme) setThemeColor(savedTheme);
    
    const savedMode = localStorage.getItem(STORAGE_KEYS.THEME_MODE) as 'dark' | 'light';
    if (savedMode) setThemeMode(savedMode);
    
    setIsLoading(false);
  }, []);

  // Apply theme to CSS variables and document
  useEffect(() => {
    document.documentElement.style.setProperty('--calendar-accent', themeColor);
    localStorage.setItem(STORAGE_KEYS.THEME, themeColor);
  }, [themeColor]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', themeMode);
    localStorage.setItem(STORAGE_KEYS.THEME_MODE, themeMode);
  }, [themeMode]);

  // Sync notes when date or person changes
  useEffect(() => {
    if (!selectedPerson) return;
    
    const allNotes = getLocalNotes();
    const notesMap: Record<string, Note> = {};

    Object.values(allNotes).forEach(note => {
      if (selectedPerson.id === 1) {
        // Aggregate entries from all people for the summary view
        const person = getLocalPeople().find(p => p.id === note.person_id);
        const personName = person ? person.name : '未知';
        
        if (!notesMap[note.date]) {
          notesMap[note.date] = { 
            ...note, 
            entries: note.entries.map(e => ({ ...e, tag: `${personName} - ${e.tag}` })) 
          };
        } else {
          notesMap[note.date].entries = [
            ...notesMap[note.date].entries,
            ...note.entries.map(e => ({ ...e, tag: `${personName} - ${e.tag}` }))
          ];
        }
      } else if (note.person_id === selectedPerson.id) {
        notesMap[note.date] = note;
      }
    });
    
    setNotes(notesMap);
  }, [currentDate, selectedPerson]);

  // Close picker on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setIsPickerOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);

    const days = eachDayOfInterval({ start: startDate, end: endDate });

    return days.map((day): CalendarDay => {
      const dateStr = format(day, 'yyyy-MM-dd');
      return {
        date: day,
        isCurrentMonth: isSameMonth(day, monthStart),
        isToday: isSameDay(day, new Date()),
        note: notes[dateStr]
      };
    });
  }, [currentDate, notes]);

  const handlePrevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const handleNextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const handleToday = () => setCurrentDate(new Date());

  const openNoteModal = (day: Date) => {
    const dateStr = format(day, 'yyyy-MM-dd');
    const existingNote = notes[dateStr];
    setSelectedDay(day);
    
    if (existingNote && existingNote.entries && existingNote.entries.length > 0) {
      setEntries(existingNote.entries);
    } else {
      setEntries([{ tag: '', content: '', images: [] }]);
    }
    setActiveEntryIdx(0);
    setIsModalOpen(true);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const readers = Array.from(files).map((file: File) => {
        return new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
      });

      Promise.all(readers).then(newImages => {
        setEntries(prev => {
          const updated = [...prev];
          updated[activeEntryIdx] = {
            ...updated[activeEntryIdx],
            images: [...updated[activeEntryIdx].images, ...newImages]
          };
          return updated;
        });
      });
    }
  };

  const removeImage = (imgIdx: number) => {
    setEntries(prev => {
      const updated = [...prev];
      const newImages = [...updated[activeEntryIdx].images];
      newImages.splice(imgIdx, 1);
      updated[activeEntryIdx] = { ...updated[activeEntryIdx], images: newImages };
      return updated;
    });
  };

  const saveNote = async () => {
    if (!selectedDay || !selectedPerson || selectedPerson.id === 1 || isSubmitting) return;
    
    setIsSubmitting(true);
    const dateStr = format(selectedDay, 'yyyy-MM-dd');
    const storageKey = `${selectedPerson.id}_${dateStr}`;
    
    try {
      const allNotes = getLocalNotes();
      const newNote: Note = {
        id: Date.now(),
        person_id: selectedPerson.id,
        date: dateStr,
        entries: entries
      };
      
      allNotes[storageKey] = newNote;
      saveLocalNotes(allNotes);
      
      // Update local state
      setNotes(prev => ({
        ...prev,
        [dateStr]: newNote
      }));
      
      setIsModalOpen(false);
    } catch (error) {
      console.error('Failed to save note:', error);
      alert('保存失败，请重试');
    } finally {
      setIsSubmitting(false);
    }
  };

  const deleteNote = async () => {
    if (!selectedDay || !selectedPerson || isSubmitting) return;
    const dateStr = format(selectedDay, 'yyyy-MM-dd');
    const storageKey = `${selectedPerson.id}_${dateStr}`;
    setIsSubmitting(true);
    
    try {
      const allNotes = getLocalNotes();
      delete allNotes[storageKey];
      saveLocalNotes(allNotes);
      
      setNotes(prev => {
        const updated = { ...prev };
        delete updated[dateStr];
        return updated;
      });
      setIsModalOpen(false);
    } catch (error) {
      console.error('Failed to delete note:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const addTag = () => {
    const newTag = '';
    setEntries(prev => [...prev, { tag: newTag, content: '', images: [] }]);
    setActiveEntryIdx(entries.length);
  };

  const removeTag = (idx: number) => {
    if (entries.length <= 1) return;
    setEntries(prev => prev.filter((_, i) => i !== idx));
    if (activeEntryIdx >= idx) {
      setActiveEntryIdx(Math.max(0, activeEntryIdx - 1));
    }
  };

  const startRenameTag = () => {
    setTempTagName(entries[activeEntryIdx].tag);
    setIsEditingTagName(true);
  };

  const confirmRenameTag = () => {
    setEntries(prev => {
      const updated = [...prev];
      updated[activeEntryIdx] = { ...updated[activeEntryIdx], tag: tempTagName };
      return updated;
    });
    setIsEditingTagName(false);
  };

  const handleAddPerson = async () => {
    if (!newPersonName.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const currentPeople = getLocalPeople();
      const newPerson: Person = {
        id: Date.now(),
        name: newPersonName.trim(),
        avatar_color: `hsl(${Math.random() * 360}, 70%, 50%)`
      };
      
      const updatedPeople = [...currentPeople, newPerson];
      saveLocalPeople(updatedPeople);
      setSelectedPerson(newPerson);
      setNewPersonName('');
      setIsAddPersonModalOpen(false);
    } catch (error) {
      console.error('Failed to add person:', error);
      alert('添加人员失败');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeletePerson = async (id: number) => {
    if (id === 1) return; // Don't delete summary
    try {
      const currentPeople = getLocalPeople();
      const updatedPeople = currentPeople.filter(p => p.id !== id);
      saveLocalPeople(updatedPeople);
      
      // Also delete their notes
      const allNotes = getLocalNotes();
      const filteredNotes: Record<string, Note> = {};
      Object.entries(allNotes).forEach(([key, note]) => {
        if (!key.startsWith(`${id}_`)) {
          filteredNotes[key] = note;
        }
      });
      saveLocalNotes(filteredNotes);

      if (selectedPerson?.id === id) {
        setSelectedPerson(updatedPeople[0]);
      }
    } catch (error) {
      console.error('Failed to delete person:', error);
    }
  };

  const handleContextMenu = (e: React.MouseEvent, personId: number) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, personId });
  };

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    
    // Local search implementation
    setTimeout(() => {
      const allNotes = getLocalNotes();
      const currentPeople = getLocalPeople();
      const results: any[] = [];
      const q = query.toLowerCase();

      Object.entries(allNotes).forEach(([key, note]) => {
        const person = currentPeople.find(p => p.id === note.person_id);
        if (!person) return;

        const matchingEntries = note.entries.filter(entry => 
          entry.content.toLowerCase().includes(q) || 
          entry.tag.toLowerCase().includes(q)
        );

        matchingEntries.forEach(entry => {
          results.push({
            ...note,
            person_name: person.name,
            avatar_color: person.avatar_color,
            entry
          });
        });
      });

      setSearchResults(results.sort((a, b) => b.date.localeCompare(a.date)));
      setIsSearching(false);
    }, 100);
  };

  const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

  return (
    <div className="min-h-screen bg-[var(--color-calendar-page-bg)] text-[var(--color-calendar-text)] flex">
      {/* Sidebar */}
      <aside className="w-64 border-r border-[var(--color-calendar-border)] flex flex-col bg-[var(--color-calendar-sidebar-bg)]">
        <div className="p-6 space-y-8">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-[var(--color-calendar-text-muted)] uppercase tracking-widest">我的日历</h3>
              <Plus size={14} className="text-[var(--color-calendar-text-dim)] cursor-pointer hover:text-white" onClick={() => setIsAddPersonModalOpen(true)} />
            </div>
            <div className="space-y-1">
              {people.slice(0, 1).map(p => (
                <div 
                  key={p.id}
                  onClick={() => setSelectedPerson(p)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors",
                    selectedPerson?.id === p.id ? "bg-[var(--color-calendar-accent)]/10 text-[var(--color-calendar-accent)]" : "hover:bg-[var(--color-calendar-surface-hover)]"
                  )}
                >
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold" style={{ backgroundColor: p.avatar_color }}>
                    {p.name[0]}
                  </div>
                  <span className="text-sm font-medium">{p.name}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-[var(--color-calendar-text-muted)] uppercase tracking-widest">当前人员</h3>
              <Plus size={14} className="text-[var(--color-calendar-text-dim)] cursor-pointer hover:text-white" onClick={() => setIsAddPersonModalOpen(true)} />
            </div>
            <div className="space-y-1">
              {people.slice(1).map(p => (
                <div 
                  key={p.id}
                  onClick={() => setSelectedPerson(p)}
                  onContextMenu={(e) => handleContextMenu(e, p.id)}
                  className={cn(
                    "flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-colors group",
                    selectedPerson?.id === p.id ? "bg-[var(--color-calendar-accent)]/10 text-[var(--color-calendar-accent)]" : "hover:bg-[var(--color-calendar-surface-hover)]"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold" style={{ backgroundColor: p.avatar_color }}>
                      {p.name[0]}
                    </div>
                    <span className="text-sm font-medium">{p.name}</span>
                  </div>
                  {selectedPerson?.id === p.id && <CheckCircle2 size={14} className="text-[var(--color-calendar-accent)]" />}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-auto p-6 border-t border-[var(--color-calendar-border)]">
          <button 
            onClick={() => setIsSettingsOpen(true)}
            className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors hover:bg-[var(--color-calendar-surface-hover)] w-full text-[var(--color-calendar-text-muted)] hover:text-white"
          >
            <Settings size={18} />
            <span className="text-sm font-medium">设置</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-calendar-border)]">
          <div className="flex items-center gap-4">
            <button 
              onClick={handleToday}
              className="px-4 py-1.5 bg-[var(--color-calendar-surface-hover)] hover:bg-[var(--color-calendar-surface-hover)]/80 rounded text-sm font-medium transition-colors"
            >
              今天
            </button>
            <div className="flex items-center gap-1">
              <button onClick={handlePrevMonth} className="p-1 hover:bg-[var(--color-calendar-surface-hover)] rounded transition-colors">
                <ChevronLeft size={20} />
              </button>
              <button onClick={handleNextMonth} className="p-1 hover:bg-[var(--color-calendar-surface-hover)] rounded transition-colors">
                <ChevronRight size={20} />
              </button>
            </div>
            <div className="relative" ref={pickerRef}>
              <button 
                onClick={() => setIsPickerOpen(!isPickerOpen)}
                className="flex items-center gap-1 text-2xl font-semibold ml-2 hover:bg-[var(--color-calendar-surface-hover)] px-2 py-1 rounded transition-colors"
              >
                {format(currentDate, 'yyyy年M月')}
                <ChevronDown size={20} className={cn("transition-transform", isPickerOpen && "rotate-180")} />
              </button>
              {selectedPerson?.id === 1 && (
                <span className="absolute -top-1 -right-16 px-2 py-0.5 bg-[var(--color-calendar-accent)]/20 text-[var(--color-calendar-accent)] text-[10px] font-bold rounded border border-[var(--color-calendar-accent)]/30 uppercase tracking-wider">
                  汇总
                </span>
              )}
              <AnimatePresence>
                {isPickerOpen && (
                  <YearMonthPicker 
                    currentDate={currentDate} 
                    onSelect={setCurrentDate} 
                    onClose={() => setIsPickerOpen(false)} 
                  />
                )}
              </AnimatePresence>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex bg-[var(--color-calendar-surface-hover)] rounded p-1">
              {['日', '周', '月', '列表'].map((view) => (
                <button 
                  key={view}
                  className={cn(
                    "px-4 py-1 rounded text-sm transition-colors",
                    view === '月' ? "bg-[var(--color-calendar-surface-hover)] text-white" : "text-[var(--color-calendar-text-muted)] hover:text-white"
                  )}
                >
                  {view}
                </button>
              ))}
            </div>
            <button 
              onClick={() => setIsSearchModalOpen(true)}
              className="p-2 hover:bg-[var(--color-calendar-surface-hover)] rounded transition-colors"
            >
              <Search size={20} className="text-[var(--color-calendar-text-muted)]" />
            </button>
          </div>
        </header>

        {/* Weekday labels */}
        <div className="grid grid-cols-7 border-b border-[var(--color-calendar-border)]">
          {weekDays.map(day => (
            <div key={day} className="py-2 text-center text-xs font-medium text-[var(--color-calendar-text-muted)] uppercase tracking-wider">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        <main className="flex-1 overflow-auto">
          <div className="grid grid-cols-7 h-full min-h-[600px]">
            {calendarDays.map((day, idx) => (
              <CalendarDayCell 
                key={idx}
                day={day}
                note={day.note}
                isSelected={selectedDay ? isSameDay(day.date, selectedDay) : false}
                onClick={openNoteModal}
                onContextMenu={(e) => {
                  // You can add a context menu for days if needed
                }}
              />
            ))}
          </div>
        </main>
      </div>

      {/* Note Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-[var(--color-calendar-surface)] w-full max-w-3xl rounded-xl border border-[var(--color-calendar-border)] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-calendar-border)]">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-[var(--color-calendar-accent)]/20 rounded-lg">
                    <CalendarIcon size={20} className="text-[var(--color-calendar-accent)]" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold">
                      {selectedDay && format(selectedDay, 'yyyy年M月d日')}
                    </h2>
                    <p className="text-xs text-[var(--color-calendar-text-muted)]">
                      {selectedPerson?.id === 1 ? '全员汇总视图 (只读)' : `${selectedPerson?.name} 的记录`}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 hover:bg-[var(--color-calendar-surface-hover)] rounded-full transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Tabs Bar */}
              <div className="flex items-center px-6 py-2 bg-[var(--color-calendar-surface)] border-b border-[var(--color-calendar-border)] gap-2 overflow-x-auto no-scrollbar">
                {entries.map((entry, idx) => (
                  <div key={idx} className="flex items-center group">
                    <button
                      onClick={() => {
                        setActiveEntryIdx(idx);
                        setIsEditingTagName(false);
                      }}
                      className={cn(
                        "px-4 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 whitespace-nowrap",
                        activeEntryIdx === idx 
                          ? "bg-[var(--color-calendar-accent)] text-white shadow-lg" 
                          : "text-[var(--color-calendar-text-muted)] hover:text-[var(--color-calendar-text)] hover:bg-[var(--color-calendar-surface-hover)]"
                      )}
                    >
                      {entry.tag || '无标签'}
                      {activeEntryIdx === idx && !isEditingTagName && (
                        <Edit2 size={12} className="opacity-60 hover:opacity-100" onClick={(e) => { e.stopPropagation(); startRenameTag(); }} />
                      )}
                    </button>
                    {entries.length > 1 && (
                      <button 
                        onClick={() => removeTag(idx)}
                        className="ml-1 p-1 text-[var(--color-calendar-text-dim)] hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>
                ))}
                <button 
                  onClick={addTag}
                  className="p-1.5 text-[var(--color-calendar-accent)] hover:bg-[var(--color-calendar-accent)]/10 rounded-lg transition-colors ml-2"
                  title="添加新标签"
                >
                  <Plus size={18} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {selectedPerson?.id === 1 && (
                  <div className="p-3 bg-[var(--color-calendar-accent)]/10 border border-[var(--color-calendar-accent)]/20 rounded-lg text-xs text-[var(--color-calendar-accent)] flex items-center gap-2">
                    <Users size={14} />
                    当前处于汇总模式，您可以查看所有人员的记录，但无法在此模式下进行修改。
                  </div>
                )}
                {/* Tag Name Editor */}
                {isEditingTagName && (
                  <div className="flex items-center gap-2 p-3 bg-[var(--color-calendar-accent)]/10 rounded-lg border border-[var(--color-calendar-accent)]/30">
                    <input 
                      autoFocus
                      value={tempTagName}
                      onChange={(e) => setTempTagName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && confirmRenameTag()}
                      className="bg-transparent border-none outline-none text-sm flex-1 font-medium"
                      placeholder="输入标签名称..."
                    />
                    <button onClick={confirmRenameTag} className="p-1 hover:bg-[var(--color-calendar-accent)]/20 rounded text-[var(--color-calendar-accent)]"><Check size={16} /></button>
                    <button onClick={() => setIsEditingTagName(false)} className="p-1 hover:bg-red-500/20 rounded text-red-500"><X size={16} /></button>
                  </div>
                )}

                {/* Text Editor */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-[var(--color-calendar-text-muted)] uppercase tracking-wider">
                    [{entries[activeEntryIdx]?.tag}] 备注内容
                  </label>
                  <textarea 
                    value={entries[activeEntryIdx]?.content || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      setEntries(prev => {
                        const updated = [...prev];
                        updated[activeEntryIdx] = { ...updated[activeEntryIdx], content: val };
                        return updated;
                      });
                    }}
                    placeholder="在此输入相关记录..."
                    className="w-full h-32 bg-[var(--color-calendar-page-bg)] border border-[var(--color-calendar-border)] rounded-lg p-4 text-sm focus:outline-none focus:border-[var(--color-calendar-accent)] transition-colors resize-none"
                  />
                </div>

                {/* Multiple Image Upload */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-[var(--color-calendar-text-muted)] uppercase tracking-wider">截图/图片 ({entries[activeEntryIdx]?.images.length || 0})</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {entries[activeEntryIdx]?.images.map((img, imgIdx) => (
                      <div key={imgIdx} className="relative group aspect-video rounded-lg overflow-hidden border border-[var(--color-calendar-border)] bg-[var(--color-calendar-page-bg)]">
                        <img 
                          src={img} 
                          alt={`upload-${imgIdx}`} 
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                        <button 
                          onClick={() => removeImage(imgIdx)}
                          className="absolute top-2 right-2 p-1.5 bg-red-600 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                    <label className="aspect-video border-2 border-dashed border-[var(--color-calendar-border)] hover:border-[var(--color-calendar-accent)]/50 hover:bg-[var(--color-calendar-accent)]/5 rounded-lg flex flex-col items-center justify-center gap-2 cursor-pointer transition-all group">
                      <div className="p-2 bg-[var(--color-calendar-surface-hover)] rounded-full group-hover:bg-[var(--color-calendar-accent)]/20 transition-colors">
                        <Plus size={20} className="text-[var(--color-calendar-text-muted)] group-hover:text-[var(--color-calendar-accent)]" />
                      </div>
                      <span className="text-[10px] text-[var(--color-calendar-text-muted)] group-hover:text-[var(--color-calendar-text)]">添加图片</span>
                      <input type="file" multiple accept="image/*" className="hidden" onChange={handleImageUpload} />
                    </label>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between px-6 py-4 bg-[var(--color-calendar-surface)] border-t border-[var(--color-calendar-border)]">
                <button 
                  onClick={deleteNote}
                  disabled={isSubmitting || selectedPerson?.id === 1}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors text-sm",
                    selectedPerson?.id === 1 && "opacity-0 pointer-events-none"
                  )}
                >
                  <Trash2 size={18} />
                  清空此日所有记录
                </button>
                <div className="flex gap-3">
                  <button 
                    onClick={() => setIsModalOpen(false)}
                    className="px-6 py-2 text-sm font-medium hover:bg-[var(--color-calendar-surface-hover)] rounded-lg transition-colors"
                  >
                    关闭
                  </button>
                  {selectedPerson?.id !== 1 && (
                    <button 
                      onClick={saveNote}
                      disabled={isSubmitting}
                      className={cn(
                        "flex items-center gap-2 px-6 py-2 bg-[var(--color-calendar-accent)] hover:opacity-90 text-white rounded-lg transition-colors text-sm font-medium shadow-lg",
                        isSubmitting && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      <Save size={18} />
                      {isSubmitting ? '保存中...' : '保存全部更改'}
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu 
          x={contextMenu.x} 
          y={contextMenu.y} 
          onClose={() => setContextMenu(null)}
          onAdd={() => setIsAddPersonModalOpen(true)}
          onDelete={() => handleDeletePerson(contextMenu.personId)}
        />
      )}

      {/* Add Person Modal */}
      <AnimatePresence>
        {isAddPersonModalOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[var(--color-calendar-surface)] w-full max-w-sm rounded-xl border border-[var(--color-calendar-border)] shadow-2xl p-6 space-y-4"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <User size={20} className="text-[var(--color-calendar-accent)]" />
                  新增人员
                </h2>
                <button onClick={() => setIsAddPersonModalOpen(false)} className="text-[var(--color-calendar-text-dim)] hover:text-white">
                  <X size={20} />
                </button>
              </div>
              <div className="space-y-2">
                <label className="text-xs text-[var(--color-calendar-text-muted)] uppercase font-bold">人员姓名</label>
                <input 
                  autoFocus
                  value={newPersonName}
                  onChange={(e) => setNewPersonName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddPerson()}
                  placeholder="请输入姓名..."
                  className="w-full bg-[var(--color-calendar-page-bg)] border border-[var(--color-calendar-border)] rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-[var(--color-calendar-accent)] transition-colors"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button 
                  onClick={() => setIsAddPersonModalOpen(false)}
                  className="flex-1 py-2 text-sm font-medium bg-[var(--color-calendar-surface-hover)] hover:opacity-80 rounded-lg transition-colors"
                >
                  取消
                </button>
                <button 
                  onClick={handleAddPerson}
                  disabled={isSubmitting || !newPersonName.trim()}
                  className={cn(
                    "flex-1 py-2 text-sm font-medium bg-[var(--color-calendar-accent)] hover:opacity-90 text-white rounded-lg transition-colors shadow-lg",
                    (isSubmitting || !newPersonName.trim()) && "opacity-50 cursor-not-allowed"
                  )}
                >
                  {isSubmitting ? '添加中...' : '确定添加'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Search Modal */}
      <AnimatePresence>
        {isSearchModalOpen && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              className="bg-[var(--color-calendar-sidebar-bg)] w-full max-w-4xl h-[80vh] rounded-2xl border border-[var(--color-calendar-border)] shadow-2xl flex flex-col overflow-hidden"
            >
              {/* Search Header */}
              <div className="p-6 border-b border-[var(--color-calendar-border)] space-y-4">
                <div className="flex items-center gap-4 bg-[var(--color-calendar-surface-hover)] px-4 py-3 rounded-xl border border-[var(--color-calendar-border)] focus-within:border-[var(--color-calendar-accent)] transition-all">
                  <Search size={20} className="text-[var(--color-calendar-text-muted)]" />
                  <input 
                    autoFocus
                    value={searchQuery}
                    onChange={(e) => handleSearch(e.target.value)}
                    placeholder="搜索聊天记录、备注、标签..."
                    className="bg-transparent border-none outline-none flex-1 text-lg text-[var(--color-calendar-text)]"
                  />
                  {searchQuery && (
                    <button onClick={() => handleSearch('')} className="text-[var(--color-calendar-text-muted)] hover:text-white">
                      <X size={18} />
                    </button>
                  )}
                </div>
                <div className="flex gap-6 text-sm font-medium text-[var(--color-calendar-text-muted)]">
                  {['聊天记录', '文件', '图片', '链接'].map((tab, i) => (
                    <button key={tab} className={cn("pb-2 border-b-2 transition-all", i === 0 ? "text-[var(--color-calendar-text)] border-[var(--color-calendar-accent)]" : "border-transparent hover:text-[var(--color-calendar-text)]")}>
                      {tab}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex-1 flex overflow-hidden">
                {/* Search Results */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                  {isSearching ? (
                    <div className="flex flex-col items-center justify-center h-full text-[var(--color-calendar-text-dim)] gap-4">
                      <div className="w-8 h-8 border-2 border-[var(--color-calendar-accent)] border-t-transparent rounded-full animate-spin" />
                      <p>正在搜索中...</p>
                    </div>
                  ) : searchResults.length > 0 ? (
                    searchResults.map((result, idx) => (
                      <motion.div 
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        key={idx}
                        onClick={() => {
                          setCurrentDate(new Date(result.date));
                          const person = people.find(p => p.id === result.person_id);
                          if (person) setSelectedPerson(person);
                          setIsSearchModalOpen(false);
                          setTimeout(() => openNoteModal(new Date(result.date)), 100);
                        }}
                        className="bg-[var(--color-calendar-surface-hover)] p-4 rounded-xl border border-transparent hover:border-[var(--color-calendar-accent)]/30 hover:bg-[var(--color-calendar-surface-hover)]/80 transition-all cursor-pointer group"
                      >
                        <div className="flex gap-4">
                          <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0" style={{ backgroundColor: result.avatar_color }}>
                            {result.person_name[0]}
                          </div>
                          <div className="flex-1 space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="font-semibold text-[var(--color-calendar-text)]">{result.person_name}</span>
                              <span className="text-xs text-[var(--color-calendar-text-dim)]">{result.date}</span>
                            </div>
                            <div className="space-y-1">
                              {result.entry.tag && (
                                <span className="inline-block px-2 py-0.5 bg-[var(--color-calendar-accent)]/20 text-[var(--color-calendar-accent)] text-[10px] font-bold rounded uppercase tracking-wider mb-1">
                                  {result.entry.tag}
                                </span>
                              )}
                              <p className="text-sm text-[var(--color-calendar-text-secondary)] line-clamp-2 leading-relaxed group-hover:text-[var(--color-calendar-text)] transition-colors">
                                {result.entry.content}
                              </p>
                            </div>
                            {result.entry.images && result.entry.images.length > 0 && (
                              <div className="flex gap-2 mt-2">
                                {result.entry.images.slice(0, 4).map((img: string, i: number) => (
                                  <div key={i} className="w-20 h-20 rounded-lg overflow-hidden border border-[var(--color-calendar-border)]">
                                    <img src={img} alt="preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    ))
                  ) : searchQuery ? (
                    <div className="flex flex-col items-center justify-center h-full text-[var(--color-calendar-text-dim)] gap-2">
                      <Search size={48} className="opacity-20" />
                      <p>未找到相关内容</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-[var(--color-calendar-text-dim)] gap-2">
                      <Search size={48} className="opacity-20" />
                      <p>输入关键词开始搜索</p>
                    </div>
                  )}
                </div>

                {/* Filters Sidebar */}
                <div className="w-64 border-l border-[var(--color-calendar-border)] p-6 space-y-8 bg-[var(--color-calendar-surface)]">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-[var(--color-calendar-text-muted)] uppercase tracking-widest">筛选</h3>
                    <button onClick={() => handleSearch('')} className="text-xs text-[var(--color-calendar-text-dim)] hover:text-white flex items-center gap-1">
                      <Trash2 size={12} /> 重置
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-xs text-[var(--color-calendar-text-dim)] font-bold">发送人</label>
                      <div className="bg-[var(--color-calendar-surface-hover)] px-3 py-2 rounded-lg border border-[var(--color-calendar-border)] text-sm text-[var(--color-calendar-text-muted)] cursor-pointer hover:border-[var(--color-calendar-accent)] transition-colors">
                        点击选择
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs text-[var(--color-calendar-text-dim)] font-bold">时间</label>
                      <div className="space-y-2">
                        <div className="bg-[var(--color-calendar-surface-hover)] px-3 py-2 rounded-lg border border-[var(--color-calendar-border)] text-sm text-[var(--color-calendar-text-muted)] cursor-pointer hover:border-[var(--color-calendar-accent)] transition-colors">
                          开始：点击选择
                        </div>
                        <div className="bg-[var(--color-calendar-surface-hover)] px-3 py-2 rounded-lg border border-[var(--color-calendar-border)] text-sm text-[var(--color-calendar-text-muted)] cursor-pointer hover:border-[var(--color-calendar-accent)] transition-colors">
                          截止：点击选择
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs text-[var(--color-calendar-text-dim)] font-bold">@用户</label>
                      <div className="bg-[var(--color-calendar-surface-hover)] px-3 py-2 rounded-lg border border-[var(--color-calendar-border)] text-sm text-[var(--color-calendar-text-muted)] cursor-pointer hover:border-[var(--color-calendar-accent)] transition-colors">
                        点击选择
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="p-4 bg-[var(--color-calendar-sidebar-bg)] border-t border-[var(--color-calendar-border)] flex justify-end">
                <button 
                  onClick={() => setIsSearchModalOpen(false)}
                  className="px-6 py-2 bg-[var(--color-calendar-surface-hover)] hover:bg-[var(--color-calendar-surface-hover)]/80 rounded-xl text-sm font-medium transition-colors"
                >
                  关闭搜索
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Settings Modal */}
        {isSettingsOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-[var(--color-calendar-surface)] w-full max-w-md rounded-2xl shadow-2xl border border-[var(--color-calendar-border)] overflow-hidden"
            >
              <div className="p-6 border-b border-[var(--color-calendar-border)] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[var(--color-calendar-accent)]/10 flex items-center justify-center text-[var(--color-calendar-accent)]">
                    <Settings size={20} />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-[var(--color-calendar-text)]">系统设置</h2>
                    <p className="text-xs text-[var(--color-calendar-text-dim)]">自定义您的日历外观</p>
                  </div>
                </div>
                <button onClick={() => setIsSettingsOpen(false)} className="p-2 hover:bg-[var(--color-calendar-surface-hover)] rounded-full transition-colors">
                  <X size={20} className="text-[var(--color-calendar-text-dim)]" />
                </button>
              </div>

              <div className="p-6 space-y-8">
                <div className="space-y-4">
                  <label className="text-sm font-bold text-[var(--color-calendar-text-muted)] uppercase tracking-widest">显示模式</label>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      onClick={() => setThemeMode('light')}
                      className={cn(
                        "flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all",
                        themeMode === 'light' 
                          ? "bg-white text-black border-[var(--color-calendar-accent)] shadow-lg" 
                          : "bg-gray-100 text-gray-500 border-transparent hover:bg-gray-200"
                      )}
                    >
                      <div className="w-full h-12 bg-white rounded border border-gray-200 flex items-center px-2">
                        <div className="w-2 h-2 rounded-full bg-gray-300 mr-1" />
                        <div className="w-8 h-1 bg-gray-200 rounded" />
                      </div>
                      <span className="text-xs font-bold">浅色模式</span>
                    </button>
                    <button
                      onClick={() => setThemeMode('dark')}
                      className={cn(
                        "flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all",
                        themeMode === 'dark' 
                          ? "bg-[#1a1a1a] text-white border-[var(--color-calendar-accent)] shadow-lg" 
                          : "bg-[#2a2a2a] text-gray-400 border-transparent hover:bg-[#333]"
                      )}
                    >
                      <div className="w-full h-12 bg-[#1a1a1a] rounded border border-gray-800 flex items-center px-2">
                        <div className="w-2 h-2 rounded-full bg-gray-700 mr-1" />
                        <div className="w-8 h-1 bg-gray-800 rounded" />
                      </div>
                      <span className="text-xs font-bold">深色模式</span>
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-bold text-[var(--color-calendar-text-muted)] uppercase tracking-widest">主题颜色</label>
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-6 h-6 rounded-full border border-[var(--color-calendar-border)]" 
                        style={{ backgroundColor: themeColor }}
                      />
                      <span className="text-xs font-mono text-[var(--color-calendar-text-dim)] uppercase">{themeColor}</span>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-5 gap-3">
                    {['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316', '#6366f1', '#14b8a6'].map(color => (
                      <button
                        key={color}
                        onClick={() => setThemeColor(color)}
                        className={cn(
                          "w-full aspect-square rounded-xl border-2 transition-all transform hover:scale-110",
                          themeColor === color ? "border-white scale-110 shadow-lg" : "border-transparent"
                        )}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                    <div className="relative group">
                      <input 
                        type="color" 
                        value={themeColor}
                        onChange={(e) => setThemeColor(e.target.value)}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                      />
                      <div className="w-full aspect-square rounded-xl border-2 border-dashed border-[var(--color-calendar-border)] flex items-center justify-center group-hover:border-[var(--color-calendar-text-dim)] transition-colors">
                        <Plus size={20} className="text-[var(--color-calendar-text-dim)]" />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-[var(--color-calendar-surface-hover)] rounded-xl border border-[var(--color-calendar-border)] space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-[var(--color-calendar-text-muted)]">
                    <CheckCircle2 size={14} className="text-green-500" />
                    <span>自动保存</span>
                  </div>
                  <p className="text-xs text-[var(--color-calendar-text-dim)] leading-relaxed">
                    您的设置将自动保存到本地浏览器，下次打开时将保持您的个性化配置。
                  </p>
                </div>
              </div>

              <div className="p-4 bg-[var(--color-calendar-sidebar-bg)] border-t border-[var(--color-calendar-border)] flex justify-end">
                <button 
                  onClick={() => setIsSettingsOpen(false)}
                  className="px-8 py-2.5 bg-[var(--color-calendar-accent)] hover:opacity-90 rounded-xl text-sm font-bold text-white transition-all shadow-lg"
                >
                  完成设置
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
