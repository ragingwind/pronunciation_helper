// Build script: articles.md -> data/articles.json
//
// Reads articles.md, splits it into articles by `---`, chunks each sentence,
// pre-translates every chunk (literal) and full sentence (natural) via Google's
// translate endpoint, and writes the prepared data the app loads on startup.
//
// Run: `npm run build` (or `node scripts/build.mjs`)

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ARTICLES_MD = path.join(ROOT, 'articles.md');
const OUT_DIR = path.join(ROOT, 'data');
const OUT_FILE = path.join(OUT_DIR, 'articles.json');

// Cache identical strings (as in-flight promises) so repeated phrases only hit
// the network once even when requested concurrently.
const translationCache = new Map();

function translate(text) {
    const key = text.trim();
    if (!key) return Promise.resolve('');
    if (translationCache.has(key)) return translationCache.get(key);

    const promise = (async () => {
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=ko&dt=t&q=${encodeURIComponent(key)}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`translate HTTP ${res.status}`);
        const data = await res.json();

        let out = '';
        if (data && data[0]) {
            for (const item of data[0]) {
                if (item[0]) out += item[0];
            }
        }
        return out.trim();
    })();

    translationCache.set(key, promise);
    return promise;
}

// Run async `fn` over items with a bounded number of concurrent workers.
async function mapPool(items, limit, fn) {
    const results = new Array(items.length);
    let next = 0;
    async function worker() {
        while (next < items.length) {
            const i = next++;
            results[i] = await fn(items[i], i);
        }
    }
    const workers = Array.from({ length: Math.min(limit, items.length) }, worker);
    await Promise.all(workers);
    return results;
}

// Split a body of text into sentences by terminal punctuation (. ! ?).
// Mirrors splitIntoSentences() in index.html so the build matches live parsing.
function splitIntoSentences(text) {
    const matches = text.match(/[^.!?]+[.!?]+(?:\s+|$)/g) || [];
    const matchedLength = matches.reduce((acc, m) => acc + m.length, 0);
    if (matchedLength < text.length) {
        const remaining = text.substring(matchedLength).trim();
        if (remaining.length > 0) matches.push(remaining + '.');
    }
    return matches.map(s => s.trim()).filter(s => s.length > 0);
}

// Chunk a sentence: honour explicit `/` markers, else ~4 words per chunk.
function chunkSentence(englishLine) {
    if (englishLine.includes('/')) {
        return englishLine.split('/').map(c => c.trim()).filter(c => c.length > 0);
    }
    const words = englishLine.split(/\s+/).filter(w => w.length > 0);
    const chunksCount = Math.ceil(words.length / 4);
    const wordsPerChunk = Math.ceil(words.length / chunksCount);
    const chunks = [];
    for (let j = 0; j < words.length; j += wordsPerChunk) {
        chunks.push(words.slice(j, j + wordsPerChunk).join(' '));
    }
    return chunks;
}

// Produce one practice-sentence object matching the app's practiceData shape.
async function processSentence(englishLine) {
    const chunkTexts = chunkSentence(englishLine);

    const [translatedChunks, naturalTranslation] = await Promise.all([
        Promise.all(chunkTexts.map(chunk => translate(chunk))),
        translate(chunkTexts.join(' '))
    ]);
    const literalTranslation = translatedChunks.join(' / ');

    const chunks = chunkTexts.map((text, idx) => ({
        text,
        tips: `구간 ${idx + 1} 발음 연습. 연음에 유의하여 편안하게 읽으세요.`
    }));

    return {
        chunks,
        fullText: englishLine.replace(/\//g, '').replace(/\s+/g, ' ').trim(),
        translation: `${literalTranslation} (${naturalTranslation})`
    };
}

// Split articles.md into { title, body } blocks by `---` separators.
function parseArticles(markdown) {
    return markdown.split(/^\s*---\s*$/m).map(block => {
        const lines = block.trim().split('\n');
        let title = '';
        const bodyLines = [];
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            if (!title && trimmed.startsWith('#')) {
                title = trimmed.replace(/^#+\s*/, '').trim();
                continue;
            }
            bodyLines.push(trimmed);
        }
        return { title, body: bodyLines.join(' ') };
    }).filter(article => article.title && article.body);
}

export async function buildArticlesJson({ verbose = false } = {}) {
    const markdown = await readFile(ARTICLES_MD, 'utf8');
    const parsed = parseArticles(markdown);

    const articles = [];
    for (let i = 0; i < parsed.length; i++) {
        const article = parsed[i];
        if (verbose) console.log(`[${i + 1}/${parsed.length}] ${article.title}`);

        const sentenceTexts = splitIntoSentences(article.body);
        const sentences = await mapPool(sentenceTexts, 6, processSentence);
        articles.push({ id: i + 1, title: article.title, sentences });
    }

    const output = {
        generatedAt: new Date().toISOString(),
        source: 'articles.md',
        articles
    };

    await mkdir(OUT_DIR, { recursive: true });
    await writeFile(OUT_FILE, JSON.stringify(output, null, 2) + '\n');
    if (verbose) {
        const sentenceCount = articles.reduce((n, a) => n + a.sentences.length, 0);
        console.log(`Wrote ${path.relative(ROOT, OUT_FILE)} — ${articles.length} articles, ${sentenceCount} sentences.`);
    }
    return output;
}

// Run as CLI when invoked directly.
if (import.meta.url === `file://${process.argv[1]}`) {
    buildArticlesJson({ verbose: true }).catch(err => {
        console.error('Build failed:', err.message);
        process.exit(1);
    });
}
