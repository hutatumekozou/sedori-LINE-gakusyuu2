import { mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  Client,
  Events,
  GatewayIntentBits,
  Partials,
} from "discord.js";

import { getDiscordBotConfig, getDiscordStudyChannelId } from "@/lib/env";
import { handleDiscordDirectMessage } from "@/lib/discord/service";

const RECENT_MESSAGE_TTL_MS = 60_000;
const DISCORD_BOT_LOCK_DIR = path.join(process.cwd(), ".codex-runtime");
const DISCORD_BOT_LOCK_PATH = path.join(DISCORD_BOT_LOCK_DIR, "discord-bot.lock");

const recentlyProcessedMessageIds = new Map<string, number>();

function markMessageAsProcessing(messageId: string) {
  const now = Date.now();

  for (const [existingMessageId, processedAt] of recentlyProcessedMessageIds) {
    if (now - processedAt > RECENT_MESSAGE_TTL_MS) {
      recentlyProcessedMessageIds.delete(existingMessageId);
    }
  }

  if (recentlyProcessedMessageIds.has(messageId)) {
    return false;
  }

  recentlyProcessedMessageIds.set(messageId, now);
  return true;
}

function isProcessRunning(pid: number) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function acquireBotLock() {
  mkdirSync(DISCORD_BOT_LOCK_DIR, { recursive: true });

  try {
    const existingPid = Number.parseInt(readFileSync(DISCORD_BOT_LOCK_PATH, "utf8").trim(), 10);

    if (Number.isInteger(existingPid) && existingPid > 0 && isProcessRunning(existingPid)) {
      throw new Error(
        `discord:bot は既に起動中です。別ターミナルの Bot を停止してください。PID=${existingPid}`,
      );
    }
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes("起動中です")) {
      // Ignore missing / unreadable stale lock files and overwrite below.
    } else {
      throw error;
    }
  }

  writeFileSync(DISCORD_BOT_LOCK_PATH, String(process.pid), "utf8");

  let released = false;

  return () => {
    if (released) {
      return;
    }

    released = true;

    try {
      const existingPid = Number.parseInt(readFileSync(DISCORD_BOT_LOCK_PATH, "utf8").trim(), 10);

      if (existingPid === process.pid) {
        unlinkSync(DISCORD_BOT_LOCK_PATH);
      }
    } catch {
      // Lock file was already removed or replaced.
    }
  };
}

export async function startDiscordBot() {
  const releaseBotLock = acquireBotLock();
  const studyChannelId = getDiscordStudyChannelId();
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.DirectMessages,
      GatewayIntentBits.DirectMessageReactions,
      GatewayIntentBits.MessageContent,
    ],
    partials: [Partials.Channel, Partials.Message, Partials.User],
  });

  client.once(Events.ClientReady, (readyClient) => {
    console.info(`Discord bot ready: ${readyClient.user.tag}`);
  });

  client.on(Events.MessageCreate, async (message) => {
    const authorId = message.author?.id ?? null;
    const displayName =
      message.author?.globalName || message.author?.username || null;
    const isBot = message.author?.bot ?? false;
    const channelId = message.channelId || message.channel?.id || null;
    const inGuild = message.inGuild();
    const messageId = message.id;
    const content = message.content ?? "";
    const referencedMessageId = message.reference?.messageId || undefined;

    console.info("Discord MessageCreate", {
      authorId,
      isBot,
      channelType: message.channel?.type ?? null,
      inGuild,
      messageId,
      content,
    });

    if (isBot || !authorId || !channelId) {
      console.info("Discord Message skipped", {
        authorId,
        channelId,
        isBot,
        messageId,
      });
      return;
    }

    if (inGuild && studyChannelId && channelId !== studyChannelId) {
      console.info("Discord Message ignored outside study channel", {
        userId: authorId,
        channelId,
        studyChannelId,
        messageId,
      });
      return;
    }

    if (!markMessageAsProcessing(messageId)) {
      console.info("Discord Message skipped as duplicate", {
        userId: authorId,
        channelId,
        messageId,
      });
      return;
    }

    console.info("Discord handler start", {
      userId: authorId,
      channelId,
      inGuild,
      messageId,
      referencedMessageId: referencedMessageId || null,
      content,
    });

    try {
      await handleDiscordDirectMessage({
        discordUserId: authorId,
        displayName,
        channelId,
        text: content,
        sourceMessageId: messageId,
        referencedMessageId,
      });

      console.info("Discord handler done", {
        userId: authorId,
        channelId,
        messageId,
      });
    } catch (error) {
      recentlyProcessedMessageIds.delete(messageId);
      console.error("Discord DM handling failed", {
        messageId,
        userId: authorId,
        error,
      });
    }
  });

  await client.login(getDiscordBotConfig().botToken);

  const shutdown = async () => {
    releaseBotLock();
    client.destroy();
    process.exit(0);
  };

  process.on("exit", releaseBotLock);
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  return new Promise<never>(() => {});
}
