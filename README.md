# Hunter

App web para organizar a busca de emprego da Carol: candidaturas e retornos, histórico de vagas com links do LinkedIn, perfil profissional (currículo-base) e versões do currículo adaptadas por vaga.

> ## ⚠️ V1 é um protótipo local
>
> - **Os dados ficam num arquivo no servidor onde o app roda** (`data/hunter.json`), não no celular nem no navegador de quem acessa.
> - **Quem acessa a mesma instalação vê os mesmos dados**: por exemplo, Brunno pelo celular e Carol pelo computador, ambos abrindo o mesmo endereço. **Instalações separadas não compartilham informação**: duas cópias do app rodando em lugares diferentes têm arquivos diferentes.
> - **Esse arquivo não persiste num deploy da Vercel**: o disco lá é temporário e os dados se perdem entre execuções.
> - Por isso a V1 **não está pronta para ser publicada com dados pessoais reais**. Para a versão publicável faltam: (1) **ligar um banco de dados hospedado** no lugar do arquivo JSON (provedor ainda não escolhido) e (2) a trava de acesso configurada com um código forte.
> - O acesso deve ficar restrito a **Brunno e Carol**.

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

- Arquivo: `data/hunter.json` (ou a pasta definida em `HUNTER_DATA_DIR`). A pasta `data/` está no `.gitignore`.
- Backup: copie esse arquivo. Para começar do zero, apague-o.

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

## Deploy (depois, não agora)

O projeto é um Next.js padrão e roda na Vercel sem configuração extra **para o código**, mas o arquivo JSON não persiste lá. **Requisitos para a versão publicável:**

1. **ligar um banco de dados hospedado** no lugar de `src/lib/db.ts`, mantendo a mesma interface (pendente: o provedor ainda não foi escolhido nem cadastrado);
2. configurar `HUNTER_ACCESS_CODE` nas variáveis de ambiente do projeto na Vercel;
3. só então cadastrar dados reais.

## Fases futuras (fora da V1)

- Banco de dados hospedado no lugar do arquivo JSON (requisito para publicar; provedor a definir).
- Login multiusuário (contas individuais no lugar do código compartilhado).
- Busca automática de vagas.
- Candidatura automática.
- Integração com o LinkedIn.
