/* global require, module */

const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {defineSecret} = require("firebase-functions/params");
const {setGlobalOptions} = require("firebase-functions");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");
const {OpenAI} = require("openai");

setGlobalOptions({maxInstances: 10});

admin.initializeApp();

const openaiApiKey = defineSecret("OPENAI_API_KEY");

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
