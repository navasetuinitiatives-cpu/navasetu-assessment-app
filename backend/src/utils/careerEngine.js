// Loads the shared scoring/content engine. public/career-engine.js is a UMD file the browser loads directly;
// this package is "type":"module", so Node can't require() it. We evaluate the same file instead, so there is one source of truth.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const file = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../public/career-engine.js');
const mod = { exports: {} };
new Function('module', fs.readFileSync(file, 'utf8'))(mod);
export default mod.exports;
