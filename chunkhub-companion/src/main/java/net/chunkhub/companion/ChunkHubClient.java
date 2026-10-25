package net.chunkhub.companion;

import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.mojang.brigadier.arguments.StringArgumentType;
import net.fabricmc.api.ClientModInitializer;
import net.fabricmc.fabric.api.client.command.v2.ClientCommandRegistrationCallback;
import net.fabricmc.fabric.api.client.command.v2.ClientCommands;
import net.fabricmc.fabric.api.client.command.v2.FabricClientCommandSource;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.fabricmc.fabric.api.client.networking.v1.ClientPlayConnectionEvents;
import net.fabricmc.loader.api.FabricLoader;
import net.minecraft.ChatFormatting;
import net.minecraft.client.Minecraft;
import net.minecraft.network.chat.Component;

import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;
import java.util.UUID;

/**
 * Client side of Chunk Hub Companion: makes World Stats work on ANY multiplayer server, even ones that
 * don't have the mod. It asks the server for your statistics the same way the in-game Statistics screen
 * does, reads the advancements the server already sends you, and uploads them to chunkhub.net.
 *
 * In single-player the built-in server side of the mod does the work, so the client just passes the
 * /chunkhub command along to it.
 */
public class ChunkHubClient implements ClientModInitializer {
	private static final int SYNC_EVERY_TICKS = 20 * 60 * 5; // five minutes
	private static final int WAIT_FOR_STATS_TICKS = 60;       // give the server three seconds to answer
	private static final int FIRST_SYNC_TICKS = 20 * 10;      // ten seconds after joining

	private long ticks = 0;
	private long joinedAt = -1;
	private long pendingUpload = -1; // tick at which to read and upload the stats we asked for
	private boolean notifyNext = false;
	private JsonObject lastPayload = null; // kept so we can still send something as you leave

	@Override
	public void onInitializeClient() {
		ClientCommandRegistrationCallback.EVENT.register((dispatcher, ctx) -> dispatcher.register(ClientCommands.literal("chunkhub")
			.executes(c -> run(c.getSource(), "help", null))
			.then(ClientCommands.literal("link")
				.executes(c -> { c.getSource().sendError(Component.literal("Type the code from chunkhub.net, like: /chunkhub link ABCD-1234")); return 0; })
				.then(ClientCommands.argument("code", StringArgumentType.word())
					.executes(c -> run(c.getSource(), "link", StringArgumentType.getString(c, "code")))))
			.then(ClientCommands.literal("sync").executes(c -> run(c.getSource(), "sync", null)))
			.then(ClientCommands.literal("status").executes(c -> run(c.getSource(), "status", null)))
			.then(ClientCommands.literal("unlink").executes(c -> run(c.getSource(), "unlink", null)))));

		ClientPlayConnectionEvents.JOIN.register((listener, sender, mc) -> { joinedAt = ticks; lastPayload = null; });
		ClientPlayConnectionEvents.DISCONNECT.register((listener, mc) -> {
			// send what we read most recently (the game clears your stats once you've left)
			JsonObject p = lastPayload; lastPayload = null; joinedAt = -1; pendingUpload = -1;
			if (p != null) Sync.post("/api/mod/sync", p);
		});

		ClientTickEvents.END_CLIENT_TICK.register(mc -> {
			ticks++;
			if (mc.player == null || mc.getConnection() == null || singleplayer(mc)) return;
			String key = serverKey(mc);
			if (key == null || ClientLinks.get(key) == null) return;
			if (joinedAt >= 0 && ticks - joinedAt == FIRST_SYNC_TICKS) requestStats(mc, false);
			else if (joinedAt >= 0 && ticks > joinedAt && (ticks - joinedAt) % SYNC_EVERY_TICKS == 0) requestStats(mc, false);
			if (pendingUpload >= 0 && ticks >= pendingUpload) { pendingUpload = -1; upload(mc, key, notifyNext); notifyNext = false; }
		});
	}

