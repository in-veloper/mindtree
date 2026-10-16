import React from 'react';
import { View, Text, Pressable, StyleSheet, Modal, ScrollView } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';

import { colors, font, shadow, STATUS, themedStyles } from './theme';

const ICONS = {
  back: 'M15 5 L8 12 L15 19',
  plus: 'M12 5 V19 M5 12 H19',
  close: 'M6 6 L18 18 M18 6 L6 18',
  check: 'M5 12.5 L10 17 L19 7',
  chevronRight: 'M9 5 L16 12 L9 19',
  chevronDown: 'M5 9 L12 16 L19 9',
  more: 'M5 12 h.01 M12 12 h.01 M19 12 h.01',
  map: 'M4 12 H9 M9 12 C 12 12 12 6 15 6 H20 M9 12 C 12 12 12 18 15 18 H20',
  list: 'M5 6 H19 M8 12 H19 M8 18 H19',
  target: 'M12 3 V6 M12 18 V21 M3 12 H6 M18 12 H21',
  refresh: 'M19 12 A7 7 0 1 1 16.9 7 M19 4 V8 H15',
  edit: 'M5 19 H9 L19 9 L15 5 L5 15 Z',
  // 목차 편집: 목차 줄 세 개 + 오른쪽 아래 작은 펜
  editOutline: 'M4 6.5 H15 M4 11.5 H11.5 M4 16.5 H8.5 M13 19.5 L13.4 17.2 L18.6 12 L20.6 14 L15.4 19.2 Z',
  trash: 'M5 7 H19 M10 7 V5 H14 V7 M7 7 L8 19 H16 L17 7',
  moon: 'M20 14.5 A8 8 0 1 1 9.5 4 A6.5 6.5 0 0 0 20 14.5 Z',
  sun: 'M12 2.5 V4.5 M12 19.5 V21.5 M2.5 12 H4.5 M19.5 12 H21.5 M5.3 5.3 L6.7 6.7 M17.3 17.3 L18.7 18.7 M5.3 18.7 L6.7 17.3 M17.3 6.7 L18.7 5.3',
};

export function Icon({ name, size = 22, color = colors.ink, stroke = 2 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d={ICONS[name]}
        stroke={color}
        strokeWidth={name === 'more' ? 3.2 : stroke}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {(name === 'target' || name === 'sun') && (
        <Circle cx="12" cy="12" r={name === 'sun' ? 4.2 : 5} stroke={color} strokeWidth={stroke} fill="none" />
      )}
    </Svg>
  );
}

export function Header({ title, subtitle, onBack, right }) {
  return (
    <View style={styles.header}>
      {onBack ? (
        <Pressable onPress={onBack} hitSlop={12} style={styles.headerBtn}>
          <Icon name="back" size={24} />
        </Pressable>
      ) : (
        <View style={styles.headerBtn} />
      )}
      <View style={styles.headerCenter}>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.headerSub} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <View style={[styles.headerBtn, { alignItems: 'flex-end' }]}>{right}</View>
    </View>
  );
}

export function Button({ title, onPress, kind = 'primary', disabled, style, icon }) {
  const k = buttonLook(kind);
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.btn,
        k.box,
        disabled && { opacity: 0.35 },
        pressed && { transform: [{ scale: 0.98 }], opacity: 0.9 },
        style,
      ]}
    >
      {icon ? <Icon name={icon} size={18} color={k.text.color} /> : null}
      <Text style={[styles.btnText, k.text]}>{title}</Text>
    </Pressable>
  );
}

const buttonLook = (kind) => ({
  primary: { box: { backgroundColor: colors.ink }, text: { color: colors.onInk } },
  accent: { box: { backgroundColor: colors.accent }, text: { color: '#fff' } },
  soft: { box: { backgroundColor: colors.surfaceAlt }, text: { color: colors.ink } },
  ghost: { box: { backgroundColor: 'transparent' }, text: { color: colors.inkSoft } },
})[kind];

