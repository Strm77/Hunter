-- Armazenamento do Hunter: um único documento JSON com controle de versão.
-- As tabelas ficam num schema privado (não exposto pela API). O app só acessa
-- por duas funções que exigem um token secreto conhecido apenas pelo servidor
-- (HUNTER_DB_TOKEN). O banco guarda só o SHA-256 desse token.
create schema if not exists hunter_privado;
revoke all on schema hunter_privado from public, anon, authenticated;

create table hunter_privado.documento (
  id smallint primary key default 1 check (id = 1),
  dados jsonb not null,
  versao bigint not null,
  atualizado_em timestamptz not null default now()
);

create table hunter_privado.acesso (
  id smallint primary key default 1 check (id = 1),
  token_sha256 text not null
);

alter table hunter_privado.documento enable row level security;
alter table hunter_privado.acesso enable row level security;
revoke all on all tables in schema hunter_privado from public, anon, authenticated;

create or replace function hunter_privado.token_valido(p_token text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from hunter_privado.acesso a
    where p_token is not null
      and a.token_sha256 = encode(extensions.digest(p_token, 'sha256'), 'hex')
  );
$$;

create or replace function public.hunter_ler(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  r record;
begin
  if not hunter_privado.token_valido(p_token) then
    raise exception 'acesso negado' using errcode = '42501';
  end if;
  select dados, versao into r from hunter_privado.documento where id = 1;
  if not found then
    return jsonb_build_object('dados', null, 'versao', 0);
  end if;
  return jsonb_build_object('dados', r.dados, 'versao', r.versao);
end;
$$;

-- Grava se a versão esperada ainda for a atual. Retorna a nova versão, ou -1 em caso de conflito.
create or replace function public.hunter_gravar(p_token text, p_dados jsonb, p_versao bigint)
returns bigint
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  nova bigint;
begin
  if not hunter_privado.token_valido(p_token) then
    raise exception 'acesso negado' using errcode = '42501';
  end if;
  if p_dados is null or jsonb_typeof(p_dados) <> 'object' then
    raise exception 'dados inválidos' using errcode = '22023';
  end if;
  if p_versao = 0 then
    insert into hunter_privado.documento (id, dados, versao) values (1, p_dados, 1)
    on conflict (id) do nothing
    returning versao into nova;
  else
    update hunter_privado.documento
       set dados = p_dados, versao = versao + 1, atualizado_em = now()
     where id = 1 and versao = p_versao
    returning versao into nova;
  end if;
  return coalesce(nova, -1);
end;
$$;

revoke all on function hunter_privado.token_valido(text) from public, anon, authenticated;
revoke all on function public.hunter_ler(text) from public, anon, authenticated;
revoke all on function public.hunter_gravar(text, jsonb, bigint) from public, anon, authenticated;
grant execute on function public.hunter_ler(text) to anon;
grant execute on function public.hunter_gravar(text, jsonb, bigint) to anon;

-- Depois de aplicar, registre o hash do token (gere o token fora do banco):
--   insert into hunter_privado.acesso (id, token_sha256) values (1, '<sha256 hex do HUNTER_DB_TOKEN>')
--   on conflict (id) do update set token_sha256 = excluded.token_sha256;
