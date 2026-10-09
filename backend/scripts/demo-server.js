/*
  Demo / development server with NO external services:
    npm run demo
  - MongoDB: in-memory (nothing is saved after you stop it; your Atlas database is not touched)
  - AI: MOCK_AI=true by default (sample data, no Gemini quota). Run with MOCK_AI=false to use your real
    GEMINI_API_KEY from .env against the in-memory database.
  Needs the dev dependency mongodb-memory-server.  Port: DEMO_PORT (default 5055).
*/
const { MongoMemoryServer } = require("mongodb-memory-server");

(async () => {
  const mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri("spirit_demo");
  if (process.env.MOCK_AI === undefined) process.env.MOCK_AI = "true";
  process.env.DNS_SERVERS = "system";

  const config = require("../src/config");
  const { app, connectMongoDB } = require("../server");
  await connectMongoDB();

  const port = Number(process.env.DEMO_PORT) || 5055;
  const server = app.listen(port, () => {
    console.log(`\nDEMO backend on http://localhost:${port}  (in-memory DB, ${config.mockAi ? "MOCK AI" : "REAL Gemini"})`);
    console.log(`Point the app at it:  EXPO_PUBLIC_API_URL=http://localhost:${port}\n`);
  });

  const stop = async () => {
    server.close();
    await mongod.stop();
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
})();
