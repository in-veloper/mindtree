import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import Svg, { Path, Rect, Circle } from 'react-native-svg';

import { colors, font, themedStyles } from '../theme';
import { Card } from '../ui';

function Art({ kind }) {
  const c = colors.accent;
  return (
    <Svg width={58} height={58} viewBox="0 0 58 58">
      <Rect x="0" y="0" width="58" height="58" rx="16" fill={colors.accentSoft} />
      {kind === 'order' && (
        <>
          <Rect x="17" y="9" width="24" height="8" rx="4" fill={c} />
          <Rect x="17" y="21" width="24" height="8" rx="4" fill={c} opacity={0.6} />
          <Rect x="17" y="33" width="24" height="8" rx="4" fill={c} opacity={0.35} />
          <Rect x="17" y="45" width="24" height="7" rx="3.5" fill="none" stroke={c} strokeWidth="1.6" strokeDasharray="3 2" />
        </>
      )}
      {kind === 'children' && (
        <>
          <Rect x="8" y="24" width="14" height="10" rx="5" fill={c} />
          <Path d="M22 29 C28 29 28 14 34 14 M22 29 H34 M22 29 C28 29 28 44 34 44" stroke={c} strokeWidth="1.8" fill="none" />
          {[14, 29, 44].map((y) => (
            <Rect key={y} x="34" y={y - 4} width="16" height="8" rx="4" fill="none" stroke={c} strokeWidth="1.6" strokeDasharray="3 2" />
          ))}
        </>
      )}
      {kind === 'recall' && (
        <>
          <Rect x="12" y="10" width="34" height="38" rx="6" fill={colors.surface} />
          {[18, 25, 32, 39].map((y, i) => (
            <Rect key={y} x={i % 2 ? 22 : 17} y={y} width={i % 2 ? 18 : 22} height="3" rx="1.5" fill={c} opacity={0.7} />
          ))}
        </>
      )}
      {kind === 'collapse' && (
        <>
          <Rect x="19" y="8" width="20" height="8" rx="4" fill={c} />
          <Path d="M29 16 V21" stroke={c} strokeWidth="1.8" />
          <Rect x="19" y="21" width="20" height="8" rx="4" fill="none" stroke={colors.bad} strokeWidth="1.6" strokeDasharray="3 2" />
          <Path d="M29 29 V34" stroke={c} strokeWidth="1.8" />
          <Rect x="21" y="35" width="16" height="7" rx="3.5" fill={c} opacity={0.4} transform="rotate(12 29 38)" />
          <Circle cx="18" cy="48" r="2" fill={colors.bad} />
          <Circle cx="40" cy="47" r="1.6" fill={colors.mid} />
        </>
      )}
    </Svg>
  );
}

const MODES = [
  {
    key: 'order',
    title: '순서 회상',
    desc: '앞 목차들을 보고 다음에 올 목차를 떠올려요.',
    level: 1,
    go: (nav, id) => nav.push('quiz', { subjectId: id, mode: 'order' }),
  },
  {
    key: 'children',
    title: '하위 목차 회상',
    desc: '목차 하나를 보고 그 아래 목차를 전부 써요.',
    level: 2,
    go: (nav, id) => nav.push('quiz', { subjectId: id, mode: 'children' }),
  },
  {
    key: 'recall',
    title: '전체 현출',
    desc: '범위를 골라 처음부터 끝까지 목차를 써요. 빠진 것·순서·위치를 채점해요.',
    level: 3,
    go: (nav, id) => nav.push('recall', { subjectId: id }),
  },
  {
    key: 'collapse',
    title: '붕괴 테스트',
    desc: '목차 경로가 하나씩 무너져요. 끝까지 버티면 마지막은 과목 전체 현출.',
    level: 4,
    go: (nav, id) => nav.push('collapse', { subjectId: id }),
  },
];

export default function TestTab({ subject, nav }) {
  return (
    <ScrollView contentContainerStyle={styles.list}>
      {MODES.map((m) => (
        <Card key={m.key} onPress={() => m.go(nav, subject.id)} style={styles.card}>
          <Art kind={m.key} />
          <View style={{ flex: 1 }}>
            <View style={styles.titleRow}>
              <Text style={styles.title}>{m.title}</Text>
              <View style={styles.levels}>
                {[1, 2, 3, 4].map((i) => (
                  <View key={i} style={[styles.level, i <= m.level && styles.levelOn]} />
                ))}
              </View>
            </View>
            <Text style={styles.desc}>{m.desc}</Text>
          </View>
        </Card>
      ))}
    </ScrollView>
  );
}

const styles = themedStyles(() => ({
  list: { paddingHorizontal: 16, paddingBottom: 40, gap: 12 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontFamily: font.bold, fontSize: 17, color: colors.ink },
  levels: { flexDirection: 'row', gap: 3 },
  level: { width: 14, height: 4, borderRadius: 2, backgroundColor: colors.surfaceAlt },
  levelOn: { backgroundColor: colors.accent },
  desc: { fontFamily: font.regular, fontSize: 13, color: colors.inkSoft, marginTop: 5, lineHeight: 19 },
}));
