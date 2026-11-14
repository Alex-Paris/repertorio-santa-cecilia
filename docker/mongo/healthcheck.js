// Executado pelo healthcheck: inicia o replica set na primeira vez e confirma o nó primário.
try {
  rs.status();
} catch (error) {
  if (error.codeName !== "NotYetInitialized") {
    throw error;
  }
  rs.initiate({ _id: "rs0", members: [{ _id: 0, host: "mongo:27017" }] });
}

if (!db.hello().isWritablePrimary) {
  quit(1);
}
