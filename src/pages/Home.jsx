import { useEffect, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import googleLogo from '../assets/google.svg.png'
import { siteConfig } from '../config/site'
import { scenarioCategories, scoringCategories } from '../data/scenarios'
import { IMPLEMENTED_SCENARIOS } from '../data/scenarioPrompts'
import {
  auth,
  createNote,
  createReflection,
  createUserAccount,
  deleteNote,
  deleteReflection,
  hasFirebaseConfig,
  setScenarioCompletion,
  signInWithEmail,
  signInWithGoogle,
  signOutUser,
  subscribeToUserNotes,
  subscribeToUserReflections,
  subscribeToUserProfile,
  updateNote,
  updateReflection,
} from '../lib/firebase'

const MIN_PASSWORD_LENGTH = 8
const validPaths = new Set(['/', '/reflections', '/notes', '/support'])

function normalizePath(pathname) {
  return validPaths.has(pathname) ? pathname : '/'
}

function formatReflectionDate(reflection) {
  const rawDate = reflection.createdAt?.toDate?.() || new Date()
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(rawDate)
}

function getFriendlyAuthError(error) {
  const messages = {
    'auth/email-already-in-use': 'That email is already in use.',
    'auth/invalid-email': 'Enter a valid email address.',
    'auth/invalid-credential': 'Incorrect email or password.',
    'auth/missing-password': 'Enter your password.',
    'auth/popup-closed-by-user': 'The Google sign-in popup was closed.',
    'auth/too-many-requests': 'Too many attempts. Try again shortly.',
    'auth/weak-password': `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
  }

  return messages[error?.code] || error?.message || 'Authentication failed.'
}

function getGreeting() {
  const hour = new Date().getHours()

  if (hour < 12) {
    return 'Good morning'
  }

  if (hour < 18) {
    return 'Good afternoon'
  }

  return 'Good evening'
}

function PencilIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 20 20">
      <path
        d="M13.958 3.542a1.768 1.768 0 0 1 2.5 2.5L7.5 15H5v-2.5l8.958-8.958Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.6"
      />
      <path
        d="M12.5 5l2.5 2.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.6"
      />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 20 20">
      <path
        d="M4.5 6h11"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.6"
      />
      <path
        d="M7.5 3.75h5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.6"
      />
      <path
        d="M7 6v8.25c0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75V6"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.6"
      />
      <path
        d="M8.75 8.5v4.25M11.25 8.5v4.25"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.6"
      />
    </svg>
  )
}

function Home() {
  const [user, setUser] = useState(null)
  const [currentPath, setCurrentPath] = useState(() =>
    normalizePath(window.location.pathname),
  )
  const [authError, setAuthError] = useState('')
  const [isSigningIn, setIsSigningIn] = useState(false)
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false)
  const [authMode, setAuthMode] = useState('login')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [completedScenarioIds, setCompletedScenarioIds] = useState([])
  const [completionError, setCompletionError] = useState('')
  const [updatingScenarioId, setUpdatingScenarioId] = useState('')
  const [reflections, setReflections] = useState([])
  const [reflectionError, setReflectionError] = useState('')
  const [selectedReflectionId, setSelectedReflectionId] = useState('')
  const [isCreatingReflection, setIsCreatingReflection] = useState(false)
  const [reflectionTitle, setReflectionTitle] = useState('')
  const [reflectionResponses, setReflectionResponses] = useState({})
  const [editingReflectionId, setEditingReflectionId] = useState('')
  const [deletingReflectionId, setDeletingReflectionId] = useState('')
  const [pendingDeleteReflectionId, setPendingDeleteReflectionId] = useState('')
  const [notes, setNotes] = useState([])
  const [noteError, setNoteError] = useState('')
  const [selectedNoteId, setSelectedNoteId] = useState('')
  const [isCreatingNote, setIsCreatingNote] = useState(false)
  const [noteTitle, setNoteTitle] = useState('')
  const [noteContent, setNoteContent] = useState('')
  const [editingNoteId, setEditingNoteId] = useState('')
  const [deletingNoteId, setDeletingNoteId] = useState('')
  const [pendingDeleteNoteId, setPendingDeleteNoteId] = useState('')

  useEffect(() => {
    function handlePopState() {
      setCurrentPath(normalizePath(window.location.pathname))
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  useEffect(() => {
    if (!auth) {
      return undefined
    }

    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser)
    })

    return unsubscribe
  }, [])

  useEffect(() => {
    if (!user?.uid) {
      setCompletedScenarioIds([])
      return undefined
    }

    return subscribeToUserProfile(
      user.uid,
      (snapshot) => {
        const data = snapshot.data()
        setCompletedScenarioIds(data?.completedScenarioIds || [])
      },
      () => {
        setCompletionError('Could not load your completed categories.')
      },
    )
  }, [user?.uid])

  useEffect(() => {
    if (!user?.uid) {
      setReflections([])
      setSelectedReflectionId('')
      return undefined
    }

    return subscribeToUserReflections(
      user.uid,
      (snapshot) => {
        setReflectionError('')
        const nextReflections = snapshot.docs
          .map((docSnapshot) => ({
            id: docSnapshot.id,
            ...docSnapshot.data(),
          }))
          .sort((left, right) => {
            const leftTime = left.createdAt?.seconds || 0
            const rightTime = right.createdAt?.seconds || 0
            return rightTime - leftTime
          })

        setReflections(nextReflections)
        setSelectedReflectionId((currentId) => {
          if (currentId === 'new') {
            return currentId
          }

          if (currentId && nextReflections.some((item) => item.id === currentId)) {
            return currentId
          }

          return nextReflections[0]?.id || ''
        })
      },
      () => {
        setReflectionError('Could not load your reflections.')
      },
    )
  }, [user?.uid])

  useEffect(() => {
    if (!user?.uid) {
      setNotes([])
      setSelectedNoteId('')
      return undefined
    }

    return subscribeToUserNotes(
      user.uid,
      (snapshot) => {
        setNoteError('')
        const nextNotes = snapshot.docs
          .map((docSnapshot) => ({
            id: docSnapshot.id,
            ...docSnapshot.data(),
          }))
          .sort((left, right) => {
            const leftTime = left.createdAt?.seconds || 0
            const rightTime = right.createdAt?.seconds || 0
            return rightTime - leftTime
          })

        setNotes(nextNotes)
        setSelectedNoteId((currentId) => {
          if (currentId === 'new') {
            return currentId
          }

          if (currentId && nextNotes.some((item) => item.id === currentId)) {
            return currentId
          }

          return nextNotes[0]?.id || ''
        })
      },
      () => {
        setNoteError('Could not load your notes.')
      },
    )
  }, [user?.uid])

  useEffect(() => {
    if (!isAuthModalOpen) {
      return undefined
    }

    function handleEscape(event) {
      if (event.key === 'Escape') {
        setIsAuthModalOpen(false)
      }
    }

    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [isAuthModalOpen])

  function navigateTo(path) {
    const nextPath = normalizePath(path)

    if (nextPath === currentPath) {
      return
    }

    window.history.pushState({}, '', nextPath)
    setCurrentPath(nextPath)
  }

  function openAuthModal(mode) {
    setAuthMode(mode)
    setAuthError('')
    setFirstName('')
    setLastName('')
    setEmail('')
    setPassword('')
    setIsAuthModalOpen(true)
  }

  function closeAuthModal() {
    setIsAuthModalOpen(false)
    setAuthError('')
  }

  async function handleGoogleSignIn() {
    setAuthError('')
    setIsSigningIn(true)

    try {
      await signInWithGoogle()
      closeAuthModal()
    } catch (error) {
      setAuthError(getFriendlyAuthError(error))
    } finally {
      setIsSigningIn(false)
    }
  }

  async function handleEmailAuth(event) {
    event.preventDefault()
    setAuthError('')

    if (authMode === 'signup' && password.length < MIN_PASSWORD_LENGTH) {
      setAuthError(
        `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
      )
      return
    }

    if (authMode === 'signup' && (!firstName.trim() || !lastName.trim())) {
      setAuthError('Enter both your first and last name.')
      return
    }

    setIsSigningIn(true)

    try {
      if (authMode === 'login') {
        await signInWithEmail(email, password)
      } else {
        await createUserAccount({
          email,
          password,
          firstName,
          lastName,
        })
      }

      closeAuthModal()
    } catch (error) {
      setAuthError(getFriendlyAuthError(error))
    } finally {
      setIsSigningIn(false)
    }
  }

  async function handleSignOut() {
    setAuthError('')
    setCompletionError('')

    try {
      await signOutUser()
    } catch (error) {
      setAuthError(error.message || 'Sign-out failed.')
    }
  }

  async function handleScenarioToggle(scenarioId, completed) {
    if (!user?.uid) {
      openAuthModal('login')
      return
    }

    setCompletionError('')
    setUpdatingScenarioId(scenarioId)

    try {
      await setScenarioCompletion(user.uid, scenarioId, completed)
    } catch (error) {
      setCompletionError(
        error.message || 'Could not update your completed categories.',
      )
    } finally {
      setUpdatingScenarioId('')
    }
  }

  function openReflectionsView() {
    if (!user?.uid) {
      openAuthModal('login')
      return
    }

    setReflectionError('')
    navigateTo('/reflections')
  }

  function openPractice(scenarioId) {
    if (!user?.uid) {
      openAuthModal('login')
      return
    }

    window.history.pushState({}, '', `/practice/${scenarioId}`)
    window.dispatchEvent(new Event('popstate'))
  }

  function openNotesView() {
    if (!user?.uid) {
      openAuthModal('login')
      return
    }

    setNoteError('')
    navigateTo('/notes')
  }

  function openNewReflection() {
    const emptyResponses = Object.fromEntries(
      scoringCategories.map((category) => [category.title, '']),
    )

    setReflectionTitle('')
    setReflectionResponses(emptyResponses)
    setEditingReflectionId('')
    setSelectedReflectionId('new')
    setReflectionError('')
  }

  function openEditReflection(reflection) {
    setReflectionTitle(reflection.title || '')
    setReflectionResponses(
      Object.fromEntries(
        scoringCategories.map((category) => [
          category.title,
          reflection.responses?.[category.title] || '',
        ]),
      ),
    )
    setEditingReflectionId(reflection.id)
    setSelectedReflectionId('new')
    setReflectionError('')
  }

  async function handleCreateReflection(event) {
    event.preventDefault()

    if (!user?.uid) {
      openAuthModal('login')
      return
    }

    setReflectionError('')
    setIsCreatingReflection(true)

    try {
      if (!reflectionTitle.trim()) {
        setReflectionError('Enter a title for your reflection.')
        setIsCreatingReflection(false)
        return
      }

      const title = reflectionTitle.trim()
      if (editingReflectionId) {
        await updateReflection({
          userId: user.uid,
          reflectionId: editingReflectionId,
          title,
          responses: reflectionResponses,
        })

        setReflections((current) =>
          current.map((reflection) =>
            reflection.id === editingReflectionId
              ? {
                  ...reflection,
                  title,
                  responses: reflectionResponses,
                }
              : reflection,
          ),
        )
      } else {
        const docRef = await createReflection({
          userId: user.uid,
          email: user.email || '',
          title,
          responses: reflectionResponses,
        })

        const optimisticReflection = {
          id: docRef.id,
          userId: user.uid,
          email: user.email || '',
          title,
          responses: reflectionResponses,
          createdAt: { toDate: () => new Date() },
        }

        setReflections((current) => {
          if (current.some((reflection) => reflection.id === docRef.id)) {
            return current
          }

          return [optimisticReflection, ...current]
        })
      }

      setSelectedReflectionId('')
      setReflectionTitle('')
      setEditingReflectionId('')
    } catch (error) {
      setReflectionError(error.message || 'Could not save your reflection.')
    } finally {
      setIsCreatingReflection(false)
    }
  }

  async function handleDeleteReflection(reflectionId) {
    if (!user?.uid) {
      openAuthModal('login')
      return
    }

    setReflectionError('')
    setDeletingReflectionId(reflectionId)

    try {
      await deleteReflection(user.uid, reflectionId)
      setReflections((current) =>
        current.filter((reflection) => reflection.id !== reflectionId),
      )

      setSelectedReflectionId((current) =>
        current === reflectionId ? '' : current,
      )

      if (editingReflectionId === reflectionId) {
        setEditingReflectionId('')
        setReflectionTitle('')
        setReflectionResponses({})
        setSelectedReflectionId('')
      }
    } catch (error) {
      setReflectionError(error.message || 'Could not delete your reflection.')
    } finally {
      setDeletingReflectionId('')
    }
  }

  function requestDeleteReflection(reflectionId) {
    setPendingDeleteReflectionId(reflectionId)
    setReflectionError('')
  }

  function closeDeleteModal() {
    if (deletingReflectionId) {
      return
    }

    setPendingDeleteReflectionId('')
  }

  function handleReflectionResponseChange(title, value) {
    setReflectionResponses((current) => ({
      ...current,
      [title]: value,
    }))
  }

  function openNewNote() {
    setNoteTitle('')
    setNoteContent('')
    setEditingNoteId('')
    setSelectedNoteId('new')
    setNoteError('')
  }

  function openEditNote(note) {
    setNoteTitle(note.title || '')
    setNoteContent(note.content || '')
    setEditingNoteId(note.id)
    setSelectedNoteId('new')
    setNoteError('')
  }

  async function handleCreateNote(event) {
    event.preventDefault()

    if (!user?.uid) {
      openAuthModal('login')
      return
    }

    setNoteError('')
    setIsCreatingNote(true)

    try {
      if (!noteTitle.trim()) {
        setNoteError('Enter a title for your note.')
        setIsCreatingNote(false)
        return
      }

      const title = noteTitle.trim()
      const content = noteContent

      if (editingNoteId) {
        await updateNote({ userId: user.uid, noteId: editingNoteId, title, content })

        setNotes((current) =>
          current.map((note) =>
            note.id === editingNoteId ? { ...note, title, content } : note,
          ),
        )
      } else {
        const docRef = await createNote({
          userId: user.uid,
          email: user.email || '',
          title,
          content,
        })

        const optimisticNote = {
          id: docRef.id,
          userId: user.uid,
          email: user.email || '',
          title,
          content,
          createdAt: { toDate: () => new Date() },
        }

        setNotes((current) => {
          if (current.some((note) => note.id === docRef.id)) {
            return current
          }

          return [optimisticNote, ...current]
        })
      }

      setSelectedNoteId('')
      setNoteTitle('')
      setEditingNoteId('')
    } catch (error) {
      setNoteError(error.message || 'Could not save your note.')
    } finally {
      setIsCreatingNote(false)
    }
  }

  async function handleDeleteNote(noteId) {
    if (!user?.uid) {
      openAuthModal('login')
      return
    }

    setNoteError('')
    setDeletingNoteId(noteId)

    try {
      await deleteNote(user.uid, noteId)
      setNotes((current) => current.filter((note) => note.id !== noteId))

      setSelectedNoteId((current) => (current === noteId ? '' : current))

      if (editingNoteId === noteId) {
        setEditingNoteId('')
        setNoteTitle('')
        setNoteContent('')
        setSelectedNoteId('')
      }
    } catch (error) {
      setNoteError(error.message || 'Could not delete your note.')
    } finally {
      setDeletingNoteId('')
    }
  }

  function requestDeleteNote(noteId) {
    setPendingDeleteNoteId(noteId)
    setNoteError('')
  }

  function closeDeleteNoteModal() {
    if (deletingNoteId) {
      return
    }

    setPendingDeleteNoteId('')
  }

  const greetingName =
    user?.displayName?.trim()?.split(/\s+/)[0] ||
    user?.email?.split('@')[0] ||
    'there'
  const heroGreeting = `${getGreeting()}, ${greetingName}!`
  const uncompletedScenarios = scenarioCategories
    .filter((scenario) => !completedScenarioIds.includes(scenario.id))
    .sort((left, right) => left.name.localeCompare(right.name))
  const completedScenarios = scenarioCategories
    .filter((scenario) => completedScenarioIds.includes(scenario.id))
    .sort((left, right) => left.name.localeCompare(right.name))
  const completedCount = completedScenarioIds.filter((scenarioId) =>
    scenarioCategories.some((scenario) => scenario.id === scenarioId),
  ).length
  const progressPercent = Math.round(
    (completedCount / scenarioCategories.length) * 100,
  )
  const selectedReflection =
    reflections.find((reflection) => reflection.id === selectedReflectionId) || null
  const selectedNote =
    notes.find((note) => note.id === selectedNoteId) || null

  function renderTopbar() {
    return (
      <header className="topbar">
        <div>
          <button
            className="secondary-action button-reset"
            onClick={() => navigateTo('/support')}
            type="button"
          >
            Support
          </button>
        </div>

        <div className="topbar-actions">
          {user ? (
            <>
              <span className="topbar-user">
                {user.email || user.displayName || 'volunteer'}
              </span>
              <button
                className="secondary-action button-reset"
                onClick={handleSignOut}
                type="button"
              >
                Sign out
              </button>
            </>
          ) : (
            <>
              <button
                className="secondary-action button-reset"
                disabled={!hasFirebaseConfig}
                onClick={() => openAuthModal('login')}
                type="button"
              >
                Log in
              </button>
              <button
                className="primary-action button-reset"
                disabled={!hasFirebaseConfig}
                onClick={() => openAuthModal('signup')}
                type="button"
              >
                Sign up
              </button>
            </>
          )}
        </div>
      </header>
    )
  }

  function renderAuthModal() {
    if (!isAuthModalOpen) {
      return null
    }

    return (
      <div
        aria-hidden="true"
        className="auth-modal-backdrop"
        onClick={closeAuthModal}
      >
        <section
          aria-labelledby="auth-modal-title"
          aria-modal="true"
          className="auth-modal"
          onClick={(event) => event.stopPropagation()}
          role="dialog"
        >
          <div className="auth-modal-topline">
            <div>
              <p className="auth-modal-kicker">Secure access</p>
              <h2 id="auth-modal-title">
                {authMode === 'login' ? 'Log in' : 'Create your account'}
              </h2>
            </div>
            <button
              className="modal-close button-reset"
              onClick={closeAuthModal}
              type="button"
            >
              Close
            </button>
          </div>

          <div className="auth-segmented">
            <button
              className={`auth-segment ${authMode === 'login' ? 'is-active' : ''}`}
              onClick={() => setAuthMode('login')}
              type="button"
            >
              Log in
            </button>
            <button
              className={`auth-segment ${authMode === 'signup' ? 'is-active' : ''}`}
              onClick={() => setAuthMode('signup')}
              type="button"
            >
              Sign up
            </button>
          </div>

          <form className="auth-form" onSubmit={handleEmailAuth}>
            {authMode === 'signup' ? (
              <div className="auth-name-grid">
                <label className="auth-field">
                  <span>First name</span>
                  <input
                    autoComplete="given-name"
                    onChange={(event) => setFirstName(event.target.value)}
                    placeholder="First name"
                    type="text"
                    value={firstName}
                  />
                </label>

                <label className="auth-field">
                  <span>Last name</span>
                  <input
                    autoComplete="family-name"
                    onChange={(event) => setLastName(event.target.value)}
                    placeholder="Last name"
                    type="text"
                    value={lastName}
                  />
                </label>
              </div>
            ) : null}

            <label className="auth-field">
              <span>Email</span>
              <input
                autoComplete="email"
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                type="email"
                value={email}
              />
            </label>

            <label className="auth-field">
              <span>Password</span>
              <input
                autoComplete={
                  authMode === 'login' ? 'current-password' : 'new-password'
                }
                minLength={authMode === 'signup' ? MIN_PASSWORD_LENGTH : undefined}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
                type="password"
                value={password}
              />
            </label>

            <button
              className="primary-action button-reset auth-submit"
              disabled={!hasFirebaseConfig || isSigningIn}
              type="submit"
            >
              {isSigningIn
                ? 'Working...'
                : authMode === 'login'
                  ? 'Log in with email'
                  : 'Sign up with email'}
            </button>
          </form>

          <div className="auth-divider">
            <span>or continue with</span>
          </div>

          <button
            className="secondary-action button-reset auth-google"
            disabled={!hasFirebaseConfig || isSigningIn}
            onClick={handleGoogleSignIn}
            type="button"
          >
            <img
              alt=""
              aria-hidden="true"
              className="auth-google-logo"
              src={googleLogo}
            />
            {isSigningIn
              ? 'Working...'
              : authMode === 'login'
                ? 'Log in with Google'
                : 'Sign up with Google'}
          </button>

          {authError ? <p className="auth-error auth-error-modal">{authError}</p> : null}
        </section>
      </div>
    )
  }

  function renderSignedOutLanding() {
    const implementedCount = IMPLEMENTED_SCENARIOS.size
    const totalCount = scenarioCategories.length

    return (
      <section className="marketing-shell">
        <article className="marketing-hero">
          <div className="marketing-copy">
            <p className="marketing-kicker">Teen support simulation</p>
            <h1>Train for hard conversations before they become real ones.</h1>
            <p className="marketing-description">
              {siteConfig.name} is a rehearsal space for Teen Line volunteers.
              Practice realistic text conversations, document your thinking,
              and review how you handled moments that escalate slowly.
            </p>

            <div className="marketing-actions">
              <button
                className="primary-action button-reset"
                disabled={!hasFirebaseConfig}
                onClick={() => openAuthModal('signup')}
                type="button"
              >
                Create account
              </button>
              <button
                className="secondary-action button-reset"
                disabled={!hasFirebaseConfig}
                onClick={() => openAuthModal('login')}
                type="button"
              >
                Log in
              </button>
            </div>

            <div className="marketing-stats">
              <article className="marketing-stat">
                <strong>{totalCount}</strong>
                <span>scenario tracks</span>
              </article>
              <article className="marketing-stat">
                <strong>{implementedCount}</strong>
                <span>live simulations</span>
              </article>
              <article className="marketing-stat">
                <strong>{scoringCategories.length}</strong>
                <span>reflection lenses</span>
              </article>
            </div>
          </div>

          <div className="marketing-stage" aria-hidden="true">
            <div className="signal-grid">
              <div className="signal-card signal-card-primary">
                <span>Session feel</span>
                <strong>Starts vague. Opens with trust.</strong>
                <p>
                  The simulator does not reveal everything immediately, which
                  forces volunteers to pace empathy and curiosity correctly.
                </p>
              </div>
              <div className="signal-card signal-card-secondary">
                <span>Behavior model</span>
                <strong>Push back when the response misses.</strong>
                <p>
                  Dismissive or overly clinical replies make the teen close up,
                  shorten answers, or question the conversation.
                </p>
              </div>
              <div className="pulse-orbit pulse-orbit-a" />
              <div className="pulse-orbit pulse-orbit-b" />
              <div className="signal-thread thread-a" />
              <div className="signal-thread thread-b" />
            </div>
          </div>
        </article>

        <section className="marketing-grid">
          <article className="marketing-panel">
            <p className="marketing-kicker">What gets practiced</p>
            <h2>Not just chat replies. Actual volunteer judgment.</h2>
            <div className="marketing-list">
              <div className="marketing-list-item">
                <strong>Conversation pacing</strong>
                <span>
                  The teen begins uncertain, guarded, irritated, or indirect so
                  volunteers must earn clarity instead of extracting it.
                </span>
              </div>
              <div className="marketing-list-item">
                <strong>Boundary pressure</strong>
                <span>
                  Scenarios can question whether Teen Line is real, ask where
                  the volunteer lives, or try to blur the relationship.
                </span>
              </div>
              <div className="marketing-list-item">
                <strong>Post-session reflection</strong>
                <span>
                  Notes and reflections stay connected to the training workflow
                  so practice becomes reviewable instead of disposable.
                </span>
              </div>
            </div>
          </article>

          <article className="marketing-panel marketing-panel-accent">
            <p className="marketing-kicker">Training signals</p>
            <h2>Volunteers are measured on more than warmth.</h2>
            <div className="lens-stack">
              {scoringCategories.slice(0, 4).map((category, index) => (
                <div
                  key={category.title}
                  className="lens-card"
                  style={{ '--delay': `${index * 90}ms` }}
                >
                  <strong>{category.title}</strong>
                  <span>{category.description}</span>
                </div>
              ))}
            </div>
          </article>
        </section>

        <section className="marketing-band">
          <div className="marketing-band-copy">
            <p className="marketing-kicker">Scenario range</p>
            <h2>Bullying, abuse, suicide, identity, grief, anger, and more.</h2>
            <p>
              The library spans relationship stress, self-harm, sexual assault,
              eating disorders, difficult callers, and other high-stakes themes
              that volunteers need to encounter before live shifts.
            </p>
          </div>
          <div className="marketing-tags">
            {scenarioCategories.slice(0, 8).map((scenario) => (
              <span key={scenario.id} className="marketing-tag">
                {scenario.name}
              </span>
            ))}
          </div>
        </section>
      </section>
    )
  }

  function renderReflectionsPage() {
    return (
      <section className="reflection-page">
        <article className="workspace-card reflection-shell">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Reflections</p>
              <h2>My Reflections</h2>
            </div>
            <div className="reflection-actions">
              <button
                className="secondary-action button-reset"
                onClick={() => navigateTo('/')}
                type="button"
              >
                Back to dashboard
              </button>
              <button
                className="primary-action button-reset"
                onClick={openNewReflection}
                type="button"
              >
                New reflection
              </button>
            </div>
          </div>

          {reflectionError ? <p className="auth-error">{reflectionError}</p> : null}

          <div className="reflection-list">
              {reflections.length ? (
                reflections.map((reflection) => (
                  <article
                    key={reflection.id}
                    className={`reflection-list-item ${
                      selectedReflectionId === reflection.id ? 'is-active' : ''
                    }`}
                  >
                    <button
                      className="reflection-open button-reset"
                      onClick={() => setSelectedReflectionId(reflection.id)}
                      type="button"
                    >
                      <strong>{reflection.title}</strong>
                      <span>{formatReflectionDate(reflection)}</span>
                    </button>
                    <div className="reflection-item-actions">
                      <button
                        aria-label="Edit reflection"
                        className="reflection-icon-button button-reset"
                        onClick={() => openEditReflection(reflection)}
                        title="Edit reflection"
                        type="button"
                      >
                        <PencilIcon />
                      </button>
                      <button
                        aria-label="Delete reflection"
                        className="reflection-icon-button reflection-delete button-reset"
                        disabled={deletingReflectionId === reflection.id}
                        onClick={() => requestDeleteReflection(reflection.id)}
                        title="Delete reflection"
                        type="button"
                      >
                        {deletingReflectionId === reflection.id ? '…' : <TrashIcon />}
                      </button>
                    </div>
                  </article>
                ))
              ) : (
              <p className="scenario-empty">
                No reflections yet. Start one with the button below.
              </p>
            )}
          </div>

          {selectedReflectionId === 'new' ? (
              <>
                <div className="section-heading">
                  <div>
                    <p className="eyebrow">
                      {editingReflectionId ? 'Edit reflection' : 'New reflection'}
                    </p>
                    <h2>Evaluate more than whether the chat felt nice</h2>
                  </div>
                </div>

                <form className="reflection-form" onSubmit={handleCreateReflection}>
                  <label className="reflection-field">
                    <span>Add title</span>
                    <input
                      className="reflection-title-input"
                      onChange={(event) => setReflectionTitle(event.target.value)}
                      placeholder="Name this reflection so it is easy to find later."
                      type="text"
                      value={reflectionTitle}
                    />
                  </label>

                  {scoringCategories.map((category) => (
                    <label key={category.title} className="reflection-field">
                      <span>{category.title}</span>
                    <small>{category.description}</small>
                    <textarea
                      onChange={(event) =>
                        handleReflectionResponseChange(
                          category.title,
                          event.target.value,
                        )
                      }
                      placeholder="Write your reflection here..."
                      rows={4}
                      value={reflectionResponses[category.title] || ''}
                    />
                  </label>
                ))}

                <button
                  className="primary-action button-reset"
                  disabled={isCreatingReflection}
                  type="submit"
                >
                  {isCreatingReflection
                    ? 'Saving...'
                    : editingReflectionId
                      ? 'Save changes'
                      : 'Save reflection'}
                </button>
              </form>
            </>
          ) : selectedReflection ? (
            <>
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Saved reflection</p>
                  <h2>{selectedReflection.title}</h2>
                </div>
                <span className="section-badge">
                  {formatReflectionDate(selectedReflection)}
                </span>
              </div>

              <div className="reflection-content">
                {scoringCategories.map((category) => (
                  <article key={category.title} className="reflection-response">
                    <h3>{category.title}</h3>
                    <p className="reflection-prompt">{category.description}</p>
                    <p>
                      {selectedReflection.responses?.[category.title] ||
                        'No response saved.'}
                    </p>
                  </article>
                ))}
              </div>
            </>
          ) : null}
        </article>
      </section>
    )
  }

  function renderNotesPage() {
    return (
      <section className="reflection-page">
        <article className="workspace-card reflection-shell">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Notes</p>
              <h2>My Notes</h2>
            </div>
            <div className="reflection-actions">
              <button
                className="secondary-action button-reset"
                onClick={() => navigateTo('/')}
                type="button"
              >
                Back to dashboard
              </button>
              <button
                className="primary-action button-reset"
                onClick={openNewNote}
                type="button"
              >
                New note
              </button>
            </div>
          </div>

          {noteError ? <p className="auth-error">{noteError}</p> : null}

          <div className="reflection-list">
            {notes.length ? (
              notes.map((note) => (
                <article
                  key={note.id}
                  className={`reflection-list-item ${
                    selectedNoteId === note.id ? 'is-active' : ''
                  }`}
                >
                  <button
                    className="reflection-open button-reset"
                    onClick={() => setSelectedNoteId(note.id)}
                    type="button"
                  >
                    <strong>{note.title}</strong>
                    <span>{formatReflectionDate(note)}</span>
                  </button>
                  <div className="reflection-item-actions">
                    <button
                      aria-label="Edit note"
                      className="reflection-icon-button button-reset"
                      onClick={() => openEditNote(note)}
                      title="Edit note"
                      type="button"
                    >
                      <PencilIcon />
                    </button>
                    <button
                      aria-label="Delete note"
                      className="reflection-icon-button reflection-delete button-reset"
                      disabled={deletingNoteId === note.id}
                      onClick={() => requestDeleteNote(note.id)}
                      title="Delete note"
                      type="button"
                    >
                      {deletingNoteId === note.id ? '…' : <TrashIcon />}
                    </button>
                  </div>
                </article>
              ))
            ) : (
              <p className="scenario-empty">
                No notes yet. Start one with the button above.
              </p>
            )}
          </div>

          {selectedNoteId === 'new' ? (
            <>
              <div className="section-heading">
                <div>
                  <p className="eyebrow">
                    {editingNoteId ? 'Edit note' : 'New note'}
                  </p>
                  <h2>Keep quick reminders for future training sessions</h2>
                </div>
              </div>

              <form className="reflection-form" onSubmit={handleCreateNote}>
                <label className="reflection-field">
                  <span>Add title</span>
                  <input
                    className="reflection-title-input"
                    onChange={(event) => setNoteTitle(event.target.value)}
                    placeholder="Name this note so it is easy to find later."
                    type="text"
                    value={noteTitle}
                  />
                </label>

                <label className="reflection-field">
                  <span>Note</span>
                  <textarea
                    onChange={(event) => setNoteContent(event.target.value)}
                    placeholder="Write your note here..."
                    rows={8}
                    value={noteContent}
                  />
                </label>

                <button
                  className="primary-action button-reset"
                  disabled={isCreatingNote}
                  type="submit"
                >
                  {isCreatingNote
                    ? 'Saving...'
                    : editingNoteId
                      ? 'Save changes'
                      : 'Save note'}
                </button>
              </form>
            </>
          ) : selectedNote ? (
            <>
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Saved note</p>
                  <h2>{selectedNote.title}</h2>
                </div>
                <span className="section-badge">
                  {formatReflectionDate(selectedNote)}
                </span>
              </div>

              <div className="reflection-content">
                <article className="reflection-response">
                  <p>{selectedNote.content || 'No content saved.'}</p>
                </article>
              </div>
            </>
          ) : null}
        </article>
      </section>
    )
  }

  function renderSupportPage() {
    return (
      <section className="reflection-page">
        <article className="workspace-card reflection-shell">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Support</p>
              <h2>Support Center</h2>
            </div>
            <div className="reflection-actions">
              <button
                className="secondary-action button-reset"
                onClick={() => navigateTo('/')}
                type="button"
              >
                Back to dashboard
              </button>
            </div>
          </div>

          <div className="reflection-content">
            <article className="reflection-response">
              <h3>Need help?</h3>
              <p>
                Email <a href="mailto:zihan27@mhs-la.org">zihan27@mhs-la.org</a> or <a href="mailto:daisyyeon27@marlborough.org">daisyyeon27@marlborough.org</a>
              </p>
            </article>
          </div>
        </article>
      </section>
    )
  }

  function renderDashboard() {
    return (
      <>
        <section className="hero-panel">
          <div className="hero-copy">
            <div className="hero-layout">
              <div className="hero-copy-main">
                <h1>{heroGreeting}</h1>
                <p className="hero-brand">{siteConfig.name}</p>
                <p className="hero-text">{siteConfig.tagline}</p>
              </div>

              <div className="progress-card">
                <div className="progress-heading">
                  <div>
                    <p className="progress-label">Category progress</p>
                    <p className="progress-copy">
                      {completedCount} of {scenarioCategories.length} completed
                    </p>
                  </div>
                  <span className="progress-percent">{progressPercent}%</span>
                </div>
                <div aria-hidden="true" className="progress-track">
                  <div
                    className="progress-fill"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <div className="progress-actions">
                  <div className="progress-action-card">
                    <div>
                      <p className="progress-action-title">Reflection</p>
                      <p className="progress-action-copy">
                        Review what felt strong and what needs work.
                      </p>
                    </div>
                    <button
                      className="secondary-action button-reset progress-action-button"
                      onClick={openReflectionsView}
                      type="button"
                    >
                      Open
                    </button>
                  </div>

                  <div className="progress-action-card">
                    <div>
                      <p className="progress-action-title">General notes</p>
                      <p className="progress-action-copy">
                        Keep quick reminders for future training sessions.
                      </p>
                    </div>
                    <button
                      className="secondary-action button-reset progress-action-button"
                      onClick={openNotesView}
                      type="button"
                    >
                      Open
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {authError ? <p className="auth-error">{authError}</p> : null}
            {completionError ? <p className="auth-error">{completionError}</p> : null}
          </div>
        </section>

        <section className="scenario-section">
          <article className="workspace-card">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Scenario library</p>
                <h2>Begin Training</h2>
              </div>
            </div>

            <p className="scenario-group-label">Incomplete</p>
            <div className="scenario-list">
              {scenarioCategories
                .filter((s) => !completedScenarioIds.includes(s.id))
                .sort((a, b) => {
                  const aImpl = IMPLEMENTED_SCENARIOS.has(a.id) ? 0 : 1
                  const bImpl = IMPLEMENTED_SCENARIOS.has(b.id) ? 0 : 1
                  if (aImpl !== bImpl) return aImpl - bImpl
                  return a.name.localeCompare(b.name)
                })
                .map((scenario) => {
                  const implemented = IMPLEMENTED_SCENARIOS.has(scenario.id)
                  return (
                    <article key={scenario.id} className="scenario-item">
                      <div className="scenario-topline">
                        <h3>{scenario.name}</h3>
                        <span className={implemented ? 'scenario-status-implemented' : 'scenario-status-not-implemented'}>
                          {implemented ? 'Implemented' : 'Not implemented'}
                        </span>
                      </div>
                      <p>{scenario.summary}</p>
                      <button
                        className="scenario-action button-reset"
                        onClick={() => openPractice(scenario.id)}
                        type="button"
                      >
                        Start
                      </button>
                    </article>
                  )
                })}
            </div>

            {completedScenarios.length > 0 ? (
              <>
                <p className="scenario-group-label scenario-group-label-completed">Completed</p>
                <div className="scenario-list">
                  {completedScenarios
                    .slice()
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((scenario) => (
                      <article key={scenario.id} className="scenario-item scenario-item-completed">
                        <div className="scenario-topline">
                          <h3>{scenario.name}</h3>
                          <span className="scenario-status-completed">Completed</span>
                        </div>
                        <p>{scenario.summary}</p>
                        <button
                          className="scenario-action button-reset"
                          onClick={() => openPractice(scenario.id)}
                          type="button"
                        >
                          Practice again
                        </button>
                      </article>
                    ))}
                </div>
              </>
            ) : null}
          </article>
        </section>

      </>
    )
  }

  let pageContent = renderDashboard()

  if (!user && currentPath === '/') {
    pageContent = renderSignedOutLanding()
  } else if (currentPath === '/reflections') {
    pageContent = renderReflectionsPage()
  } else if (currentPath === '/notes') {
    pageContent = renderNotesPage()
  } else if (currentPath === '/support') {
    pageContent = renderSupportPage()
  }

  return (
    <>
      <main className="app-shell">
        {renderTopbar()}
        {pageContent}
        {renderAuthModal()}
      </main>

      {pendingDeleteNoteId ? (
        <div
          aria-hidden="true"
          className="auth-modal-backdrop"
          onClick={closeDeleteNoteModal}
        >
          <section
            aria-labelledby="delete-note-title"
            aria-modal="true"
            className="auth-modal delete-modal"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
          >
            <div className="auth-modal-topline">
              <div>
                <p className="auth-modal-kicker">Delete note</p>
                <h2 id="delete-note-title">
                  Are you sure you want to delete this note?
                </h2>
              </div>
            </div>

            <p className="delete-modal-copy">
              This will remove it from your saved notes permanently.
            </p>

            <div className="delete-modal-actions">
              <button
                className="secondary-action button-reset"
                disabled={Boolean(deletingNoteId)}
                onClick={closeDeleteNoteModal}
                type="button"
              >
                Cancel
              </button>
              <button
                className="primary-action delete-confirm button-reset"
                disabled={Boolean(deletingNoteId)}
                onClick={async () => {
                  await handleDeleteNote(pendingDeleteNoteId)
                  setPendingDeleteNoteId('')
                }}
                type="button"
              >
                {deletingNoteId ? 'Deleting...' : 'Delete note'}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {pendingDeleteReflectionId ? (
        <div
          aria-hidden="true"
          className="auth-modal-backdrop"
          onClick={closeDeleteModal}
        >
          <section
            aria-labelledby="delete-reflection-title"
            aria-modal="true"
            className="auth-modal delete-modal"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
          >
            <div className="auth-modal-topline">
              <div>
                <p className="auth-modal-kicker">Delete reflection</p>
                <h2 id="delete-reflection-title">
                  Are you sure you want to delete this reflection?
                </h2>
              </div>
            </div>

            <p className="delete-modal-copy">
              This will remove it from your saved reflections permanently.
            </p>

            <div className="delete-modal-actions">
              <button
                className="secondary-action button-reset"
                disabled={Boolean(deletingReflectionId)}
                onClick={closeDeleteModal}
                type="button"
              >
                Cancel
              </button>
              <button
                className="primary-action delete-confirm button-reset"
                disabled={Boolean(deletingReflectionId)}
                onClick={async () => {
                  await handleDeleteReflection(pendingDeleteReflectionId)
                  setPendingDeleteReflectionId('')
                }}
                type="button"
              >
                {deletingReflectionId ? 'Deleting...' : 'Delete reflection'}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  )
}

export default Home
