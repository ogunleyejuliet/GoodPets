const fs = require('fs');
const path = require('path');

function search(dir) {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, f.name);
    if (f.isDirectory()) search(full);
    else if (/\.(ts|tsx)$/.test(f.name)) {
      const c = fs.readFileSync(full, 'utf8');
      const m = c.match(/method:\s*['"](PUT|PATCH|DELETE)['"]/i);
      if (m) console.log(full, m[0]);
    }
  }
}
search('src');
console.log('Search done');

