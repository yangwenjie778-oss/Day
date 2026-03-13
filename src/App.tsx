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
  CheckCircle2
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
      className="absolute top-full left-0 mt-2 z-50 bg-[#1e1e1e] border border-[#333] rounded-xl shadow-2xl p-4 w-64"
    >
      <div className="flex items-center justify-between mb-4 px-2">
        <span className="text-lg font-semibold">{viewYear}年</span>
        <div className="flex gap-1">
          <button onClick={() => setViewYear(v => v - 1)} className="p-1 hover:bg-[#333] rounded"><ChevronUp size={16} /></button>
          <button onClick={() => setViewYear(v => v + 1)} className="p-1 hover:bg-[#333] rounded"><ChevronDown size={16} /></button>
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
                ? "bg-blue-600 text-white"
                : "hover:bg-[#333] text-[#888] hover:text-white"
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
      className="fixed z-[100] bg-[#1e1e1e] border border-[#333] rounded-lg shadow-xl py-1 w-32"
      style={{ top: y, left: x }}
      onClick={(e) => e.stopPropagation()}
    >
      <button 
        onClick={() => { onAdd(); onClose(); }}
        className="w-full text-left px-4 py-2 text-sm hover:bg-[#333] flex items-center gap-2"
      >
        <Plus size={14} /> 新增人员
      </button>
      <button 
        onClick={() => { onDelete(); onClose(); }}
        className="w-full text-left px-4 py-2 text-sm hover:bg-[#333] text-red-500 flex items-center gap-2"
      >
        <Trash2 size={14} /> 删除人员
      </button>
    </div>
  );
}

// --- Main App ---

