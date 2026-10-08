import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';

import { useStore, recordResults } from '../store';
import { indexTree, pathTo } from '../parser';
import { judge, matchUnordered } from '../grade';
import { nodeScore } from '../mastery';
import { colors, font, themedStyles } from '../theme';
import { Header, Button, Empty, Bar, Ring, statusColorOfPct } from '../ui';

const ROUND = 10;
const SCORE = { exact: 1, near: 0.9, missing: 0, wrong: 0 };

// 약한 목차일수록 자주 나오게 가중치를 두고 뽑는다.
function weightedPick(pool, count, weightOf) {
  const items = pool.map((p) => ({ p, w: weightOf(p) }));
  const out = [];
  while (out.length < count && items.length) {
    const total = items.reduce((a, b) => a + b.w, 0);
    let r = Math.random() * total;
    let i = 0;
    for (; i < items.length - 1; i++) {
      r -= items[i].w;
      if (r <= 0) break;
    }
    out.push(items[i].p);
    items.splice(i, 1);
  }
  return out;
}

function buildQuestions(root, mode, mastery) {
  const parents = [];
  const walk = (node) => {
    node.children.forEach((c) => {
      parents.push(c);
      walk(c);
    });
  };
  if (root.children.length) parents.push(root);
  walk(root);

  const weak = (id) => {
    const s = nodeScore(mastery[id]);
    return s === null ? 1 : 1.15 - s;
  };

  if (mode === 'order') {
    const pool = [];
    parents
      .filter((p) => p.children.length >= 3)
      .forEach((p) => {
        for (let k = 1; k < p.children.length; k++) pool.push({ parent: p, k });
      });
    return weightedPick(pool, ROUND, (q) => weak(q.parent.children[q.k].id)).map((q) => ({
      type: 'order',
      parent: q.parent,
      shown: q.parent.children.slice(Math.max(0, q.k - 3), q.k),
      answer: q.parent.children[q.k],
    }));
  }

  const pool = parents.filter((p) => p.children.length >= 2);
  return weightedPick(pool, ROUND, (p) => {
    const ws = p.children.map((c) => weak(c.id));
    return ws.reduce((a, b) => a + b, 0) / ws.length;
  }).map((p) => ({ type: 'children', parent: p, answers: p.children }));
}

