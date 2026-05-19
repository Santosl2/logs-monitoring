<img width="3418" height="703" alt="image" src="https://github.com/user-attachments/assets/212081a3-49e5-49b2-9cf3-ba0c21b3c759" />

# LogPlatform

> Projeto de estudos pessoais — também utilizado em produção de forma privada.

Uma plataforma de ingestão e consulta de logs construída com Node.js e ClickHouse. Expõe uma API REST para enviar logs de qualquer serviço e consultá-los com filtros, paginação e estatísticas agregadas.

---

## Stack

| Camada | Tecnologia |
|---|---|
| Runtime | Node.js 24 (ESM) |
| Linguagem | TypeScript 6 |
| Framework HTTP | Express 5 |
| Banco de dados | ClickHouse (MergeTree) |
| Client ClickHouse | `@clickhouse/client` |
| Execução em dev | `tsx watch` |
| Containerização | Docker + Docker Compose |

---

## Pré-requisitos

- [Docker](https://www.docker.com/) e Docker Compose
- Node.js 20+ (apenas para desenvolvimento local sem Docker)

---

## Variáveis de ambiente

Crie um arquivo `.env` na raiz do projeto:

```env
CLICKHOUSE_HOST=localhost
CLICKHOUSE_PORT=8123
CLICKHOUSE_DB=logs_db
API_KEY=change-me-secret-key
PORT=3000
```

---

## Rodando com Docker

```bash
docker compose up -d
```

A API ficará disponível em `http://localhost:3000`.

---

## Rodando localmente (dev)

```bash
# Sobe apenas o ClickHouse
docker compose up -d clickhouse

# Instala dependências
npm install

# Inicia com hot-reload
npm run dev
```

---

## Endpoints

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| `POST` | `/api/logs` | ✅ | Ingere um ou múltiplos logs |
| `GET` | `/api/logs` | — | Lista/pesquisa logs com filtros |
| `GET` | `/api/logs/:id` | — | Retorna um log pelo UUID |
| `GET` | `/api/stats` | — | Estatísticas agregadas |
| `GET` | `/` | — | Frontend estático |

### Autenticação

Rotas de escrita exigem o header `x-api-key` ou o query param `apiKey` com o valor definido em `API_KEY`.

### Filtros disponíveis em `GET /api/logs`

| Parâmetro | Tipo | Descrição |
|---|---|---|
| `userId` | string | Filtra por usuário |
| `search` | string | Busca em `body` e `message` |
| `level` | string | `info`, `warn`, `error` |
| `service` | string | Nome do serviço |
| `from` | ISO 8601 | Timestamp inicial |
| `to` | ISO 8601 | Timestamp final |
| `page` | number | Página (padrão: 1) |
| `limit` | number | Itens por página (máx: 500, padrão: 100) |

---

## Schema da tabela

```sql
CREATE TABLE logs_db.logs (
    id        UUID                DEFAULT generateUUIDv4(),
    timestamp DateTime64(3, 'UTC') DEFAULT now64(3),
    user_id   String,
    level     LowCardinality(String) DEFAULT 'info',
    message   String,
    body      String,
    service   String              DEFAULT '',
    metadata  String              DEFAULT '{}'
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (timestamp, user_id)
TTL timestamp + INTERVAL 90 DAY;
```

Logs são retidos por **90 dias** e então removidos automaticamente pelo TTL do ClickHouse.

---

## Testando as rotas

Use o arquivo `requests.http` com a extensão [REST Client](https://marketplace.visualstudio.com/items?itemName=humao.rest-client) no VS Code.
