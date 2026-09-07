const ADMIN_CODE = "GEOTTESADMIN";
const VENMO = "@Jesse-Geottes";
const STORAGE_KEY = "geottes-lawn-service-clean";

const SUPABASE_URL = "https://kwvgpkefpttvgsdegfee.supabase.co";
const SUPABASE_KEY = "sb_publishable__nV9FlNQQOwbvKQbj7a10w_eUqqXVXe";
const SUPABASE_TABLE = "customers";
const CLOUD_ROW_ID = 1;

const YEARS = [2026, 2027, 2028, 2029];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const MONTH_INDEX = Object.fromEntries(
  MONTHS.map((month, index) => [month, index]),
);
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const TIMES = [
  "8:00–10:00 AM",
  "9:00–11:00 AM",
  "10:00 AM–12:00 PM",
  "11:00 AM–1:00 PM",
  "12:00–2:00 PM",
  "1:00–3:00 PM",
  "2:00–4:00 PM",
  "3:00–5:00 PM",
  "4:00–6:00 PM",
  "5:00–7:00 PM",
];
const STATUSES = [
  "Scheduled",
  "Starting Soon",
  "In Progress",
  "Completed",
  "Needs Review",
  "Weather Delay",
];
const WEATHER = ["Clear", "Watch Weather", "Rain Delay", "Move to Tomorrow"];
const REQUESTS = [
  "Request reschedule",
  "Skip next cut",
  "Add extra trimming",
  "Request mulch quote",
  "Report an issue",
];

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function firstName(name) {
  return (name || "Customer").trim().split(" ")[0] || "Customer";
}

function normalizeCustomer(customer = {}) {
  const balance = Number(customer.balance) || 0;

  return {
    ...customer,
    id: Number(customer.id) || Date.now(),
    name: customer.name || "Customer",
    address: customer.address || "",
    code: String(customer.code || "").toUpperCase(),
    service: customer.service || "Weekly Mow",
    balance,
    paid: customer.paid ?? balance <= 0,
    paymentStatus: customer.paymentStatus || (balance > 0 ? "Unpaid" : "Paid"),
    paidDate: customer.paidDate || "",
    paymentNote: customer.paymentNote || "",
    notes: customer.notes || "",
    weatherNotice: customer.weatherNotice || "",
    visits: arr(customer.visits),
    comments: arr(customer.comments),
    requests: arr(customer.requests),
    history: arr(customer.history),
  };
}

function makeVisit(
  id,
  date,
  time,
  service,
  status = "Scheduled",
  weather = "Clear",
) {
  return { id, date, time, service, status, weather };
}

function getVisits(customer) {
  return arr(customer?.visits);
}

function getNextVisit(customer) {
  return (
    getVisits(customer)
      .filter((visit) => visit.status !== "Completed")
      .sort((a, b) => dateObject(a.date) - dateObject(b.date))[0] || null
  );
}

function dateParts(label) {
  const [monthRaw, dayRaw, yearRaw] = String(label || "March 1, 2026")
    .replace(",", "")
    .split(" ");

  return {
    month: MONTH_INDEX[monthRaw] !== undefined ? monthRaw : "March",
    day: Number(dayRaw) || 1,
    year: Number(yearRaw) || new Date().getFullYear(),
  };
}

function dateObject(label) {
  const parts = dateParts(label);
  return new Date(parts.year, MONTH_INDEX[parts.month], parts.day);
}

function formatDate(date) {
  return `${MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

function addWeeks(label, weeks) {
  const date = dateObject(label);
  date.setDate(date.getDate() + weeks * 7);
  return formatDate(date);
}

function visitText(visit) {
  if (!visit) return "No visit scheduled";
  const date = dateObject(visit.date);
  return `${DAYS[date.getDay()]}, ${formatDate(date)} • ${visit.time}`;
}

function todayText() {
  return new Date().toLocaleDateString();
}

function paymentState(customer) {
  const due = Number(customer.balance) || 0;
  const status = customer.paymentStatus || (due > 0 ? "Unpaid" : "Paid");

  if (status === "Paid" || due <= 0) return "paid";
  if (status === "Pending") return "pending";
  return "unpaid";
}

function venmoLink(customer) {
  const amount = Number(customer.balance) || 0;
  const note = encodeURIComponent(
    `Lawn service - ${customer.address || customer.name || "customer"}`,
  );
  return `https://venmo.com/Jesse-Geottes?txn=pay&amount=${amount}&note=${note}`;
}

function loadCustomers() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(saved) ? saved.map(normalizeCustomer) : [];
  } catch {
    return [];
  }
}

function saveCustomers(customers) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(customers));
}

let cloudVersion;
let cloudData = {};

