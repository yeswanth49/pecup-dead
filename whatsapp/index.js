// --- Standard & Baileys Imports ---
const { makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, DisconnectReason, isJidGroup } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const fs = require('fs');
const path = require('path');
const P = require('pino');

// --- Vercel AI SDK Imports ---
require('dotenv').config(); // Still needed for standard Node.js
const { z } = require('zod');
const { generateObject } = require('ai');
const { createGoogleGenerativeAI } = require('@ai-sdk/google');

// --- Google Sheets Imports ---
const { google } = require('googleapis');

// --- Basic Input Validation ---
if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) throw new Error("Missing GOOGLE_GENERATIVE_AI_API_KEY");
if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL) throw new Error("Missing GOOGLE_SERVICE_ACCOUNT_EMAIL env variable.");
if (!process.env.GOOGLE_PRIVATE_KEY) throw new Error("Missing GOOGLE_PRIVATE_KEY env variable.");
if (!process.env.GOOGLE_SHEET_ID) throw new Error("Missing GOOGLE_SHEET_ID env variable.");
if (!process.env.GOOGLE_SHEET_NAME) throw new Error("Missing GOOGLE_SHEET_NAME env variable.");

// --- Initialize AI Client (Google) ---
const googleAI = createGoogleGenerativeAI();
const llmModel = 'gemini-1.5-flash-latest';

// --- Google Sheets Client Initialization ---
const SHEETS_SCOPE = ['https://www.googleapis.com/auth/spreadsheets'];
let sheetsClient = null;

// --- Sheet Column Definitions and Defaults ---
const HEADER_ROW_INDEX = 0;
const TITLE_COL = 0;        // Column A
const DUE_DATE_COL = 1;     // Column B
const DESC_COL = 2;         // Column C
const ICON_TYPE_COL = 3;    // Column D
const STATUS_COL = 4;       // Column E
const NUM_COLUMNS = 5;      // How many columns to read/write (A to E)

const DEFAULT_ICON_TYPE = 'alert'; // Default for new reminders
const DEFAULT_STATUS = 'To DO';   // Default for new reminders

// Function to authenticate and get sheets API client
async function getSheetsClient() {
  console.log("[Google Sheets]: Attempting to get Google Sheets client...");
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY;

  if (!email || !key) {
    console.error("[Google Sheets Auth Error]: Credentials missing.");
    throw new Error("Google Sheets API credentials missing.");
  } else {
    console.log("[Google Sheets]: Found GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY environment variables.");
  }

  try {
      const auth = new google.auth.GoogleAuth({
        credentials: {
          client_email: email,
          private_key: key.replace(/\\n/g, '\n'),
        },
        scopes: SHEETS_SCOPE,
      });
      const authClient = await auth.getClient();
      console.log("[Google Sheets]: Successfully obtained Google auth client.");
      return google.sheets({ version: 'v4', auth: authClient });
  } catch (error) {
       console.error("[Google Sheets Auth Error]: Failed to create Google auth client:", error);
       throw new Error(`Failed to authenticate with Google Sheets API. Check credentials and scope. Error: ${error.message}`);
  }
}


// --- Global State for Messages and Timing ---
let messageStore = [];
let lastProcessedTime = new Date();

// --- Reminder JSON Schema ---
const reminderSchema = z.object({
    title: z.string().describe("A clear, concise title for the reminder or task (max 10 words)."),
    description: z.string().describe("A detailed description of the task, event, or information to be reminded of."),
    due_date: z.string().optional().describe("The due date in YYYY-MM-DD ISO 8601 format. Infer from text and current date. Omit if not found/inferrable.")
});
const reminderListSchema = z.array(reminderSchema);

