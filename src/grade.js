// 규칙 기반 채점. 띄어쓰기·번호·문장부호는 무시하고, 한쪽이 다른 쪽을 충분히 포함하거나
// 글자 차이가 작으면 "표현 차이"로 인정한다.
import { splitMarker, parseAnswer, descendants } from './parser';

const PUNCT = /[\s·.,\-–—_:;'"“”‘’「」『』()（）[\]{}<>〈〉《》/\\|!?~…]/g;

export function normalize(text) {
  return splitMarker(String(text || '')).title.replace(PUNCT, '').toLowerCase();
}

function levenshtein(a, b) {
  if (a === b) return 0;
  const prev = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length];
}

// parentTitle 을 주면, 정답이 "상위목차 + 의 + …" 꼴일 때 상위 이름을 뺀 부분만 써도 인정한다.
// 예) 취소소송 > "취소소송의 의의" 에 "의의" 라고 써도 정답.
export function similarity(input, expected, parentTitle) {
  const base = rawSimilarity(input, expected);
  if (!parentTitle || base >= 0.999) return base;
  const e = normalize(expected);
  const p = normalize(parentTitle);
  if (!p || !e.startsWith(p)) return base;
  const rest = e.slice(p.length).replace(/^의/, '');
  if (rest.length < 2) return base;
  return Math.max(base, rawSimilarity(input, rest));
}

function rawSimilarity(input, expected) {
  const a = normalize(input);
  const b = normalize(expected);
  if (!a || !b) return 0;
  if (a === b) return 1;
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  if (long.includes(short) && short.length >= 2 && short.length / long.length >= 0.5) return 0.88;
  return 1 - levenshtein(a, b) / Math.max(a.length, b.length);
}

export const NEAR = 0.74;

// 'exact' | 'near' | 'wrong'
export function judge(input, expected, parentTitle) {
  const s = similarity(input, expected, parentTitle);
  if (s >= 0.999) return 'exact';
  if (s >= NEAR) return 'near';
  return 'wrong';
}

// 순서와 상관없이 입력 목록과 정답 목록을 짝짓는다. 반환: 정답 순서대로 { input, verdict }
export function matchUnordered(inputs, expected, parentTitle) {
  const pairs = [];
  inputs.forEach((inp, i) => {
    if (!normalize(inp)) return;
    expected.forEach((exp, j) => {
      const s = similarity(inp, exp, parentTitle);
      if (s >= NEAR) pairs.push({ i, j, s });
    });
  });
  pairs.sort((x, y) => y.s - x.s);
  const usedI = new Set();
  const result = expected.map(() => ({ input: null, verdict: 'missing' }));
  pairs.forEach(({ i, j, s }) => {
    if (usedI.has(i) || result[j].input !== null) return;
    usedI.add(i);
    result[j] = { input: inputs[i], verdict: s >= 0.999 ? 'exact' : 'near' };
  });
  const extras = inputs.filter((inp, i) => normalize(inp) && !usedI.has(i));
  return { result, extras };
}

// 가장 긴 증가 부분수열에 들어간 위치들(순서가 맞는 것으로 본다)
function lisKeep(seq) {
  const n = seq.length;
  if (!n) return new Set();
  const len = new Array(n).fill(1);
  const prev = new Array(n).fill(-1);
  let best = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < i; j++) {
      if (seq[j] < seq[i] && len[j] + 1 > len[i]) {
        len[i] = len[j] + 1;
        prev[i] = j;
      }
    }
    if (len[i] > len[best]) best = i;
  }
  const keep = new Set();
  for (let k = best; k >= 0; k = prev[k]) keep.add(k);
  return keep;
}

export const VERDICT_SCORE = { exact: 1, near: 0.9, order: 0.5, level: 0.5, missing: 0 };

// 전체 현출 채점. scope 아래 limit 깊이까지를 정답으로, 사용자가 쓴 텍스트와 비교한다.
// 반환: { items: [{ node, depth, verdict, input }], extras: [텍스트], score(0~1), counts }
export function gradeRecall(text, scope, limit = Infinity) {
  const expected = descendants(scope, limit);
  const parentTitleOf = (e) => (e.parent === null ? scope.title : expected[e.parent].node.title);
  let { lines, hasHierarchy } = parseAnswer(text);

  // 사용자가 맨 위에 과목/범위 제목을 다시 적었으면 걷어낸다.
  const tops = lines.filter((l) => l.parent === null);
  if (tops.length === 1 && lines.length > 1 && similarity(tops[0].title, scope.title) >= NEAR) {
    const rootIdx = lines.indexOf(tops[0]);
    lines = lines
      .map((l, i) => ({ ...l, orig: i }))
      .filter((_, i) => i !== rootIdx)
      .map((l) => ({ ...l, parent: l.parent === rootIdx ? null : l.parent }));
    const remap = {};
    lines.forEach((l, i) => (remap[l.orig] = i));
    lines = lines.map((l) => ({ title: l.title, parent: l.parent === null ? null : remap[l.parent] }));
    hasHierarchy = lines.some((l) => l.parent !== null);
  }

  // 유사도 높은 쌍부터, 같은 점수면 순서가 가까운 쌍부터 짝짓는다.
  const pairs = [];
  lines.forEach((l, u) => {
    expected.forEach((e, k) => {
      const s = similarity(l.title, e.node.title, parentTitleOf(e));
      if (s >= NEAR) {
        const dist = Math.abs(u / Math.max(1, lines.length) - k / Math.max(1, expected.length));
        pairs.push({ u, k, s, dist });
      }
    });
  });
  pairs.sort((a, b) => b.s - a.s || a.dist - b.dist);

  const matchE = new Array(expected.length).fill(-1);
  const usedU = new Set();
  pairs.forEach(({ u, k }) => {
    if (matchE[k] !== -1 || usedU.has(u)) return;
    matchE[k] = u;
    usedU.add(u);
  });

  // 순서: 정답 순서대로 놓았을 때 사용자 줄 번호가 증가하지 않는 것은 순서 오류
  const matchedKs = expected.map((_, k) => k).filter((k) => matchE[k] !== -1);
  const keep = lisKeep(matchedKs.map((k) => matchE[k]));
  const orderBad = new Set(matchedKs.filter((_, i) => !keep.has(i)));

  const items = expected.map((e, k) => {
    const u = matchE[k];
    if (u === -1) return { node: e.node, depth: e.depth, verdict: 'missing', input: null };
    const input = lines[u].title;
    const exact = similarity(input, e.node.title, parentTitleOf(e)) >= 0.999;
    let verdict = exact ? 'exact' : 'near';
    if (orderBad.has(k)) verdict = 'order';
    else if (hasHierarchy) {
      const expectedParentU = e.parent === null ? null : matchE[e.parent];
      const parentKnown = e.parent === null || matchE[e.parent] !== -1;
      if (parentKnown && lines[u].parent !== expectedParentU) verdict = 'level';
    }
    return { node: e.node, depth: e.depth, verdict, input };
  });

  const extras = lines.filter((_, u) => !usedU.has(u)).map((l) => l.title);
  const counts = { exact: 0, near: 0, order: 0, level: 0, missing: 0 };
  items.forEach((it) => (counts[it.verdict] += 1));
  const score = items.length
    ? items.reduce((acc, it) => acc + VERDICT_SCORE[it.verdict], 0) / items.length
    : 0;

  return { items, extras, score, counts };
}
