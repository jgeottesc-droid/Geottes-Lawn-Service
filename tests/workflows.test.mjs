import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  ADMIN_CODE,
  VENMO,
  STORAGE_KEY,
  normalizeCustomer,
  recordPayment,
  changeVisit,
  appendVisits,
  addWeeks,
  getNextVisit,
  venmoLink,
  loadCloudCustomers,
  saveCloudCustomers,
} from "../src/data.js";

const customer = () =>
  normalizeCustomer({
    id: 7,
    name: "Sample Customer",
    address: "123 Test Lane",
    code: "SAMPLE7",
    balance: 80,
    notes: "Private note",
    paymentNote: "Existing note",
    customProperty: "Keep this",
    visits: [
      {
        id: 1,
        date: "September 10, 2026",
        time: "8:00–10:00 AM",
        service: "Weekly Mow",
        status: "Scheduled",
        weather: "Clear",
      },
    ],
    comments: ["Existing comment"],
    requests: [
      { type: "Skip next cut", note: "Sample request", status: "New" },
    ],
    history: [],
  });
test("existing access, payment destination, and storage settings remain unchanged", () => {
  const original = execFileSync(
    "git",
    ["show", "7457c9a3de8ab930be5829dd846f9eacfac8530c:src/App.jsx"],
    { encoding: "utf8" },
  );
  for (const [key, value] of Object.entries({ ADMIN_CODE, VENMO, STORAGE_KEY }))
    assert.equal(
      original.match(new RegExp(`const ${key} = "([^"]+)"`))[1],
      value,
    );
  const normalized = customer();
  assert.equal(normalized.code, "SAMPLE7");
  assert.equal(normalized.customProperty, "Keep this");
});
test("partial and full payments preserve codes, notes, schedules and history", () => {
  const original = customer();
  const partial = recordPayment(original, 25.25, "Cash");
  assert.equal(partial.balance, 54.75);
  assert.equal(partial.paid, false);
  assert.equal(partial.paymentStatus, "Unpaid");
  assert.match(partial.paymentNote, /Existing note/);
  assert.match(partial.paymentNote, /25.25/);
  for (const key of [
    "code",
    "visits",
    "comments",
    "requests",
    "history",
    "notes",
    "customProperty",
  ])
    assert.deepEqual(partial[key], original[key]);
  const full = recordPayment(partial, 54.75);
  assert.equal(full.balance, 0);
  assert.equal(full.paymentStatus, "Paid");
  assert.ok(full.paidDate);
  assert.equal(original.balance, 80);
  for (const bad of [-1, 0, 81, NaN, Infinity])
    assert.throws(() => recordPayment(original, bad));
});
test("Venmo retains the recipient, amount, and encoded customer note", () => {
  const url = new URL(venmoLink(customer()));
  assert.equal(url.origin, "https://venmo.com");
  assert.equal(url.pathname, "/Jesse-Geottes");
  assert.equal(url.searchParams.get("amount"), "80");
  assert.equal(url.searchParams.get("note"), "Lawn service - 123 Test Lane");
});
test("cut completion adds exactly one history record and preserves balance", () => {
  const completed = changeVisit(customer(), 1, { status: "Completed" });
  assert.equal(completed.visits[0].status, "Completed");
  assert.equal(completed.history.length, 1);
  assert.equal(completed.balance, 80);
  assert.equal(completed.code, "SAMPLE7");
  assert.equal(
    changeVisit(completed, 1, { status: "Completed" }).history.length,
    1,
  );
  assert.equal(getNextVisit(completed), null);
});
test("weekly scheduling crosses month and year boundaries correctly", () => {
  assert.equal(addWeeks("October 30, 2026", 1), "November 6, 2026");
  assert.equal(addWeeks("December 28, 2026", 1), "January 4, 2027");
  const draft = {
    date: "September 17, 2026",
    time: "8:00–10:00 AM",
    service: "Weekly Mow",
  };
  const next = appendVisits(customer(), draft, 4);
  assert.equal(next.visits.length, 5);
  assert.equal(next.visits[4].date, "October 8, 2026");
  assert.equal(new Set(next.visits.map((v) => v.id)).size, 5);
  assert.throws(() => appendVisits(next, draft));
  assert.equal(next.code, "SAMPLE7");
});
test("next visit is chronological and excludes completed cuts", () => {
  const c = customer();
  c.visits.unshift({ ...c.visits[0], id: 2, date: "October 1, 2026" });
  assert.equal(getNextVisit(c).date, "September 10, 2026");
});
test("cloud load is read-only; saving preserves unrelated data and uses a version guard", async () => {
  const originalFetch = global.fetch;
  const calls = [];
  global.fetch = async (url, options) => {
    calls.push({ url, options });
    return {
      ok: true,
      json: async () => [
        {
          updated_at:
            calls.length === 1
              ? "2026-09-06T10:00:00+00:00"
              : "2026-09-06T11:00:00+00:00",
          data: { customers: [customer()], otherSetting: "Keep" },
        },
      ],
    };
  };
  try {
    await loadCloudCustomers();
    assert.equal(calls.length, 1);
    assert.notEqual(calls[0].options.method, "PATCH");
    assert.equal(
      await saveCloudCustomers([recordPayment(customer(), 20)]),
      true,
    );
    assert.match(calls[1].url, /updated_at=eq\./);
    const body = JSON.parse(calls[1].options.body);
    assert.equal(body.data.otherSetting, "Keep");
    assert.equal(body.data.customers[0].balance, 60);
    global.fetch = async () => ({ ok: true, json: async () => [] });
    assert.equal(await saveCloudCustomers([customer()]), false);
  } finally {
    global.fetch = originalFetch;
  }
});
