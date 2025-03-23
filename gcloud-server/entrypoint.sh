#!/bin/sh

# Verifica se as credenciais do Google Cloud foram fornecidas
if [ -z "$GOOGLE_APPLICATION_CREDENTIALS" ]; then
  echo "ERRO: GOOGLE_APPLICATION_CREDENTIALS não definido. Por favor, defina esta variável de ambiente."
  echo "Exemplo: docker run -e GOOGLE_APPLICATION_CREDENTIALS=/path/to/credentials.json usuario/gcloud-mcp"
  exit 1
fi

# Verifica se o ID do projeto Google Cloud foi fornecido
if [ -z "$GOOGLE_CLOUD_PROJECT" ]; then
  echo "ERRO: GOOGLE_CLOUD_PROJECT não definido. Por favor, defina esta variável de ambiente."
  echo "Exemplo: docker run -e GOOGLE_CLOUD_PROJECT=seu-projeto-id usuario/gcloud-mcp"
  exit 1
fi

# Executa o comando fornecido (por padrão, node ./dist/index.js)
exec "$@"