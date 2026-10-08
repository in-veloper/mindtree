import { StyleSheet } from 'react-native';

const shared = {
  good: '#2FB574',
  mid: '#F0A92E',
  bad: '#E5534B',
};

export const palettes = {
  light: {
    ...shared,
    bg: '#F5F6F8',
    surface: '#FFFFFF',
    surfaceAlt: '#EEF0F3',
    ink: '#161A22',
    onInk: '#FFFFFF',
    inkSoft: '#5B6271',
    inkFaint: '#9AA1AE',
    line: '#E4E7EC',
    accent: '#17845A',
    accentSoft: '#E2F3EA',
    none: '#C9CED6',
    scrim: 'rgba(15, 18, 24, 0.45)',
  },
  dark: {
    ...shared,
    bg: '#0E1014',
    surface: '#181B21',
    surfaceAlt: '#22262E',
    ink: '#ECEEF2',
    onInk: '#0E1014',
    inkSoft: '#A5ABB8',
    inkFaint: '#6C7381',
    line: '#2A2F38',
    accent: '#33C27F',
    accentSoft: '#15352A',
    none: '#4A505C',
    scrim: 'rgba(0, 0, 0, 0.6)',
  },
};

// 화면 코드에서 바로 읽는 현재 색. 테마를 바꾸면 값만 갈아끼우고 앱 전체를 다시 그린다.
export const colors = { ...palettes.light };

let mode = 'light';
let version = 0;

export function applyTheme(next) {
  if (next === mode || !palettes[next]) return;
  mode = next;
  Object.assign(colors, palettes[next]);
  version += 1;
}

export function themeMode() {
  return mode;
}

// StyleSheet 를 테마별로 만들어 두고, 접근할 때 현재 테마 것을 돌려준다.
export function themedStyles(factory) {
  let cache = null;
  let ver = -1;
  const resolve = () => {
    if (ver !== version) {
      cache = StyleSheet.create(factory());
      ver = version;
    }
    return cache;
  };
  return new Proxy({}, { get: (_, key) => resolve()[key] });
}

export const font = {
  regular: 'Pretendard-Regular',
  semibold: 'Pretendard-SemiBold',
  bold: 'Pretendard-Bold',
};

// 마인드맵에서 최상위 가지마다 쓰는 색
export const BRANCH_COLORS = [
  '#4C7EF3', '#1FA67A', '#E07A3F', '#9B5DE5',
  '#E0457B', '#13A3B5', '#C9A227', '#5E6AD2',
];

export const SUBJECT_COLORS = [
  '#17845A', '#4C7EF3', '#E07A3F', '#9B5DE5', '#E0457B', '#13A3B5', '#C9A227', '#5E6AD2',
];

export const STATUS = {
  none: { get color() { return colors.none; }, label: '아직 안 함' },
  bad: { color: shared.bad, label: '잘 모름' },
  mid: { color: shared.mid, label: '어느 정도' },
  good: { color: shared.good, label: '완전히 암기' },
};

export const shadow = {
  shadowColor: '#0B0E14',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.08,
  shadowRadius: 12,
  elevation: 3,
};
