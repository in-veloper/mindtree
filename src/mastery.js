// 목차 하나의 숙련도 = 최근 결과(0~1)들의 가중 평균(최근일수록 무겁게).
// 상위 목차의 숙련도 = 자기 자신 + 하위 목차 전부의 평균(아직 안 한 목차는 0).

const HISTORY = 6;

export function pushResult(entry, value) {
  const h = [...((entry && entry.h) || []), Math.max(0, Math.min(1, value))].slice(-HISTORY);
  return { h, t: Date.now() };
}

export function nodeScore(entry) {
  const h = entry && entry.h;
  if (!h || !h.length) return null;
  let sum = 0;
  let w = 0;
  h.forEach((v, i) => {
    const weight = i + 1;
    sum += v * weight;
    w += weight;
  });
  return sum / w;
}

export function statusOf(pct, studied) {
  if (!studied) return 'none';
  if (pct >= 85) return 'good';
  if (pct >= 50) return 'mid';
  return 'bad';
}

// 루트 아래 모든 노드의 { pct, status, studied, own } 를 한 번에 계산한다.
export function computeMastery(root, mastery) {
  const out = {};
  const walk = (node, isRoot) => {
    const own = isRoot ? null : nodeScore(mastery[node.id]);
    let sum = own ?? 0;
    let count = isRoot ? 0 : 1;
    let studied = own !== null;
    node.children.forEach((c) => {
      const r = walk(c, false);
      sum += r.sum;
      count += r.count;
      studied = studied || r.studied;
    });
    const pct = count ? Math.round((sum / count) * 100) : 0;
    out[node.id] = { pct, status: statusOf(pct, studied), studied, own };
    return { sum, count, studied };
  };
  walk(root, true);
  return out;
}

// 약한 목차: 공부한 적 있는 목차 중 숙련도 낮은 순
export function weakNodes(root, computed, limit = 8) {
  const list = [];
  const walk = (node, depth) => {
    node.children.forEach((c) => {
      const m = computed[c.id];
      if (m && m.studied && m.pct < 70) list.push({ node: c, depth, pct: m.pct });
      walk(c, depth + 1);
    });
  };
  walk(root, 1);
  return list.sort((a, b) => a.pct - b.pct).slice(0, limit);
}
