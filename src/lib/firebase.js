import { initializeApp } from 'firebase/app'
import {
  GoogleAuthProvider,
  browserLocalPersistence,
  getAuth,
  setPersistence,
  signInWithPopup,
  signInWithRedirect,
  signOut,
} from 'firebase/auth'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
}

const requiredConfigKeys = [
  'apiKey',
  'authDomain',
  'projectId',
  'storageBucket',
  'messagingSenderId',
  'appId',
]

export const hasFirebaseConfig = requiredConfigKeys.every(
  (key) => firebaseConfig[key],
)

const app = hasFirebaseConfig ? initializeApp(firebaseConfig) : null
export const auth = app ? getAuth(app) : null

const googleProvider = auth ? new GoogleAuthProvider() : null

if (googleProvider) {
  googleProvider.setCustomParameters({
    prompt: 'select_account',
  })
}

async function ensurePersistence() {
  if (!auth) {
    throw new Error('Firebase auth is not configured.')
  }

  await setPersistence(auth, browserLocalPersistence)
}

export async function signInWithGoogle() {
  if (!auth || !googleProvider) {
    throw new Error('Firebase auth is not configured.')
  }

  await ensurePersistence()

  try {
    return await signInWithPopup(auth, googleProvider)
  } catch (error) {
    const fallbackCodes = new Set([
      'auth/popup-blocked',
      'auth/popup-closed-by-user',
      'auth/cancelled-popup-request',
      'auth/operation-not-supported-in-this-environment',
    ])

    if (!fallbackCodes.has(error.code)) {
      throw error
    }

    await signInWithRedirect(auth, googleProvider)
    return null
  }
}

export async function signOutUser() {
  if (!auth) {
    throw new Error('Firebase auth is not configured.')
  }

  await signOut(auth)
}
