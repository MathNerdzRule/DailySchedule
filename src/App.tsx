import { useState, useEffect } from 'react';
import { Plus, RotateCw, X, Bell, Trash2, AlertCircle } from 'lucide-react';
import { ThemeSwitcher } from './components/ThemeSwitcher';
import { TimelineView } from './components/TimelineView';
import type { Task } from './components/TimelineView';
import { format, getDay } from 'date-fns';
import { requestNotificationPermission, scheduleTaskNotification, cancelTaskNotification } from './services/notifications';
import { Preferences } from '@capacitor/preferences';

function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editingDate, setEditingDate] = useState<string>('');
  const [isNewTask, setIsNewTask] = useState<boolean>(false);
  const [overlapError, setOverlapError] = useState<string | null>(null);
  
  const generateId = () => Math.floor(Math.random() * 2147483647);

  const loadInitialTasks = async () => {
    const saved = await Preferences.get({ key: 'tasks' });
    if (saved.value) {
      setTasks(JSON.parse(saved.value));
    }
  };

  useEffect(() => {
    loadInitialTasks();
    requestNotificationPermission();
  }, []);

  useEffect(() => {
    Preferences.set({ key: 'tasks', value: JSON.stringify(tasks) });
  }, [tasks]);

  const getMins = (time: string) => {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  };

  const isTaskOnDate = (task: Task, dateStr: string) => {
    if (task.exceptions?.includes(dateStr)) return false;
    if (task.date === dateStr) return true;
    if (task.date > dateStr) return false;
    
    if (task.recurring) {
      const d = new Date(dateStr + 'T00:00:00');
      const dayOfWeek = getDay(d);
      
      if (task.recurring.type === 'daily') return true;
      if (task.recurring.type === 'weekdays' && dayOfWeek >= 1 && dayOfWeek <= 5) return true;
      if (task.recurring.type === 'custom' && task.recurring.days?.includes(dayOfWeek)) return true;
      if (task.recurring.type === 'monthly') {
        const taskDateObj = new Date(task.date + 'T00:00:00');
        if (d.getDate() === taskDateObj.getDate()) return true;
      }
    }
    return false;
  };

  const checkOverlap = (newTask: Task): string | null => {
    const start = getMins(newTask.start);
    const end = getMins(newTask.end);
    
    if (start >= end) return "End time must be after start time.";

    // We check overlap on the specific date for single tasks, 
    // or across all relevant days for recurring tasks.
    
    // For simplicity, let's check the next 30 days for any overlap
    const checkDays = [];
    if (newTask.recurring && newTask.recurring.type !== 'none') {
      for (let i = 0; i < 30; i++) {
        const d = new Date();
        d.setDate(d.getDate() + i);
        const dStr = format(d, 'yyyy-MM-dd');
        if (isTaskOnDate(newTask, dStr)) checkDays.push(dStr);
      }
    } else {
      checkDays.push(newTask.date);
    }

    for (const dStr of checkDays) {
      const existingOnDay = tasks.filter(t => t.id !== newTask.id && isTaskOnDate(t, dStr));
      for (const t of existingOnDay) {
        const tStart = getMins(t.start);
        const tEnd = getMins(t.end);
        
        if ((start < tEnd && end > tStart)) {
          return `Overlaps with "${t.title}" on ${dStr}`;
        }
      }
    }

    return null;
  };

  const saveEditedTask = async () => {
    if (editingTask) {
      const error = checkOverlap(editingTask);
      if (error) {
        setOverlapError(error);
        return;
      }
      setOverlapError(null);

      if (isNewTask) {
        setTasks(prev => [...prev, editingTask]);
        scheduleTaskNotification(editingTask);
      } else {
        if (editingTask.recurring && editingTask.recurring.type !== 'none' && editingDate) {
          const choice = confirm("Update only THIS instance? (Cancel to update the ENTIRE series)");
          if (choice) {
            const originalTask = tasks.find(t => t.id === editingTask.id);
            if (originalTask) {
              const updatedOriginal = { ...originalTask, exceptions: [...(originalTask.exceptions || []), editingDate] };
              const newDetachedTask = { ...editingTask, id: generateId(), recurring: { type: 'none' as const }, date: editingDate, exceptions: [] };
              setTasks(prev => [...prev.map(t => t.id === originalTask.id ? updatedOriginal : t), newDetachedTask]);
              scheduleTaskNotification(newDetachedTask);
            }
            setEditingTask(null);
            setIsNewTask(false);
            return;
          }
        }
        setTasks(prev => prev.map(t => t.id === editingTask.id ? editingTask : t));
        scheduleTaskNotification(editingTask);
      }
      setEditingTask(null);
      setIsNewTask(false);
    }
  };

  const handleDelete = async (id: number, dateToDelete?: string) => {
    if (isNewTask) {
      setEditingTask(null);
      setIsNewTask(false);
      return;
    }

    const task = tasks.find(t => t.id === id);
    if (!task) return;

    if (task.recurring && task.recurring.type !== 'none' && dateToDelete) {
      const choice = confirm("Delete only THIS instance? (Cancel to delete the ENTIRE series)");
      if (choice) {
        const updatedTask = { ...task, exceptions: [...(task.exceptions || []), dateToDelete] };
        setTasks(prev => prev.map(t => t.id === id ? updatedTask : t));
        setEditingTask(null);
        return;
      }
    }

    if (confirm("Delete the entire task series?")) {
      setTasks(prev => prev.filter(t => t.id !== id));
      cancelTaskNotification(id);
      setEditingTask(null);
    }
  };

  const toggleDay = (day: number) => {
    if (editingTask && editingTask.recurring) {
      const currentDays = editingTask.recurring.days || [];
      const newDays = currentDays.includes(day) 
        ? currentDays.filter(d => d !== day)
        : [...currentDays, day].sort();
      setEditingTask({
        ...editingTask,
        recurring: { ...editingTask.recurring, type: 'custom', days: newDays }
      });
    }
  };

  const handleEditTask = (task: Task, date: string) => {
    setIsNewTask(false);
    setEditingTask(task);
    setEditingDate(date);
    setOverlapError(null);
  };

  const handleAddNewTask = () => {
    setIsNewTask(true);
    setEditingTask({
      id: generateId(),
      title: '',
      start: format(new Date(), 'HH:00'),
      end: format(new Date(Date.now() + 3600000), 'HH:00'),
      category: 'Work',
      priority: 1,
      date: format(selectedDate, 'yyyy-MM-dd'),
      reminderMinutes: 5,
      recurring: { type: 'none' },
      exceptions: []
    } as Task);
    setEditingDate(format(selectedDate, 'yyyy-MM-dd'));
    setOverlapError(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-24 font-sans transition-colors duration-300">
      <header className="sticky top-0 z-50 bg-white dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-6 py-4"
              style={{ paddingTop: 'calc(env(safe-area-inset-top) + 1rem)' }}>
        <div className="flex justify-between items-center max-w-2xl mx-auto">
          <div className="flex items-center gap-2">
            <span className="text-2xl animate-pulse">📅</span>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
              Daily Schedule
            </h1>
          </div>
          <ThemeSwitcher />
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        <TimelineView tasks={tasks} onEdit={handleEditTask} selectedDate={selectedDate} setSelectedDate={setSelectedDate} />
      </main>

      {editingTask && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => { setEditingTask(null); setIsNewTask(false); }}></div>
          <div className="relative w-full max-w-sm bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-8 space-y-6 max-h-[85vh] overflow-y-auto">
              <div className="flex justify-between items-start">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{isNewTask ? 'New Task' : 'Task Details'}</h2>
                <button onClick={() => { setEditingTask(null); setIsNewTask(false); }} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full">
                  <X size={20} className="text-slate-400" />
                </button>
              </div>

              <div className="space-y-4">
                {overlapError && (
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3 rounded-xl flex gap-2 items-center text-red-600 dark:text-red-400 text-xs font-bold animate-in slide-in-from-top-2">
                    <AlertCircle size={16} />
                    {overlapError}
                  </div>
                )}

                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Title</label>
                  <input 
                    value={editingTask.title}
                    onChange={e => setEditingTask({...editingTask, title: e.target.value})}
                    placeholder="Enter task title"
                    className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 py-3 font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Start</label>
                    <input 
                      type="time"
                      value={editingTask.start}
                      onChange={e => setEditingTask({...editingTask, start: e.target.value})}
                      className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 py-3 font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">End</label>
                    <input 
                      type="time"
                      value={editingTask.end}
                      onChange={e => setEditingTask({...editingTask, end: e.target.value})}
                      className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 py-3 font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                </div>

                {(!editingTask.recurring || editingTask.recurring.type === 'none') && (
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Date</label>
                    <input 
                      type="date"
                      value={editingTask.date}
                      onChange={e => setEditingTask({...editingTask, date: e.target.value})}
                      className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 py-3 font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                )}

                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2 flex items-center gap-2">
                    <RotateCw size={12} /> Recurrence
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: 'none', label: 'None' },
                      { id: 'daily', label: 'Daily' },
                      { id: 'weekdays', label: 'Weekdays' },
                      { id: 'custom', label: 'Custom Days' },
                    ].map((type) => (
                      <button
                        key={type.id}
                        onClick={() => setEditingTask({
                          ...editingTask, 
                          recurring: { 
                            type: type.id as any, 
                            days: type.id === 'custom' 
                                   ? (editingTask.recurring?.days || [new Date(editingDate || new Date()).getDay()]) 
                                   : undefined 
                          }
                        })}
                        className={`py-2 rounded-xl text-xs font-bold transition-all ${editingTask.recurring?.type === type.id ? 'bg-amber-500 text-white shadow-lg' : 'bg-slate-50 dark:bg-slate-800 text-slate-500'}`}
                      >
                        {type.label}
                      </button>
                    ))}
                  </div>

                  {editingTask.recurring?.type === 'custom' && (
                    <div className="flex justify-between mt-3 px-1">
                      {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
                        <button
                          key={i}
                          onClick={() => toggleDay(i)}
                          className={`w-8 h-8 rounded-full text-[10px] font-bold transition-all ${editingTask.recurring?.days?.includes(i) ? 'bg-amber-500 text-white shadow-md' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}
                        >
                          {day}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2 flex items-center gap-2">
                    <Bell size={12} /> Reminder Before Start
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {[0, 5, 15, 30, 60].map(mins => (
                      <button
                        key={mins}
                        onClick={() => setEditingTask({...editingTask, reminderMinutes: mins})}
                        className={`py-2 rounded-xl text-xs font-bold transition-all ${editingTask.reminderMinutes === mins ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-50 dark:bg-slate-800 text-slate-500'}`}
                      >
                        {mins === 0 ? 'None' : mins >= 60 ? '1h' : `${mins}m`}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button 
                  onClick={() => handleDelete(editingTask.id, editingDate)}
                  className={`flex-1 ${isNewTask ? 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700' : 'bg-red-50 dark:bg-red-900/20 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30'} py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all`}
                >
                  {isNewTask ? <><X size={18} /> Cancel</> : <><Trash2 size={18} /> Delete</>}
                </button>
                <button 
                  onClick={saveEditedTask}
                  className="flex-[2] bg-blue-600 text-white py-4 rounded-2xl font-bold shadow-xl shadow-blue-500/40 active:scale-95 transition-all"
                >
                  {isNewTask ? 'Add Task' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="fixed bottom-8 left-0 right-0 flex justify-center items-center gap-4 px-6 pointer-events-none" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <button 
          onClick={handleAddNewTask}
          className="pointer-events-auto bg-blue-600 text-white p-5 rounded-full shadow-2xl shadow-blue-500/40 active:scale-95 transition-all hover:bg-blue-700"
        >
          <Plus size={32} />
        </button>
      </div>
    </div>
  );
}

export default App;
