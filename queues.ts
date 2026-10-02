import Redis from "ioredis";
const r = new Redis("redis://localhost:6379", { maxRetriesPerRequest: 1 });
for (const prefix of ["bull:executions:", "bull:leetcode-submissions:"]) {
  try {
    const counts = await r.hgetall(prefix + "meta");
    const wait = await r.llen(prefix + "wait").catch(() => -1);
    const active = await r.llen(prefix + "active").catch(() => -1);
    const delayed = await r.llen(prefix + "delayed").catch(() => -1);
    const failed = await r.llen(prefix + "failed").catch(() => -1);
    console.log(prefix, "meta:", JSON.stringify(counts), "wait:", wait, "active:", active, "delayed:", delayed, "failed:", failed);
  } catch (e) {
    console.log(prefix, "ERR", (e as Error).message);
  }
}
r.disconnect();