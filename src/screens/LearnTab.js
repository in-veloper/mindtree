import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet, SectionList } from 'react-native';

import { colors, font, BRANCH_COLORS, STATUS, themedStyles } from '../theme';
import { Icon, statusColorOfPct } from '../ui';

// 하위 목차가 있는 목차 = 하나의 "암기 묶음"
function groupsOf(root) {
  const sections = [{ key: 'root', title: '과목 전체 뼈대', color: colors.ink, data: [{ node: root, depth: 0 }] }];
  root.children.forEach((top, i) => {
    const data = [];
    const walk = (node, depth) => {
      if (node.children.length) data.push({ node, depth });
      node.children.forEach((c) => walk(c, depth + 1));
    };
    walk(top, 1);
    if (data.length) sections.push({ key: top.id, title: top.title, color: BRANCH_COLORS[i % BRANCH_COLORS.length], data });
  });
  return sections;
}

export default function LearnTab({ subject, computed, nav }) {
  const sections = useMemo(() => groupsOf(subject.root), [subject]);

  const open = (node) => nav.push('learn', { subjectId: subject.id, nodeId: node.id });

  return (
    <SectionList
      sections={sections}
      keyExtractor={(item) => item.node.id}
      contentContainerStyle={styles.list}
      stickySectionHeadersEnabled={false}
      ListHeaderComponent={
        <Text style={styles.intro}>
          묶음을 고르면 <Text style={styles.em}>보기 → 빈칸 → 구조 → 빈 화면</Text> 4단계로 외워요.
        </Text>
      }
      renderSectionHeader={({ section }) => (
        <View style={styles.sectionHead}>
          <View style={[styles.sectionBar, { backgroundColor: section.color }]} />
          <Text style={styles.sectionTitle} numberOfLines={1}>
            {section.title}
          </Text>
        </View>
      )}
      renderItem={({ item }) => {
        const { node, depth } = item;
        const m = computed[node.id] || { pct: 0, studied: false, status: 'none' };
        const isRoot = depth === 0;
        return (
          <Pressable
            onPress={() => open(node)}
            style={({ pressed }) => [styles.item, pressed && { backgroundColor: colors.surfaceAlt }]}
          >
            <View style={{ width: Math.max(0, depth - 1) * 14 }} />
            <View style={[styles.dot, { backgroundColor: STATUS[m.status].color }]} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.itemTitle, depth <= 1 && styles.itemTitleTop]} numberOfLines={1}>
                {isRoot ? `${subject.name} 최상위 목차` : node.title}
              </Text>
              <Text style={styles.itemMeta}>
                하위 {node.children.length}개{m.studied ? ` · ${m.pct}%` : ''}
              </Text>
            </View>
            {m.studied ? (
              <View style={[styles.pill, { backgroundColor: `${statusColorOfPct(m.pct)}22` }]}>
                <Text style={[styles.pillText, { color: statusColorOfPct(m.pct) }]}>{m.pct}%</Text>
              </View>
            ) : null}
            <Icon name="chevronRight" size={18} color={colors.inkFaint} />
          </Pressable>
        );
      }}
    />
  );
}

const styles = themedStyles(() => ({
  list: { paddingHorizontal: 16, paddingBottom: 40 },
  intro: { fontFamily: font.regular, fontSize: 13, color: colors.inkSoft, marginBottom: 6, lineHeight: 19 },
  em: { fontFamily: font.semibold, color: colors.ink },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 18, marginBottom: 6 },
  sectionBar: { width: 4, height: 16, borderRadius: 2 },
  sectionTitle: { fontFamily: font.bold, fontSize: 14, color: colors.inkSoft },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surface,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 6,
  },
  dot: { width: 9, height: 9, borderRadius: 5 },
  itemTitle: { fontFamily: font.semibold, fontSize: 15, color: colors.ink },
  itemTitleTop: { fontFamily: font.bold },
  itemMeta: { fontFamily: font.regular, fontSize: 12, color: colors.inkFaint, marginTop: 2 },
  pill: { paddingHorizontal: 8, height: 22, borderRadius: 11, justifyContent: 'center' },
  pillText: { fontFamily: font.bold, fontSize: 11.5 },
}));
