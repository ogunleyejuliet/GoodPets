const fs = require('fs');

// 1. Update LandingContent.tsx
let landing = fs.readFileSync('src/app/LandingContent.tsx', 'utf8');
landing = landing.replace('href="/login"', 'href="/auth?mode=login"');
landing = landing.replace('href="/signup"', 'href="/auth?mode=signup"');
landing = landing.replace('href="/login"', 'href="/auth?mode=login"');
landing = landing.replace('href="/signup"', 'href="/auth?mode=signup"');
fs.writeFileSync('src/app/LandingContent.tsx', landing, 'utf8');
console.log('Updated LandingContent.tsx navigation to /auth');

// 2. Update book/page.tsx
let book = fs.readFileSync('src/app/book/page.tsx', 'utf8');
book = book.replace('href="/reset-password?returnUrl=/book"', 'href="/auth?mode=reset&returnUrl=/book"');
fs.writeFileSync('src/app/book/page.tsx', book, 'utf8');
console.log('Updated book/page.tsx forgot password link to /auth?mode=reset');