export function Chip({ label, active, onPress, color = colors.accent }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={4}
      style={[styles.chip, active && { backgroundColor: color, borderColor: color }]}
    >
      <Text style={[styles.chipText, active && { color: '#fff' }]}>{label}</Text>
    </Pressable>
  );
}

export function Card({ children, style, onPress, onLongPress }) {
  if (onPress || onLongPress) {
    return (
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        style={({ pressed }) => [styles.card, pressed && { transform: [{ scale: 0.99 }] }, style]}
      >
        {children}
      </Pressable>
    );
  }
  return <View style={[styles.card, style]}>{children}</View>;
}

export function StatusDot({ status, size = 9 }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: STATUS[status || 'none'].color,
      }}
    />
  );
}

export function Bar({ pct, color = colors.accent, height = 6, track = colors.surfaceAlt }) {
  return (
    <View style={{ height, borderRadius: height / 2, backgroundColor: track, overflow: 'hidden' }}>
      <View
        style={{
          width: `${Math.max(0, Math.min(100, pct))}%`,
          height: '100%',
          borderRadius: height / 2,
          backgroundColor: color,
        }}
      />
    </View>
  );
}

export function Ring({ pct, size = 120, stroke = 10, color = colors.accent, children }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.surfaceAlt} strokeWidth={stroke} fill="none" />
        {pct > 0 && (
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={color}
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${(c * Math.min(100, pct)) / 100} ${c}`}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        )}
      </Svg>
      <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
        {children}
      </View>
    </View>
  );
}

export function statusColorOfPct(pct, studied = true) {
  if (!studied) return colors.none;
  if (pct >= 85) return colors.good;
  if (pct >= 50) return colors.mid;
  return colors.bad;
}

export function Segmented({ items, value, onChange }) {
  return (
    <View style={styles.segment}>
      {items.map((it) => {
        const active = it.key === value;
        return (
          <Pressable
            key={it.key}
            onPress={() => onChange(it.key)}
            style={[styles.segItem, active && styles.segItemActive]}
          >
            <Text style={[styles.segText, active && styles.segTextActive]}>{it.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Sheet({ visible, onClose, title, children }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.sheetWrap}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.sheetGrip} />
          {title ? <Text style={styles.sheetTitle}>{title}</Text> : null}
          <ScrollView style={{ maxHeight: 520 }} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export function Empty({ title, sub }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>{title}</Text>
      {sub ? <Text style={styles.emptySub}>{sub}</Text> : null}
    </View>
  );
}

const styles = themedStyles(() => ({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 6,
    paddingBottom: 8,
  },
  headerBtn: { width: 44, height: 40, justifyContent: 'center', paddingHorizontal: 6 },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontFamily: font.bold, fontSize: 17, color: colors.ink },
  headerSub: { fontFamily: font.regular, fontSize: 12, color: colors.inkFaint, marginTop: 1 },
  btn: {
    height: 52,
    borderRadius: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  btnText: { fontFamily: font.semibold, fontSize: 15.5 },
  chip: {
    paddingHorizontal: 13,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    justifyContent: 'center',
  },
  chipText: { fontFamily: font.semibold, fontSize: 13, color: colors.inkSoft },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 18,
    ...shadow,
  },
  segment: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceAlt,
    borderRadius: 14,
    padding: 4,
  },
  segItem: { flex: 1, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  segItemActive: { backgroundColor: colors.surface, ...shadow, shadowOpacity: 0.06 },
  segText: { fontFamily: font.semibold, fontSize: 14, color: colors.inkFaint },
  segTextActive: { color: colors.ink },
  sheetWrap: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.scrim },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 20,
    paddingBottom: 34,
    paddingTop: 10,
  },
  sheetGrip: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.line,
    marginBottom: 14,
  },
  sheetTitle: { fontFamily: font.bold, fontSize: 18, color: colors.ink, marginBottom: 12 },
  empty: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 24 },
  emptyTitle: { fontFamily: font.semibold, fontSize: 16, color: colors.ink, marginBottom: 6, textAlign: 'center' },
  emptySub: { fontFamily: font.regular, fontSize: 13.5, color: colors.inkFaint, textAlign: 'center', lineHeight: 20 },
}));
