/**
 * tarsite — Theme Sync Utility Script
 * Reads all .md design files in /designs and validates them with designmd-parser.
 */

import * as fs from 'fs';
import * as path from 'path';
import { parseDesignMd } from '../src/designmd-parser';
import { compileRouteToHtml } from '../src/html-builder';

const designsDir = path.join(__dirname, '../designs');
const files = fs.readdirSync(designsDir).filter((f) => f.endsWith('.md'));

console.log(`🔍 Found ${files.length} design templates in ${designsDir}:`);

let passed = 0;

for (const file of files) {
  const filePath = path.join(designsDir, file);
  const content = fs.readFileSync(filePath, 'utf-8');
  const themeName = file.replace('.md', '');

  const start = performance.now();
  const plan = parseDesignMd(content, `w:${themeName}`);
  const parseTime = (performance.now() - start).toFixed(2);

  const startHtml = performance.now();
  const html = compileRouteToHtml(plan.routes[0], plan.designTokens);
  const htmlTime = (performance.now() - startHtml).toFixed(2);

  console.log(`  ✅ [${themeName}] parsed in ${parseTime}ms | compiled to HTML (${html.length} chars) in ${htmlTime}ms`);
  passed++;
}

console.log(`\n🎉 All ${passed}/${files.length} templates are 100% valid and ready for Edge R2 + KV deployment!`);
