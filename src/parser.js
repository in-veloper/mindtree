// 붙여넣은 목차 텍스트를 트리로 바꾼다.
// 번호 체계(제N편/장/절, Ⅰ., 1., 1), (1), 가., ① …)와 들여쓰기를 함께 본다.
// 번호 종류의 상하 관계는 "문서에 처음 나온 순서"로 정한다 — 한국 교재 목차는 대부분
// 큰 단위가 먼저 나오기 때문에, PDF에서 복사해 들여쓰기가 날아가도 계층이 살아난다.

const KOR = '가나다라마바사아자차카타파하';
const ROMAN = 'ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩⅪⅫ';

const MARKERS = [
  { type: 'pyeon', re: /^제\s*\d+\s*편(?=\s|$|\.)\.?\s*/ },
  { type: 'jang', re: /^제\s*\d+\s*장(?=\s|$|\.)\.?\s*/ },
  { type: 'jeol', re: /^제\s*\d+\s*절(?=\s|$|\.)\.?\s*/ },
  { type: 'gwan', re: /^제\s*\d+\s*관(?=\s|$|\.)\.?\s*/ },
  { type: 'hang', re: /^제\s*\d+\s*항(?=\s|$|\.)\.?\s*/ },
  { type: 'roman', re: new RegExp(`^(?:[${ROMAN}]+|[IVX]+)\\s*[.)]\\s*`) },
  { type: 'num', re: /^\d+\s*\.(?!\d)\s*/ },
  { type: 'numParen', re: /^\d+\s*\)\s*/ },
  { type: 'pnum', re: /^[(（]\s*\d+\s*[)）]\s*/ },
  { type: 'kor', re: new RegExp(`^[${KOR}]\\s*\\.\\s*`) },
  { type: 'korParen', re: new RegExp(`^[${KOR}]\\s*\\)\\s*`) },
  { type: 'pkor', re: new RegExp(`^[(（]\\s*[${KOR}]\\s*[)）]\\s*`) },
  { type: 'circle', re: /^[①-⑳]\s*/ },
  { type: 'alpha', re: /^[a-z]\s*[.)]\s*/ },
  { type: 'bullet', re: /^[-•·*▪◦○●□■▶►→ㆍ]\s*/ },
];

