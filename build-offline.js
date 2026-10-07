const fs = require('fs');
const path = require('path');
const dir = __dirname;
const prods = JSON.parse(fs.readFileSync(path.join(dir, 'data/products.json'), 'utf8'));
const json = JSON.stringify(prods);

let idx = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
let prod = fs.readFileSync(path.join(dir, 'product.html'), 'utf8');

// index: replace fetch with inline data
const idxFetch = "fetch('data/products.json').then(r=>r.json()).then(d=>{ ALL=d; renderCats(); render(); })";
const idxNew = "ALL=DATA.products; renderCats(); render();";
if (idx.indexOf(idxFetch) < 0) { console.error('index anchor not found'); process.exit(1); }
idx = idx.replace(idxFetch, idxNew);
idx = idx.replace('</script>', 'const DATA=' + json + ';\n</script>');
// hide the catch line (leave harmless)

// product: replace fetch with inline lookup
prod = prod.replace(/fetch\('data\/products\.json'\)\.then\(r=>r\.json\(\)\)\.then\(d=>\{/, 'const d=DATA;');
prod = prod.replace('</script>', 'const DATA=' + json + ';\n</script>');

fs.writeFileSync(path.join(dir, 'offline-index.html'), idx);
fs.writeFileSync(path.join(dir, 'offline-product.html'), prod);
console.log('index bytes:', idx.length, 'product bytes:', prod.length);
console.log('index has DATA:', idx.indexOf('const DATA={') >= 0);
console.log('product has DATA:', prod.indexOf('const DATA={') >= 0);
