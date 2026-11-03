import { createFileRoute } from '@tanstack/react-router';

type TgUser = { id: number; first_name?: string; is_bot?: boolean };
type Update = {
  message?: { chat?: { id: number; type?: string }; from?: TgUser; text?: string };
  callback_query?: { id: string; from: TgUser; data?: string };
};

// @Doggminerbot chat: /start welcome, /invite, /help and the welcome's buttons.
// Telegram signs every call with the secret set in setWebhook; anything else is rejected.
export const Route = createFileRoute('/api/public/telegram-webhook')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { webhookSecret, sendBotMessage, sendBotPhoto } = await import('@/lib/notify.server');
        const { timingSafeEqual } = await import('node:crypto');
        const { Buffer } = await import('node:buffer');
        const got = Buffer.from(request.headers.get('X-Telegram-Bot-Api-Secret-Token') ?? '');
        const want = Buffer.from(await webhookSecret());
        if (got.length !== want.length || !timingSafeEqual(got, want)) return new Response('Unauthorized', { status: 401 });

        const update = await request.json().catch(() => null) as Update | null;
        const { WELCOME_IMAGE, howMessage, inviteMessage, welcomeMessage } = await import('@/lib/bot-messages');
        const { botApi } = await import('@/lib/telegram.server');

        const cb = update?.callback_query;
        if (cb) {
          await botApi('answerCallbackQuery', { callback_query_id: cb.id }).catch(() => null);
          if (cb.data === 'invite') await sendBotMessage(cb.from.id, inviteMessage(cb.from.id));
          else if (cb.data === 'how') await sendBotMessage(cb.from.id, howMessage());
          return Response.json({ ok: true });
        }

        const msg = update?.message;
        if (!msg?.chat || msg.chat.type !== 'private' || !msg.from || msg.from.is_bot) return Response.json({ ok: true });
        const [command = '', param] = (msg.text ?? '').trim().split(/\s+/);
        const cmd = command.toLowerCase().replace(/@doggminerbot$/, '');
        if (cmd === '/invite') await sendBotMessage(msg.chat.id, inviteMessage(msg.from.id));
        else if (cmd === '/help') await sendBotMessage(msg.chat.id, howMessage());
        else await sendBotPhoto(msg.chat.id, WELCOME_IMAGE, welcomeMessage(msg.from.first_name, cmd === '/start' ? param : null));
        return Response.json({ ok: true });
      },
    },
  },
});
