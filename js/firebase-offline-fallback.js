// Keep guest play available when the Firebase CDN cannot be reached.
(function installFirebaseOfflineFallback(root) {
    const hasCoreSdk = root.firebase
        && typeof root.firebase.initializeApp === 'function'
        && typeof root.firebase.auth === 'function'
        && typeof root.firebase.firestore === 'function';

    if (hasCoreSdk) return;

    function unavailable(service) {
        const error = new Error(`${service} is unavailable. Continue as Guest to keep playing.`);
        error.code = 'auth/network-request-failed';
        return Promise.reject(error);
    }

    const auth = {
        currentUser: null,
        useEmulator() {},
        onAuthStateChanged() {
            return () => {};
        },
        signInWithEmailAndPassword() {
            return unavailable('Firebase Authentication');
        },
        createUserWithEmailAndPassword() {
            return unavailable('Firebase Authentication');
        },
        sendPasswordResetEmail() {
            return unavailable('Firebase Authentication');
        },
        signOut() {
            this.currentUser = null;
            return Promise.resolve();
        }
    };

    const db = {
        useEmulator() {},
        collection() {
            return {
                doc() {
                    return {
                        get() {
                            return unavailable('Cloud Firestore');
                        },
                        set() {
                            return unavailable('Cloud Firestore');
                        }
                    };
                }
            };
        },
        runTransaction() {
            return unavailable('Cloud Firestore');
        }
    };

    function firestore() {
        return db;
    }
    firestore.FieldValue = { serverTimestamp: () => null };

    root.firebase = {
        initializeApp() {},
        auth: () => auth,
        firestore,
        functions: undefined
    };
    root.enlFirebaseUnavailable = true;
    root.console?.warn?.('Firebase could not load. Account services are unavailable; guest play remains available.');
})(typeof window !== 'undefined' ? window : globalThis);
