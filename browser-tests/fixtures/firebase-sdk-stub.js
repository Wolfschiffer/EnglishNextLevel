(() => {
    const auth = {
        currentUser: null,
        useEmulator() {},
        onAuthStateChanged(callback) {
            Promise.resolve().then(() => callback(null));
            return () => {};
        },
        signInWithEmailAndPassword() {
            return Promise.reject(new Error('Firebase is disabled in browser smoke tests.'));
        },
        createUserWithEmailAndPassword() {
            return Promise.reject(new Error('Firebase is disabled in browser smoke tests.'));
        },
        sendPasswordResetEmail() {
            return Promise.reject(new Error('Firebase is disabled in browser smoke tests.'));
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
                        get: async () => ({ exists: false }),
                        set: async () => {}
                    };
                }
            };
        }
    };

    const callableFunctions = {
        useEmulator() {},
        httpsCallable() {
            return async () => ({ data: null });
        }
    };

    function firestore() {
        return db;
    }
    firestore.FieldValue = { serverTimestamp: () => null };

    window.firebase = {
        initializeApp() {},
        auth: () => auth,
        firestore,
        functions: () => callableFunctions
    };
})();
