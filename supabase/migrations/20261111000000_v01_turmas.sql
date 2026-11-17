-- v0.1: turmas, alunos, rodadas e respostas.
--
-- Quem acessa:
-- • A professora entra com e-mail e senha (Supabase Auth), cria a turma e lê tudo dela.
-- • Os aparelhos da sala não fazem login: usam o código da turma nas funções `turma_por_codigo` e
--   `sincronizar_turma`. Com o código dá para ver os nomes, os bichinhos e as estrelas da turma, e para
--   gravar rodadas novas. As respostas detalhadas (acertos e trocas) só a professora logada lê.

-- 8 letras e números fáceis de ditar (sem 0/O e 1/I)
create function public.new_class_code()
returns text
language sql
volatile
set search_path = ''
as $$
  select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + floor(random() * 32)::int, 1), '')
  from generate_series(1, 8);
$$;

create table public.classes (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  code text not null unique default public.new_class_code(),
  created_at timestamptz not null default now()
);

create table public.students (
  id uuid primary key,
  class_id uuid not null references public.classes (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  avatar text not null default 'cachorro',
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index students_class_idx on public.students (class_id);

create table public.rounds (
  id uuid primary key,
  student_id uuid not null references public.students (id) on delete cascade,
  level_id text not null,
  stars smallint not null check (stars between 0 and 3),
  correct smallint not null,
  total smallint not null,
  played_at timestamptz not null
);

create index rounds_student_idx on public.rounds (student_id);

create table public.attempts (
  id uuid primary key,
  student_id uuid not null references public.students (id) on delete cascade,
  round_id uuid not null,
  game text not null check (game in ('caca', 'falta', 'monta', 'rima')),
  target text not null,
  answer text not null,
  correct boolean not null,
  played_at timestamptz not null
);

create index attempts_student_idx on public.attempts (student_id, played_at);

-- Acesso da professora -------------------------------------------------------------

alter table public.classes enable row level security;
alter table public.students enable row level security;
alter table public.rounds enable row level security;
alter table public.attempts enable row level security;

create policy "professora gerencia as próprias turmas" on public.classes
  for all to authenticated
  using (teacher_id = (select auth.uid()))
  with check (teacher_id = (select auth.uid()));

create function public.is_my_student(p_student uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.students s join public.classes c on c.id = s.class_id
    where s.id = p_student and c.teacher_id = (select auth.uid())
  );
$$;

create policy "professora gerencia os alunos" on public.students
  for all to authenticated
  using (exists (select 1 from public.classes c where c.id = class_id and c.teacher_id = (select auth.uid())))
  with check (exists (select 1 from public.classes c where c.id = class_id and c.teacher_id = (select auth.uid())));

create policy "professora lê as rodadas" on public.rounds
  for select to authenticated using (public.is_my_student(student_id));

create policy "professora lê as respostas" on public.attempts
  for select to authenticated using (public.is_my_student(student_id));

-- Acesso dos aparelhos da sala (pelo código) ---------------------------------------------

-- Turma, alunos e rodadas (estrelas), em camelCase como o app usa
create function public.turma_por_codigo(p_code text)
returns json
language sql
stable
security definer
set search_path = ''
as $$
  select json_build_object(
    'id', c.id,
    'name', c.name,
    'students', coalesce((
      select json_agg(json_build_object(
        'id', s.id, 'name', s.name, 'avatar', s.avatar, 'archived', s.archived,
        'createdAt', s.created_at, 'updatedAt', s.updated_at
      ))
      from public.students s where s.class_id = c.id
    ), '[]'::json),
    'rounds', coalesce((
      select json_agg(json_build_object(
        'id', r.id, 'studentId', r.student_id, 'levelId', r.level_id, 'stars', r.stars,
        'correct', r.correct, 'total', r.total, 'at', r.played_at
      ))
      from public.rounds r join public.students s on s.id = r.student_id
      where s.class_id = c.id
    ), '[]'::json)
  )
  from public.classes c
  where c.code = upper(trim(p_code));
$$;

-- Envia o que o aparelho tem de novo e devolve a turma atualizada. Rodadas e respostas nunca mudam
-- depois de gravadas (ids gerados no aparelho: reenviar não duplica). Aluno de outra turma é ignorado.
create function public.sincronizar_turma(p_code text, p_students jsonb, p_rounds jsonb, p_attempts jsonb)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_class uuid;
begin
  select id into v_class from public.classes where code = upper(trim(p_code));
  if v_class is null then
    raise exception 'Turma não encontrada' using errcode = 'P0002';
  end if;

  insert into public.students (id, class_id, name, avatar, archived, created_at, updated_at)
  select x.id, v_class, x.name, x.avatar, x.archived, x."createdAt", x."updatedAt"
  from jsonb_to_recordset(coalesce(p_students, '[]'::jsonb))
    as x(id uuid, name text, avatar text, archived boolean, "createdAt" timestamptz, "updatedAt" timestamptz)
  on conflict (id) do update
    set name = excluded.name, avatar = excluded.avatar, archived = excluded.archived, updated_at = excluded.updated_at
    where public.students.class_id = v_class and public.students.updated_at < excluded.updated_at;

  insert into public.rounds (id, student_id, level_id, stars, correct, total, played_at)
  select x.id, x."studentId", x."levelId", x.stars, x.correct, x.total, x."at"
  from jsonb_to_recordset(coalesce(p_rounds, '[]'::jsonb))
    as x(id uuid, "studentId" uuid, "levelId" text, stars smallint, correct smallint, total smallint, "at" timestamptz)
  where exists (select 1 from public.students s where s.id = x."studentId" and s.class_id = v_class)
  on conflict (id) do nothing;

  insert into public.attempts (id, student_id, round_id, game, target, answer, correct, played_at)
  select x.id, x."studentId", x."roundId", x.game, x.target, x.answer, x.correct, x."at"
  from jsonb_to_recordset(coalesce(p_attempts, '[]'::jsonb))
    as x(id uuid, "studentId" uuid, "roundId" uuid, game text, target text, answer text, correct boolean, "at" timestamptz)
  where exists (select 1 from public.students s where s.id = x."studentId" and s.class_id = v_class)
  on conflict (id) do nothing;

  return public.turma_por_codigo(p_code);
end;
$$;

revoke all on function public.turma_por_codigo(text) from public;
revoke all on function public.sincronizar_turma(text, jsonb, jsonb, jsonb) from public;
grant execute on function public.turma_por_codigo(text) to anon, authenticated;
grant execute on function public.sincronizar_turma(text, jsonb, jsonb, jsonb) to anon, authenticated;
