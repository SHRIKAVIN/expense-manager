import { useCallback, useEffect, useMemo, useReducer, useState } from "react";
import { useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Screen } from "@/layout/Screen";
import { cn } from "@/lib/cn";
import { pressProps, usePrefersReducedMotion } from "@/lib/motion";
import { useAuth } from "@/auth/AuthProvider";
import { useAppData } from "@/data/AppDataProvider";
import type { ReimbursementRequest } from "@/lib/types";

// ─── Types ────────────────────────────────────────────────────────────────────

type CalcOp = "+" | "-" | "×" | "÷";

/**
 * iOS Calculator State Machine
 * ─────────────────────────────
 * waitingForOperand = true means: the next digit keypress should REPLACE the
 * display entirely (fresh input), not append to it. This is set after:
 *   • pressing any operator  (÷ × − +)
 *   • pressing =
 */
interface CalcState {
  display: string;          // What the main display shows
  operand: number | null;   // Stored left-hand value (set when op is pressed)
  operator: CalcOp | null;  // Pending operator
  waitingForOperand: boolean; // Next digit starts fresh
  lastOperand: number | null; // For repeated = (iOS repeats last RHS + op)
  lastOperator: CalcOp | null;
  expression: string;       // Sub-expression shown above the main number
}

type CalcAction =
  | { type: "DIGIT"; digit: string }
  | { type: "DECIMAL" }
  | { type: "OPERATOR"; op: CalcOp }
  | { type: "EQUALS" }
  | { type: "CLEAR" }
  | { type: "TOGGLE_SIGN" }
  | { type: "PERCENT" }
  | { type: "BACKSPACE" }
  | { type: "RESET"; state: CalcState };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function compute(a: number, op: CalcOp, b: number): number {
  switch (op) {
    case "+": return a + b;
    case "-": return a - b;
    case "×": return a * b;
    case "÷": return b === 0 ? NaN : a / b;
  }
}

function cleanNumber(n: number): string {
  if (!isFinite(n) || isNaN(n)) return "Error";
  // Keep up to 12 significant digits, strip trailing zeros
  const s = parseFloat(n.toPrecision(12)).toString();
  return s;
}

function displayFormat(s: string): string {
  if (s === "Error") return "Error";
  // Add thousand separators to the integer part
  const [int, dec] = s.split(".");
  const formatted = int.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return dec !== undefined ? `${formatted}.${dec}` : formatted;
}

function getPendingReimbursementAmounts(
  reimbursements: ReimbursementRequest[],
  reimbursementsToPay: ReimbursementRequest[],
  reimbursementsToConfirm: ReimbursementRequest[],
  userId: string,
): number[] {
  const seen = new Set<string>();
  const amounts: number[] = [];

  const add = (req: ReimbursementRequest) => {
    if (seen.has(req.id)) return;
    seen.add(req.id);
    amounts.push(req.amount);
  };

  for (const req of reimbursementsToPay) add(req);
  for (const req of reimbursementsToConfirm) add(req);
  for (const req of reimbursements) {
    if (req.status === "pending" && req.requesterId === userId) add(req);
  }

  return amounts;
}

function seedFromReimbursements(amounts: number[]): CalcState {
  if (amounts.length === 0) return INITIAL;

  const parts = amounts.map((amount) => cleanNumber(amount));

  if (parts.length === 1) {
    return { ...INITIAL, display: parts[0]! };
  }

  const total = amounts.reduce((sum, amount) => sum + amount, 0);
  return {
    ...INITIAL,
    display: cleanNumber(total),
    expression: parts.map(displayFormat).join(" + "),
    waitingForOperand: true,
  };
}

const INITIAL: CalcState = {
  display: "0",
  operand: null,
  operator: null,
  waitingForOperand: false,
  lastOperand: null,
  lastOperator: null,
  expression: "",
};

// ─── Reducer ─────────────────────────────────────────────────────────────────

