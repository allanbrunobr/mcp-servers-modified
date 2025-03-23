# Use Node.js como base
FROM node:22-slim

# Diretório de trabalho
WORKDIR /app

# Copiar o package.json docker simplificado
COPY docker-package.json ./package.json

# Instalar apenas as dependências de produção
RUN npm install --omit=dev

# Copiar os arquivos compilados
COPY dist/ ./dist/

# Defina variáveis de ambiente com valores padrão
ENV GOOGLE_APPLICATION_CREDENTIALS=""
ENV GOOGLE_CLOUD_PROJECT=""

# Verifique se as variáveis essenciais estão definidas no startup
COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

# Use um script de entrada para verificações antes da execução
ENTRYPOINT ["/app/entrypoint.sh"]

# Comando para executar o servidor
CMD ["node", "./dist/index.js"]