import { createClient } from '@supabase/supabase-js';

const url = 'https://zrxdwnshegihakqfszfh.supabase.co';
const key = 'sb_publishable_p6BmdDFqPT3NYOvhBX5bXg_vV4Oc4og';

const supabase = createClient(url, key);

async function run() {
  console.log("Testing connection...");
  const { data, error } = await supabase.from('customers').select('*').limit(1);
  if (error) {
    console.error('Connection error:', error.message);
    process.exit(1);
  }
  console.log('Successfully connected! Data:', data);
  
  // Test insert if it is empty
  if (data && data.length === 0) {
     console.log("No data found, trying to insert test data...");
     const { data: insertData, error: insertError } = await supabase.from('customers').insert([
       { first_name: 'Ahmet', last_name: 'Yılmaz', phone: '0555 123 4567', email: 'ahmet@example.com' }
     ]).select();
     if (insertError) {
         console.error('Insert error:', insertError.message);
         process.exit(1);
     }
     console.log('Inserted test data:', insertData);
  }
}

run();
