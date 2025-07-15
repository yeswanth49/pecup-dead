import { google } from 'googleapis';
import { createClient } from '@supabase/supabase-js';
import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

// Supabase setup
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Postgres direct connection for schema changes
const pgClient = new Client({
  connectionString: process.env.POSTGRES_URL_NON_POOLING,
  ssl: {
    rejectUnauthorized: false
  }
});

// Google Sheets setup (reuse existing auth logic)
async function getSheetsClient() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\\\n/g, '\\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly', 'https://www.googleapis.com/auth/drive.readonly'],
  });
  return google.sheets({ version: 'v4', auth });
}

// Google Drive setup
async function getDriveClient() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\\\n/g, '\\n'),
    },
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  });
  return google.drive({ version: 'v3', auth });
}

async function createSchema() {
  console.log('Creating schema using Supabase SQL editor...');
  
  // Note: Tables should be created manually in Supabase SQL editor or via dashboard
  // Here's the SQL to run in Supabase SQL editor:
  
  const sqlCommands = [
    `CREATE TABLE IF NOT EXISTS resources (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      category TEXT NOT NULL,
      subject TEXT NOT NULL,
      unit INTEGER NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      date TIMESTAMP NOT NULL,
      type TEXT NOT NULL,
      url TEXT NOT NULL,
      is_pdf BOOLEAN NOT NULL
    );`,
    
    `CREATE TABLE IF NOT EXISTS reminders (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      title TEXT NOT NULL,
      due_date DATE NOT NULL,
      description TEXT,
      icon_type TEXT,
      status TEXT
    );`,
    
    `CREATE TABLE IF NOT EXISTS recent_updates (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      title TEXT NOT NULL,
      date TEXT NOT NULL,
      description TEXT
    );`,
    
    `CREATE TABLE IF NOT EXISTS exams (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      subject TEXT NOT NULL,
      exam_date DATE NOT NULL
    );`
  ];
  
  console.log('Run these SQL commands in your Supabase SQL editor:');
  sqlCommands.forEach((sql, index) => {
    console.log(`\n--- Command ${index + 1} ---`);
    console.log(sql);
  });
  
  // For now, we'll skip direct schema creation and assume tables exist
  console.log('\nSchema creation commands displayed. Please run them in Supabase SQL editor.');
}

async function migrateData() {
  const sheets = await getSheetsClient();
  const drive = await getDriveClient();
  const spreadsheetId = process.env.GOOGLE_SHEET_ID!;

  // Migrate resources
  const resourcesResponse = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: 'pecup!A:H',
  });
  const resourcesRows = resourcesResponse.data.values || [];

  for (const row of resourcesRows.slice(1)) { // Skip header
    const [category, subject, unit, name, description, date, type, url] = row;
    const isPdf = url.includes('.pdf') || type.toLowerCase().includes('pdf');
    let finalUrl = url;

    if (!isPdf) {
      // Download from Drive and upload to Supabase Storage
      const fileId = url.match(/[-\w]{25,}/)?.[0]; // Extract Drive file ID
      if (fileId) {
        const file = await drive.files.get({ fileId, alt: 'media' }, { responseType: 'stream' });
        const tempPath = path.join(__dirname, 'temp', name);
        fs.mkdirSync(path.dirname(tempPath), { recursive: true });
        const dest = fs.createWriteStream(tempPath);
        file.data.pipe(dest);
        await new Promise<void>((resolve) => dest.on('finish', () => resolve()));

        const { data, error } = await supabase.storage.from('resources').upload(name, fs.createReadStream(tempPath), {
          contentType: type,
        });
        if (error) throw error;
        finalUrl = `${supabaseUrl}/storage/v1/object/public/resources/${data.path}`;
        fs.unlinkSync(tempPath);
      }
    }

    await supabase.from('resources').insert({
      category, subject, unit: parseInt(unit), name, description, date: new Date(date), type, url: finalUrl, is_pdf: isPdf
    });
  }

  // Similarly migrate reminders
  const remindersResponse = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: 'Reminders!A:E',
  });
  const remindersRows = remindersResponse.data.values || [];

  for (const row of remindersRows.slice(1)) {
    const [title, due_date, description, icon_type, status] = row;
    await supabase.from('reminders').insert({ title, due_date: new Date(due_date), description, icon_type, status });
  }

  // Add migration for other sheets similarly

  console.log('Data migration completed.');
}

async function main() {
  try {
    await createSchema();
    await migrateData();
  } catch (error) {
    console.error('Migration failed:', error);
  }
}

main(); 