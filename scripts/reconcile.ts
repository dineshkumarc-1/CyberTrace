import "dotenv/config";
import { reconcile } from "../lib/indexing";
import { close } from "../lib/db";
reconcile()
  .then((n) => console.log({ sourcesChecked: n }))
  .then(close)
  .catch(async (e) => {
    console.error(e);
    await close();
    process.exit(1);
  });
