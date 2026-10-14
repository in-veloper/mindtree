import React, { useMemo, useRef, useState } from 'react';
import { View, Text, TextInput, StyleSheet, ScrollView, KeyboardAvoidingView, Pressable } from 'react-native';

import { useStore, recordResults } from '../store';
import { indexTree } from '../parser';
import { judge, similarity, NEAR, gradeRecall, VERDICT_SCORE } from '../grade';
import { colors, font, themedStyles } from '../theme';
import { Header, Button, Empty } from '../ui';
import RecallReport from '../components/RecallReport';

const CIRCLED = '①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳';
const num = (i) => CIRCLED[i] || `${i + 1}.`;

const STAGES = [
  { key: 'see', label: '보기' },
  { key: 'blank', label: '빈칸' },
  { key: 'skeleton', label: '구조' },
  { key: 'free', label: '빈 화면' },
];

const RESULT = {
  exact: { color: colors.good, score: 1 },
  near: { color: '#2E9BB8', score: 0.9 },
  order: { color: colors.mid, score: 0.5 },
  wrong: { color: colors.bad, score: 0 },
};

// 자리마다 채점. 틀렸는데 다른 자리 정답이면 "순서" 로 본다.
function gradePositional(inputs, nodes, parentTitle) {
  return nodes.map((n, i) => {
    const v = judge(inputs[i] || '', n.title, parentTitle);
    if (v !== 'wrong') return v;
    const elsewhere = nodes.some((o, j) => j !== i && similarity(inputs[i] || '', o.title, parentTitle) >= NEAR);
    return elsewhere ? 'order' : 'wrong';
  });
}

function StageBar({ stage }) {
  return (
    <View style={styles.stageBar}>
      {STAGES.map((s, i) => {
        const done = i < stage;
        const on = i === stage;
        return (
          <View key={s.key} style={styles.stageItem}>
            <View style={[styles.stageDot, done && styles.stageDotDone, on && styles.stageDotOn]}>
              <Text style={[styles.stageNum, done && { color: '#fff' }, on && { color: colors.onInk }]}>{i + 1}</Text>
            </View>
            <Text style={[styles.stageLabel, on && { color: colors.ink, fontFamily: font.bold }]}>{s.label}</Text>
          </View>
        );
      })}
    </View>
  );
}

