import test from "node:test";
import assert from "node:assert/strict";
import {
  parseStatement,
  matchStatement,
  applyStatement,
  recordTrackedPayment,
  lastPayment,
} from "../src/payments.js";
import { normalizeCustomer, venmoLink } from "../src/data.js";
const customer = () =>
  normalizeCustomer({
    id: 10,
    name: "Demo Customer",
    address: "123 Test Lane",
    code: "DEMO10",
    balance: 80,
    paymentNote: "Existing note",
    visits: [{ id: 1, date: "October 3, 2026", status: "Scheduled" }],
    history: [{ date: "September 1, 2026" }],
    requests: [{ type: "Skip next cut", status: "New" }],
    custom: "Keep",
  });
const header = "ID,Datetime,Type,Status,Note,From,To,Amount (total)";
const line = (
  id,
  amount = "+ $25.00",
  status = "Complete",
  note = "Lawn service - 123 Test Lane",
  to = "Jesse Geottes",
  type = "Payment",
  date = "2026-09-29T10:20:00",
) => `${id},${date},${type},${status},${note},Demo Payer,${to},${amount}`;
test("Venmo statement ignores outgoing, pending, other recipients, invalid money and other transaction types", () => {
  const result = parseStatement(
    [
      header,
      line("100"),
      line("101", "- $25.00"),
      line("102", "+ $25.00", "Pending"),
      line("103", "+ $25.00", "Complete", "note", "Someone Else"),
      line("104", "+ €25.00"),
      line("105", "+ $25.00", "Complete", "note", "Jesse Geottes", "Transfer"),
      line("106", "+ $25.000"),
      line(
        "107",
        "+ $25.00",
        "Complete",
        "note",
        "Jesse Geottes",
        "Payment",
        "2026-02-30",
      ),
    ].join("\n"),
  );
  assert.equal(result.transactions.length, 1);
  assert.equal(result.transactions[0].id, "venmo:100");
});
test("CSV preserves long transaction IDs and quoted comma, newline and escaped quote fields", () => {
  const result = parseStatement(
    "Venmo Statement\r\n" +
      header +
      "\r\n" +
      line(
        "9876543210987654321",
        '"+ $1,250.00"',
        "Complete",
        '"Lawn service - 123 Test Lane, \'front\'\n""Thanks"""',
      ),
  );
  assert.equal(result.transactions[0].id, "venmo:9876543210987654321");
  assert.equal(result.transactions[0].amount, 1250);
  assert.match(result.transactions[0].note, /\n"Thanks"/);
  assert.throws(() => parseStatement("not a statement"));
  assert.throws(() => parseStatement(header + '\n"unfinished'));
});
test("Matching uses exact lawn note, flags ambiguous and historical matches, and does not change records", () => {
  const original = customer(),
    transactions = parseStatement(header + "\n" + line("100")).transactions;
  assert.equal(
    matchStatement(transactions, [original], "2026-09-01")[0].customerId,
    10,
  );
  assert.equal(
    matchStatement(
      transactions,
      [original, { ...original, id: 11 }],
      "2026-09-01",
    )[0].reason,
    "More than one possible customer",
  );
  assert.equal(
    matchStatement(transactions, [original], "2026-09-30")[0].reason,
    "Before your start date",
  );
  assert.equal(
    matchStatement(
      transactions,
      [{ ...original, paidDate: "9/29/2026" }],
      "2026-09-01",
    )[0].reason,
    "Check against an earlier recorded payment",
  );
  assert.equal(original.balance, 80);
});
test("Applying statement records partial payments once, retains original date and all customer access and history", () => {
  const original = customer(),
    url = venmoLink(original);
  const rows = matchStatement(
    parseStatement(header + "\n" + line("100")).transactions,
    [original],
    "2026-09-01",
  );
  const next = applyStatement([original], rows, "2026-09-01");
  assert.equal(next[0].balance, 55);
  assert.equal(next[0].paymentTransactions[0].date, "2026-09-29");
  assert.equal(lastPayment(next[0]).label, "9/29/2026");
  assert.equal(applyStatement(next, rows, "2026-09-01")[0].balance, 55);
  assert.equal(
    matchStatement(rows, next, "2026-09-01")[0].reason,
    "Already imported",
  );
  for (const key of ["code", "visits", "history", "requests", "custom"])
    assert.deepEqual(next[0][key], original[key]);
  assert.equal(venmoLink(original), url);
  assert.match(next[0].paymentNote, /Existing note/);
  assert.match(next[0].paymentNote, /9\/29\/2026: Received \$25.00/);
});
test("Batch overpayment, invalid date and unknown customer fail without changing input records", () => {
  const original = customer();
  const rows = matchStatement(
    parseStatement(
      header + "\n" + line("100", "+ $60.00") + "\n" + line("101", "+ $60.00"),
    ).transactions,
    [original],
    "2026-09-01",
  );
  assert.throws(() => applyStatement([original], rows, "2026-09-01"));
  assert.equal(original.balance, 80);
  assert.equal(original.paymentTransactions, undefined);
  assert.throws(() =>
    applyStatement([original], [{ ...rows[0], customerId: 999 }], "2026-09-01"),
  );
  assert.throws(() =>
    recordTrackedPayment(original, 10, "", { date: "2026-02-30" }),
  );
  assert.throws(() => recordTrackedPayment(original, 0.001));
});
test("Historical manual payments and legacy partial payment notes show correct last-received date", () => {
  const next = recordTrackedPayment(customer(), 10, "Cash", {
    date: "2026-09-25",
  });
  assert.equal(lastPayment(next).label, "9/25/2026");
  assert.equal(lastPayment(next).amount, 10);
  assert.equal(
    lastPayment({
      ...customer(),
      paidDate: "9/1/2026",
      paymentNote: "9/4/2026: Received $20.00\n9/6/2026: Received $10.00",
    }).label,
    "9/6/2026",
  );
});
