// 마인트리 아이콘: 진한 초록 바탕 + 루트에서 뻗는 가지와 상태색 잎.
// 내용은 적응형 아이콘 안전영역(중심에서 반지름 ~300px/1024) 안에 둔다.
const path = require('path');
const sharp = require('C:/ClaudeCode_Project/studyplan/node_modules/sharp');

const ASSETS = path.join(__dirname, '..', 'assets');
const BG = '#17784F';

function tree({ mono = false } = {}) {
  const white = '#FFFFFF';
  const leaf = mono ? [white, white, white] : ['#FFD166', white, '#FF8A80'];
  const edge = (x1, y1, x2, y2, w) => {
    const mx = (x1 + x2) / 2;
    return `<path d="M${x1} ${y1} C${mx} ${y1} ${mx} ${y2} ${x2} ${y2}" stroke="${white}" stroke-width="${w}" fill="none" stroke-linecap="round" stroke-opacity="0.92"/>`;
  };
  return `
    ${edge(380, 512, 600, 380, 22)}
    ${edge(380, 512, 600, 512, 22)}
    ${edge(380, 512, 600, 644, 22)}
    ${edge(600, 380, 730, 330, 14)}
    ${edge(600, 380, 730, 432, 14)}
    ${edge(600, 512, 730, 540, 14)}
    <circle cx="380" cy="512" r="60" fill="${white}"/>
    <circle cx="600" cy="380" r="40" fill="${white}"/>
    <circle cx="600" cy="512" r="40" fill="${white}"/>
    <circle cx="600" cy="644" r="40" fill="${white}"/>
    <circle cx="730" cy="330" r="27" fill="${leaf[0]}"/>
    <circle cx="730" cy="432" r="27" fill="${leaf[1]}"/>
    <circle cx="730" cy="540" r="27" fill="${leaf[2]}"/>
  `;
}

const svg = (body, bg) =>
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">${
      bg ? `<rect width="1024" height="1024" fill="${bg}"/>` : ''
    }<g transform="translate(-40 0)">${body}</g></svg>`
  );

(async () => {
  await sharp(svg(tree(), null)).png().toFile(path.join(ASSETS, 'android-icon-foreground.png'));
  await sharp(svg(tree({ mono: true }), null)).png().toFile(path.join(ASSETS, 'android-icon-monochrome.png'));
  await sharp(svg('', BG)).png().toFile(path.join(ASSETS, 'android-icon-background.png'));
  // 일반 아이콘은 꽉 찬 사각형이라 조금 키워서
  const full = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024"><rect width="1024" height="1024" fill="${BG}"/><g transform="translate(512 512) scale(1.25) translate(-552 -512)">${tree()}</g></svg>`
  );
  await sharp(full).png().toFile(path.join(ASSETS, 'icon.png'));
  await sharp(full).resize(196).png().toFile(path.join(ASSETS, 'favicon.png'));
  const splash = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024"><g transform="translate(-40 0)">${tree().replace(/#FFFFFF/g, BG)}</g></svg>`
  );
  await sharp(splash).png().toFile(path.join(ASSETS, 'splash-icon.png'));
  console.log('done');
})();
