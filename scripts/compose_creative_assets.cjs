// App Store header and search artwork using the existing icon and real sample UI.
const fs = require('node:fs/promises');
const path = require('node:path');
const sharp = require('sharp');
const { createHash } = require('node:crypto');
const root = path.resolve(__dirname, '..');
const out = path.join(root, 'AppStoreAssets/Storefront-v2.1/Creative');
const font = "'Yu Gothic', 'Hiragino Sans', sans-serif";
const svg = (w,h,body) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`);
const text = (x,y,s,size,color='#38271f',weight=700) => `<text x="${x}" y="${y}" font-family="${font}" font-size="${size}" font-weight="${weight}" fill="${color}">${s}</text>`;
function background(w,h) {
  let b = `<defs><linearGradient id="bg" x2="1" y2="1"><stop stop-color="#fbf6ed"/><stop offset="1" stop-color="#e8ddce"/></linearGradient></defs><rect width="${w}" height="${h}" fill="url(#bg)"/>`;
  // Large calendar-like rhythm is decorative; all factual UI is a captured sample.
  for (let y=-250; y<h+250; y+=390) for(let x=-150;x<w+250;x+=570) {
    const colors=['#b8825b','#829587','#bd8385'];
    b += `<rect x="${x}" y="${y}" width="490" height="300" rx="38" fill="${colors[(Math.round((x+150)/570)+Math.round((y+250)/390))%3]}" opacity=".065"/>`;
  }
  b += `<circle cx="${w*.13}" cy="${h*.83}" r="${h*.49}" fill="#829587" opacity=".08"/><circle cx="${w*.91}" cy="${h*.19}" r="${h*.56}" fill="#bd8385" opacity=".06"/>`;
  return b;
}
(async()=>{
  await fs.mkdir(out,{recursive:true});
  const iconPath=path.join(root,'extension/icons/icon.svg');
  const icon=await sharp(iconPath).resize(250,250).png().toBuffer();
  let body=background(3840,1646);
  // Focal content kept centered for the product header's compact crop.
  body += `<rect x="1120" y="620" width="1600" height="430" rx="78" fill="#fffaf2" opacity=".7"/>`;
  body += text(1515,795,'WasePlus',126);
  body += text(1519,875,'時間割とログイン',51,'#76695d',600);
  body += text(1519,953,'いつものSafariに，プラス。',44,'#76695d',500);
  await sharp(svg(3840,1646,body)).composite([{input:icon,left:1204,top:706}]).flatten({background:'#f7f2e8'}).removeAlpha().png().toFile(path.join(out,'WasePlus-header.png'));

  const source=path.join(root,'AppStoreAssets/Storefront-v2.1/Sources/iPad-13/02-timetable-sample.png');
  // Crop only the actual term selector and timetable. No UI is fabricated.
  const ui=await sharp(source).extract({left:28,top:520,width:1998,height:1340}).resize(1160).png().toBuffer();
  const uiMeta=await sharp(ui).metadata();
  body=background(3840,2560);
  body += `<rect x="735" y="770" width="2370" height="1020" rx="82" fill="#fffbf5" opacity=".9"/>`;
  body += text(880,1040,'WasePlus',82);
  body += text(880,1180,'いつものMoodleに，',59);
  body += text(880,1270,'見やすい時間割を。',67);
  body += text(884,1400,'時間割とログインを整える',39,'#76695d',500);
  body += text(884,1464,'非公式Safari機能拡張',39,'#76695d',500);
  body += text(884,1600,'シラバスから曜日・時限・教室を取得',30,'#76695d',500);
  body += `<rect x="1804" y="830" width="1216" height="${uiMeta.height+56}" rx="36" fill="#d7cabc"/><rect x="1812" y="838" width="1200" height="${uiMeta.height+40}" rx="32" fill="#fffaf2"/>`;
  body += text(1838,1694,'アプリ内の架空サンプル画面',28,'#76695d',500);
  await sharp(svg(3840,2560,body)).composite([{input:ui,left:1832,top:858}]).flatten({background:'#f7f2e8'}).removeAlpha().png().toFile(path.join(out,'WasePlus-search.png'));
  const assets=[];
  for(const name of ['WasePlus-header.png','WasePlus-search.png']) {
    const file=path.join(out,name), data=await fs.readFile(file), meta=await sharp(data).metadata();
    if(meta.hasAlpha) throw new Error('Creative asset must be opaque');
    assets.push({file:name,width:meta.width,height:meta.height,hasAlpha:meta.hasAlpha,sha256:createHash('sha256').update(data).digest('hex')});
    await sharp(data).resize(1440).png().toFile(path.join(out,name.replace('.png','-overview.png')));
  }
  await fs.writeFile(path.join(out,'creative-report.json'),JSON.stringify({assets,source:path.relative(root,source).replaceAll('\\','/'),notes:'Static artwork. Existing icon unchanged. Search image includes only a crop of actual fictional sample UI. No video.'},null,2)+'\n');
  console.log(JSON.stringify(assets));
})();
