const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");
const ts = require("typescript");

const source = fs.readFileSync(path.join(__dirname, "../src/lib/api.ts"), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;

function openWindow(token, storage = new Map()) {
  if (token) {
    storage.set("cipd_token", token);
    storage.set("cipd_user", JSON.stringify({ role: token }));
  }
  const requests = [];
  const location = {
    href: "/",
    replace(value) { this.href = value; },
  };
  const context = vm.createContext({
    exports: {}, Headers, FormData,
    window: { location },
    sessionStorage: {
      getItem: (key) => storage.get(key) ?? null,
      removeItem: (key) => storage.delete(key),
    },
    fetch: async (url, options) => {
      requests.push({ url, options });
      return { status: context.responseStatus };
    },
    responseStatus: 200,
  });
  vm.runInContext(compiled, context);
  return { context, storage, requests, fetch: context.exports.authFetch };
}

test("admin and ambassador requests use their own window's token", async () => {
  const admin = openWindow("admin-test-token");
  const ambassador = openWindow("ambassador-test-token");
  await admin.fetch("/admin");
  await ambassador.fetch("/ambassador");
  assert.equal(admin.requests[0].options.headers.get("Authorization"), "Bearer admin-test-token");
  assert.equal(ambassador.requests[0].options.headers.get("Authorization"), "Bearer ambassador-test-token");
});

test("a refreshed page can reuse its window's session; a fresh window cannot", async () => {
  const admin = openWindow("admin-test-token");
  const refreshed = openWindow(null, admin.storage);
  await refreshed.fetch("/admin");
  assert.equal(refreshed.requests[0].options.headers.get("Authorization"), "Bearer admin-test-token");
  const fresh = openWindow();
  await assert.rejects(fresh.fetch("/admin"), /No authentication token/);
  assert.equal(fresh.context.window.location.href, "/login");
});

test("an expired session clears only its own window", async () => {
  const admin = openWindow("admin-test-token");
  const ambassador = openWindow("ambassador-test-token");
  ambassador.context.responseStatus = 401;
  await ambassador.fetch("/ambassador");
  assert.equal(ambassador.storage.size, 0);
  assert.equal(ambassador.context.window.location.href, "/login");
  await admin.fetch("/admin");
  assert.equal(admin.storage.get("cipd_token"), "admin-test-token");
  assert.equal(admin.context.window.location.href, "/");
});

test("a forbidden request does not discard the authenticated session", async () => {
  const ambassador = openWindow("ambassador-test-token");
  ambassador.context.responseStatus = 403;
  await ambassador.fetch("/admin");
  assert.equal(ambassador.storage.get("cipd_token"), "ambassador-test-token");
  assert.equal(ambassador.context.window.location.href, "/");
});
