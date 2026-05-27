import { useEffect, useState } from 'react'
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { db } from '../lib/firebase'
import { scenarioCategories } from '../data/scenarios'
import { SCENARIO_BIOS } from '../data/scenarioPrompts'

const TABS = ['Storylines', 'Access Codes', 'Client Transcripts']

const SCENARIO_CHARACTERS = {
  'relationships': [{ key: 'default', name: 'Maya' }],
  'suicide': [{ key: 'default', name: 'Max' }, { key: 'daena', name: 'Daena' }, { key: 'kai', name: 'Kai' }, { key: 'noah', name: 'Noah' }],
  'anxiety': [{ key: 'default', name: 'Stella' }, { key: 'ethan', name: 'Ethan' }, { key: 'maya', name: 'Maya' }],
  'bullying': [{ key: 'default', name: 'Jordan' }],
  'difficult-caller': [{ key: 'default', name: 'Alex' }],
  'grief': [{ key: 'default', name: 'Taylor' }],
  'sexual-gender-identity': [{ key: 'default', name: 'Leo' }],
  'sexual-health': [{ key: 'default', name: 'Aisha' }],
  'self-harm': [{ key: 'default', name: 'Samantha' }, { key: 'caleb', name: 'Caleb' }, { key: 'chloe', name: 'Chloe' }],
  'child-abuse': [{ key: 'default', name: 'Stella' }, { key: 'elias', name: 'Elias' }],
  'rape-sexual-assault': [{ key: 'default', name: 'Diana' }, { key: 'maya', name: 'Maya' }],
  'body-image-disordered-eating': [{ key: 'default', name: 'Aaron' }, { key: 'bella', name: 'Bella' }],
}

