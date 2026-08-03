import { createClient } from "@supabase/supabase-js";
const supabase = createClient("https://msbesgjrsuymiwyvdsgm.supabase.co", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1zYmVzZ2pyc3V5bWl3eXZkc2dtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzI1NjYwNSwiZXhwIjoyMDk4ODMyNjA1fQ.JHFFPMV74lcP-87q86eErS_xm1Pik58tte6Ui1BPdco");

async function run() {
  const { data } = await supabase.from("transactions").select("id, from_address, to_address");
  if (data) {
    for (const row of data) {
      if (row.from_address !== row.from_address.toLowerCase() || row.to_address !== row.to_address.toLowerCase()) {
        await supabase.from("transactions").update({
          from_address: row.from_address.toLowerCase(),
          to_address: row.to_address.toLowerCase()
        }).eq("id", row.id);
      }
    }
  }
  console.log("Done updating transactions");
}
run();
