import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, Alert } from 'react-native';

import { useStore, addSubject, deleteSubject, setTheme } from '../store';
import { computeMastery } from '../mastery';
import { countNodes } from '../parser';
import { colors, font, STATUS, themedStyles } from '../theme';
import { Button, Card, Ring, Sheet, Icon, statusColorOfPct } from '../ui';
import { SAMPLE_NAME, SAMPLE_TEXT } from '../sample';

function Distribution({ root, computed }) {
  const counts = { good: 0, mid: 0, bad: 0, none: 0 };
  const walk = (node) =>
    node.children.forEach((c) => {
      const m = computed[c.id];
      const own = m && m.own !== null ? (m.own >= 0.85 ? 'good' : m.own >= 0.5 ? 'mid' : 'bad') : 'none';
      counts[own] += 1;
      walk(c);
    });
  walk(root);
  const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1;
  return (
    <View style={styles.dist}>
      {['good', 'mid', 'bad', 'none'].map((k) =>
        counts[k] ? (
          <View key={k} style={{ flex: counts[k] / total, backgroundColor: STATUS[k].color }} />
        ) : null
      )}
    </View>
  );
}

function SubjectCard({ subject, mastery, onPress, onLongPress }) {
  const computed = useMemo(() => computeMastery(subject.root, mastery), [subject, mastery]);
  const m = computed[subject.root.id];
  const total = countNodes(subject.root);
  const color = statusColorOfPct(m.pct, m.studied);

  return (
    <Card onPress={onPress} onLongPress={onLongPress} style={styles.subjectCard}>
      <View style={styles.cardRow}>
        <View style={{ flex: 1 }}>
          <View style={styles.nameRow}>
            <View style={[styles.colorTag, { backgroundColor: subject.color }]} />
            <Text style={styles.subjectName} numberOfLines={1}>
              {subject.name}
            </Text>
          </View>
          <Text style={styles.meta}>목차 {total}개 · 최상위 {subject.root.children.length}개</Text>
        </View>
        <Ring pct={m.pct} size={58} stroke={6} color={color}>
          <Text style={styles.ringText}>
            {m.pct}
            <Text style={styles.ringPct}>%</Text>
          </Text>
        </Ring>
      </View>
      <Distribution root={subject.root} computed={computed} />
    </Card>
  );
}

export default function HomeScreen({ nav }) {
  const { subjects, mastery, theme } = useStore();
  const [menuFor, setMenuFor] = useState(null);

  const startSample = () => {
    const id = addSubject({ name: SAMPLE_NAME, text: SAMPLE_TEXT });
    nav.push('subject', { id });
  };

  const confirmDelete = (subject) => {
    setMenuFor(null);
    Alert.alert('과목 삭제', `"${subject.name}" 과목과 학습 기록을 지울까요?`, [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: () => deleteSubject(subject.id) },
    ]);
  };

  return (
    <View style={styles.fill}>
      <View style={styles.top}>
        <Text style={styles.brand}>MINDTREE</Text>
        <Pressable
          onPress={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          hitSlop={10}
          style={styles.themeBtn}
        >
          <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={20} color={colors.inkSoft} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        {subjects.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>첫 과목을 만들어 볼까요?</Text>
            <Text style={styles.emptySub}>
              교재 목차를 그대로 붙여넣으면{'\n'}번호와 들여쓰기를 읽어 트리로 바꿔줘요.
            </Text>
            <Button title="예시 과목으로 둘러보기" kind="soft" onPress={startSample} style={{ marginTop: 20 }} />
          </View>
        ) : (
          subjects.map((s) => (
            <SubjectCard
              key={s.id}
              subject={s}
              mastery={mastery}
              onPress={() => nav.push('subject', { id: s.id })}
              onLongPress={() => setMenuFor(s)}
            />
          ))
        )}
      </ScrollView>

      <View style={styles.bottom}>
        <Button title="과목 추가" icon="plus" onPress={() => nav.push('editor', {})} />
      </View>

      <Sheet visible={!!menuFor} onClose={() => setMenuFor(null)} title={menuFor?.name}>
        <Pressable
          style={styles.menuItem}
          onPress={() => {
            const id = menuFor.id;
            setMenuFor(null);
            nav.push('editor', { id });
          }}
        >
          <Icon name="edit" size={20} color={colors.inkSoft} />
          <Text style={styles.menuText}>목차 수정</Text>
        </Pressable>
        <Pressable style={styles.menuItem} onPress={() => confirmDelete(menuFor)}>
          <Icon name="trash" size={20} color={colors.bad} />
          <Text style={[styles.menuText, { color: colors.bad }]}>과목 삭제</Text>
        </Pressable>
      </Sheet>
    </View>
  );
}

const styles = themedStyles(() => ({
  fill: { flex: 1 },
  top: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 22, paddingTop: 18, paddingBottom: 14 },
  brand: { flex: 1, fontFamily: font.bold, fontSize: 20, color: colors.ink, letterSpacing: 4 },
  themeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: { paddingHorizontal: 18, paddingTop: 6, paddingBottom: 24, gap: 12 },
  subjectCard: { paddingBottom: 16 },
  cardRow: { flexDirection: 'row', alignItems: 'center' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  colorTag: { width: 4, height: 18, borderRadius: 2 },
  subjectName: { fontFamily: font.bold, fontSize: 19, color: colors.ink, flexShrink: 1 },
  meta: { fontFamily: font.regular, fontSize: 12.5, color: colors.inkFaint, marginTop: 6, marginLeft: 12 },
  ringText: { fontFamily: font.bold, fontSize: 15, color: colors.ink },
  ringPct: { fontSize: 10, fontFamily: font.semibold },
  dist: {
    flexDirection: 'row',
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: 16,
    backgroundColor: colors.surfaceAlt,
    gap: 2,
  },
  empty: { alignItems: 'center', paddingTop: 70, paddingHorizontal: 20 },
  emptyTitle: { fontFamily: font.bold, fontSize: 19, color: colors.ink, marginBottom: 8 },
  emptySub: { fontFamily: font.regular, fontSize: 14, color: colors.inkSoft, textAlign: 'center', lineHeight: 21 },
  bottom: { paddingHorizontal: 18, paddingBottom: 12, paddingTop: 6 },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  menuText: { fontFamily: font.semibold, fontSize: 15.5, color: colors.ink },
}));
