import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSequence, withTiming } from 'react-native-reanimated';

import { useStore, recordResults } from '../store';
import { maxDepth } from '../parser';
import { judge, similarity, NEAR, gradeRecall, VERDICT_SCORE } from '../grade';
import { nodeScore } from '../mastery';
import { colors, font, themedStyles } from '../theme';
import { Header, Button, Empty } from '../ui';
import RecallReport from '../components/RecallReport';

const FINAL_DEPTH = 3;
const SCORE = { exact: 1, near: 0.9, wrong: 0 };

// 루트에서 잎까지 경로 중 하나를 고른다(약한 잎일수록 잘 뽑힘). 경로는 루트 제외.
function pickPath(root, mastery) {
  const paths = [];
  const walk = (node, trail) => {
    if (!node.children.length) {
      if (trail.length) paths.push(trail);
      return;
    }
    node.children.forEach((c) => walk(c, [...trail, c]));
  };
  walk(root, []);
  const longest = paths.reduce((m, p) => Math.max(m, p.length), 0);
  const pool = paths.filter((p) => p.length >= Math.min(3, longest));
  if (!pool.length) return null;
  const weights = pool.map((p) => {
    const s = nodeScore(mastery[p[p.length - 1].id]);
    return s === null ? 1 : 1.15 - s;
  });
  let r = Math.random() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i];
    if (r <= 0) return pool[i];
  }
  return pool[pool.length - 1];
}

// round 번째에 숨길 자리들. 맨 끝(잎)부터 무너지고, 그 뒤로 무작위로 늘어난다.
// 마지막 하나는 남겨 둬서 경로가 하나로 정해지게 한다.
function nextHidden(prev, length) {
  if (!prev.length) return [length - 1];
  const candidates = [];
  for (let i = 0; i < length; i++) if (!prev.includes(i)) candidates.push(i);
  if (candidates.length <= 1) return null;
  const pick = candidates[Math.floor(Math.random() * candidates.length)];
  return [...prev, pick].sort((a, b) => a - b);
}