// --- Function to Sync (Read, Update, Append) Reminders ---
// Note: This version uses valueInputOption: 'RAW' to store dates as plain text.
async function syncRemindersToSheet(remindersFromLLM) {
    if (!sheetsClient) {
        console.error("[Google Sheets Sync Error]: Client not initialized. Cannot sync.");
        return;
    }
    if (!remindersFromLLM) {
        console.log("[Google Sheets Sync]: No reminders received from LLM to sync.");
        return;
    }

    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    const sheetName = process.env.GOOGLE_SHEET_NAME;
    const readRange = `${sheetName}!A:${String.fromCharCode(65 + NUM_COLUMNS - 1)}`; // A:E

    let existingRows = [];
    try {
        console.log(`[Google Sheets Sync]: Reading existing data from range "${readRange}"...`);
        const response = await sheetsClient.spreadsheets.values.get({
            spreadsheetId,
            range: readRange,
        });
        existingRows = response.data.values || [];
        console.log(`[Google Sheets Sync]: Read ${existingRows.length} rows.`);
    } catch (error) {
        console.error('[Google Sheets Sync Error]: Failed to read sheet data:', error.message);
        if (error.response?.data?.error) { console.error('[Google API Error Details]:', JSON.stringify(error.response.data.error, null, 2)); }
        console.error('[Google Sheets Sync]: Aborting sync due to read error.');
        return;
    }

    // --- Map existing data by normalized title ---
    const existingRemindersMap = new Map();
    if (existingRows.length > HEADER_ROW_INDEX) {
        console.log("[Google Sheets Sync]: Mapping existing reminders by title...");
        for (let i = HEADER_ROW_INDEX + 1; i < existingRows.length; i++) {
            const row = existingRows[i];
            if (row && row.length > TITLE_COL && row[TITLE_COL]) {
                const title = row[TITLE_COL].trim();
                const normalizedTitle = title.toLowerCase();
                if (!existingRemindersMap.has(normalizedTitle)) {
                    existingRemindersMap.set(normalizedTitle, {
                        title: title,
                        dueDate: row.length > DUE_DATE_COL ? row[DUE_DATE_COL] : '',
                        desc: row.length > DESC_COL ? row[DESC_COL] : '',
                        icon: row.length > ICON_TYPE_COL ? row[ICON_TYPE_COL] : '',
                        status: row.length > STATUS_COL ? row[STATUS_COL] : '',
                        rowNum: i + 1
                    });
                }
            } else {
                 console.warn(`[Google Sheets Sync]: Skipping row ${i+1} due to missing title or insufficient columns.`);
            }
        }
        console.log(`[Google Sheets Sync]: Mapped ${existingRemindersMap.size} unique existing reminders.`);
    } else {
         console.log("[Google Sheets Sync]: No existing data rows found or only header exists.");
    }

    // --- Process reminders from LLM ---
    const remindersToAppend = [];
    const updatesToPerform = [];

    console.log(`[Google Sheets Sync]: Processing ${remindersFromLLM.length} reminders from LLM...`);
    for (const reminder of remindersFromLLM) {
        if (!reminder.title) {
            console.warn("[Google Sheets Sync]: Skipping reminder from LLM with no title:", reminder);
            continue;
        }
        const normalizedTitle = reminder.title.trim().toLowerCase();
        const existingData = existingRemindersMap.get(normalizedTitle);

        if (existingData) {
            // --- UPDATE ---
            console.log(`[Google Sheets Sync]: Found existing reminder for "${reminder.title}" at row ${existingData.rowNum}. Preparing update.`);
            const rowDataForUpdate = [
                reminder.title.trim(),
                reminder.due_date || '', // Send date as string
                reminder.description || '',
                existingData.icon || DEFAULT_ICON_TYPE,
                existingData.status || DEFAULT_STATUS
            ];
            while(rowDataForUpdate.length < NUM_COLUMNS) { rowDataForUpdate.push(''); }
            const updateRange = `${sheetName}!A${existingData.rowNum}:${String.fromCharCode(65 + NUM_COLUMNS - 1)}${existingData.rowNum}`;
            updatesToPerform.push({ range: updateRange, values: [rowDataForUpdate] });

        } else {
            // --- APPEND ---
             console.log(`[Google Sheets Sync]: Adding new reminder "${reminder.title}" to append list.`);
             const rowDataForAppend = [
                reminder.title.trim(),
                reminder.due_date || '', // Send date as string
                reminder.description || '',
                DEFAULT_ICON_TYPE,
                DEFAULT_STATUS
             ];
             while(rowDataForAppend.length < NUM_COLUMNS) { rowDataForAppend.push(''); }
            remindersToAppend.push(rowDataForAppend);
        }
    }

    // --- Perform Batch Update ---
    if (updatesToPerform.length > 0) {
        console.log(`[Google Sheets Sync]: Performing batch update for ${updatesToPerform.length} reminders...`);
        try {
            const batchUpdateRequest = {
                 spreadsheetId: spreadsheetId,
                 resource: {
                     valueInputOption: 'RAW', // <<< Ensures date string is stored as text
                     data: updatesToPerform
                 }
            };
            const result = await sheetsClient.spreadsheets.values.batchUpdate(batchUpdateRequest);
            console.log(`[Google Sheets Sync]: Batch update successful. Responses: ${result.data.totalUpdatedRows || 0} rows updated across ${result.data.responses?.length || 0} ranges.`);
        } catch (error) {
            console.error('[Google Sheets Sync Error]: Failed during batch update:', error.message);
             if (error.response?.data?.error) { console.error('[Google API Error Details]:', JSON.stringify(error.response.data.error, null, 2)); }
        }
    } else {
        console.log("[Google Sheets Sync]: No existing reminders found requiring updates.");
    }

    // --- Perform Append ---
    if (remindersToAppend.length > 0) {
        console.log(`[Google Sheets Sync]: Appending ${remindersToAppend.length} new reminders...`);
        try {
            const appendRequest = {
                spreadsheetId: spreadsheetId,
                range: sheetName, // Append to the sheet name - finds first empty row
                valueInputOption: 'RAW', // <<< Ensures date string is stored as text
                insertDataOption: 'INSERT_ROWS',
                resource: { values: remindersToAppend },
            };
            const result = await sheetsClient.spreadsheets.values.append(appendRequest);
            console.log(`[Google Sheets Sync]: Append successful. Appended ${result.data.updates?.updatedRows || 0} rows.`);
        } catch (error) {
             console.error('[Google Sheets Sync Error]: Failed during append:', error.message);
             if (error.response?.data?.error) { console.error('[Google API Error Details]:', JSON.stringify(error.response.data.error, null, 2)); }
        }
    } else {
        console.log("[Google Sheets Sync]: No new reminders to append.");
    }
    console.log("[Google Sheets Sync]: Sync process complete.");
} // --- End of syncRemindersToSheet function ---


