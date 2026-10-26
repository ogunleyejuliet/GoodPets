/**
 * GoodPets Design System - Token Converter (convert-tokens.js)
 *
 * Converts `design-tokens.json` into CSS Custom Properties (`design-tokens.css`)
 * according to the design system rules and Material Design 3 specifications.
 *
 * Rules:
 *  - Primitive tokens (raw colors & tonal palettes) are exported as `--primitive-*` variables.
 *  - Semantic color roles (light and dark) are exported as `--color-*` variables.
 *  - Semantic color roles reference the underlying primitive variables via `var(--primitive-...)`.
 *  - Effects / drop shadows are exported as composite `--effect-*` and `--shadow-*` variables.
 *  - Typography categories (display, headline, title, body, label) are exported as `--typography-*` variables
 *    along with composite font declarations and utility classes.
 *  - Automatically discovers and converts any dimension/unit tokens (spacing, sizing, borders, radii).
 *  - Zero hardcoded token values; single source of truth is `design-tokens.json`.
 *
 * Usage:
 *   node task-01-design-system/tokens/convert-tokens.js
 *   node convert-tokens.js (from within task-01-design-system/tokens/)
 *   node convert-tokens.js --input "path/to/tokens.json" --output "path/to/tokens.css"
 *   node convert-tokens.js --validate
 */

const fs = require('fs');
const path = require('path');

// CLI Argument parsing
const args = process.argv.slice(2);
function getArg(flag, defaultValue) {
  const idx = args.indexOf(flag);
  if (idx !== -1 && idx + 1 < args.length) {
    return args[idx + 1];
  }
  return defaultValue;
}
const isValidateOnly = args.includes('--validate');

// Locate input tokens JSON
const candidateInputs = [
  getArg('--input', null),
  path.resolve(__dirname, 'design-tokens.json'),
  path.resolve(__dirname, 'design tokens.json'),
  path.resolve(process.cwd(), 'task-01-design-system/tokens/design-tokens.json'),
  path.resolve(process.cwd(), 'task 01 design system/tokens/design tokens.json'),
  path.resolve(__dirname, 'tokens/design-tokens.json'),
  path.resolve(process.cwd(), 'design-tokens.json'),
  path.resolve(process.cwd(), 'design tokens.json'),
].filter(Boolean);

let inputPath = null;
for (const p of candidateInputs) {
  if (fs.existsSync(p)) {
    inputPath = p;
    break;
  }
}

if (!inputPath) {
  console.error('Error: Could not locate `design-tokens.json`. Looked at:');
  candidateInputs.forEach(p => console.error('  - ' + p));
  process.exit(1);
}

// Locate output paths
const customOutput = getArg('--output', null);
const outputPath = customOutput
  ? path.resolve(process.cwd(), customOutput)
  : path.resolve(__dirname, 'design-tokens.css');

// Helper: Kebab-case conversion safe across environments
function toKebab(str) {
  if (!str) return '';
  return String(str)
    .replace(/([a-z0-9])([A-Z])/g, (match, p1, p2) => p1 + '-' + p2)
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
}

// Helper: Deep resolve path in token tree (e.g. "primitives.color palettes.primary.primary40")
function getByPath(root, dotPath) {
  const parts = dotPath.split('.');
  let curr = root;
  for (const part of parts) {
    if (curr === undefined || curr === null || typeof curr !== 'object') return null;
    curr = curr[part];
  }
  return curr;
}

// Helper: Convert reference path to canonical CSS variable name
function refToCssVar(refString) {
  const clean = refString.replace(/^\{|\}$/g, '').trim();
  const parts = clean.split('.');

  // e.g. primitives.color palettes.primary.primary40 -> --primitive-color-palettes-primary-primary40
  const kebabParts = parts.map(p => toKebab(p));
  if (kebabParts[0] === 'primitives') {
    kebabParts[0] = 'primitive';
  }
  return '--' + kebabParts.join('-');
}

// Helper: Convert path array to CSS variable name
function pathToCssVar(parts) {
  const kebabParts = parts.map(p => toKebab(p));
  if (kebabParts[0] === 'primitives') {
    kebabParts[0] = 'primitive';
  }
  return '--' + kebabParts.join('-');
}