	// ---------------------------------------------------------------- commands

	private int run(FabricClientCommandSource src, String what, String code) {
		Minecraft mc = Minecraft.getInstance();
		if (singleplayer(mc)) {
			// single-player: the mod's built-in server side handles this world
			// sent as a raw command packet: going through sendCommand would loop back into this client command
			String cmd = "chunkhub" + ("help".equals(what) ? "" : " " + what) + (code == null ? "" : " " + code);
			try {
				Object pkt = Class.forName("net.minecraft.network.protocol.game.ServerboundChatCommandPacket").getConstructor(String.class).newInstance(cmd);
				call(mc.getConnection(), "send", pkt);
			} catch (Exception e) {
				ChunkHub.LOG.warn("Couldn't pass the command to the world", e);
				src.sendError(Component.literal("Couldn't run that here. Try again after reopening the world."));
				return 0;
			}
			return 1;
		}
		String key = serverKey(mc);
		if (key == null) { src.sendError(Component.literal("Join a world or server first.")); return 0; }
		ClientLinks.Link link = ClientLinks.get(key);
		switch (what) {
			case "help" -> {
				src.sendFeedback(ChunkHub.msg("Show your stats from this server on chunkhub.net. The server doesn't need the mod.", ChatFormatting.WHITE));
				src.sendFeedback(Component.literal("  /chunkhub link CODE").withStyle(ChatFormatting.YELLOW).append(Component.literal("  link this server (get a code on the World Stats page)").withStyle(ChatFormatting.GRAY)));
				src.sendFeedback(Component.literal("  /chunkhub sync").withStyle(ChatFormatting.YELLOW).append(Component.literal("  send your latest stats now").withStyle(ChatFormatting.GRAY)));
				src.sendFeedback(Component.literal("  /chunkhub status").withStyle(ChatFormatting.YELLOW).append(Component.literal("  check whether this server is linked").withStyle(ChatFormatting.GRAY)));
				src.sendFeedback(Component.literal("  /chunkhub unlink").withStyle(ChatFormatting.YELLOW).append(Component.literal("  stop sending stats from this server").withStyle(ChatFormatting.GRAY)));
			}
			case "link" -> {
				src.sendFeedback(ChunkHub.msg("Linking this server…", ChatFormatting.GRAY));
				JsonObject body = new JsonObject();
				body.addProperty("code", code);
				body.addProperty("world", serverLabel(mc));
				body.addProperty("uuid", mc.player.getUUID().toString());
				body.addProperty("name", mc.player.getName().getString());
				body.addProperty("mc", Sync.mcVersion());
				body.addProperty("mod", Sync.modVersion());
				Sync.post("/api/mod/link", body).thenAccept(res -> mc.execute(() -> {
					if (res != null && res.has("ok") && res.get("ok").getAsBoolean()) {
						ClientLinks.put(key, res.get("token").getAsString(), res.has("world_id") ? res.get("world_id").getAsString() : "");
						tell(mc, "Linked! This server now shows on chunkhub.net under World Stats. Sending your stats…", ChatFormatting.GREEN);
						requestStats(mc, true);
					} else tell(mc, Sync.errorText(res, "Couldn't link this server. Check the code and try again."), ChatFormatting.RED);
				}));
			}
			case "sync" -> {
				if (link == null) { src.sendError(Component.literal("This server isn't linked yet. Get a code on chunkhub.net and use /chunkhub link CODE")); return 0; }
				src.sendFeedback(ChunkHub.msg("Asking the server for your stats…", ChatFormatting.GRAY));
				requestStats(mc, true);
			}
			case "status" -> {
				if (link == null) src.sendFeedback(ChunkHub.msg("This server isn't linked. Get a code on chunkhub.net, World Stats, then use /chunkhub link CODE", ChatFormatting.WHITE));
				else src.sendFeedback(ChunkHub.msg("Linked to chunkhub.net. " + (link.lastSync > 0 ? "Last sent " + Sync.ago(link.lastSync) + "." : "Not sent yet.") + " Stats are sent every 5 minutes and when you leave.", ChatFormatting.GREEN));
			}
			case "unlink" -> {
				if (link == null) { src.sendError(Component.literal("This server isn't linked.")); return 0; }
				JsonObject body = new JsonObject(); body.addProperty("token", link.token);
				ClientLinks.remove(key); lastPayload = null;
				Sync.post("/api/mod/unlink", body);
				src.sendFeedback(ChunkHub.msg("Unlinked. Stats from this server won't be sent any more.", ChatFormatting.YELLOW));
			}
			default -> { }
		}
		return 1;
	}

