#!/bin/bash
# Inicia o MongoDB como replica set de nó único, para o suporte a transações.
# Com autenticação ativa, o replica set exige um arquivo de chave entre os membros.
set -euo pipefail

KEY_FILE=/data/configdb/replica-set.key

if [ ! -f "$KEY_FILE" ]; then
  head -c 512 /dev/urandom | base64 -w0 > "$KEY_FILE"
fi

chmod 400 "$KEY_FILE"
chown mongodb:mongodb "$KEY_FILE"

exec docker-entrypoint.sh mongod --replSet rs0 --keyFile "$KEY_FILE" --bind_ip_all
