# Texto para o administrador do Microsoft 365

> Copie o texto abaixo e envie ao administrador. Depois que ele terminar, peça que te mande **por um canal seguro** (não por e-mail aberto, nem pelo chat com o Claude) os três valores do final: ID do diretório (tenant), ID do aplicativo (client) e o valor do segredo. Você vai colá-los direto nas variáveis de ambiente do Vercel.

---

Olá! Tudo bem?

Estou montando uma ferramenta interna para sincronizar a minha agenda do Outlook com a minha agenda Google (e a do Leonardo Primocena), para substituir uma automação do Zapier. Preciso que você registre um aplicativo no Microsoft Entra (Azure) da nossa empresa. Leva uns 10 minutos:

**1. Criar o registro do aplicativo**
1. Acesse <https://entra.microsoft.com> com sua conta de administrador.
2. No menu da esquerda: **Identidade → Aplicativos → Registros de aplicativo → + Novo registro**.
3. Nome: `Sync Agendas`.
4. Tipos de conta com suporte: **"Contas somente neste diretório organizacional (locatário único)"**.
5. URI de Redirecionamento: escolha **Web** e cole: `https://syncagenda.vercel.app/api/auth/microsoft/callback`
6. Clique em **Registrar**.

**2. Adicionar o endereço de teste**
1. No aplicativo criado, vá em **Autenticação → Adicionar URI** e cole: `http://localhost:3000/api/auth/microsoft/callback`
2. Clique em **Salvar**.

**3. Permissões (todas do tipo "Delegadas", nenhuma de aplicativo)**
1. Vá em **Permissões de APIs → + Adicionar uma permissão → Microsoft Graph → Permissões delegadas**.
2. Marque: `User.Read`, `Calendars.ReadWrite`, `offline_access`, `openid`, `email`, `profile`.
3. Clique em **Adicionar permissões**.
4. Clique em **"Conceder consentimento do administrador para [empresa]"** e confirme. As permissões devem ficar com o ícone verde.

Observação: são permissões **delegadas**, ou seja, o aplicativo só acessa a agenda de quem fizer login nele (eu e o Leonardo), e somente a agenda. Ele não tem acesso aos e-mails nem à agenda de outras pessoas.

**4. Criar o segredo**
1. Vá em **Certificados e segredos → + Novo segredo do cliente**.
2. Descrição: `vercel`. Validade: **24 meses**.
3. Clique em **Adicionar** e copie a coluna **Valor** na hora (ela só aparece uma vez).
4. Me avise a data de expiração, para eu anotar.

**5. Me enviar com segurança**
- **ID do diretório (locatário)** e **ID do aplicativo (cliente)**: ficam na página **Visão geral** do aplicativo.
- **Valor do segredo** (passo 4).

Por favor, me mande o valor do segredo por um canal seguro (por exemplo, um link de senha de uso único), não por e-mail comum.

Obrigado!
