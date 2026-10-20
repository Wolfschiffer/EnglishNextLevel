const {
    PROGRESS_SYNC_TOO_LARGE_REASON,
    mergeProgress,
    normalizeProgress
} = require('./shared/progress-profile-data');

const MAX_PROGRESS_BYTES = 900 * 1024;
const MAX_STORED_PROFILE_NAME_LENGTH = 50;

function throwProgressTooLargeError(HttpsError, message) {
    throw new HttpsError('resource-exhausted', message, {
        reason: PROGRESS_SYNC_TOO_LARGE_REASON
    });
}

function normalizeStoredProfileName(name) {
    if (typeof name !== 'string') return null;
    const normalizedName = name.trim().slice(0, MAX_STORED_PROFILE_NAME_LENGTH);
    return normalizedName || null;
}

function getJsonSize(value, HttpsError) {
    let serialized;
    try {
        serialized = JSON.stringify(value);
    } catch (error) {
        throw new HttpsError('invalid-argument', 'Progress must be valid JSON data.');
    }

    if (typeof serialized !== 'string') {
        throw new HttpsError('invalid-argument', 'Provide saved progress to sync.');
    }
    return Buffer.byteLength(serialized, 'utf8');
}

function normalizeProgressPayload(progress, HttpsError, now = new Date()) {
    if (!progress || typeof progress !== 'object' || Array.isArray(progress)) {
        throw new HttpsError('invalid-argument', 'Provide saved progress to sync.');
    }

    if (getJsonSize(progress, HttpsError) > MAX_PROGRESS_BYTES) {
        throwProgressTooLargeError(HttpsError, 'Progress payload is too large to sync.');
    }

    const normalized = normalizeProgress(progress, now);
    if (getJsonSize(normalized, HttpsError) > MAX_PROGRESS_BYTES) {
        throwProgressTooLargeError(HttpsError, 'Normalized progress is too large to sync.');
    }
    return normalized;
}

function stableProgressValue(value) {
    if (Array.isArray(value)) return value.map(stableProgressValue);
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(
        Object.keys(value).sort().map(key => [key, stableProgressValue(value[key])])
    );
}

function serializeProgress(value) {
    return JSON.stringify(stableProgressValue(value));
}

async function syncProgressData({ db, uid, progress, profileName, email, FieldValue, HttpsError, now = new Date() }) {
    const userRef = db.collection('users').doc(uid);

    return db.runTransaction(async (transaction) => {
        const snapshot = await transaction.get(userRef);
        const userData = snapshot.exists ? snapshot.data() : {};
        const storedName = normalizeStoredProfileName(userData.name);
        const recoveredName = storedName
            || normalizeStoredProfileName(profileName)
            || normalizeStoredProfileName(typeof email === 'string' ? email.split('@')[0] : '');
        const verifiedEmail = typeof email === 'string' ? email.trim().slice(0, 254) : '';
        const hasStoredEmail = typeof userData.email === 'string' && userData.email.trim().length > 0;
        const needsNameRepair = !storedName;
        const needsEmailRepair = !hasStoredEmail && Boolean(verifiedEmail);
        const needsCreatedAtRepair = userData.createdAt == null;
        const needsProfileRepair = needsNameRepair || needsEmailRepair || needsCreatedAtRepair;

        if (needsProfileRepair && !recoveredName) {
            throw new HttpsError('failed-precondition', 'Add a valid profile name before syncing progress.');
        }
        if (needsProfileRepair && !hasStoredEmail && !verifiedEmail) {
            throw new HttpsError('failed-precondition', 'A verified email is required to repair the profile.');
        }

        const cloudProgress = userData.progressV1;
        const merged = mergeProgress(progress, cloudProgress, now);
        const normalizedCloud = normalizeProgress(cloudProgress, now);

        if (getJsonSize(merged, HttpsError) > MAX_PROGRESS_BYTES) {
            throwProgressTooLargeError(HttpsError, 'Saved progress is too large to sync.');
        }

        const hasNewProgress = serializeProgress(merged) !== serializeProgress(normalizedCloud);
        const needsNormalization = cloudProgress != null
            && serializeProgress(cloudProgress) !== serializeProgress(normalizedCloud);

        if (hasNewProgress || needsNormalization || needsProfileRepair) {
            const profileUpdate = {
                progressV1: merged,
                progressUpdatedAt: FieldValue.serverTimestamp()
            };
            const mergeFields = ['progressV1', 'progressUpdatedAt'];

            if (needsProfileRepair) {
                if (needsNameRepair) {
                    profileUpdate.name = recoveredName;
                    mergeFields.push('name');
                }
                if (needsEmailRepair) {
                    profileUpdate.email = verifiedEmail;
                    mergeFields.push('email');
                }
                if (needsCreatedAtRepair) {
                    profileUpdate.createdAt = FieldValue.serverTimestamp();
                    mergeFields.push('createdAt');
                }
            }

            transaction.set(userRef, profileUpdate, { mergeFields });
        }

        return merged;
    });
}

module.exports = {
    MAX_PROGRESS_BYTES,
    normalizeStoredProfileName,
    normalizeProgressPayload,
    syncProgressData
};