	// ---------------------------------------------------------------- reading stats

	/** Same request the Statistics screen sends; the server answers with all of your statistics. */
	private void requestStats(Minecraft mc, boolean notify) {
		try {
			Class<?> pkt = Class.forName("net.minecraft.network.protocol.game.ServerboundClientCommandPacket");
			Class<?> action = null;
			for (Class<?> c : pkt.getDeclaredClasses()) if (c.isEnum()) action = c;
			Object requestStats = null;
			for (Object o : action.getEnumConstants()) if (o.toString().equals("REQUEST_STATS")) requestStats = o;
			Object packet = pkt.getConstructor(action).newInstance(requestStats);
			call(mc.getConnection(), "send", packet);
		} catch (Exception e) {
			ChunkHub.LOG.warn("Couldn't ask the server for stats", e);
		}
		notifyNext = notifyNext || notify;
		pendingUpload = ticks + WAIT_FOR_STATS_TICKS;
	}

	private void upload(Minecraft mc, String key, boolean notify) {
		ClientLinks.Link link = ClientLinks.get(key);
		if (link == null || mc.player == null) return;
		JsonObject stats = readStats(mc), adv = readAdvancements(mc);
		JsonObject body = new JsonObject();
		body.addProperty("token", link.token);
		body.addProperty("name", mc.player.getName().getString());
		body.addProperty("mc", Sync.mcVersion());
		body.addProperty("mod", Sync.modVersion());
		if (stats != null) body.add("stats", stats);
		if (adv != null) body.add("advancements", adv);
		JsonObject extra = new JsonObject();
		extra.addProperty("source", "client");
		extra.addProperty("server", serverLabel(mc));
		extra.addProperty("sent_at", System.currentTimeMillis());
		body.add("extra", extra);
		lastPayload = body;
		Sync.post("/api/mod/sync", body).thenAccept(res -> mc.execute(() -> {
			boolean ok = res != null && res.has("ok") && res.get("ok").getAsBoolean();
			if (ok) ClientLinks.touch(key);
			if (res != null && res.has("error") && "unlinked".equals(res.get("error").getAsString())) {
				ClientLinks.remove(key); lastPayload = null;
				tell(mc, "This server was unlinked on chunkhub.net. Use /chunkhub link CODE to link it again.", ChatFormatting.YELLOW);
			} else if (notify) tell(mc, ok ? "Stats sent! See them on chunkhub.net, World Stats." : Sync.errorText(res, "Couldn't reach chunkhub.net. Your stats will be sent next time."), ok ? ChatFormatting.GREEN : ChatFormatting.RED);
		}));
	}

	/** Turns the game's stats counter into the same layout as a world's stats file. */
	@SuppressWarnings({"unchecked", "rawtypes"})
	private static JsonObject readStats(Minecraft mc) {
		try {
			Object counter = call(mc.player, "getStats");
			Map<?, ?> map = findMap(counter, null);
			if (map == null) return null;
			Object statTypes = Class.forName("net.minecraft.core.registries.BuiltInRegistries").getField("STAT_TYPE").get(null);
			JsonObject byType = new JsonObject();
			for (Map.Entry<?, ?> e : map.entrySet()) {
				Object stat = e.getKey(); int value = ((Number) e.getValue()).intValue();
				Object type = call(stat, "getType"), val = call(stat, "getValue");
				Object typeId = call(statTypes, "getKey", type), reg = call(type, "getRegistry"), valId = call(reg, "getKey", val);
				if (typeId == null || valId == null) continue;
				String t = typeId.toString();
				if (!byType.has(t)) byType.add(t, new JsonObject());
				byType.getAsJsonObject(t).addProperty(valId.toString(), value);
			}
			JsonObject out = new JsonObject();
			out.add("stats", byType);
			return out;
		} catch (Exception e) {
			ChunkHub.LOG.warn("Couldn't read your stats", e);
			return null;
		}
	}

