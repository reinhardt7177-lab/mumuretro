begin;
-- Run in a dedicated Supabase project. Saves are opaque game data, never rewards authority.
create table public.mumuretro_player_saves (
 user_id uuid primary key references auth.users(id) on delete cascade,
 revision uuid not null default gen_random_uuid(),
 raw text not null check (octet_length(raw) <= 750000),
 updated_at timestamptz not null default now()
);
alter table public.mumuretro_player_saves enable row level security;
revoke all on public.mumuretro_player_saves from anon, authenticated;
grant select on public.mumuretro_player_saves to authenticated;
create policy own_save_read on public.mumuretro_player_saves for select to authenticated using ((select auth.uid()) = user_id);
create function public.mumuretro_write_player_save(expected_revision uuid, save_raw text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); next_revision uuid := gen_random_uuid(); changed integer; payload jsonb;
begin
 if uid is null then raise exception 'authentication required'; end if;
 if save_raw is null or octet_length(save_raw)>750000 then raise exception 'invalid save'; end if;
 payload := save_raw::jsonb;
 if payload->>'version' is distinct from '1' or jsonb_typeof(payload->'progress') is distinct from 'object' then raise exception 'invalid save'; end if;
 if expected_revision is null then
  insert into public.mumuretro_player_saves(user_id,revision,raw) values(uid,next_revision,save_raw) on conflict(user_id) do nothing;
 else
  update public.mumuretro_player_saves set raw=save_raw,revision=next_revision,updated_at=now() where user_id=uid and revision=expected_revision;
 end if;
 get diagnostics changed = row_count;
 if changed=0 then return jsonb_build_object('status','conflict'); end if;
 return jsonb_build_object('status','saved','revision',next_revision);
end;
$$;
revoke all on function public.mumuretro_write_player_save(uuid,text) from public, anon;
grant execute on function public.mumuretro_write_player_save(uuid,text) to authenticated;

commit;
