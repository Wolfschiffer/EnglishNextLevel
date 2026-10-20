const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function initializeFirebaseAt(location) {
    let appConfig = null;
    const authCalls = [];
    const firestoreCalls = [];
    const functionsCalls = [];
    const window = { location, addEventListener() {}, enlDebug() {} };
    const auth = {
        useEmulator(...args) { authCalls.push(args); }
    };
    const db = {
        useEmulator(...args) { firestoreCalls.push(args); }
    };
    const functions = {
        useEmulator(...args) { functionsCalls.push(args); }
    };
    const environmentSource = fs.readFileSync(path.join(__dirname, '../js/firebase-environment.js'), 'utf8');
    const source = fs.readFileSync(path.join(__dirname, '../js/firebase-config.js'), 'utf8');
    const end = source.indexOf('// ============================================\n// VARIÁVEIS GLOBAIS');
    assert.notEqual(end, -1, 'Firebase initialization section should have a clear boundary');

    const context = vm.createContext({
        window,
        navigator: { userAgent: '' },
        URLSearchParams,
        firebase: {
            initializeApp(config) { appConfig = config; },
            auth() { return auth; },
            firestore() { return db; },
            functions() { return functions; }
        },
        console: { info() {} }
    });
    vm.runInContext(environmentSource, context);
    vm.runInContext(source.slice(0, end), context);

    return { appConfig, authCalls, firestoreCalls, functionsCalls, environment: window.enlFirebaseEnvironment };
}

test('showing the login screen resets the mobile navigation state', () => {
    const source = fs.readFileSync(path.join(__dirname, '../js/firebase-config.js'), 'utf8');
    const start = source.indexOf('function showAuthScreen(');
    const end = source.indexOf('\nconst passwordResetModule', start);
    assert.notEqual(start, -1);
    assert.notEqual(end, -1);

    const attributes = new Map([['data-screen', 'words']]);
    const elementIds = [
        'auth-container', 'category-container', 'numbers-menu-container',
        'game-container', 'vocab-game-container', 'words-menu-container'
    ];
    const elements = new Map(elementIds.map((id) => [id, {
        style: { display: id === 'words-menu-container' ? 'block' : 'none' },
        classList: { add() {}, remove() {} }
    }]));
    const document = {
        body: { setAttribute(name, value) { attributes.set(name, value); } },
        getElementById(id) { return elements.get(id) ?? null; },
        querySelector() { return null; }
    };

    vm.runInNewContext(`${source.slice(start, end)}\nshowLoginScreen();`, { document });

    assert.equal(attributes.get('data-screen'), 'login');
    assert.equal(elements.get('auth-container').style.display, 'block');
    assert.equal(elements.get('category-container').style.display, 'none');
    assert.equal(elements.get('words-menu-container').style.display, 'none');
});

test('firebase environment resolver loads before Firebase initialization', () => {
    const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
    const environmentScript = html.indexOf('<script src="js/firebase-environment.js"></script>');
    const passwordResetScript = html.indexOf('<script src="js/password-reset.js"></script>');
    const emailVerificationScript = html.indexOf('<script src="js/email-verification.js"></script>');
    const authUIScript = html.indexOf('<script src="js/auth-ui.js"></script>');
    const firebaseConfigScript = html.indexOf('<script src="js/firebase-config.js"></script>');

    assert.notEqual(environmentScript, -1);
    assert.notEqual(passwordResetScript, -1);
    assert.notEqual(emailVerificationScript, -1);
    assert.notEqual(authUIScript, -1);
    assert.notEqual(firebaseConfigScript, -1);
    assert.ok(environmentScript < passwordResetScript);
    assert.ok(passwordResetScript < emailVerificationScript);
    assert.ok(emailVerificationScript < authUIScript);
    assert.ok(authUIScript < firebaseConfigScript);
});

