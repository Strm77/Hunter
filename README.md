# Hunter

App web para organizar a busca de emprego da Carol: candidaturas e retornos, histórico de vagas com links do LinkedIn, perfil profissional (currículo-base) e versões do currículo adaptadas por vaga.

> ## Onde ficam os dados
>
> - **Publicado (Vercel):** os dados ficam num **banco de dados hospedado** (projeto Supabase `hunter`, plano gratuito). Quem entra no endereço publicado com e-mail e senha vê os mesmos dados, em qualquer aparelho: Brunno pelo celular e Carol pelo computador, por exemplo.
> - **Rodando no próprio computador sem as variáveis do banco:** os dados ficam num arquivo no servidor onde o app roda (`data/hunter.json`). Instalações separadas não compartilham informação, e esse arquivo não persiste na Vercel.
> - Só os e-mails listados em `HUNTER_EMAILS_PERMITIDOS` (**Brunno e Carol**) conseguem criar conta. A lista fica só nas variáveis de ambiente, nunca no repositório.
> - Plano gratuito do Supabase: projetos sem uso por cerca de uma semana são pausados. Se o app mostrar erro de banco depois de muito tempo parado, reative o projeto no painel do Supabase.

## O que tem na V1

1. **Candidaturas e retornos** (`/`): empresa, cargo, data, status (Candidatada, Em análise, Retorno recebido, Entrevista, Recusada, Aprovada, Sem retorno, Desisti), próxima ação e observações. Filtros por status, busca e contadores (total, aguardando retorno, com retorno, entrevistas). Cada candidatura pode apontar para a vaga do histórico e para a versão do currículo enviada. **Histórico**: linha do tempo com cada passo (contato, entrevista, nota); toda mudança de status entra sozinha, com data e e-mail de quem registrou. Ao vincular uma versão do currículo, ela fica **congelada** na candidatura (`/candidaturas/<id>/curriculo`): mudanças posteriores no perfil não alteram o registro do que foi enviado.
   **Linha do tempo** (`/linha-do-tempo`): gráfico colorido de candidaturas por dia (cor = estágio atual: aguardando, retorno/entrevista, aprovada, encerrada), períodos de 14, 30 e 90 dias ou tudo, e a lista dia a dia com cada candidatura (link da vaga, currículo enviado, histórico completo) e tudo o que foi registrado no dia, com hora e autor. Alterações de empresa, cargo, data, vaga ou currículo entram sozinhas no histórico; registros automáticos não podem ser apagados; vagas salvas, alteradas ou removidas, versões de currículo criadas ou removidas, candidaturas removidas e registros manuais apagados ficam no registro de atividades, com um resumo do item.
2. **Histórico de vagas** (`/vagas`): título, empresa, link da publicação (abre a vaga original em nova aba), tema, descrição completa colada, local, modalidade, tipo de candidatura, origem, situação na triagem (Nova, Em preparação, Pronta para enviar, Candidatada, Descartada), data e notas. Filtros por tema e situação. Vaga repetida (mesmo link ou mesmo código de vaga do LinkedIn) é recusada. **Marcar como enviada**: depois que a titular envia a candidatura pelo site da vaga, registra aqui; o Hunter cria a candidatura, vincula e congela a versão do currículo e marca a vaga como Candidatada.
   - **Temas** (`/temas`): os tipos de vaga que interessam (ex.: "Comunicação"), com palavras-chave, termos a evitar, local, modalidade, senioridade e ativo/pausado.
3. **Perfil profissional** (`/perfil`): dados pessoais, resumo, experiências, formação, certificações e habilidades. Preenchido à mão ou **importado do PDF do currículo** (veja abaixo).
4. **Currículos por vaga** (`/curriculos`): versões do currículo-base vinculadas a uma vaga, com registro da data em que foram enviadas. Pré-visualização e impressão/PDF pelo navegador.

### Importar currículo em PDF

Em `/perfil`, “Escolher PDF” envia o arquivo para `/api/perfil/importar`, que lê o texto com posição, tamanho e fonte (`unpdf`) e separa nos campos (`src/lib/leitorCurriculo.ts`): nome, título, e-mail, telefone, LinkedIn, resumo, experiências (empresa, cargo, datas, atividades), formação, certificações (nome e emissor) e habilidades (inclui idiomas). Entende layout em duas colunas e seções que continuam na página seguinte.

- Não usa IA nem serviço externo, e não tem custo. Só copia texto que está no PDF; nada é inventado.
- O PDF é lido em memória e descartado; não é guardado.
- O resultado só preenche campos vazios e acrescenta itens que ainda não existem. Nada é salvo até clicar em “Salvar perfil”.
- PDF escaneado (imagem) não tem texto para ler. Layouts muito diferentes podem precisar de ajuste à mão na revisão.

### Regra das versões de currículo

Uma versão **não guarda texto próprio**: ela só guarda referências (por id) aos itens do currículo-base, a ordem e quais estão em destaque. Com isso:

- não é possível incluir numa versão uma experiência, formação ou certificação que não exista no perfil (o servidor descarta qualquer referência desconhecida);
- corrigir algo no perfil atualiza todas as versões;
- remover um item do perfil remove esse item de todas as versões.