export default function CollapseSession({ route, nav }) {
  const { subjects, mastery } = useStore();
  const subject = subjects.find((s) => s.id === route.subjectId);
  const [path] = useState(() => (subject ? pickPath(subject.root, mastery) : null));
  const [hidden, setHidden] = useState(() => (path ? [path.length - 1] : []));
  const [round, setRound] = useState(1);
  const [inputs, setInputs] = useState({});
  const [result, setResult] = useState(null); // { ok, verdicts: {i: verdict} }
  const [final, setFinal] = useState(false);
  const [text, setText] = useState('');
  const [report, setReport] = useState(null);

  const shake = useSharedValue(0);
  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }] }));
  const finalDepth = useMemo(() => (subject ? Math.min(FINAL_DEPTH, maxDepth(subject.root)) : 1), [subject]);

  if (!subject || !path) {
    return (
      <View style={styles.fill}>
        <Header title="붕괴 테스트" onBack={nav.pop} />
        <Empty title="목차가 너무 얕아요" sub="2단계 이상의 목차가 있어야 할 수 있어요." />
      </View>
    );
  }

  const totalRounds = Math.max(1, path.length - 1);

  // 숨긴 자리를 앞에서부터 채점한다. 뒤에 보이는 목차가 없는 꼬리 자리는
  // 앞 목차의 다른 하위 목차를 써도 맞는 길로 인정한다.
  const check = () => {
    const verdicts = {};
    let parent = subject.root;
    path.forEach((node, i) => {
      if (!hidden.includes(i)) {
        parent = node;
        return;
      }
      const input = inputs[i] || '';
      let v = judge(input, node.title, parent.title);
      let resolved = node;
      const tail = hidden.filter((h) => h > i).length === path.length - 1 - i;
      if (v === 'wrong' && tail) {
        const alt = parent.children.find((c) => similarity(input, c.title, parent.title) >= NEAR);
        if (alt) {
          v = 'near';
          resolved = alt;
        }
      }
      verdicts[i] = v;
      parent = resolved;
    });
    const ok = Object.values(verdicts).every((v) => v !== 'wrong');
    recordResults(hidden.map((i) => ({ id: path[i].id, value: SCORE[verdicts[i]] })));
    setResult({ ok, verdicts });
    if (ok) {
      shake.value = withSequence(
        withTiming(-8, { duration: 50 }),
        withTiming(8, { duration: 50 }),
        withTiming(-5, { duration: 50 }),
        withTiming(0, { duration: 50 })
      );
    }
  };

  const advance = () => {
    const nh = nextHidden(hidden, path.length);
    setInputs({});
    setResult(null);
    if (!nh) {
      setFinal(true);
      return;
    }
    setHidden(nh);
    setRound((r) => r + 1);
  };

  const retry = () => {
    setInputs({});
    setResult(null);
  };

  const gradeFinal = () => {
    const r = gradeRecall(text, subject.root, finalDepth);
    setReport(r);
    recordResults(r.items.map((it) => ({ id: it.node.id, value: VERDICT_SCORE[it.verdict] })));
  };

  if (final) {
    return (
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Header title="최종 붕괴" subtitle={`${subject.name} 전체 현출`} onBack={nav.pop} />
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          {!report ? (
            <>
              <View style={styles.finalBadge}>
                <Text style={styles.finalBadgeText}>모든 경로가 무너졌어요</Text>
              </View>
              <Text style={styles.finalAsk}>
                <Text style={styles.finalEm}>{subject.name}</Text>의 목차를{'\n'}
                처음부터 끝까지 현출하세요. ({finalDepth}단계까지)
              </Text>
              <TextInput
                value={text}
                onChangeText={setText}
                multiline
                autoFocus
                textAlignVertical="top"
                autoCorrect={false}
                placeholder={'한 줄에 목차 하나씩.\n하위 목차는 스페이스 두 칸 들여쓰기.'}
                placeholderTextColor={colors.inkFaint}
                style={styles.finalInput}
              />
            </>
          ) : (
            <RecallReport report={report} />
          )}
        </ScrollView>
        <View style={styles.footer}>
          {!report ? (
            <Button title="채점하기" onPress={gradeFinal} disabled={!text.trim()} />
          ) : (
            <Button title="끝내기" onPress={nav.pop} />
          )}
        </View>
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Header title="붕괴 테스트" subtitle={`${round}단계 / ${totalRounds}단계`} onBack={nav.pop} />
      <View style={styles.cracks}>
        {Array.from({ length: totalRounds }).map((_, i) => (
          <View key={i} style={[styles.crack, i < round && styles.crackOn]} />
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Animated.View style={[styles.chain, shakeStyle]}>
          <View style={[styles.block, styles.rootBlock]}>
            <Text style={styles.rootText}>{subject.name}</Text>
          </View>
          {path.map((node, i) => {
            const isHidden = hidden.includes(i);
            const v = result?.verdicts[i];
            return (
              <View key={node.id} style={styles.link}>
                <Text style={styles.arrow}>↓</Text>
                {isHidden ? (
                  <View style={{ alignSelf: 'stretch' }}>
                    <TextInput
                      value={inputs[i] || ''}
                      onChangeText={(t) => setInputs((s) => ({ ...s, [i]: t }))}
                      editable={!result}
                      placeholder="?"
                      placeholderTextColor={colors.bad}
                      style={[
                        styles.hole,
                        v && {
                          borderStyle: 'solid',
                          borderColor: v === 'wrong' ? colors.bad : colors.good,
                          backgroundColor: v === 'wrong' ? '#E5534B10' : '#2FB57410',
                        },
                      ]}
                    />
                    {v === 'wrong' && <Text style={styles.answer}>정답: {node.title}</Text>}
                  </View>
                ) : (
                  <View style={styles.block}>
                    <Text style={styles.blockText}>{node.title}</Text>
                  </View>
                )}
              </View>
            );
          })}
        </Animated.View>

        {result && (
          <Text style={[styles.verdict, { color: result.ok ? colors.good : colors.bad }]}>
            {result.ok ? '버텼어요! 다음엔 더 무너져요.' : '무너졌어요. 다시 도전해 볼까요?'}
          </Text>
        )}
      </ScrollView>

      <View style={styles.footer}>
        {!result ? (
          <Button
            title="확인"
            onPress={check}
            disabled={hidden.some((i) => !(inputs[i] || '').trim())}
          />
        ) : result.ok ? (
          <Button title={round < totalRounds ? '더 무너뜨리기' : '최종 붕괴로'} kind="accent" onPress={advance} />
        ) : (
          <View style={styles.row}>
            <Button title="다시 도전" kind="soft" style={{ flex: 1 }} onPress={retry} />
            <Button title="정답 보고 계속" style={{ flex: 1 }} onPress={advance} />
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = themedStyles(() => ({
  fill: { flex: 1 },
  cracks: { flexDirection: 'row', gap: 4, paddingHorizontal: 16, paddingBottom: 12 },
  crack: { flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.surfaceAlt },
  crackOn: { backgroundColor: colors.bad },
  body: { paddingHorizontal: 22, paddingTop: 6, paddingBottom: 24 },
  chain: { alignItems: 'center' },
  link: { alignItems: 'center', alignSelf: 'stretch' },
  block: {
    alignSelf: 'stretch',
    backgroundColor: colors.surface,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  rootBlock: { backgroundColor: colors.ink },
  rootText: { fontFamily: font.bold, fontSize: 17, color: colors.onInk },
  blockText: { fontFamily: font.semibold, fontSize: 16, color: colors.ink },
  arrow: { fontSize: 17, color: colors.inkFaint, marginVertical: 3 },
  hole: {
    height: 52,
    borderRadius: 14,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.bad,
    backgroundColor: colors.surface,
    textAlign: 'center',
    fontFamily: font.bold,
    fontSize: 16,
    color: colors.ink,
  },
  answer: { fontFamily: font.semibold, fontSize: 13, color: colors.bad, textAlign: 'center', marginTop: 6 },
  verdict: { fontFamily: font.bold, fontSize: 15, textAlign: 'center', marginTop: 20 },
  finalBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#E5534B18',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginBottom: 12,
  },
  finalBadgeText: { fontFamily: font.bold, fontSize: 12.5, color: colors.bad },
  finalAsk: { fontFamily: font.regular, fontSize: 17, color: colors.inkSoft, lineHeight: 25, marginBottom: 14 },
  finalEm: { fontFamily: font.bold, color: colors.ink },
  finalInput: {
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