// --- Hourly Processing Function ---
async function processRecentMessages() {
    const processingStartTime = new Date();
    console.log(`\n[${processingStartTime.toLocaleString()}] --- Running Hourly Reminder Sync ---`);

    const messagesToProcess = messageStore.filter(msg => msg.timestamp > lastProcessedTime);

    if (messagesToProcess.length === 0) {
        console.log("[AI Batch]: No new messages received since the last run.");
        lastProcessedTime = processingStartTime;
        console.log(`--- Hourly Sync Run Complete ---`);
        return;
    }

    console.log(`[AI Batch]: Found ${messagesToProcess.length} new messages to process.`);

    let messageTranscript = "";
    messagesToProcess.forEach(msg => {
        messageTranscript += `[${msg.timestamp.toISOString()}] [Group: ${msg.groupName}] [Sender: ${msg.sender}]: ${msg.text}\n`;
    });

    messageStore = messageStore.filter(msg => msg.timestamp <= lastProcessedTime); // Clear processed
    lastProcessedTime = processingStartTime; // Update time

    console.log(`[AI Batch]: Sending transcript to ${llmModel} for reminder extraction...`);
    let reminderResults = [];

    try {
        const currentDate = new Date().toISOString().split('T')[0];
        // Using the corrected prompt
        const prompt = `You are an AI assistant analyzing a transcript of WhatsApp group messages from the last processing period for a 'Resource Hub Dashboard'. Your task is to identify any potential tasks, deadlines, events, or important information mentioned in *any* of the messages that should be turned into reminders. Avoid creating duplicate reminders if the same task is mentioned multiple times, consolidate if possible.

Current Date: ${currentDate}

Analyze the following transcript:
--- TRANSCRIPT START ---
${messageTranscript}--- TRANSCRIPT END ---

Extract all potential reminders. For each reminder, provide:
1.  A concise 'title'.
2.  A detailed 'description'.
3.  A 'due_date' in YYYY-MM-DD format if a specific date or deadline is mentioned or clearly inferrable from the text and current date. Omit 'due_date' if none is found or clearly inferrable.

Format the output STRICTLY as a JSON array containing reminder objects conforming to the provided schema.
If no reminders are found in the transcript, return an empty JSON array: [].`;

        const { object } = await generateObject({
            model: googleAI(llmModel),
            schema: reminderListSchema,
            prompt: prompt,
        });
        reminderResults = object;

        if (reminderResults) {
            console.log("[AI Batch]: Reminders received from LLM:", JSON.stringify(reminderResults, null, 2));
            await syncRemindersToSheet(reminderResults); // Call sync function
        } else {
             console.log("[AI Batch]: No valid reminder list received from LLM.");
        }

    } catch (error) {
        console.error("[AI Batch Error]: Failed processing reminders:", error);
        if (error.cause) console.error("Error Cause:", error.cause);
    } finally {
         console.log(`--- Hourly Sync Run Complete ---`);
    }
}


