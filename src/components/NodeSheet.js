import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';

import { markStatus } from '../store';
import { pathTo } from '../parser';
import { colors, font, STATUS, themedStyles } from '../theme';
import { Sheet, Button, Bar, statusColorOfPct } from '../ui';

const ORDER = ['good', 'mid', 'bad', 'none'];

export default function NodeSheet({ node, index, computed, onClose, onLearn, onRecall }) {
  if (!node) return <Sheet visible={false} onClose={onClose} />;

  const path = pathTo(index, node.id);
  const m = computed[node.id] || { pct: 0, status: 'none', studied: false, own: null };
  const ownStatus = m.own === null ? 'none' : m.own >= 0.85 ? 'good' : m.own >= 0.5 ? 'mid' : 'bad';
  const hasKids = node.children.length > 0;

  return (
    <Sheet visible onClose={onClose}>
      <Text style={styles.path} numberOfLines={2}>
        {path.slice(0, -1).map((n) => n.title).join('  ›  ')}
      </Text>
      <Text style={styles.title}>{node.title}</Text>

      {hasKids && (
        <View style={styles.pctRow}>
          <View style={{ flex: 1 }}>
            <Bar pct={m.pct} color={statusColorOfPct(m.pct, m.studied)} height={8} />
          </View>
          <Text style={styles.pctText}>{m.studied ? `${m.pct}%` : '아직 안 함'}</Text>
        </View>
      )}

      <Text style={styles.label}>이 목차 상태 직접 표시</Text>
      <View style={styles.statusRow}>
        {ORDER.map((k) => {
          const active = ownStatus === k;
          return (
            <Pressable
              key={k}
              onPress={() => markStatus(node.id, k)}
              style={[styles.statusBtn, active && { borderColor: STATUS[k].color, backgroundColor: `${STATUS[k].color}1A` }]}
            >
              <View style={[styles.statusDot, { backgroundColor: STATUS[k].color }]} />
              <Text style={[styles.statusText, active && { color: colors.ink }]}>{STATUS[k].label}</Text>
            </Pressable>
          );
        })}
      </View>

      {hasKids && (
        <>
          <Text style={styles.label}>하위 목차 {node.children.length}개</Text>
          <View style={styles.kids}>
            {node.children.map((c, i) => {
              const cm = computed[c.id] || { status: 'none' };
              return (
                <View key={c.id} style={styles.kidRow}>
                  <Text style={styles.kidNum}>{i + 1}</Text>
                  <View style={[styles.statusDot, { backgroundColor: STATUS[cm.status].color }]} />
                  <Text style={styles.kidTitle} numberOfLines={1}>
                    {c.title}
                  </Text>
                  {c.children.length ? <Text style={styles.kidMore}>+{c.children.length}</Text> : null}
                </View>
              );
            })}
          </View>
          <View style={styles.actions}>
            <Button title="단계별 암기" kind="accent" style={{ flex: 1 }} onPress={() => onLearn(node)} />
            <Button title="현출 테스트" kind="soft" style={{ flex: 1 }} onPress={() => onRecall(node)} />
          </View>
        </>
      )}
    </Sheet>
  );
}

const styles = themedStyles(() => ({
  path: { fontFamily: font.regular, fontSize: 12.5, color: colors.inkFaint, marginBottom: 4 },
  title: { fontFamily: font.bold, fontSize: 22, color: colors.ink, letterSpacing: -0.4 },
  pctRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 14 },
  pctText: { fontFamily: font.bold, fontSize: 14, color: colors.ink, minWidth: 64, textAlign: 'right' },
  label: { fontFamily: font.semibold, fontSize: 12.5, color: colors.inkFaint, marginTop: 22, marginBottom: 10 },
  statusRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  statusBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 11,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.5,
    borderColor: colors.line,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontFamily: font.semibold, fontSize: 12.5, color: colors.inkSoft },
  kids: { backgroundColor: colors.surfaceAlt, borderRadius: 14, paddingVertical: 4 },
  kidRow: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 14, paddingVertical: 9 },
  kidNum: { fontFamily: font.semibold, fontSize: 12, color: colors.inkFaint, width: 16 },
  kidTitle: { flex: 1, fontFamily: font.regular, fontSize: 14.5, color: colors.ink },
  kidMore: { fontFamily: font.semibold, fontSize: 11.5, color: colors.inkFaint },
  actions: { flexDirection: 'row', gap: 10, marginTop: 18 },
}));