async function loadCloudCustomers() {
  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/${SUPABASE_TABLE}?id=eq.${CLOUD_ROW_ID}&select=data,updated_at`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          "Accept-Profile": "public",
        },
      },
    );

    if (!response.ok) {
      const text = await response.text();
      console.error("Supabase load failed:", response.status, text);
      return null;
    }

    const rows = await response.json();
    cloudVersion = rows?.[0]?.updated_at;
    cloudData = rows?.[0]?.data || {};
    const customers = cloudData.customers;

    return Array.isArray(customers) ? customers.map(normalizeCustomer) : null;
  } catch (error) {
    console.error("Supabase load crashed:", error);
    return null;
  }
}

async function saveCloudCustomers(customers) {
  if (cloudVersion === undefined) return false;
  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/${SUPABASE_TABLE}?id=eq.${CLOUD_ROW_ID}&updated_at=${cloudVersion === null ? "is.null" : `eq.${encodeURIComponent(cloudVersion)}`}`,
      {
        method: "PATCH",
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          "Content-Type": "application/json",
          "Accept-Profile": "public",
          "Content-Profile": "public",
          Prefer: "return=representation",
        },
        body: JSON.stringify({
          code: "APP_STATE",
          data: { ...cloudData, customers },
          updated_at: new Date().toISOString(),
        }),
      },
    );

    if (!response.ok) {
      const text = await response.text();
      console.error("Supabase save failed:", response.status, text);
      return false;
    }

    const rows = await response.json();
    if (!rows.length) return false;
    cloudVersion = rows[0].updated_at;
    cloudData = rows[0].data;
    return true;
  } catch (error) {
    console.error("Supabase save crashed:", error);
    return false;
  }
}

export function money(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number(value) || 0);
}
export function isoDate(label) {
  const date = dateObject(label);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function fromISO(value) {
  const [year, month, day] = value.split("-").map(Number);
  return formatDate(new Date(year, month - 1, day));
}
export function recordPayment(customer, amount, note = "") {
  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0 || value > Number(customer.balance))
    throw new Error(
      "Enter a payment greater than zero and no more than the balance.",
    );
  const balance = Math.round((Number(customer.balance) - value) * 100) / 100;
  return normalizeCustomer({
    ...customer,
    balance,
    paid: balance === 0,
    paymentStatus: balance === 0 ? "Paid" : "Unpaid",
    paidDate: balance === 0 ? todayText() : customer.paidDate,
    paymentNote: [
      customer.paymentNote,
      `${todayText()}: Received ${money(value)}${note ? " — " + note : ""}`,
    ]
      .filter(Boolean)
      .join("\n"),
  });
}
export function changeVisit(customer, id, changes) {
  const old = getVisits(customer).find((visit) => visit.id === id);
  if (!old) return customer;
  const completed =
    changes.status === "Completed" && old.status !== "Completed";
  return normalizeCustomer({
    ...customer,
    visits: getVisits(customer).map((visit) =>
      visit.id === id ? { ...visit, ...changes } : visit,
    ),
    history: completed
      ? [
          ...arr(customer.history),
          {
            date: old.date,
            service: old.service,
            status: "Completed",
            amount: customer.balance,
            paid: customer.paid,
          },
        ]
      : customer.history,
  });
}
export function appendVisits(customer, draft, count = 1) {
  const firstId =
    Math.max(0, ...getVisits(customer).map((visit) => Number(visit.id) || 0)) +
    1;
  const added = Array.from({ length: count }, (_, index) =>
    makeVisit(
      firstId + index,
      addWeeks(draft.date, index),
      draft.time,
      draft.service,
      draft.status || "Scheduled",
      draft.weather || "Clear",
    ),
  );
  const duplicate = added.some((next) =>
    getVisits(customer).some(
      (visit) =>
        visit.date === next.date &&
        visit.time === next.time &&
        visit.service === next.service,
    ),
  );
  if (duplicate)
    throw new Error(
      "A matching cut is already scheduled. Choose another date or time.",
    );
  return normalizeCustomer({
    ...customer,
    visits: [...getVisits(customer), ...added],
  });
}
export {
  ADMIN_CODE,
  VENMO,
  STORAGE_KEY,
  YEARS,
  MONTHS,
  MONTH_INDEX,
  DAYS,
  TIMES,
  STATUSES,
  WEATHER,
  REQUESTS,
  arr,
  firstName,
  normalizeCustomer,
  makeVisit,
  getVisits,
  getNextVisit,
  dateParts,
  dateObject,
  formatDate,
  addWeeks,
  visitText,
  todayText,
  paymentState,
  venmoLink,
  loadCustomers,
  saveCustomers,
  loadCloudCustomers,
  saveCloudCustomers,
};
