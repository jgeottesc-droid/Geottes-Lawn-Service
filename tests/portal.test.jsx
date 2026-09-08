import { JSDOM } from "jsdom";
import test from "node:test";
import assert from "node:assert/strict";
const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://localhost/",
});
Object.assign(globalThis, {
  window: dom.window,
  document: dom.window.document,
  HTMLElement: dom.window.HTMLElement,
  HTMLDialogElement: dom.window.HTMLDialogElement,
  localStorage: dom.window.localStorage,
  IS_REACT_ACT_ENVIRONMENT: true,
});
Object.defineProperty(globalThis, "navigator", {
  value: dom.window.navigator,
  configurable: true,
});
HTMLDialogElement.prototype.showModal = function () {
  this.open = true;
};
HTMLDialogElement.prototype.close = function () {
  this.open = false;
};
const React = await import("react");
globalThis.React = React;
const { render, screen, waitFor, cleanup, within } =
  await import("@testing-library/react");
const { default: userEvent } = await import("@testing-library/user-event");
const { default: App } = await import("../src/App.jsx");
const { ADMIN_CODE, normalizeCustomer } = await import("../src/data.js");
test.afterEach(() => cleanup());
const sample = () =>
  normalizeCustomer({
    id: 10,
    name: "Demo Customer",
    address: "123 Test Lane",
    code: "DEMO10",
    balance: 80,
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
    requests: [{ type: "Skip next cut", note: "Test request", status: "New" }],
    comments: [],
    history: [],
  });
function mockCloud({ failLoad = false, failSave = false } = {}) {
  const calls = [];
  let data = [sample()];
  global.fetch = async (url, options = {}) => {
    calls.push({ url, options });
    if (options.method === "PATCH") {
      if (failSave)
        return { ok: false, status: 503, text: async () => "Simulated outage" };
      data = JSON.parse(options.body).data.customers;
    } else if (failLoad)
      return { ok: false, status: 503, text: async () => "Simulated outage" };
    return {
      ok: true,
      json: async () => [
        { updated_at: "2026-09-06T12:00:00Z", data: { customers: data } },
      ],
    };
  };
  return {
    calls,
    get data() {
      return data;
    },
  };
}
async function login(code) {
  const user = userEvent.setup();
  await waitFor(() =>
    assert.ok(screen.getByRole("button", { name: "Open my portal" })),
  );
  await user.type(screen.getByLabelText("Portal code"), code);
  await waitFor(() =>
    assert.equal(
      screen.getByRole("button", { name: "Open my portal" }).disabled,
      false,
    ),
  );
  await user.click(screen.getByRole("button", { name: "Open my portal" }));
  return user;
}

test("calendar moves a cut to a new day and time and preserves customer records", async () => {
  const cloud = mockCloud();
  render(<App />);
  const user = await login(ADMIN_CODE);
  await user.click(
    screen.getByRole("button", { name: "Schedule", exact: true }),
  );
  const calendar = screen.getByRole("region", { name: "Cut calendar" });
  await user.click(
    within(calendar).getByRole("button", {
      name: "Move Demo Customer, September 10, 2026, 8:00–10:00 AM",
    }),
  );
  await user.click(
    within(calendar).getByRole("button", {
      name: "Move selected cut to September 11, 2026",
    }),
  );
  await waitFor(() =>
    assert.equal(cloud.data[0].visits[0].date, "September 11, 2026"),
  );
  await user.click(
    within(calendar).getByRole("button", {
      name: "Move Demo Customer, September 11, 2026, 8:00–10:00 AM",
    }),
  );
  await user.selectOptions(
    within(calendar).getByLabelText("Move to arrival window"),
    "1:00–3:00 PM",
  );
  await waitFor(() =>
    assert.equal(cloud.data[0].visits[0].time, "1:00–3:00 PM"),
  );
  assert.equal(cloud.data[0].visits[0].time, "1:00–3:00 PM");
  assert.equal(cloud.data[0].code, "DEMO10");
  assert.equal(cloud.data[0].balance, 80);
  assert.equal(cloud.data[0].history.length, 0);
  await user.click(
    within(calendar).getByRole("button", { name: "Month", exact: true }),
  );
  await user.click(
    within(calendar).getByRole("button", {
      name: "Edit cut for Demo Customer",
    }),
  );
  assert.ok(screen.getByRole("dialog", { name: "Edit cut" }));
});

