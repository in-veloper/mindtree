import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';

import { colors, font, BRANCH_COLORS, STATUS, themedStyles } from '../theme';
import { getTreeView, saveTreeView } from '../treeState';

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

// 연결선은 SVG 가 아니라 평범한 View(둥근 꺾임선)로 그린다.
// 안드로이드의 SVG 는 캔버스 크기만큼 비트맵을 통째로 만들어서, 목차가 수백 개면
// (가로 수천 px × 세로 수만 px) 메모리가 모자라 앱이 꺼진다. View 는 크기와 상관없이 가볍다.
function mix(hex, bgHex, a) {
  const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const c = rgb(hex);
  const b = rgb(bgHex);
  const m = c.map((v, i) => Math.round(v * a + b[i] * (1 - a)));
  return `rgb(${m[0]},${m[1]},${m[2]})`;
}
const lineW = (depth) => (depth === 1 ? 2.6 : depth === 2 ? 1.8 : 1.4);
const lineAlpha = (depth) => (depth === 1 ? 0.8 : 0.5);

const Edges = React.memo(function Edges({ boxes }) {
  const out = [];
  boxes.forEach((p) => {
    if (!p.kids.length) return;
    const x1 = p.x + p.w;
    const yP = p.y + p.h / 2;
    const half = GAP_X / 2;
    const xm = x1 + half;
    const first = p.kids[0];
    const ts = lineW(first.depth);
    // 루트 줄기는 가지마다 색이 달라서 중립색으로 두고, 갈라진 뒤부터 가지 색을 쓴다.
    const stubColor =
      p.depth === 0 ? mix(colors.ink, colors.bg, 0.45) : mix(p.branch, colors.bg, lineAlpha(first.depth));
    out.push(
      <View
        key={`s${p.node.id}`}
        style={{ position: 'absolute', left: x1, top: yP - ts / 2, width: half + ts / 2, height: ts, backgroundColor: stubColor }}
      />
    );

    // 먼 자식부터 그려야 가까운 자식의 줄기 색이 위에 남는다.
    const kids = [...p.kids].sort(
      (a, b) => Math.abs(b.y + b.h / 2 - yP) - Math.abs(a.y + a.h / 2 - yP)
    );
    kids.forEach((c) => {
      const t = lineW(c.depth);
      const color = mix(c.branch, colors.bg, lineAlpha(c.depth));
      const dy = c.y + c.h / 2 - yP;
      const left = xm - t / 2;
      const width = c.x - left;

      if (Math.abs(dy) < 0.5) {
        out.push(
          <View
            key={`e${c.node.id}`}
            style={{ position: 'absolute', left, top: yP - t / 2, width, height: t, backgroundColor: color }}
          />
        );
        return;
      }

      const r = Math.max(0, Math.min(12, Math.abs(dy), width - t));
      const base = { position: 'absolute', left, width, borderLeftWidth: t, borderLeftColor: color };
      out.push(
        <View
          key={`e${c.node.id}`}
          style={
            dy > 0
              ? { ...base, top: yP - t / 2, height: dy + t, borderBottomWidth: t, borderBottomColor: color, borderBottomLeftRadius: r }
              : { ...base, top: yP + dy - t / 2, height: -dy + t, borderTopWidth: t, borderTopColor: color, borderTopLeftRadius: r }
          }
        />
      );
    });
  });
  return <>{out}</>;
});

const MIN_SCALE_FLOOR = 0.004;

const clamp = (v, lo, hi) => {
  'worklet';
  return Math.min(hi, Math.max(lo, v));
};

