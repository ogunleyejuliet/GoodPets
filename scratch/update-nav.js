const fs = require('fs');

let content = fs.readFileSync('src/app/LandingContent.tsx', 'utf8');

// Normalize line endings to find safely
const isCRLF = content.includes('\r\n');
const eol = isCRLF ? '\r\n' : '\n';

const oldDesktop = [
  '              <Link',
  '                href="/book"',
  '                className="type-label-large text-primary hover:text-on-primary-container px-5 py-2.5 rounded-full transition-colors cursor-pointer"',
  '              >',
  '                Sign In',
  '              </Link>'
].join(eol);

const newDesktop = [
  '              <Link',
  '                href="/login"',
  '                className="type-label-large text-primary hover:text-on-primary-container px-4 py-2.5 rounded-full transition-colors cursor-pointer"',
  '              >',
  '                Sign In',
  '              </Link>',
  '              <Link',
  '                href="/signup"',
  '                className="type-label-large text-on-surface hover:text-primary px-4 py-2.5 rounded-full border border-outline-variant hover:border-outline transition-colors cursor-pointer"',
  '              >',
  '                Create Account',
  '              </Link>'
].join(eol);

const oldMobile = [
  '              <Link',
  '                href="/book"',
  '                onClick={() => setMobileMenuOpen(false)}',
  '                className="type-label-large w-full text-center py-3 text-primary border border-outline rounded-full hover:bg-surface-container-low transition-colors cursor-pointer"',
  '              >',
  '                Sign In',
  '              </Link>'
].join(eol);

const newMobile = [
  '              <Link',
  '                href="/login"',
  '                onClick={() => setMobileMenuOpen(false)}',
  '                className="type-label-large w-full text-center py-3 text-primary border border-outline rounded-full hover:bg-surface-container-low transition-colors cursor-pointer"',
  '              >',
  '                Sign In',
  '              </Link>',
  '              <Link',
  '                href="/signup"',
  '                onClick={() => setMobileMenuOpen(false)}',
  '                className="type-label-large w-full text-center py-3 text-on-surface border border-outline-variant rounded-full hover:bg-surface-container-low transition-colors cursor-pointer"',
  '              >',
  '                Create Account',
  '              </Link>'
].join(eol);

if (!content.includes(oldDesktop)) {
  console.error('Desktop target not found!');
  process.exit(1);
}
if (!content.includes(oldMobile)) {
  console.error('Mobile target not found!');
  process.exit(1);
}

content = content.replace(oldDesktop, newDesktop);
content = content.replace(oldMobile, newMobile);

fs.writeFileSync('src/app/LandingContent.tsx', content, 'utf8');
console.log('Successfully updated LandingContent.tsx header navigation!');

