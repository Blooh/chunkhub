package net.chunkhub.companion;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.mojang.serialization.Codec;
import com.mojang.serialization.DataResult;
import com.mojang.serialization.DynamicOps;
import com.mojang.serialization.JsonOps;

import java.lang.reflect.Field;
import java.util.List;

/**
 * The player's current state for the website's Player tab: health, hunger, XP, inventory and ender chest.
 * Items are written with the game's own item format, so shulker box contents, enchantments and names come along.
 * Works for both the server-side player and your own player in multiplayer.
 */
final class Snapshot {
	private Snapshot() {}

	/** Health, hunger, XP and the main inventory (hotbar, backpack, armour, off-hand). */
	static JsonObject player(Object player) {
		JsonObject o = new JsonObject();
		num(o, "health", Reflect.call(player, "getHealth"));
		num(o, "maxHealth", Reflect.call(player, "getMaxHealth"));
		num(o, "absorption", Reflect.call(player, "getAbsorptionAmount"));
		Object food = Reflect.call(player, "getFoodData");
		num(o, "food", Reflect.call(food, "getFoodLevel"));
		num(o, "saturation", Reflect.call(food, "getSaturationLevel"));
		num(o, "xpLevel", field(player, "experienceLevel"));
		num(o, "xpProgress", field(player, "experienceProgress"));
		num(o, "xpTotal", field(player, "totalExperience"));
		num(o, "armor", Reflect.call(player, "getArmorValue"));
		Object inv = Reflect.call(player, "getInventory");
		Object sel = Reflect.call(inv, "getSelectedSlot");
		if (sel == null) sel = field(inv, "selected");
		num(o, "selected", sel);
		o.add("inventory", container(player, inv, 41));
		o.addProperty("at", System.currentTimeMillis());
		return o;
	}

	/** The player's ender chest, read directly (only works where the ender chest is known, i.e. on the server side). */
	static JsonObject enderFromPlayer(Object player) {
		Object ender = Reflect.call(player, "getEnderChestInventory");
		if (ender == null) return null;
		JsonObject o = new JsonObject();
		o.add("items", container(player, ender, 27));
		o.addProperty("seen", System.currentTimeMillis());
		return o;
	}

	/** The ender chest as shown in an open ender chest screen (used in multiplayer, where only the screen knows it). */
	static JsonObject enderFromSlots(Object player, List<?> slots) {
		JsonArray items = new JsonArray();
		for (int i = 0; i < Math.min(27, slots.size()); i++) {
			JsonElement it = item(player, Reflect.call(slots.get(i), "getItem"));
			if (it == null) continue;
			JsonObject e = new JsonObject(); e.addProperty("slot", i); e.add("item", it); items.add(e);
		}
		JsonObject o = new JsonObject();
		o.add("items", items);
		o.addProperty("seen", System.currentTimeMillis());
		return o;
	}

	private static JsonArray container(Object player, Object c, int max) {
		JsonArray out = new JsonArray();
		Object size = Reflect.call(c, "getContainerSize");
		int n = size instanceof Number s ? Math.min(max, s.intValue()) : 0;
		for (int i = 0; i < n; i++) {
			JsonElement it = item(player, Reflect.call(c, "getItem", i));
			if (it == null) continue;
			JsonObject e = new JsonObject(); e.addProperty("slot", i); e.add("item", it); out.add(e);
		}
		return out;
	}

	/** One item in the game's own JSON format, or null for an empty slot. */
	@SuppressWarnings("unchecked")
	static JsonElement item(Object player, Object stack) {
		if (stack == null || Boolean.TRUE.equals(Reflect.call(stack, "isEmpty"))) return null;
		try {
			Codec<Object> codec = (Codec<Object>) stack.getClass().getField("CODEC").get(null);
			DynamicOps<JsonElement> ops = JsonOps.INSTANCE;
			Object ctx = Reflect.call(Reflect.call(player, "registryAccess"), "createSerializationContext", JsonOps.INSTANCE);
			if (ctx instanceof DynamicOps<?> d) ops = (DynamicOps<JsonElement>) d;
			DataResult<JsonElement> r = codec.encodeStart(ops, stack);
			JsonElement e = r.result().orElse(null);
			if (e != null) return e;
		} catch (Throwable t) {
			ChunkHub.LOG.debug("Couldn't write an item the full way", t);
		}
		// fallback: just the item and how many
		try {
			Object reg = Class.forName("net.minecraft.core.registries.BuiltInRegistries").getField("ITEM").get(null);
			Object id = Reflect.call(reg, "getKey", Reflect.call(stack, "getItem"));
			JsonObject o = new JsonObject();
			o.addProperty("id", String.valueOf(id));
			Object count = Reflect.call(stack, "getCount");
			o.addProperty("count", count instanceof Number c ? c.intValue() : 1);
			return o;
		} catch (Throwable t) {
			return null;
		}
	}

	private static void num(JsonObject o, String k, Object v) {
		if (v instanceof Number n) o.addProperty(k, n);
	}

	private static Object field(Object target, String name) {
		if (target == null) return null;
		for (Class<?> c = target.getClass(); c != null; c = c.getSuperclass()) {
			try { Field f = c.getDeclaredField(name); f.setAccessible(true); return f.get(target); }
			catch (NoSuchFieldException ignored) {}
			catch (Exception e) { return null; }
		}
		return null;
	}
}
