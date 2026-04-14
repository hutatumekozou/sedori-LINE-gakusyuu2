import { getDiscordBotConfig } from "@/lib/env";

export type DiscordDmChannel = {
  id: string;
};

export type DiscordMessageResponse = {
  id: string;
  channel_id: string;
};

export type DiscordUploadFile = {
  data: Buffer;
  fileName: string;
  contentType: string;
};

const DISCORD_API_BASE_URL = "https://discord.com/api/v10";

function buildDiscordApiError(status: number, fallbackMessage: string, bodyText: string) {
  try {
    const parsed = JSON.parse(bodyText) as { message?: string };
    return new Error(parsed.message || fallbackMessage);
  } catch {
    return new Error(bodyText || fallbackMessage);
  }
}

async function discordApiRequest<T>(path: string, init: RequestInit) {
  const { botToken } = getDiscordBotConfig();
  const response = await fetch(`${DISCORD_API_BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bot ${botToken}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
    cache: "no-store",
  });

  const bodyText = await response.text();

  if (!response.ok) {
    throw buildDiscordApiError(response.status, "Discord API 呼び出しに失敗しました。", bodyText);
  }

  if (!bodyText) {
    return null as T;
  }

  return JSON.parse(bodyText) as T;
}

export async function createDiscordDmChannel(recipientId: string) {
  return discordApiRequest<DiscordDmChannel>("/users/@me/channels", {
    method: "POST",
    body: JSON.stringify({
      recipient_id: recipientId,
    }),
  });
}

export async function sendDiscordChannelMessage(
  channelId: string,
  input: {
    content?: string;
    file?: DiscordUploadFile;
  },
  options?: {
    replyToMessageId?: string;
  },
) {
  const payload = {
    ...(input.content ? { content: input.content } : {}),
    ...(options?.replyToMessageId
      ? {
          message_reference: {
            message_id: options.replyToMessageId,
            fail_if_not_exists: false,
          },
          allowed_mentions: {
            parse: [],
          },
        }
      : {}),
    ...(input.file
      ? {
          attachments: [
            {
              id: 0,
              filename: input.file.fileName,
            },
          ],
        }
      : {}),
  };

  if (!input.file) {
    return discordApiRequest<DiscordMessageResponse>(`/channels/${channelId}/messages`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  const formData = new FormData();
  formData.set("payload_json", JSON.stringify(payload));
  formData.set(
    "files[0]",
    new Blob([new Uint8Array(input.file.data)], {
      type: input.file.contentType,
    }),
    input.file.fileName,
  );

  const { botToken } = getDiscordBotConfig();
  const response = await fetch(`${DISCORD_API_BASE_URL}/channels/${channelId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bot ${botToken}`,
    },
    body: formData,
    cache: "no-store",
  });
  const bodyText = await response.text();

  if (!response.ok) {
    throw buildDiscordApiError(response.status, "Discord API 呼び出しに失敗しました。", bodyText);
  }

  return JSON.parse(bodyText) as DiscordMessageResponse;
}