function calcReducer(state: CalcState, action: CalcAction): CalcState {
  switch (action.type) {

    case "DIGIT": {
      const { digit } = action;
      if (state.waitingForOperand) {
        // Fresh operand after = or an operator — start a new entry.
        return {
          ...state,
          display: digit === "0" ? "0" : digit,
          waitingForOperand: false,
          lastOperand: null,
          lastOperator: null,
        };
      }
      if (state.display === "Error") return state;
      // Max 12 digits (excluding minus and dot)
      const raw = state.display.replace("-", "").replace(".", "");
      if (raw.length >= 12) return state;
      const next = state.display === "0" ? digit : state.display + digit;
      return { ...state, display: next };
    }

    case "DECIMAL": {
      if (state.waitingForOperand) {
        return {
          ...state,
          display: "0.",
          waitingForOperand: false,
          lastOperand: null,
          lastOperator: null,
        };
      }
      if (state.display.includes(".")) return state;
      return { ...state, display: state.display + "." };
    }

    case "OPERATOR": {
      const { op } = action;
      if (state.display === "Error") return state;
      const current = parseFloat(state.display);

      // If there's already a pending operation AND we have a new operand typed
      // (not just came from pressing op or =), chain: compute first
      if (state.operator && state.operand !== null && !state.waitingForOperand) {
        const result = compute(state.operand, state.operator, current);
        const resultStr = cleanNumber(result);
        if (resultStr === "Error") {
          return {
            ...state,
            display: "Error",
            operand: null,
            operator: null,
            waitingForOperand: true,
            expression: "",
            lastOperand: null,
            lastOperator: null,
          };
        }
        return {
          ...state,
          display: resultStr,
          operand: result,
          operator: op,
          waitingForOperand: true,
          expression: `${displayFormat(resultStr)} ${op}`,
          lastOperand: null,
          lastOperator: null,
        };
      }

      // New operator (or swap operator before typing the next number)
      return {
        ...state,
        operand: current,
        operator: op,
        waitingForOperand: true,
        expression: `${displayFormat(state.display)} ${op}`,
        lastOperand: null,
        lastOperator: null,
      };
    }

    case "EQUALS": {
      if (state.display === "Error") return state;
      const current = parseFloat(state.display);

      // Repeated = only when the display still shows the last result (no new digits typed).
      if (
        state.waitingForOperand &&
        state.operator === null &&
        state.lastOperator &&
        state.lastOperand !== null
      ) {
        const result = compute(current, state.lastOperator, state.lastOperand);
        const resultStr = cleanNumber(result);
        return {
          ...state,
          display: resultStr,
          operand: null,
          operator: null,
          waitingForOperand: true,
          expression: "",
          lastOperand: state.lastOperand,
          lastOperator: state.lastOperator,
        };
      }

      if (state.operator === null || state.operand === null) {
        // No pending op — keep the current number and wait for the next entry.
        return { ...state, waitingForOperand: true };
      }

      const rhs = state.waitingForOperand ? state.operand : current;
      const result = compute(state.operand, state.operator, rhs);
      const resultStr = cleanNumber(result);

      return {
        ...state,
        display: resultStr,
        operand: null,
        operator: null,
        waitingForOperand: true,
        expression: "",
        lastOperand: rhs,
        lastOperator: state.operator,
      };
    }

    case "CLEAR": {
      return INITIAL;
    }

    case "RESET": {
      return action.state;
    }

    case "TOGGLE_SIGN": {
      if (state.display === "0" || state.display === "Error") return state;
      const toggled = state.display.startsWith("-")
        ? state.display.slice(1)
        : "-" + state.display;
      return { ...state, display: toggled };
    }

    case "PERCENT": {
      const n = parseFloat(state.display);
      if (isNaN(n)) return state;
      // iOS % behaviour: if there's a pending + or -, compute % of the stored operand
      if ((state.operator === "+" || state.operator === "-") && state.operand !== null) {
        return { ...state, display: cleanNumber((state.operand * n) / 100) };
      }
      return { ...state, display: cleanNumber(n / 100) };
    }

    case "BACKSPACE": {
      if (state.waitingForOperand || state.display === "Error") {
        return { ...state, display: "0", waitingForOperand: false };
      }
      const next = state.display.length <= 1 ? "0" : state.display.slice(0, -1);
      return { ...state, display: next.endsWith("-") ? "0" : next };
    }
  }
}

