import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';

import { colors, font, BRANCH_COLORS, STATUS, themedStyles } from '../theme';

const GAP_X = 34;
const GAP_Y = 10;
const PAD = 40;
const MAX_TEXT = { 0: 170, 1: 170, 2: 160, 3: 150 };

const LOOK = {
  0: { fs: 16, lh: 21, px: 18, py: 11, family: font.bold },
  1: { fs: 14.5, lh: 19, px: 14, py: 9, family: font.bold },
  2: { fs: 13.5, lh: 18, px: 12, py: 8, family: font.semibold },
  3: { fs: 13, lh: 17, px: 10, py: 6, family: font.regular },
};
const lookOf = (d) => LOOK[Math.min(d, 3)];

// 폰트 측정 없이 너비를 어림한다(한글은 정사각형에 가깝고 숫자·영문은 좁다).
function estimateWidth(text, fs) {
  let w = 0;
  for (const ch of text) {
    if (/[가-힣ㄱ-ㅎㅏ-ㅣ一-龥]/.test(ch)) w += fs * 1.0;
    else if (ch === ' ') w += fs * 0.3;
    else w += fs * 0.6;
  }
  return w;
}

const DOT = 8;
const DOT_GAP = 7;

function layoutTree(root, isVisible) {
  const boxes = {};
  const edges = [];

  const measure = (node, depth) => {
    const look = lookOf(depth);
    const textW = estimateWidth(node.title, look.fs) + 2;
    const maxText = MAX_TEXT[Math.min(depth, 3)];
    const lines = textW > maxText ? 2 : 1;
    const dot = depth > 0 ? DOT + DOT_GAP : 0;
    const w = Math.min(textW, maxText) + look.px * 2 + dot;
    const h = lines * look.lh + look.py * 2;
    const kids = node.children.filter((c) => isVisible(node, c, depth + 1));
    const childBoxes = kids.map((c) => measure(c, depth + 1));
    const kidsH = childBoxes.reduce((a, b) => a + b.subH, 0) + Math.max(0, kids.length - 1) * GAP_Y;
    const box = {
      node,
      depth,
      w,
      h,
      lines,
      kids: childBoxes,
      hidden: node.children.length - kids.length,
      subH: Math.max(h, kidsH),
      kidsH,
    };
    return box;
  };

  const place = (box, x, top, branch) => {
    box.x = x;
    box.branch = branch;
    if (!box.kids.length) {
      box.y = top + (box.subH - box.h) / 2;
    } else {
      let cursor = top + (box.subH - box.kidsH) / 2;
      box.kids.forEach((k, i) => {
        const kb = box.depth === 0 ? BRANCH_COLORS[i % BRANCH_COLORS.length] : branch;
        place(k, x + box.w + GAP_X, cursor, kb);
        cursor += k.subH + GAP_Y;
      });
      const first = box.kids[0];
      const last = box.kids[box.kids.length - 1];
      box.y = (first.y + first.h / 2 + last.y + last.h / 2) / 2 - box.h / 2;
    }
    boxes[box.node.id] = box;
    box.kids.forEach((k) => edges.push({ from: box, to: k }));
  };

  const top = measure(root, 0);
  place(top, PAD, PAD, colors.ink);

  let maxX = 0;
  Object.values(boxes).forEach((b) => (maxX = Math.max(maxX, b.x + b.w)));
  return { boxes: Object.values(boxes), edges, width: maxX + PAD, height: top.subH + PAD * 2, root: top };
}

function edgePath(a, b) {
  const x1 = a.x + a.w;
  const y1 = a.y + a.h / 2;
  const x2 = b.x;
  const y2 = b.y + b.h / 2;
  const mx = (x1 + x2) / 2;
  return `M${x1} ${y1} C${mx} ${y1} ${mx} ${y2} ${x2} ${y2}`;
}

const clamp = (v, lo, hi) => {
  'worklet';
  return Math.min(hi, Math.max(lo, v));
};