test("calendar schedules a customer in two clicks on the chosen day", async () => {
  const cloud = mockCloud();
  render(<App />);
  const user = await login(ADMIN_CODE);
  await user.click(
    screen.getByRole("button", { name: "Schedule", exact: true }),
  );
  const calendar = screen.getByRole("region", { name: "Cut calendar" });
  await user.click(
    within(calendar).getByRole("button", {
      name: "Schedule on September 18, 2026",
    }),
  );
  await user.click(
    within(calendar).getByRole("button", {
      name: "Schedule Demo Customer on September 18, 2026",
    }),
  );
  await waitFor(() => assert.equal(cloud.data[0].visits.length, 2));
  assert.equal(cloud.data[0].visits[1].date, "September 18, 2026");
  assert.equal(cloud.data[0].code, "DEMO10");
});

test("owner can schedule the next cut from the main dashboard", async () => {
  const cloud = mockCloud();
  render(<App />);
  const user = await login(ADMIN_CODE);
  await user.click(
    screen.getAllByRole("button", { name: "Schedule a cut" })[0],
  );
  const dialog = screen.getByRole("dialog", { name: "Quick schedule" });
  await user.click(
    within(dialog).getByRole("button", {
      name: "Schedule Demo Customer for September 17, 2026",
    }),
  );
  await waitFor(() => assert.equal(cloud.data[0].visits.length, 2));
  assert.equal(cloud.data[0].visits[1].date, "September 17, 2026");
  assert.equal(cloud.data[0].code, "DEMO10");
});

test("owner history includes legacy records and every completed visit", async () => {
  const cloud = mockCloud();
  cloud.data[0].history = [
    {
      date: "August 20, 2026",
      service: "Weekly Mow",
      status: "Completed",
    },
  ];
  cloud.data[0].visits.push({
    id: 2,
    date: "August 27, 2026",
    time: "8:00–10:00 AM",
    service: "Weekly Mow",
    status: "Completed",
    weather: "Clear",
  });
  render(<App />);
  const user = await login(ADMIN_CODE);
  await user.click(screen.getByRole("button", { name: "History" }));
  assert.ok(screen.getByText("All completed lawns"));
  assert.ok(
    screen.getByLabelText(
      "Demo Customer, August 20, 2026, Weekly Mow, completed",
    ),
  );
  assert.ok(
    screen.getByLabelText(
      "Demo Customer, August 27, 2026, Weekly Mow, completed",
    ),
  );
  assert.match(screen.getByText(/2 of 2 cuts shown/).textContent, /2 of 2/);
});

test("owner customer details, quick scheduling, and request handling work", async () => {
  const cloud = mockCloud();
  render(<App />);
  const user = userEvent.setup();
  await waitFor(() => assert.ok(screen.getByText("Open my portal")));
  await user.type(screen.getByLabelText("Portal code"), ADMIN_CODE);
  await user.click(screen.getByRole("button", { name: "Open my portal" }));
  await user.click(screen.getByRole("button", { name: "Customers" }));
  await user.click(
    screen.getByRole("button", { name: /Demo Customer, 123 Test Lane/ }),
  );
  await user.click(screen.getByRole("button", { name: "Next cut +7 days" }));
  await waitFor(() => assert.equal(cloud.data[0].visits.length, 2));
  assert.equal(cloud.data[0].visits[1].date, "September 17, 2026");
  await user.click(screen.getByRole("button", { name: "Edit details" }));
  await user.clear(screen.getByLabelText("Customer name"));
  await user.type(screen.getByLabelText("Customer name"), "Updated Demo");
  await user.click(screen.getByRole("button", { name: "Save details" }));
  await waitFor(() => assert.equal(cloud.data[0].name, "Updated Demo"));
  assert.equal(cloud.data[0].code, "DEMO10");
  await user.click(
    within(
      screen.getByRole("navigation", { name: "Customer details" }),
    ).getByRole("button", { name: "Messages" }),
  );
  await user.click(screen.getByRole("button", { name: "Mark handled" }));
  await waitFor(() =>
    assert.equal(cloud.data[0].requests[0].status, "Handled"),
  );
  assert.equal(cloud.data[0].requests[0].note, "Test request");
  cleanup();
});