	/** The advancements the server has sent you, in the same layout as a world's advancements file. */
	private static JsonObject readAdvancements(Minecraft mc) {
		try {
			Object ca = call(mc.getConnection(), "getAdvancements");
			Map<?, ?> map = findMap(ca, "AdvancementProgress");
			if (map == null) return null;
			JsonObject out = new JsonObject();
			for (Map.Entry<?, ?> e : map.entrySet()) {
				Object id = call(e.getKey(), "id");
				Object done = call(e.getValue(), "isDone");
				if (id == null) continue;
				JsonObject o = new JsonObject();
				o.addProperty("done", Boolean.TRUE.equals(done));
				out.add(id.toString(), o);
			}
			return out;
		} catch (Exception e) {
			ChunkHub.LOG.warn("Couldn't read your advancements", e);
			return null;
		}
	}

	// ---------------------------------------------------------------- helpers

	private static boolean singleplayer(Minecraft mc) {
		return Boolean.TRUE.equals(call(mc, "hasSingleplayerServer"));
	}

	/** A key for the server you're on, e.g. "server:play.example.net". */
	private static String serverKey(Minecraft mc) {
		Object data = call(mc, "getCurrentServer");
		Object ip = field(data, "ip");
		if (ip == null) return null;
		String s = ip.toString().trim().toLowerCase();
		if (s.endsWith(":25565")) s = s.substring(0, s.length() - 6);
		return "server:" + s;
	}

	/** What the server is called in your server list, plus its address. */
	private static String serverLabel(Minecraft mc) {
		Object data = call(mc, "getCurrentServer");
		Object name = field(data, "name"), ip = field(data, "ip");
		String n = name == null ? "" : name.toString().trim(), a = ip == null ? "" : ip.toString().trim();
		if (n.isEmpty() || n.equalsIgnoreCase("Minecraft Server")) return a.isEmpty() ? "Server" : a;
		return a.isEmpty() || n.equalsIgnoreCase(a) ? n : n + " (" + a + ")";
	}

	private static void tell(Minecraft mc, String text, ChatFormatting color) {
		if (mc.player == null) return;
		Component c = ChunkHub.msg(text, color);
		if (call(mc.player, "displayClientMessage", c, false) == null && !hasMethod(mc.player, "displayClientMessage")) call(mc.player, "sendSystemMessage", c);
	}

	private static Map<?, ?> findMap(Object holder, String valueClassHint) {
		if (holder == null) return null;
		for (Class<?> c = holder.getClass(); c != null; c = c.getSuperclass()) {
			for (Field f : c.getDeclaredFields()) {
				if (!Map.class.isAssignableFrom(f.getType())) continue;
				try {
					f.setAccessible(true);
					Map<?, ?> m = (Map<?, ?>) f.get(holder);
					if (m == null) continue;
					if (valueClassHint == null) return m;
					for (Object v : m.values()) { if (v != null && v.getClass().getName().contains(valueClassHint)) return m; break; }
				} catch (Exception ignored) {}
			}
		}
		return null;
	}

	private static Object field(Object target, String name) {
		if (target == null) return null;
		for (Class<?> c = target.getClass(); c != null; c = c.getSuperclass()) {
			try { Field f = c.getDeclaredField(name); f.setAccessible(true); return f.get(target); } catch (NoSuchFieldException ignored) {} catch (Exception e) { return null; }
		}
		return null;
	}

