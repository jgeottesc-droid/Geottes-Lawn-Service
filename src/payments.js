import { arr, recordPayment, money, VENMO } from "./data";

const normalized = (value) =>
  String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
const dayKey = (value) => {
  const text = String(value || "").trim();
  let match = text.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T].*)?$/);
  if (!match) {
    const us = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T].*)?$/);
    if (us)
      match = [us[0], us[3], us[1].padStart(2, "0"), us[2].padStart(2, "0")];
  }
  if (!match) return "";
  const [, y, m, d] = match;
  const date = new Date(Number(y), Number(m) - 1, Number(d));
  return date.getFullYear() === Number(y) &&
    date.getMonth() + 1 === Number(m) &&
    date.getDate() === Number(d)
    ? `${y}-${m}-${d}`
    : "";
};
export const localDay = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};
const labelDay = (date) => {
  const [y, m, d] = date.split("-");
  return `${Number(m)}/${Number(d)}/${y}`;
};

export function lastPayment(customer) {
  const ledger = arr(customer.paymentTransactions)
    .slice()
    .reverse()
    .map((p) => ({ date: dayKey(p.date), amount: Number(p.amount) }));
  const legacy = String(customer.paymentNote || "")
    .split("\n")
    .reverse()
    .flatMap((line) => {
      const match = line.match(
        /^(\d{1,2}\/\d{1,2}\/\d{4}): Received \$([\d,]+(?:\.\d{2})?)/,
      );
      return match
        ? [
            {
              date: dayKey(match[1]),
              amount: Number(match[2].replaceAll(",", "")),
            },
          ]
        : [];
    });
  const all = [...ledger, ...legacy]
    .filter((p) => p.date)
    .sort((a, b) => b.date.localeCompare(a.date));
  return all[0]
    ? { ...all[0], label: labelDay(all[0].date) }
    : {
        date: dayKey(customer.paidDate),
        label: customer.paidDate || "Not recorded",
        amount: null,
      };
}
export function recordTrackedPayment(
  customer,
  amount,
  note = "",
  details = {},
) {
  const date = dayKey(details.date || localDay());
  if (!dayKey(date) || date > localDay())
    throw new Error("Choose a valid payment date, today or earlier.");
  if (!Number.isInteger(Math.round(Number(amount) * 1000) / 10))
    throw new Error("Enter a payment with no more than two decimal places.");
  const id =
    details.id || `manual:${Date.now()}:${Math.random().toString(36).slice(2)}`;
  if (arr(customer.paymentTransactions).some((p) => p.id === id))
    return customer;
  const next = recordPayment(customer, amount, note);
  return {
    ...next,
    paidDate: next.balance === 0 ? labelDay(date) : customer.paidDate,
    paymentNote: [
      customer.paymentNote,
      `${labelDay(date)}: Received ${money(amount)}${note ? " — " + note : ""}`,
    ]
      .filter(Boolean)
      .join("\n"),
    paymentTransactions: [
      ...arr(customer.paymentTransactions),
      {
        id,
        date,
        amount: Number(amount),
        source: details.source || "Manual",
        note,
      },
    ],
  };
}

