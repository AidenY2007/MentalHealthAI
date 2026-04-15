import { useEffect, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import googleLogo from '../assets/google.svg.png'
import { agentBlueprint } from '../config/agentBlueprint'
import { siteConfig } from '../config/site'
import { scenarioCategories, scoringCategories } from '../data/scenarios'
import {
  auth,
  createUserAccount,
  hasFirebaseConfig,
  signInWithEmail,
  signInWithGoogle,
  signOutUser,
} from '../lib/firebase'

const sampleConversation = [
  {
    role: 'Teen',
    tone: 'Guarded',
    message:
      'idk. my friend said i should text. things at home have been weird lately and i do not really want to talk about it.',
  },
  {
    role: 'Volunteer',
    tone: 'Warm',
    message:
      'You do not have to share everything at once. I am here with you, and we can go at your pace.',
  },
  {
    role: 'Teen',
    tone: 'Opening up',
    message:
      'thanks. it just feels like everyone expects me to act normal. my mom keeps yelling and i am tired all the time.',
  },
]

const roadmapItems = [
  'Firebase auth for guest mode, saved sessions, notes, and conversation history',
  'Scenario difficulty controls with realism settings, risk tags, and progression pacing',
  'OpenAI-driven teen simulator with feedback, transcript review, and post-session scoring',
]

const MIN_PASSWORD_LENGTH = 8

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

function Home() {
  const [user, setUser] = useState(null)
  const [authError, setAuthError] = useState('')
  const [isSigningIn, setIsSigningIn] = useState(false)
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false)
  const [authMode, setAuthMode] = useState('login')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

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
      const result = await signInWithGoogle()

      if (result === null) {
        closeAuthModal()
      } else {
        closeAuthModal()
      }
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

    try {
      await signOutUser()
    } catch (error) {
      setAuthError(error.message || 'Sign-out failed.')
    }
  }

  const greetingName =
    user?.displayName?.trim()?.split(/\s+/)[0] ||
    user?.email?.split('@')[0] ||
    'there'
  const heroGreeting = `${getGreeting()}, ${greetingName}!`

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="topbar-mark">Early build</p>
          <p className="topbar-name">{siteConfig.name}</p>
        </div>

        <div className="topbar-actions">
          {user ? (
            <>
              <span className="topbar-user">
                {user.displayName || user.email || 'volunteer'}
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

      <section className="hero-panel">
        <div className="hero-copy">
          <h1>{heroGreeting}</h1>
          <p className="hero-text">{siteConfig.tagline}</p>

          {authError ? <p className="auth-error">{authError}</p> : null}
        </div>
      </section>

      <section className="workspace-grid" id="workspace">
        <article className="workspace-card workspace-card-wide">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Simulation workspace</p>
              <h2>Chat, notes, feedback, and saved transcripts in one flow</h2>
            </div>
            <span className="section-badge">Desktop and mobile ready</span>
          </div>

          <div className="workspace-preview">
            <div className="chat-column">
              <div className="panel-header">
                <div>
                  <p className="panel-title">Live scenario</p>
                  <p className="panel-subtitle">
                    Emotional abuse at home · medium escalation
                  </p>
                </div>
                <button className="ghost-button" type="button">
                  Save transcript
                </button>
              </div>

              <div className="conversation-feed">
                {sampleConversation.map((entry) => (
                  <article key={entry.message} className="message-card">
                    <div className="message-meta">
                      <strong>{entry.role}</strong>
                      <span>{entry.tone}</span>
                    </div>
                    <p>{entry.message}</p>
                  </article>
                ))}
              </div>

              <div className="composer-row">
                <div className="composer-box">
                  <span className="composer-label">Volunteer response</span>
                  <p>
                    Reflect emotion, validate uncertainty, and avoid pushing for
                    details too quickly.
                  </p>
                </div>
                <button className="primary-action button-reset" type="button">
                  Send practice reply
                </button>
              </div>
            </div>

            <aside className="notes-column">
              <div className="panel-header">
                <div>
                  <p className="panel-title">Volunteer notes</p>
                  <p className="panel-subtitle">
                    Private workspace beside the chat
                  </p>
                </div>
              </div>

              <div className="notes-pad">
                <p>Observed themes</p>
                <ul>
                  <li>Feels pressure to act normal at home</li>
                  <li>Possible emotional abuse and exhaustion</li>
                  <li>Trust increases after paced validation</li>
                </ul>
              </div>

              <div className="notes-pad notes-pad-soft">
                <p>After-session feedback</p>
                <ul>
                  <li>Empathy score: 8.7 / 10</li>
                  <li>Risk assessment: needs follow-up questions</li>
                  <li>Strength: pace and tone stayed nonjudgmental</li>
                </ul>
              </div>
            </aside>
          </div>
        </article>

        <article className="workspace-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Scenario library</p>
              <h2>Built for realistic training variety</h2>
            </div>
          </div>

          <div className="scenario-list">
            {scenarioCategories.map((scenario) => (
              <article key={scenario.name} className="scenario-item">
                <div className="scenario-topline">
                  <h3>{scenario.name}</h3>
                  <span>{scenario.intensity}</span>
                </div>
                <p>{scenario.summary}</p>
              </article>
            ))}
          </div>
        </article>

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

      <section className="blueprint-grid" id="agent-blueprint">
        <article className="workspace-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Agent blueprint</p>
              <h2>Persistent rules for future OpenAI agent setup</h2>
            </div>
          </div>

          <div className="blueprint-block">
            <h3>Core persona</h3>
            <p>{agentBlueprint.corePersona}</p>
          </div>

          <div className="blueprint-block">
            <h3>What the simulator should avoid</h3>
            <ul className="compact-list">
              {agentBlueprint.avoidRules.map((rule) => (
                <li key={rule}>{rule}</li>
              ))}
            </ul>
          </div>
        </article>

        <article className="workspace-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Implementation roadmap</p>
              <h2>Suggested next backend and product milestones</h2>
            </div>
          </div>

          <ul className="roadmap-list">
            {roadmapItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>

          <div className="stack-card">
            <p className="stack-title">Current stack target</p>
            <p>
              React + Vite frontend, Firebase for auth and persistence, OpenAI
              responses for teen simulation and coaching feedback.
            </p>
          </div>

          <div className="stack-card auth-next-step">
            <p className="stack-title">Auth wiring now in code</p>
            <p>
              Google sign-in uses <code>GoogleAuthProvider</code> with popup
              auth and redirect fallback. Email/password can be added next on
              top of the same Firebase client.
            </p>
          </div>
        </article>
      </section>

      {isAuthModalOpen ? (
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
      ) : null}
    </main>
  )
}

export default Home