// ─── Button layout ────────────────────────────────────────────────────────────

type BtnVariant = "fn" | "op" | "eq" | "num";
interface Btn { label: string; action: CalcAction; variant: BtnVariant; wide?: boolean }

const ROWS: Btn[][] = [
  [
    { label: "AC",  action: { type: "CLEAR" },                   variant: "fn" },
    { label: "±",   action: { type: "TOGGLE_SIGN" },              variant: "fn" },
    { label: "%",   action: { type: "PERCENT" },                  variant: "fn" },
    { label: "÷",   action: { type: "OPERATOR", op: "÷" },        variant: "op" },
  ],
  [
    { label: "7",   action: { type: "DIGIT", digit: "7" },        variant: "num" },
    { label: "8",   action: { type: "DIGIT", digit: "8" },        variant: "num" },
    { label: "9",   action: { type: "DIGIT", digit: "9" },        variant: "num" },
    { label: "×",   action: { type: "OPERATOR", op: "×" },        variant: "op" },
  ],
  [
    { label: "4",   action: { type: "DIGIT", digit: "4" },        variant: "num" },
    { label: "5",   action: { type: "DIGIT", digit: "5" },        variant: "num" },
    { label: "6",   action: { type: "DIGIT", digit: "6" },        variant: "num" },
    { label: "−",   action: { type: "OPERATOR", op: "-" },        variant: "op" },
  ],
  [
    { label: "1",   action: { type: "DIGIT", digit: "1" },        variant: "num" },
    { label: "2",   action: { type: "DIGIT", digit: "2" },        variant: "num" },
    { label: "3",   action: { type: "DIGIT", digit: "3" },        variant: "num" },
    { label: "+",   action: { type: "OPERATOR", op: "+" },        variant: "op" },
  ],
  [
    { label: "0",   action: { type: "DIGIT", digit: "0" },        variant: "num", wide: true },
    { label: ".",   action: { type: "DECIMAL" },                  variant: "num" },
    { label: "=",   action: { type: "EQUALS" },                   variant: "eq" },
  ],
];

// ─── Component ────────────────────────────────────────────────────────────────