function Admin() {
  const [screen, setScreen] = useState('lock')
  const [codeInput, setCodeInput] = useState('')
  const [isVerifying, setIsVerifying] = useState(false)
  const [verifyError, setVerifyError] = useState('')
  const [adminCode, setAdminCode] = useState('')
  const [activeTab, setActiveTab] = useState('Storylines')

  // Storylines tab
  const [customStorylines, setCustomStorylines] = useState([])
  const [customCategories, setCustomCategories] = useState([])
  const [scenarioOverrides, setScenarioOverrides] = useState({})

  // Add custom storyline form
  const [showAddForm, setShowAddForm] = useState(false)
  const [formName, setFormName] = useState('')
  const [formCategoryId, setFormCategoryId] = useState(scenarioCategories[0].id)
  const [formCategoryName, setFormCategoryName] = useState(scenarioCategories[0].name)
  const [formBio, setFormBio] = useState('')
  const [isNewCategory, setIsNewCategory] = useState(false)
  const [newCatName, setNewCatName] = useState('')
  const [newCatIntensity, setNewCatIntensity] = useState('Medium')
  const [newCatSummary, setNewCatSummary] = useState('')
  const [isAdding, setIsAdding] = useState(false)
  const [addError, setAddError] = useState('')
  const [addSuccess, setAddSuccess] = useState(false)

  // Edit scenario (built-in or custom)
  const [editingScenarioId, setEditingScenarioId] = useState('')
  const [editingIsCustom, setEditingIsCustom] = useState(false)
  const [editName, setEditName] = useState('')
  const [editSummary, setEditSummary] = useState('')
  const [editBios, setEditBios] = useState({})
  const [editingCharacterKey, setEditingCharacterKey] = useState('')
  const [isSavingEdit, setIsSavingEdit] = useState(false)
  const [editError, setEditError] = useState('')

  // Delete custom storyline / category
  const [deletingId, setDeletingId] = useState('')
  const [deletingCategoryId, setDeletingCategoryId] = useState('')
  const [showDeleteCategoryWarning, setShowDeleteCategoryWarning] = useState(false)
  const [categoryToDelete, setCategoryToDelete] = useState(null)

  // Access codes tab
  const [isGeneratingCode, setIsGeneratingCode] = useState(false)
  const [generatedCode, setGeneratedCode] = useState('')
  const [generateError, setGenerateError] = useState('')
  const [activeCodes, setActiveCodes] = useState([])
  const [isLoadingCodes, setIsLoadingCodes] = useState(false)

  // Client Transcripts tab
  const [allTranscripts, setAllTranscripts] = useState([])
  const [transcriptsLoading, setTranscriptsLoading] = useState(false)
  const [transcriptsError, setTranscriptsError] = useState('')
  const [selectedTranscript, setSelectedTranscript] = useState(null)

  useEffect(() => {
    if (screen !== 'dashboard' || !db) return undefined
    const q = query(collection(db, 'storylines'), orderBy('createdAt', 'desc'))
    return onSnapshot(q, (snap) => {
      setCustomStorylines(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    })
  }, [screen])

  useEffect(() => {
    if (screen !== 'dashboard' || !db) return undefined
    return onSnapshot(collection(db, 'customCategories'), (snap) => {
      setCustomCategories(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    })
  }, [screen])

  useEffect(() => {
    if (screen !== 'dashboard' || !db) return undefined
    return onSnapshot(collection(db, 'scenarioOverrides'), (snap) => {
      const map = {}
      snap.docs.forEach((d) => { map[d.id] = d.data() })
      setScenarioOverrides(map)
    })
  }, [screen])

  useEffect(() => {
    if (screen !== 'dashboard' || activeTab !== 'Access Codes' || !adminCode) return
    setIsLoadingCodes(true)
    httpsCallable(getFunctions(), 'listAdminCodes')({ code: adminCode })
      .then((result) => setActiveCodes(result.data.codes || []))
      .catch(() => setActiveCodes([]))
      .finally(() => setIsLoadingCodes(false))
  }, [screen, activeTab, adminCode])

  useEffect(() => {
    if (screen !== 'dashboard' || activeTab !== 'Client Transcripts' || !adminCode) return
    setTranscriptsLoading(true)
    setTranscriptsError('')
    httpsCallable(getFunctions(), 'listAllTranscripts')({ code: adminCode })
      .then((result) => setAllTranscripts(result.data.transcripts || []))
      .catch((err) => setTranscriptsError(err.message || 'Could not load transcripts.'))
      .finally(() => setTranscriptsLoading(false))
  }, [screen, activeTab, adminCode])

  async function handleVerify(e) {
    e.preventDefault()
    const code = codeInput.trim().toUpperCase()
    if (code.length !== 6) {
      setVerifyError('Enter a 6-character access code.')
      return
    }
    setIsVerifying(true)
    setVerifyError('')
    try {
      const fns = getFunctions()
      const verify = httpsCallable(fns, 'verifyAdminCode')
      const result = await verify({ code })
      if (result.data.valid) {
        setAdminCode(code)
        setScreen('dashboard')
      } else {
        setVerifyError('Invalid code. Please try again.')
      }
    } catch {
      setVerifyError('Verification failed. Try again.')
    } finally {
      setIsVerifying(false)
    }
  }

  function handleSignOut() {
    setScreen('lock')
    setAdminCode('')
    setCodeInput('')
    setVerifyError('')
    setGeneratedCode('')
    setAddSuccess(false)
    setEditingScenarioId('')
    setActiveCodes([])
  }

  function openEdit(item) {
    setEditingCharacterKey('')
    setEditError('')
    if (item._type === 'custom-group') {
      setEditingIsCustom(true)
      setEditingScenarioId(item.groupId)
      setEditName(item.name)
      setEditSummary('')
      const initialBios = {}
      item.storylines.forEach((s) => { initialBios[s.id] = s.bio || '' })
      setEditBios(initialBios)
    } else {
      setEditingIsCustom(false)
      const override = scenarioOverrides[item.id] || {}
      const characters = SCENARIO_CHARACTERS[item.id] || []
      const initialBios = {}
      characters.forEach(({ key }) => {
        initialBios[key] = override.bios?.[key] ?? SCENARIO_BIOS[item.id]?.[key] ?? ''
      })
      // Also include any custom storylines added under this built-in category
      ;(item.extraCustom || []).forEach((s) => {
        initialBios[s.id] = s.bio || ''
      })
      setEditingScenarioId(item.id)
      setEditName(override.name ?? item.name)
      setEditSummary(override.summary ?? item.summary)
      setEditBios(initialBios)
    }
  }

  function cancelEdit() {
    setEditingScenarioId('')
    setEditingCharacterKey('')
    setEditError('')
  }

  async function handleSaveEdit() {
    setIsSavingEdit(true)
    setEditError('')
    try {
      const fns = getFunctions()
      if (editingIsCustom) {
        const existingIds = new Set(customStorylines.map((s) => s.id))
        await Promise.all(
          Object.entries(editBios)
            .filter(([storylineId]) => existingIds.has(storylineId))
            .map(([storylineId, bio]) =>
              httpsCallable(fns, 'updateStoryline')({
                code: adminCode,
                storylineId,
                bio,
                categoryName: editName,
              })
            )
        )
      } else {
        // Split editBios into built-in character keys vs custom storyline IDs
        const builtinCharKeys = new Set((SCENARIO_CHARACTERS[editingScenarioId] || []).map((c) => c.key))
        const builtinBios = Object.fromEntries(Object.entries(editBios).filter(([k]) => builtinCharKeys.has(k)))
        const customBioEntries = Object.entries(editBios).filter(([k]) => !builtinCharKeys.has(k))
        const existingIds = new Set(customStorylines.map((s) => s.id))
        await Promise.all([
          httpsCallable(fns, 'updateScenarioOverride')({
            code: adminCode,
            scenarioId: editingScenarioId,
            name: editName,
            summary: editSummary,
            bios: builtinBios,
          }),
          ...customBioEntries
            .filter(([k]) => existingIds.has(k))
            .map(([storylineId, bio]) =>
              httpsCallable(fns, 'updateStoryline')({ code: adminCode, storylineId, bio })
            ),
        ])
      }
      setEditingScenarioId('')
    } catch (error) {
      setEditError(error.message || 'Could not save. Try again.')
    } finally {
      setIsSavingEdit(false)
    }
  }

  function handleCategoryChange(e) {
    const val = e.target.value
    if (val === '__new__') {
      setIsNewCategory(true)
      setFormCategoryId('')
      setFormCategoryName('')
    } else {
      setIsNewCategory(false)
      const allCats = [
        ...scenarioCategories,
        ...customCategories.filter((cc) => !scenarioCategories.some((sc) => sc.id === cc.id)),
      ]
      const found = allCats.find((c) => c.id === val)
      setFormCategoryId(val)
      setFormCategoryName(found?.name || val)
    }
  }

  async function handleAddStoryline(e) {
    e.preventDefault()
    setAddError('')
    setAddSuccess(false)
    if (!formName.trim() || !formBio.trim()) {
      setAddError('Name and bio are required.')
      return
    }
    if (isNewCategory && !newCatName.trim()) {
      setAddError('New category name is required.')
      return
    }
    const catId = isNewCategory
      ? newCatName.trim().toLowerCase().replace(/\s+/g, '-')
      : formCategoryId
    const catName = isNewCategory ? newCatName.trim() : formCategoryName
    setIsAdding(true)
    try {
      const fns = getFunctions()
      await httpsCallable(fns, 'addStoryline')({
        code: adminCode,
        name: formName.trim(),
        categoryId: catId,
        categoryName: catName,
        bio: formBio.trim(),
        ...(isNewCategory
          ? { newCategory: { name: catName, intensity: newCatIntensity, summary: newCatSummary } }
          : {}),
      })
      setFormName('')
      setFormBio('')
      setIsNewCategory(false)
      setNewCatName('')
      setNewCatIntensity('Medium')
      setNewCatSummary('')
      setFormCategoryId(scenarioCategories[0].id)
      setFormCategoryName(scenarioCategories[0].name)
      setShowAddForm(false)
      setAddSuccess(true)
    } catch (error) {
      setAddError(error.message || 'Could not add storyline.')
    } finally {
      setIsAdding(false)
    }
  }

  async function handleDeleteStoryline(storylineId) {
    setDeletingId(storylineId)
    try {
      await httpsCallable(getFunctions(), 'deleteStoryline')({ code: adminCode, storylineId })
    } catch {
      // Snapshot will revert on failure
    } finally {
      setDeletingId('')
    }
  }

  function promptDeleteCategory(group) {
    setCategoryToDelete(group)
    setShowDeleteCategoryWarning(true)
  }

  async function confirmDeleteCategory() {
    if (!categoryToDelete) return
    setDeletingCategoryId(categoryToDelete.groupId)
    setShowDeleteCategoryWarning(false)
    try {
      await Promise.all(
        categoryToDelete.storylines.map((s) =>
          httpsCallable(getFunctions(), 'deleteStoryline')({ code: adminCode, storylineId: s.id })
        )
      )
      if (editingScenarioId === categoryToDelete.groupId) setEditingScenarioId('')
    } catch {
      // Snapshot will revert on failure
    } finally {
      setDeletingCategoryId('')
      setCategoryToDelete(null)
    }
  }

  async function handleGenerateCode() {
    setIsGeneratingCode(true)
    setGeneratedCode('')
    setGenerateError('')
    try {
      const result = await httpsCallable(getFunctions(), 'generateAdminCode')({ code: adminCode })
      setGeneratedCode(result.data.newCode)
      setActiveCodes((prev) => [...prev, { code: result.data.newCode }])
    } catch {
      setGenerateError('Could not generate code. Try again.')
    } finally {
      setIsGeneratingCode(false)
    }
  }

  const derivedCustomCategories = Object.values(
    customStorylines.reduce((acc, s) => {
      if (!acc[s.categoryId]) acc[s.categoryId] = { id: s.categoryId, name: s.categoryName }
      return acc
    }, {})
  ).filter((cc) => !scenarioCategories.some((sc) => sc.id === cc.id))

  const allCategories = [...scenarioCategories, ...derivedCustomCategories]

  // Lock screen
  if (screen === 'lock') {
    return (
      <div className="admin-shell">
        <div className="admin-lock-card">
          <p className="admin-kicker">Admin Portal</p>
          <h1 className="admin-title">ReplyLine Admin</h1>
          <p className="admin-subtitle">Enter your 6-character access code to continue.</p>
          <form className="admin-lock-form" onSubmit={handleVerify}>
            <input
              autoComplete="off"
              autoFocus
              className="admin-code-input"
              maxLength={6}
              onChange={(e) => {
                setCodeInput(e.target.value.toUpperCase())
                setVerifyError('')
              }}
              placeholder="XXXXXX"
              spellCheck={false}
              type="text"
              value={codeInput}
            />
            {verifyError ? <p className="admin-error">{verifyError}</p> : null}
            <button
              className="primary-action button-reset admin-full-btn"
              disabled={isVerifying || codeInput.length !== 6}
              type="submit"
            >
              {isVerifying ? 'Verifying...' : 'Enter portal'}
            </button>
          </form>
          <button
            className="secondary-action button-reset admin-full-btn"
            onClick={() => {
              window.history.pushState({}, '', '/')
              window.dispatchEvent(new Event('popstate'))
            }}
            style={{ marginTop: '10px' }}
            type="button"
          >
            Back to homepage
          </button>
        </div>
      </div>
    )
  }

  // Dashboard
  return (
    <div className="admin-shell">
      <div className="admin-page">
        <header className="admin-page-header">
          <div>
            <p className="admin-kicker">Admin Portal</p>
            <h1 className="admin-title">ReplyLine Admin</h1>
          </div>
          <button
            className="secondary-action button-reset"
            onClick={handleSignOut}
            type="button"
          >
            Sign out
          </button>
        </header>

        <div className="admin-tabs">
          {TABS.map((tab) => (
            <button
              className={`admin-tab button-reset${activeTab === tab ? ' admin-tab-active' : ''}`}
              key={tab}
              onClick={() => setActiveTab(tab)}
              type="button"
            >
              {tab}
            </button>
          ))}
        </div>

        {activeTab === 'Storylines' && (
          <div className="admin-tab-content">
            <section className="admin-section">
              <div className="admin-section-topline">
                <div>
                  <h2 className="admin-section-title">Storylines</h2>
                  <p className="admin-section-desc">Edit names, summaries, and character bios.</p>
                </div>
                <button
                  className="primary-action button-reset"
                  onClick={() => {
                    setShowAddForm((v) => !v)
                    setAddError('')
                    setAddSuccess(false)
                  }}
                  type="button"
                >
                  {showAddForm ? 'Cancel' : 'Add storyline'}
                </button>
              </div>

              {showAddForm ? (
                <form className="admin-add-form" onSubmit={handleAddStoryline}>
                  <div className="admin-field">
                    <label className="admin-label">Name</label>
                    <input
                      className="admin-input"
                      onChange={(e) => setFormName(e.target.value)}
                      placeholder="e.g. Jamie, 16"
                      type="text"
                      value={formName}
                    />
                  </div>
                  <div className="admin-field">
                    <label className="admin-label">Category</label>
                    <select
                      className="admin-select"
                      onChange={handleCategoryChange}
                      value={isNewCategory ? '__new__' : formCategoryId}
                    >
                      {allCategories.map((cat) => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                      <option value="__new__">+ Add new category</option>
                    </select>
                  </div>
                  {isNewCategory ? (
                    <>
                      <div className="admin-field">
                        <label className="admin-label">Category name</label>
                        <input
                          className="admin-input"
                          onChange={(e) => setNewCatName(e.target.value)}
                          placeholder="e.g. Substance use"
                          type="text"
                          value={newCatName}
                        />
                      </div>
                      <div className="admin-field">
                        <label className="admin-label">Summary</label>
                        <textarea
                          className="admin-textarea"
                          onChange={(e) => setNewCatSummary(e.target.value)}
                          placeholder="Brief description of this category..."
                          rows={2}
                          value={newCatSummary}
                        />
                      </div>
                    </>
                  ) : null}
                  <div className="admin-field">
                    <label className="admin-label">Bio</label>
                    <textarea
                      className="admin-textarea admin-bio-textarea"
                      onChange={(e) => setFormBio(e.target.value)}
                      placeholder="Paste a paragraph describing this person: their background, current situation, emotional state, how they communicate, and what they're slowly revealing..."
                      rows={7}
                      value={formBio}
                    />
                  </div>
                  {addError ? <p className="admin-error">{addError}</p> : null}
                  <div className="admin-form-footer">
                    <button
                      className="primary-action button-reset"
                      disabled={isAdding}
                      type="submit"
                    >
                      {isAdding ? 'Adding...' : 'Add storyline'}
                    </button>
                  </div>
                </form>
              ) : null}

              {addSuccess && !showAddForm ? (
                <p className="admin-success">Storyline added successfully.</p>
              ) : null}

              <div className="admin-storyline-list">
                {(() => {
                  // Separate custom storylines: those under built-in categories vs truly new categories
                  const builtinIds = new Set(scenarioCategories.map((s) => s.id))
                  const customStorylinesForBuiltin = customStorylines
                    .filter((s) => builtinIds.has(s.categoryId))
                    .reduce((acc, s) => {
                      if (!acc[s.categoryId]) acc[s.categoryId] = []
                      acc[s.categoryId].push(s)
                      return acc
                    }, {})
                  const customGroups = Object.values(
                    customStorylines
                      .filter((s) => !builtinIds.has(s.categoryId))
                      .reduce((acc, s) => {
                        const catId = s.categoryId || s.id
                        if (!acc[catId]) {
                          acc[catId] = { groupId: `cg-${catId}`, _type: 'custom-group', name: s.categoryName, storylines: [] }
                        }
                        acc[catId].storylines.push(s)
                        return acc
                      }, {})
                  )
                  const allItems = [
                    ...scenarioCategories.map((s) => ({
                      ...s,
                      _type: 'builtin',
                      extraCustom: customStorylinesForBuiltin[s.id] || [],
                    })),
                    ...customGroups,
                  ]
                  return allItems.map((item) => {
                    const itemId = item._type === 'custom-group' ? item.groupId : item.id
                    const isEditing = editingScenarioId === itemId
                    const override = item._type === 'builtin' ? (scenarioOverrides[item.id] || {}) : {}
                    const displayName = item._type === 'builtin' ? (override.name ?? item.name) : item.name
                    const characters = item._type === 'custom-group'
                      ? item.storylines.map((s) => ({ key: s.id, name: s.name, _isCustom: true }))
                      : [
                          ...(SCENARIO_CHARACTERS[item.id] || []),
                          ...(item.extraCustom || []).map((s) => ({ key: s.id, name: s.name, _isCustom: true })),
                        ]
                    const subtitle = characters.map((c) => c.name).join(', ')

                    return (
                      <article className="admin-storyline-item admin-storyline-item-col" key={itemId}>
                        {isEditing ? (
                          <div className="admin-inline-edit">
                            <div className="admin-inline-edit-fields">
                              <div className="admin-field">
                                <label className="admin-label">
                                  {item._type === 'custom-group' ? 'Category name' : 'Name'}
                                </label>
                                <input
                                  className="admin-input"
                                  onChange={(e) => setEditName(e.target.value)}
                                  type="text"
                                  value={editName}
                                />
                              </div>
                              {item._type === 'builtin' && (
                                <div className="admin-field">
                                  <label className="admin-label">Summary</label>
                                  <textarea
                                    className="admin-textarea"
                                    onChange={(e) => setEditSummary(e.target.value)}
                                    rows={3}
                                    value={editSummary}
                                  />
                                </div>
                              )}
                              <div className="admin-field">
                                <label className="admin-label">Characters</label>
                                <div className="admin-character-list">
                                  {characters.map(({ key, name, _isCustom }) => (
                                    <div className="admin-character-row" key={key}>
                                      <div className="admin-character-header">
                                        <span className="admin-character-name">{name}</span>
                                        <div className="admin-character-header-actions">
                                          {editingCharacterKey === key ? (
                                            <button
                                              className="primary-action button-reset"
                                              onClick={() => setEditingCharacterKey('')}
                                              type="button"
                                            >
                                              Done
                                            </button>
                                          ) : (
                                            <button
                                              className="admin-edit-btn button-reset"
                                              onClick={() => setEditingCharacterKey(key)}
                                              type="button"
                                            >
                                              Edit bio
                                            </button>
                                          )}
                                          {(_isCustom) && (
                                            <button
                                              className="admin-delete-btn button-reset"
                                              disabled={deletingId === key}
                                              onClick={() => handleDeleteStoryline(key)}
                                              type="button"
                                            >
                                              {deletingId === key ? 'Removing...' : 'Remove'}
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                      {editingCharacterKey === key && (
                                        <textarea
                                          autoFocus
                                          className="admin-textarea admin-bio-textarea"
                                          onChange={(e) => setEditBios((prev) => ({ ...prev, [key]: e.target.value }))}
                                          rows={12}
                                          value={editBios[key] ?? ''}
                                        />
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                            {editError ? <p className="admin-error">{editError}</p> : null}
                            <div className="admin-inline-edit-actions">
                              <button
                                className="secondary-action button-reset"
                                onClick={cancelEdit}
                                type="button"
                              >
                                Cancel
                              </button>
                              <button
                                className="primary-action button-reset"
                                disabled={isSavingEdit || !!editingCharacterKey}
                                onClick={handleSaveEdit}
                                type="button"
                              >
                                {isSavingEdit ? 'Saving...' : 'Save'}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="admin-storyline-row">
                            <div className="admin-storyline-info">
                              <strong className="admin-storyline-name">{displayName}</strong>
                              <p className="admin-storyline-summary">{subtitle}</p>
                            </div>
                            <div className="admin-storyline-actions">
                              <button
                                className="admin-edit-btn button-reset"
                                onClick={() => openEdit(item)}
                                type="button"
                              >
                                Edit
                              </button>
                              {item._type === 'custom-group' && (
                                <button
                                  className="admin-delete-btn button-reset"
                                  disabled={deletingCategoryId === item.groupId}
                                  onClick={() => promptDeleteCategory(item)}
                                  type="button"
                                >
                                  {deletingCategoryId === item.groupId ? 'Removing...' : 'Remove'}
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </article>
                    )
                  })
                })()}
              </div>
            </section>

          </div>
        )}

        {activeTab === 'Access Codes' && (
          <div className="admin-tab-content">
            <section className="admin-section">
              <div className="admin-section-topline">
                <div>
                  <h2 className="admin-section-title">Access Codes</h2>
                  <p className="admin-section-desc">Generate additional codes for other admins.</p>
                </div>
                <button
                  className="secondary-action button-reset"
                  disabled={isGeneratingCode}
                  onClick={handleGenerateCode}
                  type="button"
                >
                  {isGeneratingCode ? 'Generating...' : 'Generate new code'}
                </button>
              </div>
              {generatedCode ? (
                <div className="admin-generated-code">
                  <p className="admin-code-display">{generatedCode}</p>
                </div>
              ) : null}
              {generateError ? <p className="admin-error">{generateError}</p> : null}

              <div className="admin-codes-list-section">
                <h3 className="admin-codes-list-title">Active codes</h3>
                {isLoadingCodes ? (
                  <p className="admin-empty">Loading...</p>
                ) : activeCodes.length === 0 ? (
                  <p className="admin-empty">No codes found.</p>
                ) : (
                  <ul className="admin-codes-list">
                    {activeCodes.map(({ code }) => (
                      <li className="admin-code-item" key={code}>
                        <span className="admin-code-item-value">{code}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          </div>
        )}

        {activeTab === 'Client Transcripts' && (
          <div className="admin-tab-content">
            <section className="admin-section">
              <div className="admin-section-topline">
                <div>
                  <h2 className="admin-section-title">Client Transcripts</h2>
                  <p className="admin-section-desc">View all volunteer practice session transcripts.</p>
                </div>
              </div>
              {transcriptsLoading ? (
                <p className="admin-empty">Loading transcripts...</p>
              ) : transcriptsError ? (
                <p className="admin-error">{transcriptsError}</p>
              ) : selectedTranscript ? (
                <div className="transcript-detail">
                  <div className="transcript-detail-header">
                    <button
                      className="transcript-back button-reset"
                      onClick={() => setSelectedTranscript(null)}
                      type="button"
                    >
                      Back
                    </button>
                    <div className="transcript-detail-meta">
                      <p className="transcript-detail-title">{selectedTranscript.scenarioName} — {selectedTranscript.characterName}</p>
                      <p className="transcript-detail-sub">
                        {selectedTranscript.userName || selectedTranscript.userEmail}
                        {selectedTranscript.userEmail && selectedTranscript.userName ? ` · ${selectedTranscript.userEmail}` : ''}
                        {selectedTranscript.completedAt ? ` · ${new Date(selectedTranscript.completedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="transcript-messages">
                    {(selectedTranscript.messages || []).map((msg, i) => (
                      <div key={i} className={`transcript-message transcript-message-${msg.role}`}>
                        <span className="transcript-role">{msg.role === 'user' ? (selectedTranscript.userName || 'Volunteer') : selectedTranscript.characterName || 'Caller'}</span>
                        <p className="transcript-bubble">{msg.content}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : allTranscripts.length === 0 ? (
                <p className="admin-empty">No transcripts yet.</p>
              ) : (
                <div className="transcript-list">
                  {allTranscripts.map((t) => (
                    <button
                      className="transcript-item button-reset"
                      key={t.id}
                      onClick={() => setSelectedTranscript(t)}
                      type="button"
                    >
                      <div className="transcript-item-main">
                        <span className="transcript-item-character">{t.characterName || '—'}</span>
                        <span className="transcript-item-category">{t.scenarioName}</span>
                      </div>
                      <div className="transcript-item-user">
                        <span>{t.userName || t.userEmail}</span>
                        {t.userName && t.userEmail ? <span className="transcript-item-email">{t.userEmail}</span> : null}
                      </div>
                      <span className="transcript-item-date">
                        {t.completedAt ? new Date(t.completedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </div>

      {showDeleteCategoryWarning && categoryToDelete ? (
        <div
          aria-hidden="true"
          className="auth-modal-backdrop"
          onClick={() => setShowDeleteCategoryWarning(false)}
        >
          <section
            aria-labelledby="delete-cat-title"
            aria-modal="true"
            className="auth-modal delete-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
          >
            <div className="auth-modal-topline">
              <div>
                <p className="auth-modal-kicker">Remove category</p>
                <h2 id="delete-cat-title">Remove &ldquo;{categoryToDelete.name}&rdquo;?</h2>
              </div>
            </div>
            <p className="delete-modal-copy">
              This will permanently remove the category and all {categoryToDelete.storylines.length} simulated {categoryToDelete.storylines.length === 1 ? 'person' : 'people'} inside it ({categoryToDelete.storylines.map((s) => s.name).join(', ')}). This cannot be undone.
            </p>
            <div className="delete-modal-actions">
              <button
                className="secondary-action button-reset"
                onClick={() => setShowDeleteCategoryWarning(false)}
                type="button"
              >
                Cancel
              </button>
              <button
                className="primary-action delete-confirm button-reset"
                onClick={confirmDeleteCategory}
                type="button"
              >
                Remove category
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  )
}

export default Admin
