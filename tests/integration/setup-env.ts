// Prepara um banco descartável. Sem MongoDB acessível, a suíte falha em vez de ser ignorada.
const uri = process.env.MONGODB_TEST_URI ?? process.env.MONGODB_URI;

if (!uri) {
  throw new Error("Defina MONGODB_TEST_URI ou execute: docker compose exec app pnpm test:integration");
}

const host = uri.split("@").at(-1)?.split(/[:/?,]/)[0] ?? "";

if (!["localhost", "127.0.0.1", "mongo"].includes(host)) {
  throw new Error("Os testes de integração só podem acessar um MongoDB local.");
}

process.env.MONGODB_URI = uri;
process.env.MONGODB_DB_NAME = `repertorio_test_${process.pid}_${Date.now()}`;
process.env.BETTER_AUTH_SECRET = "segredo-apenas-para-testes-de-integracao-123";
process.env.BETTER_AUTH_URL = "http://localhost:3000";
process.env.AUTH_ALLOW_DEV_SIGNUP = "true";
// Nunca enviar e-mail real nos testes; o fluxo público configura um provedor simulado.
process.env.AUTH_ALLOW_SIGNUP = "false";
