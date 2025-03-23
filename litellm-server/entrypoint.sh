#!/bin/sh

# Verifica se a chave mestra do LiteLLM foi fornecida
if [ -z "$LITELLM_MASTER_KEY" ]; then
  echo "ERRO: LITELLM_MASTER_KEY não definido. Por favor, defina esta variável de ambiente."
  echo "Exemplo: docker run -e LITELLM_MASTER_KEY=sk-litellm-... usuario/litellm-mcp"
  exit 1
fi

# Executa o comando fornecido (por padrão, node ./dist/index.js)
exec "$@"