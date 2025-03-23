# Use Node.js como base
FROM node:22-slim

# Diretório de trabalho
WORKDIR /app

# Copiar o package.json docker simplificado
COPY docker-package.json ./package.json

# Instalar apenas as dependências de produção
RUN npm install --omit=dev

# Copiar os arquivos compilados
COPY build/ ./build/

# Defina variáveis de ambiente com valores padrão
ENV FIGMA_ACCESS_TOKEN=""
ENV PORT=8080
# Padrão é HTTP para uso com Claude Desktop
ENV MCP_TRANSPORT="http"

# Expor a porta para conexões HTTP (apenas usado se MCP_TRANSPORT=http)
EXPOSE 8080

# Verifique se as variáveis essenciais estão definidas no startup
COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

# Use um script de entrada para verificações antes da execução
ENTRYPOINT ["/app/entrypoint.sh"]

# Comando para executar o servidor
CMD ["node", "./build/index.js"]