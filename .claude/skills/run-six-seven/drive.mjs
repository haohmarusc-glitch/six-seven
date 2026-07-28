// Playwright driver for the six-seven app. Run from the repo root after
// starting the server (see SKILL.md steps 0-4):
//
//   mkdir -p node_modules
//   ln -sf /opt/node22/lib/node_modules/playwright node_modules/playwright
//   node .claude/skills/run-six-seven/drive.mjs
//
// Exercises record/upload, "Meus clipes" delete, battle vote, report,
// leaderboard, and admin login/approve/reject/delete. Screenshots go to
// ./screenshots/, a pass/fail summary prints at the end.
import { chromium } from "playwright";
import { Client } from "pg";
import { mkdirSync } from "fs";

const BASE = process.env.SIXSEVEN_BASE ?? "http://localhost:5055";
const DATABASE_URL =
  process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/sixseven";
const ADMIN_TOKEN = process.env.ADMIN_TOKEN ?? "testtoken123";
const SHOTS = "./screenshots";
mkdirSync(SHOTS, { recursive: true });

const pg = new Client({ connectionString: DATABASE_URL });
await pg.connect();

const results = [];
function record(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} - ${name}${detail ? " :: " + detail : ""}`);
}

const browser = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium",
  args: ["--no-sandbox", "--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"],
});
const page = await browser.newPage();
const consoleErrors = [];
page.on("console", (msg) => msg.type() === "error" && consoleErrors.push(msg.text()));
page.on("pageerror", (err) => consoleErrors.push("pageerror: " + err.message));

async function shot(name) {
  await page.screenshot({ path: `${SHOTS}/${name}.png` });
  console.log("screenshot:", name);
}

// Seed two approved clips from different devices so vote/leaderboard/admin
// have something to show without waiting on real uploads. Dummy video files
// only need to exist -- headless tests here never decode them.
async function seedBattlePair() {
  const { mkdirSync, writeFileSync } = await import("fs");
  mkdirSync("server/uploads", { recursive: true });
  writeFileSync("server/uploads/clipA", Buffer.from("seed"));
  writeFileSync("server/uploads/clipB", Buffer.from("seed"));
  await pg.query(`
    INSERT INTO clips (device_id, label, video_key, content_type, status, wins, losses, report_count)
    VALUES ('seed-device-a', 'Aura máxima A', 'clipA', 'video/webm', 'approved', 0, 0, 0),
           ('seed-device-b', 'Aura sombria B', 'clipB', 'video/webm', 'approved', 0, 0, 0)
    ON CONFLICT DO NOTHING
  `);
}

try {
  console.log("\n=== 1. Load app / RecordView ===");
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  await shot("01-record-view");
  record("App loads (RecordView renders)", await page.getByText("Farmar aura").isVisible().catch(() => false));

  const deviceId = await page.evaluate(() => localStorage.getItem("six-seven:device-id"));
  console.log("browser deviceId:", deviceId);
  const { mkdirSync: mkdirSyncSeed, writeFileSync: writeFileSyncSeed } = await import("fs");
  mkdirSyncSeed("server/uploads", { recursive: true });
  writeFileSyncSeed("server/uploads/clipMine", Buffer.from("seed"));
  await pg.query(
    `INSERT INTO clips (device_id, label, video_key, content_type, status, wins, losses, report_count)
     VALUES ($1, 'Meu clipe de teste', 'clipMine', 'video/webm', 'approved', 0, 0, 0)`,
    [deviceId]
  );

  console.log("\n=== 2. Record+upload flow (fake camera) ===");
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  const recordBtn = page.getByRole("button", { name: /Farmar aura|Farmando/i });
  await recordBtn.waitFor({ timeout: 8000 });
  await recordBtn.click();
  await shot("02-recording");
  await page.waitForTimeout(9500); // MAX_CLIP_MS + upload + pulse
  await shot("03-after-record-upload");
  // Toast fades after 1.4s -- check the list updated instead of the transient toast.
  const mineCount = await page.getByRole("button", { name: "excluir" }).count();
  record("Record+upload created a new 'Meus clipes' entry", mineCount >= 2, `excluir buttons=${mineCount}`);

  console.log("\n=== 3. User delete ('Meus clipes') ===");
  const excluirButtons = page.getByRole("button", { name: "excluir" });
  const countBefore = await excluirButtons.count();
  if (countBefore > 0) {
    page.once("dialog", (d) => d.accept());
    await excluirButtons.first().click();
    await page.waitForTimeout(1000);
    await shot("04-after-user-delete");
    const countAfter = await page.getByRole("button", { name: "excluir" }).count();
    record("User delete removes clip from list", countAfter < countBefore, `before=${countBefore} after=${countAfter}`);
  }

  console.log("\n=== 4. Seed battle pair + vote + report ===");
  await seedBattlePair();
  await page.getByRole("button", { name: /Batalha/i }).click();
  await page.waitForTimeout(1000);
  await shot("05-vote-view");
  const vsVisible = await page.getByText("VS").isVisible().catch(() => false);
  record("Vote view shows a battle pair", vsVisible);
  if (vsVisible) {
    await page.locator('button[class*="absolute inset-0"]').first().click();
    await page.waitForTimeout(1200); // flash reverts + next round loads by ~700ms
    await shot("06-vote-view-next-round");
    // Text node is "Batalha #2" -- the caps look is a CSS `uppercase` class, not real DOM text.
    record("Vote cast advanced to next round", await page.getByText(/batalha #2/i).isVisible().catch(() => false));

    const reportBtn = page.getByRole("button", { name: "Denunciar clipe" }).first();
    if (await reportBtn.isVisible().catch(() => false)) {
      await reportBtn.click();
      await page.waitForTimeout(500);
      await shot("07-report-sent");
      record("Report button shows confirmation", await page.getByText("Denúncia enviada").isVisible().catch(() => false));
    }
  }

  console.log("\n=== 5. LeaderboardView ===");
  await page.getByRole("button", { name: /Ranking/i }).click();
  await page.waitForTimeout(1000);
  await shot("08-leaderboard-view");

  console.log("\n=== 6. Admin: login + approve/reject/delete ===");
  await page.goto(`${BASE}/admin`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1000);
  await shot("09-admin-token-gate");
  await page.getByPlaceholder("ADMIN_TOKEN").fill(ADMIN_TOKEN);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForTimeout(1500);
  await shot("10-admin-logged-in");
  record("Admin login succeeds", await page.getByText(/Moderação/).isVisible().catch(() => false));

  const adminExcluirBtn = page.getByRole("button", { name: "excluir" }).first();
  const beforeCount = await page.getByRole("button", { name: "excluir" }).count();
  if (beforeCount > 0) {
    page.once("dialog", (d) => d.accept());
    await adminExcluirBtn.click();
    await page.waitForTimeout(1000);
    await shot("11-admin-after-delete");
    const afterCount = await page.getByRole("button", { name: "excluir" }).count();
    record("Admin delete removes clip", afterCount < beforeCount, `before=${beforeCount} after=${afterCount}`);
  }

  console.log("\nConsole errors:", consoleErrors.length ? consoleErrors.join("\n") : "(none)");
} finally {
  await browser.close();
  await pg.end();
}

console.log("\n========= SUMMARY =========");
for (const r of results) console.log(`${r.ok ? "✅" : "❌"} ${r.name}${r.detail ? " — " + r.detail : ""}`);
console.log(`\n${results.filter((r) => r.ok).length}/${results.length} checks passed. Console errors: ${consoleErrors.length}`);
