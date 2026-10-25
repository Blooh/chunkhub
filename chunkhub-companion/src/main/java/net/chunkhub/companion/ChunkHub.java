package net.chunkhub.companion;

import com.mojang.brigadier.CommandDispatcher;
import com.mojang.brigadier.arguments.StringArgumentType;
import net.fabricmc.api.ModInitializer;
import net.fabricmc.fabric.api.command.v2.CommandRegistrationCallback;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerLifecycleEvents;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerTickEvents;
import net.fabricmc.fabric.api.networking.v1.ServerPlayConnectionEvents;
import net.minecraft.ChatFormatting;
import net.minecraft.commands.CommandSourceStack;
import net.minecraft.commands.Commands;
import net.minecraft.network.chat.Component;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.level.ServerPlayer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Chunk Hub Companion.
 *
 * Players link a world to their chunkhub.net account with /chunkhub link CODE (the code comes from the
 * World Stats page). After that, the mod sends the game's own statistics and advancements files for that
 * player every few minutes, when they leave, and when the world closes.
 */
public class ChunkHub implements ModInitializer {
	public static final String MOD_ID = "chunkhub";
	public static final Logger LOG = LoggerFactory.getLogger("Chunk Hub");

	private static final int SYNC_EVERY_TICKS = 20 * 60 * 5; // five minutes
	private static final int AFTER_LEAVE_TICKS = 40;          // give the game two seconds to save a leaving player

	private long ticks = 0;
	private final Map<UUID, Long> pendingAfterLeave = new HashMap<>();
	private final Map<UUID, String> names = new HashMap<>();
	private final List<UUID> onlineAtStop = new ArrayList<>();

	@Override
	public void onInitialize() {
		CommandRegistrationCallback.EVENT.register((dispatcher, buildContext, selection) -> registerCommands(dispatcher));

		ServerTickEvents.END_SERVER_TICK.register(server -> {
			ticks++;
			if (ticks % (20 * 20) == 0 && ticks % SYNC_EVERY_TICKS != 0) {
				for (ServerPlayer p : server.getPlayerList().getPlayers()) Sync.live(server, p);
			}
			if (ticks % SYNC_EVERY_TICKS == 0) {
				for (ServerPlayer p : server.getPlayerList().getPlayers()) {
					if (Links.get(server, p.getUUID()) != null) Sync.sync(server, p, "timer", null);
				}
			}
			if (!pendingAfterLeave.isEmpty()) {
				pendingAfterLeave.entrySet().removeIf(e -> {
					if (ticks < e.getValue()) return false;
					Sync.syncOffline(server, e.getKey(), names.getOrDefault(e.getKey(), ""), "left", false);
					return true;
				});
			}
		});

		ServerPlayConnectionEvents.JOIN.register((handler, sender, server) -> {
			ServerPlayer p = handler.player;
			names.put(p.getUUID(), p.getName().getString());
			if (Links.get(server, p.getUUID()) != null) Sync.sync(server, p, "joined", null);
		});

		ServerPlayConnectionEvents.DISCONNECT.register((handler, server) -> {
			ServerPlayer p = handler.player;
			names.put(p.getUUID(), p.getName().getString());
			if (Links.get(server, p.getUUID()) != null) pendingAfterLeave.put(p.getUUID(), ticks + AFTER_LEAVE_TICKS);
		});

		ServerLifecycleEvents.SERVER_STOPPING.register(server -> {
			onlineAtStop.clear();
			for (ServerPlayer p : server.getPlayerList().getPlayers()) {
				names.put(p.getUUID(), p.getName().getString());
				if (Links.get(server, p.getUUID()) != null) onlineAtStop.add(p.getUUID());
			}
			onlineAtStop.addAll(pendingAfterLeave.keySet());
			pendingAfterLeave.clear();
		});

		// by now the game has saved everyone, so the files are up to date; send them before the game closes
		ServerLifecycleEvents.SERVER_STOPPED.register(server -> {
			for (UUID id : onlineAtStop) Sync.syncOffline(server, id, names.getOrDefault(id, ""), "closed", true);
			onlineAtStop.clear();
			Links.clearCache();
		});

		LOG.info("Chunk Hub Companion ready. Link a world with /chunkhub link CODE");
	}

