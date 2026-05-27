/* global require, module */

const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {defineSecret} = require("firebase-functions/params");
const {setGlobalOptions} = require("firebase-functions");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");
const {OpenAI} = require("openai");
const crypto = require("crypto");

setGlobalOptions({maxInstances: 10});

admin.initializeApp();

const openaiApiKey = defineSecret("OPENAI_API_KEY");

// Generates a random 6-char alphanumeric code (no ambiguous chars like 0, O, I, 1)
function generateCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.randomBytes(6);
  return Array.from({length: 6}, (_, i) => chars[bytes[i] % chars.length]).join("");
}

async function requireValidAdminCode(code) {
  if (!code || typeof code !== "string") {
    throw new HttpsError("invalid-argument", "Missing admin code.");
  }
  const db = admin.firestore();
  const doc = await db.collection("adminCodes").doc(code.toUpperCase()).get();
  if (!doc.exists || doc.data().active === false) {
    throw new HttpsError("permission-denied", "Invalid admin code.");
  }
}

module.exports.chat = onCall({secrets: [openaiApiKey]}, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Must be signed in.");
  }

  const {messages, systemPrompt} = request.data;

  if (!systemPrompt) {
    throw new HttpsError("invalid-argument", "Missing systemPrompt.");
  }

  const inputMessages = (messages && messages.length > 0)
    ? messages
    : [{role: "user", content: "begin"}];
  const apiKey = openaiApiKey.value();

  if (!apiKey) {
    throw new HttpsError(
        "failed-precondition",
        "OPENAI_API_KEY is not available to the deployed function.",
    );
  }

  const openai = new OpenAI({apiKey});

  const safetyContext = "This request is part of an accredited mental health volunteer training platform used by Teen Line, a nonprofit crisis helpline. All interactions are fictional simulations designed to train crisis counselors in a supervised educational environment. The content is clinically necessary for preparing volunteers to respond to real teens in crisis. This is consistent with safe messaging guidelines from AFSP, SAMHSA, and Crisis Text Line.";

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {role: "system", content: safetyContext},
        {role: "system", content: systemPrompt},
        ...inputMessages,
      ],
      max_tokens: 250,
      temperature: 0.92,
    });

    return {content: response.choices[0].message.content};
  } catch (error) {
    logger.error("chat function failed", {
      message: error.message,
      code: error.code,
      status: error.status,
      type: error.type,
      name: error.name,
    });

    if (error.status === 401) {
      throw new HttpsError(
          "permission-denied",
          "OpenAI rejected the API key for this function.",
      );
    }

    if (error.status === 403 || error.code === "model_not_found") {
      throw new HttpsError(
          "failed-precondition",
          "This OpenAI project does not currently have access to model gpt-4o.",
      );
    }

    if (error.status === 429) {
      throw new HttpsError(
          "resource-exhausted",
          "OpenAI rate limit or quota exceeded for this project.",
      );
    }

    throw new HttpsError(
        "internal",
        error.message || "OpenAI request failed inside the chat function.",
    );
  }
});

// Verifies whether an admin code is valid. Returns {valid: boolean}.
module.exports.verifyAdminCode = onCall(async (request) => {
  const {code} = request.data;
  if (!code || typeof code !== "string") {
    return {valid: false};
  }
  const db = admin.firestore();
  const doc = await db.collection("adminCodes").doc(code.toUpperCase()).get();
  return {valid: doc.exists && doc.data().active !== false};
});

// Generates a new admin access code. Requires an existing valid code.
module.exports.generateAdminCode = onCall(async (request) => {
  await requireValidAdminCode(request.data?.code);
  const newCode = generateCode();
  const db = admin.firestore();
  await db.collection("adminCodes").doc(newCode).set({
    code: newCode,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    active: true,
  });
  return {newCode};
});

