#!/bin/sh

# Verifica se o token GitHub foi fornecido
if [ -z "$GITHUB_PERSONAL_ACCESS_TOKEN" ]; then
  echo "ERRO: GITHUB_PERSONAL_ACCESS_TOKEN não definido. Por favor, defina esta variável de ambiente."
  echo "Exemplo: docker run -e GITHUB_PERSONAL_ACCESS_TOKEN=seu_token allanbruno/github-mcp"
  exit 1
fi

# Executa o comando fornecido (por padrão, node ./dist/index.js)
exec "$@"