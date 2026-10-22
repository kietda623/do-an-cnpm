import "reflect-metadata";
import { getDisposableDatabaseUrl } from "./helpers/database.js";

if (process.env.API_TEST_MODE === "integration") {
  getDisposableDatabaseUrl(process.env);
}
