-- Sprint 5 — Perfil: foto do usuário.
-- Rode no SQL Editor do Supabase (banco que já tem o schema.sql aplicado).

-- Bucket público de fotos de perfil. O app grava em "<id do usuário>/<arquivo>";
-- só o próprio usuário escreve na própria pasta, qualquer um lê (é só avatar).
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = true;

create policy "avatars: leitura publica" on storage.objects
  for select using (bucket_id = 'avatars');

create policy "avatars: cada um grava na propria pasta" on storage.objects
  for insert with check (
    bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatars: cada um troca a propria foto" on storage.objects
  for update using (
    bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatars: cada um apaga a propria foto" on storage.objects
  for delete using (
    bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Grava (ou limpa, com null) a foto do perfil. O gatilho profiles_sync_members
-- replica a foto para o vínculo em todas as contas.
create function public.set_my_photo(p_url text)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  update public.profiles set photo_url = nullif(trim(p_url), '') where id = auth.uid();
end;
$$;

grant execute on function public.set_my_photo(text) to authenticated;
