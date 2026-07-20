// Deploy: rebuild prepared data, then commit and push so GitHub Pages publishes.
//
// Pushes articles.md and data/articles.json to the current branch (main).
// Application/code changes (index.html, scripts) should be committed normally.
//
// Run: `npm run deploy`

import { execSync } from 'node:child_process';
import { buildArticlesJson } from './build.mjs';

function run(cmd) {
    console.log(`$ ${cmd}`);
    execSync(cmd, { stdio: 'inherit' });
}

console.log('Building prepared data...');
await buildArticlesJson({ verbose: true });

run('git add articles.md data/articles.json');

// Commit only if the data actually changed.
const staged = execSync('git diff --cached --name-only', { encoding: 'utf8' }).trim();
if (!staged) {
    console.log('No data changes to deploy.');
    process.exit(0);
}

run('git commit -m "chore: rebuild article practice data"');
run('git push origin HEAD');
console.log('Pushed. GitHub Pages will publish the update shortly.');
