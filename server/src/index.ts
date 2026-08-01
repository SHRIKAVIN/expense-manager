import cors from "cors";
import express from "express";
import { paymentsRouter } from "./paymentsRouter";

/**
 * Standalone Express host for direct UPI payment tracking.
 * Prefer Supabase Edge Functions in production if you already deploy there.
 *
 * Env: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, BANK_WEBHOOK_SECRET
 */
const app = express();
app.use(cors());
app.use(express.json({ limit: "32kb" }));
app.use(paymentsRouter);

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

const port = Number(process.env.PORT ?? 8787);
app.listen(port, () => {
  console.log(`Payments API listening on :${port}`);
});
