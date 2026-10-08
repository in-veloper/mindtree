import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';

import { weakNodes } from '../mastery';
import { pathTo } from '../parser';
import { colors, font, BRANCH_COLORS, themedStyles } from '../theme';
import { Ring, Bar, Icon, Card, statusColorOfPct } from '../ui';

export default function MasteryTab({ subject, computed, index, nav }) {
  const [focusId, setFocusId] = useState(subject.root.id);
  const focus = index[focusId]?.node || subject.root;
  const isRoot = focus.id === subject.root.id;
  const fm = computed[focus.id];
  const crumbs = pathTo(index, focus.id);
  const weak = useMemo(() => weakNodes(subject.root, computed, 6), [subject, computed]);

  // 최상위 가지 색을 하위에서도 이어 쓴다
  const branchColor = (node) => {
    const p = pathTo(index, node.id);
    const top = p[1];
    if (!top) return colors.ink;
    const i = subject.root.children.indexOf(top);
    return BRANCH_COLORS[i % BRANCH_COLORS.length];
  };

  return (
    <ScrollView contentContainerStyle={styles.list}>
      <Card style={styles.hero}>
        <Ring pct={fm.pct} size={112} stroke={10} color={statusColorOfPct(fm.pct, fm.studied)}>
          <Text style={styles.heroPct}>
            {fm.pct}
            <Text style={styles.heroSign}>%</Text>
          </Text>
        </Ring>
        <View style={{ flex: 1 }}>
          <Text style={styles.heroLabel}>{isRoot ? '목차 숙련도' : '이 목차 숙련도'}</Text>
          <Text style={styles.heroTitle} numberOfLines={2}>
            {isRoot ? subject.name : focus.title}
          </Text>
          {!fm.studied && <Text style={styles.heroHint}>암기나 테스트를 하면 채워져요.</Text>}
        </View>
      </Card>

      {!isRoot && (
        <View style={styles.crumbs}>
          {crumbs.map((n, i) => (
            <Pressable key={n.id} onPress={() => setFocusId(n.id)} hitSlop={6} style={styles.crumbItem}>
              {i > 0 && <Text style={styles.crumbSep}>›</Text>}
              <Text style={[styles.crumb, i === crumbs.length - 1 && styles.crumbOn]} numberOfLines={1}>
                {i === 0 ? subject.name : n.title}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      <Card style={{ paddingVertical: 8 }}>
        {focus.children.map((c) => {
          const m = computed[c.id];
          const color = statusColorOfPct(m.pct, m.studied);
          const weakMark = m.studied && m.pct < 50;
          const hasKids = c.children.length > 0;
          return (
            <Pressable
              key={c.id}
              onPress={() => (hasKids ? setFocusId(c.id) : null)}
              style={({ pressed }) => [styles.row, pressed && hasKids && { opacity: 0.6 }]}
            >
              <View style={[styles.branch, { backgroundColor: branchColor(c) }]} />
              <View style={{ flex: 1 }}>
                <View style={styles.rowTop}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {c.title}
                  </Text>
                  {weakMark && <Text style={styles.weakTag}>약점</Text>}
                  <Text style={[styles.rowPct, { color: m.studied ? color : colors.inkFaint }]}>
                    {m.studied ? `${m.pct}%` : '—'}
                  </Text>
                </View>
                <Bar pct={m.pct} color={color} height={6} />
              </View>
              {hasKids ? <Icon name="chevronRight" size={16} color={colors.inkFaint} /> : <View style={{ width: 16 }} />}
            </Pressable>
          );
        })}
      </Card>

      {weak.length > 0 && (
        <>
          <Text style={styles.section}>약점 목차</Text>
          <Card style={{ paddingVertical: 6 }}>
            {weak.map(({ node, pct }) => {
              const parent = index[node.id].parent;
              const learnable = node.children.length ? node : parent;
              return (
                <View key={node.id} style={styles.weakRow}>
                  <View style={[styles.weakDot, { backgroundColor: statusColorOfPct(pct) }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.weakTitle} numberOfLines={1}>
                      {node.title}
                    </Text>
                    <Text style={styles.weakPath} numberOfLines={1}>
                      {pathTo(index, node.id)
                        .slice(1, -1)
                        .map((n) => n.title)
                        .join(' › ') || subject.name}
                    </Text>
                  </View>
                  <Text style={styles.weakPct}>{pct}%</Text>
                  <Pressable
                    onPress={() => nav.push('learn', { subjectId: subject.id, nodeId: learnable.id })}
                    style={styles.weakBtn}
                    hitSlop={6}
                  >
                    <Text style={styles.weakBtnText}>암기</Text>
                  </Pressable>
                </View>
              );
            })}
          </Card>
        </>
      )}
    </ScrollView>
  );
}

const styles = themedStyles(() => ({
  list: { paddingHorizontal: 16, paddingBottom: 40, gap: 12 },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  heroPct: { fontFamily: font.bold, fontSize: 30, color: colors.ink },
  heroSign: { fontSize: 15 },
  heroLabel: { fontFamily: font.semibold, fontSize: 12.5, color: colors.inkFaint },
  heroTitle: { fontFamily: font.bold, fontSize: 19, color: colors.ink, marginTop: 3 },
  heroHint: { fontFamily: font.regular, fontSize: 12.5, color: colors.inkFaint, marginTop: 6 },
  crumbs: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', paddingHorizontal: 4 },
  crumbItem: { flexDirection: 'row', alignItems: 'center' },
  crumbSep: { color: colors.inkFaint, marginHorizontal: 6 },
  crumb: { fontFamily: font.semibold, fontSize: 13, color: colors.accent, maxWidth: 140 },
  crumbOn: { color: colors.ink },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11 },
  branch: { width: 4, height: 34, borderRadius: 2 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 7 },
  rowTitle: { flex: 1, fontFamily: font.semibold, fontSize: 15, color: colors.ink },
  weakTag: {
    fontFamily: font.bold,
    fontSize: 10.5,
    color: colors.bad,
    backgroundColor: '#E5534B18',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: 'hidden',
  },
  rowPct: { fontFamily: font.bold, fontSize: 14, minWidth: 40, textAlign: 'right' },
  section: { fontFamily: font.bold, fontSize: 14, color: colors.inkSoft, marginTop: 8, marginLeft: 4 },
  weakRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  weakDot: { width: 9, height: 9, borderRadius: 5 },
  weakTitle: { fontFamily: font.semibold, fontSize: 15, color: colors.ink },
  weakPath: { fontFamily: font.regular, fontSize: 12, color: colors.inkFaint, marginTop: 2 },
  weakPct: { fontFamily: font.bold, fontSize: 13.5, color: colors.inkSoft },
  weakBtn: { backgroundColor: colors.accentSoft, borderRadius: 10, paddingHorizontal: 10, height: 30, justifyContent: 'center' },
  weakBtnText: { fontFamily: font.bold, fontSize: 12.5, color: colors.accent },
}));
