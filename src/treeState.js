// 트리 탭에서 보던 화면(펼침/접힘, 확대·이동 위치, 목록 스크롤, 보기 방식)을 기억해 둔다.
// 암기·테스트 탭이나 학습 화면으로 갔다 오면 트리 화면이 새로 만들어져 전부 접힌 채로
// 돌아왔다 — 화면 컴포넌트 안의 상태는 화면이 사라질 때 같이 사라지기 때문이다.
// 앱이 떠 있는 동안만 기억하면 되므로 모듈 변수에 둔다.
//
// sig 는 목차의 모양(노드 개수)이다. 목차를 고치면 저장해 둔 위치가 더는 맞지 않으니 버린다.
const views = new Map();

export function getTreeView(subjectId, sig) {
  const v = views.get(subjectId);
  return v && v.sig === sig ? v : null;
}

export function saveTreeView(subjectId, sig, patch) {
  const v = views.get(subjectId);
  const base = v && v.sig === sig ? v : { sig };
  views.set(subjectId, { ...base, ...patch });
}
