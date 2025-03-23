#!/bin/sh

# Verifica se o token SonarQube foi fornecido
if [ -z "$SONAR_TOKEN" ]; then
  echo "ERRO: SONAR_TOKEN não definido. Por favor, defina esta variável de ambiente."
  echo "Exemplo: docker run -e SONAR_TOKEN=seu_token -e SONAR_URL=http://seu_sonarqube allanbruno/sonarqube-mcp"
  exit 1
fi

# Verifica se a URL do SonarQube foi fornecida
if [ -z "$SONAR_URL" ]; then
  echo "AVISO: SONAR_URL não definido. Usando valor padrão: http://localhost:9000"
fi

# Executa o comando fornecido (por padrão, node ./dist/index.js)
exec "$@"