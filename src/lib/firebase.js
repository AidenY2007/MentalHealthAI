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
import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getFirestore,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore'

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

  const nextProfile = {
    uid: user.uid,
    email: user.email || profile.email || '',
    firstName,
    lastName,
    displayName,
    photoURL: user.photoURL || '',
    providerIds: user.providerData.map((entry) => entry.providerId),
    updatedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
  }

  if (profile.completedScenarioIds) {
    nextProfile.completedScenarioIds = profile.completedScenarioIds
  }

  await setDoc(doc(db, 'users', user.uid), nextProfile, { merge: true })
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
    completedScenarioIds: [],
  })

  return result
}

export async function signOutUser() {
  if (!auth) {
    throw new Error('Firebase auth is not configured.')
  }

  await signOut(auth)
}

export function subscribeToUserProfile(userId, onValue, onError) {
  if (!db || !userId) {
    return () => {}
  }

  return onSnapshot(doc(db, 'users', userId), onValue, onError)
}

export async function setScenarioCompletion(userId, scenarioId, completed) {
  if (!db || !userId) {
    throw new Error('Firebase Firestore is not configured.')
  }

  await updateDoc(doc(db, 'users', userId), {
    completedScenarioIds: completed
      ? arrayUnion(scenarioId)
      : arrayRemove(scenarioId),
    updatedAt: serverTimestamp(),
  })
}

export function subscribeToUserReflections(userId, onValue, onError) {
  if (!db || !userId) {
    return () => {}
  }

  return onSnapshot(
    collection(db, 'users', userId, 'reflections'),
    onValue,
    onError,
  )
}

export async function createReflection({ userId, email, title, responses }) {
  if (!db || !userId) {
    throw new Error('Firebase Firestore is not configured.')
  }

  return addDoc(collection(db, 'users', userId, 'reflections'), {
    userId,
    email: email || '',
    title,
    responses,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

export async function updateReflection({
  userId,
  reflectionId,
  title,
  responses,
}) {
  if (!db || !userId || !reflectionId) {
    throw new Error('Firebase Firestore is not configured.')
  }

  await updateDoc(doc(db, 'users', userId, 'reflections', reflectionId), {
    title,
    responses,
    updatedAt: serverTimestamp(),
  })
}

export async function deleteReflection(userId, reflectionId) {
  if (!db || !userId || !reflectionId) {
    throw new Error('Firebase Firestore is not configured.')
  }

  await deleteDoc(doc(db, 'users', userId, 'reflections', reflectionId))
}
