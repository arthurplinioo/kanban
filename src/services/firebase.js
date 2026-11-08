import { initializeApp } from 'firebase/app';
import {
  getAuth, initializeAuth, indexedDBLocalPersistence, browserLocalPersistence, browserPopupRedirectResolver,
  GoogleAuthProvider, signInWithPopup, signInWithRedirect, signOut as fbSignOut, onAuthStateChanged,
  connectAuthEmulator, signInWithCredential,
} from 'firebase/auth';
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager, connectFirestoreEmulator,
} from 'firebase/firestore';
import { VARIANT } from '../config/variant';

const env = import.meta.env;
const config = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  appId: env.VITE_FIREBASE_APP_ID,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
};
const useEmulator = env.VITE_FIREBASE_EMULATOR === 'true';

export const firebaseEnabled = Boolean(useEmulator || (config.apiKey && config.projectId && config.appId));

let app = null;
let auth = null;
let db = null;

if (firebaseEnabled) {
  // Nome de app por variante: a sessao de login fica isolada entre a versao
  // padrao e a rosa, mesmo estando no mesmo dominio e no mesmo aparelho.
  app = initializeApp(useEmulator ? { apiKey: 'demo-key', projectId: 'demo-taskflow', authDomain: 'localhost' } : config, `taskflow-${VARIANT}`);
  auth = initializeAuth(app, {
    persistence: [indexedDBLocalPersistence, browserLocalPersistence],
    popupRedirectResolver: browserPopupRedirectResolver,
  });
  auth.languageCode = 'pt-BR';
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  });
  // Comparacao direta com import.meta.env: o Vite troca por constante no
  // build e remove este bloco das versoes publicadas.
  if (import.meta.env.VITE_FIREBASE_EMULATOR === 'true') {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    connectFirestoreEmulator(db, '127.0.0.1', 8080);
    window.__taskflowTestSignIn = (email) => signInWithCredential(
      auth,
      GoogleAuthProvider.credential(JSON.stringify({ sub: email, email, email_verified: true, name: email.split('@')[0] })),
    );
  }
}

export function getDb() {
  return db;
}

export function getFirebaseAuth() {
  return auth || (app ? getAuth(app) : null);
}

export function watchAuth(callback) {
  if (!auth) {
    callback(null);
    return () => {};
  }
  return onAuthStateChanged(auth, callback);
}

export async function signInWithGoogle() {
  if (!auth) throw new Error('Login indisponivel');
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  try {
    return await signInWithPopup(auth, provider);
  } catch (error) {
    // Alguns navegadores bloqueiam a janela de login; o redirecionamento e o plano B.
    if (error?.code === 'auth/popup-blocked' || error?.code === 'auth/operation-not-supported-in-this-environment') {
      return signInWithRedirect(auth, provider);
    }
    throw error;
  }
}

export function signOutFirebase() {
  return auth ? fbSignOut(auth) : Promise.resolve();
}
