import { useEffect, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { agentBlueprint } from '../config/agentBlueprint'
import {
  experiencePillars,
  scenarioCategories,
  scoringCategories,
} from '../data/scenarios'
import { auth, hasFirebaseConfig, signInWithGoogle, signOutUser } from '../lib/firebase'

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

function Home() {
  const [user, setUser] = useState(null)
  const [authStatus, setAuthStatus] = useState('Checking authentication...')
  const [authError, setAuthError] = useState('')
  const [isSigningIn, setIsSigningIn] = useState(false)

  useEffect(() => {
    if (!auth) {
      setAuthStatus('Add your Firebase config in `.env` to enable sign-in.')
      return undefined
    }

    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser)
      setAuthStatus(
        nextUser
          ? `Signed in as ${nextUser.displayName || nextUser.email || 'volunteer'}`
          : 'Not signed in',
      )
    })

    return unsubscribe
  }, [])

  async function handleGoogleSignIn() {
    setAuthError('')
    setIsSigningIn(true)

    try {
      const result = await signInWithGoogle()

      if (result === null) {
        setAuthStatus('Redirecting to Google sign-in...')
      }
    } catch (error) {
      setAuthError(error.message || 'Google sign-in failed.')
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

  return (
    <main className="app-shell">
      <section className="hero-panel">
        <div className="hero-copy">
          <p className="eyebrow">TalkPrep</p>
          <h1>Practice teen crisis conversations before they happen live.</h1>
          <p className="hero-text">
            A training workspace for Teen Line volunteers. The AI plays a
            distressed teen, starts vague, reacts to empathy, pushes back when
            the volunteer misses the moment, and stays realistic instead of
            becoming agreeable or easy.
          </p>

          <div className="hero-actions">
            <a className="primary-action" href="#workspace">
              Explore the workspace
            </a>
            {user ? (
              <button
                className="secondary-action button-reset"
                onClick={handleSignOut}
                type="button"
              >
                Sign out
              </button>
            ) : (
              <button
                className="secondary-action button-reset"
                disabled={!hasFirebaseConfig || isSigningIn}
                onClick={handleGoogleSignIn}
                type="button"
              >
                {isSigningIn ? 'Signing in...' : 'Continue with Google'}
              </button>
            )}
          </div>

          <div className="auth-banner">
            <div>
              <p className="auth-label">Firebase authentication</p>
              <p className="auth-status">{authStatus}</p>
            </div>
            <span className="auth-mode">
              Email/Password + Google provider enabled
            </span>
          </div>

          {authError ? <p className="auth-error">{authError}</p> : null}

          <div className="hero-stats">
            <article>
              <strong>{scenarioCategories.length}</strong>
              <span>core scenario tracks</span>
            </article>
            <article>
              <strong>{scoringCategories.length}</strong>
              <span>feedback dimensions</span>
            </article>
            <article>
              <strong>2-column</strong>
              <span>desktop chat plus notes layout</span>
            </article>
          </div>
        </div>

        <div className="hero-card">
          <p className="card-label">Simulator behavior</p>
          <ul className="behavior-list">
            {agentBlueprint.behaviorRules.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
          <div className="status-row">
            <span className="status-dot" />
            <p>Designed for desktop sessions and compressed mobile stacks.</p>
          </div>
        </div>
      </section>

      <section className="feature-strip">
        {experiencePillars.map((pillar) => (
          <article key={pillar.title} className="feature-card">
            <p className="feature-kicker">{pillar.kicker}</p>
            <h2>{pillar.title}</h2>
            <p>{pillar.description}</p>
          </article>
        ))}
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
    </main>
  )
}

export default Home
