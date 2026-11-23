# Proposal: a small Guilds+ change for mounted guards (NOT applied)

Status: proposal for the owner. The Wilds does not edit Guilds+. This would go into a Guilds+ release (0.9.7) if you
approve it. It is generic: it mentions no Wilds identifier, so Guilds+ still works fine alone.

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

## Test after the change

- Seat two archers with the Howdah Flag and wait 30 s. No walk markers appear around the beast, and none of the archers
  has a "(!)" supply flag stuck on.
- Dismount them. Within 4 s they walk back to their post or the hall, as before.