export default function App() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [notes, setNotes] = useState<Record<string, Note>>({});
  const [people, setPeople] = useState<Person[]>([]);
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [isAddPersonModalOpen, setIsAddPersonModalOpen] = useState(false);
  const [newPersonName, setNewPersonName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Modal Editing State
  const [entries, setEntries] = useState<NoteEntry[]>([]);
  const [activeEntryIdx, setActiveEntryIdx] = useState(0);
  const [isEditingTagName, setIsEditingTagName] = useState(false);
  const [tempTagName, setTempTagName] = useState('');

  // Context Menu State
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, personId: number } | null>(null);

  const pickerRef = useRef<HTMLDivElement>(null);

  // Fetch people on mount
  useEffect(() => {
    const fetchPeople = async () => {
      try {
        const response = await fetch('/api/people');
        const data = await response.json();
        setPeople(data);
        if (data.length > 0) {
          setSelectedPerson(data[0]);
        }
      } catch (error) {
        console.error('Failed to fetch people:', error);
      }
    };
    fetchPeople();
  }, []);

  // Fetch notes when date or person changes
  useEffect(() => {
    if (!selectedPerson) return;
    
    const fetchNotes = async () => {
      try {
        const monthStr = format(currentDate, 'yyyy-MM');
        const response = await fetch(`/api/notes?month=${monthStr}&personId=${selectedPerson.id}`);
        const data: Note[] = await response.json();
        const notesMap = data.reduce((acc, note) => {
          acc[note.date] = note;
          return acc;
        }, {} as Record<string, Note>);
        setNotes(notesMap);
      } catch (error) {
        console.error('Failed to fetch notes:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchNotes();
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
      setEntries([{ tag: '默认', content: '', images: [] }]);
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
    if (!selectedDay || !selectedPerson || isSubmitting) return;
    const dateStr = format(selectedDay, 'yyyy-MM-dd');
    setIsSubmitting(true);
    
    try {
      const response = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: dateStr,
          entries: entries,
          personId: selectedPerson.id
        })
      });

      if (response.ok) {
        setNotes(prev => ({
          ...prev,
          [dateStr]: { date: dateStr, entries: entries }
        }));
        setIsModalOpen(false);
      } else {
        const err = await response.json();
        console.error('Save failed:', err);
      }
    } catch (error) {
      console.error('Failed to save note:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const deleteNote = async () => {
    if (!selectedDay || !selectedPerson || isSubmitting) return;
    const dateStr = format(selectedDay, 'yyyy-MM-dd');
    setIsSubmitting(true);
    
    try {
      const response = await fetch(`/api/notes/${selectedPerson.id}/${dateStr}`, { method: 'DELETE' });
      if (response.ok) {
        const newNotes = { ...notes };
        delete newNotes[dateStr];
        setNotes(newNotes);
        setIsModalOpen(false);
      }
    } catch (error) {
      console.error('Failed to delete note:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const addTag = () => {
    const newTag = `标签 ${entries.length + 1}`;
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
      const response = await fetch('/api/people', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newPersonName.trim() })
      });
      if (!response.ok) throw new Error('Failed to add person');
      const newPerson = await response.json();
      setPeople(prev => [...prev, newPerson]);
      setSelectedPerson(newPerson);
      setNewPersonName('');
      setIsAddPersonModalOpen(false);
    } catch (error) {
      console.error('Failed to add person:', error);
      alert('添加人员失败，请重试');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeletePerson = async (id: number) => {
    // In an iframe, we should avoid window.confirm. 
    // For now, we'll just execute it or you can add a custom modal.
    // I'll add a simple confirmation check via state if needed, 
    // but for immediate fix I'll just proceed or use a simpler check.
    try {
      const response = await fetch(`/api/people/${id}`, { method: 'DELETE' });
      if (response.ok) {
        setPeople(prev => prev.filter(p => p.id !== id));
        if (selectedPerson?.id === id) {
          const remaining = people.filter(p => p.id !== id);
          setSelectedPerson(remaining.length > 0 ? remaining[0] : null);
        }
      }
    } catch (error) {
      console.error('Failed to delete person:', error);
    }
  };

  const handleContextMenu = (e: React.MouseEvent, personId: number) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, personId });
  };

  const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

  return (
    <div className="min-h-screen bg-[#121212] text-[#e5e5e5] flex">
      {/* Sidebar */}
      <aside className="w-64 border-r border-[#333] flex flex-col bg-[#1a1a1a]">
        <div className="p-6 space-y-8">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-[#888] uppercase tracking-widest">我的日历</h3>
              <Plus size={14} className="text-[#555] cursor-pointer hover:text-white" onClick={() => setIsAddPersonModalOpen(true)} />
            </div>
            <div className="space-y-1">
              {people.slice(0, 1).map(p => (
                <div 
                  key={p.id}
                  onClick={() => setSelectedPerson(p)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors",
                    selectedPerson?.id === p.id ? "bg-blue-600/10 text-blue-500" : "hover:bg-[#2a2a2a]"
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
              <h3 className="text-xs font-bold text-[#888] uppercase tracking-widest">当前人员</h3>
              <Plus size={14} className="text-[#555] cursor-pointer hover:text-white" onClick={() => setIsAddPersonModalOpen(true)} />
            </div>
            <div className="space-y-1">
              {people.slice(1).map(p => (
                <div 
                  key={p.id}
                  onClick={() => setSelectedPerson(p)}
                  onContextMenu={(e) => handleContextMenu(e, p.id)}
                  className={cn(
                    "flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-colors group",
                    selectedPerson?.id === p.id ? "bg-blue-600/10 text-blue-500" : "hover:bg-[#2a2a2a]"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold" style={{ backgroundColor: p.avatar_color }}>
                      {p.name[0]}
                    </div>
                    <span className="text-sm font-medium">{p.name}</span>
                  </div>
                  {selectedPerson?.id === p.id && <CheckCircle2 size={14} className="text-blue-500" />}
                </div>
              ))}
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="flex items-center justify-between px-6 py-4 border-b border-[#333]">
          <div className="flex items-center gap-4">
            <button 
              onClick={handleToday}
              className="px-4 py-1.5 bg-[#2a2a2a] hover:bg-[#333] rounded text-sm font-medium transition-colors"
            >
              今天
            </button>
            <div className="flex items-center gap-1">
              <button onClick={handlePrevMonth} className="p-1 hover:bg-[#2a2a2a] rounded transition-colors">
                <ChevronLeft size={20} />
              </button>
              <button onClick={handleNextMonth} className="p-1 hover:bg-[#2a2a2a] rounded transition-colors">
                <ChevronRight size={20} />
              </button>
            </div>
            <div className="relative" ref={pickerRef}>
              <button 
                onClick={() => setIsPickerOpen(!isPickerOpen)}
                className="flex items-center gap-1 text-2xl font-semibold ml-2 hover:bg-[#2a2a2a] px-2 py-1 rounded transition-colors"
              >
                {format(currentDate, 'yyyy年M月')}
                <ChevronDown size={20} className={cn("transition-transform", isPickerOpen && "rotate-180")} />
              </button>
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
            <div className="flex bg-[#2a2a2a] rounded p-1">
              {['日', '周', '月', '列表'].map((view) => (
                <button 
                  key={view}
                  className={cn(
                    "px-4 py-1 rounded text-sm transition-colors",
                    view === '月' ? "bg-[#333] text-white" : "text-[#888] hover:text-white"
                  )}
                >
                  {view}
                </button>
              ))}
            </div>
            <button className="p-2 hover:bg-[#2a2a2a] rounded transition-colors">
              <Search size={20} className="text-[#888]" />
            </button>
          </div>
        </header>

        {/* Weekday labels */}
        <div className="grid grid-cols-7 border-b border-[#333]">
          {weekDays.map(day => (
            <div key={day} className="py-2 text-center text-xs font-medium text-[#888] uppercase tracking-wider">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        <main className="flex-1 overflow-auto">
          <div className="grid grid-cols-7 h-full min-h-[600px]">
            {calendarDays.map((day, idx) => (
              <div 
                key={idx}
                onClick={() => openNoteModal(day.date)}
                className={cn(
                  "calendar-cell group relative flex flex-col gap-1 cursor-pointer",
                  !day.isCurrentMonth && "other-month",
                  day.isToday && "today"
                )}
              >
                <div className="flex justify-between items-start">
                  <span className={cn(
                    "text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full transition-colors",
                    day.isToday ? "bg-blue-600 text-white" : "text-[#e5e5e5] group-hover:bg-[#333]"
                  )}>
                    {format(day.date, 'd')}
                  </span>
                  {day.isToday && <span className="text-[10px] text-blue-500 font-bold mt-1.5 mr-1">TODAY</span>}
                </div>

                {/* Note Preview */}
                <div className="flex-1 overflow-hidden">
                  {day.note && day.note.entries && day.note.entries.length > 0 && (
                    <div className="space-y-1">
                      {day.note.entries.map((entry, eIdx) => (
                        <div key={eIdx} className="space-y-0.5">
                          {entry.content && (
                            <p className="text-[10px] text-[#aaa] line-clamp-1 leading-tight">
                              <span className="text-blue-500/70 font-bold">[{entry.tag}]</span> {entry.content}
                            </p>
                          )}
                          {entry.images && entry.images.length > 0 && eIdx === 0 && (
                            <div className="relative h-10 w-full rounded overflow-hidden mt-1 bg-[#222] flex gap-0.5">
                              {entry.images.slice(0, 3).map((img, iIdx) => (
                                <img 
                                  key={iIdx}
                                  src={img} 
                                  alt="preview" 
                                  className="flex-1 h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity"
                                  referrerPolicy="no-referrer"
                                />
                              ))}
                              {entry.images.length > 3 && (
                                <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-[10px] font-bold">
                                  +{entry.images.length - 3}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Hover Action */}
                <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Plus size={16} className="text-blue-500" />
                </div>
              </div>
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
              className="bg-[#1e1e1e] w-full max-w-3xl rounded-xl border border-[#333] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-[#333]">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-600/20 rounded-lg">
                    <CalendarIcon size={20} className="text-blue-500" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold">
                      {selectedDay && format(selectedDay, 'yyyy年M月d日')}
                    </h2>
                    <p className="text-xs text-[#888]">
                      {selectedPerson?.name} 的记录
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 hover:bg-[#333] rounded-full transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Tabs Bar */}
              <div className="flex items-center px-6 py-2 bg-[#252525] border-b border-[#333] gap-2 overflow-x-auto no-scrollbar">
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
                          ? "bg-blue-600 text-white shadow-lg shadow-blue-900/20" 
                          : "text-[#888] hover:text-[#e5e5e5] hover:bg-[#333]"
                      )}
                    >
                      {entry.tag}
                      {activeEntryIdx === idx && !isEditingTagName && (
                        <Edit2 size={12} className="opacity-60 hover:opacity-100" onClick={(e) => { e.stopPropagation(); startRenameTag(); }} />
                      )}
                    </button>
                    {entries.length > 1 && (
                      <button 
                        onClick={() => removeTag(idx)}
                        className="ml-1 p-1 text-[#555] hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>
                ))}
                <button 
                  onClick={addTag}
                  className="p-1.5 text-blue-500 hover:bg-blue-500/10 rounded-lg transition-colors ml-2"
                  title="添加新标签"
                >
                  <Plus size={18} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Tag Name Editor */}
                {isEditingTagName && (
                  <div className="flex items-center gap-2 p-3 bg-blue-600/10 rounded-lg border border-blue-600/30">
                    <input 
                      autoFocus
                      value={tempTagName}
                      onChange={(e) => setTempTagName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && confirmRenameTag()}
                      className="bg-transparent border-none outline-none text-sm flex-1 font-medium"
                      placeholder="输入标签名称..."
                    />
                    <button onClick={confirmRenameTag} className="p-1 hover:bg-blue-600/20 rounded text-blue-500"><Check size={16} /></button>
                    <button onClick={() => setIsEditingTagName(false)} className="p-1 hover:bg-red-500/20 rounded text-red-500"><X size={16} /></button>
                  </div>
                )}

                {/* Text Editor */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-[#888] uppercase tracking-wider">
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
                    className="w-full h-32 bg-[#121212] border border-[#333] rounded-lg p-4 text-sm focus:outline-none focus:border-blue-500 transition-colors resize-none"
                  />
                </div>

                {/* Multiple Image Upload */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-[#888] uppercase tracking-wider">截图/图片 ({entries[activeEntryIdx]?.images.length || 0})</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {entries[activeEntryIdx]?.images.map((img, imgIdx) => (
                      <div key={imgIdx} className="relative group aspect-video rounded-lg overflow-hidden border border-[#333] bg-[#121212]">
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
                    <label className="aspect-video border-2 border-dashed border-[#333] hover:border-blue-500/50 hover:bg-blue-500/5 rounded-lg flex flex-col items-center justify-center gap-2 cursor-pointer transition-all group">
                      <div className="p-2 bg-[#2a2a2a] rounded-full group-hover:bg-blue-600/20 transition-colors">
                        <Plus size={20} className="text-[#888] group-hover:text-blue-500" />
                      </div>
                      <span className="text-[10px] text-[#888] group-hover:text-[#e5e5e5]">添加图片</span>
                      <input type="file" multiple accept="image/*" className="hidden" onChange={handleImageUpload} />
                    </label>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between px-6 py-4 bg-[#252525] border-t border-[#333]">
                <button 
                  onClick={deleteNote}
                  className="flex items-center gap-2 px-4 py-2 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors text-sm"
                >
                  <Trash2 size={18} />
                  清空此日所有记录
                </button>
                <div className="flex gap-3">
                  <button 
                    onClick={() => setIsModalOpen(false)}
                    className="px-6 py-2 text-sm font-medium hover:bg-[#333] rounded-lg transition-colors"
                  >
                    取消
                  </button>
                <button 
                  onClick={saveNote}
                  disabled={isSubmitting}
                  className={cn(
                    "flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm font-medium shadow-lg shadow-blue-900/20",
                    isSubmitting && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <Save size={18} />
                  {isSubmitting ? '保存中...' : '保存全部更改'}
                </button>
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
              className="bg-[#1e1e1e] w-full max-w-sm rounded-xl border border-[#333] shadow-2xl p-6 space-y-4"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <User size={20} className="text-blue-500" />
                  新增人员
                </h2>
                <button onClick={() => setIsAddPersonModalOpen(false)} className="text-[#555] hover:text-white">
                  <X size={20} />
                </button>
              </div>
              <div className="space-y-2">
                <label className="text-xs text-[#888] uppercase font-bold">人员姓名</label>
                <input 
                  autoFocus
                  value={newPersonName}
                  onChange={(e) => setNewPersonName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddPerson()}
                  placeholder="请输入姓名..."
                  className="w-full bg-[#121212] border border-[#333] rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button 
                  onClick={() => setIsAddPersonModalOpen(false)}
                  className="flex-1 py-2 text-sm font-medium bg-[#2a2a2a] hover:bg-[#333] rounded-lg transition-colors"
                >
                  取消
                </button>
                <button 
                  onClick={handleAddPerson}
                  disabled={isSubmitting || !newPersonName.trim()}
                  className={cn(
                    "flex-1 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors shadow-lg shadow-blue-900/20",
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
    </div>
  );
}
