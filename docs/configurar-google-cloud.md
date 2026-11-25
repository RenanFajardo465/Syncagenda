# Configurar o Google Cloud (feito por você, uma vez só)

Use a sua conta Google pessoal (a mesma da agenda). Leva uns 15 minutos.

## 1. Criar o projeto
1. Acesse <https://console.cloud.google.com>.
2. No topo, clique no seletor de projeto → **Novo projeto**. Nome: `Sync Agendas` → **Criar**.
3. Confirme que o projeto `Sync Agendas` está selecionado no topo.

## 2. Ativar a Google Calendar API
1. Menu ☰ → **APIs e serviços → Biblioteca**.
2. Pesquise **Google Calendar API** → clique nela → **Ativar**.

## 3. Tela de consentimento OAuth
1. Menu ☰ → **APIs e serviços → Tela de consentimento OAuth** (pode aparecer como **Google Auth Platform**). Clique em **Começar**.
2. Nome do app: `Sync Agendas`. E-mail de suporte: o seu → **Próxima**.
3. Público: **Externo** → **Próxima**. Informações de contato: o seu e-mail → **Próxima** → aceite e **Criar**.
4. Em **Acesso a dados** (ou **Escopos**) → **Adicionar ou remover escopos**, marque:
   - `.../auth/calendar.events`
   - `openid`, `.../auth/userinfo.email`, `.../auth/userinfo.profile`
   → **Atualizar** → **Salvar**.
5. Em **Público**, clique em **Publicar app** → **Confirmar**. O status precisa ficar **"Em produção"**.
   Isso é importante: em modo "Teste" a conexão expira a cada 7 dias. Não precisa pedir verificação ao Google.

## 4. Criar a credencial
1. Menu ☰ → **APIs e serviços → Credenciais → + Criar credenciais → ID do cliente OAuth**.
2. Tipo: **Aplicativo da Web**. Nome: `syncagenda`.
3. Em **URIs de redirecionamento autorizados**, adicione os dois:
   - `https://syncagenda.vercel.app/api/auth/google/callback`
   - `http://localhost:3000/api/auth/google/callback`
4. **Criar**. Vai aparecer o **ID do cliente** e a **Chave secreta do cliente**. Clique em **Baixar JSON** e guarde o arquivo em local seguro.
   Esses valores vão para as variáveis `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` no Vercel. Não cole no chat.

## Observação sobre o aviso "app não verificado"
Ao conectar o Google no painel, vai aparecer "O Google não verificou este app". É esperado: clique em **Avançado → Acessar Sync Agendas (não seguro)**. Isso acontece porque o app é de uso interno e não passou pela verificação do Google, que só seria necessária se virar produto.
