#!/bin/sh

# Verifica se o token Figma foi fornecido
if [ -z "$FIGMA_ACCESS_TOKEN" ]; then
  echo "AVISO: FIGMA_ACCESS_TOKEN não definido. A API exigirá que o token seja fornecido em cada solicitação."
  # Não fazemos exit 1 aqui para permitir que o servidor inicie sem token
fi

# Verifica o modo de transporte
if [ "$MCP_TRANSPORT" = "http" ]; then
  echo "Iniciando servidor Figma MCP no modo HTTP na porta $PORT"
  echo "Endpoint MCP disponível em: http://localhost:$PORT/mcp"
else
  echo "Iniciando servidor Figma MCP no modo stdio"
fi

# Executa o comando fornecido (por padrão, node ./build/index.js)
exec "$@"