// --- Baileys Connection Function ---
async function startSock() {
    try {
        sheetsClient = await getSheetsClient();
    } catch (error) {
        console.error("FATAL: Could not initialize Google Sheets Client on startup. Sheet sync will be disabled.", error.message);
    }

    // --- Baileys Auth State Loading (Debug logs optional now) ---
    console.log("[Debug]: Attempting to load auth state from ./auth");
    let state, saveCreds;
    try {
        const authInfo = await useMultiFileAuthState('./auth');
        console.log("[Debug]: useMultiFileAuthState call finished."); // Keep basic log
        state = authInfo.state;
        saveCreds = authInfo.saveCreds;
    } catch (error) {
         throw new Error("Failed to get authentication state: " + error.message);
    }
    if (!state || !state.creds || !state.keys) {
        console.error("FATAL: Invalid authentication state loaded. Cannot proceed.");
        process.exit(1);
    }
    // --- End Baileys Auth Debug ---


    const { version, isLatest } = await fetchLatestBaileysVersion();

    console.log(`using WA v${version.join('.')} / AI Model: ${llmModel} (Google - Hourly Sync + Sheets), isLatest: ${isLatest}`);
    console.log(`Reminder sync will run every hour.`);

    const sock = makeWASocket({
        version,
        logger: P({ level: 'silent' }), // Changed back to 'silent' - set to 'info'/'debug' if needed
        printQRInTerminal: true,
        auth: state,
     });

    // --- Attach saveCreds handler ---
    if(saveCreds) {
        sock.ev.on('creds.update', saveCreds);
        console.log("[Debug]: Attached creds.update handler."); // Keep or remove
    } else {
        console.error("[Debug Error]: saveCreds function is missing! Session might not persist.");
    }


    // --- Event Handlers ---
    sock.ev.on('messages.upsert', async ({ messages }) => {
         const message = messages[0];
         if (!message.message || message.key.fromMe) return;
         const senderJid = message.key?.remoteJid;
         if (!senderJid || !isJidGroup(senderJid)) return;
         const text = message.message?.conversation || message.message?.extendedTextMessage?.text || message.message?.imageMessage?.caption || message.message?.videoMessage?.caption || '';
         if (!text.trim()) return;
         const timestamp = message.messageTimestamp;
         const messageDateTime = new Date(timestamp * 1000);
         const participant = message.key.participant || senderJid;
         let groupName = senderJid;
         try { /* Fetch group name if needed */ } catch (err) { /* ignore */ }
         messageStore.push({ timestamp: messageDateTime, sender: participant, groupJid: senderJid, groupName: groupName, text: text });
         // Optional: Reduce logging verbosity here if stable
         // console.log(`[${messageDateTime.toLocaleString()}] [Stored] Group: ${groupName} | Sender: ${participant} | Msg: ${text.substring(0, 50)}...`);
    });

    // Handle connection updates and start interval timer
     sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect?.error instanceof Boom) && lastDisconnect.error.output?.statusCode !== DisconnectReason.loggedOut;
             console.log('connection closed due to', lastDisconnect?.error, ', reconnecting:', shouldReconnect);
             if(lastDisconnect?.error?.output?.statusCode === DisconnectReason.loggedOut) {
                console.error("Connection closed: Logged out. Please delete auth folder and re-scan QR code.");
             } else if (shouldReconnect) {
                setTimeout(startSock, 5000);
             }
        } else if (connection === 'open') {
             console.log('connection opened');
             if (global.hourlyIntervalId) { clearInterval(global.hourlyIntervalId); }
             const oneHourInMs = 60 * 1000; // Set back to 1 hour (3600 * 1000 ms)
             global.hourlyIntervalId = setInterval(processRecentMessages, oneHourInMs);
             console.log(`Hourly processing interval started (runs every ${oneHourInMs / 60000} minutes).`);
             // Optional: Run once soon after connecting?
             // setTimeout(processRecentMessages, 15000); // e.g., 15 seconds after connect
        }
    });
} // End startSock function

// Start the application
startSock().catch(err => {
    console.error("Fatal Error starting socket:", err);
    process.exit(1);
});