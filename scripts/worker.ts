import "dotenv/config";
import { runOne } from "../lib/indexing";
import { close } from "../lib/db";
async function main() {
  if (process.argv.includes("--once")) {
    console.log({ processed: await runOne() });
    return;
  }
  if (process.argv.includes("--drain")) {
    let n = 0;
    while (await runOne()) n++;
    console.log({ processed: n });
    return;
  }
  while (true) {
    if (!(await runOne())) await new Promise((r) => setTimeout(r, 2000));
  }
}
main()
  .then(close)
  .catch(async (e) => {
    console.error(e);
    await close();
    process.exit(1);
  });