export default function MindMap({ viewId, sig, root, computed, depthLimit, onNodePress }) {
  // 다른 탭·화면에 갔다 오면 이 컴포넌트가 새로 만들어진다 — 그때 직전 상태를 되살린다.
  const savedRef = useRef(null);
  if (savedRef.current === null) savedRef.current = getTreeView(viewId, sig) || {};
  const saved = savedRef.current;

  const [collapsed, setCollapsed] = useState(() => new Set(saved.mapCollapsed || []));
  const [expanded, setExpanded] = useState(() => new Set(saved.mapExpanded || []));
  const [viewport, setViewport] = useState({ w: 0, h: 0 });

  useEffect(() => {
    saveTreeView(viewId, sig, { mapCollapsed: [...collapsed], mapExpanded: [...expanded] });
  }, [viewId, sig, collapsed, expanded]);

  // 깊이 제한을 바꾸면 손으로 펼치고 접은 것은 초기화한다. (처음 뜰 때는 되살린 상태를 지키려고 건너뛴다)
  const depthSeen = useRef(depthLimit);
  useEffect(() => {
    if (depthSeen.current === depthLimit) return;
    depthSeen.current = depthLimit;
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
  const minS = useSharedValue(0.3);
  // 워크릿이 큰 layout 객체를 통째로 복사해 가지 않도록 숫자만 뽑아 쓴다.
  const W = layout.width;
  const H = layout.height;

  // whole=true: 전체가 화면에 들어오게. false: 글씨가 읽히는 크기로, 루트를 화면 세로 가운데에.
  const fit = (animate, whole) => {
    if (!viewport.w) return;
    const fitAll = Math.max(MIN_SCALE_FLOOR, Math.min(1, (viewport.w - 8) / W, (viewport.h - 8) / H));
    const scale = whole ? fitAll : Math.max(fitAll, Math.min(1, 0.9));
    const rootCy = layout.root.y + layout.root.h / 2;
    const contentH = H * scale;
    const nx = whole ? Math.max(0, (viewport.w - W * scale) / 2) : 0;
    const ny =
      contentH <= viewport.h
        ? (viewport.h - contentH) / 2
        : Math.min(0, Math.max(viewport.h - contentH, viewport.h / 2 - rootCy * scale));
    const go = (sv, v) => (sv.value = animate ? withTiming(v, { duration: 280 }) : v);
    go(s, scale);
    go(tx, nx);
    go(ty, ny);
  };

  // 처음 화면 크기가 잡힐 때, 저장해 둔 확대·이동 위치가 있으면 그대로 쓰고 없으면 맞춘다.
  const camRestored = useRef(false);
  useEffect(() => {
    if (!viewport.w) return;
    if (!camRestored.current) {
      camRestored.current = true;
      if (saved.cam) {
        s.value = saved.cam.s;
        tx.value = saved.cam.tx;
        ty.value = saved.cam.ty;
        return;
      }
    }
    fit(false, false);
  }, [viewport.w, viewport.h, depthLimit]);

  // 화면을 떠날 때 마지막 확대·이동 위치를 남긴다.
  useEffect(
    () => () => {
      saveTreeView(viewId, sig, { cam: { s: s.value, tx: tx.value, ty: ty.value } });
    },
    [viewId, sig]
  );

  useEffect(() => {
    if (!viewport.w) return;
    const fitAll = Math.min(1, (viewport.w - 8) / W, (viewport.h - 8) / H);
    minS.value = Math.max(MIN_SCALE_FLOOR, Math.min(0.3, fitAll * 0.9));
  }, [W, H, viewport.w, viewport.h]);

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
    const next = clamp(prev * e.scaleChange, minS.value, 2.4);
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
      { translateX: -W / 2 },
      { translateY: -H / 2 },
      { scale: s.value },
      { translateX: W / 2 },
      { translateY: H / 2 },
    ],
  }));

  return (
    <View
      style={styles.viewport}
      onLayout={(e) => setViewport({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
    >
      <GestureDetector gesture={gesture}>
        <View style={StyleSheet.absoluteFill} collapsable={false}>
          <Animated.View style={[{ width: W, height: H }, canvasStyle]}>
            <Edges boxes={layout.boxes} />

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
