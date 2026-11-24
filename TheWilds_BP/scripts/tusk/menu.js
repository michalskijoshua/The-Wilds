// The Tuskbeast menu (0.0.7, Director 24 Nov 2026; replaces the Howdah Flag): sneak and tap your Tuskbeast with an
// empty hand.
//   Owner:    Build a Howdah (costs below) | Climb aboard with my guards | Send guards down | Riders (invite / remove)
//   Invited:  Climb aboard with my guards
//   Wild:     a hint on how to tame it
// The chest and the tower only come with the howdah.
import { world, system, guard } from "../core/util.js";
import { ActionFormData } from "@minecraft/server-ui";
import { ownerOf, ownerNameOf, mayRide, invites, toggleInvite, uninvite } from "./owners.js";
import { boardCrew, dismountCrew, hasHowdah, isTame } from "./seats.js";

// Howdah cost (Director 24 Nov 2026: emeralds only; it costs the same in Creative)
export const HOWDAH_COST = [
  { name: "Emeralds", n: 20, is: (it) => it.typeId === "minecraft:emerald" },
];
const costText = () => HOWDAH_COST.map((c) => `${c.n} ${c.name}`).join(", ");

function have(player) {
  const inv = player.getComponent("minecraft:inventory")?.container, got = HOWDAH_COST.map(() => 0);
  if (!inv) return got;
  for (let i = 0; i < inv.size; i++) { const it = inv.getItem(i); if (it) HOWDAH_COST.forEach((c, k) => { if (c.is(it)) got[k] += it.amount; }); }
  return got;
}
function pay(player) {
  const inv = player.getComponent("minecraft:inventory").container;
  HOWDAH_COST.forEach((c) => {
    let left = c.n;
    for (let i = 0; i < inv.size && left > 0; i++) {
      const it = inv.getItem(i); if (!it || !c.is(it)) continue;
      const take = Math.min(left, it.amount); left -= take;
      if (take === it.amount) inv.setItem(i, undefined); else { it.amount -= take; inv.setItem(i, it); }
    }
  });
}
/** Build the howdah. Returns a message. */
export function buildHowdah(beast, player) {
  if (!isTame(beast)) return "§eTame it first.";
  if (hasHowdah(beast)) return "§7It already carries a howdah.";
  const got = have(player), short = HOWDAH_COST.filter((c, k) => got[k] < c.n).map((c) => `${c.n - got[HOWDAH_COST.indexOf(c)]} more ${c.name}`);
  if (short.length) return `§eYou need ${short.join(", ")} to build a howdah.`;
  pay(player);
  beast.triggerEvent("wilds:build_howdah");
  try { player.playSound("random.anvil_use", { volume: 0.6 }); } catch { /* */ }
  return "§aThe howdah is built! Up to 4 riders or guards fit in it. Open your inventory while driving to fill its arrow chest.";
}

async function ridersMenu(p) {
  const online = world.getAllPlayers().filter((x) => x.id !== p.id), list = invites(p.id);
  const offline = list.filter((i) => !online.some((o) => o.id === i.id));
  const f = new ActionFormData().title("Riders")
    .body("Invited players may ride all your Tuskbeasts.\nTap a name to invite or remove.\nYou can also type /wilds:invite <name>.");
  const rows = [];
  for (const o of online) { const yes = list.some((i) => i.id === o.id); f.button(`${o.name}\n${yes ? "§2Invited: tap to remove" : "§8Not invited: tap to invite"}`); rows.push(() => toggleInvite(p, o)); }
  for (const i of offline) { f.button(`${i.name} (away)\n§2Invited: tap to remove`); rows.push(() => uninvite(p, i.name)); }
  if (!rows.length) return p.sendMessage("§7Nobody else is here right now. Type /wilds:invite <name> when they are.");
  const r = await f.show(p);
  if (!r.canceled && r.selection !== undefined) rows[r.selection]();
}

async function openMenu(p, beast) {
  if (!isTame(beast)) return p.sendMessage("§eThis Tuskbeast is wild. Ride it until it stops throwing you off, or feed it hay bales to calm it first.");
  const own = ownerOf(beast) === p.id;
  if (!own && !mayRide(p, beast)) return p.sendMessage(`§eThis Tuskbeast belongs to ${ownerNameOf(beast)}. Ask them to invite you.`);
  const howdah = hasHowdah(beast), crewAboard = beast.getComponent("minecraft:rideable").getRiders().some((r) => r.typeId.startsWith("guilds:merc_"));
  const f = new ActionFormData().title("Tuskbeast").body(own ? "Your Tuskbeast." : `${ownerNameOf(beast)}'s Tuskbeast. You are invited.`);
  const acts = [];
  if (own && !howdah) { f.button(`§6Build a Howdah§r\n§8${costText()}`); acts.push(() => p.sendMessage(buildHowdah(beast, p))); }
  if (howdah) { f.button("§2Climb aboard with my guards§r\n§8Your archers and crossbowmen nearby"); acts.push(() => boardCrew(beast, p)); }
  if (howdah && crewAboard) { f.button("§9Send guards down§r\n§8Everyone off but the players"); acts.push(() => dismountCrew(beast, p)); }
  if (own) { f.button("§bRiders§r\n§8Invite or remove players"); acts.push(() => ridersMenu(p).catch(() => {})); }
  f.button("Close"); acts.push(() => {});
  const r = await f.show(p);
  if (!r.canceled && r.selection !== undefined) acts[r.selection]();
}

world.beforeEvents.playerInteractWithEntity.subscribe((e) => {
  if (e.target?.typeId !== "wilds:tuskbeast" || !e.player.isSneaking || e.itemStack) return;
  e.cancel = true;
  const p = e.player, beast = e.target;
  system.run(guard("menu", () => { openMenu(p, beast).catch((err) => console.warn(`[wilds] menu: ${err}`)); }));
});