	private static boolean hasMethod(Object target, String name) {
		for (Class<?> c = target.getClass(); c != null; c = c.getSuperclass()) for (Method m : c.getDeclaredMethods()) if (m.getName().equals(name)) return true;
		return false;
	}

	/** Calls a method by name, picking the version whose parameters fit the arguments. */
	static Object call(Object target, String name, Object... args) {
		if (target == null) return null;
		for (Class<?> c = target.getClass(); c != null; c = c.getSuperclass()) {
			for (Method m : c.getDeclaredMethods()) {
				if (!m.getName().equals(name) || m.getParameterCount() != args.length) continue;
				Class<?>[] p = m.getParameterTypes(); boolean fits = true;
				for (int i = 0; i < p.length && fits; i++) fits = args[i] == null || wrap(p[i]).isInstance(args[i]);
				if (!fits) continue;
				try { m.setAccessible(true); return m.invoke(target, args); } catch (Exception e) { ChunkHub.LOG.debug("{} failed", name, e); return null; }
			}
		}
		for (Class<?> i : target.getClass().getInterfaces()) {
			for (Method m : i.getMethods()) {
				if (!m.getName().equals(name) || m.getParameterCount() != args.length) continue;
				try { return m.invoke(target, args); } catch (Exception e) { return null; }
			}
		}
		return null;
	}

	private static Class<?> wrap(Class<?> c) {
		if (!c.isPrimitive()) return c;
		if (c == boolean.class) return Boolean.class;
		if (c == int.class) return Integer.class;
		if (c == long.class) return Long.class;
		if (c == float.class) return Float.class;
		if (c == double.class) return Double.class;
		return c;
	}
}

/** Links for multiplayer servers, saved in the game's config folder (config/chunkhub/links.json). */
final class ClientLinks {
	static final class Link {
		final String token; final String worldId; long lastSync;
		Link(String token, String worldId, long lastSync) { this.token = token; this.worldId = worldId; this.lastSync = lastSync; }
	}
	private static JsonObject data;
	private ClientLinks() {}

	private static Path file() { return FabricLoader.getInstance().getConfigDir().resolve("chunkhub").resolve("links.json"); }

	private static JsonObject data() {
		if (data != null) return data;
		data = new JsonObject();
		try { if (Files.isRegularFile(file())) data = JsonParser.parseString(Files.readString(file(), StandardCharsets.UTF_8)).getAsJsonObject(); }
		catch (Exception e) { ChunkHub.LOG.warn("Couldn't read Chunk Hub links", e); }
		return data;
	}

	private static String id(String key) {
		Minecraft mc = Minecraft.getInstance();
		UUID u = mc.player != null ? mc.player.getUUID() : null;
		return key + "|" + u;
	}

	static Link get(String key) {
		JsonObject d = data(); String k = id(key);
		if (!d.has(k)) return null;
		JsonObject o = d.getAsJsonObject(k);
		return new Link(o.get("token").getAsString(), o.has("world_id") ? o.get("world_id").getAsString() : "", o.has("last_sync") ? o.get("last_sync").getAsLong() : 0);
	}

	static void put(String key, String token, String worldId) {
		JsonObject o = new JsonObject();
		o.addProperty("token", token); o.addProperty("world_id", worldId); o.addProperty("last_sync", 0);
		data().add(id(key), o); save();
	}

	static void touch(String key) {
		JsonObject d = data(); String k = id(key);
		if (d.has(k)) { d.getAsJsonObject(k).addProperty("last_sync", System.currentTimeMillis()); save(); }
	}

	static void remove(String key) { data().remove(id(key)); save(); }

	private static void save() {
		try { Files.createDirectories(file().getParent()); Files.writeString(file(), data().toString(), StandardCharsets.UTF_8); }
		catch (Exception e) { ChunkHub.LOG.warn("Couldn't save Chunk Hub links", e); }
	}
}
