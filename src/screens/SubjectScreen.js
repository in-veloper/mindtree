import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';

import { useStore } from '../store';
import { computeMastery } from '../mastery';
import { indexTree, maxDepth } from '../parser';
import { colors, font, themedStyles } from '../theme';
import { Header, Segmented, Chip, Icon, Empty } from '../ui';
import MindMap from '../components/MindMap';
import Outline from '../components/Outline';
import NodeSheet from '../components/NodeSheet';
import LearnTab from './LearnTab';
import TestTab from './TestTab';
import MasteryTab from './MasteryTab';

const TABS = [
  { key: 'tree', label: '트리' },
  { key: 'learn', label: '암기' },
  { key: 'test', label: '테스트' },
  { key: 'mastery', label: '숙련도' },
];

function TreeTab({ subject, computed, index, nav }) {
  const deepest = useMemo(() => maxDepth(subject.root), [subject]);
  const [mode, setMode] = useState('map');
  const [depth, setDepth] = useState(Math.min(2, deepest));
  const [picked, setPicked] = useState(null);

  const levels = [];
  for (let d = 1; d <= Math.min(4, deepest); d++) levels.push(d);

  return (
    <View style={styles.fill}>
      <View style={styles.toolbar}>
        <View style={styles.modeSwitch}>
          {[
            { key: 'map', icon: 'map' },
            { key: 'list', icon: 'list' },
          ].map((m) => (
            <Pressable
              key={m.key}
              onPress={() => setMode(m.key)}
              style={[styles.modeBtn, mode === m.key && styles.modeBtnOn]}
            >
              <Icon name={m.icon} size={18} color={mode === m.key ? colors.onInk : colors.inkSoft} />
            </Pressable>
          ))}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.levels}>
          {levels.map((d) => (
            <Chip key={d} label={`L${d}`} active={depth === d} onPress={() => setDepth(d)} color={colors.accent} />
          ))}
          {deepest > 4 && (
            <Chip label="전체" active={depth === 99} onPress={() => setDepth(99)} color={colors.accent} />
          )}
        </ScrollView>
      </View>

      {subject.root.children.length === 0 ? (
        <Empty title="목차가 비어 있어요" sub="오른쪽 위 연필을 눌러 목차를 붙여넣어 주세요." />
      ) : mode === 'map' ? (
        <MindMap root={subject.root} computed={computed} depthLimit={depth} onNodePress={setPicked} />
      ) : (
        <Outline root={subject.root} computed={computed} depthLimit={depth} onNodePress={setPicked} />
      )}

      <NodeSheet
        node={picked}
        index={index}
        computed={computed}
        onClose={() => setPicked(null)}
        onLearn={(n) => {
          setPicked(null);
          nav.push('learn', { subjectId: subject.id, nodeId: n.id });
        }}
        onRecall={(n) => {
          setPicked(null);
          nav.push('recall', { subjectId: subject.id, scopeId: n.id });
        }}
      />
    </View>
  );
}

export default function SubjectScreen({ route, nav }) {
  const { subjects, mastery } = useStore();
  const subject = subjects.find((s) => s.id === route.id);
  const tab = route.tab || 'tree';

  const computed = useMemo(() => (subject ? computeMastery(subject.root, mastery) : {}), [subject, mastery]);
  const index = useMemo(() => (subject ? indexTree(subject.root) : {}), [subject]);

  if (!subject) {
    return (
      <View style={styles.fill}>
        <Header title="" onBack={nav.pop} />
        <Empty title="과목을 찾을 수 없어요" />
      </View>
    );
  }

  const rootM = computed[subject.root.id];
  const props = { subject, computed, index, nav };

  return (
    <View style={styles.fill}>
      <Header
        title={subject.name}
        subtitle={rootM.studied ? `목차 숙련도 ${rootM.pct}%` : '아직 학습 기록이 없어요'}
        onBack={nav.pop}
        right={
          <Pressable
            onPress={() => nav.push('editor', { id: subject.id })}
            hitSlop={8}
            style={({ pressed }) => [styles.editBtn, pressed && { transform: [{ scale: 0.95 }], opacity: 0.85 }]}
          >
            <Icon name="editOutline" size={19} color={colors.ink} />
          </Pressable>
        }
      />
      <View style={styles.tabs}>
        <Segmented items={TABS} value={tab} onChange={(t) => nav.setParams({ tab: t })} />
      </View>

      {tab === 'tree' && <TreeTab {...props} />}
      {tab === 'learn' && <LearnTab {...props} />}
      {tab === 'test' && <TestTab {...props} />}
      {tab === 'mastery' && <MasteryTab {...props} />}
    </View>
  );
}

const styles = themedStyles(() => ({
  fill: { flex: 1 },
  // 맨몸 연필 아이콘 대신 앱의 다른 버튼들처럼 둥근 판 위에 올린 버튼
  editBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  tabs: { paddingHorizontal: 16, paddingBottom: 10 },
  toolbar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 8, gap: 10 },
  modeSwitch: { flexDirection: 'row', backgroundColor: colors.surfaceAlt, borderRadius: 12, padding: 3 },
  modeBtn: { width: 38, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  modeBtnOn: { backgroundColor: colors.ink },
  levels: { gap: 6, alignItems: 'center' },
}));
