import { initializeApp } from 'firebase/app'
import {
  GoogleAuthProvider,
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  getAuth,
  updateProfile,
  signInWithEmailAndPassword,
  setPersistence,
  signInWithPopup,
  signInWithRedirect,
  signOut,
} from 'firebase/auth'
import { doc, getFirestore, serverTimestamp, setDoc } from 'firebase/firestore'

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
export const db = app ? getFirestore(app) : null

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

export async function saveUserProfile(user, profile = {}) {
  if (!db || !user) {
    throw new Error('Firebase Firestore is not configured.')
  }

  const firstName = profile.firstName?.trim() || ''
  const lastName = profile.lastName?.trim() || ''
  const displayName =
    profile.displayName?.trim() ||
    [firstName, lastName].filter(Boolean).join(' ') ||
    user.displayName ||
    ''

  await setDoc(
    doc(db, 'users', user.uid),
    {
      uid: user.uid,
      email: user.email || profile.email || '',
      firstName,
      lastName,
      displayName,
      photoURL: user.photoURL || '',
      providerIds: user.providerData.map((entry) => entry.providerId),
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    },
    { merge: true },
  )
}

export async function signInWithGoogle() {
  if (!auth || !googleProvider) {
    throw new Error('Firebase auth is not configured.')
  }

  await ensurePersistence()

  try {
    const result = await signInWithPopup(auth, googleProvider)
    await saveUserProfile(result.user, {
      displayName: result.user.displayName || '',
      email: result.user.email || '',
    })
    return result
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

export async function signInWithEmail(email, password) {
  if (!auth) {
    throw new Error('Firebase auth is not configured.')
  }

  await ensurePersistence()
  return signInWithEmailAndPassword(auth, email, password)
}

export async function signUpWithEmail(email, password) {
  if (!auth) {
    throw new Error('Firebase auth is not configured.')
  }

  await ensurePersistence()
  return createUserWithEmailAndPassword(auth, email, password)
}

export async function createUserAccount({
  email,
  password,
  firstName,
  lastName,
}) {
  const result = await signUpWithEmail(email, password)
  const displayName = [firstName?.trim(), lastName?.trim()]
    .filter(Boolean)
    .join(' ')

  if (displayName) {
    await updateProfile(result.user, { displayName })
  }

  await saveUserProfile(result.user, {
    firstName,
    lastName,
    displayName,
    email,
  })

  return result
}

export async function signOutUser() {
  if (!auth) {
    throw new Error('Firebase auth is not configured.')
  }

  await signOut(auth)
}
