# --- Etapa 1: build do app (Vite) ---
FROM node:20-alpine AS build
WORKDIR /app

# Instala dependências a partir do lockfile
COPY package.json package-lock.json ./
RUN npm ci

# Copia o código e gera o build estático em /app/dist
COPY . .
RUN npm run build

# --- Etapa 2: servir os arquivos estáticos com nginx ---
FROM nginx:1.27-alpine

# Config do nginx com a porta vinda do ambiente (Cloud Run injeta $PORT).
# A imagem oficial do nginx processa *.template com envsubst na inicialização.
COPY nginx.conf /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html

# Porta padrão do Cloud Run (sobrescrita pela variável PORT quando presente)
ENV PORT=8080

CMD ["nginx", "-g", "daemon off;"]
