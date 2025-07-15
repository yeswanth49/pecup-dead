import { google } from 'googleapis';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

console.log('Loaded env: SUPABASE_URL =', process.env.SUPABASE_URL || 'not set');
console.log('SUPABASE_SERVICE_ROLE_KEY =', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'set (length ' + process.env.SUPABASE_SERVICE_ROLE_KEY.length + ')' : 'not set');

// Supabase setup
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Google Sheets setup
async function getSheetsClient() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  return google.sheets({ version: 'v4', auth });
}

async function migrateResources() {
  console.log('Starting resources migration...');
  
  const sheets = await getSheetsClient();
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  
  if (!spreadsheetId) {
    console.log('GOOGLE_SHEET_ID not found in environment variables, skipping resources migration');
    return;
  }

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: 'pecup!A:H',
  });
  
  const rows = response.data.values || [];
  console.log(`Found ${rows.length} rows in resources sheet`);
  
  if (rows.length <= 1) {
    console.log('No data rows found, skipping resources migration');
    return;
  }

  // Skip header row
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.length < 8) continue; // Skip incomplete rows
    
    const [category, subject, unit, name, description, date, type, url] = row;
    
    // Determine if it's a PDF based on URL or type
    const isPdf = url?.includes('.pdf') || type?.toLowerCase().includes('pdf') || false;
    
    try {
      const { error } = await supabase.from('resources').insert({
        category: category || '',
        subject: subject || '',
        unit: parseInt(unit) || 0,
        name: name || '',
        description: description || '',
        date: new Date(date || Date.now()),
        type: type || '',
        url: url || '',
        is_pdf: isPdf
      });
      
      if (error) {
        console.error(`Error inserting resource ${name}:`, error);
        console.log('Error details:', JSON.stringify(error, null, 2));
        console.log('Error keys:', Object.keys(error || {}));
      } else {
        console.log(`✓ Migrated resource: ${name}`);
      }
    } catch (err) {
      console.error(`Failed to migrate resource ${name}:`, err);
    }
  }
  
  console.log('Resources migration completed');
}

async function migrateReminders() {
  console.log('Starting reminders migration...');
  
  const sheets = await getSheetsClient();
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  
  if (!spreadsheetId) {
    console.log('GOOGLE_SHEET_ID not found in environment variables, skipping reminders migration');
    return;
  }

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: 'Reminders!A:E',
  });
  
  const rows = response.data.values || [];
  console.log(`Found ${rows.length} rows in reminders sheet`);
  
  if (rows.length <= 1) {
    console.log('No data rows found, skipping reminders migration');
    return;
  }

  // Skip header row
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.length < 2) continue; // Skip incomplete rows
    
    const [title, due_date, description, icon_type, status] = row;
    
    try {
      const { error } = await supabase.from('reminders').insert({
        title: title || '',
        due_date: new Date(due_date || Date.now()),
        description: description || '',
        icon_type: icon_type || '',
        status: status || ''
      });
      
      if (error) {
        console.error(`Error inserting reminder ${title}:`, error);
      } else {
        console.log(`✓ Migrated reminder: ${title}`);
      }
    } catch (err) {
      console.error(`Failed to migrate reminder ${title}:`, err);
    }
  }
  
  console.log('Reminders migration completed');
}

async function migrateRecentUpdates() {
  console.log('Starting recent updates migration...');
  
  const sheets = await getSheetsClient();
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  
  if (!spreadsheetId) {
    console.log('GOOGLE_SHEET_ID not found in environment variables, skipping recent updates migration');
    return;
  }

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: 'updates!A:D',
  });
  
  const rows = response.data.values || [];
  console.log(`Found ${rows.length} rows in recent updates sheet`);
  
  if (rows.length <= 1) {
    console.log('No data rows found, skipping recent updates migration');
    return;
  }

  // Skip header row
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.length < 2) continue; // Skip incomplete rows
    
    const [title, date, description] = row;
    
    try {
      const { error } = await supabase.from('recent_updates').insert({
        title: title || '',
        date: date || '',
        description: description || ''
      });
      
      if (error) {
        console.error(`Error inserting recent update ${title}:`, error);
      } else {
        console.log(`✓ Migrated recent update: ${title}`);
      }
    } catch (err) {
      console.error(`Failed to migrate recent update ${title}:`, err);
    }
  }
  
  console.log('Recent updates migration completed');
}

async function migrateExams() {
  console.log('Starting exams migration...');
  
  const sheets = await getSheetsClient();
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  
  if (!spreadsheetId) {
    console.log('GOOGLE_SHEET_ID not found in environment variables, skipping exams migration');
    return;
  }

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: 'exams!A:B',
  });
  
  const rows = response.data.values || [];
  console.log(`Found ${rows.length} rows in exams sheet`);
  
  if (rows.length <= 1) {
    console.log('No data rows found, skipping exams migration');
    return;
  }

  // Skip header row
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.length < 2) continue; // Skip incomplete rows
    
    const [subject, exam_date] = row;
    
    try {
      const { error } = await supabase.from('exams').insert({
        subject: subject || '',
        exam_date: new Date(exam_date || Date.now())
      });
      
      if (error) {
        console.error(`Error inserting exam ${subject}:`, error);
      } else {
        console.log(`✓ Migrated exam: ${subject} on ${exam_date}`);
      }
    } catch (err) {
      console.error(`Failed to migrate exam ${subject}:`, err);
    }
  }
  
  console.log('Exams migration completed');
}

async function main() {
  try {
    console.log('Starting data migration from Google Sheets to Supabase...');
    console.log('Make sure you have run the SQL commands from scripts/create-tables.sql first!');
    
    await migrateResources();
    await migrateReminders();
    await migrateRecentUpdates();
    await migrateExams();
    
    console.log('✅ All migrations completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

main(); 