function Blank({ value, onChange, verdict, answer, inputRef, onSubmit, hint, prefix, depth = 1, rowStyle }) {
  const r = verdict ? RESULT[verdict] : null;
  return (
    <View style={[styles.blankRow, rowStyle]}>
      {prefix}
      <View style={{ flex: 1 }}>
        <TextInput
          ref={inputRef}
          value={value}
          onChangeText={onChange}
          editable={!verdict}
          placeholder={hint || ''}
          placeholderTextColor={colors.inkFaint}
          returnKeyType="next"
          blurOnSubmit={false}
          onSubmitEditing={onSubmit}
          style={[
            styles.blank,
            depth === 2 && styles.blankSmall,
            r && { borderColor: r.color, backgroundColor: `${r.color}12` },
          ]}
        />
        {verdict && verdict !== 'exact' ? (
          <Text style={[styles.answer, { color: r.color }]}>
            {verdict === 'near' ? '표현 차이 · ' : verdict === 'order' ? '순서 · ' : ''}정답: {answer}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

// 구조 단계의 가지 선: 큰 줄기(상위)와 작은 줄기(하위)를 행마다 이어 그린다.
function TreeLines({ rows, i }) {
  const row = rows[i];
  const moreTop = rows.slice(i + 1).some((r) => r.depth === 1);
  const nextIsChild = rows[i + 1]?.depth === 2;
  const lineColor = { backgroundColor: colors.line };
  const MID = 23;
  return (
    <>
      {/* 큰 줄기 */}
      <View style={[styles.trunk, lineColor, { left: 6, top: 0, bottom: row.depth === 1 && !moreTop ? undefined : 0, height: row.depth === 1 && !moreTop ? MID : undefined }]} />
      {row.depth === 1 && <View style={[styles.tick, lineColor, { left: 6, top: MID - 1, width: 14 }]} />}
      {row.depth === 1 && nextIsChild && <View style={[styles.trunk, lineColor, { left: 34, top: 46, bottom: 0 }]} />}
      {row.depth === 2 && (
        <>
          <View style={[styles.trunk, lineColor, { left: 34, top: 0, ...(nextIsChild ? { bottom: 0 } : { height: MID - 3 }) }]} />
          <View style={[styles.tick, lineColor, { left: 34, top: MID - 4, width: 12 }]} />
        </>
      )}
    </>
  );
}

function useInputs(count) {
  const [values, setValues] = useState(() => new Array(count).fill(''));
  const refs = useRef([]);
  const set = (i, v) => setValues((arr) => arr.map((x, j) => (j === i ? v : x)));
  const focusNext = (i) => refs.current[i + 1]?.focus();
  const reset = () => setValues(new Array(count).fill(''));
  return { values, set, refs, focusNext, reset };
}

export default function LearnSession({ route, nav }) {
  const { subjects } = useStore();
  const subject = subjects.find((s) => s.id === route.subjectId);
  const index = useMemo(() => (subject ? indexTree(subject.root) : {}), [subject]);
  const node = index[route.nodeId]?.node;

  const [stage, setStage] = useState(0);
  const [verdicts, setVerdicts] = useState(null);
  const [hint, setHint] = useState(false);
  const [freeText, setFreeText] = useState('');
  const [report, setReport] = useState(null);
  const [scores, setScores] = useState({});

  const kids = node ? node.children : [];
  const skeleton = useMemo(() => {
    const rows = [];
    kids.forEach((c) => {
      rows.push({ node: c, depth: 1 });
      c.children.forEach((g) => rows.push({ node: g, depth: 2 }));
    });
    return rows;
  }, [node]);

  const blankInputs = useInputs(kids.length);
  const skelInputs = useInputs(skeleton.length);

  if (!subject || !node) {
    return (
      <View style={styles.fill}>
        <Header title="" onBack={nav.pop} />
        <Empty title="목차를 찾을 수 없어요" />
      </View>
    );
  }

  const title = node.id === subject.root.id ? subject.name : node.title;

  const checkBlank = () => {
    const v = gradePositional(blankInputs.values, kids, node.title);
    setVerdicts(v);
    recordResults(kids.map((k, i) => ({ id: k.id, value: RESULT[v[i]].score })));
    setScores((s) => ({ ...s, blank: v.reduce((a, x) => a + RESULT[x].score, 0) / v.length }));
  };

  const checkSkeleton = () => {
    // 같은 부모 아래 형제끼리 자리 채점
    const v = new Array(skeleton.length);
    const groups = {};
    skeleton.forEach((row, i) => {
      const key = row.depth === 1 ? 'top' : skeleton.slice(0, i).reverse().find((r) => r.depth === 1).node.id;
      (groups[key] = groups[key] || []).push(i);
    });
    Object.entries(groups).forEach(([key, idxs]) => {
      const parentTitle = key === 'top' ? node.title : skeleton.find((r) => r.node.id === key).node.title;
      const res = gradePositional(
        idxs.map((i) => skelInputs.values[i]),
        idxs.map((i) => skeleton[i].node),
        parentTitle
      );
      idxs.forEach((i, k) => (v[i] = res[k]));
    });
    setVerdicts(v);
    recordResults(skeleton.map((row, i) => ({ id: row.node.id, value: RESULT[v[i]].score })));
    setScores((s) => ({ ...s, skeleton: v.reduce((a, x) => a + RESULT[x].score, 0) / v.length }));
  };

  const checkFree = () => {
    const r = gradeRecall(freeText, node, 3);
    setReport(r);
    recordResults(r.items.map((it) => ({ id: it.node.id, value: VERDICT_SCORE[it.verdict] })));
    setScores((s) => ({ ...s, free: r.score }));
  };

  const goto = (n) => {
    setVerdicts(null);
    setHint(false);
    setReport(null);
    if (n === 1) blankInputs.reset();
    if (n === 2) skelInputs.reset();
    if (n === 3) setFreeText('');
    setStage(n);
  };

  const retry = () => goto(stage);
  const graded = stage === 3 ? !!report : !!verdicts;
  const allRight = verdicts && verdicts.every((v) => v === 'exact' || v === 'near');

  return (
    // 안드로이드도 화면이 끝까지(edge-to-edge) 그려져서 키보드가 올라와도 창이 줄지 않는다.
    // 그래서 키보드 높이만큼 직접 밀어 올려야 가려진 빈칸이 보인다.
    <KeyboardAvoidingView style={styles.fill} behavior="padding">
      <Header title={title} subtitle={`하위 목차 ${kids.length}개`} onBack={nav.pop} />
      <StageBar stage={stage} />

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {stage === 0 && (
          <View style={styles.card}>
            <Text style={styles.parent}>{title}</Text>
            {kids.map((c, i) => (
              <View key={c.id} style={styles.seeRow}>
                <Text style={styles.seeNum}>{num(i)}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.seeTitle}>{c.title}</Text>
                  {c.children.length > 0 && (
                    <Text style={styles.seeKids} numberOfLines={2}>
                      {c.children.map((g) => g.title).join(' · ')}
                    </Text>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}

        {stage === 1 && (
          <View style={styles.card}>
            <View style={styles.cardHead}>
              <Text style={styles.parent}>{title}</Text>
              {!verdicts && (
                <Pressable onPress={() => setHint((h) => !h)} hitSlop={8}>
                  <Text style={styles.hintBtn}>{hint ? '힌트 끄기' : '첫 글자 힌트'}</Text>
                </Pressable>
              )}
            </View>
            {kids.map((c, i) => (
              <Blank
                key={c.id}
                prefix={<Text style={styles.blankNum}>{num(i)}</Text>}
                value={blankInputs.values[i]}
                onChange={(v) => blankInputs.set(i, v)}
                inputRef={(r) => (blankInputs.refs.current[i] = r)}
                onSubmit={() => blankInputs.focusNext(i)}
                verdict={verdicts?.[i]}
                answer={c.title}
                hint={hint ? `${c.title[0]}…` : ''}
              />
            ))}
          </View>
        )}

        {stage === 2 && (
          <View style={styles.card}>
            <Text style={styles.parent}>{title}</Text>
            <View>
              {skeleton.map((row, i) => (
                <Blank
                  key={row.node.id}
                  depth={row.depth}
                  rowStyle={{ paddingLeft: row.depth === 1 ? 24 : 52, marginBottom: 0, paddingBottom: 10 }}
                  prefix={<TreeLines rows={skeleton} i={i} />}
                  value={skelInputs.values[i]}
                  onChange={(v) => skelInputs.set(i, v)}
                  inputRef={(r) => (skelInputs.refs.current[i] = r)}
                  onSubmit={() => skelInputs.focusNext(i)}
                  verdict={verdicts?.[i]}
                  answer={row.node.title}
                />
              ))}
            </View>
          </View>
        )}

        {stage === 3 && !report && (
          <View style={styles.card}>
            <Text style={styles.freeAsk}>
              <Text style={styles.freeEm}>{title}</Text>의 목차를{'\n'}처음부터 끝까지 써보세요.
            </Text>
            <TextInput
              value={freeText}
              onChangeText={setFreeText}
              multiline
              autoFocus
              textAlignVertical="top"
              autoCorrect={false}
              placeholder={'한 줄에 목차 하나씩.\n하위 목차는 앞에 스페이스 두 칸을 넣으면\n위치까지 채점해요.'}
              placeholderTextColor={colors.inkFaint}
              style={styles.freeInput}
            />
          </View>
        )}

        {stage === 3 && report && <RecallReport report={report} />}
      </ScrollView>

      <View style={styles.footer}>
        {stage === 0 && <Button title="외웠어요 · 빈칸으로" onPress={() => goto(1)} />}

        {stage === 1 && !verdicts && <Button title="채점하기" onPress={checkBlank} />}
        {stage === 2 && !verdicts && <Button title="채점하기" onPress={checkSkeleton} />}
        {stage === 3 && !report && (
          <Button title="채점하기" onPress={checkFree} disabled={!freeText.trim()} />
        )}

        {graded && (
          <View style={styles.footerRow}>
            <Button title="다시" kind="soft" icon="refresh" style={{ flex: 1 }} onPress={retry} />
            {stage < 3 ? (
              <Button
                title={allRight ? '다음 단계' : '그래도 다음'}
                style={{ flex: 2 }}
                onPress={() => goto(stage + 1)}
              />
            ) : (
              <Button title="완료" kind="accent" style={{ flex: 2 }} onPress={nav.pop} />
            )}
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = themedStyles(() => ({
  fill: { flex: 1 },
  stageBar: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 30, paddingBottom: 12 },
  stageItem: { alignItems: 'center', gap: 4 },
  stageDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stageDotDone: { backgroundColor: colors.accent },
  stageDotOn: { backgroundColor: colors.ink },
  stageNum: { fontFamily: font.bold, fontSize: 12.5, color: colors.inkFaint },
  stageLabel: { fontFamily: font.semibold, fontSize: 11.5, color: colors.inkFaint },
  body: { paddingHorizontal: 16, paddingBottom: 24 },
  card: { backgroundColor: colors.surface, borderRadius: 22, padding: 20 },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  parent: { fontFamily: font.bold, fontSize: 20, color: colors.ink, marginBottom: 14, letterSpacing: -0.3, flexShrink: 1 },
  hintBtn: { fontFamily: font.semibold, fontSize: 13, color: colors.accent, marginBottom: 14 },
  seeRow: { flexDirection: 'row', gap: 12, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  seeNum: { fontFamily: font.bold, fontSize: 17, color: colors.accent, width: 22 },
  seeTitle: { fontFamily: font.semibold, fontSize: 17, color: colors.ink, lineHeight: 23 },
  seeKids: { fontFamily: font.regular, fontSize: 13, color: colors.inkFaint, marginTop: 3, lineHeight: 18 },
  blankRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  blankNum: { fontFamily: font.bold, fontSize: 17, color: colors.accent, width: 22, marginTop: 12 },
  blank: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.line,
    backgroundColor: colors.bg,
    paddingHorizontal: 14,
    fontFamily: font.semibold,
    fontSize: 16,
    color: colors.ink,
  },
  blankSmall: { height: 42, fontSize: 14.5, fontFamily: font.regular },
  answer: { fontFamily: font.semibold, fontSize: 12.5, marginTop: 5, marginLeft: 4 },
  trunk: { position: 'absolute', width: 2, borderRadius: 1 },
  tick: { position: 'absolute', height: 2, borderRadius: 1 },
  freeAsk: { fontFamily: font.regular, fontSize: 17, color: colors.inkSoft, lineHeight: 25, marginBottom: 14 },
  freeEm: { fontFamily: font.bold, color: colors.ink },
  freeInput: {
    minHeight: 260,
    borderRadius: 14,
    backgroundColor: colors.bg,
    padding: 14,
    fontFamily: font.regular,
    fontSize: 15.5,
    lineHeight: 24,
    color: colors.ink,
  },
  footer: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10 },
  footerRow: { flexDirection: 'row', gap: 10 },
}));
