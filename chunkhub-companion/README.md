# Chunk Hub Companion (Fabric, Minecraft Java 26.2)

Links a Minecraft world to chunkhub.net. The mod sends the game's own statistics file and advancements file
for each linked player to the website, where they appear on **World Stats** and tick off the **Advancements checklist**.

## Building the mod (one time setup)

You need **Java 25** (the JDK, not just the runtime). Get it free from https://adoptium.net (choose "Temurin 25").

1. Open this folder in a terminal (on Windows: open the folder, click the address bar, type `cmd`, press Enter).
2. Run:
   - Windows: `gradlew.bat build`
   - Mac or Linux: `./gradlew build`
3. The first build downloads Minecraft and Fabric, so it takes a few minutes. When it says **BUILD SUCCESSFUL**,
   the mod is at `build/libs/chunkhub-companion-fabric-26.2-1.0.0.jar` (ignore the `-sources.jar` if there is one).

## Installing

1. Install **Fabric Loader** for Minecraft 26.2 from https://fabricmc.net/use/installer/
2. Put **Fabric API** for 26.2 (https://modrinth.com/mod/fabric-api) and the Chunk Hub jar into your `.minecraft/mods` folder.
3. Start Minecraft with the Fabric profile.

## Using it

1. On chunkhub.net, sign in and open **World Stats**, then press **Link a world**. You'll get a code like `K7QM-9PXD`.
2. In your world, open chat and run `/chunkhub link K7QM-9PXD`.
3. Your stats appear on the website within a few seconds, then update every 5 minutes, when you leave, and when the world closes.

Other commands: `/chunkhub sync` (send now), `/chunkhub status`, `/chunkhub unlink`.

The link is saved inside the world folder (`chunkhub/<your uuid>.json`). If you share your world folder,
delete that folder first, otherwise the other person's stats would go to your account.

Works in single-player and on servers that have the mod installed (each player links themselves).
On a server, the `/chunkhub` commands don't need operator permissions.

## Testing against a copy of the site

Start Minecraft with `-Dchunkhub.api=https://your-test-site.pages.dev` to send to a different address.
