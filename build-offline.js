const fs=require('fs'), path=require('path');
const dir=__dirname;
const prods=JSON.parse(fs.readFileSync(path.join(dir,'data/products.json'),'utf8'));
const json=JSON.stringify(prods);

for (const f of ['index.html','product.html']){
  let html=fs.readFileSync(path.join(dir,f),'utf8');
  html=html.replace('<script>const DATA=/*DATA*/;</script>','<script>const DATA='+json+';</script>');
  fs.writeFileSync(path.join(dir,'offline-'+f), html);
  console.log(f, html.length, html.indexOf('const DATA={')>=0);
}
