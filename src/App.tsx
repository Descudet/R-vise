/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useMemo } from 'react';
import { 
  format, 
  addWeeks, 
  subWeeks, 
  startOfWeek, 
  addDays, 
  isSameDay, 
  isToday, 
  parseISO 
} from 'date-fns';
import { fr } from 'date-fns/locale';
import { 
  onAuthStateChanged, 
  User as FirebaseUser 
} from 'firebase/auth';
import { 
  collection, 
  doc, 
  onSnapshot, 
  setDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy,
  serverTimestamp,
  writeBatch
} from 'firebase/firestore';
import { auth, db, signInWithGoogle, logout } from './firebase';
import { 
  ChevronLeft, 
  ChevronRight, 
  ChevronDown,
  Plus, 
  MapPin, 
  Clock, 
  CheckCircle2, 
  Circle,
  Trash2,
  Calendar as CalendarIcon,
  Settings2,
  Check,
  Settings,
  Moon,
  Sun,
  Monitor,
  Palette,
  LogOut,
  LogIn
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

import { cn } from '@/lib/utils';
import { 
  Task, 
  Category, 
  TimePeriod, 
  TIME_PERIOD_LABELS, 
  CATEGORY_COLORS,
  Theme,
  AccentColor,
  TIME_PERIOD_ORDER
} from './types';
import { CATEGORY_ICONS as Icons, IconName } from './lib/icons';

const DEFAULT_CATEGORIES: Category[] = [
  { id: '1', name: 'Révision', color: '#007AFF', iconName: 'Book' },
  { id: '2', name: 'Sport', color: '#34C759', iconName: 'Dumbbell' },
  { id: '3', name: 'Loisir', color: '#AF52DE', iconName: 'Music' },
];

export default function App() {
  // Auth State
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  // State
  const [theme, setTheme] = useState<Theme>('system');
  const [accentColor, setAccentColor] = useState<AccentColor>('black');
  
  const [tasks, setTasks] = useState<Task[]>([]);
  const [categories, setCategories] = useState<Category[]>(DEFAULT_CATEGORIES);
  const [currentWeekStart, setCurrentWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showMoments, setShowMoments] = useState(false);
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());

  // Form State
  const [newTask, setNewTask] = useState<Partial<Task>>({
    name: '',
    location: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    timePeriod: 'all_day',
    categoryId: DEFAULT_CATEGORIES[0].id,
    completed: false,
  });

  const [newCategory, setNewCategory] = useState<Partial<Category>>({
    name: '',
    color: CATEGORY_COLORS[0].value,
    iconName: 'Book',
  });

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setIsAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Firestore Listeners
  useEffect(() => {
    if (!user) {
      setTasks([]);
      setCategories(DEFAULT_CATEGORIES);
      return;
    }

    // User Settings Listener
    const userDocRef = doc(db, 'users', user.uid);
    const unsubUser = onSnapshot(userDocRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (data.theme) setTheme(data.theme);
        if (data.accentColor) setAccentColor(data.accentColor);
      } else {
        // Initialize user doc
        setDoc(userDocRef, {
          uid: user.uid,
          email: user.email,
          theme: 'system',
          accentColor: 'black'
        });
      }
    });

    // Categories Listener
    const categoriesQuery = query(collection(db, 'categories'), where('uid', '==', user.uid));
    const unsubCategories = onSnapshot(categoriesQuery, (snapshot) => {
      const cats = snapshot.docs.map(d => d.data() as Category);
      setCategories(cats.length > 0 ? cats : DEFAULT_CATEGORIES);
    });

    // Tasks Listener
    const tasksQuery = query(collection(db, 'tasks'), where('uid', '==', user.uid), orderBy('createdAt', 'desc'));
    const unsubTasks = onSnapshot(tasksQuery, (snapshot) => {
      const tks = snapshot.docs.map(d => d.data() as Task);
      setTasks(tks);
    });

    return () => {
      unsubUser();
      unsubCategories();
      unsubTasks();
    };
  }, [user]);

  // Theme effect
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    
    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      root.classList.add(systemTheme);
    } else {
      root.classList.add(theme);
    }

    // Sync theme to Firestore if changed locally
    if (user) {
      setDoc(doc(db, 'users', user.uid), { theme }, { merge: true });
    }
  }, [theme, user]);

  // Accent color effect
  useEffect(() => {
    const root = window.document.documentElement;
    const colors: Record<AccentColor, string> = {
      black: '#1c1c1e',
      red: '#ff3b30',
      blue: '#007aff',
      green: '#34c759',
      yellow: '#ffcc00'
    };
    const foregrounds: Record<AccentColor, string> = {
      black: '#ffffff',
      red: '#ffffff',
      blue: '#ffffff',
      green: '#ffffff',
      yellow: '#1c1c1e'
    };
    root.style.setProperty('--accent-color', colors[accentColor]);
    root.style.setProperty('--accent-foreground', foregrounds[accentColor]);

    // Sync accent color to Firestore if changed locally
    if (user) {
      setDoc(doc(db, 'users', user.uid), { accentColor }, { merge: true });
    }
  }, [accentColor, user]);

  // Derived data
  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }).map((_, i) => addDays(currentWeekStart, i));
  }, [currentWeekStart]);

  const filteredTasks = useMemo(() => {
    return tasks
      .filter(task => isSameDay(parseISO(task.date), selectedDate))
      .sort((a, b) => {
        // First sort by time period order
        const orderA = TIME_PERIOD_ORDER[a.timePeriod];
        const orderB = TIME_PERIOD_ORDER[b.timePeriod];
        
        if (orderA !== orderB) {
          return orderA - orderB;
        }
        
        // If both are specific_time, sort by time
        if (a.timePeriod === 'specific_time' && b.timePeriod === 'specific_time') {
          return (a.specificTime || '').localeCompare(b.specificTime || '');
        }
        
        return 0;
      });
  }, [tasks, selectedDate]);

  // Handlers
  const handlePrevWeek = () => setCurrentWeekStart(subWeeks(currentWeekStart, 1));
  const handleNextWeek = () => setCurrentWeekStart(addWeeks(currentWeekStart, 1));

  const toggleExpand = (taskId: string) => {
    setExpandedTasks(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  };

  const handleAddTask = async () => {
    if (!newTask.name || !newTask.date || !newTask.categoryId || !user) return;

    const taskId = crypto.randomUUID();
    const task: any = {
      id: taskId,
      name: newTask.name!,
      location: newTask.location || '',
      date: newTask.date!,
      timePeriod: newTask.timePeriod as TimePeriod,
      specificTime: newTask.specificTime || '',
      description: newTask.description || '',
      categoryId: newTask.categoryId!,
      completed: false,
      uid: user.uid,
      createdAt: serverTimestamp()
    };

    try {
      await setDoc(doc(db, 'tasks', taskId), task);
      setIsAddModalOpen(false);
      setNewTask({
        name: '',
        location: '',
        date: format(selectedDate, 'yyyy-MM-dd'),
        timePeriod: 'all_day',
        categoryId: categories[0]?.id || DEFAULT_CATEGORIES[0].id,
        completed: false,
      });
    } catch (error) {
      console.error("Error adding task:", error);
    }
  };

  const handleAddCategory = async () => {
    if (!newCategory.name || !newCategory.color || !newCategory.iconName || !user) return;

    const categoryId = crypto.randomUUID();
    const category: Category & { uid: string } = {
      id: categoryId,
      name: newCategory.name!,
      color: newCategory.color!,
      iconName: newCategory.iconName!,
      uid: user.uid
    };

    try {
      await setDoc(doc(db, 'categories', categoryId), category);
      setNewCategory({
        name: '',
        color: CATEGORY_COLORS[0].value,
        iconName: 'Book',
      });
    } catch (error) {
      console.error("Error adding category:", error);
    }
  };

  const deleteCategory = async (id: string) => {
    if (categories.length <= 1 || !user) return;
    
    try {
      const batch = writeBatch(db);
      batch.delete(doc(db, 'categories', id));
      
      const firstRemaining = categories.find(c => c.id !== id);
      if (firstRemaining) {
        tasks.filter(t => t.categoryId === id).forEach(t => {
          batch.update(doc(db, 'tasks', t.id), { categoryId: firstRemaining.id });
        });
      }
      
      await batch.commit();
    } catch (error) {
      console.error("Error deleting category:", error);
    }
  };

  const toggleTask = async (id: string) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    
    try {
      await setDoc(doc(db, 'tasks', id), { completed: !task.completed }, { merge: true });
    } catch (error) {
      console.error("Error toggling task:", error);
    }
  };

  const deleteTask = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'tasks', id));
    } catch (error) {
      console.error("Error deleting task:", error);
    }
  };

  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-apple-gray-100 flex items-center justify-center">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-12 h-12 border-4 border-accent-primary border-t-transparent rounded-full"
        />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-apple-gray-100 flex items-center justify-center p-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="apple-card p-10 max-w-md w-full text-center space-y-8"
        >
          <div className="space-y-2">
            <h1 className="text-4xl font-bold tracking-tight text-apple-gray-700">StudyFlow</h1>
            <p className="text-apple-gray-500">Organisez vos révisions en toute simplicité</p>
          </div>
          
          <div className="w-24 h-24 bg-accent-primary/10 rounded-[32px] flex items-center justify-center mx-auto">
            <CalendarIcon className="w-12 h-12 text-accent-primary" />
          </div>

          <Button 
            onClick={signInWithGoogle}
            className="w-full h-14 rounded-2xl bg-accent-primary text-accent-foreground text-lg font-semibold shadow-lg gap-3"
          >
            <LogIn className="w-5 h-5" />
            Se connecter avec Google
          </Button>
          
          <p className="text-xs text-apple-gray-400">
            Vos données seront synchronisées en toute sécurité sur tous vos appareils.
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-apple-gray-100 pb-20">
      {/* Header */}
      <header className="sticky top-0 z-10 apple-blur px-6 py-4 flex items-center justify-between">
        <div className="flex flex-col">
          <h1 className="text-2xl font-bold tracking-tight text-apple-gray-700">
            {format(currentWeekStart, 'MMMM yyyy', { locale: fr }).charAt(0).toUpperCase() + format(currentWeekStart, 'MMMM yyyy', { locale: fr }).slice(1)}
          </h1>
          <p className="text-sm text-apple-gray-500 font-medium">Programme de {user.displayName || 'révision'}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={logout}
            className="rounded-full hover:bg-red-50 text-red-500"
          >
            <LogOut className="w-5 h-5" />
          </Button>
          <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
            <DialogTrigger render={<Button variant="ghost" size="icon" className="rounded-full hover:bg-apple-gray-200">
              <Settings className="w-5 h-5" />
            </Button>}>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[400px] rounded-[32px] p-0 overflow-hidden border-none shadow-2xl">
              <div className="apple-blur p-6">
                <DialogHeader className="mb-6">
                  <DialogTitle className="text-2xl font-bold text-center">Réglages</DialogTitle>
                </DialogHeader>
                
                <div className="space-y-8">
                  <div className="space-y-4">
                    <Label className="text-xs font-bold uppercase tracking-wider text-apple-gray-500 ml-1 flex items-center gap-2">
                      <Monitor className="w-3 h-3" /> Thème
                    </Label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: 'light', label: 'Clair', icon: Sun },
                        { id: 'dark', label: 'Sombre', icon: Moon },
                        { id: 'system', label: 'Auto', icon: Monitor },
                      ].map((t) => (
                        <button
                          key={t.id}
                          onClick={() => setTheme(t.id as Theme)}
                          className={cn(
                            "flex flex-col items-center gap-2 p-3 rounded-2xl border transition-all",
                            theme === t.id 
                              ? "bg-accent-primary text-accent-foreground border-accent-primary shadow-md" 
                              : "bg-apple-gray-50 text-apple-gray-600 border-apple-gray-200 hover:bg-apple-gray-100 dark:bg-apple-gray-200 dark:text-apple-gray-500"
                          )}
                        >
                          <t.icon className="w-5 h-5" />
                          <span className="text-xs font-semibold">{t.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <Label className="text-xs font-bold uppercase tracking-wider text-apple-gray-500 ml-1 flex items-center gap-2">
                      <Palette className="w-3 h-3" /> Couleur d'accentuation
                    </Label>
                    <div className="flex flex-wrap gap-3 justify-center">
                      {[
                        { id: 'black', color: '#1c1c1e', label: 'Noir' },
                        { id: 'red', color: '#ff3b30', label: 'Rouge' },
                        { id: 'blue', color: '#007aff', label: 'Bleu' },
                        { id: 'green', color: '#34c759', label: 'Vert' },
                        { id: 'yellow', color: '#ffcc00', label: 'Jaune' },
                      ].map((c) => (
                        <button
                          key={c.id}
                          onClick={() => setAccentColor(c.id as AccentColor)}
                          className={cn(
                            "group relative flex flex-col items-center gap-1",
                            accentColor === c.id ? "scale-110" : "hover:scale-105"
                          )}
                        >
                          <div 
                            className={cn(
                              "w-10 h-10 rounded-full transition-all flex items-center justify-center",
                              accentColor === c.id ? "ring-2 ring-offset-2 ring-apple-gray-300 shadow-md" : "opacity-80"
                            )}
                            style={{ backgroundColor: c.color }}
                          >
                            {accentColor === c.id && <Check className="w-5 h-5 text-white" />}
                          </div>
                          <span className="text-[10px] font-bold text-apple-gray-500 uppercase tracking-tighter">{c.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <DialogFooter className="mt-8">
                  <Button 
                    onClick={() => setIsSettingsOpen(false)}
                    className="w-full rounded-2xl h-12 bg-accent-primary hover:opacity-90 text-accent-foreground font-semibold"
                  >
                    Terminé
                  </Button>
                </DialogFooter>
              </div>
            </DialogContent>
          </Dialog>
          <Button variant="ghost" size="icon" onClick={handlePrevWeek} className="rounded-full hover:bg-apple-gray-200">
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <Button variant="ghost" size="icon" onClick={handleNextWeek} className="rounded-full hover:bg-apple-gray-200">
            <ChevronRight className="w-5 h-5" />
          </Button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 mt-8 space-y-8">
        {/* Week Calendar */}
        <section className="apple-card p-4">
          <div className="grid grid-cols-7 gap-2">
            {weekDays.map((day) => {
              const isActive = isSameDay(day, selectedDate);
              const isTodayDay = isToday(day);
              
              return (
                <button
                  key={day.toISOString()}
                  onClick={() => setSelectedDate(day)}
                  className={cn(
                    "flex flex-col items-center py-3 rounded-2xl transition-all duration-200",
                    isActive 
                      ? "bg-accent-primary text-accent-foreground shadow-lg scale-105" 
                      : "hover:bg-apple-gray-200 text-apple-gray-500"
                  )}
                >
                  <span className="text-[10px] uppercase font-bold tracking-wider mb-1">
                    {format(day, 'EEE', { locale: fr })}
                  </span>
                  <span className={cn(
                    "text-lg font-semibold",
                    isTodayDay && !isActive && "text-blue-600"
                  )}>
                    {format(day, 'd')}
                  </span>
                  {isTodayDay && !isActive && (
                    <div className="w-1 h-1 bg-blue-600 rounded-full mt-1" />
                  )}
                </button>
              );
            })}
          </div>
        </section>

        {/* Task List */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-apple-gray-700">
              {isToday(selectedDate) ? "Aujourd'hui" : format(selectedDate, 'EEEE d MMMM', { locale: fr })}
            </h2>
            <div className="flex gap-2">
              <Dialog open={isCategoryModalOpen} onOpenChange={setIsCategoryModalOpen}>
                <DialogTrigger render={<Button variant="outline" size="icon" className="rounded-full border-apple-gray-200 text-apple-gray-500 hover:bg-apple-gray-200" />}>
                  <Settings2 className="w-4 h-4" />
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px] rounded-[32px] p-0 overflow-hidden border-none shadow-2xl bg-white dark:bg-apple-gray-50">
                  <div className="flex flex-col h-full max-h-[85vh]">
                    <DialogHeader className="p-6 pb-4 shrink-0 border-b border-apple-gray-100 dark:border-apple-gray-200">
                      <DialogTitle className="text-2xl font-bold text-center">Catégories</DialogTitle>
                    </DialogHeader>

                    <div className="flex-grow overflow-y-auto p-6 space-y-6">
                      {/* Add Category Form */}
                      <div className="apple-card p-4 space-y-4 bg-apple-gray-50/50 dark:bg-apple-gray-100/50">
                        <div className="space-y-2">
                          <Label className="text-xs font-bold uppercase tracking-wider text-apple-gray-500">Nouvelle catégorie</Label>
                          <div className="flex gap-2">
                            <Input 
                              placeholder="Nom..." 
                              className="rounded-xl bg-white dark:bg-apple-gray-200 border-apple-gray-200 h-10"
                              value={newCategory.name}
                              onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
                            />
                            <Button onClick={handleAddCategory} className="rounded-xl bg-accent-primary text-accent-foreground h-10 px-4">
                              <Plus className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-xs font-bold uppercase tracking-wider text-apple-gray-500">Couleur</Label>
                          <div className="flex flex-wrap gap-3">
                            {CATEGORY_COLORS.map((c) => (
                              <button
                                key={c.value}
                                type="button"
                                onClick={() => setNewCategory({ ...newCategory, color: c.value })}
                                className={cn(
                                  "w-8 h-8 rounded-full transition-all duration-200",
                                  newCategory.color === c.value ? "scale-110 ring-2 ring-offset-2 ring-apple-gray-300 shadow-md" : "hover:scale-105 opacity-80 hover:opacity-100"
                                )}
                                style={{ backgroundColor: c.value }}
                              />
                            ))}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-xs font-bold uppercase tracking-wider text-apple-gray-500">Icône</Label>
                          <div className="flex flex-wrap gap-2">
                            {Object.entries(Icons).map(([name, IconComp]) => (
                              <button
                                key={name}
                                onClick={() => setNewCategory({ ...newCategory, iconName: name as IconName })}
                                className={cn(
                                  "p-2 rounded-lg transition-all",
                                  newCategory.iconName === name 
                                    ? "bg-accent-primary text-accent-foreground" 
                                    : "bg-white text-apple-gray-400 hover:bg-apple-gray-100 dark:bg-apple-gray-200"
                                )}
                              >
                                <IconComp className="w-4 h-4" />
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Category List */}
                      <div className="space-y-2">
                        {categories.map((cat) => {
                          const IconComp = Icons[cat.iconName as IconName] || Icons.Book;
                          return (
                            <div key={cat.id} className="flex items-center justify-between p-3 rounded-2xl bg-white dark:bg-apple-gray-100 border border-apple-gray-200">
                              <div className="flex items-center gap-3">
                                <div className="p-2 rounded-xl" style={{ backgroundColor: `${cat.color}20`, color: cat.color }}>
                                  <IconComp className="w-4 h-4" />
                                </div>
                                <span className="font-semibold text-apple-gray-700 dark:text-apple-gray-700">{cat.name}</span>
                              </div>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={() => deleteCategory(cat.id)}
                                disabled={categories.length <= 1}
                                className="text-red-500 hover:text-red-600 hover:bg-red-50 rounded-full"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <DialogFooter className="p-6 pt-2 shrink-0 border-t border-apple-gray-100 dark:border-apple-gray-200">
                      <Button onClick={() => setIsCategoryModalOpen(false)} className="w-full rounded-2xl h-12 bg-apple-gray-100 dark:bg-apple-gray-200 text-apple-gray-700 dark:text-apple-gray-700 font-semibold">
                        Fermer
                      </Button>
                    </DialogFooter>
                  </div>
                </DialogContent>
              </Dialog>

              <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
                <DialogTrigger render={<Button className="rounded-full bg-accent-primary hover:opacity-90 text-accent-foreground gap-2 px-5 shadow-md" />}>
                  <Plus className="w-4 h-4" />
                  Ajouter
                </DialogTrigger>
                <DialogContent className="sm:max-w-[450px] rounded-[32px] p-0 overflow-hidden border-none shadow-2xl h-[90vh] max-h-[90vh] flex flex-col bg-white dark:bg-apple-gray-50">
                  <div className="flex flex-col h-full overflow-hidden">
                    <DialogHeader className="p-6 pb-4 shrink-0 border-b border-apple-gray-100 dark:border-apple-gray-200">
                      <DialogTitle className="text-2xl font-bold text-center">Nouvelle tâche</DialogTitle>
                    </DialogHeader>
                    
                    <div className="flex-grow overflow-y-auto px-6 py-6 space-y-6 custom-scrollbar">
                      <div className="space-y-2">
                        <Label htmlFor="name" className="text-xs font-bold uppercase tracking-wider text-apple-gray-500 ml-1">Nom de la tâche</Label>
                        <Input 
                          id="name" 
                          placeholder="Ex: Révision Mathématiques" 
                          className="rounded-2xl bg-apple-gray-50 dark:bg-apple-gray-100 border-apple-gray-200 focus:ring-apple-gray-300 h-12"
                          value={newTask.name}
                          onChange={(e) => setNewTask({ ...newTask, name: e.target.value })}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-xs font-bold uppercase tracking-wider text-apple-gray-500 ml-1">Date</Label>
                          <Popover>
                            <PopoverTrigger render={<Button variant="outline" className="w-full justify-start text-left font-normal rounded-2xl h-12 bg-apple-gray-50 dark:bg-apple-gray-100 border-apple-gray-200" />}>
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {newTask.date ? format(parseISO(newTask.date), 'dd/MM/yyyy') : <span>Choisir</span>}
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0 rounded-3xl overflow-hidden shadow-xl border-none">
                              <Calendar
                                mode="single"
                                selected={newTask.date ? parseISO(newTask.date) : undefined}
                                onSelect={(date) => date && setNewTask({ ...newTask, date: format(date, 'yyyy-MM-dd') })}
                                initialFocus
                                locale={fr}
                              />
                            </PopoverContent>
                          </Popover>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="location" className="text-xs font-bold uppercase tracking-wider text-apple-gray-500 ml-1">Lieu (facultatif)</Label>
                          <Input 
                            id="location" 
                            placeholder="Ex: Bibliothèque" 
                            className="rounded-2xl bg-apple-gray-50 dark:bg-apple-gray-100 border-apple-gray-200 h-12"
                            value={newTask.location}
                            onChange={(e) => setNewTask({ ...newTask, location: e.target.value })}
                          />
                        </div>
                      </div>

                      <div className="space-y-3">
                        <Label className="text-xs font-bold uppercase tracking-wider text-apple-gray-500 ml-1">Temporalité</Label>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setNewTask({ ...newTask, timePeriod: 'all_day' });
                              setShowMoments(false);
                            }}
                            className={cn(
                              "px-3 py-2.5 rounded-xl text-xs font-medium transition-all text-left border",
                              newTask.timePeriod === 'all_day'
                                ? "bg-accent-primary text-accent-foreground border-accent-primary shadow-md" 
                                : "bg-apple-gray-50 text-apple-gray-600 border-apple-gray-200 hover:bg-apple-gray-100 dark:bg-apple-gray-200 dark:text-apple-gray-500"
                            )}
                          >
                            Toute la journée
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setNewTask({ ...newTask, timePeriod: 'specific_time' });
                              setShowMoments(false);
                            }}
                            className={cn(
                              "px-3 py-2.5 rounded-xl text-xs font-medium transition-all text-left border",
                              newTask.timePeriod === 'specific_time'
                                ? "bg-accent-primary text-accent-foreground border-accent-primary shadow-md" 
                                : "bg-apple-gray-50 text-apple-gray-600 border-apple-gray-200 hover:bg-apple-gray-100 dark:bg-apple-gray-200 dark:text-apple-gray-500"
                            )}
                          >
                            Heure précise
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowMoments(!showMoments)}
                            className={cn(
                              "px-3 py-2.5 rounded-xl text-xs font-medium transition-all text-left border col-span-2",
                              showMoments || (newTask.timePeriod !== 'all_day' && newTask.timePeriod !== 'specific_time')
                                ? "bg-apple-gray-200 text-apple-gray-700 border-apple-gray-300 dark:bg-apple-gray-300 dark:text-apple-gray-700"
                                : "bg-apple-gray-50 text-apple-gray-600 border-apple-gray-200 hover:bg-apple-gray-100 dark:bg-apple-gray-200 dark:text-apple-gray-500"
                            )}
                          >
                            Moment de la journée {showMoments ? '↑' : '↓'}
                          </button>
                        </div>

                        <AnimatePresence>
                          {showMoments && (
                            <motion.div 
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              className="grid grid-cols-2 gap-2 overflow-hidden"
                            >
                              {Object.entries(TIME_PERIOD_LABELS)
                                .filter(([value]) => value !== 'all_day' && value !== 'specific_time')
                                .map(([value, label]) => (
                                  <button
                                    key={value}
                                    type="button"
                                    onClick={() => setNewTask({ ...newTask, timePeriod: value as TimePeriod })}
                                    className={cn(
                                      "px-3 py-2 rounded-lg text-[11px] font-medium transition-all text-left border",
                                      newTask.timePeriod === value
                                        ? "bg-accent-primary text-accent-foreground border-accent-primary"
                                        : "bg-apple-gray-50/50 text-apple-gray-500 border-apple-gray-100 hover:bg-apple-gray-100 dark:bg-apple-gray-200"
                                    )}
                                  >
                                    {label}
                                  </button>
                                ))}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      {newTask.timePeriod === 'specific_time' && (
                        <motion.div 
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          className="space-y-2 overflow-hidden"
                        >
                          <Label htmlFor="time" className="text-xs font-bold uppercase tracking-wider text-apple-gray-500 ml-1">Heure précise</Label>
                          <Input 
                            id="time" 
                            type="time" 
                            className="rounded-2xl bg-apple-gray-50 dark:bg-apple-gray-100 border-apple-gray-200 h-12"
                            value={newTask.specificTime}
                            onChange={(e) => setNewTask({ ...newTask, specificTime: e.target.value })}
                          />
                        </motion.div>
                      )}

                      <div className="space-y-2">
                        <Label className="text-xs font-bold uppercase tracking-wider text-apple-gray-500 ml-1">Catégorie</Label>
                        <div className="flex flex-wrap gap-2">
                          {categories.map((cat) => {
                            const IconComp = Icons[cat.iconName as IconName] || Icons.Book;
                            const isSelected = newTask.categoryId === cat.id;
                            return (
                              <button
                                key={cat.id}
                                type="button"
                                onClick={() => setNewTask({ ...newTask, categoryId: cat.id })}
                                className={cn(
                                  "flex items-center gap-2 px-4 py-2.5 rounded-2xl transition-all border-2",
                                  isSelected 
                                    ? "shadow-sm" 
                                    : "opacity-70 hover:opacity-100"
                                )}
                                style={{ 
                                  backgroundColor: isSelected ? `${cat.color}15` : 'transparent',
                                  color: cat.color,
                                  borderColor: isSelected ? cat.color : 'transparent'
                                }}
                              >
                                <IconComp className="w-4 h-4" />
                                <span className="text-xs font-bold">{cat.name}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="description" className="text-xs font-bold uppercase tracking-wider text-apple-gray-500 ml-1">Description (facultatif)</Label>
                        <Textarea 
                          id="description" 
                          placeholder="Détails supplémentaires..." 
                          className="rounded-2xl bg-apple-gray-50 dark:bg-apple-gray-100 border-apple-gray-200 min-h-[100px] resize-none focus:ring-apple-gray-300"
                          value={newTask.description}
                          onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                        />
                      </div>
                    </div>

                    <DialogFooter className="p-6 shrink-0 border-t border-apple-gray-100 dark:border-apple-gray-200 bg-white/80 dark:bg-apple-gray-50/80 backdrop-blur-md">
                      <Button 
                        onClick={handleAddTask}
                        className="w-full rounded-2xl h-14 bg-accent-primary hover:opacity-90 text-accent-foreground text-lg font-semibold shadow-lg"
                      >
                        Enregistrer
                      </Button>
                    </DialogFooter>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          <ScrollArea className="h-[calc(100vh-350px)] pr-4">
            <AnimatePresence mode="popLayout">
              {filteredTasks.length === 0 ? (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col items-center justify-center py-20 text-center space-y-4"
                >
                  <div className="w-20 h-20 bg-apple-gray-200 rounded-full flex items-center justify-center">
                    <CalendarIcon className="w-10 h-10 text-apple-gray-400" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-lg font-semibold text-apple-gray-500">Aucune tâche prévue</p>
                    <p className="text-sm text-apple-gray-400">Profitez de votre journée ou ajoutez une révision !</p>
                  </div>
                </motion.div>
              ) : (
                <div className="space-y-3">
                  {filteredTasks.map((task) => {
                    const category = categories.find(c => c.id === task.categoryId) || DEFAULT_CATEGORIES[0];
                    const isExpanded = expandedTasks.has(task.id);

                    return (
                      <motion.div
                        key={task.id}
                        layout
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className={cn(
                          "apple-card flex flex-col group transition-all duration-300 overflow-hidden",
                          task.completed && "opacity-60"
                        )}
                      >
                        <div className="p-4 flex items-center gap-4">
                          <button 
                            onClick={() => toggleTask(task.id)}
                            className="flex-shrink-0 transition-transform active:scale-90"
                          >
                            {task.completed ? (
                              <CheckCircle2 className="w-6 h-6 text-green-500 fill-green-50" />
                            ) : (
                              <Circle className="w-6 h-6 text-apple-gray-300 hover:text-apple-gray-400" />
                            )}
                          </button>

                          <div className="flex-grow min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <h3 className={cn(
                                "font-semibold text-apple-gray-700 truncate",
                                task.completed && "line-through text-apple-gray-400"
                              )}>
                                {task.name}
                              </h3>
                              <div 
                                className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
                                style={{ backgroundColor: `${category.color}15`, color: category.color }}
                              >
                                {category.name}
                              </div>
                            </div>
                            
                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-apple-gray-500 font-medium">
                              <div className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {task.timePeriod === 'specific_time' ? task.specificTime : TIME_PERIOD_LABELS[task.timePeriod]}
                              </div>
                              {task.location && (
                                <div className="flex items-center gap-1">
                                  <MapPin className="w-3 h-3" />
                                  {task.location}
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-1">
                            {task.description && (
                              <button
                                onClick={() => toggleExpand(task.id)}
                                className={cn(
                                  "p-1.5 rounded-full hover:bg-apple-gray-100 transition-all",
                                  isExpanded && "bg-apple-gray-100 rotate-180"
                                )}
                              >
                                <ChevronDown className="w-4 h-4 text-apple-gray-400" />
                              </button>
                            )}
                            <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={() => deleteTask(task.id)}
                                className="text-red-500 hover:text-red-600 hover:bg-red-50 rounded-full"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </div>

                        <AnimatePresence>
                          {isExpanded && task.description && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="border-t border-apple-gray-100 dark:border-apple-gray-200 bg-apple-gray-50/30"
                            >
                              <div className="p-4 pt-3 text-sm text-apple-gray-600 whitespace-pre-wrap leading-relaxed">
                                {task.description}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </AnimatePresence>
          </ScrollArea>
        </section>
      </main>
    </div>
  );
}


