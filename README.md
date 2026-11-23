# Hunter

App web para organizar a busca de emprego da Carol: candidaturas e retornos, histórico de vagas com links do LinkedIn, perfil profissional (currículo-base) e versões do currículo adaptadas por vaga.

> ## ⚠️ V1 é um protótipo local
>
> - **Os dados ficam em um único arquivo** (`data/hunter.json`) na máquina/instalação onde o app roda. **Não há compartilhamento de dados entre Brunno e Carol em dispositivos diferentes**: o que for cadastrado em um computador não aparece em outro.
> - A V1 **não é um aplicativo compartilhado completo** e **não está pronta para ser publicada com dados pessoais reais**. Antes de publicar, são necessários: (1) a trava de acesso configurada com um código forte e (2) armazenamento compartilhado hospedado (banco de dados), já que o disco da Vercel é temporário e não guarda o arquivo JSON entre execuções.
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
- ao digitar o código certo, o navegador recebe um cookie `httpOnly` (30 dias) com um HMAC derivado do código, nunca o código em si;
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

O projeto é um Next.js padrão e roda na Vercel sem configuração extra **para o código**, mas a persistência em arquivo não funciona lá. Antes de publicar:

1. trocar `src/lib/db.ts` por um armazenamento hospedado (por exemplo, um Postgres gratuito), mantendo a mesma interface;
2. configurar `HUNTER_ACCESS_CODE` nas variáveis de ambiente do projeto na Vercel;
3. só então cadastrar dados reais.

## Fases futuras (fora da V1)

- Armazenamento compartilhado hospedado, para Brunno e Carol usarem os mesmos dados em dispositivos diferentes.
- Login multiusuário (contas individuais no lugar do código compartilhado).
- Busca automática de vagas.
- Candidatura automática.
- Integração com o LinkedIn.
