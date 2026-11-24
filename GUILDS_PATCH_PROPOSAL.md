# Proposal: a small Guilds+ change for mounted guards (APPLIED in Guilds+ 0.9.7)

Status: **applied by the Guilds+ chat in 0.9.7 (parts 1–3) and server-tested with The Wilds 0.0.4.** One optional
extra is at the end. The Wilds does not edit Guilds+. It is generic: it mentions no Wilds identifier, so Guilds+ still works fine alone.

## Why

A Guilds+ guard riding anything (a Tuskbeast, a boat, a minecart) can't walk. The Guilds+ patrol loop doesn't know
that, so every 2 s it:

- places an invisible walk marker near the guard and fires `guilds:goto`, and
- may start a supply trip to an Armoury that he can never walk to. He then waits on it until dismounted.

The Wilds works around the first problem from its side: it fires Guilds+'s own `guilds:stop` event on mounted crew
every 2 s. The marker placement and the stuck supply trip can only be fixed inside Guilds+.

## The change (`BP/scripts/ironhome/mercenaries.js`, the patrol interval near the end of the file)

```js
system.runInterval(guard("patrol", () => {
  const r = roster();
  for (const e of allMercs()) {
    if (!e.isValid) continue;
    const rec = r[e.id];
    if (!rec) { turnPillager(e); continue; }
    if (e.getComponent("minecraft:riding")?.entityRidingOn) continue;   // NEW: mounted guards hold still, no patrol or supply trips
    try { supplyThink(e, e.id, rec, r); patrolOne(e, e.id, r[e.id] ?? rec); } catch (err) { console.warn(`[ironhome] merc patrol: ${err}`); }
  }
  ...
```

That one line is the whole fix. Kit wear, ammo counting, death handling and the roster are unchanged, so a guard
keeps his post, mode and supplies through mounting and dismounting.

## Optional second line: the Commander's Horn

So that "Return to posts" also brings mounted guards down, add this inside the loop in `hornMenu`, when selection 2 is chosen:

```js
if (res.selection === 2) { try { const v = e?.getComponent("minecraft:riding")?.entityRidingOn; v?.getComponent("minecraft:rideable")?.ejectRider(e); } catch { /* */ } }
```

## Part 3: mounted guards don't pay for The Wilds' arrows (found 23 Nov, Linux server)

When The Wilds fires for a seated guard (Path B), it takes the arrow from the Howdah chest. Guilds+ also takes one from
that guard's own arrow count and wears his bow, because the arrow's shooter is the guard. After 22 shots each guard had
lost 11 arrows and 11 bow uses in Guilds+; at 0 he shows "(!) no arrows" and is disarmed with a full chest.

The fix, in the same file, the `shot` line near the projectile-hit hooks:

```js
const shot = (ev) => { const a = ev.source; if (a?.typeId === `guilds:merc_archer` || a?.typeId === `guilds:merc_crossbowman`) {
  if (a.getComponent("minecraft:riding")?.entityRidingOn) return;   // NEW: riding guards shoot from their mount's supplies
  wear(a.id, "ammo"); wear(a.id, "wpn"); } };
```

Like part 1 it is generic (any mount, no Wilds name), and it changes nothing for guards on foot.

## Test after the change

- Seat two archers with the Howdah Flag and wait 30 s. No walk markers appear around the beast, and none of the archers
  has a "(!)" supply flag stuck on.
- Dismount them. Within 4 s they walk back to their post or the hall, as before.
- Part 3: seat two archers, let Path B fire at zombies for 20 s. Their arrow count in the guard menu stays the same.

## Optional extra (found in the 0.9.7 retest)

A walk marker placed in the seconds before a guard boards stays until he gets off. Harmless, but it could be tidied in
the patrol loop: before `continue` for a mounted guard, drop his marker (`const st = S.get(e.id); if (st?.m) { dropMarker(st.m); S.delete(e.id); }`).

## Part 4 (proposed 24 Nov 2026, not applied): guild friends ride without invites

**Why:** the Director wants guild friends to hop on and off each other's Tuskbeasts without invites, and enemies kept
off (for example two guilds at war).

**What Guilds+ has today:** one player per guild (the owner), no member list and no wars. Each pack keeps its own saved
records, so The Wilds can't read Guilds+'s records even when a list exists.

**The ask (a Guilds+ design job first):**
1. Guild members: a way for a guild owner to add and remove members (Guilds+ decides the menus and rules).
2. **Share membership as a player tag**, the one thing both packs can see: every member, the owner included, carries
   `guilds_member:<guild owner's player id>`, kept up to date when they join, leave or are removed.
3. Wars, if Guilds+ adds them, need nothing extra here: an enemy never carries the owner's tag.

**The Wilds side is already built (0.0.7) and idle until the tag exists:** a player carrying `guilds_member:<owner id>`
may ride that owner's Tuskbeasts with no invite. Everyone else still needs an invite, so a war enemy can't take a seat.
