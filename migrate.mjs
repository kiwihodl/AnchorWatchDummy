import { migrate } from "drizzle-orm/postgres-js/migrator";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  throw new Error(
    "DATABASE_URL is not set in your .env.local file. Please check the file and its contents."
  );
}
const migrationClient = postgres(dbUrl, { max: 1 });

async function main() {
  console.log("Waiting for database to be ready...");
  await new Promise((resolve) => setTimeout(resolve, 5000)); 

  console.log("Running migrations...");

  await migrate(drizzle(migrationClient), {
    migrationsFolder: "./src/server/db/migrations",
  });

  console.log("Migrations finished!");
  process.exit(0);
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
