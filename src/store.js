import { useSyncExternalStore } from 'react';
import { Appearance } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { parseOutline, carryIds, uid } from './parser';
import { normalize } from './grade';
import { pushResult } from './mastery';
import { SUBJECT_COLORS } from './theme';

const SUBJECTS_KEY = 'mindtree/subjects';
const MASTERY_KEY = 'mindtree/mastery';
const THEME_KEY = 'mindtree/theme';

let state = { loaded: false, subjects: [], mastery: {}, theme: Appearance.getColorScheme() === 'dark' ? 'dark' : 'light' };
const listeners = new Set();

function emit(next) {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
}

function subscribe(l) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useStore() {
  return useSyncExternalStore(subscribe, () => state);
}

export function getState() {
  return state;
}

async function persistSubjects() {
  try {
    await AsyncStorage.setItem(SUBJECTS_KEY, JSON.stringify(state.subjects));
  } catch {
    // 다음 변경 때 다시 저장된다.
  }
}

async function persistMastery() {
  try {
    await AsyncStorage.setItem(MASTERY_KEY, JSON.stringify(state.mastery));
  } catch {
    // 다음 변경 때 다시 저장된다.
  }
}

export async function init() {
  try {
    const [s, m, t] = await Promise.all([
      AsyncStorage.getItem(SUBJECTS_KEY),
      AsyncStorage.getItem(MASTERY_KEY),
      AsyncStorage.getItem(THEME_KEY),
    ]);
    emit({
      loaded: true,
      subjects: s ? JSON.parse(s) : [],
      mastery: m ? JSON.parse(m) : {},
      theme: t === 'dark' || t === 'light' ? t : state.theme,
    });
  } catch {
    emit({ loaded: true });
  }
}

export function getSubject(id) {
  return state.subjects.find((s) => s.id === id);
}

export function addSubject({ name, text }) {
  const id = uid();
  const subject = {
    id,
    name: name.trim(),
    text,
    color: SUBJECT_COLORS[state.subjects.length % SUBJECT_COLORS.length],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    root: { id: `root-${id}`, title: name.trim(), marker: '', children: parseOutline(text) },
  };
  emit({ subjects: [...state.subjects, subject] });
  persistSubjects();
  return id;
}

export function updateSubject(id, { name, text }) {
  emit({
    subjects: state.subjects.map((s) => {
      if (s.id !== id) return s;
      const children = carryIds(s.root, parseOutline(text), normalize);
      return {
        ...s,
        name: name.trim(),
        text,
        updatedAt: Date.now(),
        root: { ...s.root, title: name.trim(), children },
      };
    }),
  });
  persistSubjects();
}

export function deleteSubject(id) {
  emit({ subjects: state.subjects.filter((s) => s.id !== id) });
  persistSubjects();
}

// results: [{ id, value(0~1) }]
export function recordResults(results) {
  if (!results.length) return;
  const mastery = { ...state.mastery };
  results.forEach(({ id, value }) => {
    mastery[id] = pushResult(mastery[id], value);
  });
  emit({ mastery });
  persistMastery();
}

const MANUAL = { good: 1, mid: 0.65, bad: 0.2 };

export function markStatus(id, status) {
  if (status === 'none') {
    const mastery = { ...state.mastery };
    delete mastery[id];
    emit({ mastery });
    persistMastery();
    return;
  }
  recordResults([{ id, value: MANUAL[status] }]);
}

export function setTheme(theme) {
  emit({ theme });
  AsyncStorage.setItem(THEME_KEY, theme).catch(() => {});
}
