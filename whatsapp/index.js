// --- Existing Imports ---
const { makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, DisconnectReason, isJidGroup } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const fs = require('fs');
const path = require('path');
const P = require('pino');

// --- Vercel AI SDK Imports ---
require('dotenv').config(); // Load .env file variables
const { z } = require('zod'); // Schema definition library
const { generateObject } = require('ai'); // Core Vercel AI SDK function

// --- <<< CHANGE 1: Import Google Provider >>> ---
// const { createOpenAI } = require('@ai-sdk/openai'); // Remove or comment out
const { createGoogleGenerativeAI } = require('@ai-sdk/google'); // Add Google provider

// --- Basic Input Validation ---
// --- <<< CHANGE 2: Check for Google API Key >>> ---
if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    throw new Error("Missing GOOGLE_GENERATIVE_AI_API_KEY in .env file");
}

// --- Initialize AI Client ---
// --- <<< CHANGE 3: Initialize Google Client >>> ---
const google = createGoogleGenerativeAI({
    // apiKey is read from env automatically if GOOGLE_GENERATIVE_AI_API_KEY is set
    // apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY, // Or set explicitly
});

// --- <<< CHANGE 4: Choose Google Model >>> ---
// Choose the model - adjust based on desired capability and cost
// List available models: https://ai.google.dev/models/gemini
// const llmModel = 'gemini-pro'; // Older but stable
const llmModel = 'gemini-2.0-flash'; // Good balance of speed/capability
// const llmModel = 'gemini-1.5-pro-latest'; // More powerful

// --- Define the Desired JSON Output Schema using Zod ---
// (This schema can remain the same as before)
const analysisSchema = z.object({
    summary: z.string().describe("A concise summary of the message content."),
    sentiment: z.enum(["positive", "negative", "neutral"]).describe("The overall sentiment expressed in the message."),
    intent: z.string().describe("The likely intent of the sender (e.g., question, request, information sharing, social chat, command)."),
    keywords: z.array(z.string()).describe("A list of the most important keywords or topics mentioned."),
    actionable: z.boolean().describe("Whether the message seems to require a specific action or response."),
    language: z.string().describe("The detected language of the message (e.g., 'English', 'Spanish', 'Hindi')."),
});

// --- Baileys Connection Function ---
async function startSock() {
    const { state, saveCreds } = await useMultiFileAuthState('./auth');
    const { version, isLatest } = await fetchLatestBaileysVersion();

    // --- <<< CHANGE 5: Update Log Message >>> ---
    console.log(`using WA v${version.join('.')} / AI Model: ${llmModel} (Google), isLatest: ${isLatest}`);

    const sock = makeWASocket({
        version,
        logger: P({ level: 'silent' }),
        printQRInTerminal: true,
        auth: state,
    });

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const message = messages[0];

        if (!message.message || message.key.fromMe) {
            return;
        }

        const senderJid = message.key?.remoteJid;

        if (!senderJid || !isJidGroup(senderJid)) {
            return; // Ignore non-group messages
        }

        const text = message.message?.conversation
            || message.message?.extendedTextMessage?.text
            || message.message?.imageMessage?.caption
            || message.message?.videoMessage?.caption
            || message.message?.documentMessage?.fileName
            || '';

        if (!text.trim()) {
             console.log(`[${new Date().toLocaleString()}] [Group: ${senderJid}] Received message without text content.`);
             return;
        }


        const timestamp = message.messageTimestamp;
        const dateTime = new Date(timestamp * 1000).toLocaleString();
        const participant = message.key.participant || senderJid;

        let groupName = senderJid;
        try {
            groupName = (await sock.groupMetadata(senderJid)).subject;
        } catch (err) {
            console.warn(`Could not fetch group metadata for ${senderJid}:`, err);
        }

        console.log(`\n--- [${dateTime}] ---`);
        console.log(`[Group]: ${groupName} (${senderJid})`);
        console.log(`[Sender]: ${participant}`);
        console.log(`[Message]: ${text}`);

        console.log(`[AI]: Processing message with ${llmModel} (Google)...`);
        try {
            const prompt = `You are an AI assistant analyzing messages from a WhatsApp group.
Analyze the following message sent by user '${participant}' in the group '${groupName}'.
Message Text: "${text}"

Provide a detailed analysis strictly in JSON format conforming to the provided schema. Focus on summary, sentiment, intent, keywords, actionability, and language.`;

            // --- <<< CHANGE 6: Use Google Client in generateObject >>> ---
            const { object: analysisResult } = await generateObject({
                model: google(llmModel), // Pass the configured Google client and model
                schema: analysisSchema,
                prompt: prompt,
                // mode: "json" // Some Google models might benefit from explicitly setting json mode if schema alone isn't enough, test if needed.
            });

            console.log("[AI]: Analysis complete.");
            console.log("[AI Result JSON]:", JSON.stringify(analysisResult, null, 2));

            // TODO: Do something with the analysisResult JSON

        } catch (error) {
            console.error("[AI Error]: Failed to process message with Google LLM:", error);
             // Log specific details if available
            if (error.cause) console.error("Error Cause:", error.cause);
        }
        console.log(`--- [End Message Processing] ---`);

    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect?.error instanceof Boom) && lastDisconnect.error.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('connection closed due to', lastDisconnect?.error, ', reconnecting:', shouldReconnect);
            if (shouldReconnect) {
                setTimeout(startSock, 5000);
            }
        } else if (connection === 'open') {
            console.log('connection opened');
        }
    });
}

startSock().catch(err => {
    console.error("Fatal Error starting socket:", err);
});