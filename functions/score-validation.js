const SCORE_MODES = new Set([
    'numbers',
    'numbers11-20',
    'tens',
    'random21_99',
    'hundreds',
    'random101_999',
    'thousands',
    'random1001_9999',
    'mixedAdvanced'
]);

const MAX_NAME_LENGTH = 20;

function normalizeRunId(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
    const runId = typeof data.runId === 'string' ? data.runId : '';
    return /^[A-Za-z0-9_-]{20}$/.test(runId) ? runId : null;
}

function normalizeProfileName(name) {
    if (typeof name !== 'string') return null;
    const normalizedName = name.trim().slice(0, MAX_NAME_LENGTH);
    return normalizedName || null;
}

module.exports = { MAX_NAME_LENGTH, SCORE_MODES, normalizeProfileName, normalizeRunId };
