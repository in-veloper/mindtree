import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, Pressable } from 'react-native';

import { useStore, recordResults } from '../store';
import { indexTree, maxDepth, descendants } from '../parser';
import { gradeRecall, VERDICT_SCORE } from '../grade';
import { colors, font, BRANCH_COLORS, themedStyles } from '../theme';
import { Header, Button, Chip, Empty } from '../ui';
import RecallReport from '../components/RecallReport';

export default function RecallSession({ route, nav }) {
  const { subjects } = useStore();
  const subject = subjects.find((s) => s.id === route.subjectId);
  const index = useMemo(() => (subject ? indexTree(subject.root) : {}), [subject]);

  const [scopeId, setScopeId] = useState(route.scopeId || subject?.root.id);
  const scope = index[scopeId]?.node;
  const deepest = scope ? maxDepth(scope) : 1;
  const [limit, setLimit] = useState(() => (scope && scope.id === subject?.root.id ? Math.min(2, deepest) : 99));
  const [phase, setPhase] = useState(route.scopeId ? 'write' : 'setup');
  const [text, setText] = useState('');
  const [report, setReport] = useState(null);

  if (!subject || !scope) {
    return (
      <View style={styles.fill}>
        <Header title="전체 현출" onBack={nav.pop} />
        <Empty title="목차를 찾을 수 없어요" />
      </View>
    );
  }

  const scopeTitle = scope.id === subject.root.id ? subject.name : scope.title;
  const count = descendants(scope, limit).length;
  const levels = [];
  for (let d = 1; d <= Math.min(4, deepest); d++) levels.push(d);

  const grade = () => {
    const r = gradeRecall(text, scope, limit);
    setReport(r);
    recordResults(r.items.map((it) => ({ id: it.node.id, value: VERDICT_SCORE[it.verdict] })));
    setPhase('report');
  };

  return (
    <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Header
        title="전체 현출"
        subtitle={phase === 'setup' ? '범위 고르기' : `${scopeTitle} · 목차 ${count}개`}
        onBack={phase === 'write' && !route.scopeId ? () => setPhase('setup') : nav.pop}
      />

      {phase === 'setup' && (
        <ScrollView contentContainerStyle={styles.body}>
          <Text style={styles.label}>어디를 현출할까요?</Text>
          <View style={styles.scopes}>
            {[subject.root, ...subject.root.children].map((n, i) => {
              const on = n.id === scopeId;
              const color = i === 0 ? colors.ink : BRANCH_COLORS[(i - 1) % BRANCH_COLORS.length];
              return (
                <Pressable
                  key={n.id}
                  onPress={() => {
                    setScopeId(n.id);
                    setLimit(i === 0 ? Math.min(2, maxDepth(n)) : 99);
                  }}
                  style={[styles.scope, on && { borderColor: color, backgroundColor: `${color}10` }]}
                >
                  <View style={[styles.scopeBar, { backgroundColor: color }]} />
                  <Text style={[styles.scopeText, on && { fontFamily: font.bold }]} numberOfLines={1}>
                    {i === 0 ? `${subject.name} 전체` : n.title}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.label}>어느 깊이까지?</Text>
          <View style={styles.levels}>
            {levels.map((d) => (
              <Chip key={d} label={`${d}단계`} active={limit === d} onPress={() => setLimit(d)} color={colors.accent} />
            ))}
            <Chip label="끝까지" active={limit === 99} onPress={() => setLimit(99)} color={colors.accent} />
          </View>
          <Text style={styles.note}>써야 할 목차 {count}개</Text>
        </ScrollView>
      )}

      {phase === 'write' && (
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <Text style={styles.ask}>
            <Text style={styles.askEm}>{scopeTitle}</Text>의 목차를{'\n'}
            {limit === 99 ? '처음부터 끝까지' : `${limit}단계까지`} 써보세요.
          </Text>
          <TextInput
            value={text}
            onChangeText={setText}
            multiline
            autoFocus
            textAlignVertical="top"
            autoCorrect={false}
            placeholder={'한 줄에 목차 하나씩.\n하위 목차는 앞에 스페이스 두 칸을 넣으면\n위치까지 채점해요.'}
            placeholderTextColor={colors.inkFaint}
            style={styles.input}
          />
        </ScrollView>
      )}

      {phase === 'report' && report && (
        <ScrollView contentContainerStyle={styles.body}>
          <RecallReport report={report} />
        </ScrollView>
      )}

      <View style={styles.footer}>
        {phase === 'setup' && <Button title="시작" onPress={() => setPhase('write')} disabled={!count} />}
        {phase === 'write' && <Button title="채점하기" onPress={grade} disabled={!text.trim()} />}
        {phase === 'report' && (
          <View style={styles.row}>
            <Button
              title="다시 쓰기"
              kind="soft"
              style={{ flex: 1 }}
              onPress={() => {
                setText('');
                setReport(null);
                setPhase('write');
              }}
            />
            <Button title="끝내기" style={{ flex: 1 }} onPress={nav.pop} />
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = themedStyles(() => ({
  fill: { flex: 1 },
  body: { paddingHorizontal: 18, paddingTop: 6, paddingBottom: 24 },
  label: { fontFamily: font.semibold, fontSize: 13, color: colors.inkFaint, marginTop: 10, marginBottom: 10 },
  scopes: { gap: 8 },
  scope: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'transparent',
    paddingHorizontal: 14,
    height: 50,
  },
  scopeBar: { width: 4, height: 18, borderRadius: 2 },
  scopeText: { flex: 1, fontFamily: font.semibold, fontSize: 15, color: colors.ink },
  levels: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  note: { fontFamily: font.regular, fontSize: 13, color: colors.inkSoft, marginTop: 14 },
  ask: { fontFamily: font.regular, fontSize: 17, color: colors.inkSoft, lineHeight: 25, marginBottom: 14 },
  askEm: { fontFamily: font.bold, color: colors.ink },
  input: {
    minHeight: 320,
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 16,
    fontFamily: font.regular,
    fontSize: 15.5,
    lineHeight: 24,
    color: colors.ink,
  },
  footer: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10 },
  row: { flexDirection: 'row', gap: 10 },
}));
