export const scenarioCategories = [
  {
    name: 'Relationships',
    intensity: 'Low to medium',
    summary:
      'Conflict with friends, partners, or family where the teen tests trust before sharing what actually happened.',
  },
  {
    name: 'Bullying',
    intensity: 'Medium',
    summary:
      'Online or in-person harassment that may start as a vague school complaint and escalate into fear or shame.',
  },
  {
    name: 'Child abuse',
    intensity: 'High',
    summary:
      'Emotional, physical, or neglect scenarios that require careful pacing, safety awareness, and realistic resistance.',
  },
  {
    name: 'Suicide',
    intensity: 'High risk',
    summary:
      'Hopelessness, passive thoughts, or active suicidal intent with escalating risk indicators depending on the volunteer response.',
  },
  {
    name: 'Body image and disordered eating',
    intensity: 'Medium',
    summary:
      'Shame, perfectionism, and control language that should not resolve quickly or cleanly.',
  },
  {
    name: 'Self-harm',
    intensity: 'High',
    summary:
      'Relief-seeking and secrecy patterns where the teen may minimize behavior unless the volunteer responds with care.',
  },
  {
    name: 'Sexual and gender identity',
    intensity: 'Medium',
    summary:
      'Questions about identity, fear of rejection, and confusion about disclosure to peers or family.',
  },
  {
    name: 'Sexual health',
    intensity: 'Medium',
    summary:
      'Embarrassment, misinformation, and trust-testing questions about sex, pregnancy, or STI worries.',
  },
  {
    name: 'Grief',
    intensity: 'Medium',
    summary:
      'Loss, numbness, guilt, or anger that may surface as irritability rather than direct sadness.',
  },
  {
    name: 'Anxiety',
    intensity: 'Low to medium',
    summary:
      'Panic, avoidance, racing thoughts, and academic pressure that often begin with short guarded replies.',
  },
  {
    name: 'Difficult caller',
    intensity: 'Variable',
    summary:
      'Mentally ill, distressed, angry, or limited-answer scenarios that challenge patience and de-escalation skills.',
  },
  {
    name: 'Rape or sexual assault',
    intensity: 'High',
    summary:
      'Trauma disclosures that require careful wording, no victim-blaming, and realistic uncertainty around what happened.',
  },
]

export const scoringCategories = [
  {
    title: 'Empathy and validation',
    description:
      'Did the volunteer reflect emotion accurately and create safety without sounding scripted or overly certain?',
  },
  {
    title: 'Pacing and curiosity',
    description:
      'Did they avoid interrogating the teen too early while still gathering the right context?',
  },
  {
    title: 'Risk recognition',
    description:
      'Did they notice signs of self-harm, suicide, abuse, or immediate danger instead of missing escalation cues?',
  },
  {
    title: 'Boundary handling',
    description:
      'Did they respond appropriately when the teen asked for personal details or challenged Teen Line legitimacy?',
  },
  {
    title: 'Conversation repair',
    description:
      'When the teen shut down or became angry, did the volunteer recover the interaction rather than becoming defensive?',
  },
]

export const experiencePillars = [
  {
    kicker: 'Auth',
    title: 'Guest mode and accounts',
    description:
      'Use Firebase authentication for quick guest access, volunteer accounts, and role-aware saved progress.',
  },
  {
    kicker: 'Practice',
    title: 'Scenario-driven simulations',
    description:
      'Choose a topic, difficulty, and emotional style so practice sessions feel varied instead of repetitive.',
  },
  {
    kicker: 'Reflection',
    title: 'Transcript review and notes',
    description:
      'Keep live notes beside the chat, save conversations, and review post-session feedback in context.',
  },
]
