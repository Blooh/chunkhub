package net.chunkhub.companion;

import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import net.fabricmc.loader.api.FabricLoader;
import net.minecraft.ChatFormatting;
import net.minecraft.network.chat.Component;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.level.ServerPlayer;

import java.lang.reflect.Method;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.stream.Stream;

/** Reads the game's own stats and advancements files and sends them to chunkhub.net. */
final class Sync {
	private static final String API = System.getProperty("chunkhub.api", "https://chunkhub.net");
	private static final HttpClient HTTP = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
	private static final ExecutorService POOL = Executors.newSingleThreadExecutor(r -> { Thread t = new Thread(r, "Chunk Hub sync"); t.setDaemon(true); return t; });
	private static final Map<String, Path> FOUND = new ConcurrentHashMap<>();

	private Sync() {}

	static String modVersion() {
		return FabricLoader.getInstance().getModContainer(ChunkHub.MOD_ID).map(m -> m.getMetadata().getVersion().getFriendlyString()).orElse("?");
	}

	static String mcVersion() {
		return FabricLoader.getInstance().getModContainer("minecraft").map(m -> m.getMetadata().getVersion().getFriendlyString()).orElse("?");
	}

	// ---------------------------------------------------------------- linking

	static void link(MinecraftServer server, ServerPlayer p, String code) {
		UUID id = p.getUUID();
		JsonObject body = new JsonObject();
		body.addProperty("code", code);
		body.addProperty("world", Links.worldName(server));
		body.addProperty("uuid", id.toString());
		body.addProperty("name", p.getName().getString());
		body.addProperty("mc", mcVersion());
		body.addProperty("mod", modVersion());
		post("/api/mod/link", body).thenAccept(res -> server.execute(() -> {
			if (res != null && res.has("ok") && res.get("ok").getAsBoolean()) {
				Links.put(server, id, res.get("token").getAsString(), res.has("world_id") ? res.get("world_id").getAsString() : "");
				tell(server, id, "Linked! This world now shows on chunkhub.net under World Stats. Sending your stats…", ChatFormatting.GREEN);
				ServerPlayer again = server.getPlayerList().getPlayer(id);
				if (again != null) sync(server, again, "linked", id);
			} else {
				tell(server, id, errorText(res, "Couldn't link this world. Check the code and try again."), ChatFormatting.RED);
			}
		}));
	}

	static void unlink(MinecraftServer server, ServerPlayer p) {
		UUID id = p.getUUID();
		Links.Link l = Links.get(server, id);
		if (l == null) return;
		JsonObject body = new JsonObject();
		body.addProperty("token", l.token);
		Links.remove(server, id);
		tell(server, id, "Unlinked. This world won't send stats any more.", ChatFormatting.YELLOW);
		post("/api/mod/unlink", body);
	}

	// ---------------------------------------------------------------- syncing

	/** Saves the player's stats and advancements to disk, then sends them. Call on the server thread. */
	static void sync(MinecraftServer server, ServerPlayer p, String reason, UUID notify) {
		Links.Link l = Links.get(server, p.getUUID());
		if (l == null) return;
		savePlayerFiles(p);
		JsonObject body = payload(server, p.getUUID(), p.getName().getString(), l, reason);
		if (body == null) { if (notify != null) tell(server, notify, "Couldn't find this world's stats files yet. Play for a minute and try again.", ChatFormatting.RED); return; }
		send(server, p.getUUID(), body, notify, false);
	}

	/** For players who just left or when the world closes: the game has already saved their files. */
	static void syncOffline(MinecraftServer server, UUID id, String name, String reason, boolean wait) {
		Links.Link l = Links.get(server, id);
		if (l == null) return;
		JsonObject body = payload(server, id, name, l, reason);
		if (body != null) send(server, id, body, null, wait);
	}

	private static void send(MinecraftServer server, UUID id, JsonObject body, UUID notify, boolean wait) {
		CompletableFuture<JsonObject> f = post("/api/mod/sync", body);
		f = f.thenApply(res -> {
			boolean ok = res != null && res.has("ok") && res.get("ok").getAsBoolean();
			if (ok) Links.touch(server, id);
			if (res != null && res.has("error") && "unlinked".equals(res.get("error").getAsString())) {
				// the world was removed on the website: forget the link
				server.execute(() -> { Links.remove(server, id); tell(server, id, "This world was unlinked on chunkhub.net. Use /chunkhub link CODE to link it again.", ChatFormatting.YELLOW); });
			} else if (notify != null) {
				server.execute(() -> tell(server, notify, ok ? "Stats sent! See them on chunkhub.net, World Stats." : errorText(res, "Couldn't reach chunkhub.net. Your stats will be sent next time."), ok ? ChatFormatting.GREEN : ChatFormatting.RED));
			}
			return res;
		});
		if (wait) {
			try { f.get(8, java.util.concurrent.TimeUnit.SECONDS); } catch (Exception ignored) {}
		}
	}

