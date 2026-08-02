import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || 'http://localhost:54321';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

if (!supabaseKey) {
  console.error("Missing SUPABASE key");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data, error } = await supabase
    .from('agents')
    .select('address, name, score, agent_type, registered_at')
    .ilike('name', 'Test Bot%');

  if (error) {
    console.error("Error fetching agents:", error);
    return;
  }
  
  console.log("Agents created by simulation:");
  console.table(data);
}
main();
