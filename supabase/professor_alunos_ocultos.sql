-- Preferência visual do professor; não altera atleta, inscrição ou ranking.
begin;

create table if not exists public.professor_alunos_ocultos (
  professor_user_id text not null,
  aluno_user_id text not null,
  criado_em timestamptz not null default now(),
  primary key (professor_user_id, aluno_user_id)
);

alter table public.professor_alunos_ocultos enable row level security;

create policy professor_alunos_ocultos_select on public.professor_alunos_ocultos
  for select to authenticated using (professor_user_id = auth.uid()::text);

create policy professor_alunos_ocultos_insert on public.professor_alunos_ocultos
  for insert to authenticated with check (
    professor_user_id = auth.uid()::text
  );

create policy professor_alunos_ocultos_delete on public.professor_alunos_ocultos
  for delete to authenticated using (professor_user_id = auth.uid()::text);

grant select, insert, delete on public.professor_alunos_ocultos to authenticated;
notify pgrst, 'reload schema';
commit;
