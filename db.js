const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL
  || process.env.NEXT_PUBLIC_SUPABASE_URL
  || process.env.PUBLIC_SUPABASE_URL
  || '';

const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  || process.env.SUPABASE_SECRET_KEY
  || process.env.SUPABASE_API_KEY
  || process.env.SUPABASE_KEY
  || process.env.SUPABASE_ANON_KEY
  || process.env.SUPABASE_PUBLISHABLE_KEY
  || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  || process.env.PUBLIC_SUPABASE_ANON_KEY
  || '';

const databaseConfigured = Boolean(supabaseUrl && supabaseKey);
let client = null;

function createSupabaseClient(secret = '', accessToken = '') {
  const headers = { 'X-Client-Info': 'scoreflow-hostinger/2.7.0' };
  if (secret) headers['X-ScoreFlow-Key'] = secret;
  if (accessToken) headers['X-ScoreFlow-Access'] = accessToken;
  return createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers }
  });
}

function getSupabase(secret = '', accessToken = '') {
  if (!databaseConfigured) return null;
  if (secret || accessToken) return createSupabaseClient(secret, accessToken);
  if (!client) client = createSupabaseClient();
  return client;
}

module.exports = { databaseConfigured, getSupabase };

