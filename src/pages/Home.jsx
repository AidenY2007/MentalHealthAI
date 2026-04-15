import { useEffect, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import googleLogo from '../assets/google.svg.png'
import { siteConfig } from '../config/site'
import { scenarioCategories, scoringCategories } from '../data/scenarios'
import {
  auth,
  createReflection,
  createUserAccount,
  deleteReflection,
  hasFirebaseConfig,
  setScenarioCompletion,
  signInWithEmail,
  signInWithGoogle,
  signOutUser,
  subscribeToUserReflections,
  subscribeToUserProfile,
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

  function openNotesView() {
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
              <h2>General Notes</h2>
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

          <p className="scenario-empty">
            This notes page now has its own URL. Notes persistence can be added next.
          </p>
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
              <h3>Need help with your account?</h3>
              <p>
                Use this page for support resources, troubleshooting, and contact
                info as the app expands.
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

            <div className="scenario-list">
              <section className="scenario-group">
                <div className="scenario-group-heading">
                  <h3>Uncompleted</h3>
                  <span>{uncompletedScenarios.length}</span>
                </div>

                {uncompletedScenarios.length ? (
                  uncompletedScenarios.map((scenario) => (
                    <article key={scenario.id} className="scenario-item">
                      <div className="scenario-topline">
                        <h3>{scenario.name}</h3>
                        <span>{scenario.intensity}</span>
                      </div>
                      <p>{scenario.summary}</p>
                      <button
                        className="scenario-action button-reset"
                        disabled={updatingScenarioId === scenario.id}
                        onClick={() => handleScenarioToggle(scenario.id, true)}
                        type="button"
                      >
                        {updatingScenarioId === scenario.id
                          ? 'Saving...'
                          : 'Mark complete'}
                      </button>
                    </article>
                  ))
                ) : (
                  <p className="scenario-empty">All categories are completed.</p>
                )}
              </section>

              <section className="scenario-group">
                <div className="scenario-group-heading">
                  <h3>Completed</h3>
                  <span>{completedScenarios.length}</span>
                </div>

                {completedScenarios.length ? (
                  completedScenarios.map((scenario) => (
                    <article
                      key={scenario.id}
                      className="scenario-item scenario-item-complete"
                    >
                      <div className="scenario-topline">
                        <h3>{scenario.name}</h3>
                        <span>Completed</span>
                      </div>
                      <p>{scenario.summary}</p>
                      <button
                        className="scenario-action scenario-action-complete button-reset"
                        disabled={updatingScenarioId === scenario.id}
                        onClick={() => handleScenarioToggle(scenario.id, false)}
                        type="button"
                      >
                        {updatingScenarioId === scenario.id
                          ? 'Saving...'
                          : 'Mark incomplete'}
                      </button>
                    </article>
                  ))
                ) : (
                  <p className="scenario-empty">No categories completed yet.</p>
                )}
              </section>
            </div>
          </article>
        </section>

        <section className="workspace-grid" id="workspace">
          <article className="workspace-card">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Scoring</p>
                <h2>Evaluate more than whether the chat felt nice</h2>
              </div>
            </div>

            <div className="score-list">
              {scoringCategories.map((category) => (
                <article key={category.title} className="score-item">
                  <h3>{category.title}</h3>
                  <p>{category.description}</p>
                </article>
              ))}
            </div>
          </article>
        </section>
      </>
    )
  }

  let pageContent = renderDashboard()

  if (currentPath === '/reflections') {
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
