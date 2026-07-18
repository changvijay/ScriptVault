import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Script, Category, Goal } from '@/types';

const SCRIPTS_KEY = '@scriptvault/scripts';
const CATEGORIES_KEY = '@scriptvault/categories';
const GOALS_KEY = '@scriptvault/goals';

export const generateId = () =>
  Date.now().toString() + Math.random().toString(36).substr(2, 9);

const DEFAULT_CATEGORIES: Category[] = [
  { id: 'cat_work', name: 'Work', color: '#3B82F6' },
  { id: 'cat_personal', name: 'Personal', color: '#10B981' },
  { id: 'cat_creative', name: 'Creative', color: '#8B5CF6' },
];

interface DataContextType {
  scripts: Script[];
  categories: Category[];
  goals: Goal[];
  loading: boolean;
  createScript: (data: Partial<Script>) => Promise<Script>;
  updateScript: (id: string, updates: Partial<Script>) => Promise<void>;
  deleteScript: (id: string) => Promise<void>;
  createCategory: (name: string, color: string) => Promise<Category>;
  updateCategory: (id: string, name: string, color: string) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
  createGoal: (data: Partial<Goal>) => Promise<Goal>;
  updateGoal: (id: string, updates: Partial<Goal>) => Promise<void>;
  deleteGoal: (id: string) => Promise<void>;
}

const DataContext = createContext<DataContextType | null>(null);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [scripts, setScripts] = useState<Script[]>([]);
  const [categories, setCategories] = useState<Category[]>(DEFAULT_CATEGORIES);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [scriptsStr, catsStr, goalsStr] = await Promise.all([
          AsyncStorage.getItem(SCRIPTS_KEY),
          AsyncStorage.getItem(CATEGORIES_KEY),
          AsyncStorage.getItem(GOALS_KEY),
        ]);
        if (scriptsStr) setScripts(JSON.parse(scriptsStr));
        if (catsStr) setCategories(JSON.parse(catsStr));
        if (goalsStr) setGoals(JSON.parse(goalsStr));
      } catch (_) {
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const saveScripts = (data: Script[]) =>
    AsyncStorage.setItem(SCRIPTS_KEY, JSON.stringify(data));
  const saveCategories = (data: Category[]) =>
    AsyncStorage.setItem(CATEGORIES_KEY, JSON.stringify(data));
  const saveGoals = (data: Goal[]) =>
    AsyncStorage.setItem(GOALS_KEY, JSON.stringify(data));

  const createScript = async (data: Partial<Script>): Promise<Script> => {
    const now = new Date().toISOString();
    const script: Script = {
      id: generateId(),
      title: data.title ?? 'Untitled Script',
      notes: data.notes ?? '',
      reference: data.reference ?? '',
      status: data.status ?? 'not_started',
      categoryIds: data.categoryIds ?? [],
      deadline: data.deadline ?? null,
      voiceNotes: data.voiceNotes ?? [],
      videoNotes: data.videoNotes ?? [],
      createdAt: now,
      modifiedAt: now,
    };
    const updated = [script, ...scripts];
    setScripts(updated);
    await saveScripts(updated);
    return script;
  };

  const updateScript = async (id: string, updates: Partial<Script>) => {
    const updated = scripts.map(s =>
      s.id === id ? { ...s, ...updates, modifiedAt: new Date().toISOString() } : s,
    );
    setScripts(updated);
    await saveScripts(updated);
  };

  const deleteScript = async (id: string) => {
    const updated = scripts.filter(s => s.id !== id);
    setScripts(updated);
    await saveScripts(updated);
  };

  const createCategory = async (name: string, color: string): Promise<Category> => {
    const cat: Category = { id: generateId(), name, color };
    const updated = [...categories, cat];
    setCategories(updated);
    await saveCategories(updated);
    return cat;
  };

  const updateCategory = async (id: string, name: string, color: string) => {
    const updated = categories.map(c => (c.id === id ? { ...c, name, color } : c));
    setCategories(updated);
    await saveCategories(updated);
  };

  const deleteCategory = async (id: string) => {
    const updated = categories.filter(c => c.id !== id);
    setCategories(updated);
    await saveCategories(updated);
    const updatedScripts = scripts.map(s => ({
      ...s,
      categoryIds: s.categoryIds.filter(cid => cid !== id),
    }));
    setScripts(updatedScripts);
    await saveScripts(updatedScripts);
  };

  const createGoal = async (data: Partial<Goal>): Promise<Goal> => {
    const goal: Goal = {
      id: generateId(),
      title: data.title ?? 'New Goal',
      targetValue: data.targetValue ?? 10,
      currentProgress: data.currentProgress ?? 0,
      deadline: data.deadline ?? null,
      completed: false,
      createdAt: new Date().toISOString(),
    };
    const updated = [goal, ...goals];
    setGoals(updated);
    await saveGoals(updated);
    return goal;
  };

  const updateGoal = async (id: string, updates: Partial<Goal>) => {
    const updated = goals.map(g => (g.id === id ? { ...g, ...updates } : g));
    setGoals(updated);
    await saveGoals(updated);
  };

  const deleteGoal = async (id: string) => {
    const updated = goals.filter(g => g.id !== id);
    setGoals(updated);
    await saveGoals(updated);
  };

  return (
    <DataContext.Provider
      value={{
        scripts, categories, goals, loading,
        createScript, updateScript, deleteScript,
        createCategory, updateCategory, deleteCategory,
        createGoal, updateGoal, deleteGoal,
      }}
    >
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
}
