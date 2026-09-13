import postgres from "@prisma/orm-postgres/runtime";
import type { Contract } from "../prisma/schema";
import contractJson from "../prisma/schema.json" with { type: "json" };

function createClient() {
  return postgres<Contract>({
    contractJson,
    url: process.env["DATABASE_URL"] ?? "",
  });
}

let client: ReturnType<typeof createClient> | undefined;

export function getDb() {
  if (!client) {
    client = createClient();
  }
  return client;
}
