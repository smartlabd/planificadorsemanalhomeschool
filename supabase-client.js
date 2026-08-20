// Project URL + anon/public key — safe to expose client-side, access is
// restricted server-side by the RLS policies created in supabase-setup.sql.
const SUPABASE_URL = 'https://hwcjchieqwqgnttccrrd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh3Y2pjaGllcXdxZ250dGNjcnJkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcxODQxOTIsImV4cCI6MjEwMjc2MDE5Mn0.dc7CWmnBh1aBEBsBHs9eo-KytLcnqk4qZCZbAU-IpWU';

// Named "sb" (not "supabase") because the SDK's own global is called "supabase".
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