// Parse quoted fields (including commas, escaped quotes, and newlines) without converting transaction IDs to numbers.
export function parseStatement(text) {
  if (typeof text !== "string" || text.length > 2_000_000)
    throw new Error("Choose a Venmo CSV statement smaller than 2 MB.");
  const rows = [];
  let row = [],
    field = "",
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (quoted || !field.trim()) quoted = !quoted;
      else
        throw new Error(
          "The CSV has a misplaced quote. Download a fresh Venmo statement.",
        );
    } else if (c === "," && !quoted) {
      row.push(field);
      field = "";
    } else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (quoted) throw new Error("The CSV has an unfinished quoted field.");
  row.push(field);
  rows.push(row);
  const headerIndex = rows.findIndex(
    (r) =>
      r.some((x) => normalized(x) === "id") &&
      r.some((x) => normalized(x) === "amounttotal") &&
      r.some((x) => normalized(x) === "datetime"),
  );
  if (headerIndex < 0)
    throw new Error(
      "This is not a supported Venmo statement. It needs ID, Datetime, Type, Status, Note, From, To, and Amount (total) columns.",
    );
  const header = rows[headerIndex].map(normalized);
  for (const required of [
    "id",
    "datetime",
    "type",
    "status",
    "note",
    "from",
    "to",
    "amounttotal",
  ])
    if (!header.includes(required))
      throw new Error(`The Venmo statement is missing the ${required} column.`);
  const get = (r, key) => String(r[header.indexOf(key)] || "").trim();
  const seen = new Set();
  let skipped = 0;
  const transactions = [];
  for (const r of rows.slice(headerIndex + 1)) {
    const raw = get(r, "amounttotal").replace(/[\s,$]/g, "");
    const id = get(r, "id"),
      date = dayKey(get(r, "datetime"));
    if (
      !id ||
      !date ||
      get(r, "type").toLowerCase() !== "payment" ||
      get(r, "status").toLowerCase() !== "complete" ||
      !/^\+?\d+(\.\d{1,2})?$/.test(raw) ||
      Number(raw) <= 0 ||
      normalized(get(r, "to")) !== normalized(VENMO)
    ) {
      skipped++;
      continue;
    }
    if (seen.has(id)) {
      skipped++;
      continue;
    }
    seen.add(id);
    transactions.push({
      id: `venmo:${id}`,
      date,
      amount: Number(raw),
      payer: get(r, "from"),
      note: get(r, "note"),
    });
  }
  return {
    transactions: transactions.sort((a, b) => a.date.localeCompare(b.date)),
    skipped,
  };
}
export function matchStatement(transactions, customers, since) {
  const imported = new Set(
    customers.flatMap((c) => arr(c.paymentTransactions).map((p) => p.id)),
  );
  return transactions.map((transaction) => {
    const candidates = customers.filter(
      (c) =>
        normalized(transaction.note) ===
        normalized(`Lawn service - ${c.address || c.name || "customer"}`),
    );
    const customer = candidates.length === 1 ? candidates[0] : null;
    let reason = "";
    if (imported.has(transaction.id)) reason = "Already imported";
    else if (transaction.date < since) reason = "Before your start date";
    else if (transaction.date > localDay()) reason = "Future date";
    else if (!customer)
      reason =
        candidates.length > 1
          ? "More than one possible customer"
          : "Choose a customer";
    else if (transaction.amount > Number(customer.balance))
      reason = "More than the current balance";
    else if (
      lastPayment(customer).date &&
      transaction.date <= lastPayment(customer).date
    )
      reason = "Check against an earlier recorded payment";
    return { ...transaction, customerId: customer?.id || "", reason };
  });
}
export function applyStatement(customers, transactions, since) {
  if (!dayKey(since)) throw new Error("Choose a valid start date.");
  let next = customers;
  const seen = new Set(
    customers.flatMap((c) => arr(c.paymentTransactions).map((p) => p.id)),
  );
  for (const t of transactions) {
    if (seen.has(t.id)) continue;
    if (
      !t.id.startsWith("venmo:") ||
      !dayKey(t.date) ||
      t.date < since ||
      t.date > localDay()
    )
      throw new Error("A payment is outside your selected date range.");
    const c = next.find((c) => String(c.id) === String(t.customerId));
    if (!c) throw new Error("Choose a customer for each selected payment.");
    const updated = recordTrackedPayment(
      c,
      t.amount,
      `Venmo · ${t.payer} · ${t.id.slice(6)}`,
      { id: t.id, date: t.date, source: "Venmo statement" },
    );
    next = next.map((item) => (item.id === c.id ? updated : item));
    seen.add(t.id);
  }
  return next;
}