let counter = 0;
export function uid() {
  counter += 1;
  return `${Date.now().toString(36)}${counter.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

function measureIndent(raw) {
  let n = 0;
  for (const ch of raw) {
    if (ch === ' ') n += 1;
    else if (ch === '\t') n += 4;
    else if (ch === '　') n += 2;
    else break;
  }
  return n;
}

export function splitMarker(text) {
  const t = text.trim();
  for (const m of MARKERS) {
    const hit = t.match(m.re);
    if (hit) {
      const rest = t.slice(hit[0].length).trim();
      return { type: m.type, marker: hit[0].trim(), title: rest || hit[0].trim() };
    }
  }
  return { type: null, marker: '', title: t };
}

// 텍스트 → [{indent, type, marker, title}]
function readLines(text) {
  return text
    .split(/\r?\n/)
    .map((raw) => ({ raw, body: raw.trim() }))
    .filter((l) => l.body.length > 0)
    .map((l) => ({ indent: measureIndent(l.raw), ...splitMarker(l.body) }));
}

// 텍스트 → 루트 아래 자식 노드 배열. 각 노드 { id, title, marker, children }
export function parseOutline(text) {
  const lines = readLines(text);
  const rankOf = {};
  let nextRank = 0;
  lines.forEach((l) => {
    if (l.type && rankOf[l.type] === undefined) rankOf[l.type] = nextRank++;
  });

  const top = [];
  const stack = []; // { indent, type, rank, node }

  for (const line of lines) {
    const rank = line.type ? rankOf[line.type] : null;

    // 같은 번호 종류가 이미 위에 열려 있고 더 깊게 들여쓰지 않았으면 그 형제다.
    let j = -1;
    if (line.type) {
      for (let k = stack.length - 1; k >= 0; k--) {
        if (stack[k].type === line.type) {
          j = k;
          break;
        }
      }
    }
    if (j >= 0 && stack[j].indent >= line.indent) {
      stack.length = j;
    } else {
      while (stack.length) {
        const t = stack[stack.length - 1];
        if (line.indent > t.indent) break;
        if (line.indent === t.indent && rank !== null && t.rank !== null && rank > t.rank) break;
        stack.pop();
      }
    }

    const node = { id: uid(), title: line.title, marker: line.marker, children: [] };
    const parent = stack.length ? stack[stack.length - 1].node : null;
    if (parent) parent.children.push(node);
    else top.push(node);
    stack.push({ indent: line.indent, type: line.type, rank, node });
  }

  return top;
}

// 사용자가 쓴 답안을 줄 단위로 읽는다. 들여쓰기/번호로 계층도 같이 추정한다.
// 반환: [{ title, parent: 줄 index | null }], hasHierarchy
export function parseAnswer(text) {
  const tree = parseOutline(text);
  const out = [];
  const walk = (nodes, parent) => {
    nodes.forEach((n) => {
      const idx = out.length;
      out.push({ title: n.title, parent });
      walk(n.children, idx);
    });
  };
  walk(tree, null);
  return { lines: out, hasHierarchy: out.some((l) => l.parent !== null) };
}

/* ---------- 트리 유틸 ---------- */

// 미리보기용: 노드 배열 → 들여쓴 줄 목록
export function flattenNodes(nodes, depth = 1, out = []) {
  nodes.forEach((n) => {
    out.push({ node: n, depth });
    flattenNodes(n.children, depth + 1, out);
  });
  return out;
}

// 루트 기준 전체 색인: id → { node, parent, depth, index(형제 중 순서) }
export function indexTree(root) {
  const map = {};
  const walk = (node, parent, depth, index) => {
    map[node.id] = { node, parent, depth, index };
    node.children.forEach((c, i) => walk(c, node, depth + 1, i));
  };
  walk(root, null, 0, 0);
  return map;
}

export function pathTo(index, id) {
  const path = [];
  let cur = index[id];
  while (cur) {
    path.unshift(cur.node);
    cur = cur.parent ? index[cur.parent.id] : null;
  }
  return path;
}

export function countNodes(root) {
  let n = 0;
  const walk = (node) => {
    node.children.forEach((c) => {
      n += 1;
      walk(c);
    });
  };
  walk(root);
  return n;
}

export function maxDepth(root) {
  let d = 0;
  const walk = (node, depth) => {
    d = Math.max(d, depth);
    node.children.forEach((c) => walk(c, depth + 1));
  };
  walk(root, 0);
  return d;
}

// 노드 하위 목차를 pre-order 로, scope 기준 상대 깊이(1부터)와 함께. limit 깊이까지만.
export function descendants(scope, limit = Infinity) {
  const out = [];
  const walk = (node, depth, parentIdx) => {
    if (depth > limit) return;
    const idx = out.length;
    out.push({ node, depth, parent: parentIdx });
    node.children.forEach((c) => walk(c, depth + 1, idx));
  };
  scope.children.forEach((c) => walk(c, 1, null));
  return out;
}

// 다시 파싱할 때 같은 경로의 목차는 예전 id 를 이어받아 숙련도 기록을 유지한다.
export function carryIds(oldRoot, newChildren, normalize) {
  const byPath = {};
  const walkOld = (node, prefix) => {
    node.children.forEach((c) => {
      const key = `${prefix}/${normalize(c.title)}`;
      if (!byPath[key]) byPath[key] = c.id;
      walkOld(c, key);
    });
  };
  if (oldRoot) walkOld(oldRoot, '');

  const walkNew = (nodes, prefix) => {
    nodes.forEach((n) => {
      const key = `${prefix}/${normalize(n.title)}`;
      if (byPath[key]) n.id = byPath[key];
      walkNew(n.children, key);
    });
  };
  walkNew(newChildren, '');
  return newChildren;
}