O app começa vazio: não há dados de exemplo.

## Login e cadastro

Todo o app (páginas e API) fica atrás de login com **e-mail e senha**:

- `/cadastro`: e-mail, senha (mínimo 8 caracteres) e pronto, já entra no app. Só aceita e-mails da lista `HUNTER_EMAILS_PERMITIDOS` (separados por vírgula). **Sem essa variável, ninguém consegue se cadastrar.**
- `/entrar`: e-mail e senha. Erro de login espera 0,8 s antes de responder, para frear tentativas repetidas.
- As senhas são guardadas só como hash `scrypt` com sal aleatório (tabela `hunter_privado.usuario`, ou `data/usuarios.json` sem banco). A senha em si nunca é salva.
- A sessão é um cookie `httpOnly`, `sameSite=lax`, assinado com HMAC-SHA256 e válido por 30 dias. O middleware (`src/middleware.ts`) confere assinatura e validade **no servidor** a cada requisição; sem sessão válida, as páginas redirecionam para `/entrar` e a API responde 401.
- A chave que assina a sessão vem de `HUNTER_SESSION_SECRET` (ou, se não existir, do `HUNTER_DB_TOKEN`). Trocar essa chave encerra todas as sessões. O botão “Sair” encerra a sessão no navegador.
- Os dados (candidaturas, vagas, perfil, currículos) são os mesmos para todas as contas: as contas servem para controlar quem entra.

Ainda não há “esqueci minha senha”. Para redefinir, apague a linha do e-mail em `hunter_privado.usuario` e cadastre de novo.

Nenhum segredo vai para o repositório: os valores ficam só no `.env.local` (ignorado pelo git) e nas variáveis da Vercel. Veja `.env.example`.

## Como rodar

Requisitos: Node.js 20 ou mais recente.

```bash
npm install
cp .env.example .env.local
# edite .env.local: HUNTER_EMAILS_PERMITIDOS e HUNTER_SESSION_SECRET (ex.: openssl rand -base64 32)
npm run dev
```

Abra http://localhost:3000, crie a conta em /cadastro e entre.

Para rodar em modo produção local: `npm run build && npm start`.

### Dados

- **Com banco hospedado:** defina `HUNTER_SUPABASE_URL`, `HUNTER_SUPABASE_KEY` e `HUNTER_DB_TOKEN` (veja `.env.example`). Tudo fica num único documento JSON no banco, com número de versão: se duas pessoas salvarem ao mesmo tempo, o servidor relê e aplica de novo, sem apagar a alteração da outra.
- **Sem banco:** `data/hunter.json` (ou a pasta de `HUNTER_DATA_DIR`). A pasta `data/` está no `.gitignore`. Backup: copie o arquivo.

### Banco de dados (Supabase)

O esquema está em `supabase/migrations/`. As tabelas ficam no schema `hunter_privado`, que a API pública não expõe. O app acessa só por funções (`hunter_ler`, `hunter_gravar`, `hunter_usuario_criar`, `hunter_usuario_buscar`) que recusam qualquer chamada sem o `HUNTER_DB_TOKEN`; o banco guarda apenas o SHA-256 desse token. Por isso a chave publicável do Supabase, sozinha, não lê nem grava nada.

Para trocar o token: gere um novo, atualize o hash em `hunter_privado.acesso` e a variável `HUNTER_DB_TOKEN` na Vercel, e publique de novo.

## Estrutura

```
src/
  middleware.ts           exige login em todas as páginas e na API
  lib/types.ts            modelos de dados
  lib/db.ts               leitura/escrita do JSON, validação e sanitização
  lib/sessao.ts           cookie de sessão assinado
  lib/usuarios.ts         contas, hash de senha e lista de e-mails permitidos
  app/api/...             rotas: /api/candidaturas, /api/vagas, /api/temas, /api/curriculos, /api/perfil, /api/marcar-enviada, /api/entrar, /api/cadastro, /api/sair
  app/page.tsx            painel de candidaturas
  app/vagas, perfil, curriculos, entrar, cadastro   demais telas
```

## Deploy na Vercel

O app está publicado no projeto `hunter` da Vercel. Variáveis de ambiente configuradas lá (produção):

- `HUNTER_EMAILS_PERMITIDOS`: e-mails que podem criar conta, separados por vírgula;
- `HUNTER_SESSION_SECRET` (opcional): chave que assina as sessões; sem ela, usa o `HUNTER_DB_TOKEN`;
- `HUNTER_SUPABASE_URL` e `HUNTER_SUPABASE_KEY`: endereço e chave publicável do projeto Supabase `hunter`;
- `HUNTER_DB_TOKEN`: token secreto do servidor para o banco.

Para liberar outra pessoa, acrescente o e-mail em `HUNTER_EMAILS_PERMITIDOS` e publique de novo.

## Fases futuras (fora da V1)

- Dados separados por conta e recuperação de senha por e-mail.
- Busca automática de vagas.
- Candidatura automática.
- Integração com o LinkedIn.
