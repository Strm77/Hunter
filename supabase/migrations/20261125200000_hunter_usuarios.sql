-- Contas de usuário do Hunter (e-mail + senha). A senha chega já com hash (scrypt, feito no servidor do app);
-- o banco nunca vê a senha. Acesso só pelas funções abaixo, que exigem o token secreto do servidor.
create table hunter_privado.usuario (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (email = lower(email) and position('@' in email) > 1),
  senha_hash text not null,
  criado_em timestamptz not null default now()
);
alter table hunter_privado.usuario enable row level security;
revoke all on hunter_privado.usuario from public, anon, authenticated;

-- Cria a conta. Retorna o id, ou null se o e-mail já estiver cadastrado.
create or replace function public.hunter_usuario_criar(p_token text, p_email text, p_senha_hash text)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  novo uuid;
begin
  if not hunter_privado.token_valido(p_token) then
    raise exception 'acesso negado' using errcode = '42501';
  end if;
  insert into hunter_privado.usuario (email, senha_hash) values (lower(trim(p_email)), p_senha_hash)
  on conflict (email) do nothing
  returning id into novo;
  return novo;
end;
$$;

-- Busca a conta pelo e-mail para o servidor conferir a senha. Retorna null se não existir.
create or replace function public.hunter_usuario_buscar(p_token text, p_email text)
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
  select id, email, senha_hash into r from hunter_privado.usuario where email = lower(trim(p_email));
  if not found then
    return null;
  end if;
  return jsonb_build_object('id', r.id, 'email', r.email, 'senha_hash', r.senha_hash);
end;
$$;

revoke all on function public.hunter_usuario_criar(text, text, text) from public, anon, authenticated;
revoke all on function public.hunter_usuario_buscar(text, text) from public, anon, authenticated;
grant execute on function public.hunter_usuario_criar(text, text, text) to anon;
grant execute on function public.hunter_usuario_buscar(text, text) to anon;
