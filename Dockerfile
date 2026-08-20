# --- Etapa 1: build do app (Vite) ---
FROM node:20-alpine AS build
WORKDIR /app

# Instala dependências a partir do lockfile (build reproduzível)
COPY package.json package-lock.json ./
RUN npm ci

# Copia o código e compila para /app/dist
COPY . .
# Chave de API opcional (análise de IA). Vazia por padrão; pode ser injetada
# como substituição do Cloud Build. Não é necessária para o app funcionar.
ARG API_KEY=""
ENV API_KEY=$API_KEY
RUN npm run build

# --- Etapa 2: servir os arquivos estáticos com nginx ---
FROM nginx:1.27-alpine

# Config do nginx com a porta vinda do ambiente (Cloud Run define $PORT).
# A imagem oficial processa /etc/nginx/templates/*.template com envsubst na
# inicialização, gerando /etc/nginx/conf.d/default.conf.
COPY nginx.conf /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html

# Cloud Run injeta PORT (padrão 8080). Deixamos 8080 como default local.
ENV PORT=8080
EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