	private static JsonObject payload(MinecraftServer server, UUID id, String name, Links.Link l, String reason) {
		Path root = Links.worldRoot(server);
		JsonElement stats = readJson(find(root, id, "stat"));
		JsonElement adv = readJson(find(root, id, "advancement"));
		if (stats == null && adv == null) return null;
		JsonObject body = new JsonObject();
		body.addProperty("token", l.token);
		body.addProperty("name", name);
		body.addProperty("mc", mcVersion());
		body.addProperty("mod", modVersion());
		if (stats != null) body.add("stats", stats);
		if (adv != null) body.add("advancements", adv);
		JsonObject extra = new JsonObject();
		extra.addProperty("reason", reason);
		extra.addProperty("world", Links.worldName(server));
		extra.addProperty("sent_at", System.currentTimeMillis());
		body.add("extra", extra);
		return body;
	}

	/** Finds &lt;world&gt;/stats/&lt;uuid&gt;.json (or advancements), wherever this game version keeps them. */
	private static Path find(Path root, UUID id, String folderHint) {
		String key = root + "|" + id + "|" + folderHint;
		Path cached = FOUND.get(key);
		if (cached != null && Files.isRegularFile(cached)) return cached;
		String file = id + ".json";
		Path direct = root.resolve(folderHint.equals("stat") ? "stats" : "advancements").resolve(file);
		Path hit = null;
		if (Files.isRegularFile(direct)) hit = direct;
		else {
			try (Stream<Path> s = Files.walk(root, 4)) {
				hit = s.filter(x -> x.getFileName().toString().equalsIgnoreCase(file))
					.filter(x -> x.getParent() != null && x.getParent().getFileName().toString().toLowerCase().contains(folderHint))
					.findFirst().orElse(null);
			} catch (Exception e) {
				ChunkHub.LOG.warn("Couldn't search the world folder", e);
			}
		}
		if (hit != null) FOUND.put(key, hit);
		return hit;
	}

	private static JsonElement readJson(Path f) {
		if (f == null) return null;
		try { return JsonParser.parseString(Files.readString(f, StandardCharsets.UTF_8)); }
		catch (Exception e) { ChunkHub.LOG.warn("Couldn't read {}", f, e); return null; }
	}

	/**
	 * Asks the game to write this player's stats and advancements to disk now.
	 * Minecraft 26.x ships with its real names, so these are looked up by name; if a future version renames
	 * them, the mod simply sends the copy the game saved last (it saves every few minutes and on leaving).
	 */
	private static void savePlayerFiles(ServerPlayer p) {
		call(call(p, "getStats"), "save");
		call(call(p, "getAdvancements"), "save");
	}

	private static Object call(Object target, String name) {
		if (target == null) return null;
		for (Class<?> c = target.getClass(); c != null; c = c.getSuperclass()) {
			for (Method m : c.getDeclaredMethods()) {
				if (m.getName().equals(name) && m.getParameterCount() == 0) {
					try { m.setAccessible(true); return m.invoke(target); }
					catch (Exception e) { ChunkHub.LOG.debug("{} failed", name, e); return null; }
				}
			}
		}
		return null;
	}

	// ---------------------------------------------------------------- helpers

	private static CompletableFuture<JsonObject> post(String path, JsonObject body) {
		HttpRequest req = HttpRequest.newBuilder(URI.create(API + path))
			.timeout(Duration.ofSeconds(20))
			.header("Content-Type", "application/json")
			.header("User-Agent", "ChunkHubCompanion/" + modVersion() + " (Fabric; Minecraft " + mcVersion() + ")")
			.POST(HttpRequest.BodyPublishers.ofString(body.toString(), StandardCharsets.UTF_8))
			.build();
		return CompletableFuture.supplyAsync(() -> {
			try {
				HttpResponse<String> r = HTTP.send(req, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
				JsonElement e = JsonParser.parseString(r.body());
				return e.isJsonObject() ? e.getAsJsonObject() : null;
			} catch (Exception e) {
				ChunkHub.LOG.warn("Couldn't reach chunkhub.net: {}", e.toString());
				return null;
			}
		}, POOL);
	}

	private static String errorText(JsonObject res, String fallback) {
		if (res != null && res.has("error") && res.get("error").isJsonPrimitive()) {
			String e = res.get("error").getAsString();
			if (!e.isBlank() && e.length() > 12) return e;
		}
		return fallback;
	}

	private static void tell(MinecraftServer server, UUID id, String text, ChatFormatting color) {
		ServerPlayer p = server.getPlayerList().getPlayer(id);
		if (p != null) p.sendSystemMessage(ChunkHub.msg(text, color));
	}

	static String ago(long ms) {
		long s = Math.max(0, (System.currentTimeMillis() - ms) / 1000);
		if (s < 90) return "just now";
		long m = s / 60;
		if (m < 90) return m + " minutes ago";
		long h = m / 60;
		if (h < 48) return h + " hours ago";
		return (h / 24) + " days ago";
	}
}
