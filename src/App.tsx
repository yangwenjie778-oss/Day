import React, { useState, useEffect, useMemo, useRef, memo, useCallback, useTransition } from 'react';
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
  getMonth,
  parseISO
} from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { dialog, fs, path } from '@tauri-apps/api';
import { appWindow } from '@tauri-apps/api/window';
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
  Settings,
  Download,
  Upload,
  FileText
} from 'lucide-react';
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
    <div 
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
    </div>
  );
}

interface ContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  onDelete: () => void;
  onAdd: () => void;
  onRename: () => void;
}

function ContextMenu({ x, y, onClose, onDelete, onAdd, onRename }: ContextMenuProps) {
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
        onClick={() => { onRename(); onClose(); }}
        className="w-full text-left px-4 py-2 text-sm hover:bg-[var(--color-calendar-surface-hover)] flex items-center gap-2"
      >
        <Edit2 size={14} /> 重命名
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
  isSelected, 
  onClick, 
  onContextMenu 
}: { 
  day: CalendarDay, 
  isSelected: boolean, 
  onClick: (date: Date) => void,
  onContextMenu: (e: React.MouseEvent, date: Date) => void
}) => {
  const isToday = isSameDay(day.date, new Date());
  const note = day.note;
  
  return (
    <div 
      onClick={() => onClick(day.date)}
      onContextMenu={(e) => onContextMenu(e, day.date)}
      className={cn(
        "min-h-[120px] p-1.5 border-r border-b border-[var(--color-calendar-border)] transition-all cursor-pointer group relative overflow-hidden",
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
      
      <div className="space-y-0.5 overflow-hidden">
        {note && note.entries && note.entries
          .filter((entry: any) => entry.content || (entry.images && entry.images.length > 0))
          .slice(0, 15)
          .map((entry: any, eIdx: number) => (
            <div key={eIdx} className="space-y-0.5">
              {entry.content && (
                <p className="text-[10px] text-[var(--color-calendar-text-secondary)] line-clamp-1 leading-tight">
                  {entry.tag && <span className="text-[var(--color-calendar-accent)]/70 font-bold">[{entry.tag}] </span>}
                  {entry.content}
                </p>
              )}
              {entry.images && entry.images.length > 0 && (
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
        {note && note.entries && note.entries.length > 15 && (
          <p className="text-[9px] text-[var(--color-calendar-accent)] font-bold">+{note.entries.length - 15} 更多...</p>
        )}
      </div>
    </div>
  );
}, (prev, next) => {
  return (
    prev.isSelected === next.isSelected &&
    prev.day.isCurrentMonth === next.day.isCurrentMonth &&
    prev.day.date.getTime() === next.day.date.getTime() &&
    prev.day.note === next.day.note
  );
});

// Memoized Calendar Grid to isolate it from Modal state changes
const Sidebar = memo(({ 
  people, 
  selectedPerson, 
  setSelectedPerson, 
  setIsAddPersonModalOpen, 
  handleContextMenu, 
  setIsSettingsOpen,
  onQuickBackup,
  backupPath
}: any) => {
  return (
    <aside className="w-64 border-r border-[var(--color-calendar-border)] flex flex-col bg-[var(--color-calendar-sidebar-bg)]">
      <div className="p-6 space-y-8">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-[var(--color-calendar-text-muted)] uppercase tracking-widest">我的日历</h3>
            <Plus size={14} className="text-[var(--color-calendar-text-dim)] cursor-pointer hover:text-white" onClick={() => setIsAddPersonModalOpen(true)} />
          </div>
          <div className="space-y-1">
            {people.slice(0, 1).map((p: Person) => (
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
            {people.slice(1).map((p: Person) => (
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

      <div className="mt-auto p-6 border-t border-[var(--color-calendar-border)] space-y-2">
        <button 
          onClick={onQuickBackup}
          title={backupPath ? `自动备份到: ${backupPath}` : "请先在设置中配置备份路径"}
          className={cn(
            "flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors w-full text-sm font-medium",
            backupPath 
              ? "bg-[var(--color-calendar-accent)]/10 text-[var(--color-calendar-accent)] hover:bg-[var(--color-calendar-accent)]/20" 
              : "text-[var(--color-calendar-text-dim)] hover:bg-[var(--color-calendar-surface-hover)]"
          )}
        >
          <Save size={18} />
          <span>一键备份</span>
        </button>
        <button 
          onClick={() => setIsSettingsOpen(true)}
          className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors hover:bg-[var(--color-calendar-surface-hover)] w-full text-[var(--color-calendar-text-muted)] hover:text-white"
        >
          <Settings size={18} />
          <span className="text-sm font-medium">设置</span>
        </button>
      </div>
    </aside>
  );
});

const Header = memo(({ 
  currentDate, 
  handleToday, 
  handlePrevMonth, 
  handleNextMonth, 
  isPickerOpen, 
  setIsPickerOpen, 
  pickerRef, 
  selectedPerson, 
  setCurrentDate, 
  setIsMonthSummaryOpen, 
  setIsSearchModalOpen 
}: any) => {
  return (
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
            {isPickerOpen && (
              <YearMonthPicker 
                currentDate={currentDate} 
                onSelect={setCurrentDate} 
                onClose={() => setIsPickerOpen(false)} 
              />
            )}
          </div>
      </div>

      <div className="flex items-center gap-4">
        <button 
          onClick={() => setIsMonthSummaryOpen(true)}
          className="flex items-center gap-2 px-4 py-1.5 bg-[var(--color-calendar-accent)]/10 text-[var(--color-calendar-accent)] hover:bg-[var(--color-calendar-accent)]/20 rounded-lg text-sm font-bold transition-all border border-[var(--color-calendar-accent)]/20 shadow-sm"
        >
          <FileText size={16} />
          月总结
        </button>
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
          <Search size={20} className="text-[var(--color-calendar-text-dim)]" />
        </button>
      </div>
    </header>
  );
});

// Memoized Calendar Grid to isolate it from Modal state changes
const CalendarGrid = React.memo(({ 
  calendarDays, 
  selectedDay, 
  notes,
  openNoteModal,
  onContextMenu
}: { 
  calendarDays: CalendarDay[], 
  selectedDay: Date | null, 
  notes: Record<string, Note>,
  openNoteModal: (day: Date) => void,
  onContextMenu: (e: React.MouseEvent, date: Date) => void
}) => {
  return (
    <main className="flex-1 overflow-auto">
      <div className="grid grid-cols-7 h-full min-h-[600px]">
        {calendarDays.map((day, idx) => {
          const dateStr = format(day.date, 'yyyy-MM-dd');
          const note = notes[dateStr];
          return (
            <CalendarDayCell 
              key={idx}
              day={{ ...day, note }}
              isSelected={selectedDay ? isSameDay(day.date, selectedDay) : false}
              onClick={openNoteModal}
              onContextMenu={onContextMenu}
            />
          );
        })}
      </div>
    </main>
  );
});

const MonthSummaryModal = memo(({ 
  currentDate, 
  people, 
  allNotes,
  onClose,
  onPreviewImage,
  onEditDay
}: { 
  currentDate: Date, 
  people: Person[], 
  allNotes: Record<string, Note>,
  onClose: () => void,
  onPreviewImage: (src: string) => void,
  onEditDay: (day: Date, person: Person) => void
}) => {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  
  // Memoize month days calculation
  const monthDays = useMemo(() => 
    eachDayOfInterval({ start: monthStart, end: monthEnd }),
    [monthStart, monthEnd]
  );

  // Memoize grouped data to avoid heavy calculations on every render
  const groupedData = useMemo(() => {
    return monthDays.map(day => {
      const dateStr = format(day, 'yyyy-MM-dd');
      const dayEntries: { person: Person, note: Note }[] = [];
      
      people.forEach(person => {
        const key = `${person.id}_${dateStr}`;
        const note = allNotes[key];
        if (note && note.entries) {
          const validEntries = note.entries.filter(e => 
            (e.content && e.content.trim() !== '') || 
            (e.images && e.images.length > 0)
          );
          if (validEntries.length > 0) {
            dayEntries.push({ person, note: { ...note, entries: validEntries } });
          }
        }
      });

      return { day, dateStr, dayEntries };
    }).filter(item => item.dayEntries.length > 0);
  }, [monthDays, people, allNotes]);

  const exportMonthToHtml = useCallback(() => {
    const fileName = `${format(currentDate, 'yyyy年M月')}_全员月度总结.html`;
    
    const sortedDates = groupedData.map(item => item.dateStr).sort((a, b) => a.localeCompare(b));
    
    let htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>${format(currentDate, 'yyyy年M月')} 全员月度总结</title>
        <style>
          :root {
            --primary: #2563eb;
            --bg: #f8fafc;
            --card-bg: #ffffff;
            --text: #1e293b;
            --text-muted: #64748b;
            --border: #e2e8f0;
          }
          body { 
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; 
            line-height: 1.6; 
            color: var(--text); 
            max-width: 1000px; 
            margin: 0 auto; 
            padding: 40px 20px; 
            background: var(--bg); 
          }
          .header { 
            text-align: center; 
            margin-bottom: 40px; 
            background: var(--card-bg); 
            padding: 40px; 
            border-radius: 16px; 
            box-shadow: 0 4px 20px rgba(0,0,0,0.03); 
            border: 1px solid var(--border);
          }
          h1 { margin: 0; color: var(--primary); font-size: 2.5em; font-weight: 800; }
          .meta { color: var(--text-muted); margin-top: 12px; font-size: 0.95em; }
          
          .date-section { 
            margin-bottom: 40px; 
          }
          .date-header {
            font-size: 1.8em;
            font-weight: 800;
            color: var(--primary);
            margin-bottom: 20px;
            display: flex;
            align-items: center;
            gap: 15px;
            padding-bottom: 10px;
            border-bottom: 3px solid var(--primary);
          }
          
          .notes-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
            gap: 20px;
          }
          
          .note-card {
            background: var(--card-bg);
            border-radius: 16px;
            border: 1px solid var(--border);
            overflow: hidden;
            display: flex;
            flex-direction: column;
            box-shadow: 0 4px 15px rgba(0,0,0,0.02);
            transition: transform 0.2s;
          }
          
          .person-header {
            padding: 15px 20px;
            background: #f8fafc;
            border-bottom: 1px solid var(--border);
            display: flex;
            align-items: center;
            gap: 12px;
          }
          
          .avatar {
            width: 32px;
            height: 32px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: bold;
            font-size: 14px;
          }
          
          .person-name {
            font-weight: 700;
            font-size: 15px;
          }
          
          .note-content {
            padding: 20px;
            flex: 1;
          }
          
          .entry {
            margin-bottom: 20px;
            padding-bottom: 15px;
            border-bottom: 1px dashed var(--border);
          }
          .entry:last-child {
            margin-bottom: 0;
            padding-bottom: 0;
            border-bottom: none;
          }
          
          .tag {
            display: inline-block;
            padding: 2px 8px;
            background: #eff6ff;
            color: var(--primary);
            font-size: 11px;
            font-weight: 700;
            border-radius: 4px;
            margin-bottom: 8px;
            text-transform: uppercase;
          }
          
          .text {
            font-size: 14px;
            white-space: pre-wrap;
            margin-bottom: 12px;
          }
          
          .images {
            display: flex;
            gap: 10px;
            overflow-x: auto;
            padding-bottom: 5px;
          }
          
          .img-wrapper {
            width: 120px;
            height: 80px;
            border-radius: 8px;
            overflow: hidden;
            border: 1px solid var(--border);
            flex-shrink: 0;
          }
          
          .img-wrapper img {
            width: 100%;
            height: 100%;
            object-fit: cover;
          }
          
          @media print {
            body { padding: 0; background: white; }
            .header { box-shadow: none; border: 1px solid #eee; }
            .note-card { break-inside: avoid; box-shadow: none; border: 1px solid #eee; }
            .date-section { break-inside: avoid; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${format(currentDate, 'yyyy年M月')} 全员月度总结</h1>
          <div class="meta">导出时间: ${format(new Date(), 'yyyy-MM-dd HH:mm:ss')}</div>
        </div>
        
        ${groupedData.map(({ day, dateStr, dayEntries }) => {
          return `
            <div class="date-section">
              <div class="date-header">
                <span>${format(day, 'M月d日')}</span>
                <span style="font-size: 0.6em; opacity: 0.6;">${format(day, 'EEEE', { locale: zhCN })}</span>
              </div>
              <div class="notes-grid">
                ${dayEntries.map(({ person, note }) => `
                  <div class="note-card">
                    <div class="person-header">
                      <div class="avatar" style="background-color: ${person.avatar_color}">${person.name[0]}</div>
                      <div class="person-name">${person.name}</div>
                    </div>
                    <div class="note-content">
                      ${note.entries.map(entry => `
                        <div class="entry">
                          ${entry.tag ? `<div class="tag">${entry.tag}</div>` : ''}
                          <div class="text">${entry.content || ''}</div>
                          ${entry.images && entry.images.length > 0 ? `
                            <div class="images">
                              ${entry.images.map(img => `
                                <div class="img-wrapper">
                                  <img src="${img}" />
                                </div>
                              `).join('')}
                            </div>
                          ` : ''}
                        </div>
                      `).join('')}
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>
          `;
        }).join('')}
      </body>
      </html>
    `;

    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [currentDate, groupedData]);
  
  return (
    <div id="month-summary-modal-container" className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-8 bg-black/60 backdrop-blur-sm">
      <div 
        className="w-full h-full max-w-[95vw] bg-[var(--color-calendar-sidebar-bg)] rounded-3xl border border border-[var(--color-calendar-border)] shadow-2xl flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="px-8 py-6 border-b border-[var(--color-calendar-border)] flex items-center justify-between bg-[var(--color-calendar-sidebar-bg)]/80 backdrop-blur-md sticky top-0 z-10 no-print">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-[var(--color-calendar-accent)]/20 flex items-center justify-center text-[var(--color-calendar-accent)]">
              <CalendarIcon size={28} />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">{format(currentDate, 'yyyy年M月')} 全员月度总结</h2>
              <p className="text-sm text-[var(--color-calendar-text-muted)] mt-1">直观查看本月所有人员的日历记录</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={exportMonthToHtml}
              className="flex items-center gap-2 px-4 py-2 bg-[var(--color-calendar-surface-hover)] hover:bg-[var(--color-calendar-accent)]/10 hover:text-[var(--color-calendar-accent)] rounded-xl text-sm font-bold transition-all border border-[var(--color-calendar-border)]"
            >
              <Download size={18} />
              打印 / 导出
            </button>
            <button 
              onClick={onClose}
              className="p-3 hover:bg-[var(--color-calendar-surface-hover)] rounded-2xl transition-all text-[var(--color-calendar-text-muted)] hover:text-white"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8 space-y-8 no-scrollbar">
          {groupedData.map(({ day, dateStr, dayEntries }) => (
            <div key={dateStr} className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="px-4 py-1.5 bg-[var(--color-calendar-accent)] text-white text-sm font-bold rounded-full shadow-lg shadow-[var(--color-calendar-accent)]/20">
                  {format(day, 'M月d日')} {format(day, 'EEEE', { locale: zhCN })}
                </div>
                <div className="h-px flex-1 bg-gradient-to-r from-[var(--color-calendar-border)] to-transparent" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-6">
                {dayEntries.map(({ person, note }) => (
                  <div 
                    key={person.id} 
                    onClick={() => onEditDay(day, person)}
                    className="bg-[var(--color-calendar-surface)] rounded-2xl border border-[var(--color-calendar-border)] overflow-hidden flex flex-col shadow-sm hover:shadow-md transition-all hover:border-[var(--color-calendar-accent)]/30 group cursor-pointer"
                  >
                    <div className="px-4 py-3 border-b border-[var(--color-calendar-border)] flex items-center justify-between bg-[var(--color-calendar-surface-hover)]/30 group-hover:bg-[var(--color-calendar-accent)]/5 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-inner" style={{ backgroundColor: person.avatar_color }}>
                          {person.name[0]}
                        </div>
                        <span className="font-bold text-sm text-[var(--color-calendar-text)]">{person.name}</span>
                      </div>
                    </div>
                    <div className="p-4 space-y-4 flex-1">
                      {note.entries.map((entry, eIdx) => (
                        <div key={eIdx} className="space-y-2 pb-3 last:pb-0 border-b last:border-0 border-[var(--color-calendar-border)]/50">
                          {entry.tag && (
                            <span className="inline-block px-2 py-0.5 bg-[var(--color-calendar-accent)]/10 text-[var(--color-calendar-accent)] text-[10px] font-bold rounded uppercase tracking-wider">
                              {entry.tag}
                            </span>
                          )}
                          <p className="text-sm text-[var(--color-calendar-text)] whitespace-pre-wrap leading-relaxed">
                            {entry.content || <span className="text-[var(--color-calendar-text-dim)] italic">无文字内容</span>}
                          </p>
                          {entry.images && entry.images.length > 0 && (
                            <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                              {entry.images.map((img, iIdx) => (
                                <div key={iIdx} className="flex-shrink-0 w-24 aspect-video rounded-lg overflow-hidden border border-[var(--color-calendar-border)] shadow-sm">
                                  <img 
                                    src={img} 
                                    alt="record" 
                                    className="w-full h-full object-cover cursor-zoom-in hover:opacity-80 transition-opacity" 
                                    referrerPolicy="no-referrer" 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onPreviewImage(img);
                                    }}
                                  />
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {groupedData.length === 0 && (
            <div className="h-[60vh] flex flex-col items-center justify-center text-[var(--color-calendar-text-dim)] gap-6">
              <div className="w-32 h-32 rounded-full bg-[var(--color-calendar-surface-hover)] flex items-center justify-center">
                <CalendarIcon size={64} className="opacity-10" />
              </div>
              <div className="text-center space-y-2">
                <p className="text-xl font-bold text-white">本月暂无记录</p>
                <p className="text-sm">当月所有人员都还没有添加任何日历备注</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 bg-[var(--color-calendar-sidebar-bg)] border-t border-[var(--color-calendar-border)] flex justify-between items-center no-print">
           <div className="text-xs text-[var(--color-calendar-text-dim)]">
             共计 {monthDays.length} 天 · {people.length} 位人员
           </div>
           <button 
            onClick={onClose}
            className="px-8 py-3 bg-[var(--color-calendar-accent)] hover:opacity-90 rounded-2xl text-sm font-bold text-white transition-all shadow-lg shadow-[var(--color-calendar-accent)]/20"
          >
            返回日历
          </button>
        </div>
      </div>
    </div>
  );
});

// Memoized Note Modal to isolate its state from the rest of the app
const NoteModal = React.memo(({ 
  isOpen, 
  onClose, 
  selectedDay, 
  selectedPerson, 
  initialEntries, 
  onSave,
  getSummaryDataForDay, 
  setPreviewImage, 
  setIsPreviewOpen,
  isSubmitting,
  setIsConfirmDeleteOpen
}: any) => {
  const [entries, setEntries] = useState<NoteEntry[]>([]);
  const [localContent, setLocalContent] = useState('');
  const [activeEntryIdx, setActiveEntryIdx] = useState(0);
  const [isEditingTagName, setIsEditingTagName] = useState(false);
  const [tempTagName, setTempTagName] = useState('');
  const contentTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [hasInitialized, setHasInitialized] = useState(false);

  useEffect(() => {
    if (isOpen && !hasInitialized) {
      setEntries(initialEntries || []);
      setActiveEntryIdx(0);
      setHasInitialized(true);
    }
  }, [isOpen, initialEntries, hasInitialized]);

  useEffect(() => {
    if (!isOpen) {
      setHasInitialized(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (entries[activeEntryIdx]) {
      setLocalContent(entries[activeEntryIdx].content || '');
    } else {
      setLocalContent('');
    }
  }, [activeEntryIdx, entries]);

  const handleContentChange = (val: string) => {
    setLocalContent(val);
    if (contentTimeoutRef.current) clearTimeout(contentTimeoutRef.current);
    
    contentTimeoutRef.current = setTimeout(() => {
      setEntries(prev => {
        if (!prev[activeEntryIdx]) return prev;
        const updated = [...prev];
        updated[activeEntryIdx] = { ...updated[activeEntryIdx], content: val };
        return updated;
      });
    }, 300);
  };

  const handleClose = () => {
    if (contentTimeoutRef.current) clearTimeout(contentTimeoutRef.current);
    onSave(entries);
    onClose();
  };

  const compressImage = (base64: string, maxWidth = 1000, maxHeight = 1000, quality = 0.7): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = base64;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height *= maxWidth / width;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width *= maxHeight / height;
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        } else {
          resolve(base64);
        }
      };
      img.onerror = () => resolve(base64);
    });
  };

  if (!isOpen) return null;

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    const files: File[] = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) files.push(file);
      }
    }

    if (files.length > 0) {
      const readers = files.map((file: File) => {
        return new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
      });

      Promise.all(readers).then(async newImages => {
        const compressedImages = await Promise.all(newImages.map(img => compressImage(img)));
        setEntries(prev => {
          if (!prev[activeEntryIdx]) return prev;
          const updated = [...prev];
          updated[activeEntryIdx] = {
            ...updated[activeEntryIdx],
            images: [...(updated[activeEntryIdx].images || []), ...compressedImages]
          };
          return updated;
        });
      });
    }
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

      Promise.all(readers).then(async newImages => {
        const compressedImages = await Promise.all(newImages.map(img => compressImage(img)));
        setEntries(prev => {
          if (!prev[activeEntryIdx]) return prev;
          const updated = [...prev];
          updated[activeEntryIdx] = {
            ...updated[activeEntryIdx],
            images: [...(updated[activeEntryIdx].images || []), ...compressedImages]
          };
          return updated;
        });
      });
    }
    e.target.value = '';
  };

  const removeImage = (imgIdx: number) => {
    setEntries(prev => {
      const updated = [...prev];
      if (!updated[activeEntryIdx]) return prev;
      const updatedImages = [...(updated[activeEntryIdx].images || [])];
      updatedImages.splice(imgIdx, 1);
      updated[activeEntryIdx] = {
        ...updated[activeEntryIdx],
        images: updatedImages
      };
      return updated;
    });
  };

  const addTag = () => {
    setEntries(prev => [...prev, { tag: '新标签', content: '', images: [] }]);
    setActiveEntryIdx(entries.length);
  };

  const removeTag = (idx: number) => {
    if (entries.length <= 1) return;
    setEntries(prev => {
      const updated = [...prev];
      updated.splice(idx, 1);
      return updated;
    });
    if (activeEntryIdx >= idx && activeEntryIdx > 0) {
      setActiveEntryIdx(activeEntryIdx - 1);
    }
  };

  const startRenameTag = (idx: number) => {
    setActiveEntryIdx(idx);
    setTempTagName(entries[idx].tag || '');
    setIsEditingTagName(true);
  };

  const confirmRenameTag = () => {
    if (tempTagName.trim()) {
      setEntries(prev => {
        const updated = [...prev];
        updated[activeEntryIdx] = { ...updated[activeEntryIdx], tag: tempTagName.trim() };
        return updated;
      });
    }
    setIsEditingTagName(false);
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div 
        onPaste={handlePaste}
        className={cn(
          "bg-[var(--color-calendar-surface)] w-full rounded-xl border border-[var(--color-calendar-border)] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]",
          selectedPerson?.id === 1 ? "max-w-5xl" : "max-w-3xl"
        )}
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
              onClick={handleClose}
              className="p-2 hover:bg-[var(--color-calendar-surface-hover)] rounded-full transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Tabs Bar */}
          {selectedPerson?.id !== 1 && (
            <div className="flex items-center px-6 py-2 bg-[var(--color-calendar-surface)] border-b border-[var(--color-calendar-border)] gap-2 overflow-x-auto no-scrollbar">
              {entries.map((entry: any, idx: number) => (
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
                    {activeEntryIdx === idx && !isEditingTagName && selectedPerson?.id !== 1 && (
                      <Edit2 size={12} className="opacity-60 hover:opacity-100" onClick={(e) => { e.stopPropagation(); startRenameTag(idx); }} />
                    )}
                  </button>
                  {entries.length > 1 && selectedPerson?.id !== 1 && (
                    <button 
                      onClick={() => removeTag(idx)}
                      className="ml-1 p-1 text-[var(--color-calendar-text-dim)] hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              ))}
              {selectedPerson?.id !== 1 && (
                <button 
                  onClick={addTag}
                  className="p-1.5 text-[var(--color-calendar-accent)] hover:bg-[var(--color-calendar-accent)]/10 rounded-lg transition-colors ml-2"
                  title="添加新标签"
                >
                  <Plus size={18} />
                </button>
              )}
            </div>
          )}

          {selectedPerson?.id === 1 ? (
            <div className="flex-1 overflow-y-auto p-6 bg-[var(--color-calendar-page-bg)]/50">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {selectedDay && getSummaryDataForDay(selectedDay).map(({ person, note }: any) => (
                  <div key={person.id} className="bg-[var(--color-calendar-surface)] rounded-xl border border-[var(--color-calendar-border)] overflow-hidden flex flex-col shadow-sm hover:shadow-md transition-shadow">
                    <div className="px-4 py-3 border-b border-[var(--color-calendar-border)] flex items-center gap-3 bg-[var(--color-calendar-surface-hover)]/30">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-inner" style={{ backgroundColor: person.avatar_color }}>
                        {person.name[0]}
                      </div>
                      <span className="font-bold text-sm text-[var(--color-calendar-text)]">{person.name}</span>
                    </div>
                    <div className="p-4 space-y-5 flex-1">
                      {note.entries.filter((e: any) => (e.content && e.content.trim()) || (e.images && e.images.length > 0)).map((entry: any, eIdx: number) => (
                        <div key={eIdx} className="space-y-3 pb-4 last:pb-0 border-b last:border-0 border-[var(--color-calendar-border)]/50">
                          {entry.tag && (
                            <span className="inline-block px-2 py-0.5 bg-[var(--color-calendar-accent)]/10 text-[var(--color-calendar-accent)] text-[10px] font-bold rounded uppercase tracking-wider">
                              {entry.tag}
                            </span>
                          )}
                          <p className="text-sm text-[var(--color-calendar-text)] whitespace-pre-wrap leading-relaxed">
                            {entry.content}
                          </p>
                          {entry.images && entry.images.length > 0 && (
                            <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                              {entry.images.map((img: string, iIdx: number) => (
                                <div key={iIdx} className="flex-shrink-0 w-28 aspect-video rounded-lg overflow-hidden border border-[var(--color-calendar-border)] shadow-sm">
                                  <img 
                                    src={img} 
                                    alt="record" 
                                    className="w-full h-full object-cover cursor-zoom-in" 
                                    referrerPolicy="no-referrer" 
                                    onClick={() => { setPreviewImage(img); setIsPreviewOpen(true); }}
                                  />
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                {selectedDay && getSummaryDataForDay(selectedDay).length === 0 && (
                  <div className="col-span-full py-24 flex flex-col items-center justify-center text-[var(--color-calendar-text-dim)] gap-4">
                    <div className="w-20 h-20 rounded-full bg-[var(--color-calendar-surface-hover)] flex items-center justify-center">
                      <Users size={40} className="opacity-20" />
                    </div>
                    <p className="text-sm font-medium">该日期暂无任何人员记录</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
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
              <label className="text-xs font-bold text-[var(--color-calendar-text-muted)] uppercase tracking-wider">
                <span className="text-[var(--color-calendar-accent)]">[{entries[activeEntryIdx]?.tag}]</span> 备注内容
              </label>
              <textarea 
                value={localContent}
                readOnly={selectedPerson?.id === 1}
                onPaste={handlePaste}
                onChange={(e) => {
                  if (selectedPerson?.id === 1) return;
                  handleContentChange(e.target.value);
                }}
                placeholder={selectedPerson?.id === 1 ? "汇总模式不可编辑" : "在此输入相关记录..."}
                className={cn(
                  "w-full h-32 bg-[var(--color-calendar-page-bg)] border border-[var(--color-calendar-border)] rounded-lg p-4 text-sm focus:outline-none focus:border-[var(--color-calendar-accent)] transition-colors resize-none",
                  selectedPerson?.id === 1 && "cursor-default opacity-80"
                )}
              />
            </div>

            {/* Multiple Image Upload */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-[var(--color-calendar-text-muted)] uppercase tracking-wider">截图/图片 ({(entries[activeEntryIdx]?.images || []).length})</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {entries[activeEntryIdx]?.images?.map((img: string, imgIdx: number) => (
                      <div key={imgIdx} className="relative group aspect-video rounded-lg overflow-hidden border border-[var(--color-calendar-border)] bg-[var(--color-calendar-page-bg)]">
                        <img 
                          src={img} 
                          alt={`upload-${imgIdx}`} 
                          className="w-full h-full object-cover cursor-zoom-in"
                          referrerPolicy="no-referrer"
                          onClick={() => { setPreviewImage(img); setIsPreviewOpen(true); }}
                        />
                        {selectedPerson?.id !== 1 && (
                          <button 
                            onClick={() => removeImage(imgIdx)}
                            className="absolute top-2 right-2 p-1.5 bg-red-600 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                          >
                            <X size={14} />
                          </button>
                        )}
                      </div>
                    ))}
                    {selectedPerson?.id !== 1 && (
                      <label className="aspect-video border-2 border-dashed border-[var(--color-calendar-border)] hover:border-[var(--color-calendar-accent)]/50 hover:bg-[var(--color-calendar-accent)]/5 rounded-lg flex flex-col items-center justify-center gap-2 cursor-pointer transition-all group">
                        <div className="p-2 bg-[var(--color-calendar-surface-hover)] rounded-full group-hover:bg-[var(--color-calendar-accent)]/20 transition-colors">
                          <Plus size={20} className="text-[var(--color-calendar-text-muted)] group-hover:text-[var(--color-calendar-accent)]" />
                        </div>
                        <span className="text-[10px] text-[var(--color-calendar-text-muted)] group-hover:text-[var(--color-calendar-text)]">添加图片</span>
                        <input type="file" multiple accept="image/*" className="hidden" onChange={handleImageUpload} />
                      </label>
                    )}
              </div>
            </div>
          </div>
          )}

          <div className="flex items-center justify-end px-6 py-4 bg-[var(--color-calendar-surface)] border-t border-[var(--color-calendar-border)]">
            <div className="flex gap-3">
              <button 
                onClick={handleClose}
                className="px-8 py-2 bg-[var(--color-calendar-accent)] hover:opacity-90 rounded-xl text-sm font-bold text-white transition-all shadow-lg shadow-[var(--color-calendar-accent)]/20"
              >
                关闭并自动保存
              </button>
            </div>
          </div>
      </div>
    </div>
  );
});

export default function App() {
  const STORAGE_KEYS = {
    PEOPLE: 'calendar_people',
    NOTES: 'calendar_notes',
    THEME: 'calendar_theme',
    THEME_MODE: 'calendar_theme_mode',
    SYSTEM_TAGS: 'calendar_system_tags',
    BACKUP_PATH: 'calendar_backup_path',
    MAX_BACKUPS: 'calendar_max_backups',
  };

  const getSystemTags = (): string[] => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.SYSTEM_TAGS);
      if (!stored) {
        const defaultTags = ['负责内容', '不足', '优秀'];
        localStorage.setItem(STORAGE_KEYS.SYSTEM_TAGS, JSON.stringify(defaultTags));
        return defaultTags;
      }
      return JSON.parse(stored);
    } catch (e) {
      return ['负责内容', '不足', '优秀'];
    }
  };

  const getLocalPeople = (): Person[] => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.PEOPLE);
      if (!stored) {
        const defaultPeople = [{ id: 1, name: '我的日历', avatar_color: '#3b82f6' }];
        localStorage.setItem(STORAGE_KEYS.PEOPLE, JSON.stringify(defaultPeople));
        return defaultPeople;
      }
      return JSON.parse(stored);
    } catch (e) {
      console.error("Failed to parse people from localStorage", e);
      return [{ id: 1, name: '我的日历', avatar_color: '#3b82f6' }];
    }
  };

  const getLocalNotes = (): Record<string, Note> => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.NOTES);
      return stored ? JSON.parse(stored) : {};
    } catch (e) {
      console.error("Failed to parse notes from localStorage", e);
      return {};
    }
  };

  const [currentDate, setCurrentDate] = useState(new Date());
  const [fullNotes, setFullNotes] = useState<Record<string, Note>>({});
  const [people, setPeople] = useState<Person[]>([]);

  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [filterPersonId, setFilterPersonId] = useState<number | null>(null);
  const [filterStartDate, setFilterStartDate] = useState<string>('');
  const [filterEndDate, setFilterEndDate] = useState<string>('');
  const [filterTag, setFilterTag] = useState<string>('');
  const [isPending, startTransition] = useTransition();
  const [isAddPersonModalOpen, setIsAddPersonModalOpen] = useState(false);
  const [newPersonName, setNewPersonName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [themeColor, setThemeColor] = useState('#3b82f6');
  const [themeMode, setThemeMode] = useState<'dark' | 'light'>('dark');
  const [backupPath, setBackupPath] = useState<string>(localStorage.getItem(STORAGE_KEYS.BACKUP_PATH) || 'E:\\DayBACK');
  const [maxBackups, setMaxBackups] = useState<number>(parseInt(localStorage.getItem(STORAGE_KEYS.MAX_BACKUPS) || '10'));

  const fullNotesRef = useRef<Record<string, Note>>(getLocalNotes());
  const peopleRef = useRef<Person[]>(getLocalPeople());
  const selectedPersonRef = useRef<Person | null>(null);
  const systemTagsRef = useRef<string[]>(getSystemTags());
  const backupPathRef = useRef<string>(localStorage.getItem(STORAGE_KEYS.BACKUP_PATH) || 'E:\\DayBACK');
  const maxBackupsRef = useRef<number>(parseInt(localStorage.getItem(STORAGE_KEYS.MAX_BACKUPS) || '10'));
  const themeColorRef = useRef<string>(localStorage.getItem(STORAGE_KEYS.THEME) || '#3b82f6');
  const themeModeRef = useRef<'dark' | 'light'>((localStorage.getItem(STORAGE_KEYS.THEME_MODE) as 'dark' | 'light') || 'dark');

  useEffect(() => {
    fullNotesRef.current = fullNotes;
  }, [fullNotes]);

  useEffect(() => {
    peopleRef.current = people;
  }, [people]);

  useEffect(() => {
    selectedPersonRef.current = selectedPerson;
  }, [selectedPerson]);

  useEffect(() => {
    backupPathRef.current = backupPath;
  }, [backupPath]);

  useEffect(() => {
    maxBackupsRef.current = maxBackups;
  }, [maxBackups]);
  useEffect(() => {
    themeColorRef.current = themeColor;
  }, [themeColor]);

  useEffect(() => {
    themeModeRef.current = themeMode;
  }, [themeMode]);

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isImportConfirmOpen, setIsImportConfirmOpen] = useState(false);
  const [importData, setImportData] = useState<{ people: Person[], notes: Record<string, Note>, theme?: string, themeMode?: string } | null>(null);
  const [personToDelete, setPersonToDelete] = useState<number | null>(null);
  const [isMonthSummaryOpen, setIsMonthSummaryOpen] = useState(false);
  const isClosingRef = useRef(false);

  // Check if running in Tauri
  const isTauri = !!(window as any).__TAURI__;
  const isElectron = !!(window as any).electronAPI;
  const isDesktop = isTauri || isElectron;

  // 桌面端 API 抽象层
  const desktopApi = useMemo(() => ({
    isTauri,
    isElectron,
    isDesktop,
    async selectDirectory() {
      if (isTauri) return await dialog.open({ directory: true });
      if (isElectron) return await (window as any).electronAPI.selectDirectory();
      return null;
    },
    async writeTextFile(filePath: string, content: string) {
      if (isTauri) return await fs.writeTextFile(filePath, content);
      if (isElectron) return await (window as any).electronAPI.writeTextFile(filePath, content);
    },
    async readDir(dirPath: string) {
      if (isTauri) return await fs.readDir(dirPath);
      if (isElectron) return await (window as any).electronAPI.readDir(dirPath);
      return [];
    },
    async removeFile(filePath: string) {
      if (isTauri) return await fs.removeFile(filePath);
      if (isElectron) return await (window as any).electronAPI.removeFile(filePath);
    },
    async createDir(dirPath: string, options?: any) {
      if (isTauri) return await fs.createDir(dirPath, options);
      if (isElectron) return await (window as any).electronAPI.createDir(dirPath);
    },
    async joinPath(...args: string[]) {
      if (isTauri) return await path.join(...args);
      if (isElectron) return await (window as any).electronAPI.joinPath(...args);
      return args.join('/');
    },
    async close() {
      if (isTauri) return await appWindow.close();
      if (isElectron) return (window as any).electronAPI.backupComplete();
    }
  }), [isTauri, isElectron, isDesktop]);

  // --- Export/Import Logic ---
  const generateBackupData = async () => {
    const peopleData = peopleRef.current;
    const notesData = fullNotesRef.current;
    
    // JSON
    const jsonData = {
      people: peopleData,
      notes: notesData,
      theme: themeColor,
      themeMode: themeMode,
      exportDate: new Date().toISOString()
    };
    const jsonStr = JSON.stringify(jsonData, null, 2);
    
    // HTML
    const groupedByDate: Record<string, Note[]> = {};
    Object.entries(notesData).forEach(([key, note]: [string, any]) => {
      const date = key.includes('_') ? key.split('_')[1] : key;
      const validEntries = note.entries.filter((entry: any) => 
        (entry.content && entry.content.trim() !== '') || 
        (entry.images && entry.images.length > 0)
      );
      if (validEntries.length > 0) {
        if (!groupedByDate[date]) groupedByDate[date] = [];
        groupedByDate[date].push({ ...note, entries: validEntries });
      }
    });

    const sortedDates = Object.keys(groupedByDate).sort((a, b) => a.localeCompare(b));
    const htmlParts: string[] = [];
    
    htmlParts.push(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>日历记录导出报告</title>
        <style>
          :root { --primary: #2563eb; --bg: #f8fafc; --card-bg: #ffffff; --text: #1e293b; --text-muted: #64748b; --border: #e2e8f0; }
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: var(--text); max-width: 1000px; margin: 0 auto; padding: 40px 20px; background: var(--bg); }
          .header { text-align: center; margin-bottom: 40px; background: var(--card-bg); padding: 40px; border-radius: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.03); border: 1px solid var(--border); }
          h1 { margin: 0; color: var(--primary); font-size: 2.5em; font-weight: 800; }
          .meta { color: var(--text-muted); margin-top: 12px; font-size: 0.95em; }
          .date-section { margin-bottom: 40px; }
          .date-header { font-size: 1.8em; font-weight: 800; color: var(--primary); margin-bottom: 20px; display: flex; align-items: center; gap: 15px; padding-bottom: 10px; border-bottom: 3px solid var(--primary); }
          .notes-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(450px, 1fr)); gap: 20px; }
          @media (max-width: 600px) { .notes-grid { grid-template-columns: 1fr; } }
          .note-card { background: var(--card-bg); border-radius: 12px; padding: 24px; box-shadow: 0 2px 12px rgba(0,0,0,0.04); border: 1px solid var(--border); display: flex; flex-direction: column; }
          .person-info { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px dashed var(--border); }
          .person-avatar { width: 32px; height: 32px; border-radius: 50%; background: var(--primary); color: white; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 0.8em; }
          .person-name { font-weight: 700; color: var(--text); font-size: 1.1em; }
          .entry { margin-bottom: 20px; padding: 12px; background: #f1f5f9; border-radius: 8px; }
          .entry:last-child { margin-bottom: 0; }
          .tag { display: inline-block; background: var(--primary); color: white; padding: 2px 8px; border-radius: 4px; font-size: 0.7em; font-weight: 700; margin-bottom: 8px; text-transform: uppercase; }
          .content { white-space: pre-wrap; font-size: 1em; color: var(--text); }
          .images { display: flex; gap: 10px; margin-top: 12px; flex-wrap: wrap; }
          .img-container { width: 120px; height: 80px; overflow: hidden; border-radius: 6px; border: 1px solid var(--border); }
          .img-container img { width: 100%; height: 100%; object-fit: cover; }
          @media print { body { background: white; padding: 0; } .header, .note-card { box-shadow: none; border: 1px solid #eee; } .date-section { page-break-inside: avoid; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>日历记录报告</h1>
          <div class="meta">导出时间: ${format(new Date(), 'yyyy年MM月dd日 HH:mm:ss')}</div>
          <div class="meta">共计 ${sortedDates.length} 天有内容记录</div>
        </div>
    `);

    sortedDates.forEach(date => {
      const notes = groupedByDate[date];
      htmlParts.push(`
        <div class="date-section">
          <div class="date-header">
            <span>📅 ${date}</span>
            <span style="font-size: 0.5em; background: #e2e8f0; padding: 4px 12px; border-radius: 20px; color: #475569;">
              ${notes.length} 人记录
            </span>
          </div>
          <div class="notes-grid">
      `);
      
      notes.forEach(note => {
        const person = peopleData.find(p => p.id === note.person_id);
        htmlParts.push(`
          <div class="note-card">
            <div class="person-info">
              <div class="person-avatar">${person?.name.charAt(0) || '?'}</div>
              <div class="person-name">${person?.name || '未知人员'}</div>
            </div>
            ${note.entries.map(entry => `
              <div class="entry">
                <div class="tag">${entry.tag}</div>
                <div class="content">${entry.content}</div>
                ${entry.images && entry.images.length > 0 ? `
                  <div class="images">
                    ${entry.images.map(img => `
                      <div class="img-container">
                        <img src="${img}" alt="image">
                      </div>
                    `).join('')}
                  </div>
                ` : ''}
              </div>
            `).join('')}
          </div>
        `);
      });
      
      htmlParts.push(`</div></div>`);
    });

    htmlParts.push(`</body></html>`);
    const htmlContent = htmlParts.join('');
    return { jsonStr, htmlContent };
  };

  const exportToJson = async () => {
    const { jsonStr } = await generateBackupData();
    const fileName = `calendar_backup_${format(new Date(), 'yyyyMMdd_HHmm')}.json`;

    if (isTauri) {
      try {
        const filePath = await dialog.save({
          defaultPath: fileName,
          filters: [{ name: 'JSON', extensions: ['json'] }]
        });
        if (filePath) {
          await fs.writeTextFile(filePath, jsonStr);
        }
      } catch (error) {
        console.error('Tauri export error:', error);
        alert('导出失败，请检查权限设置');
      }
    } else {
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  const exportToHtml = async () => {
    const { htmlContent } = await generateBackupData();
    const fileName = `日历记录报告_${format(new Date(), 'yyyyMMdd')}.html`;

    if (isTauri) {
      try {
        const filePath = await dialog.save({
          defaultPath: fileName,
          filters: [{ name: 'HTML', extensions: ['html'] }]
        });
        if (filePath) {
          await fs.writeTextFile(filePath, htmlContent);
        }
      } catch (error) {
        console.error('Tauri export error:', error);
        alert('导出失败，请检查权限设置');
      }
    } else {
      const blob = new Blob([htmlContent], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  const runAutoBackup = async (targetDir?: string, baseFileName?: string) => {
    const bPath = targetDir || backupPathRef.current || 'E:\\DayBACK';
    
    if (!isDesktop) {
      console.log('Backup skipped: Not Desktop');
      return;
    }

    console.log(`[Backup] Starting backup to: ${bPath}`);

    try {
      const { jsonStr, htmlContent } = await generateBackupData();
      const now = new Date();
      const timestamp = format(now, 'yyyyMMdd_HHmmss');
      
      // 如果提供了 baseFileName，则使用它（去掉扩展名），否则使用默认日期格式
      let jsonFileName = `backup_${timestamp}.json`;
      let htmlFileName = `backup_${timestamp}.html`;

      if (baseFileName) {
        const nameWithoutExt = baseFileName.replace(/\.json$/i, '');
        jsonFileName = `${nameWithoutExt}.json`;
        htmlFileName = `${nameWithoutExt}.html`;
      }
      
      const jsonFilePath = await desktopApi.joinPath(bPath, jsonFileName);
      const htmlFilePath = await desktopApi.joinPath(bPath, htmlFileName);
      
      console.log(`[Backup] File paths: JSON=${jsonFilePath}, HTML=${htmlFilePath}`);
      console.log(`[Backup] Content sizes: JSON=${jsonStr.length}, HTML=${htmlContent.length}`);

      // 确保目录存在
      try {
        await desktopApi.createDir(bPath, { recursive: true });
      } catch (e) {
        console.warn('[Backup] Directory creation warning (might already exist or be root):', e);
      }

      console.log('[Backup] Writing JSON file...');
      await desktopApi.writeTextFile(jsonFilePath, jsonStr);
      
      console.log('[Backup] Writing HTML file...');
      try {
        await desktopApi.writeTextFile(htmlFilePath, htmlContent);
      } catch (htmlErr) {
        console.error('[Backup] HTML write failed:', htmlErr);
        // 如果 HTML 写入失败，我们仍然认为 JSON 成功了，但抛出更具体的错误
        throw new Error(`JSON 备份已保存，但 HTML 报告保存失败: ${htmlErr instanceof Error ? htmlErr.message : String(htmlErr)}`);
      }
      
      console.log(`[Backup] Success: ${jsonFileName} and ${htmlFileName}`);
      return { jsonFileName, htmlFileName, bPath };
    } catch (err) {
      console.error('[Backup] Overall error:', err);
      throw err;
    }
  };

  useEffect(() => {
    if (!isDesktop) return;

    const setupCloseListener = async () => {
      const handleClose = async (event?: any) => {
        // 移除自动备份，直接退出
        await desktopApi.close();
      };

      if (isTauri) {
        return await appWindow.onCloseRequested(handleClose);
      } else if (isElectron) {
        return (window as any).electronAPI.onCloseRequested(handleClose);
      }
    };

    const unlistenPromise = setupCloseListener();

    return () => {
      unlistenPromise.then(unlisten => {
        if (typeof unlisten === 'function') unlisten();
      });
    };
  }, [isDesktop, isTauri, isElectron, desktopApi]);

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        if (data.people && data.notes) {
          setImportData(data);
          setIsImportConfirmOpen(true);
        } else {
          alert('无效的数据格式，请确保上传的是导出的 JSON 备份文件。');
        }
      } catch (err) {
        alert('解析文件失败，请确保文件内容正确。');
      }
    };
    reader.readAsText(file);
    // Reset input
    event.target.value = '';
  };

  const confirmImport = async (mode: 'overwrite' | 'merge') => {
    if (!importData) return;
    setIsSubmitting(true);
    
    try {
      let finalPeople = people;
      let finalNotes = fullNotes;

      if (mode === 'overwrite') {
        finalPeople = importData.people;
        finalNotes = importData.notes;
        if (importData.theme) setThemeColor(importData.theme);
        if (importData.themeMode) setThemeMode(importData.themeMode as 'dark' | 'light');
      } else {
        // Merge people
        const mergedPeople = [...people];
        const personIdMap: Record<number, number> = {};

        importData.people.forEach(newP => {
          // 移除 ID 为 1 的限制，除非它是特殊的汇总项
          const existing = mergedPeople.find(p => p.name === newP.name);
          if (!existing) {
            const newId = Date.now() + Math.floor(Math.random() * 1000);
            personIdMap[newP.id] = newId;
            mergedPeople.push({ ...newP, id: newId });
          } else {
            personIdMap[newP.id] = existing.id;
          }
        });
        finalPeople = mergedPeople;

        // Merge notes
        const mergedNotes = { ...fullNotes };
        Object.entries(importData.notes).forEach(([key, noteData]) => {
          const note = noteData as Note;
          const parts = key.split('_');
          if (parts.length < 2) return;
          const oldPersonId = parseInt(parts[0]);
          const dateStr = parts[1];
          const newPersonId = personIdMap[oldPersonId];
          
          if (newPersonId) {
            const newKey = `${newPersonId}_${dateStr}`;
            if (mergedNotes[newKey]) {
              // 合并 entries，去重或直接追加
              mergedNotes[newKey].entries = [
                ...mergedNotes[newKey].entries,
                ...note.entries
              ];
            } else {
              mergedNotes[newKey] = { ...note, person_id: newPersonId };
            }
          }
        });
        finalNotes = mergedNotes;
      }
      
      // 关键：手动更新 Ref，确保 syncFullDataToFile 拿到的是最新数据
      peopleRef.current = finalPeople;
      fullNotesRef.current = finalNotes;
      
      setPeople(finalPeople);
      setFullNotes(finalNotes);

      // 同步到本地存储作为缓存
      localStorage.setItem(STORAGE_KEYS.PEOPLE, JSON.stringify(finalPeople));
      localStorage.setItem(STORAGE_KEYS.NOTES, JSON.stringify(finalNotes));

      if (isTauri) {
        await syncFullDataToFile();
      }
      
      alert('导入成功！软件将自动刷新以应用更改。');
      window.location.reload();
    } catch (e) {
      console.error('Import failed:', e);
      alert('导入失败，请检查文件格式。');
    } finally {
      setIsSubmitting(false);
      setIsImportConfirmOpen(false);
    }
  };

  // Modal Editing State
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [isRenamePersonModalOpen, setIsRenamePersonModalOpen] = useState(false);
  const [personToRename, setPersonToRename] = useState<Person | null>(null);
  const [renameValue, setRenameValue] = useState('');

  // Context Menu State
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, personId: number } | null>(null);

  const pickerRef = useRef<HTMLDivElement>(null);
  const editingContextRef = useRef<{ day: string; personId: number } | null>(null);

  const [systemTags, setSystemTags] = useState<string[]>(getSystemTags());

  useEffect(() => {
    systemTagsRef.current = systemTags;
  }, [systemTags]);

  const saveSystemTags = (tags: string[]) => {
    localStorage.setItem(STORAGE_KEYS.SYSTEM_TAGS, JSON.stringify(tags));
    setSystemTags(tags);
    if (isTauri) syncFullDataToFile();
  };

  const saveLocalPeople = (newPeople: Person[]) => {
    setPeople(newPeople);
  };

  const saveLocalNotes = (newNotes: Record<string, Note>) => {
    setFullNotes(newNotes);
  };

  const syncFullDataToFile = async () => {
    if (!isTauri) return;
    try {
      const fullData = {
        people: peopleRef.current,
        notes: fullNotesRef.current,
        systemTags: systemTagsRef.current,
        theme: themeColorRef.current,
        themeMode: themeModeRef.current,
        backupPath: backupPathRef.current,
        maxBackups: maxBackupsRef.current
      };
      
      const dataDir = await path.appDataDir();
      try {
        await fs.createDir(dataDir, { recursive: true });
      } catch (e) {}

      const dataPath = await path.join(dataDir, 'calendar_persistent_data.json');
      await fs.writeTextFile(dataPath, JSON.stringify(fullData));
      console.log('Data synced to file system:', dataPath);
    } catch (e) {
      console.error("Failed to sync data to file system", e);
    }
  };

  // Debounced sync to storage
  useEffect(() => {
    if (isLoading) return;

    const timer = setTimeout(() => {
      // Sync to localStorage
      try {
        // Only sync basic info to localStorage to keep it fast
        localStorage.setItem(STORAGE_KEYS.PEOPLE, JSON.stringify(people));
        // For notes, we only sync to file system in Tauri to avoid main thread lag
        if (!isTauri) {
          localStorage.setItem(STORAGE_KEYS.NOTES, JSON.stringify(fullNotes));
        }
      } catch (e) {
        if (e instanceof DOMException && e.name === 'QuotaExceededError') {
          if (!isTauri) alert("存储空间已满（浏览器限制5MB）。请尝试删除一些旧记录或图片。");
        }
      }

      // Sync to file system (Tauri only)
      if (isTauri) syncFullDataToFile();
    }, 2000); // Increase debounce to 2 seconds for better performance

    return () => clearTimeout(timer);
  }, [fullNotes, people, systemTags, themeColor, themeMode, backupPath, maxBackups, isLoading, isTauri]);

  const handleSaveNote = useCallback((updatedEntries: NoteEntry[]) => {
    if (!selectedDay || !selectedPerson) return;
    const dateKey = format(selectedDay, 'yyyy-MM-dd');
    const noteKey = `${selectedPerson.id}_${dateKey}`;
    
    setFullNotes(prev => {
      const updated = { ...prev };
      const filteredEntries = updatedEntries.filter(e => 
        (e.content && e.content.trim() !== '') || 
        (e.images && e.images.length > 0)
      );
      
      if (filteredEntries.length === 0) {
        delete updated[noteKey];
      } else {
        updated[noteKey] = {
          person_id: selectedPerson.id,
          date: dateKey,
          entries: filteredEntries
        };
      }
      return updated;
    });
    
    if (isTauri) syncFullDataToFile();
  }, [selectedDay, selectedPerson, isTauri]);

  const getSummaryDataForDay = useCallback((day: Date) => {
    if (!day) return [];
    const dateStr = format(day, 'yyyy-MM-dd');
    const allNotes = fullNotes;
    const allPeople = people;
    
    const summary: { person: Person, note: Note }[] = [];
    
    // Include only personnel with actual content
    allPeople.forEach(person => {
      const personNoteKey = `${person.id}_${dateStr}`;
      const note = allNotes[personNoteKey];
      if (note && note.entries) {
        const hasContent = note.entries.some((e: any) => 
          (e.content && e.content.trim() !== '') || 
          (e.images && e.images.length > 0)
        );
        if (hasContent) {
          summary.push({ person, note });
        }
      }
    });
    
    return summary;
  }, [people, fullNotes]);

  const initialEntries = useMemo(() => {
    if (!selectedDay || !selectedPerson) return [];
    const dateStr = format(selectedDay, 'yyyy-MM-dd');
    const noteKey = `${selectedPerson.id}_${dateStr}`;
    return fullNotes[noteKey]?.entries || systemTags.map(tag => ({ tag, content: '', images: [] }));
  }, [selectedDay, selectedPerson, fullNotes, systemTags]);

  const saveBackupPath = useCallback(async (pathStr: string) => {
    const trimmedPath = pathStr.trim();
    setBackupPath(trimmedPath);
    backupPathRef.current = trimmedPath;
    localStorage.setItem(STORAGE_KEYS.BACKUP_PATH, trimmedPath);
    
    if (isTauri) {
      try {
        const dataDir = await path.appDataDir();
        // 确保目录存在
        try {
          await fs.createDir(dataDir, { recursive: true });
        } catch (e) {}
        
        const configPath = await path.join(dataDir, 'backup_path.config');
        await fs.writeTextFile(configPath, trimmedPath);
        console.log('[Persistence] Backup path saved to dedicated config:', trimmedPath);
        
        // 同时同步到主数据文件
        syncFullDataToFile();
      } catch (err) {
        console.error('[Persistence] Failed to save backup path to config file:', err);
      }
    }
  }, [isTauri, syncFullDataToFile]);

  // Fetch people and notes on mount
  useEffect(() => {
    const loadInitialData = async () => {
      let peopleData = getLocalPeople();
      let notesData = getLocalNotes();
      let tagsData = getSystemTags();
      let theme = localStorage.getItem(STORAGE_KEYS.THEME) || '#3b82f6';
      let mode = (localStorage.getItem(STORAGE_KEYS.THEME_MODE) as 'dark' | 'light') || 'dark';
      let bPath = localStorage.getItem(STORAGE_KEYS.BACKUP_PATH) || 'E:\\DayBACK';
      let mBackups = parseInt(localStorage.getItem(STORAGE_KEYS.MAX_BACKUPS) || '10');

      if (isTauri) {
        try {
          const dataDir = await path.appDataDir();
          
          // 优先尝试从专门的路径配置文件读取
          try {
            const configPath = await path.join(dataDir, 'backup_path.config');
            const savedPath = await fs.readTextFile(configPath);
            if (savedPath && savedPath.trim()) {
              bPath = savedPath.trim();
              console.log('[Persistence] Loaded backup path from dedicated config:', bPath);
            }
          } catch (e) {
            console.log('[Persistence] Dedicated config not found, falling back to main data file.');
          }

          const dataPath = await path.join(dataDir, 'calendar_persistent_data.json');
          const content = await fs.readTextFile(dataPath);
          if (content) {
            const fullData = JSON.parse(content);
            if (fullData.people) peopleData = fullData.people;
            if (fullData.notes) notesData = fullData.notes;
            if (fullData.systemTags) tagsData = fullData.systemTags;
            if (fullData.theme) theme = fullData.theme;
            if (fullData.themeMode) mode = fullData.themeMode;
            // 如果专门配置文件没读到，才用主文件的
            if ((!bPath || bPath === 'E:\\DayBACK') && fullData.backupPath) bPath = fullData.backupPath;
            if (fullData.maxBackups) mBackups = fullData.maxBackups;

            // Sync to localStorage as a cache
            localStorage.setItem(STORAGE_KEYS.PEOPLE, JSON.stringify(peopleData));
            localStorage.setItem(STORAGE_KEYS.NOTES, JSON.stringify(notesData));
            localStorage.setItem(STORAGE_KEYS.SYSTEM_TAGS, JSON.stringify(tagsData));
            localStorage.setItem(STORAGE_KEYS.THEME, theme);
            localStorage.setItem(STORAGE_KEYS.THEME_MODE, mode);
            localStorage.setItem(STORAGE_KEYS.BACKUP_PATH, bPath);
            localStorage.setItem(STORAGE_KEYS.MAX_BACKUPS, mBackups.toString());
          }
        } catch (e) {
          console.log("No persistent data file found or failed to read, using localStorage.");
        }
      }

      setPeople(peopleData);
      peopleRef.current = peopleData;
      if (peopleData.length > 0) {
        setSelectedPerson(peopleData[0]);
        selectedPersonRef.current = peopleData[0];
      }
      setFullNotes(notesData);
      fullNotesRef.current = notesData;
      setSystemTags(tagsData);
      systemTagsRef.current = tagsData;
      setThemeColor(theme);
      setThemeMode(mode);
      setBackupPath(bPath);
      backupPathRef.current = bPath;
      setMaxBackups(mBackups);
      maxBackupsRef.current = mBackups;
      setIsLoading(false);
    };

    loadInitialData();
  }, []);

  // Apply theme to CSS variables and document
  useEffect(() => {
    document.documentElement.style.setProperty('--calendar-accent', themeColor);
    localStorage.setItem(STORAGE_KEYS.THEME, themeColor);
    if (isTauri && !isLoading) syncFullDataToFile();
  }, [themeColor, isLoading, isTauri]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', themeMode);
    localStorage.setItem(STORAGE_KEYS.THEME_MODE, themeMode);
    if (isTauri && !isLoading) syncFullDataToFile();
  }, [themeMode, isLoading, isTauri]);

  useEffect(() => {
    if (isTauri && !isLoading) syncFullDataToFile();
  }, [maxBackups, isLoading, isTauri]);

  const notes = useMemo(() => {
    if (!selectedPerson) return {};
    
    const notesMap: Record<string, Note> = {};

    Object.values(fullNotes).forEach((note: any) => {
      if (selectedPerson.id === 1) {
        // Aggregate entries from all people for the summary view
        const person = people.find(p => p.id === note.person_id);
        const personName = person ? person.name : '未知';
        
        const validEntries = note.entries.filter((e: any) => 
          (e.content && e.content.trim() !== '') || 
          (e.images && e.images.length > 0)
        ).map((e: any) => ({ ...e, tag: `${personName} - ${e.tag}` }));

        if (validEntries.length === 0) return;

        if (!notesMap[note.date]) {
          notesMap[note.date] = { 
            ...note, 
            entries: validEntries 
          };
        } else {
          notesMap[note.date].entries = [
            ...notesMap[note.date].entries,
            ...validEntries
          ];
        }
      } else if (note.person_id === selectedPerson.id) {
        const validEntries = note.entries.filter((e: any) => 
          (e.content && e.content.trim() !== '') || 
          (e.images && e.images.length > 0)
        );
        if (validEntries.length > 0) {
          notesMap[note.date] = { ...note, entries: validEntries };
        }
      }
    });
    
    return notesMap;
  }, [fullNotes, people, selectedPerson]);

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

  // Close modals on Esc key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isModalOpen) setIsModalOpen(false);
        if (isSearchModalOpen) setIsSearchModalOpen(false);
        if (isAddPersonModalOpen) setIsAddPersonModalOpen(false);
        if (isSettingsOpen) setIsSettingsOpen(false);
        if (isMonthSummaryOpen) setIsMonthSummaryOpen(false);
        if (isPickerOpen) setIsPickerOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isModalOpen, isSearchModalOpen, isAddPersonModalOpen, isSettingsOpen, isMonthSummaryOpen, isPickerOpen]);

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);

    const days = eachDayOfInterval({ start: startDate, end: endDate });

    return days.map((day): CalendarDay => {
      return {
        date: day,
        isCurrentMonth: isSameMonth(day, monthStart),
        isToday: isSameDay(day, new Date())
      };
    });
  }, [currentDate]);

  const handlePrevMonth = useCallback(() => setCurrentDate(subMonths(currentDate, 1)), [currentDate]);
  const handleNextMonth = useCallback(() => setCurrentDate(addMonths(currentDate, 1)), [currentDate]);
  const handleToday = useCallback(() => setCurrentDate(new Date()), []);

  const openNoteModal = useCallback((day: Date, person?: Person) => {
    // 增加兜底逻辑：如果当前没有选中的人，默认使用第一个人
    const targetPerson = person || selectedPersonRef.current || peopleRef.current[0];
    if (!targetPerson) {
      console.log('Cannot open modal: No person selected and no default person found');
      return;
    }

    const dateStr = format(day, 'yyyy-MM-dd');
    
    setSelectedDay(day);
    // Update the ref so the auto-save effect knows these entries belong to this day/person
    editingContextRef.current = { day: dateStr, personId: targetPerson.id };
    setIsModalOpen(true);
  }, []); // Empty dependency array makes it perfectly stable

  const deleteNote = async () => {
    if (!selectedDay || !selectedPerson || isSubmitting) return;
    const dateStr = format(selectedDay, 'yyyy-MM-dd');
    const storageKey = `${selectedPerson.id}_${dateStr}`;
    setIsSubmitting(true);
    
    try {
      const allNotes = { ...fullNotes };
      delete allNotes[storageKey];
      saveLocalNotes(allNotes);
      
      setIsModalOpen(false);
    } catch (error) {
      console.error('Failed to delete note:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickBackup = useCallback(async () => {
    if (!isTauri && !isElectron) {
      alert('该功能仅在桌面端可用');
      return;
    }

    try {
      console.log('[Backup] Opening directory selection dialog...');
      // 弹出选择目录对话框，而不是另存为文件，这样可以获得整个目录的写入权限
      let selectedDir: string | null = null;
      const lastPath = backupPathRef.current || 'E:\\DayBACK';

      if (isTauri) {
        selectedDir = await dialog.open({
          directory: true,
          defaultPath: lastPath,
          title: '选择备份保存目录'
        }) as string | null;
      } else if (isElectron) {
        selectedDir = await (window as any).electronAPI.selectDirectory();
      }

      if (!selectedDir) {
        console.log('[Backup] User cancelled directory selection');
        return;
      }

      // 立即显示备份中遮罩
      setIsBackingUp(true);
      
      // 使用 setTimeout 确保 UI 遮罩层先渲染出来，避免卡顿感
      await new Promise(resolve => setTimeout(resolve, 100));

      console.log(`[Backup] Selected Directory: ${selectedDir}`);

      // 更新并保存最后使用的路径
      await saveBackupPath(selectedDir);

      // 执行备份
      const result = await runAutoBackup(selectedDir);
      
      if (result) {
        alert(`备份成功！\n已自动生成 JSON 和 HTML 文件。\n保存目录：\n${result.bPath}`);
      }
    } catch (err: any) {
      console.error('[Backup] handleQuickBackup error:', err);
      const errorMsg = err instanceof Error ? err.message : (typeof err === 'string' ? err : JSON.stringify(err));
      alert('备份失败：' + (errorMsg || '未知错误'));
    } finally {
      setIsBackingUp(false);
    }
  }, [runAutoBackup, saveBackupPath, isTauri, isElectron]);

  const handleRenamePerson = async () => {
    if (!personToRename || !renameValue.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const updatedPeople = people.map(p => 
        p.id === personToRename.id ? { ...p, name: renameValue.trim() } : p
      );
      saveLocalPeople(updatedPeople);
      if (selectedPerson?.id === personToRename.id) {
        setSelectedPerson({ ...personToRename, name: renameValue.trim() });
      }
      setIsRenamePersonModalOpen(false);
      setPersonToRename(null);
      setRenameValue('');
    } catch (error) {
      console.error('Failed to rename person:', error);
      alert('重命名失败');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddPerson = async () => {
    if (!newPersonName.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const currentPeople = people;
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

  const handleDeletePerson = (id: number) => {
    if (id === 1) return;
    setPersonToDelete(id);
  };

  const performDeletePerson = async () => {
    if (personToDelete === null) return;
    const id = personToDelete;
    try {
      const currentPeople = people;
      const updatedPeople = currentPeople.filter(p => p.id !== id);
      saveLocalPeople(updatedPeople);
      
      // Also delete their notes
      const allNotes = { ...fullNotes };
      const filteredNotes: Record<string, Note> = {};
      Object.entries(allNotes).forEach(([key, note]: [string, any]) => {
        if (!key.startsWith(`${id}_`)) {
          filteredNotes[key] = note;
        }
      });
      saveLocalNotes(filteredNotes);

      if (selectedPerson?.id === id) {
        setSelectedPerson(updatedPeople[0]);
      }
      setPersonToDelete(null);
    } catch (error) {
      console.error('Failed to delete person:', error);
    }
  };

  const handleContextMenu = (e: React.MouseEvent, personId: number) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, personId });
  };

  const handleSearch = useCallback((query: string, filters?: { personId?: number | null, startDate?: string, endDate?: string, tag?: string }) => {
    const currentQuery = query.toLowerCase();
    const currentPersonId = filters?.personId !== undefined ? filters.personId : filterPersonId;
    const currentStartDate = filters?.startDate !== undefined ? filters.startDate : filterStartDate;
    const currentEndDate = filters?.endDate !== undefined ? filters.endDate : filterEndDate;
    const currentTag = filters?.tag !== undefined ? filters.tag : filterTag;

    setSearchQuery(query);
    if (!query.trim() && !currentPersonId && !currentStartDate && !currentEndDate && !currentTag) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    
    startTransition(() => {
      const results: any[] = [];

      Object.entries(fullNotes).forEach(([key, note]: [string, any]) => {
        const person = people.find(p => p.id === note.person_id);
        if (!person) return;

        // Filter by person
        if (currentPersonId && person.id !== currentPersonId) return;

        // Filter by date range
        if (currentStartDate && note.date < currentStartDate) return;
        if (currentEndDate && note.date > currentEndDate) return;

        const matchingEntries = note.entries.filter((entry: any) => {
          // Filter out empty entries (no content and no images)
          const hasContent = entry.content && entry.content.trim().length > 0;
          const hasImages = entry.images && entry.images.length > 0;
          if (!hasContent && !hasImages) return false;

          // Filter by tag
          if (currentTag && entry.tag !== currentTag) return false;

          // Filter by query
          if (query.trim()) {
            return (entry.content && entry.content.toLowerCase().includes(currentQuery)) || 
                   (entry.tag && entry.tag.toLowerCase().includes(currentQuery));
          }
          return true;
        });

        matchingEntries.forEach((entry: any) => {
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
    });
  }, [fullNotes, people, filterPersonId, filterStartDate, filterEndDate, filterTag]);

  const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

  return (
    <div className="min-h-screen bg-[var(--color-calendar-page-bg)] text-[var(--color-calendar-text)] flex">
      <Sidebar 
        people={people}
        selectedPerson={selectedPerson}
        setSelectedPerson={setSelectedPerson}
        setIsAddPersonModalOpen={setIsAddPersonModalOpen}
        handleContextMenu={handleContextMenu}
        setIsSettingsOpen={setIsSettingsOpen}
        onQuickBackup={handleQuickBackup}
        backupPath={backupPath}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header 
          currentDate={currentDate}
          handleToday={handleToday}
          handlePrevMonth={handlePrevMonth}
          handleNextMonth={handleNextMonth}
          isPickerOpen={isPickerOpen}
          setIsPickerOpen={setIsPickerOpen}
          pickerRef={pickerRef}
          selectedPerson={selectedPerson}
          setCurrentDate={setCurrentDate}
          setIsMonthSummaryOpen={setIsMonthSummaryOpen}
          setIsSearchModalOpen={setIsSearchModalOpen}
        />

        {/* Weekday labels */}
        <div className="grid grid-cols-7 border-b border-[var(--color-calendar-border)]">
          {weekDays.map(day => (
            <div key={day} className="py-2 text-center text-xs font-medium text-[var(--color-calendar-text-muted)] uppercase tracking-wider">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        <CalendarGrid 
          calendarDays={calendarDays}
          selectedDay={selectedDay}
          notes={notes}
          openNoteModal={openNoteModal}
          onContextMenu={(e, date) => {
            e.preventDefault();
            openNoteModal(date);
          }}
        />
      </div>

      {/* Note Modal */}
      <NoteModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        selectedDay={selectedDay}
        selectedPerson={selectedPerson}
        initialEntries={initialEntries}
        onSave={handleSaveNote}
        getSummaryDataForDay={getSummaryDataForDay}
        setPreviewImage={setPreviewImage}
        setIsPreviewOpen={setIsPreviewOpen}
        isSubmitting={isSubmitting}
        setIsConfirmDeleteOpen={setIsConfirmDeleteOpen}
      />

      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu 
          x={contextMenu.x} 
          y={contextMenu.y} 
          onClose={() => setContextMenu(null)}
          onAdd={() => setIsAddPersonModalOpen(true)}
          onRename={() => {
            const person = people.find(p => p.id === contextMenu.personId);
            if (person) {
              setPersonToRename(person);
              setRenameValue(person.name);
              setIsRenamePersonModalOpen(true);
            }
          }}
          onDelete={() => handleDeletePerson(contextMenu.personId)}
        />
      )}

      {/* Rename Person Modal */}
      {isRenamePersonModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[var(--color-calendar-surface)] w-full max-w-sm rounded-xl border border-[var(--color-calendar-border)] shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Edit2 size={20} className="text-[var(--color-calendar-accent)]" />
                重命名人员
              </h2>
              <button onClick={() => setIsRenamePersonModalOpen(false)} className="text-[var(--color-calendar-text-dim)] hover:text-white">
                <X size={20} />
              </button>
            </div>
            <div className="space-y-2">
              <label className="text-xs text-[var(--color-calendar-text-muted)] uppercase font-bold">人员姓名</label>
              <input 
                autoFocus
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleRenamePerson()}
                placeholder="请输入新姓名..."
                className="w-full bg-[var(--color-calendar-page-bg)] border border-[var(--color-calendar-border)] rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-[var(--color-calendar-accent)] transition-colors"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <button 
                onClick={() => setIsRenamePersonModalOpen(false)}
                className="flex-1 py-2 text-sm font-medium bg-[var(--color-calendar-surface-hover)] hover:opacity-80 rounded-lg transition-colors"
              >
                取消
              </button>
              <button 
                onClick={handleRenamePerson}
                disabled={isSubmitting || !renameValue.trim()}
                className={cn(
                  "flex-1 py-2 text-sm font-medium bg-[var(--color-calendar-accent)] hover:opacity-90 text-white rounded-lg transition-colors shadow-lg",
                  (isSubmitting || !renameValue.trim()) && "opacity-50 cursor-not-allowed"
                )}
              >
                {isSubmitting ? '保存中...' : '确定修改'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Person Modal */}
      {isAddPersonModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div 
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
            </div>
          </div>
        )}

      {/* Search Modal */}
      {isSearchModalOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div 
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
                      <div 
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
                      </div>
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
                    <button 
                      onClick={() => {
                        setFilterPersonId(null);
                        setFilterStartDate('');
                        setFilterEndDate('');
                        setFilterTag('');
                        handleSearch(searchQuery, { personId: null, startDate: '', endDate: '', tag: '' });
                      }} 
                      className="text-xs text-[var(--color-calendar-text-dim)] hover:text-white flex items-center gap-1"
                    >
                      <Trash2 size={12} /> 重置
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-xs text-[var(--color-calendar-text-dim)] font-bold">发送人</label>
                      <select 
                        value={filterPersonId || ''}
                        onChange={(e) => {
                          const val = e.target.value ? parseInt(e.target.value) : null;
                          setFilterPersonId(val);
                          handleSearch(searchQuery, { personId: val });
                        }}
                        className="w-full bg-[var(--color-calendar-surface-hover)] px-3 py-2 rounded-lg border border-[var(--color-calendar-border)] text-sm text-[var(--color-calendar-text)] focus:outline-none focus:border-[var(--color-calendar-accent)] transition-colors"
                      >
                        <option value="">全部人员</option>
                        {people.map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs text-[var(--color-calendar-text-dim)] font-bold">时间范围</label>
                      <div className="space-y-2">
                        <div className="space-y-1">
                          <span className="text-[10px] text-[var(--color-calendar-text-dim)] ml-1">开始日期</span>
                          <input 
                            type="date"
                            value={filterStartDate}
                            onChange={(e) => {
                              setFilterStartDate(e.target.value);
                              handleSearch(searchQuery, { startDate: e.target.value });
                            }}
                            className="w-full bg-[var(--color-calendar-surface-hover)] px-3 py-2 rounded-lg border border-[var(--color-calendar-border)] text-sm text-[var(--color-calendar-text)] focus:outline-none focus:border-[var(--color-calendar-accent)] transition-colors"
                          />
                        </div>
                        <div className="space-y-1">
                          <span className="text-[10px] text-[var(--color-calendar-text-dim)] ml-1">结束日期</span>
                          <input 
                            type="date"
                            value={filterEndDate}
                            onChange={(e) => {
                              setFilterEndDate(e.target.value);
                              handleSearch(searchQuery, { endDate: e.target.value });
                            }}
                            className="w-full bg-[var(--color-calendar-surface-hover)] px-3 py-2 rounded-lg border border-[var(--color-calendar-border)] text-sm text-[var(--color-calendar-text)] focus:outline-none focus:border-[var(--color-calendar-accent)] transition-colors"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs text-[var(--color-calendar-text-dim)] font-bold">标签筛选</label>
                      <select 
                        value={filterTag}
                        onChange={(e) => {
                          setFilterTag(e.target.value);
                          handleSearch(searchQuery, { tag: e.target.value });
                        }}
                        className="w-full bg-[var(--color-calendar-surface-hover)] px-3 py-2 rounded-lg border border-[var(--color-calendar-border)] text-sm text-[var(--color-calendar-text)] focus:outline-none focus:border-[var(--color-calendar-accent)] transition-colors"
                      >
                        <option value="">全部标签</option>
                        {systemTags.map(tag => (
                          <option key={tag} value={tag}>{tag}</option>
                        ))}
                      </select>
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
            </div>
          </div>
        )}

        {/* Month Summary Modal */}
        {isMonthSummaryOpen && (
          <MonthSummaryModal 
            currentDate={currentDate}
            people={people}
            allNotes={fullNotes}
            onClose={() => setIsMonthSummaryOpen(false)}
            onPreviewImage={(src) => {
              setPreviewImage(src);
              setIsPreviewOpen(true);
            }}
            onEditDay={(day, person) => {
              setSelectedPerson(person);
              openNoteModal(day, person);
            }}
          />
        )}

        {/* Settings Modal */}
        {isSettingsOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div 
              className="bg-[var(--color-calendar-surface)] w-full max-w-3xl rounded-2xl shadow-2xl border border-[var(--color-calendar-border)] overflow-hidden"
            >
              <div className="p-6 border-b border-[var(--color-calendar-border)] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[var(--color-calendar-accent)]/10 flex items-center justify-center text-[var(--color-calendar-accent)]">
                    <Settings size={20} />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-[var(--color-calendar-text)]">系统设置</h2>
                    <p className="text-xs text-[var(--color-calendar-text-dim)]">自定义您的日历外观与数据管理</p>
                  </div>
                </div>
                <button onClick={() => setIsSettingsOpen(false)} className="p-2 hover:bg-[var(--color-calendar-surface-hover)] rounded-full transition-colors">
                  <X size={20} className="text-[var(--color-calendar-text-dim)]" />
                </button>
              </div>

              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Left Column: Appearance */}
                <div className="space-y-8">
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

                </div>

                {/* Right Column: Data Management */}
                <div className="space-y-8">
                  <div className="space-y-4">
                    <label className="text-sm font-bold text-[var(--color-calendar-text-muted)] uppercase tracking-widest">数据管理</label>
                    <div className="space-y-3">
                      <button
                        onClick={exportToJson}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[var(--color-calendar-surface-hover)] hover:bg-[var(--color-calendar-accent)]/10 hover:text-[var(--color-calendar-accent)] rounded-xl border border-[var(--color-calendar-border)] transition-all text-sm font-medium group"
                      >
                        <Download size={18} className="text-[var(--color-calendar-text-dim)] group-hover:text-[var(--color-calendar-accent)]" />
                        导出备份 (JSON)
                      </button>
                      <div className="relative">
                        <input 
                          type="file" 
                          accept=".json"
                          onChange={handleImport}
                          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                        />
                        <button
                          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[var(--color-calendar-surface-hover)] hover:bg-[var(--color-calendar-accent)]/10 hover:text-[var(--color-calendar-accent)] rounded-xl border border-[var(--color-calendar-border)] transition-all text-sm font-medium group"
                        >
                          <Upload size={18} className="text-[var(--color-calendar-text-dim)] group-hover:text-[var(--color-calendar-accent)]" />
                          导入备份 (JSON)
                        </button>
                      </div>
                      <button
                        onClick={exportToHtml}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[var(--color-calendar-surface-hover)] hover:bg-[var(--color-calendar-accent)]/10 hover:text-[var(--color-calendar-accent)] rounded-xl border border-[var(--color-calendar-border)] transition-all text-sm font-medium group"
                      >
                        <FileText size={18} className="text-[var(--color-calendar-text-dim)] group-hover:text-[var(--color-calendar-accent)]" />
                        导出报告 (HTML)
                      </button>
                    </div>
                  </div>

                  <div className="p-4 bg-yellow-500/5 rounded-xl border border-yellow-500/20">
                    <p className="text-xs text-yellow-500/80 leading-relaxed">
                      提示：定期导出备份可以防止数据丢失。导入备份时，您可以选择覆盖当前数据或将新数据合并到现有数据中。
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Backing Up Overlay */}
        {isBackingUp && (
          <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/80 backdrop-blur-md text-white">
            <div className="w-16 h-16 border-4 border-[var(--color-calendar-accent)] border-t-transparent rounded-full animate-spin mb-6"></div>
            <h2 className="text-2xl font-bold mb-2">正在安全退出</h2>
            <p className="text-[var(--color-calendar-text-muted)]">正在为您备份数据，请稍候...</p>
          </div>
        )}

        {isPreviewOpen && previewImage && (
          <ImagePreview src={previewImage} onClose={() => setIsPreviewOpen(false)} />
        )}

        {/* Confirmation Modals */}
        <ImportConfirmModal 
          isOpen={isImportConfirmOpen}
          onConfirm={confirmImport}
          onCancel={() => {
            setIsImportConfirmOpen(false);
            setImportData(null);
          }}
        />

        <ConfirmationModal 
          isOpen={personToDelete !== null}
          title="删除人员"
          message="确定要删除此人员吗？该操作将同时删除其所有日历记录，且无法撤销。"
          onConfirm={performDeletePerson}
          onCancel={() => setPersonToDelete(null)}
        />

        <ConfirmationModal 
          isOpen={isConfirmDeleteOpen}
          title="确认清空记录？"
          message="此操作将永久删除该人员在这一天的所有记录，无法撤销。"
          onConfirm={() => {
            deleteNote();
            setIsConfirmDeleteOpen(false);
          }}
          onCancel={() => setIsConfirmDeleteOpen(false)}
        />
      </div>
    );
}

function ImagePreview({ src, onClose }: { src: string; onClose: () => void }) {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const handleWheel = (e: React.WheelEvent) => {
    // Remove e.preventDefault() to avoid potential main thread blocking
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setScale(prev => Math.max(0.1, Math.min(5, prev + delta)));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  return (
    <div 
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-md"
      onClick={onClose}
      onWheel={handleWheel}
    >
      <div 
        className="relative max-w-[90vw] max-h-[90vh] cursor-grab active:cursor-grabbing"
        onClick={e => e.stopPropagation()}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{
          transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
          transition: isDragging ? 'none' : 'transform 0.1s ease-out'
        }}
      >
        <img 
          src={src} 
          alt="preview" 
          className="w-full h-full object-contain pointer-events-none" 
          referrerPolicy="no-referrer"
        />
      </div>
      <button 
        onClick={onClose}
        className="absolute top-6 right-6 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
      >
        <X size={24} />
      </button>
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 bg-black/50 rounded-full text-white text-sm font-medium backdrop-blur-sm">
        {Math.round(scale * 100)}% | 滚轮缩放 | 拖拽移动
      </div>
    </div>
  );
}

function ImportConfirmModal({ isOpen, onConfirm, onCancel }: { 
  isOpen: boolean; 
  onConfirm: (mode: 'overwrite' | 'merge') => void; 
  onCancel: () => void;
}) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-[var(--color-calendar-surface)] w-full max-w-md rounded-2xl shadow-2xl border border-[var(--color-calendar-border)] overflow-hidden">
        <div className="p-6 space-y-4">
          <div className="w-12 h-12 rounded-full bg-[var(--color-calendar-accent)]/10 flex items-center justify-center text-[var(--color-calendar-accent)] mx-auto">
            <Upload size={24} />
          </div>
          <div className="text-center space-y-2">
            <h3 className="text-lg font-bold text-[var(--color-calendar-text)]">导入数据</h3>
            <p className="text-sm text-[var(--color-calendar-text-dim)]">请选择导入方式：</p>
          </div>
          <div className="space-y-3 pt-2">
            <button 
              onClick={() => onConfirm('merge')}
              className="w-full p-4 rounded-xl border border-[var(--color-calendar-border)] hover:border-[var(--color-calendar-accent)] hover:bg-[var(--color-calendar-accent)]/5 transition-all text-left group"
            >
              <div className="font-bold text-[var(--color-calendar-text)] group-hover:text-[var(--color-calendar-accent)]">保留并合并</div>
              <div className="text-xs text-[var(--color-calendar-text-dim)] mt-1">保留当前数据，仅加入备份中的新人员和记录。</div>
            </button>
            <button 
              onClick={() => onConfirm('overwrite')}
              className="w-full p-4 rounded-xl border border-[var(--color-calendar-border)] hover:border-red-500/50 hover:bg-red-500/5 transition-all text-left group"
            >
              <div className="font-bold text-[var(--color-calendar-text)] group-hover:text-red-500">完全覆盖</div>
              <div className="text-xs text-[var(--color-calendar-text-dim)] mt-1">清空当前所有数据，完全替换为备份文件中的内容。</div>
            </button>
          </div>
        </div>
        <div className="p-4 bg-[var(--color-calendar-surface-hover)]/50 border-t border-[var(--color-calendar-border)] flex justify-end">
          <button 
            onClick={onCancel}
            className="px-6 py-2 rounded-xl text-sm font-medium text-[var(--color-calendar-text-dim)] hover:text-white transition-colors"
          >
            取消
          </button>
        </div>
      </div>
    </div>
  );
}

function ConfirmationModal({ isOpen, title, message, onConfirm, onCancel }: { 
  isOpen: boolean; 
  title: string; 
  message: string; 
  onConfirm: () => void; 
  onCancel: () => void;
}) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-[var(--color-calendar-surface)] w-full max-w-sm rounded-2xl shadow-2xl border border-[var(--color-calendar-border)] overflow-hidden">
        <div className="p-6 space-y-4">
          <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 mx-auto">
            <Trash2 size={24} />
          </div>
          <div className="text-center space-y-2">
            <h3 className="text-lg font-bold text-[var(--color-calendar-text)]">{title}</h3>
            <p className="text-sm text-[var(--color-calendar-text-dim)]">{message}</p>
          </div>
        </div>
        <div className="flex border-t border-[var(--color-calendar-border)]">
          <button 
            onClick={onCancel}
            className="flex-1 px-4 py-3 text-sm font-medium text-[var(--color-calendar-text-dim)] hover:bg-[var(--color-calendar-surface-hover)] transition-colors"
          >
            取消
          </button>
          <button 
            onClick={onConfirm}
            className="flex-1 px-4 py-3 text-sm font-medium text-red-500 hover:bg-red-500/10 transition-colors border-l border-[var(--color-calendar-border)]"
          >
            确认清空
          </button>
        </div>
      </div>
    </div>
  );
}
