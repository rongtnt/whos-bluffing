// Registers HowSure's global /howsure command. Run once, and again after changing COMMANDS in src/commands.js:
//   DISCORD_APP_ID=... DISCORD_BOT_TOKEN=... node scripts/register-commands.mjs
// PUT replaces the app's whole command list, so running it twice is harmless.
import { COMMANDS } from '../src/commands.js';

const { DISCORD_APP_ID: appId, DISCORD_BOT_TOKEN: token } = process.env;
if (!appId || !token) {
  console.error('Set DISCORD_APP_ID and DISCORD_BOT_TOKEN first (Developer Portal: General Information and Bot).');
  process.exit(1);
}

const res = await fetch(`https://discord.com/api/v10/applications/${appId}/commands`, {
  method: 'PUT',
  headers: { authorization: `Bot ${token}`, 'content-type': 'application/json', 'user-agent': 'DiscordBot (https://howsure.me, 0.1)' },
  body: JSON.stringify(COMMANDS),
});
if (!res.ok) {
  console.error(`Discord answered ${res.status}: ${await res.text()}`);
  process.exit(1);
}
console.log(`Registered: ${(await res.json()).map((c) => `/${c.name}`).join(', ')}`);