export function CalculatorScreen() {
  const reduced = usePrefersReducedMotion();
  const location = useLocation();
  const { user } = useAuth();
  const { ready, reimbursements, reimbursementsToPay, reimbursementsToConfirm } = useAppData();
  const [state, dispatch] = useReducer(calcReducer, INITIAL);
  const [pendingLabel, setPendingLabel] = useState<string | null>(null);

  const pendingAmounts = useMemo(
    () =>
      user
        ? getPendingReimbursementAmounts(
            reimbursements,
            reimbursementsToPay,
            reimbursementsToConfirm,
            user.id,
          )
        : [],
    [reimbursements, reimbursementsToPay, reimbursementsToConfirm, user],
  );

  const pendingKey = useMemo(() => pendingAmounts.join("|"), [pendingAmounts]);

  const applyReimbursementSeed = useCallback(() => {
    dispatch({ type: "RESET", state: seedFromReimbursements(pendingAmounts) });
    setPendingLabel(
      pendingAmounts.length === 0
        ? null
        : pendingAmounts.length === 1
          ? "1 pending refund"
          : `${pendingAmounts.length} pending refunds`,
    );
  }, [pendingAmounts]);

  // Re-seed when pending reimbursements change (including live sync + navigation refresh).
  useEffect(() => {
    if (location.pathname !== "/calculator" || !ready) return;
    applyReimbursementSeed();
  }, [ready, location.pathname, pendingKey, applyReimbursementSeed]);

  const clearCalculator = useCallback(() => {
    setPendingLabel(null);
    dispatch({ type: "CLEAR" });
  }, []);

  const { display, operator, waitingForOperand, expression } = state;

  // Keyboard support
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (/^\d$/.test(e.key)) { dispatch({ type: "DIGIT", digit: e.key }); return; }
      switch (e.key) {
        case ".": dispatch({ type: "DECIMAL" }); break;
        case "+": dispatch({ type: "OPERATOR", op: "+" }); break;
        case "-": dispatch({ type: "OPERATOR", op: "-" }); break;
        case "*": dispatch({ type: "OPERATOR", op: "×" }); break;
        case "/": e.preventDefault(); dispatch({ type: "OPERATOR", op: "÷" }); break;
        case "Enter":
        case "=": dispatch({ type: "EQUALS" }); break;
        case "Escape": clearCalculator(); break;
        case "Backspace": dispatch({ type: "BACKSPACE" }); break;
        case "%": dispatch({ type: "PERCENT" }); break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [clearCalculator]);

  const dispatchAction = (action: CalcAction) => {
    if (action.type === "CLEAR") {
      clearCalculator();
      return;
    }
    dispatch(action);
  };

  const formatted = displayFormat(display);
  const fontClass =
    formatted.length > 15 ? "text-3xl" :
    formatted.length > 11 ? "text-4xl" :
    formatted.length > 8  ? "text-5xl" :
                             "text-6xl";

  return (
    <Screen data-testid="calculator-screen">

      {/* ── Display ── */}
      <div className="rounded-2xl bg-canvas-parchment border border-hairline overflow-hidden mb-4">
        <div className="px-6 pt-5 pb-5 min-h-[8.5rem] flex flex-col justify-end items-end gap-1">
          {pendingLabel ? (
            <p className="text-fine-print text-primary/80 uppercase tracking-wide">
              {pendingLabel}
            </p>
          ) : null}
          {/* Sub-expression (e.g. "42 +") */}
          <AnimatePresence mode="wait">
            {expression ? (
              <motion.p
                key={expression}
                initial={reduced ? false : { opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.12 }}
                className="text-caption text-ink-muted-48 truncate max-w-full"
              >
                {expression}
              </motion.p>
            ) : null}
          </AnimatePresence>

          {/* Main number */}
          <motion.p
            key={formatted}
            initial={reduced ? false : { opacity: 0.55, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.09 }}
            className={cn(
              "font-semibold text-ink text-right tracking-tight leading-none break-all",
              fontClass,
            )}
          >
            {formatted}
          </motion.p>
        </div>
      </div>

      {/* ── Keypad ── */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {ROWS.map((row, ri) =>
          row.map((btn, ci) => {
            // Highlight active operator button
            const isActiveOp =
              btn.variant === "op" &&
              btn.action.type === "OPERATOR" &&
              (btn.action as { type: "OPERATOR"; op: CalcOp }).op === operator &&
              waitingForOperand;

            return (
              <motion.button
                key={`${ri}-${ci}`}
                id={`calc-btn-${btn.label.replace(/[^a-zA-Z0-9]/g, "_")}`}
                type="button"
                onClick={() => dispatchAction(btn.action)}
                whileTap={reduced ? undefined : pressProps.whileTap}
                transition={pressProps.transition}
                className={cn(
                  "relative flex items-center justify-center rounded-2xl",
                  "text-xl font-semibold select-none outline-none transition-colors",
                  btn.wide && "col-span-2 justify-start pl-7",
                  "h-[4.5rem]",
                  // Function row (AC, ±, %)
                  btn.variant === "fn" &&
                    "bg-canvas border border-hairline text-ink-muted-80 active:bg-canvas-parchment",
                  // Digit / decimal
                  btn.variant === "num" &&
                    "bg-canvas-parchment border border-hairline text-ink active:brightness-95",
                  // Operator — normal
                  btn.variant === "op" && !isActiveOp &&
                    "bg-primary/10 border border-primary/20 text-primary active:bg-primary/20",
                  // Operator — active (just pressed, waiting for next number)
                  btn.variant === "op" && isActiveOp &&
                    "bg-primary border border-primary text-on-primary shadow-lg",
                  // Equals — single column like iOS (0 spans 2, . and = each span 1)
                  btn.variant === "eq" &&
                    "bg-primary border border-primary text-on-primary shadow-lg active:brightness-110",
                )}
              >
                {btn.label}
              </motion.button>
            );
          })
        )}
      </div>

    </Screen>
  );
}
