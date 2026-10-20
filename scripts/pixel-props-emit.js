// Inline-SVG export of rendered pixel grids into the canvas boards.
const fs = require('fs'), path = require('path');
module.exports = function emit({ GR, GLAZE, LEAF, POT }, DC) {
  function fillOf(cell, vars) {
    if (cell.col) return cell.col;
    const p = vars.get(cell.ramp);
    return p ? '{{' + p + cell.idx + '}}' : cell.ramp[cell.idx];
  }
  function paths(name, vars = new Map(), only = null) {
    const { W, H, cells } = GR[name], groups = new Map();
    for (let y = 0; y < H; y++) {
      let x = 0;
      while (x < W) {
        const c = cells[y * W + x];
        if (!c || (only && !only(x, y))) { x++; continue; }
        const k = fillOf(c, vars) + '|' + c.a;
        let n = 1;
        while (x + n < W) { const d = cells[y * W + x + n]; if (!d || (only && !only(x + n, y)) || fillOf(d, vars) + '|' + d.a !== k) break; n++; }
        if (!groups.has(k)) groups.set(k, []);
        groups.get(k).push('M' + x + ' ' + y + 'h' + n + 'v1h-' + n + 'z');
        x += n;
      }
    }
    let out = '';
    for (const [k, d] of groups) {
      const [f, a] = k.split('|');
      out += '<path fill="' + f + '"' + (a !== '1' ? ' fill-opacity="' + (+a).toFixed(2) + '"' : '') + ' d="' + d.join('') + '"></path>\n';
    }
    return out;
  }
  const differs = (a, b) => (x, y) => { const A = GR[a], B = GR[b], i = y * A.W + x, p = A.cells[i], q = B.cells[i]; return !!p && (!q || p.ramp !== q.ramp || p.idx !== q.idx || p.col !== q.col); };
  function svg(name, S, label, body, style) {
    const { W, H } = GR[name];
    return '<svg width="' + W * S + '" height="' + H * S + '" viewBox="0 0 ' + W + ' ' + H + '" shape-rendering="crispEdges" role="img" aria-label="' + label + '" style="' + style + '">\n' + body + '</svg>\n';
  }
  const head = (title) => '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<title>' + title + '</title>\n<script src="./support.js"></script>\n</head>\n<body>\n<x-dc>\n<helmet>\n<link href="https://fonts.googleapis.com/css2?family=VT323&amp;display=swap" rel="stylesheet">\n<style>\nbody{margin:0}\n</style>\n</helmet>\n';
  const table = (name, t) => 'const ' + name + ' = ' + JSON.stringify(t) + ';\n';
  const spread = (prefix, v) => '...Object.fromEntries(' + v + '.map((c, i) => [\'' + prefix + '\' + i, c]))';
  const wallJs = 'const wall = this.props.wallPreview ?? false;\n';
  const wallRet = 'wallOn: wall ? 1 : 0,\nbg: wall ? \'#6e3818\' : \'transparent\'\n';

  // mug
  const gv = new Map([[GLAZE.forest, 'g']]);
  const mugSvg = paths('mug-forest-plain', gv)
    + '<g opacity="{{emblemOn}}">\n' + paths('mug-forest', gv, differs('mug-forest', 'mug-forest-plain')) + '</g>\n'
    + '<g opacity="{{steamOn}}">\n' + paths('mug-steam') + '</g>\n';
  fs.writeFileSync(path.join(DC, 'Mug.dc.html'), head('Pixel coffee mug')
    + '<div style="position: relative; width: 560px; height: 560px; overflow: hidden; background: {{bg}}; font-family: \'VT323\', monospace">\n'
    + svg('mug-forest', 5, 'Pixel coffee mug', mugSvg, 'position: absolute; left: 140px; top: 120px')
    + '<div style="position: absolute; left: 24px; bottom: 14px; font-size: 22px; color: #f1e2c8; opacity: {{wallOn}}">mug · 56×64 px · shown ×5</div>\n</div>\n</x-dc>\n'
    + '<script type="text/x-dc" data-dc-script data-props=\'{"glaze":{"editor":"enum","options":["forest","ember","dusk","crt"],"default":"forest"},"steam":{"editor":"boolean","default":true},"emblem":{"editor":"boolean","default":true},"wallPreview":{"editor":"boolean","default":false},"$preview":{"width":560,"height":560}}\'>\n'
    + 'class Component extends DCLogic {\nrenderVals() {\n' + table('GT', GLAZE)
    + 'const g = GT[this.props.glaze ?? \'forest\'] || GT.forest;\n' + wallJs + 'return {\n' + spread('g', 'g') + ',\n'
    + 'emblemOn: (this.props.emblem ?? true) ? 1 : 0,\nsteamOn: (this.props.steam ?? true) ? 1 : 0,\n' + wallRet + '};\n}\n}\n</script>\n</body>\n</html>\n');

  // plant
  const pv = new Map([[LEAF.forest, 'l'], [POT.terracotta, 'p']]);
  const plantSvg = paths('plant-forest-terracotta', pv)
    + '<g opacity="{{catOn}}">\n' + paths('plant-forest-terracotta-cat', pv, differs('plant-forest-terracotta-cat', 'plant-forest-terracotta')) + '</g>\n';
  fs.writeFileSync(path.join(DC, 'Plant.dc.html'), head('Pixel plant')
    + '<div style="position: relative; width: 560px; height: 560px; overflow: hidden; background: {{bg}}; font-family: \'VT323\', monospace">\n'
    + svg('plant-forest-terracotta', 5, 'Pixel potted plant', plantSvg, 'position: absolute; left: 100px; top: 40px')
    + '<div style="position: absolute; left: 24px; bottom: 14px; font-size: 22px; color: #f1e2c8; opacity: {{wallOn}}">plant · 72×84 px · shown ×5</div>\n</div>\n</x-dc>\n'
    + '<script type="text/x-dc" data-dc-script data-props=\'{"foliage":{"editor":"enum","options":["forest","sunlit","crt"],"default":"forest"},"pot":{"editor":"enum","options":["terracotta","forest","cream"],"default":"terracotta"},"catFace":{"editor":"boolean","default":false},"wallPreview":{"editor":"boolean","default":false},"$preview":{"width":560,"height":560}}\'>\n'
    + 'class Component extends DCLogic {\nrenderVals() {\n' + table('LT', LEAF) + table('PT', POT)
    + 'const l = LT[this.props.foliage ?? \'forest\'] || LT.forest;\nconst p = PT[this.props.pot ?? \'terracotta\'] || PT.terracotta;\n' + wallJs + 'return {\n'
    + spread('l', 'l') + ',\n' + spread('p', 'p') + ',\ncatOn: (this.props.catFace ?? false) ? 1 : 0,\n' + wallRet + '};\n}\n}\n</script>\n</body>\n</html>\n');

  // books and notes: keep the hand-placed text overlays, swap the <img>s for inline SVG
  const wallProps = (s) => s
    .replace('background: transparent; font-family', 'background: {{bg}}; font-family')
    .replace('"backdrop":{"editor":"boolean","default":true}', '"wallPreview":{"editor":"boolean","default":false}')
    .replace('backdrop: (this.props.backdrop ?? true) ? 1 : 0', 'backdrop: (this.props.wallPreview ?? false) ? 1 : 0,\nbg: (this.props.wallPreview ?? false) ? \'#6e3818\' : \'transparent\'');
  let books = fs.readFileSync(path.join(DC, 'Books.dc.html'), 'utf8');
  books = wallProps(books.replace(/<img src="assets\/new\/bd-desk-800.png"[^>]*>\n/, '')
    .replace(/<img src="assets\/new\/books-stack.png"[^>]*>\n/, () => svg('books-stack', 5, 'Stack of four pixel books', paths('books-stack'), 'position: absolute; left: 24px; top: 210px'))
    .replace(/<img src="assets\/new\/books-shelf.png"[^>]*>\n/, () => svg('books-shelf', 5, 'Row of five standing pixel books', paths('books-shelf'), 'position: absolute; left: 456px; top: 95px'))
    .replace('books-stack.png 96×52 · books-shelf.png 64×76', 'books stack 96×52 · shelf 64×76'));
  fs.writeFileSync(path.join(DC, 'Books.dc.html'), books);

  let notes = fs.readFileSync(path.join(DC, 'Notes.dc.html'), 'utf8').replace(/<img src="assets\/new\/bd-wall.png"[^>]*>\n/, '');
  for (let i = 1; i <= 7; i++) notes = notes.replace(new RegExp('<img src="assets/new/note-' + i + '.png" alt="([^"]*)"[^>]*>\\n'), (m, alt) => svg('note-' + i, 4, alt, paths('note-' + i), 'display: block'));
  notes = wallProps(notes.replace('note-1…7.png · 52×54 px', 'notes · 52×54 px'));
  fs.writeFileSync(path.join(DC, 'Notes.dc.html'), notes);
};
