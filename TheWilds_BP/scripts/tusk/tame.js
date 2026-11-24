// Taming a wild Tuskbeast (0.0.7, Director 24 Nov 2026): borrowed from the horse. Ride it until it stops throwing you
// off, or feed it (hay bales work best). Vanilla's minecraft:tamemount does the bucking and the temper; when it gives in,
// it fires wilds:on_tame, and the rider at that moment becomes the owner.
import { world, guard } from "../core/util.js";
import { claim } from "./owners.js";
import { wildTaken } from "./wild.js";

world.afterEvents.dataDrivenEntityTrigger.subscribe(guard("tame", (e) => {
  const b = e.entity; if (!b?.isValid) return;
  const rider = b.getComponent("minecraft:rideable")?.getRiders().find((r) => r.typeId === "minecraft:player");
  if (rider) claim(b, rider);
  wildTaken(b);
}), { entityTypes: ["wilds:tuskbeast"], eventTypes: ["wilds:on_tame"] });