export default function MindMap({ root, computed, depthLimit, onNodePress }) {
  const [collapsed, setCollapsed] = useState(() => new Set());
  const [expanded, setExpanded] = useState(() => new Set());
  const [viewport, setViewport] = useState({ w: 0, h: 0 });

  // 깊이 제한을 바꾸면 손으로 펼치고 접은 것은 초기화한다.
  useEffect(() => {
    setCollapsed(new Set());
    setExpanded(new Set());
  }, [depthLimit]);

  const layout = useMemo(() => {
    const isVisible = (parent, child, depth) => {
      if (collapsed.has(parent.id)) return false;
      if (expanded.has(parent.id)) return true;
      return depth <= depthLimit;
    };
    return layoutTree(root, isVisible);
  }, [root, depthLimit, collapsed, expanded]);

  const toggle = (id, hiddenNow) => {
    const c = new Set(collapsed);
    const e = new Set(expanded);
    if (hiddenNow) {
      c.delete(id);
      e.add(id);
    } else {
      e.delete(id);
      c.add(id);
    }
    setCollapsed(c);
    setExpanded(e);
  };

  /* ---------- 이동·확대 ---------- */
  const s = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);

  // whole=true: 전체가 화면에 들어오게. false: 글씨가 읽히는 크기로, 루트를 화면 세로 가운데에.
  const fit = (animate, whole) => {
    if (!viewport.w) return;
    const fitAll = Math.min(1, (viewport.w - 8) / layout.width, (viewport.h - 8) / layout.height);
    const scale = whole ? Math.max(0.3, fitAll) : Math.max(fitAll, Math.min(1, 0.9));
    const rootCy = layout.root.y + layout.root.h / 2;
    const contentH = layout.height * scale;
    const nx = whole ? Math.max(0, (viewport.w - layout.width * scale) / 2) : 0;
    const ny =
      contentH <= viewport.h
        ? (viewport.h - contentH) / 2
        : Math.min(0, Math.max(viewport.h - contentH, viewport.h / 2 - rootCy * scale));
    const go = (sv, v) => (sv.value = animate ? withTiming(v, { duration: 280 }) : v);
    go(s, scale);
    go(tx, nx);
    go(ty, ny);
  };

  useEffect(() => {
    fit(false, false);
  }, [viewport.w, viewport.h, depthLimit]);

  // 이동·확대 모두 "직전 이벤트 대비 변화량"만 더한다. 시작 시점 값을 기준으로 계산하면
  // 손가락 하나를 먼저 뗄 때 이동 제스처가 예전 기준으로 돌아가며 화면이 튄다.
  const pan = Gesture.Pan()
    .minDistance(4)
    .maxPointers(2)
    .onChange((e) => {
      tx.value += e.changeX;
      ty.value += e.changeY;
    });

  const pinch = Gesture.Pinch().onChange((e) => {
    const prev = s.value;
    const next = clamp(prev * e.scaleChange, 0.3, 2.4);
    const r = next / prev;
    // 두 손가락 사이 지점이 화면에서 제자리에 있도록 그 점을 기준으로 확대
    tx.value = e.focalX - (e.focalX - tx.value) * r;
    ty.value = e.focalY - (e.focalY - ty.value) * r;
    s.value = next;
  });

  const gesture = Gesture.Simultaneous(pan, pinch);

  const canvasStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.value },
      { translateY: ty.value },
      { translateX: -layout.width / 2 },
      { translateY: -layout.height / 2 },
      { scale: s.value },
      { translateX: layout.width / 2 },
      { translateY: layout.height / 2 },
    ],
  }));

  return (
    <View
      style={styles.viewport}
      onLayout={(e) => setViewport({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
    >
      <GestureDetector gesture={gesture}>
        <View style={StyleSheet.absoluteFill} collapsable={false}>
          <Animated.View style={[{ width: layout.width, height: layout.height }, canvasStyle]}>
            <Svg width={layout.width} height={layout.height} style={StyleSheet.absoluteFill}>
              {layout.edges.map(({ from, to }) => (
                <Path
                  key={to.node.id}
                  d={edgePath(from, to)}
                  stroke={to.branch}
                  strokeOpacity={to.depth === 1 ? 0.75 : 0.45}
                  strokeWidth={to.depth === 1 ? 2.6 : to.depth === 2 ? 1.8 : 1.3}
                  fill="none"
                  strokeLinecap="round"
                />
              ))}
            </Svg>

            {layout.boxes.map((b) => (
              <MapNode
                key={b.node.id}
                box={b}
                m={computed[b.node.id]}
                onPress={() => onNodePress(b.node)}
                onToggle={() => toggle(b.node.id, b.hidden > 0)}
              />
            ))}
          </Animated.View>
        </View>
      </GestureDetector>

      <View style={styles.fitRow}>
        <Pressable style={styles.fitBtn} onPress={() => fit(true, true)} hitSlop={8}>
          <Text style={styles.fitText}>전체</Text>
        </Pressable>
        <Pressable style={styles.fitBtn} onPress={() => fit(true, false)} hitSlop={8}>
          <Text style={styles.fitText}>크게</Text>
        </Pressable>
      </View>
    </View>
  );
}

function MapNode({ box, m, onPress, onToggle }) {
  const { node, depth, x, y, w, h, lines, branch, hidden } = box;
  const look = lookOf(depth);
  const status = depth === 0 ? null : (m && m.status) || 'none';

  let boxStyle;
  let textColor = colors.ink;
  if (depth === 0) {
    boxStyle = { backgroundColor: colors.ink, borderRadius: h / 2 };
    textColor = colors.onInk;
  } else if (depth === 1) {
    boxStyle = { backgroundColor: branch, borderRadius: 14 };
    textColor = '#fff';
  } else if (depth === 2) {
    boxStyle = { backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1.5, borderColor: branch };
  } else {
    boxStyle = { backgroundColor: colors.surface, borderRadius: 10, borderWidth: 1, borderColor: colors.line };
  }

  const hasKids = node.children.length > 0;

  return (
    <View style={{ position: 'absolute', left: x, top: y, width: w, height: h }}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.node,
          boxStyle,
          { paddingHorizontal: look.px, height: h },
          depth <= 1 && styles.nodeLifted,
          pressed && { opacity: 0.8 },
        ]}
      >
        {status && (
          <View
            style={[
              styles.dot,
              { backgroundColor: STATUS[status].color },
              depth === 1 && { borderWidth: 1.5, borderColor: '#fff' },
            ]}
          />
        )}
        <Text
          numberOfLines={lines}
          style={{ flex: 1, fontFamily: look.family, fontSize: look.fs, lineHeight: look.lh, color: textColor }}
        >
          {node.title}
        </Text>
      </Pressable>

      {hasKids && depth > 0 && (
        <Pressable
          onPress={onToggle}
          hitSlop={10}
          style={[styles.toggle, !hidden && styles.toggleOpen, { borderColor: branch, backgroundColor: hidden ? branch : colors.surface }]}
        >
          <Text style={[styles.toggleText, { color: hidden ? '#fff' : branch }]}>
            {hidden ? `+${hidden}` : ''}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = themedStyles(() => ({
  viewport: { flex: 1, overflow: 'hidden', backgroundColor: colors.bg },
  node: { flexDirection: 'row', alignItems: 'center' },
  nodeLifted: {
    shadowColor: '#1B1F2A',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  dot: { width: DOT, height: DOT, borderRadius: DOT / 2, marginRight: DOT_GAP },
  toggle: {
    position: 'absolute',
    right: -11,
    top: '50%',
    marginTop: -10,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 4,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
  },
  toggleOpen: { minWidth: 14, height: 14, marginTop: -7, right: -8, paddingHorizontal: 0 },
  toggleText: { fontFamily: font.bold, fontSize: 10.5, lineHeight: 13 },
  fitRow: { position: 'absolute', right: 14, bottom: 14, flexDirection: 'row', gap: 8 },
  fitBtn: {
    paddingHorizontal: 14,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  fitText: { fontFamily: font.semibold, fontSize: 13, color: colors.ink },
}));
