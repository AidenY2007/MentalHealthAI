import { useEffect, useRef, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { auth, createNote, setScenarioCompletion } from '../lib/firebase'
import { scenarioCategories } from '../data/scenarios'
import { getSystemPrompt, IMPLEMENTED_SCENARIOS } from '../data/scenarioPrompts'

function navigateHome() {
  window.history.pushState({}, '', '/')
  window.dispatchEvent(new Event('popstate'))
}

function getVolunteerFirstName(user) {
  const displayFirstName = user?.displayName?.trim()?.split(/\s+/)[0]
  if (displayFirstName) {
    return displayFirstName
  }

  const emailPrefix = user?.email?.split('@')[0]?.trim()
  if (emailPrefix) {
    return emailPrefix
  }

  return 'there'
}

function getScenarioVariant(scenarioId) {
  if (scenarioId === 'body-image-disordered-eating') {
    return Math.random() < 0.5 ? 'bella' : 'aaron'
  }

  if (scenarioId === 'suicide') {
    const suicideVariants = ['max', 'daena', 'kai', 'noah']
    return suicideVariants[Math.floor(Math.random() * suicideVariants.length)]
  }

  if (scenarioId === 'self-harm') {
    const selfHarmVariants = ['samantha', 'caleb', 'chloe']
    return selfHarmVariants[Math.floor(Math.random() * selfHarmVariants.length)]
  }

  if (scenarioId === 'child-abuse') {
    const childAbuseVariants = ['stella', 'elias']
    return childAbuseVariants[Math.floor(Math.random() * childAbuseVariants.length)]
  }

  if (scenarioId === 'anxiety') {
    const anxietyVariants = ['stella', 'ethan', 'maya']
    return anxietyVariants[Math.floor(Math.random() * anxietyVariants.length)]
  }

  if (scenarioId === 'rape-sexual-assault') {
    const assaultVariants = ['diana', 'maya']
    return assaultVariants[Math.floor(Math.random() * assaultVariants.length)]
  }

  return null
}

function Practice({ scenarioId }) {
  const [user, setUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [noteTitle, setNoteTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [isSavingNote, setIsSavingNote] = useState(false)
  const [noteSaveStatus, setNoteSaveStatus] = useState('')
  const [showEndWarning, setShowEndWarning] = useState(false)
  const [sessionStarted, setSessionStarted] = useState(false)
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  const scenario = scenarioCategories.find((s) => s.id === scenarioId)
  const isImplemented = IMPLEMENTED_SCENARIOS.has(scenarioId)

  // Pick scenario variant once per session when a category has multiple stories.
  const variantRef = useRef(getScenarioVariant(scenarioId))

  useEffect(() => {
    if (!auth) {
      setAuthLoading(false)
      return undefined
    }

    return onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser)
      setAuthLoading(false)
    })
  }, [])

  useEffect(() => {
    if (!authLoading && user && isImplemented && !sessionStarted) {
      setSessionStarted(true)
      startConversation()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user, isImplemented])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function callChat(messageHistory) {
    const systemPrompt = getSystemPrompt(scenarioId, variantRef.current)

    // Add typing placeholder
    setMessages((prev) => [...prev, { role: 'assistant', content: '' }])

    try {
      const functions = getFunctions()
      const chatFn = httpsCallable(functions, 'chat', { timeout: 60000 })
      const result = await chatFn({ messages: messageHistory, systemPrompt })

      setMessages((prev) => {
        const updated = [...prev]
        updated[updated.length - 1] = {
          role: 'assistant',
          content: result.data.content,
        }
        return updated
      })
    } catch (error) {
      // Surface callable error code/details instead of only a generic message.
      console.error('Practice chat failed:', {
        code: error.code,
        message: error.message,
        details: error.details,
      })

      const parts = [error.code, error.message, error.details]
        .filter(Boolean)
        .join(' | ')

      setMessages((prev) => {
        const updated = [...prev]
        updated[updated.length - 1] = {
          role: 'assistant',
          content: `Error: ${parts || 'Request failed.'}`,
        }
        return updated
      })
    }
  }

  async function startConversation() {
    if (!user) {
      return
    }

    const openingMessage = {
      role: 'user',
      content: `Hi this is ${getVolunteerFirstName(user)} from Teen Line! What is your name?`,
    }

    setMessages([openingMessage])
    setIsStreaming(true)
    await callChat([openingMessage])
    setIsStreaming(false)
  }

  async function handleSend(event) {
    event?.preventDefault()
    const trimmed = input.trim()
    if (!trimmed || isStreaming) return

    const userMessage = { role: 'user', content: trimmed }
    const updatedMessages = [...messages, userMessage]

    setMessages(updatedMessages)
    setInput('')
    setIsStreaming(true)

    await callChat(updatedMessages)

    setIsStreaming(false)
    inputRef.current?.focus()
  }

  async function handleSaveNote() {
    if (!user?.uid || !notes.trim()) return

    setIsSavingNote(true)
    setNoteSaveStatus('')

    try {
      const title = noteTitle.trim() || `${scenario?.name || 'Session'} notes`
      await createNote({
        userId: user.uid,
        email: user.email || '',
        title,
        content: notes,
      })
      setNoteTitle('')
      setNotes('')
      setNoteSaveStatus('saved')
    } catch {
      setNoteSaveStatus('error')
    } finally {
      setIsSavingNote(false)
    }
  }

  async function completeAndNavigate() {
    if (user?.uid && scenarioId) {
      try {
        await setScenarioCompletion(user.uid, scenarioId, true)
      } catch {
        // Non-fatal — still navigate home
      }
    }
    navigateHome()
  }

  function handleEndSession() {
    if (notes.trim() && noteSaveStatus !== 'saved') {
      setShowEndWarning(true)
      return
    }
    completeAndNavigate()
  }

  function handleKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      handleSend()
    }
  }

  if (authLoading) {
    return (
      <div className="practice-loading">
        <p>Loading...</p>
      </div>
    )
  }

  if (!user) {
    navigateHome()
    return null
  }

  if (!scenario) {
    return (
      <div className="practice-shell">
        <div className="practice-not-found">
          <p>Scenario not found.</p>
          <button className="secondary-action button-reset" onClick={navigateHome} type="button">
            Back to dashboard
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="practice-shell">
      <header className="practice-header">
        <div className="practice-header-left">
          <p className="eyebrow">Practice session</p>
          <h1 className="practice-title">{scenario.name}</h1>
        </div>
        <div className="practice-header-right">
          <span className={isImplemented ? 'scenario-status-implemented' : 'scenario-status-not-implemented'}>
            {isImplemented ? 'Implemented' : 'Not implemented'}
          </span>
          <button
            className="secondary-action button-reset"
            onClick={handleEndSession}
            type="button"
          >
            Complete session
          </button>
        </div>
      </header>

      {!isImplemented ? (
        <div className="practice-coming-soon">
          <p className="practice-coming-soon-title">Coming soon</p>
          <p className="practice-coming-soon-copy">
            This scenario is not yet available. Check back later.
          </p>
          <button
            className="secondary-action button-reset"
            onClick={navigateHome}
            type="button"
          >
            Back to dashboard
          </button>
        </div>
      ) : (
        <div className="practice-content">
          <section className="practice-chat-panel">
            <div className="chat-messages">
              {messages.length === 0 && isStreaming ? (
                <div className="chat-message chat-message-assistant">
                  <div className="chat-bubble">
                    <span className="chat-typing">
                      <span /><span /><span />
                    </span>
                  </div>
                </div>
              ) : null}

              {messages.map((msg, index) => (
                <div
                  key={index}
                  className={`chat-message chat-message-${msg.role}`}
                >
                  <div className="chat-bubble">
                    {msg.content === '' && isStreaming && index === messages.length - 1 ? (
                      <span className="chat-typing">
                        <span /><span /><span />
                      </span>
                    ) : (
                      msg.content
                    )}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            <form className="chat-composer" onSubmit={handleSend}>
              <textarea
                className="chat-input"
                disabled={isStreaming}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type your response... (Enter to send)"
                ref={inputRef}
                rows={2}
                value={input}
              />
              <button
                className="primary-action button-reset chat-send"
                disabled={isStreaming || !input.trim()}
                type="submit"
              >
                Send
              </button>
            </form>
          </section>

          <section className="practice-notes-panel">
            <p className="panel-title">Session Notes</p>
            <p className="practice-notes-hint">
              Keep track of what's happening in the conversation.
            </p>
            <input
              className="practice-notes-title"
              onChange={(e) => {
                setNoteTitle(e.target.value)
                setNoteSaveStatus('')
              }}
              placeholder="Note title..."
              type="text"
              value={noteTitle}
            />
            <textarea
              className="practice-notes-textarea"
              onChange={(e) => {
                setNotes(e.target.value)
                setNoteSaveStatus('')
              }}
              placeholder="Write notes here during your session..."
              value={notes}
            />
            <div className="practice-notes-footer">
              {noteSaveStatus === 'saved' ? (
                <span className="notes-save-confirm">Saved to Notes</span>
              ) : noteSaveStatus === 'error' ? (
                <span className="notes-save-error">Could not save. Try again.</span>
              ) : null}
              <button
                className="primary-action button-reset practice-notes-save"
                disabled={isSavingNote || !notes.trim()}
                onClick={handleSaveNote}
                type="button"
              >
                {isSavingNote ? 'Saving...' : 'Save and create new note'}
              </button>
            </div>
          </section>
        </div>
      )}
      {showEndWarning ? (
        <div
          aria-hidden="true"
          className="auth-modal-backdrop"
          onClick={() => setShowEndWarning(false)}
        >
          <section
            aria-labelledby="end-session-title"
            aria-modal="true"
            className="auth-modal delete-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
          >
            <div className="auth-modal-topline">
              <div>
                <p className="auth-modal-kicker">Unsaved notes</p>
                <h2 id="end-session-title">You have unsaved notes</h2>
              </div>
            </div>

            <p className="delete-modal-copy">
              Your session notes have not been saved. They will be lost if you end the session now.
            </p>

            <div className="delete-modal-actions">
              <button
                className="secondary-action button-reset"
                onClick={() => setShowEndWarning(false)}
                type="button"
              >
                Go back
              </button>
              <button
                className="primary-action delete-confirm button-reset"
                onClick={completeAndNavigate}
                type="button"
              >
                Continue without saving
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  )
}

export default Practice
