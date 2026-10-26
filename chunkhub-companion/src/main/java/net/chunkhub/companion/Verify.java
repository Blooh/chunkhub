package net.chunkhub.companion;

import com.google.gson.JsonObject;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.time.Duration;
import java.util.HexFormat;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;

/**
 * Proves to chunkhub.net that you really own the Minecraft account you're playing on, the same way
 * online-mode servers check players:
 *   1. the game tells Mojang "I'm joining server <random id>" using your login (Mojang checks it),
 *   2. chunkhub.net asks Mojang "did <name> just join <random id>?".
 * Cracked / offline accounts can't do step 1, so they can't be verified. Your login token is only
 * ever sent to Mojang (sessionserver.mojang.com), never to chunkhub.net.
 */
final class Verify {
	private Verify() {}

	private static final HttpClient HTTP = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
	private static final SecureRandom RNG = new SecureRandom();

	/** Result of trying to verify: serverId to send to chunkhub.net, or why it couldn't be done. */
	record Result(String serverId, String problem) {
		boolean ok() { return serverId != null; }
	}

	/**
	 * Runs step 1 for the account signed in to this game. {@code expectUuid} is the player being linked:
	 * if this game is signed in to a different account (e.g. someone else on your LAN world), nothing is sent.
	 */
	static CompletableFuture<Result> join(UUID expectUuid) {
		return CompletableFuture.supplyAsync(() -> {
			try {
				Object mc;
				try { mc = Class.forName("net.minecraft.client.Minecraft").getMethod("getInstance").invoke(null); }
				catch (ClassNotFoundException e) { return new Result(null, "server"); } // a dedicated server has no Minecraft login
				Object user = Reflect.call(mc, "getUser");
				String token = str(Reflect.call(user, "getAccessToken"));
				Object pid = Reflect.call(user, "getProfileId");
				if (pid == null) pid = Reflect.call(user, "getUuid");
				String type = String.valueOf(Reflect.call(user, "getType"));
				if (token == null || token.length() < 20 || pid == null || "LEGACY".equals(type)) return new Result(null, "offline");
				String uuid = pid.toString().replace("-", "").toLowerCase();
				if (expectUuid != null && !expectUuid.toString().replace("-", "").equalsIgnoreCase(uuid)) return new Result(null, "other");
				byte[] b = new byte[16]; RNG.nextBytes(b);
				String serverId = HexFormat.of().formatHex(b);
				JsonObject body = new JsonObject();
				body.addProperty("accessToken", token);
				body.addProperty("selectedProfile", uuid);
				body.addProperty("serverId", serverId);
				HttpRequest req = HttpRequest.newBuilder(URI.create("https://sessionserver.mojang.com/session/minecraft/join"))
					.timeout(Duration.ofSeconds(15))
					.header("Content-Type", "application/json")
					.POST(HttpRequest.BodyPublishers.ofString(body.toString(), StandardCharsets.UTF_8))
					.build();
				HttpResponse<String> r = HTTP.send(req, HttpResponse.BodyHandlers.ofString());
				if (r.statusCode() == 204 || r.statusCode() == 200) return new Result(serverId, null);
				return new Result(null, r.statusCode() == 403 || r.statusCode() == 401 ? "offline" : "mojang");
			} catch (Throwable t) {
				ChunkHub.LOG.warn("Couldn't verify your Minecraft account: {}", t.toString());
				return new Result(null, "mojang");
			}
		});
	}

	private static String str(Object o) { return o == null ? null : o.toString(); }

	/** What to tell the player after linking or /chunkhub verify. */
	static String explain(JsonObject res, Result v) {
		boolean verified = res != null && res.has("verified") && res.get("verified").getAsBoolean();
		if (verified) return "Your Minecraft account is verified. You can show it on your Chunk Hub profile (My Account).";
		String p = v == null ? null : v.problem();
		if ("offline".equals(p)) return "Your Minecraft account couldn't be verified: only official (bought) Minecraft accounts can be verified.";
		if ("server".equals(p) || "other".equals(p)) return "This link isn't verified. Run /chunkhub verify from your own game (with the Chunk Hub mod installed) to verify your account.";
		if (res != null && res.has("verify_error") && res.get("verify_error").isJsonPrimitive()) return res.get("verify_error").getAsString();
		return "Your Minecraft account couldn't be verified right now. Try /chunkhub verify again in a minute.";
	}
}
