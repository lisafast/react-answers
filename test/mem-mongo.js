import { MongoMemoryServer } from "mongodb-memory-server";
import { spawn } from "child_process";

async function start() {
  const mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();

  console.log("In-memory MongoDB started at:", uri);

  // Start your dev server with the in-memory MongoDB URI
  const child = spawn("npm", ["run", "dev"], {
    stdio: "inherit",
    env: {
      ...process.env,
      MONGODB_URI: uri,
    },
  });

  child.on("exit", (code) => {
    mongod.stop();
    process.exit(code);
  });
}

start();
