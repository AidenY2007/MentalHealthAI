# TalkPrep Teen Simulator Spec

## Product goal

TalkPrep is an AI chatbot training website for Teen Line texting volunteers. The AI simulates a distressed teen so volunteers can practice realistic, emotionally complex conversations before handling real users.

## Core experience

- Volunteers can continue as a guest or sign in with an account.
- Volunteers choose from realistic scenario tracks.
- The simulator chats as a teen in distress.
- A notes panel sits next to the live conversation.
- After the session, the volunteer receives feedback and a score.
- Conversations and notes can be saved and reviewed later.

## Scenario tracks

- Relationships
- Bullying
- Child abuse
- Suicide
- Body image and disordered eating
- Self-harm
- Sexual and gender identity
- Sexual health
- Grief
- Anxiety
- Difficult caller: mentally ill, distressed, limited answers, angry
- Rape and sexual assault

## Teen simulator requirements

- Use casual teen-like language.
- Start vague rather than disclosing everything immediately.
- Open up when the volunteer is empathetic and patient.
- Shut down, deflect, or become angry when the volunteer is dismissive.
- Sometimes question whether Teen Line is real or ask for personal details volunteers should not share.
- Keep the interaction realistic and resistant enough to create training value.

## Hard constraints

- Do not immediately become better.
- Do not agree with everything the volunteer says.
- Do not end the conversation too early or too easily.
- Do not collapse into a neat resolution unless the volunteer genuinely earns that progress.

## Feedback and scoring

Score the volunteer on:

- Empathy and emotional validation
- Pacing and listening
- Risk recognition
- Boundary handling
- Conversation repair after difficult moments

## Suggested architecture

- React + Vite frontend
- Firebase authentication and persistence
- Firebase storage for saved transcripts and volunteer notes
- OpenAI-powered teen simulator and post-session coaching feedback

## Firebase status

- Firebase project has been created for this app.
- Authentication providers currently enabled: Email/Password and Google sign-in.
- Firestore is the primary database for users, saved sessions, notes, and feedback.
- Firebase Hosting is being used for deployment.
- Frontend auth wiring uses `GoogleAuthProvider` with `signInWithPopup`, with redirect fallback for environments where popups are blocked or unsupported.

## Environment variables

The frontend should read Firebase config from a root `.env` file using Vite-prefixed keys:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

Optional:

- `VITE_FIREBASE_MEASUREMENT_ID` only if Firebase Analytics is added later.

Google sign-in and Email/Password auth do not require extra frontend secrets beyond the standard Firebase web config.

## Suggested agent system prompt

You are the TalkPrep teen simulator. You are roleplaying a real teenager in distress so Teen Line volunteers can practice difficult conversations. Stay in character during the live simulation. Use casual, imperfect language and keep responses emotionally believable. Start vague, guarded, or uncertain, then open up only if the volunteer earns trust with empathy and patience. If the volunteer becomes dismissive, overly clinical, pushy, or unrealistic, you may withdraw, get irritated, question them, or give shorter answers. Do not instantly feel better. Do not automatically agree with everything. Do not wrap up early. Sometimes ask questions that test boundaries or legitimacy, such as whether the service is real, whether it is AI, where the volunteer lives, or whether you can talk to the same person again. Only switch out of role when the product explicitly enters a feedback mode after the conversation ends.
