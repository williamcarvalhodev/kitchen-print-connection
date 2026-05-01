# Kitchen Print Bridge — Deploy no Railway.app

## Como hospedar GRÁTIS no Railway.app

### Passo 1 — Criar conta e projeto no Railway

1. Acesse https://railway.app e crie uma conta gratuita (pode usar GitHub)
2. No dashboard, clique em **New Project → Deploy from GitHub repo**

### Passo 2 — Subir o código no GitHub

1. Crie um repositório **privado** no GitHub
2. Extraia o zip deste arquivo e envie os arquivos para o repositório:
   ```bash
   git init
   git add .
   git commit -m "Kitchen Print Bridge"
   git remote add origin https://github.com/SEU-USUARIO/SEU-REPO.git
   git push -u origin main
   ```

### Passo 3 — Configurar no Railway

1. No Railway: **New Project → Deploy from GitHub repo** → selecione seu repositório
2. Aguarde o build automático (cerca de 2 minutos)
3. Adicione um banco PostgreSQL: clique em **+ New → Database → PostgreSQL**
4. Clique no serviço do app → **Variables** → adicione:
   - `DATABASE_URL` → Railway já preenche automaticamente ao linkar o Postgres
   - `SESSION_SECRET` → coloque qualquer string aleatória (ex: `minha-chave-secreta-2024`)
5. Clique em **Settings → Networking → Generate Domain** para obter a URL pública

### Passo 4 — Configurar o Plugin WordPress

Na URL do plugin WordPress, use:
- **API URL**: `https://SEU-APP.up.railway.app/api`
- **API Key**: `kitchen-bridge-secret` (pode alterar nas configurações do app)

### Passo 5 — Configurar o Tablet da Cozinha

1. Abra `https://SEU-APP.up.railway.app` no tablet
2. Vá em **Settings**
3. Configure o IP da impressora: `192.168.0.113`, porta `80`
4. Coloque a mesma API Key do WordPress
5. Deixe o app aberto — ele imprimirá automaticamente novos pedidos

---

## Estrutura do projeto

```
├── src/
│   └── server.ts     # Servidor Express (API + serve o frontend)
├── frontend/
│   └── src/          # App React (dashboard, jobs, settings)
├── build.mjs         # Script de build
├── vite.config.mjs   # Config Vite para o frontend
├── railway.json      # Config Railway
└── package.json
```

## Variáveis de ambiente necessárias

| Variável | Descrição |
|---|---|
| `DATABASE_URL` | URL do PostgreSQL (Railway preenche automaticamente) |
| `PORT` | Porta do servidor (Railway preenche automaticamente) |

## Rodando localmente

```bash
npm install
npm run build
DATABASE_URL="postgresql://..." npm start
```
