#!/usr/bin/env node

/**
 * GoodPets Static Style Checker
 *
 * Verifies that application source code in `src/` does not introduce
 * unauthorized hard-coded colors, arbitrary Tailwind color brackets, or inline styles.
 *
 * Excluded: `task 01 design system/`, `node_modules/`, `.next/`, `scripts/`.
 */

const fs = require('fs');
const path = require('path');

const SRC_DIR = path.resolve(__dirname, '../src');

// Regex rules for unauthorized visual values in application code
const RULES = [
  {
    name: 'Hexadecimal Color Literal',
    pattern: /#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/g,
  },
  {
    name: 'Functional Color Literal (rgb/rgba/hsl/hsla)',
    pattern: /\b(?:rgb|rgba|hsl|hsla)\s*\(/g,
  },
  {
    name: 'Arbitrary Tailwind Color Class',
    pattern: /\b(?:bg|text|border|fill|stroke)-\[#(?:[0-9a-fA-F]{3,8})\]/g,
  },
  {
    name: 'Inline Style Prop',
    pattern: /style=\{\{[^}]*\}\}/g,
  },
];

function scanDirectory(dir) {
  let violations = [];
  if (!fs.existsSync(dir)) return violations;

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      violations = violations.concat(scanDirectory(fullPath));
    } else if (entry.isFile() && /\.(tsx|ts|jsx|js|css)$/.test(entry.name)) {
      const content = fs.readFileSync(fullPath, 'utf8');
      const lines = content.split('\n');

      lines.forEach((line, index) => {
        // Skip comment lines in CSS / JS
        const trimmed = line.trim();
        if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
          return;
        }

        for (const rule of RULES) {
          const matches = line.match(rule.pattern);
          if (matches) {
            violations.push({
              file: path.relative(path.resolve(__dirname, '..'), fullPath),
              line: index + 1,
              rule: rule.name,
              content: trimmed,
              matches,
            });
          }
        }
      });
    }
  }

  return violations;
}

console.log('----------------------------------------------------');
console.log('GoodPets Static Style Checker');
console.log('Scanning directory: src/');
console.log('----------------------------------------------------');

const violations = scanDirectory(SRC_DIR);

if (violations.length === 0) {
  console.log('[PASS] Zero unauthorized hard-coded colors or inline styles found in src/.');
  process.exit(0);
} else {
  console.error(`[FAIL] Found ${violations.length} styling violation(s):\n`);
  violations.forEach(v => {
    console.error(`  - ${v.file}:${v.line} [${v.rule}]`);
    console.error(`    Line: "${v.content}"`);
  });
  process.exit(1);
}
