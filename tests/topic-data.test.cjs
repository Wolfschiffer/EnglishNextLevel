const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const TOPIC_DATA_DIRECTORY = path.join(ROOT, 'js/topics/data');
const TOPIC_DATA_FILES = fs.readdirSync(TOPIC_DATA_DIRECTORY)
    .filter((file) => file.endsWith('.js'))
    .sort();
const TOPIC_IDS_FROM_FILES = TOPIC_DATA_FILES.map((file) => path.basename(file, '.js'));
const INDEX_HTML = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const INDEX_SCRIPTS = [...INDEX_HTML.matchAll(/<script src="([^"]+)"/g)].map((match) => match[1]);
const TOPIC_DATA_SCRIPTS = INDEX_SCRIPTS.filter((script) => script.startsWith('js/topics/data/'));
const TOPIC_IDS_FROM_INDEX = TOPIC_DATA_SCRIPTS.map((script) => path.basename(script, '.js'));

function loadTopicCatalog() {
    const window = {};
    const context = vm.createContext({ window });

    for (const relativePath of TOPIC_DATA_SCRIPTS) {
        vm.runInContext(
            fs.readFileSync(path.join(ROOT, relativePath), 'utf8'),
            context,
            { filename: relativePath }
        );
    }

    const aggregatorPath = 'js/topics/topics-data.js';
    vm.runInContext(
        fs.readFileSync(path.join(ROOT, aggregatorPath), 'utf8'),
        context,
        { filename: aggregatorPath }
    );

    return window.TOPICS_DATA;
}

test('every topic data file is loaded by the page before the catalog and topic menu', () => {
    const aggregatorIndex = INDEX_SCRIPTS.indexOf('js/topics/topics-data.js');
    const menuIndex = INDEX_SCRIPTS.indexOf('js/topics/topics-menu.js');

    assert.deepEqual([...TOPIC_DATA_SCRIPTS].sort(), TOPIC_DATA_FILES.map((file) => `js/topics/data/${file}`));
    assert.ok(aggregatorIndex >= 0, 'index.html must load the topic catalog aggregator');
    assert.ok(menuIndex > aggregatorIndex, 'topic menu must load after the catalog aggregator');
    assert.ok(TOPIC_DATA_SCRIPTS.every((script) => INDEX_SCRIPTS.indexOf(script) < aggregatorIndex));
});

test('topic files assemble the complete catalog with the expected volume sizes', () => {
    const catalog = loadTopicCatalog();

    assert.deepEqual(Object.keys(catalog), TOPIC_IDS_FROM_INDEX);
    assert.equal(Object.isFrozen(catalog), true);

    for (const topicId of TOPIC_IDS_FROM_INDEX) {
        const topic = catalog[topicId];
        assert.equal(topic.id, topicId);
        assert.ok(topic.title);
        assert.ok(topic.icon);
        assert.ok(topic.englishVariant);
        assert.deepEqual(Object.keys(topic.levels), ['common', 'advanced']);

        for (const [levelId, expectedWordCount] of [['common', 10], ['advanced', 6]]) {
            const level = topic.levels[levelId];
            assert.equal(level.volumes.length, 2, `${topicId} ${levelId} should have two volumes`);
            assert.equal(level.volumeSize, expectedWordCount);

            for (const volume of level.volumes) {
                assert.equal(volume.words.length, expectedWordCount, `${topicId} ${levelId} ${volume.id} word count`);
                for (const word of volume.words) {
                    assert.ok(word.id, `${topicId} word needs an id`);
                    assert.ok(word.english, `${topicId} word needs English text`);
                    assert.ok(word.portuguese, `${topicId} word needs Portuguese text`);
                    assert.ok(Array.isArray(word.accepted) && word.accepted.length > 0, `${topicId} word needs accepted answers`);
                }
            }
        }
    }
});

test('topic catalog reports missing topic files instead of silently using a partial list', () => {
    const window = { ENL_TOPIC_DATA_PARTS: { kitchen: {} } };
    const context = vm.createContext({ window });
    const aggregatorPath = 'js/topics/topics-data.js';
    const aggregator = fs.readFileSync(path.join(ROOT, aggregatorPath), 'utf8');

    assert.throws(
        () => vm.runInContext(aggregator, context, { filename: aggregatorPath }),
        /Topic data is missing:/
    );
});
