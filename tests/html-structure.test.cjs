const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const githubPagesBasePath = `/${path.basename(projectRoot)}/`;
const indexPath = path.join(projectRoot, 'index.html');
const html = fs.readFileSync(indexPath, 'utf8').replace(/<!--[\s\S]*?-->/g, '');

function getStartTags(markup) {
    const tags = [];
    let cursor = 0;

    while (cursor < markup.length) {
        const start = markup.indexOf('<', cursor);
        if (start === -1) break;

        if (!/[a-z]/i.test(markup[start + 1] || '')) {
            cursor = start + 1;
            continue;
        }

        let quote = null;
        let end = start + 1;

        for (; end < markup.length; end += 1) {
            const character = markup[end];
            if (quote) {
                if (character === quote) quote = null;
            } else if (character === '"' || character === "'") {
                quote = character;
            } else if (character === '>') {
                break;
            }
        }

        if (end === markup.length) {
            throw new Error(`Unterminated HTML start tag near offset ${start}`);
        }

        const tag = markup.slice(start + 1, end);
        tags.push(tag);
        cursor = end + 1;

        const tagName = /^([a-z][\w:-]*)/i.exec(tag)?.[1]?.toLowerCase();
        if (['script', 'style', 'textarea', 'title'].includes(tagName)) {
            const closingTag = new RegExp(`<\\/${tagName}\\s*>`, 'ig');
            closingTag.lastIndex = cursor;
            const closingMatch = closingTag.exec(markup);
            if (!closingMatch) {
                throw new Error(`Unclosed raw-text <${tagName}> element`);
            }
            cursor = closingTag.lastIndex;
        }
    }

    return tags;
}

