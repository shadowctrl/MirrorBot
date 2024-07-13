import path from "path";
import { promises as fs } from "fs";

const channelDataPath = path.join(process.cwd(), "src/lib/formData.json");
const helperPath = path.join(process.cwd(), "src/lib/telegramHelper.json");
const apiUrl = `https://api.telegram.org/bot${process.env.Telegram_Token}`;
const body = { allowed_updates: ["edited_message", "channel_post"] };

interface HelperData {
  update_id: number;
}

//Updates ID In Helper JSON
const updateId = async () => {
  const response = await fetch(apiUrl + "/getUpdates", {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
    },
  });
  const data = await response.json();
  const messageLength: number = data.result.length;
  if (messageLength == 0) return;

  const chatId = data.result[messageLength - 1].update_id;
  await fs.writeFile(
    helperPath,
    JSON.stringify({ update_id: chatId }, null, 2),
    "utf-8"
  );
  return updateId;
};

//Fetch For New Chats
const getUpdates = async () => {
  var helperDataString = await fs.readFile(helperPath, "utf-8");
  const helperData: HelperData = JSON.parse(helperDataString);

  const offsetBody = {
    ...body,
    offset: helperData.update_id + 1,
  };

  const respone = await fetch(apiUrl + "/getUpdates", {
    method: "POST",
    body: JSON.stringify(offsetBody),
    headers: {
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  const feeds = await respone.json();

  const messageLength: number = feeds.result.length;
  if (messageLength <= 0) return;

  var channelData = await fs.readFile(channelDataPath, "utf8");
  const { telegramId }: { telegramId: string } = JSON.parse(channelData);

  for (let i = 0; i < messageLength; i++) {
    if (feeds.result[i].channel_post.chat.id == telegramId)
      await fetch(`${process.env.NEXT_PUBLIC_Base_Url}/api/discord`, {
        method: "POST",
        body: JSON.stringify(feeds.result[i].channel_post.text),
      });
  }
  await updateId();
};

let intervalId: NodeJS.Timeout;

const Listen = async (value: Boolean) => {
  if (value) {
    try {
      await fs.access(helperPath);
      intervalId = setInterval(getUpdates, 3000);
      // await getUpdates();
    } catch (error) {
      await updateId();
    }
  } else clearInterval(intervalId);
};

export const POST = async (request: Request) => {
  const { value }: { value: Boolean } = await request.json();
  Listen(value);

  return new Response("Telegram Bot Running", { status: 200 });
};