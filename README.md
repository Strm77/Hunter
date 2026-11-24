# Hunter

App web para organizar a busca de emprego da Carol: candidaturas e retornos, histórico de vagas com links do LinkedIn, perfil profissional (currículo-base) e versões do currículo adaptadas por vaga.

> ## Onde ficam os dados
>
> - **Publicado (Vercel):** os dados ficam num **banco de dados hospedado** (projeto Supabase `hunter`, plano gratuito). Quem entra no endereço publicado com o código de acesso vê os mesmos dados, em qualquer aparelho: Brunno pelo celular e Carol pelo computador, por exemplo.
> - **Rodando no próprio computador sem as variáveis do banco:** os dados ficam num arquivo no servidor onde o app roda (`data/hunter.json`). Instalações separadas não compartilham informação, e esse arquivo não persiste na Vercel.
> - O acesso é restrito a quem tem o código (**Brunno e Carol**). O código fica só nas variáveis de ambiente, nunca no repositório.
> - Plano gratuito do Supabase: projetos sem uso por cerca de uma semana são pausados. Se o app mostrar erro de banco depois de muito tempo parado, reative o projeto no painel do Supabase.

## O que tem na V1

1. **Candidaturas e retornos** (`/`): empresa, cargo, data, status (Candidatada, Em análise, Retorno recebido, Entrevista, Recusada, Aprovada), próxima ação e observações. Filtros por status, busca e contadores (total, aguardando retorno, com retorno, entrevistas). Cada candidatura pode apontar para a vaga do histórico e para a versão do currículo enviada.
2. **Histórico de vagas** (`/vagas`): título, empresa, link da publicação no LinkedIn (abre a vaga original em nova aba), data em que foi salva e notas. Criar, ver, editar e excluir.
3. **Perfil profissional** (`/perfil`): dados pessoais, resumo, experiências, formação, certificações e habilidades. Tudo preenchido à mão; nada é gerado automaticamente.
4. **Currículos por vaga** (`/curriculos`): versões do currículo-base vinculadas a uma vaga, com registro da data em que foram enviadas. Pré-visualização e impressão/PDF pelo navegador.

### Regra das versões de currículo

Uma versão **não guarda texto próprio**: ela só guarda referências (por id) aos itens do currículo-base, a ordem e quais estão em destaque. Com isso:

- não é possível incluir numa versão uma experiência, formação ou certificação que não exista no perfil (o servidor descarta qualquer referência desconhecida);
- corrigir algo no perfil atualiza todas as versões;
- remover um item do perfil remove esse item de todas as versões.

O app começa vazio: não há dados de exemplo.

## Trava de acesso

Todo o app (páginas e API) fica atrás de um **código de acesso único** definido na variável de ambiente `HUNTER_ACCESS_CODE`:

- o middleware (`src/middleware.ts`) bloqueia tudo sem uma sessão válida e redireciona para `/entrar`; a API responde 401;
- ao digitar o código certo (comparado no servidor, em `/api/entrar`), o navegador recebe um cookie `httpOnly` e `sameSite=lax` no formato `<expiração>.<HMAC-SHA256(código, expiração)>`. O código nunca vai para o cookie;
- o middleware confere a assinatura e a expiração (30 dias) **no servidor** a cada requisição: um cookie alterado, expirado ou assinado com outro código é recusado;
- **sem `HUNTER_ACCESS_CODE` configurado (ou com menos de 8 caracteres), o app fica fechado para todos**;
- trocar o código invalida todas as sessões; o botão “Sair” encerra a sessão no navegador.

Limites conhecidos: é um código compartilhado (não há contas individuais) e a proteção contra tentativas repetidas é só um atraso de 1 s por erro. Use um código longo e aleatório.

Nenhum segredo vai para o repositório: o valor fica só no `.env.local` (ignorado pelo git). Veja `.env.example`.

## Como rodar

Requisitos: Node.js 20 ou mais recente.

```bash
npm install
cp .env.example .env.local
# edite .env.local e defina HUNTER_ACCESS_CODE (ex.: openssl rand -base64 24)
npm run dev
```

Abra http://localhost:3000 e entre com o código.

Para rodar em modo produção local: `npm run build && npm start`.

### Dados

- **Com banco hospedado:** defina `HUNTER_SUPABASE_URL`, `HUNTER_SUPABASE_KEY` e `HUNTER_DB_TOKEN` (veja `.env.example`). Tudo fica num único documento JSON no banco, com número de versão: se duas pessoas salvarem ao mesmo tempo, o servidor relê e aplica de novo, sem apagar a alteração da outra.
- **Sem banco:** `data/hunter.json` (ou a pasta de `HUNTER_DATA_DIR`). A pasta `data/` está no `.gitignore`. Backup: copie o arquivo.

### Banco de dados (Supabase)

O esquema está em `supabase/migrations/`. As tabelas ficam no schema `hunter_privado`, que a API pública não expõe. O app acessa só por duas funções, `hunter_ler` e `hunter_gravar`, que recusam qualquer chamada sem o `HUNTER_DB_TOKEN`; o banco guarda apenas o SHA-256 desse token. Por isso a chave publicável do Supabase, sozinha, não lê nem grava nada.

Para trocar o token: gere um novo, atualize o hash em `hunter_privado.acesso` e a variável `HUNTER_DB_TOKEN` na Vercel, e publique de novo.

## Estrutura

```
src/
  middleware.ts           trava de acesso
  lib/types.ts            modelos de dados
  lib/db.ts               leitura/escrita do JSON, validação e sanitização
  lib/sessao.ts           código de acesso e cookie de sessão
  app/api/...             rotas: /api/candidaturas, /api/vagas, /api/curriculos, /api/perfil, /api/entrar, /api/sair
  app/page.tsx            painel de candidaturas
  app/vagas, perfil, curriculos, entrar   demais telas
```

## Deploy na Vercel

O app está publicado no projeto `hunter` da Vercel. Variáveis de ambiente configuradas lá (produção):

- `HUNTER_ACCESS_CODE`: código de acesso;
- `HUNTER_SUPABASE_URL` e `HUNTER_SUPABASE_KEY`: endereço e chave publicável do projeto Supabase `hunter`;
- `HUNTER_DB_TOKEN`: token secreto do servidor para o banco.

Para trocar o código de acesso, mude `HUNTER_ACCESS_CODE` na Vercel e publique de novo; isso também encerra todas as sessões abertas.

## Fases futuras (fora da V1)

- Login multiusuário (contas individuais no lugar do código compartilhado).
- Busca automática de vagas.
- Candidatura automática.
- Integração com o LinkedIn.
