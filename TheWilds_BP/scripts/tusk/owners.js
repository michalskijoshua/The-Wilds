// Who may ride a Tuskbeast (0.0.7, Director 24 Nov 2026).
// The player who tames a beast owns it. The owner invites other players from the Tuskbeast menu (sneak + tap the beast
// with an empty hand) or by typing /wilds:invite <name> (also /wilds:uninvite <name> and /wilds:invites).
// An invite covers every Tuskbeast the owner has. Anyone else who climbs on is put down with a message.
// Guild friends: if Guilds+ one day tags its members "guilds_member:<guild owner id>" (see GUILDS_PATCH_PROPOSAL.md,
// part 4), members of the owner's guild may ride without an invite. Until then the tag never exists and this is idle.
import { world, system, guard } from "../core/util.js";
import { CommandPermissionLevel, CustomCommandParamType, CustomCommandStatus } from "@minecraft/server";

const OWNER = "wilds:owner", OWNER_NAME = "wilds:owner_name";
const invKey = (ownerId) => `wilds:inv:${ownerId}`;

export const ownerOf = (beast) => beast.getDynamicProperty(OWNER);
export const ownerNameOf = (beast) => beast.getDynamicProperty(OWNER_NAME) ?? "someone";
export function claim(beast, player) {
  beast.setDynamicProperty(OWNER, player.id); beast.setDynamicProperty(OWNER_NAME, player.name);
  player.sendMessage("§aThis Tuskbeast is now yours! Sneak and tap it with an empty hand for its menu.");
}
export const invites = (ownerId) => { try { return JSON.parse(world.getDynamicProperty(invKey(ownerId)) ?? "[]"); } catch { return []; } };
const saveInvites = (ownerId, list) => world.setDynamicProperty(invKey(ownerId), list.length ? JSON.stringify(list) : undefined);

/** May this player ride this beast? Unowned beasts: yes (the first rider claims it). */
export function mayRide(player, beast) {
  const o = ownerOf(beast);
  return !o || o === player.id || invites(o).some((i) => i.id === player.id) || !!player.hasTag?.(`guilds_member:${o}`);
}

export function invite(owner, target) {
  if (target.id === owner.id) return owner.sendMessage("§eYou can always ride your own Tuskbeasts.");
  const list = invites(owner.id);
  if (list.some((i) => i.id === target.id)) return owner.sendMessage(`§7${target.name} is already invited.`);
  list.push({ id: target.id, name: target.name }); saveInvites(owner.id, list);
  owner.sendMessage(`§a${target.name} may now ride your Tuskbeasts.`);
  target.sendMessage(`§a${owner.name} invited you to ride their Tuskbeasts.`);
}
export function uninvite(owner, name) {
  const list = invites(owner.id), low = name.toLowerCase();
  const gone = list.find((i) => i.name.toLowerCase() === low || i.id === name);
  if (!gone) return owner.sendMessage(`§e${name} was not on your list.`);
  saveInvites(owner.id, list.filter((i) => i !== gone));
  owner.sendMessage(`§7${gone.name} may no longer ride your Tuskbeasts.`);
}
export function toggleInvite(owner, target) {
  if (invites(owner.id).some((i) => i.id === target.id)) uninvite(owner, target.name); else invite(owner, target);
}
export function listInvites(player) {
  const l = invites(player.id);
  player.sendMessage(l.length ? `§bAllowed on your Tuskbeasts: ${l.map((i) => i.name).join(", ")}` : "§7Nobody is invited yet. Use the Tuskbeast menu, or type /wilds:invite <name>.");
}
const onlineNamed = (name) => { const low = name.toLowerCase(); return world.getAllPlayers().find((p) => p.name.toLowerCase() === low); };

// ---- typed invites: /wilds:invite <name>, /wilds:uninvite <name>, /wilds:invites (no cheats needed)
system.beforeEvents.startup.subscribe((ev) => {
  const reg = ev.customCommandRegistry; if (!reg) return;
  const run = (fn) => (origin, ...a) => {
    const p = origin.sourceEntity;
    if (p?.typeId !== "minecraft:player") return { status: CustomCommandStatus.Failure, message: "Only a player can use this." };
    system.run(guard("cmd", () => fn(p, ...a)));
    return { status: CustomCommandStatus.Success };
  };
  const nameArg = [{ name: "name", type: CustomCommandParamType.String }];
  const base = { permissionLevel: CommandPermissionLevel.Any, cheatsRequired: false };
  try {
    reg.registerCommand({ ...base, name: "wilds:invite", description: "Let a player ride your Tuskbeasts", mandatoryParameters: nameArg },
      run((p, name) => { const t = onlineNamed(name); if (t) invite(p, t); else p.sendMessage(`§eNo player called ${name} is here right now.`); }));
    reg.registerCommand({ ...base, name: "wilds:uninvite", description: "Stop a player riding your Tuskbeasts", mandatoryParameters: nameArg },
      run((p, name) => uninvite(p, name)));
    reg.registerCommand({ ...base, name: "wilds:invites", description: "Who may ride your Tuskbeasts" }, run((p) => listInvites(p)));
  } catch (err) { console.warn(`[wilds] commands: ${err}`); }
});
