const fs = require('fs');
let content = fs.readFileSync('src/app/book/page.tsx', 'utf8');

const isCRLF = content.includes('\r\n');
const eol = isCRLF ? '\r\n' : '\n';

const oldBtn = [
  '                    <button',
  '                      type="button"',
  '                      onClick={() => alert(\'Password reset link will be sent to your email address per Flow 12.\')}',
  '                      className="text-xs font-semibold text-primary hover:underline"',
  '                    >',
  '                      Forgot password?',
  '                    </button>'
].join(eol);

const newLink = [
  '                    <Link',
  '                      href="/reset-password?returnUrl=/book"',
  '                      className="text-xs font-semibold text-primary hover:underline"',
  '                    >',
  '                      Forgot password?',
  '                    </Link>'
].join(eol);

if (!content.includes(oldBtn)) {
  console.error('Target button not found!');
  process.exit(1);
}

content = content.replace(oldBtn, newLink);
fs.writeFileSync('src/app/book/page.tsx', content, 'utf8');
console.log('Successfully updated book/page.tsx forgot password link!');

