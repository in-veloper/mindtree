import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, FlatList } from 'react-native';

import { colors, font, BRANCH_COLORS, STATUS, themedStyles } from '../theme';
import { getTreeView, saveTreeView } from '../treeState';
import { Icon } from '../ui';

const ROW_H = 44;

export default function Outline({ viewId, sig, root, computed, depthLimit, onNodePress }) {
  // 다른 탭·화면에 갔다 오면 새로 만들어지므로, 펼침 상태와 스크롤 위치를 되살린다.
  const savedRef = useRef(null);
  if (savedRef.current === null) savedRef.current = getTreeView(viewId, sig) || {};
  const saved = savedRef.current;

  const [open, setOpen] = useState(saved.outlineOpen || {}); // id → true(펼침)/false(접음), 없으면 깊이 제한을 따른다
  const listRef = useRef(null);
  const restored = useRef(!(saved.outlineY > 0));

  useEffect(() => {
    saveTreeView(viewId, sig, { outlineOpen: open });
  }, [viewId, sig, open]);

  const rows = useMemo(() => {
    const out = [];
    const walk = (node, depth, branch) => {
      node.children.forEach((c, i) => {
        const b = depth === 1 ? BRANCH_COLORS[i % BRANCH_COLORS.length] : branch;
        const expanded = open[c.id] ?? depth < depthLimit;
        out.push({ node: c, depth, branch: b, expanded });
        if (expanded) walk(c, depth + 1, b);
      });
    };
    walk(root, 1, colors.ink);
    return out;
  }, [root, depthLimit, open]);

  const toggle = (id, expanded) => setOpen((o) => ({ ...o, [id]: !expanded }));

  return (
    <FlatList
      ref={listRef}
      data={rows}
      keyExtractor={(r) => r.node.id}
      contentContainerStyle={styles.list}
      // 저장해 둔 위치까지 행이 미리 그려져 있어야 정확히 그 자리로 돌아간다
      initialNumToRender={Math.ceil((saved.outlineY || 0) / ROW_H) + 20}
      scrollEventThrottle={100}
      onScroll={(e) => saveTreeView(viewId, sig, { outlineY: e.nativeEvent.contentOffset.y })}
      onContentSizeChange={() => {
        if (restored.current) return;
        restored.current = true;
        listRef.current?.scrollToOffset({ offset: saved.outlineY, animated: false });
      }}
      renderItem={({ item }) => {
        const { node, depth, branch, expanded } = item;
        const m = computed[node.id] || { pct: 0, status: 'none' };
        const hasKids = node.children.length > 0;
        return (
          <Pressable
            onPress={() => onNodePress(node)}
            style={({ pressed }) => [styles.row, { paddingLeft: 12 + (depth - 1) * 20 }, pressed && { backgroundColor: colors.surfaceAlt }]}
          >
            {depth === 1 && <View style={[styles.branchBar, { backgroundColor: branch }]} />}
            <Pressable
              onPress={() => hasKids && toggle(node.id, expanded)}
              hitSlop={10}
              style={styles.chevron}
            >
              {hasKids ? (
                <View style={{ transform: [{ rotate: expanded ? '0deg' : '-90deg' }] }}>
                  <Icon name="chevronDown" size={16} color={colors.inkFaint} stroke={2.4} />
                </View>
              ) : null}
            </Pressable>
            <View style={[styles.dot, { backgroundColor: STATUS[m.status].color }]} />
            <View style={{ flex: 1 }}>
              <Text
                numberOfLines={2}
                style={[styles.title, depth === 1 && styles.titleTop, depth >= 3 && styles.titleDeep]}
              >
                {node.marker ? <Text style={styles.marker}>{node.marker} </Text> : null}
                {node.title}
              </Text>
            </View>
            {hasKids && m.studied ? <Text style={styles.pct}>{m.pct}%</Text> : null}
          </Pressable>
        );
      }}
    />
  );
}

const styles = themedStyles(() => ({
  list: { paddingVertical: 8, paddingBottom: 40 },
  row: { flexDirection: 'row', alignItems: 'center', paddingRight: 18, minHeight: 44, gap: 6 },
  branchBar: { position: 'absolute', left: 0, top: 10, bottom: 10, width: 3, borderRadius: 2 },
  chevron: { width: 20, alignItems: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 4 },
  title: { fontFamily: font.regular, fontSize: 15, color: colors.ink, lineHeight: 21 },
  titleTop: { fontFamily: font.bold, fontSize: 16 },
  titleDeep: { fontSize: 14, color: colors.inkSoft },
  marker: { fontFamily: font.semibold, fontSize: 12, color: colors.inkFaint },
  pct: { fontFamily: font.semibold, fontSize: 12, color: colors.inkFaint },
}));