// Helper: Format dimension or scalar value with units if needed
function formatValue(value, type, keyName) {
  if (typeof value === 'number') {
    // If key indicates letter spacing, line height, font size, radius, offset, etc.
    const unitNeeded = /size|width|height|spacing|radius|offset|blur|spread|padding|margin|gap/i.test(keyName || '')
      || type === 'dimension';
    const isUnitlessNumber = /weight|stretch|opacity|order|flex/i.test(keyName || '') && type !== 'dimension';

    if (unitNeeded && !isUnitlessNumber) {
      return value + 'px';
    }
    return String(value);
  }
  return String(value);
}

// Main conversion logic
function convertTokens(tokens) {
  const stats = {
    primitiveKeyColors: 0,
    primitivePalettes: 0,
    lightRoles: 0,
    darkRoles: 0,
    effects: 0,
    typographyProps: 0,
    typographyStyles: 0,
    unresolvedRefs: 0,
  };

  const linesLight = [];
  const linesDark = [];
  const utilityClasses = [];

  // 1. Primitive Tokens: Key Colors & Color Palettes
  linesLight.push('  /* ========================================================================== */');
  linesLight.push('  /* 1. PRIMITIVE TOKENS (Raw colors and tonal palettes)                         */');
  linesLight.push('  /* ========================================================================== */');
  linesLight.push('');

  if (tokens.primitives && tokens.primitives['key colors']) {
    linesLight.push('  /* Primitive Key Colors */');
    for (const [keyName, tokenObj] of Object.entries(tokens.primitives['key colors'])) {
      const val = tokenObj.value !== undefined ? tokenObj.value : tokenObj['$value'];
      const varName = pathToCssVar(['primitives', 'key colors', keyName]);
      linesLight.push(`  ${varName}: ${val};`);
      // Shorthand alias
      const alias = `--primitive-key-${toKebab(keyName)}`;
      linesLight.push(`  ${alias}: var(${varName});`);
      stats.primitiveKeyColors++;
    }
    linesLight.push('');
  }

  if (tokens.primitives && tokens.primitives['color palettes']) {
    linesLight.push('  /* Primitive Color Palettes */');
    for (const [paletteName, tones] of Object.entries(tokens.primitives['color palettes'])) {
      linesLight.push(`  /* Palette: ${paletteName} */`);
      for (const [toneKey, tokenObj] of Object.entries(tones)) {
        const val = tokenObj.value !== undefined ? tokenObj.value : tokenObj['$value'];
        const canonicalVar = pathToCssVar(['primitives', 'color palettes', paletteName, toneKey]);
        linesLight.push(`  ${canonicalVar}: ${val};`);

        // Shorthand aliases for developer convenience:
        // e.g. --primitive-primary-40 and --primitive-primary-primary40
        const toneKebab = toKebab(toneKey);
        const paletteKebab = toKebab(paletteName);
        const alias1 = `--primitive-${paletteKebab}-${toneKebab}`;
        linesLight.push(`  ${alias1}: var(${canonicalVar});`);

        // If toneKey has number suffix (e.g. primary40 -> 40), offer --primitive-primary-40
        const numMatch = toneKey.match(/(\d+)$/);
        if (numMatch) {
          const aliasNum = `--primitive-${paletteKebab}-${numMatch[1]}`;
          if (aliasNum !== alias1) {
            linesLight.push(`  ${aliasNum}: var(${canonicalVar});`);
          }
        }

        stats.primitivePalettes++;
      }
      linesLight.push('');
    }
  }

  // 2. Effects & Shadows
  if (tokens.effect) {
    linesLight.push('  /* ========================================================================== */');
    linesLight.push('  /* 2. EFFECT TOKENS (Elevation / Drop Shadows)                                */');
    linesLight.push('  /* ========================================================================== */');
    linesLight.push('');

    for (const [effectName, effectToken] of Object.entries(tokens.effect)) {
      const val = effectToken.value !== undefined ? effectToken.value : effectToken['$value'];
      const kebabName = toKebab(effectName);

      if (val && typeof val === 'object' && val.shadowType === 'dropShadow') {
        const x = val.offsetX !== undefined ? `${val.offsetX}px` : '0px';
        const y = val.offsetY !== undefined ? `${val.offsetY}px` : '0px';
        const radius = val.radius !== undefined ? `${val.radius}px` : '0px';
        const spread = val.spread !== undefined ? `${val.spread}px` : '0px';
        const color = val.color || 'rgba(0, 0, 0, 0.2)';

        // Composite shadow CSS variable
        const compVar = `--effect-${kebabName}`;
        linesLight.push(`  ${compVar}: ${x} ${y} ${radius} ${spread} ${color};`);

        // Convenient alias (e.g. --shadow-soft, --shadow-medium)
        const shadowAlias = `--shadow-${kebabName.replace(/-shadow$/, '')}`;
        linesLight.push(`  ${shadowAlias}: var(${compVar});`);

        // Individual component variables for flexibility
        linesLight.push(`  --effect-${kebabName}-offset-x: ${x};`);
        linesLight.push(`  --effect-${kebabName}-offset-y: ${y};`);
        linesLight.push(`  --effect-${kebabName}-radius: ${radius};`);
        linesLight.push(`  --effect-${kebabName}-spread: ${spread};`);
        linesLight.push(`  --effect-${kebabName}-color: ${color};`);
        linesLight.push('');
        stats.effects++;
      }
    }
  }

  // 3. Typography
  if (tokens.typography) {
    linesLight.push('  /* ========================================================================== */');
    linesLight.push('  /* 3. TYPOGRAPHY TOKENS                                                       */');
    linesLight.push('  /* ========================================================================== */');
    linesLight.push('');

    for (const [groupName, groupObj] of Object.entries(tokens.typography)) {
      const groupKebab = toKebab(groupName);
      linesLight.push(`  /* Typography Group: ${groupName} */`);

      for (const [styleName, styleObj] of Object.entries(groupObj)) {
        const styleKebab = toKebab(styleName);
        linesLight.push(`  /* Style: ${styleName} */`);

        let fontSizeVal = '';
        let lineHeightVal = '';
        let fontFamilyVal = '';
        let fontWeightVal = '400';
        let fontStyleVal = 'normal';
        let letterSpacingVal = '0px';
        let textDecorationVal = 'none';
        let textCaseVal = 'none';

        for (const [propName, propToken] of Object.entries(styleObj)) {
          if (!propToken || typeof propToken !== 'object') continue;
          const rawVal = propToken.value !== undefined ? propToken.value : propToken['$value'];
          const type = propToken.type || propToken['$type'];
          const formatted = formatValue(rawVal, type, propName);
          const propKebab = toKebab(propName);

          const varName = `--typography-${styleKebab}-${propKebab}`;
          linesLight.push(`  ${varName}: ${formatted};`);
          stats.typographyProps++;

          if (propName === 'fontSize') fontSizeVal = formatted;
          if (propName === 'lineHeight') lineHeightVal = formatted;
          if (propName === 'fontFamily') fontFamilyVal = `'${rawVal}', sans-serif`;
          if (propName === 'fontWeight') fontWeightVal = String(rawVal);
          if (propName === 'fontStyle') fontStyleVal = String(rawVal);
          if (propName === 'letterSpacing') letterSpacingVal = formatted;
          if (propName === 'textDecoration') textDecorationVal = String(rawVal);
          if (propName === 'textCase') textCaseVal = String(rawVal);
        }

        // Composite font shorthand
        if (fontFamilyVal && fontSizeVal && lineHeightVal) {
          const compVar = `--typography-${styleKebab}`;
          linesLight.push(`  ${compVar}: ${fontStyleVal} ${fontWeightVal} ${fontSizeVal}/${lineHeightVal} ${fontFamilyVal};`);
        }
        linesLight.push('');

        // Utility class
        const className = `type-${styleKebab}`;
        utilityClasses.push(`.${className}, .typography-${styleKebab} {`);
        utilityClasses.push(`  font-family: var(--typography-${styleKebab}-font-family, ${fontFamilyVal || 'inherit'});`);
        utilityClasses.push(`  font-size: var(--typography-${styleKebab}-font-size, ${fontSizeVal});`);
        utilityClasses.push(`  font-weight: var(--typography-${styleKebab}-font-weight, ${fontWeightVal});`);
        utilityClasses.push(`  line-height: var(--typography-${styleKebab}-line-height, ${lineHeightVal});`);
        utilityClasses.push(`  letter-spacing: var(--typography-${styleKebab}-letter-spacing, ${letterSpacingVal});`);
        utilityClasses.push(`  font-style: var(--typography-${styleKebab}-font-style, ${fontStyleVal});`);
        if (textDecorationVal && textDecorationVal !== 'none') {
          utilityClasses.push(`  text-decoration: var(--typography-${styleKebab}-text-decoration, ${textDecorationVal});`);
        }
        if (textCaseVal && textCaseVal !== 'none') {
          const transformVal = textCaseVal === 'uppercase' ? 'uppercase' : textCaseVal === 'lowercase' ? 'lowercase' : 'none';
          utilityClasses.push(`  text-transform: ${transformVal};`);
        }
        utilityClasses.push(`}`);
        utilityClasses.push('');

        stats.typographyStyles++;
      }
    }
  }

  // 4. Any other categories (spacing, sizing, borders, radii if present in JSON)
  const knownCategories = new Set(['effect', 'primitives', 'color roles', 'typography']);
  const otherCategories = Object.keys(tokens).filter(k => !knownCategories.has(k));
  if (otherCategories.length > 0) {
    linesLight.push('  /* ========================================================================== */');
    linesLight.push('  /* 4. OTHER TOKEN CATEGORIES                                                  */');
    linesLight.push('  /* ========================================================================== */');
    linesLight.push('');

    for (const cat of otherCategories) {
      linesLight.push(`  /* Category: ${cat} */`);
      function walkGeneric(obj, pParts) {
        for (const [k, v] of Object.entries(obj)) {
          const curr = [...pParts, k];
          if (v && typeof v === 'object' && (v.value !== undefined || v['$value'] !== undefined)) {
            const rawVal = v.value !== undefined ? v.value : v['$value'];
            const type = v.type || v['$type'];
            const formatted = formatValue(rawVal, type, k);
            const varName = pathToCssVar(curr);
            linesLight.push(`  ${varName}: ${formatted};`);
          } else if (v && typeof v === 'object') {
            walkGeneric(v, curr);
          }
        }
      }
      walkGeneric(tokens[cat], [cat]);
      linesLight.push('');
    }
  }

  // 5. Semantic Color Roles: Light Theme
  linesLight.push('  /* ========================================================================== */');
  linesLight.push('  /* 5. SEMANTIC COLOR ROLES - LIGHT THEME                                      */');
  linesLight.push('  /* (Components must consume these --color-* variables)                        */');
  linesLight.push('  /* ========================================================================== */');
  linesLight.push('');

  if (tokens['color roles'] && tokens['color roles']['color light']) {
    for (const [roleName, tokenObj] of Object.entries(tokens['color roles']['color light'])) {
      const rawVal = tokenObj.value !== undefined ? tokenObj.value : tokenObj['$value'];
      const roleKebab = toKebab(roleName);
      const varName = `--color-${roleKebab}`;

      if (typeof rawVal === 'string' && rawVal.startsWith('{') && rawVal.endsWith('}')) {
        const cleanRef = rawVal.replace(/^\{|\}$/g, '').trim();
        const targetToken = getByPath(tokens, cleanRef);
        const resolvedHex = targetToken && (targetToken.value !== undefined ? targetToken.value : targetToken['$value']);
        const primitiveVar = refToCssVar(rawVal);

        if (!targetToken) {
          stats.unresolvedRefs++;
          console.warn(`Warning: Unresolved token reference in light theme: ${roleName} -> ${rawVal}`);
          linesLight.push(`  ${varName}: var(${primitiveVar}); /* UNRESOLVED REFERENCE: ${rawVal} */`);
        } else {
          linesLight.push(`  ${varName}: var(${primitiveVar}); /* ${resolvedHex} */`);
        }
      } else {
        linesLight.push(`  ${varName}: ${rawVal};`);
      }
      stats.lightRoles++;
    }
  }

  // 6. Semantic Color Roles: Dark Theme
  linesDark.push('/* ========================================================================== */');
  linesDark.push('/* 6. SEMANTIC COLOR ROLES - DARK THEME                                       */');
  linesDark.push('/* Activated via [data-theme="dark"] on <html> or container element           */');
  linesDark.push('/* ========================================================================== */');
  linesDark.push('');
  linesDark.push('[data-theme="dark"] {');

  if (tokens['color roles'] && tokens['color roles']['color dark']) {
    for (const [roleName, tokenObj] of Object.entries(tokens['color roles']['color dark'])) {
      const rawVal = tokenObj.value !== undefined ? tokenObj.value : tokenObj['$value'];
      const roleKebab = toKebab(roleName);
      const varName = `--color-${roleKebab}`;

      if (typeof rawVal === 'string' && rawVal.startsWith('{') && rawVal.endsWith('}')) {
        const cleanRef = rawVal.replace(/^\{|\}$/g, '').trim();
        const targetToken = getByPath(tokens, cleanRef);
        const resolvedHex = targetToken && (targetToken.value !== undefined ? targetToken.value : targetToken['$value']);
        const primitiveVar = refToCssVar(rawVal);

        if (!targetToken) {
          stats.unresolvedRefs++;
          console.warn(`Warning: Unresolved token reference in dark theme: ${roleName} -> ${rawVal}`);
          linesDark.push(`  ${varName}: var(${primitiveVar}); /* UNRESOLVED REFERENCE: ${rawVal} */`);
        } else {
          linesDark.push(`  ${varName}: var(${primitiveVar}); /* ${resolvedHex} */`);
        }
      } else {
        linesDark.push(`  ${varName}: ${rawVal};`);
      }
      stats.darkRoles++;
    }
  }
  linesDark.push('}');
  linesDark.push('');

  // Assemble Complete CSS
  const cssParts = [
    '/**',
    ' * GOODPETS DESIGN SYSTEM - GENERATED TOKENS CSS',
    ' *',
    ' * Single Source of Truth: design-tokens.json',
    ' * Generated via: node convert-tokens.js',
    ` * Generated at: ${new Date().toISOString()}`,
    ' *',
    ' * DO NOT EDIT THIS FILE DIRECTLY. Regenerate using `npm run build:tokens`',
    ' * or `node task-01-design-system/tokens/convert-tokens.js`.',
    ' */',
    '',
    ':root,',
    '[data-theme="light"] {',
    ...linesLight,
    '}',
    '',
    ...linesDark,
    '/* ========================================================================== */',
    '/* 7. TYPOGRAPHY UTILITY CLASSES                                              */',
    '/* ========================================================================== */',
    '',
    ...utilityClasses,
  ];

  return {
    css: cssParts.join('\n'),
    stats,
  };
}

