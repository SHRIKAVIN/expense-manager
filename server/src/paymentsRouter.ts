/**
 * Express API mirroring the Edge Function contract.
 *
 * Mount under your host, e.g. app.use(paymentsRouter) →
 *   POST /api/v1/payments/create
 *   GET  /api/v1/payments/status/:transactionId
 *   POST /api/v1/bank-callbacks/upi-receiver
 *
 * SECURITY: Keep SUPABASE_SERVICE_ROLE_KEY and BANK_WEBHOOK_SECRET server-side only.
 * Never ship them in the Vite/PWA bundle.
 *
 * Run (from repo root after npm i express cors dotenv in server/):
 *   cd server && npm install && npm run dev
 */

import { randomBytes } from "node:crypto";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { Router, type Request, type Response, type NextFunction } from "express";

export type UpiPaymentStatus = "PENDING" | "PAID" | "FAILED" | "EXPIRED";

type AuthedRequest = Request & { user?: User };

function adminClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY required");
  return createClient(url, key);
}

function anonClient(authHeader: string): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const anon = process.env.SUPABASE_ANON_KEY;
  if (!url || !anon) throw new Error("SUPABASE_URL / SUPABASE_ANON_KEY required");
  return createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
}

function cryptoTxnId(): string {
  return `EM${randomBytes(16).toString("hex")}`.slice(0, 35);
}

async function requireUser(req: AuthedRequest, res: Response, next: NextFunction) {
  const auth = req.header("authorization");
  if (!auth?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const { data, error } = await anonClient(auth).auth.getUser();
    if (error || !data.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    req.user = data.user;
    next();
  } catch (err) {
    res.status(401).json({ error: "Unauthorized" });
  }
}

export const paymentsRouter = Router();

/** POST /api/v1/payments/create */
paymentsRouter.post("/api/v1/payments/create", requireUser, async (req: AuthedRequest, res) => {
  try {
    const expenseId = String(req.body?.expenseId ?? "").trim();
    const amount = Number(req.body?.amount);
    const payeeVpa = String(req.body?.payeeVpa ?? "").trim().toLowerCase();
    const relatedExpenseIds = (req.body?.relatedExpenseIds as string[] | undefined) ?? [];
    if (!expenseId || !(amount > 0) || !payeeVpa) {
      res.status(400).json({ error: "expenseId, amount, and payeeVpa are required" });
      return;
    }

    const transactionId = cryptoTxnId();
    const currency = String(req.body?.currency ?? "INR").toUpperCase();
    const payeeName = String(req.body?.payeeName ?? "Payee").trim() || "Payee";
    const note = String(req.body?.note ?? "Reimbursement").trim().slice(0, 80);
    const related = relatedExpenseIds.filter((id) => id && id !== expenseId);

    const admin = adminClient();
    const { data, error } = await admin
      .from("upi_payment_transactions")
      .insert({
        transaction_id: transactionId,
        expense_id: expenseId,
        related_expense_ids: related,
        payer_id: req.user!.id,
        payee_vpa: payeeVpa,
        amount,
        currency,
        preferred_app: req.body?.preferredApp ?? null,
        note,
        status: "PENDING",
      })
      .select("transaction_id, amount, currency, payee_vpa, note, status, created_at")
      .single();

    if (error || !data) {
      res.status(500).json({ error: error?.message ?? "Could not create payment" });
      return;
    }

    res.status(201).json({
      transactionId: data.transaction_id,
      amount: Number(data.amount),
      currency: data.currency,
      payeeVpa: data.payee_vpa,
      payeeName,
      note: data.note || note,
      status: data.status,
      createdAt: data.created_at,
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Server error" });
  }
});

/** GET /api/v1/payments/status/:transactionId */
paymentsRouter.get(
  "/api/v1/payments/status/:transactionId",
  requireUser,
  async (req: AuthedRequest, res) => {
    try {
      const transactionId = String(req.params.transactionId ?? "").trim();
      const auth = req.header("authorization")!;
      const { data, error } = await anonClient(auth)
        .from("upi_payment_transactions")
        .select("transaction_id, expense_id, amount, currency, status, paid_at, updated_at")
        .eq("transaction_id", transactionId)
        .maybeSingle();

      if (error) {
        res.status(500).json({ error: error.message });
        return;
      }
      if (!data) {
        res.status(404).json({ error: "Not found" });
        return;
      }

      res.json({
        transactionId: data.transaction_id,
        expenseId: data.expense_id,
        amount: Number(data.amount),
        currency: data.currency,
        status: data.status,
        paidAt: data.paid_at,
        updatedAt: data.updated_at,
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : "Server error" });
    }
  },
);

/** POST /api/v1/bank-callbacks/upi-receiver */
paymentsRouter.post("/api/v1/bank-callbacks/upi-receiver", async (req, res) => {
  const expected = process.env.BANK_WEBHOOK_SECRET;
  const provided = req.header("x-bank-webhook-secret");
  if (!expected || !provided || provided !== expected) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  try {
    const merchantTranId = String(req.body?.merchant_tran_id ?? "").trim();
    const amount = Number(req.body?.amount);
    if (!merchantTranId || !(amount > 0)) {
      res.status(400).json({ error: "merchant_tran_id and amount required" });
      return;
    }

    const admin = adminClient();
    const { data: tx, error: txErr } = await admin
      .from("upi_payment_transactions")
      .select("*")
      .eq("transaction_id", merchantTranId)
      .maybeSingle();

    if (txErr) {
      res.status(500).json({ error: txErr.message });
      return;
    }
    if (!tx) {
      res.status(200).json({ ok: false, reason: "unknown_transaction" });
      return;
    }
    if (Math.abs(Number(tx.amount) - amount) > 0.009) {
      res.status(200).json({ ok: false, reason: "amount_mismatch" });
      return;
    }
    if (tx.status === "PAID") {
      res.status(200).json({ ok: true, status: "PAID", idempotent: true });
      return;
    }

    const now = new Date().toISOString();
    await admin
      .from("upi_payment_transactions")
      .update({
        status: "PAID",
        bank_reference: req.body?.bank_reference ?? null,
        paid_at: now,
        updated_at: now,
      })
      .eq("transaction_id", merchantTranId)
      .eq("status", "PENDING");

    const ids = [tx.expense_id as string, ...((tx.related_expense_ids as string[]) ?? [])];
    for (const requestId of [...new Set(ids)]) {
      const { error: markErr } = await admin.rpc("mark_reimbursement_paid", {
        request_id: requestId,
      });
      if (markErr) console.error("mark_reimbursement_paid", requestId, markErr.message);
    }

    res.status(200).json({ ok: true, status: "PAID" });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Server error" });
  }
});