	private void registerCommands(CommandDispatcher<CommandSourceStack> dispatcher) {
		dispatcher.register(Commands.literal("chunkhub")
			.executes(c -> help(c.getSource()))
			.then(Commands.literal("link")
				.executes(c -> { c.getSource().sendFailure(Component.literal("Type the code from chunkhub.net, like: /chunkhub link ABCD-1234")); return 0; })
				.then(Commands.argument("code", StringArgumentType.word())
					.executes(c -> link(c.getSource(), StringArgumentType.getString(c, "code")))))
			.then(Commands.literal("sync").executes(c -> syncNow(c.getSource())))
			.then(Commands.literal("status").executes(c -> status(c.getSource())))
			.then(Commands.literal("unlink").executes(c -> unlink(c.getSource()))));
	}

	static Component msg(String text, ChatFormatting color) {
		return Component.literal("[Chunk Hub] ").withStyle(ChatFormatting.RED).append(Component.literal(text).withStyle(color));
	}

	private int help(CommandSourceStack src) {
		src.sendSuccess(() -> msg("Show this world's stats on chunkhub.net.", ChatFormatting.WHITE), false);
		src.sendSuccess(() -> Component.literal("  /chunkhub link CODE").withStyle(ChatFormatting.YELLOW).append(Component.literal("  link this world (get a code on the World Stats page)").withStyle(ChatFormatting.GRAY)), false);
		src.sendSuccess(() -> Component.literal("  /chunkhub sync").withStyle(ChatFormatting.YELLOW).append(Component.literal("  send your latest stats now").withStyle(ChatFormatting.GRAY)), false);
		src.sendSuccess(() -> Component.literal("  /chunkhub status").withStyle(ChatFormatting.YELLOW).append(Component.literal("  check whether this world is linked").withStyle(ChatFormatting.GRAY)), false);
		src.sendSuccess(() -> Component.literal("  /chunkhub unlink").withStyle(ChatFormatting.YELLOW).append(Component.literal("  stop sending this world's stats").withStyle(ChatFormatting.GRAY)), false);
		return 1;
	}

	private int link(CommandSourceStack src, String code) {
		ServerPlayer p = src.getPlayer();
		if (p == null) { src.sendFailure(Component.literal("Run this as a player in the world you want to link.")); return 0; }
		MinecraftServer server = src.getServer();
		src.sendSuccess(() -> msg("Linking this world…", ChatFormatting.GRAY), false);
		Sync.link(server, p, code);
		return 1;
	}

	private int syncNow(CommandSourceStack src) {
		ServerPlayer p = src.getPlayer();
		if (p == null) { src.sendFailure(Component.literal("Run this as a player.")); return 0; }
		if (Links.get(src.getServer(), p.getUUID()) == null) { src.sendFailure(Component.literal("This world isn't linked yet. Get a code on chunkhub.net and use /chunkhub link CODE")); return 0; }
		src.sendSuccess(() -> msg("Sending your stats…", ChatFormatting.GRAY), false);
		Sync.sync(src.getServer(), p, "command", p.getUUID());
		return 1;
	}

	private int status(CommandSourceStack src) {
		ServerPlayer p = src.getPlayer();
		if (p == null) { src.sendFailure(Component.literal("Run this as a player.")); return 0; }
		Links.Link l = Links.get(src.getServer(), p.getUUID());
		if (l == null) src.sendSuccess(() -> msg("This world isn't linked. Get a code on chunkhub.net, World Stats, then use /chunkhub link CODE", ChatFormatting.WHITE), false);
		else src.sendSuccess(() -> msg("Linked to chunkhub.net. " + (l.lastSync > 0 ? "Last sent " + Sync.ago(l.lastSync) + "." : "Not sent yet.") + " Stats are sent every 5 minutes and when you leave.", ChatFormatting.GREEN), false);
		return 1;
	}

	private int unlink(CommandSourceStack src) {
		ServerPlayer p = src.getPlayer();
		if (p == null) { src.sendFailure(Component.literal("Run this as a player.")); return 0; }
		if (Links.get(src.getServer(), p.getUUID()) == null) { src.sendFailure(Component.literal("This world isn't linked.")); return 0; }
		Sync.unlink(src.getServer(), p);
		return 1;
	}
}
