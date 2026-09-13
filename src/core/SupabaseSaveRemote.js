// Inject an authenticated Supabase client; never accept a user ID from the UI.
export function supabaseSaveRemote(client) {
 return {
  async read() {
   const {data,error}=await client.from('mumuretro_player_saves').select('revision,raw').maybeSingle();
   if(error)throw error;
   return data;
  },
  async compareAndSwap({expectedRevision,raw}) {
   const {data,error}=await client.rpc('mumuretro_write_player_save',{expected_revision:expectedRevision,save_raw:raw});
   if(error)throw error;
   return data;
  },
 };
}
