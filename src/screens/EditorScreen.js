import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, StyleSheet, ScrollView, Pressable } from 'react-native';

import { addSubject, updateSubject, getSubject } from '../store';
import { parseOutline, flattenNodes } from '../parser';
import { colors, font, themedStyles } from '../theme';
import { Header, Segmented, Empty } from '../ui';

export default function EditorScreen({ route, nav }) {
  const existing = route.id ? getSubject(route.id) : null;
  const [name, setName] = useState(existing?.name || '');
  const [text, setText] = useState(existing?.text || '');
  const [view, setView] = useState('text');

  const rows = useMemo(() => flattenNodes(parseOutline(text)), [text]);
  const depth = rows.reduce((d, r) => Math.max(d, r.depth), 0);
  const valid = name.trim().length > 0 && rows.length > 0;

  const save = () => {
    if (!valid) return;
    if (existing) {
      updateSubject(existing.id, { name, text });
      nav.pop();
    } else {
      const id = addSubject({ name, text });
      nav.replace('subject', { id });
    }
  };

  return (
    <View style={styles.fill}>
      <Header
        title={existing ? '목차 수정' : '과목 추가'}
        onBack={nav.pop}
        right={
          <Pressable onPress={save} disabled={!valid} hitSlop={10}>
            <Text style={[styles.save, !valid && { opacity: 0.3 }]}>저장</Text>
          </Pressable>
        }
      />

      <View style={styles.body}>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="과목 이름"
          placeholderTextColor={colors.inkFaint}
          style={styles.nameInput}
        />

        <Segmented
          items={[
            { key: 'text', label: '목차 붙여넣기' },
            { key: 'preview', label: `인식 결과 ${rows.length ? rows.length : ''}` },
          ]}
          value={view}
          onChange={setView}
        />

        {view === 'text' ? (
          <View style={styles.textBox}>
            <TextInput
              value={text}
              onChangeText={setText}
              multiline
              textAlignVertical="top"
              autoCorrect={false}
              placeholder={
                '교재 목차를 그대로 붙여넣으세요.\n\n제1편 행정심판\n  제1장 행정심판 일반론\n  제2장 행정심판의 종류\n    1. 취소심판\n    2. 무효등확인심판\n\n번호(제N편·장·절, Ⅰ., 1., 가., ①)나\n들여쓰기로 계층을 알아서 인식해요.'
              }
              placeholderTextColor={colors.inkFaint}
              style={styles.textInput}
            />
          </View>
        ) : rows.length === 0 ? (
          <Empty title="아직 인식된 목차가 없어요" sub="목차 붙여넣기 탭에서 목차를 입력해 주세요." />
        ) : (
          <ScrollView style={styles.preview} contentContainerStyle={{ paddingVertical: 12 }}>
            <Text style={styles.previewMeta}>
              목차 {rows.length}개 · {depth}단계
            </Text>
            {rows.map(({ node, depth: d }) => (
              <View key={node.id} style={[styles.row, { paddingLeft: 14 + (d - 1) * 18 }]}>
                {d > 1 && <View style={[styles.guide, { left: 14 + (d - 2) * 18 + 4 }]} />}
                <View style={[styles.bullet, d === 1 && styles.bulletTop]} />
                {node.marker ? <Text style={styles.marker}>{node.marker}</Text> : null}
                <Text style={[styles.rowTitle, d === 1 && styles.rowTitleTop]} numberOfLines={2}>
                  {node.title}
                </Text>
              </View>
            ))}
          </ScrollView>
        )}
      </View>
    </View>
  );
}

const styles = themedStyles(() => ({
  fill: { flex: 1 },
  save: { fontFamily: font.bold, fontSize: 16, color: colors.accent },
  body: { flex: 1, paddingHorizontal: 18, gap: 12, paddingBottom: 12 },
  nameInput: {
    fontFamily: font.bold,
    fontSize: 22,
    color: colors.ink,
    paddingVertical: 8,
    borderBottomWidth: 1.5,
    borderBottomColor: colors.line,
  },
  textBox: { flex: 1, backgroundColor: colors.surface, borderRadius: 18, padding: 16 },
  textInput: { flex: 1, fontFamily: font.regular, fontSize: 14.5, lineHeight: 22, color: colors.ink },
  preview: { flex: 1, backgroundColor: colors.surface, borderRadius: 18 },
  previewMeta: { fontFamily: font.semibold, fontSize: 12, color: colors.inkFaint, marginLeft: 16, marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingRight: 14, gap: 6 },
  guide: { position: 'absolute', top: 0, bottom: 0, width: 1, backgroundColor: colors.line },
  bullet: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.inkFaint },
  bulletTop: { backgroundColor: colors.accent, width: 8, height: 8, borderRadius: 4 },
  marker: { fontFamily: font.semibold, fontSize: 12, color: colors.inkFaint },
  rowTitle: { flex: 1, fontFamily: font.regular, fontSize: 14.5, color: colors.ink },
  rowTitleTop: { fontFamily: font.bold, fontSize: 15.5 },
}));
