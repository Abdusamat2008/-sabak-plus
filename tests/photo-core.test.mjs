import jpeg from 'jpeg-js';
import fs from 'fs'; import { analyse } from '../supabase/functions/verify-photo/core.js';
for (const f of fs.readdirSync('tests/img').filter(x=>x.endsWith('.jpg'))) {
  const im = jpeg.decode(fs.readFileSync('tests/img/'+f), {useTArray:true}); const r = analyse(im.data, im.width, im.height);
  console.log(f.padEnd(14), r.ok?'PASS':'FAIL', r.checks.map(c=>c.id+':'+c.detail).join(' '), r.failed.join(','));
}
