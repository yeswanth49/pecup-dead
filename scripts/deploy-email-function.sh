#!/bin/bash

# Configuration
PROJECT_ID="hynugyyfidoxapjmmahd"
SENDER_EMAIL="team@pecup.in"

# Ensure we are in the project root
cd "$(dirname "$0")/.."

# Temporarily rename .env to avoid parsing errors during Supabase CLI operations
if [ -f .env ]; then
  echo "📦 Temporarily renaming .env to .env.temp to avoid CLI parsing errors..."
  mv .env .env.temp
fi

# Function to restore .env on exit
cleanup() {
  if [ -f .env.temp ]; then
    echo "Restoring .env..."
    mv .env.temp .env
  fi
}
trap cleanup EXIT

echo "🚀 Starting Supabase Edge Function Deployment..."

# 1. Link Supabase Project
echo "🔗 Linking Supabase project (ID: $PROJECT_ID)..."
echo "You may be asked for your database password."
npx supabase link --project-ref "$PROJECT_ID"

# 2. Set Secrets
echo "🔑 Setting secrets..."
npx supabase secrets set RESEND_FROM_EMAIL="$SENDER_EMAIL"

echo "❓ Please paste your Resend API Key (starts with re_):"
read -s RESEND_API_KEY

if [ -z "$RESEND_API_KEY" ]; then
  echo "❌ API Key cannot be empty."
  exit 1
fi

npx supabase secrets set RESEND_API_KEY="$RESEND_API_KEY"

# 3. Deploy Function
echo "🚀 Deploying 'send-welcome-email' function..."
npx supabase functions deploy send-welcome-email

echo "✅ Deployment complete!"