test('Firebase auth helpers do not redeclare the shared navigation function names', () => {
    const source = fs.readFileSync(path.join(__dirname, '../js/firebase-config.js'), 'utf8');

    assert.match(source, /function showAuthScreen\(/);
    assert.doesNotMatch(source, /function showScreen\(/);
    assert.doesNotMatch(source, /function showCategoryScreen\(/);
    assert.doesNotMatch(source, /window\.showCategoryScreen\s*=/);
});

test('local HTTP development connects only to the demo Firebase emulators', () => {
    const local = initializeFirebaseAt({ protocol: 'http:', hostname: 'localhost' });

    assert.equal(local.appConfig.projectId, 'demo-english-next-level');
    assert.equal(local.environment, 'test');
    assert.deepEqual(local.authCalls, [['http://127.0.0.1:9099']]);
    assert.deepEqual(local.firestoreCalls, [['127.0.0.1', 8080]]);
    assert.deepEqual(local.functionsCalls, [['127.0.0.1', 5001]]);
});

test('file URLs also use emulators instead of the live Firebase project', () => {
    const localFile = initializeFirebaseAt({ protocol: 'file:', hostname: '' });

    assert.equal(localFile.appConfig.projectId, 'demo-english-next-level');
    assert.equal(localFile.environment, 'test');
    assert.equal(localFile.authCalls.length, 1);
    assert.equal(localFile.firestoreCalls.length, 1);
    assert.deepEqual(localFile.functionsCalls, [['127.0.0.1', 5001]]);
});

test('hosted site keeps the configured live Firebase project', () => {
    const hosted = initializeFirebaseAt({
        protocol: 'https:',
        hostname: 'wolfschiffer.github.io',
        port: '',
        pathname: '/EnglishNextLevel/',
        search: ''
    });

    assert.equal(hosted.appConfig.projectId, 'english-next-level-game');
    assert.equal(hosted.environment, 'production');
    assert.deepEqual(hosted.authCalls, []);
    assert.deepEqual(hosted.firestoreCalls, []);
    assert.deepEqual(hosted.functionsCalls, []);
});

test('a nonstandard port on the GitHub Pages host uses local emulators', () => {
    const preview = initializeFirebaseAt({
        protocol: 'https:',
        hostname: 'wolfschiffer.github.io',
        port: '8443',
        pathname: '/EnglishNextLevel/',
        search: ''
    });

    assert.equal(preview.appConfig.projectId, 'demo-english-next-level');
    assert.equal(preview.environment, 'test');
    assert.equal(preview.authCalls.length, 1);
    assert.equal(preview.firestoreCalls.length, 1);
    assert.deepEqual(preview.functionsCalls, [['127.0.0.1', 5001]]);
});

test('a preview path on the GitHub Pages host uses local emulators', () => {
    const preview = initializeFirebaseAt({
        protocol: 'https:',
        hostname: 'wolfschiffer.github.io',
        pathname: '/EnglishNextLevel-preview/',
        search: ''
    });

    assert.equal(preview.appConfig.projectId, 'demo-english-next-level');
    assert.equal(preview.environment, 'test');
    assert.equal(preview.authCalls.length, 1);
    assert.equal(preview.firestoreCalls.length, 1);
    assert.deepEqual(preview.functionsCalls, [['127.0.0.1', 5001]]);
});

test('a case-variant project path does not select production Firebase', () => {
    const caseVariant = initializeFirebaseAt({
        protocol: 'https:',
        hostname: 'wolfschiffer.github.io',
        pathname: '/englishnextlevel/',
        search: ''
    });

    assert.equal(caseVariant.appConfig.projectId, 'demo-english-next-level');
    assert.equal(caseVariant.environment, 'test');
    assert.equal(caseVariant.authCalls.length, 1);
    assert.equal(caseVariant.firestoreCalls.length, 1);
    assert.deepEqual(caseVariant.functionsCalls, [['127.0.0.1', 5001]]);
});

test('a project path with repeated trailing slashes does not select production Firebase', () => {
    const repeatedSlashes = initializeFirebaseAt({
        protocol: 'https:',
        hostname: 'wolfschiffer.github.io',
        pathname: '/EnglishNextLevel///',
        search: ''
    });

    assert.equal(repeatedSlashes.appConfig.projectId, 'demo-english-next-level');
    assert.equal(repeatedSlashes.environment, 'test');
    assert.equal(repeatedSlashes.authCalls.length, 1);
    assert.equal(repeatedSlashes.firestoreCalls.length, 1);
    assert.deepEqual(repeatedSlashes.functionsCalls, [['127.0.0.1', 5001]]);
});

test('the test query parameter forces emulators on the production URL', () => {
    const forcedTest = initializeFirebaseAt({
        protocol: 'https:',
        hostname: 'wolfschiffer.github.io',
        pathname: '/EnglishNextLevel/',
        search: '?enlFirebase=test'
    });

    assert.equal(forcedTest.appConfig.projectId, 'demo-english-next-level');
    assert.equal(forcedTest.environment, 'test');
    assert.equal(forcedTest.authCalls.length, 1);
    assert.equal(forcedTest.firestoreCalls.length, 1);
    assert.deepEqual(forcedTest.functionsCalls, [['127.0.0.1', 5001]]);
});

test('an invalid or ambiguous Firebase override fails closed to local emulators', () => {
    for (const search of ['?enlFirebase=tes', '?enlFirebase=qa&enlFirebase=test']) {
        const invalidOverride = initializeFirebaseAt({
            protocol: 'https:',
            hostname: 'wolfschiffer.github.io',
            pathname: '/EnglishNextLevel/',
            search
        });

        assert.equal(invalidOverride.appConfig.projectId, 'demo-english-next-level');
        assert.equal(invalidOverride.environment, 'test');
        assert.equal(invalidOverride.authCalls.length, 1);
        assert.equal(invalidOverride.firestoreCalls.length, 1);
        assert.deepEqual(invalidOverride.functionsCalls, [['127.0.0.1', 5001]]);
    }
});

test('the QA query parameter uses the separate QA Firebase project without emulators', () => {
    const qa = initializeFirebaseAt({
        protocol: 'http:',
        hostname: 'localhost',
        pathname: '/',
        search: '?enlFirebase=qa'
    });

    assert.equal(qa.appConfig.projectId, 'englishnextlevel-qa');
    assert.equal(qa.appConfig.authDomain, 'englishnextlevel-qa.firebaseapp.com');
    assert.equal(qa.environment, 'qa');
    assert.deepEqual(qa.authCalls, []);
    assert.deepEqual(qa.firestoreCalls, []);
    assert.deepEqual(qa.functionsCalls, []);
});

test('the QA query parameter overrides the production path without selecting production Firebase', () => {
    const qaOnHostedPath = initializeFirebaseAt({
        protocol: 'https:',
        hostname: 'wolfschiffer.github.io',
        pathname: '/EnglishNextLevel/',
        search: '?enlFirebase=qa'
    });

    assert.equal(qaOnHostedPath.appConfig.projectId, 'englishnextlevel-qa');
    assert.equal(qaOnHostedPath.environment, 'qa');
    assert.deepEqual(qaOnHostedPath.authCalls, []);
    assert.deepEqual(qaOnHostedPath.firestoreCalls, []);
    assert.deepEqual(qaOnHostedPath.functionsCalls, []);
});

test('a case-variant Firebase override key still selects QA instead of production', () => {
    const qaWithCaseVariant = initializeFirebaseAt({
        protocol: 'https:',
        hostname: 'wolfschiffer.github.io',
        pathname: '/EnglishNextLevel/',
        search: '?ENLFirebase=qa'
    });

    assert.equal(qaWithCaseVariant.appConfig.projectId, 'englishnextlevel-qa');
    assert.equal(qaWithCaseVariant.environment, 'qa');
    assert.deepEqual(qaWithCaseVariant.authCalls, []);
    assert.deepEqual(qaWithCaseVariant.firestoreCalls, []);
    assert.deepEqual(qaWithCaseVariant.functionsCalls, []);
});

test('LAN and non-production preview hosts fail closed to local emulators', () => {
    for (const hostname of ['192.168.1.25', 'preview.example.test']) {
        const nonProduction = initializeFirebaseAt({ protocol: 'http:', hostname });

        assert.equal(nonProduction.appConfig.projectId, 'demo-english-next-level');
        assert.equal(nonProduction.authCalls.length, 1);
        assert.equal(nonProduction.firestoreCalls.length, 1);
        assert.deepEqual(nonProduction.functionsCalls, [['127.0.0.1', 5001]]);
    }
});

test('Firebase CLI defaults to a demo project and loopback-only emulators', () => {
    const config = JSON.parse(fs.readFileSync(path.join(__dirname, '../firebase.json'), 'utf8'));
    const project = JSON.parse(fs.readFileSync(path.join(__dirname, '../.firebaserc'), 'utf8'));
    const packageConfig = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));
    const emulatorStart = packageConfig.scripts['firebase:emulators'];
    const emulatorTests = packageConfig.scripts['test:emulators'];

    assert.equal(project.projects.default, 'demo-english-next-level');
    assert.match(emulatorStart, /npm exec --yes --package=firebase-tools@\d+\.\d+\.\d+ -- firebase emulators:start/);
    assert.match(emulatorStart, /--project demo-english-next-level/);
    assert.match(emulatorStart, /--only auth,firestore,functions/);
    assert.match(emulatorTests, /npm exec --yes --package=firebase-tools@\d+\.\d+\.\d+ -- firebase emulators:exec/);
    assert.match(emulatorTests, /--project demo-english-next-level/);
    assert.match(emulatorTests, /--only auth,firestore,functions/);
    assert.match(emulatorTests, /test-firestore-rules\.cjs && node scripts\/test-submit-score\.cjs/);
    assert.equal(config.emulators.auth.host, '127.0.0.1');
    assert.equal(config.emulators.firestore.host, '127.0.0.1');
    assert.equal(config.emulators.ui.host, '127.0.0.1');
});