function getQuotedAttributes(markup, attributeNames) {
    const wanted = new Set(attributeNames.map((name) => name.toLowerCase()));
    const attributes = [];

    for (const tag of getStartTags(markup)) {
        const attributePattern = /(?:^|\s)([^\s=/>]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g;
        for (const match of tag.matchAll(attributePattern)) {
            const name = match[1].toLowerCase();
            if (!wanted.has(name)) continue;
            attributes.push({ name, value: match[2] ?? match[3] ?? match[4] });
        }
    }

    return attributes;
}

function findMissingLocalReferences(markup, root) {
    const missingReferences = [];

    for (const { value } of getQuotedAttributes(markup, ['src', 'href'])) {
        const reference = value.trim();
        if (!reference || /^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(reference)) continue;

        const pathWithoutQuery = reference.split(/[?#]/, 1)[0];
        if (!pathWithoutQuery) continue;

        let decodedPath;
        try {
            decodedPath = decodeURIComponent(pathWithoutQuery);
        } catch (error) {
            missingReferences.push(`${reference} (invalid URL encoding)`);
            continue;
        }

        // Permit root-relative URLs only when they include this repository's
        // GitHub Pages base path. A bare /asset.js points at the domain root.
        if (decodedPath.startsWith('/')) {
            if (!decodedPath.startsWith(githubPagesBasePath)) {
                missingReferences.push(reference);
                continue;
            }
            decodedPath = decodedPath.slice(githubPagesBasePath.length);
        }

        const targetPath = path.resolve(root, decodedPath);
        const isInsideProject = targetPath === root || targetPath.startsWith(`${root}${path.sep}`);
        if (!isInsideProject || !fs.existsSync(targetPath)) {
            missingReferences.push(reference);
        }
    }

    return missingReferences;
}

test('index.html does not contain duplicate IDs', () => {
    const ids = getQuotedAttributes(html, ['id']).map(({ value }) => value);
    const seen = new Set();
    const duplicates = new Set();

    ids.forEach((id) => {
        if (seen.has(id)) duplicates.add(id);
        seen.add(id);
    });

    assert.deepEqual([...duplicates], [], `Duplicate IDs: ${[...duplicates].join(', ')}`);
});

test('Words gameplay shell can shrink to a narrow mobile viewport', () => {
    const wordsStyles = fs.readFileSync(path.join(projectRoot, 'css/words-game.css'), 'utf8');
    const shellRule = /body\[data-screen="wordsGame"\]\s+#category-container\s*\{([^}]*)\}/.exec(wordsStyles);

    assert.ok(shellRule, 'Words gameplay should define its outer shell');
    assert.match(shellRule[1], /min-width:\s*0\s*!important\s*;/);
});

test('index.html keeps game-card actions out of inline event attributes', () => {
    const inlineHandlers = getQuotedAttributes(html, ['onclick', 'onkeydown', 'onkeyup']);
    assert.deepEqual(inlineHandlers, [], 'Game actions should be attached by JavaScript modules');
});

test('Numbers menu cards match the game modes supported by the Numbers module', () => {
    const cardModes = getQuotedAttributes(html, ['data-numbers-mode']).map(({ value }) => value);
    const numbersSource = fs.readFileSync(path.join(projectRoot, 'js/numbers-game.js'), 'utf8');
    const modeMap = /const modeMap = \{([\s\S]*?)\n\s*\};/.exec(numbersSource);
    assert.ok(modeMap, 'Numbers module should define its mode map');

    const supportedModes = [...modeMap[1].matchAll(/^\s*'([^']+)'\s*:/gm)]
        .map((match) => match[1]);
    assert.equal(cardModes.length, 9);
    assert.equal(new Set(cardModes).size, cardModes.length, 'Numbers card modes should be unique');
    assert.deepEqual([...cardModes].sort(), [...supportedModes].sort());
});

test('Words practice mode cards are native keyboard-operable buttons', () => {
    const tags = getStartTags(html);

    for (const id of ['simple-verbs-btn', 'simple-verbs-past-btn']) {
        const startTag = tags.find((tag) => {
            const idMatch = /(?:^|\s)id\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(tag);
            return (idMatch?.[1] ?? idMatch?.[2]) === id;
        });

        assert.ok(startTag, `Expected to find #${id}`);
        assert.match(startTag, /^button(?:\s|$)/i);
        assert.match(startTag, /(?:^|\s)type\s*=\s*(?:"button"|'button')/i);

        const buttonMarkup = new RegExp(`<button\\b(?=[^>]*\\bid=["']${id}["'])[^>]*>([\\s\\S]*?)<\\/button>`, 'i').exec(html);
        assert.ok(buttonMarkup, `Expected #${id} to have closing button markup`);

        const allowedPhrasingDescendants = new Set(['span', 'small']);
        const invalidButtonDescendants = getStartTags(buttonMarkup[1])
            .map((tag) => /^([a-z][\w:-]*)/i.exec(tag)?.[1]?.toLowerCase())
            .filter((tagName) => !allowedPhrasingDescendants.has(tagName));
        assert.deepEqual(invalidButtonDescendants, [], `#${id} contains elements outside its allowed phrasing content`);
        assert.match(buttonMarkup[1], /<span\b[^>]*class="phase4-word-mode-title"[^>]*>[^<]+<\/span>/i);
    }
});

test('Words review is wired to the pinned scheduler and has accessible controls', () => {
    assert.match(html, /<script src="js\/vendor\/ts-fsrs-5\.4\.2\.umd\.js" defer><\/script>/);
    assert.match(html, /<script src="js\/spaced-review\.js"><\/script>/);
    assert.match(html, /id="spaced-review-open-btn"[^>]*aria-controls="spaced-review-panel"[^>]*aria-expanded="false"/);
    assert.match(html, /id="spaced-review-status"[^>]*role="status"[^>]*aria-live="polite"/);
    assert.deepEqual([...html.matchAll(/data-rating="(Again|Hard|Good|Easy)"/g)].map((match) => match[1]), [
        'Again', 'Hard', 'Good', 'Easy'
    ]);
});

test('index.html local script, stylesheet, and asset references exist', () => {
    const missingReferences = findMissingLocalReferences(html, projectRoot);
    assert.deepEqual(missingReferences, [], `Missing local references: ${missingReferences.join(', ')}`);
});

test('data attributes are not mistaken for standard HTML attributes', () => {
    const markup = '<button data-topic-id="first" data-src="missing.js" id="real-id">Start</button>';

    assert.deepEqual(getQuotedAttributes(markup, ['id']), [{ name: 'id', value: 'real-id' }]);
    assert.deepEqual(getQuotedAttributes(markup, ['src']), []);
});

test('the scanner rejects malformed tags instead of skipping the remaining HTML', () => {
    assert.throws(() => getStartTags('<script src="app.js"'), /Unterminated HTML start tag/);
    assert.throws(() => getStartTags('<script src="app.js">'), /Unclosed raw-text <script> element/);
    assert.throws(() => getStartTags('<script src="app.js"/>'), /Unclosed raw-text <script> element/);
});

test('root-relative references must include the GitHub Pages subpath', () => {
    const markup = '<script src="/js/game.js"></script>';
    const validPagesMarkup = `<script src="${githubPagesBasePath}js/game.js"></script>`;

    assert.deepEqual(findMissingLocalReferences(markup, projectRoot), ['/js/game.js']);
    assert.deepEqual(findMissingLocalReferences(validPagesMarkup, projectRoot), []);
});