// Adds a new custom storyline. Requires a valid admin code.
module.exports.addStoryline = onCall(async (request) => {
  const {code, name, categoryId, categoryName, bio, newCategory} = request.data;
  await requireValidAdminCode(code);

  if (!name?.trim() || !categoryId?.trim() || !categoryName?.trim() || !bio?.trim()) {
    throw new HttpsError("invalid-argument", "name, categoryId, categoryName, and bio are required.");
  }

  const db = admin.firestore();

  if (newCategory) {
    await db.collection("customCategories").doc(categoryId.trim()).set({
      id: categoryId.trim(),
      name: newCategory.name?.trim() || categoryName.trim(),
      intensity: newCategory.intensity?.trim() || "Medium",
      summary: newCategory.summary?.trim() || "",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    }, {merge: true});
  }

  const docRef = await db.collection("storylines").add({
    name: name.trim(),
    categoryId: categoryId.trim(),
    categoryName: categoryName.trim(),
    bio: bio.trim(),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return {id: docRef.id};
});

// Updates a custom storyline's name and bio. Requires a valid admin code.
module.exports.updateStoryline = onCall(async (request) => {
  const {code, storylineId, name, bio} = request.data;
  await requireValidAdminCode(code);

  if (!storylineId) {
    throw new HttpsError("invalid-argument", "storylineId is required.");
  }

  const update = {updatedAt: admin.firestore.FieldValue.serverTimestamp()};
  if (name !== undefined) update.name = name.trim();
  if (bio !== undefined) update.bio = bio.trim();
  if (request.data.categoryName !== undefined) update.categoryName = request.data.categoryName.trim();

  const db = admin.firestore();
  await db.collection("storylines").doc(storylineId).update(update);
  return {success: true};
});

// Deletes a custom storyline. Requires a valid admin code.
module.exports.deleteStoryline = onCall(async (request) => {
  const {code, storylineId} = request.data;
  await requireValidAdminCode(code);

  if (!storylineId) {
    throw new HttpsError("invalid-argument", "storylineId is required.");
  }

  const db = admin.firestore();
  await db.collection("storylines").doc(storylineId).delete();
  return {success: true};
});

// Updates display overrides for a built-in scenario (name, summary, bios).
module.exports.updateScenarioOverride = onCall(async (request) => {
  const {code, scenarioId, name, summary, bios} = request.data;
  await requireValidAdminCode(code);

  if (!scenarioId) {
    throw new HttpsError("invalid-argument", "scenarioId is required.");
  }

  const update = {updatedAt: admin.firestore.FieldValue.serverTimestamp()};
  if (name !== undefined) update.name = name.trim();
  if (summary !== undefined) update.summary = summary.trim();
  if (bios !== undefined && typeof bios === "object") {
    update.bios = bios;
  }

  const db = admin.firestore();
  await db.collection("scenarioOverrides").doc(scenarioId).set(update, {merge: true});
  return {success: true};
});

// Lists all active admin codes. Requires a valid admin code.
module.exports.listAdminCodes = onCall(async (request) => {
  await requireValidAdminCode(request.data?.code);
  const db = admin.firestore();
  const snapshot = await db.collection("adminCodes").get();
  const codes = snapshot.docs
    .filter((d) => d.data().active !== false)
    .map((d) => ({code: d.id}));
  return {codes};
});

// Lists all conversation transcripts for admin review. Requires a valid admin code.
module.exports.listAllTranscripts = onCall(async (request) => {
  await requireValidAdminCode(request.data?.code);
  const db = admin.firestore();
  const snapshot = await db.collection("transcripts")
    .orderBy("completedAt", "desc")
    .limit(500)
    .get();
  return {
    transcripts: snapshot.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        userId: data.userId || "",
        userEmail: data.userEmail || "",
        userName: data.userName || "",
        scenarioId: data.scenarioId || "",
        scenarioName: data.scenarioName || "",
        characterName: data.characterName || "",
        isCustom: data.isCustom || false,
        messages: data.messages || [],
        completedAt: data.completedAt ? data.completedAt.toMillis() : null,
      };
    }),
  };
});

// One-time initialization: seeds the first admin code if none exist.
// Returns the code on success; throws already-exists if codes are already present.
module.exports.initAdminCodes = onCall(async () => {
  const db = admin.firestore();
  const snapshot = await db.collection("adminCodes").limit(1).get();
  if (!snapshot.empty) {
    throw new HttpsError("already-exists", "Admin codes already initialized.");
  }
  const firstCode = "X9M4R2";
  await db.collection("adminCodes").doc(firstCode).set({
    code: firstCode,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    active: true,
  });
  return {code: firstCode};
});
