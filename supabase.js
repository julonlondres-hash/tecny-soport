
import { createClient } from
'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://iozacabbqxijigojpmdy.supabase.co';

const SUPABASE_ANON_KEY = 'sb_publishable_FaBwpX4pIUcww0gV9nJE-w_0aS_DfyC';

export const supabase = createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
);
