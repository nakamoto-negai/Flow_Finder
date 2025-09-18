#!/bin/sh
# wait-for-postgres.sh
# Usage: wait-for-postgres.sh host port user password dbname -- command args

set -e

host=$1
port=$2
user=$3
password=$4
dbname=$5
shift 5

export PGPASSWORD="$password"

until psql -h "$host" -U "$user" -p "$port" -d "$dbname" -c '\q' 2>/dev/null; do
  echo "Waiting for postgres at $host:$port..."
  sleep 1
done

exec "$@"