// Execution
console.log('----------------------------------------------------');
console.log('GoodPets Design System - Token to CSS Converter');
console.log('----------------------------------------------------');
console.log(`Loading tokens from: ${inputPath}`);

const rawJson = fs.readFileSync(inputPath, 'utf8');
let tokensData;
try {
  tokensData = JSON.parse(rawJson);
} catch (err) {
  console.error('Failed to parse tokens JSON:', err.message);
  process.exit(1);
}

const { css, stats } = convertTokens(tokensData);

console.log('\nToken Processing Summary:');
console.log(`  - Primitive Key Colors:    ${stats.primitiveKeyColors}`);
console.log(`  - Primitive Palette Tones: ${stats.primitivePalettes}`);
console.log(`  - Effect / Shadows:        ${stats.effects}`);
console.log(`  - Typography Properties:   ${stats.typographyProps}`);
console.log(`  - Typography Styles:       ${stats.typographyStyles}`);
console.log(`  - Light Color Roles:       ${stats.lightRoles}`);
console.log(`  - Dark Color Roles:        ${stats.darkRoles}`);
console.log(`  - Unresolved References:   ${stats.unresolvedRefs}`);

if (stats.unresolvedRefs > 0) {
  console.error(`\nValidation Failed: ${stats.unresolvedRefs} references could not be resolved!`);
  process.exit(1);
}

if (isValidateOnly) {
  console.log('\n[Validation OK] All tokens and references validated successfully.');
  process.exit(0);
}

// Write generated CSS file
const dir = path.dirname(outputPath);
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}
fs.writeFileSync(outputPath, css, 'utf8');
console.log(`Successfully generated CSS: ${outputPath} (${css.length} bytes)`);

console.log('\nDone! CSS variables generated successfully.');
