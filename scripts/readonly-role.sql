-- Usuário somente leitura para o MCP do Postgres do Claude Code (.mcp.json).
-- Idempotente. Rodar com:
--   docker-compose exec -T db psql -U mechhelper -d mechhelper < scripts/readonly-role.sql
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'claude_ro') THEN
    CREATE ROLE claude_ro LOGIN PASSWORD 'claude_ro';
  END IF;
END $$;
ALTER ROLE claude_ro SET default_transaction_read_only = on;
GRANT CONNECT ON DATABASE mechhelper TO claude_ro;
GRANT USAGE ON SCHEMA public TO claude_ro;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO claude_ro;
-- tabelas criadas depois também ficam legíveis
ALTER DEFAULT PRIVILEGES FOR ROLE mechhelper IN SCHEMA public GRANT SELECT ON TABLES TO claude_ro;
