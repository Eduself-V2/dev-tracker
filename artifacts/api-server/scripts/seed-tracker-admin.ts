import bcrypt from "bcryptjs";
import { trackerPool } from "../src/lib/trackerDb";

async function main() {
  const username = process.env.TRACKER_ADMIN_USERNAME ?? "admin";
  const password = process.env.TRACKER_ADMIN_PASSWORD ?? "admin123";
  const email = process.env.TRACKER_ADMIN_EMAIL ?? "admin@dev-tracker.local";
  const name = process.env.TRACKER_ADMIN_NAME ?? "Default Admin";

  const [rows] = await trackerPool.query(
    "SELECT id FROM users WHERE username = ?",
    [username],
  );
  if ((rows as Array<{ id: number }>).length > 0) {
    console.log(`Admin user "${username}" already exists — skipping seed.`);
    await trackerPool.end();
    return;
  }
  const hash = await bcrypt.hash(password, 10);
  await trackerPool.query(
    "INSERT INTO users (name, email, mobile, username, password_hash, role, password_reset_required) VALUES (?, ?, NULL, ?, ?, 'admin', 1)",
    [name, email, username, hash],
  );
  console.log(`Seeded admin user: username=${username} password=${password}`);
  await trackerPool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