test("failed saves are visible and block further writes", async () => {
  const cloud = mockCloud({ failSave: true });
  render(<App />);
  const user = userEvent.setup();
  await waitFor(() => assert.ok(screen.getByText("Open my portal")));
  await user.type(screen.getByLabelText("Portal code"), ADMIN_CODE);
  await user.click(screen.getByRole("button", { name: "Open my portal" }));
  await user.click(screen.getAllByRole("button", { name: "Complete cut" })[0]);
  await waitFor(() => assert.ok(screen.getByText("Save failed")));
  assert.equal(
    screen.getByRole("button", { name: "Add customer" }).disabled,
    true,
  );
  assert.equal(
    cloud.calls.filter((call) => call.options.method === "PATCH").length,
    1,
  );
  assert.equal(cloud.data[0].visits[0].status, "Scheduled");
  cleanup();
});
// Keep all writes inside this simulated server, never production.
test("owner login and full payment workflow are functional", async () => {
  const cloud = mockCloud();
  render(<App />);
  const user = userEvent.setup();
  await waitFor(() => assert.ok(screen.getByText("Open my portal")));
  assert.equal(
    cloud.calls.filter((c) => c.options.method === "PATCH").length,
    0,
  );
  await user.type(screen.getByLabelText("Portal code"), ADMIN_CODE);
  await user.click(screen.getByRole("button", { name: "Open my portal" }));
  assert.ok(screen.getByRole("heading", { name: "Let’s get growing." }));
  await user.click(
    screen.getAllByRole("button", { name: "Record payment" })[0],
  );
  await user.clear(screen.getByLabelText("Amount received ($)"));
  await user.type(screen.getByLabelText("Amount received ($)"), "30");
  await user.click(
    within(screen.getByRole("dialog")).getByRole("button", {
      name: "Record payment",
    }),
  );
  await waitFor(() => assert.equal(cloud.data[0].balance, 50));
  assert.equal(cloud.data[0].code, "DEMO10");
  await user.click(screen.getAllByRole("button", { name: "Complete cut" })[0]);
  await waitFor(() => assert.equal(cloud.data[0].history.length, 1));
  assert.equal(cloud.data[0].balance, 50);
  cleanup();
});
test("customer code, Venmo link, comment, and request remain functional", async () => {
  const cloud = mockCloud();
  render(<App />);
  const user = userEvent.setup();
  await waitFor(() => assert.ok(screen.getByText("Open my portal")));
  await user.type(screen.getByLabelText("Portal code"), "demo10");
  await user.click(screen.getByRole("button", { name: "Open my portal" }));
  assert.ok(screen.getByRole("heading", { name: "Hi, Demo." }));
  const url = new URL(
    screen.getByRole("link", { name: "Pay with Venmo" }).href,
  );
  assert.equal(url.pathname, "/Jesse-Geottes");
  assert.equal(url.searchParams.get("amount"), "80");
  await user.click(screen.getByRole("button", { name: "Message Jesse" }));
  await user.type(
    screen.getByLabelText("Your comment"),
    "Please leave the gate closed.",
  );
  await user.click(screen.getByRole("button", { name: "Send comment" }));
  await waitFor(() =>
    assert.deepEqual(cloud.data[0].comments, ["Please leave the gate closed."]),
  );
  await user.click(screen.getByRole("button", { name: "Request a change" }));
  await user.click(screen.getByRole("button", { name: "Send request" }));
  await waitFor(() => assert.equal(cloud.data[0].requests.length, 2));
  assert.equal(cloud.data[0].balance, 80);
  cleanup();
});
test("failed loading never writes local or empty records to the cloud", async () => {
  localStorage.setItem(
    "geottes-lawn-service-clean",
    '[{"id":99,"name":"Stale"}]',
  );
  const cloud = mockCloud({ failLoad: true });
  render(<App />);
  await waitFor(() => assert.ok(screen.getByRole("alert")));
  assert.equal(
    screen.getByRole("button", { name: "Connecting…" }).disabled,
    true,
  );
  assert.equal(
    cloud.calls.filter((c) => c.options.method === "PATCH").length,
    0,
  );
  cleanup();
});
