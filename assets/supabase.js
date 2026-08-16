// =========================================================================
// CHHOTU MOTORCYCLES WORKSHOP — SUPABASE CONFIGURATION
// Loads and configures the Supabase client.
// =========================================================================

// REPLACE THESE WITH YOUR ACTUAL SUPABASE CREDENTIALS
const SUPABASE_URL = "https://your-supabase-url.supabase.co";
const SUPABASE_ANON_KEY = "your-supabase-anon-key";

let supabaseClient = null;

if (typeof window.supabase !== "undefined" && typeof window.supabase.createClient === "function") {
  const { createClient } = window.supabase;
  supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  window.supabaseClient = supabaseClient;
} else {
  console.error("Supabase SDK not loaded. Ensure that the Supabase CDN script tag is included in the HTML file.");
}
