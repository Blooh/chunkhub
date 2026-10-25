package net.chunkhub.companion;

import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import net.minecraft.server.MinecraftServer;
import net.minecraft.world.level.storage.LevelResource;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Which players in this world are linked to a chunkhub.net account.
 * Each link is a small file in the world folder: chunkhub/&lt;player uuid&gt;.json holding a secret token.
 * Copying or sharing the world keeps the link, so treat the world folder like you would a password.
 */
final class Links {
	static final class Link {
		final String token;
		final String worldId;
		volatile long lastSync;
		Link(String token, String worldId, long lastSync) { this.token = token; this.worldId = worldId; this.lastSync = lastSync; }
	}

	private static final Map<String, Link> CACHE = new ConcurrentHashMap<>();
	private static final Link NONE = new Link("", "", 0);

	private Links() {}

	static Path worldRoot(MinecraftServer server) {
		return server.getWorldPath(LevelResource.ROOT).toAbsolutePath().normalize();
	}

	static String worldName(MinecraftServer server) {
		Path root = worldRoot(server);
		Path name = root.getFileName();
		return name == null ? "World" : name.toString();
	}

	private static Path file(MinecraftServer server, UUID player) {
		return worldRoot(server).resolve("chunkhub").resolve(player + ".json");
	}

	static Link get(MinecraftServer server, UUID player) {
		String key = worldRoot(server) + "|" + player;
		Link cached = CACHE.get(key);
		if (cached != null) return cached == NONE ? null : cached;
		Link l = NONE;
		Path f = file(server, player);
		if (Files.isRegularFile(f)) {
			try {
				JsonObject o = JsonParser.parseString(Files.readString(f, StandardCharsets.UTF_8)).getAsJsonObject();
				l = new Link(o.get("token").getAsString(), o.has("world_id") ? o.get("world_id").getAsString() : "", o.has("last_sync") ? o.get("last_sync").getAsLong() : 0);
			} catch (Exception e) {
				ChunkHub.LOG.warn("Couldn't read {}", f, e);
			}
		}
		CACHE.put(key, l);
		return l == NONE ? null : l;
	}

	static void put(MinecraftServer server, UUID player, String token, String worldId) {
		write(server, player, new Link(token, worldId, 0));
	}

	static void touch(MinecraftServer server, UUID player) {
		Link l = get(server, player);
		if (l == null) return;
		l.lastSync = System.currentTimeMillis();
		write(server, player, l);
	}

	private static void write(MinecraftServer server, UUID player, Link l) {
		Path f = file(server, player);
		try {
			Files.createDirectories(f.getParent());
			JsonObject o = new JsonObject();
			o.addProperty("token", l.token);
			o.addProperty("world_id", l.worldId);
			o.addProperty("last_sync", l.lastSync);
			o.addProperty("note", "Chunk Hub link for this world. Delete this file (or use /chunkhub unlink) to stop sending stats.");
			Files.writeString(f, o.toString(), StandardCharsets.UTF_8);
			CACHE.put(worldRoot(server) + "|" + player, l);
		} catch (Exception e) {
			ChunkHub.LOG.warn("Couldn't save {}", f, e);
		}
	}

	static void remove(MinecraftServer server, UUID player) {
		try { Files.deleteIfExists(file(server, player)); } catch (Exception e) { ChunkHub.LOG.warn("Couldn't delete link file", e); }
		CACHE.put(worldRoot(server) + "|" + player, NONE);
	}

	static void clearCache() { CACHE.clear(); }
}