export default function QuizSession({ route, nav }) {
  const { subjects, mastery } = useStore();
  const subject = subjects.find((s) => s.id === route.subjectId);
  const index = useMemo(() => (subject ? indexTree(subject.root) : {}), [subject]);
  const [questions] = useState(() => (subject ? buildQuestions(subject.root, route.mode, mastery) : []));

  const [qi, setQi] = useState(0);
  const [input, setInput] = useState('');
  const [result, setResult] = useState(null);
  const [scores, setScores] = useState([]);

  const modeTitle = route.mode === 'order' ? '순서 회상' : '하위 목차 회상';

  if (!subject || questions.length === 0) {
    return (
      <View style={styles.fill}>
        <Header title={modeTitle} onBack={nav.pop} />
        <Empty
          title="낼 문제가 없어요"
          sub={route.mode === 'order' ? '하위 목차가 3개 이상인 목차가 있어야 해요.' : '하위 목차가 2개 이상인 목차가 있어야 해요.'}
        />
      </View>
    );
  }

  const done = qi >= questions.length;

  if (done) {
    const pct = Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100);
    return (
      <View style={styles.fill}>
        <Header title={modeTitle} onBack={nav.pop} />
        <View style={styles.summary}>
          <Ring pct={pct} size={150} stroke={12} color={statusColorOfPct(pct)}>
            <Text style={styles.sumPct}>
              {pct}
              <Text style={styles.sumSign}>%</Text>
            </Text>
          </Ring>
          <Text style={styles.sumText}>{questions.length}문제 완료</Text>
        </View>
        <View style={styles.footer}>
          <Button title="한 번 더" kind="soft" onPress={() => nav.replace('quiz', { subjectId: subject.id, mode: route.mode })} />
          <Button title="끝내기" onPress={nav.pop} style={{ marginTop: 10 }} />
        </View>
      </View>
    );
  }

  const q = questions[qi];
  const parentTitle = q.parent.id === subject.root.id ? subject.name : q.parent.title;
  const crumbs = pathTo(index, q.parent.id)
    .slice(1, -1)
    .map((n) => n.title)
    .join(' › ');

  const check = () => {
    if (q.type === 'order') {
      const v = judge(input, q.answer.title, q.parent.title);
      setResult({ v });
      recordResults([{ id: q.answer.id, value: SCORE[v] }]);
      setScores((s) => [...s, SCORE[v]]);
    } else {
      const lines = input.split(/\r?\n/);
      const { result: res, extras } = matchUnordered(lines, q.answers.map((a) => a.title), q.parent.title);
      setResult({ res, extras });
      recordResults(q.answers.map((a, i) => ({ id: a.id, value: SCORE[res[i].verdict] })));
      setScores((s) => [...s, res.reduce((a, r) => a + SCORE[r.verdict], 0) / res.length]);
    }
  };

  const next = () => {
    setInput('');
    setResult(null);
    setQi((i) => i + 1);
  };

  return (
    <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Header title={modeTitle} subtitle={`${qi + 1} / ${questions.length}`} onBack={nav.pop} />
      <View style={styles.progress}>
        <Bar pct={(qi / questions.length) * 100} height={4} />
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {crumbs ? <Text style={styles.crumbs}>{crumbs}</Text> : null}
        <Text style={styles.parent}>{parentTitle}</Text>

        {q.type === 'order' ? (
          <View style={styles.chain}>
            {q.answer && q.shown[0] !== q.parent.children[0] && <Text style={styles.ellipsis}>⋮</Text>}
            {q.shown.map((n) => (
              <View key={n.id} style={styles.chainItem}>
                <View style={styles.chainBox}>
                  <Text style={styles.chainText}>{n.title}</Text>
                </View>
                <Text style={styles.arrow}>↓</Text>
              </View>
            ))}
            <TextInput
              value={input}
              onChangeText={setInput}
              editable={!result}
              autoFocus
              placeholder="다음 목차는?"
              placeholderTextColor={colors.inkFaint}
              returnKeyType="done"
              onSubmitEditing={() => !result && input.trim() && check()}
              style={[
                styles.answerBox,
                result && {
                  borderColor: result.v === 'wrong' ? colors.bad : colors.good,
                  backgroundColor: result.v === 'wrong' ? '#E5534B12' : '#2FB57412',
                },
              ]}
            />
            {result && result.v !== 'exact' && (
              <Text style={[styles.feedback, { color: result.v === 'wrong' ? colors.bad : '#2E9BB8' }]}>
                {result.v === 'near' ? '표현 차이 · ' : ''}정답: {q.answer.title}
              </Text>
            )}
          </View>
        ) : (
          <View>
            <Text style={styles.ask}>하위 목차 {q.answers.length}개를 한 줄에 하나씩 써보세요.</Text>
            {!result ? (
              <TextInput
                value={input}
                onChangeText={setInput}
                multiline
                autoFocus
                textAlignVertical="top"
                autoCorrect={false}
                placeholder={'예)\n대상적격\n원고적격\n…'}
                placeholderTextColor={colors.inkFaint}
                style={styles.multi}
              />
            ) : (
              <View style={styles.resultList}>
                {q.answers.map((a, i) => {
                  const r = result.res[i];
                  const ok = r.verdict !== 'missing';
                  return (
                    <View key={a.id} style={styles.resultRow}>
                      <View style={[styles.mark, { backgroundColor: ok ? (r.verdict === 'exact' ? colors.good : '#2E9BB8') : colors.bad }]} />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.resultTitle, !ok && { color: colors.bad }]}>{a.title}</Text>
                        {r.verdict === 'near' && <Text style={styles.resultSub}>내가 쓴 것: {r.input}</Text>}
                      </View>
                      {!ok && <Text style={styles.missTag}>누락</Text>}
                    </View>
                  );
                })}
                {result.extras.length > 0 && (
                  <Text style={styles.extras}>목차에 없는 항목: {result.extras.join(', ')}</Text>
                )}
              </View>
            )}
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        {!result ? (
          <Button title="확인" onPress={check} disabled={!input.trim()} />
        ) : (
          <Button title={qi + 1 < questions.length ? '다음 문제' : '결과 보기'} onPress={next} />
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = themedStyles(() => ({
  fill: { flex: 1 },
  progress: { paddingHorizontal: 16, paddingBottom: 10 },
  body: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 24 },
  crumbs: { fontFamily: font.regular, fontSize: 12.5, color: colors.inkFaint, marginBottom: 4 },
  parent: { fontFamily: font.bold, fontSize: 24, color: colors.ink, letterSpacing: -0.5, marginBottom: 18 },
  chain: { alignItems: 'stretch' },
  ellipsis: { textAlign: 'center', fontSize: 18, color: colors.inkFaint, marginBottom: 4 },
  chainItem: { alignItems: 'center' },
  chainBox: {
    alignSelf: 'stretch',
    backgroundColor: colors.surface,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  chainText: { fontFamily: font.semibold, fontSize: 16, color: colors.ink },
  arrow: { fontSize: 18, color: colors.inkFaint, marginVertical: 4 },
  answerBox: {
    height: 54,
    borderRadius: 14,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.accent,
    backgroundColor: colors.surface,
    textAlign: 'center',
    fontFamily: font.bold,
    fontSize: 17,
    color: colors.ink,
  },
  feedback: { fontFamily: font.semibold, fontSize: 14, textAlign: 'center', marginTop: 10 },
  ask: { fontFamily: font.regular, fontSize: 14, color: colors.inkSoft, marginBottom: 12 },
  multi: {
    minHeight: 220,
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    fontFamily: font.regular,
    fontSize: 16,
    lineHeight: 25,
    color: colors.ink,
  },
  resultList: { backgroundColor: colors.surface, borderRadius: 16, padding: 8 },
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 8 },
  mark: { width: 4, alignSelf: 'stretch', borderRadius: 2 },
  resultTitle: { fontFamily: font.semibold, fontSize: 15.5, color: colors.ink },
  resultSub: { fontFamily: font.regular, fontSize: 12.5, color: colors.inkFaint, marginTop: 2 },
  missTag: { fontFamily: font.semibold, fontSize: 12, color: colors.bad },
  extras: { fontFamily: font.regular, fontSize: 13, color: colors.inkSoft, padding: 8 },
  summary: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  sumPct: { fontFamily: font.bold, fontSize: 38, color: colors.ink },
  sumSign: { fontSize: 18 },
  sumText: { fontFamily: font.semibold, fontSize: 15, color: colors.inkSoft },
  footer: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10 },
}));
