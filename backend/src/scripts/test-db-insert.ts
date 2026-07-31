import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(process.cwd(), ".env") });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function testInsert() {
  const fakeAddress = "0x" + Math.random().toString(16).slice(2).padEnd(40, '0');
  const fakeTxHash = "0x" + Math.random().toString(16).slice(2).padEnd(64, '0');
  
  const { data, error } = await supabase
    .from("loans")
    .insert({
      borrower_address: fakeAddress,
      amount: 10,
      principal: 10,
      tx_hash: fakeTxHash,
      status: "active",
      interest_rate: 20,
      repayment_split: 30,
      total_owed: 12,
      total_repaid: 0,
      created_at: new Date().toISOString()
    })
    .select();

  if (error) {
    console.error("Direct insert failed:", error);
  } else {
    console.log("Direct insert succeeded:", data);
    
    // clean up
    await supabase.from("loans").delete().eq("borrower_address", fakeAddress);
  }
}

testInsert().catch(console.error);
