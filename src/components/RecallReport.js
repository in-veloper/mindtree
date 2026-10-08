import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

import { colors, font, themedStyles } from '../theme';
import { Ring, statusColorOfPct } from '../ui';

export const VERDICT = {
  exact: { color: colors.good, label: '정확' },
  near: { color: '#2E9BB8', label: '표현 차이' },
  order: { color: colors.mid, label: '순서 오류' },
  level: { color: '#9B5DE5', label: '위치 오류' },
  missing: { color: colors.bad, label: '누락' },
};

export default function RecallReport({ report }) {
  const pct = Math.round(report.score * 100);
  return (
    <View>
      <View style={styles.top}>
        <Ring pct={pct} size={92} stroke={8} color={statusColorOfPct(pct)}>
          <Text style={styles.pct}>
            {pct}
            <Text style={styles.pctSign}>%</Text>
          </Text>
        </Ring>
        <View style={styles.counts}>
          {Object.keys(VERDICT).map((k) =>
            report.counts[k] ? (
              <View key={k} style={styles.countRow}>
                <View style={[styles.dot, { backgroundColor: VERDICT[k].color }]} />
                <Text style={styles.countLabel}>{VERDICT[k].label}</Text>
                <Text style={styles.countNum}>{report.counts[k]}</Text>
              </View>
            ) : null
          )}
        </View>
      </View>

      <View style={styles.tree}>
        {report.items.map((it) => {
          const v = VERDICT[it.verdict];
          const showInput = it.input && it.verdict !== 'exact' && it.verdict !== 'missing';
          return (
            <View key={it.node.id} style={[styles.row, { paddingLeft: 12 + (it.depth - 1) * 18 }]}>
              <View style={[styles.mark, { backgroundColor: v.color }]} />
              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    styles.title,
                    it.depth === 1 && styles.titleTop,
                    it.verdict === 'missing' && { color: colors.bad },
                  ]}
                >
                  {it.node.title}
                </Text>
                {showInput ? <Text style={styles.input}>내가 쓴 것: {it.input}</Text> : null}
              </View>
              {it.verdict !== 'exact' && <Text style={[styles.tag, { color: v.color }]}>{v.label}</Text>}
            </View>
          );
        })}
      </View>

      {report.extras.length > 0 && (
        <View style={styles.extras}>
          <Text style={styles.extrasTitle}>목차에 없는 항목</Text>
          {report.extras.map((e, i) => (
            <Text key={i} style={styles.extra}>
              · {e}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = themedStyles(() => ({
  top: { flexDirection: 'row', alignItems: 'center', gap: 20, marginBottom: 18 },
  pct: { fontFamily: font.bold, fontSize: 24, color: colors.ink },
  pctSign: { fontSize: 13, fontFamily: font.semibold },
  counts: { flex: 1, gap: 6 },
  countRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  countLabel: { flex: 1, fontFamily: font.regular, fontSize: 13.5, color: colors.inkSoft },
  countNum: { fontFamily: font.bold, fontSize: 14, color: colors.ink },
  tree: { backgroundColor: colors.surface, borderRadius: 16, paddingVertical: 6 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, paddingRight: 14, paddingVertical: 7 },
  mark: { width: 4, alignSelf: 'stretch', borderRadius: 2, minHeight: 18 },
  title: { fontFamily: font.regular, fontSize: 14.5, color: colors.ink, lineHeight: 20 },
  titleTop: { fontFamily: font.bold },
  input: { fontFamily: font.regular, fontSize: 12.5, color: colors.inkFaint, marginTop: 2 },
  tag: { fontFamily: font.semibold, fontSize: 11.5, marginTop: 2 },
  extras: { marginTop: 14, backgroundColor: colors.surface, borderRadius: 16, padding: 14 },
  extrasTitle: { fontFamily: font.semibold, fontSize: 13, color: colors.inkSoft, marginBottom: 6 },
  extra: { fontFamily: font.regular, fontSize: 14, color: colors.inkSoft, lineHeight: 21 },
}));
