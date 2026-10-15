(function () {
    const QA_FIREBASE_CONFIG = {
        apiKey: 'AIzaSyAFxNJD5jTmidQ0PsiPZI2wUfI4Ef9nS78',
        authDomain: 'englishnextlevel-qa.firebaseapp.com',
        projectId: 'englishnextlevel-qa',
        storageBucket: 'englishnextlevel-qa.firebasestorage.app',
        messagingSenderId: '545762956265',
        appId: '1:545762956265:web:1fe4a35f1d383cd1cdb178'
    };
    const LIVE_FIREBASE_CONFIG = {
        apiKey: 'AIzaSyCkEdRxvECKNmVcMfqDE4jTE_qoNXF7p5c',
        authDomain: 'english-next-level-game.firebaseapp.com',
        projectId: 'english-next-level-game',
        storageBucket: 'english-next-level-game.firebasestorage.app',
        messagingSenderId: '422019063374',
        appId: '1:422019063374:web:b55130f33775f7e1b0ad1f'
    };

    function resolve(location) {
        const overrides = [...new URLSearchParams(location.search || '').entries()]
            .filter(([key]) => key.toLowerCase() === 'enlfirebase')
            .map(([, value]) => value.trim().toLowerCase());
        const mode = overrides.length === 1 ? overrides[0] : '';
        const useQaProject = mode === 'qa';
        const invalidOverride = overrides.length > 0 &&
            (overrides.length !== 1 || !['test', 'qa'].includes(mode));
        const useProduction = location.protocol === 'https:' &&
            location.hostname === 'wolfschiffer.github.io' &&
            (!location.port || location.port === '443') &&
            (location.pathname === '/EnglishNextLevel' || location.pathname === '/EnglishNextLevel/') &&
            mode !== 'test' &&
            !useQaProject &&
            !invalidOverride;
        const useLocalEmulators = !useProduction && !useQaProject;
        const name = useQaProject
            ? 'qa'
            : useLocalEmulators ? 'test' : 'production';
        const firebaseConfig = useQaProject
            ? { ...QA_FIREBASE_CONFIG }
            : {
                ...LIVE_FIREBASE_CONFIG,
                projectId: useLocalEmulators ? 'demo-english-next-level' : LIVE_FIREBASE_CONFIG.projectId
            };

        return { name, useLocalEmulators, firebaseConfig };
    }

    window.EnlFirebaseEnvironment = {
        resolve,
        current: resolve(window.location)
    };
})();
