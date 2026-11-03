// Writes and draws a brand-new weekly channel post through Lovable AI (server-only).
import { NoObjectGeneratedError, Output, streamText } from 'ai';
import { z } from 'zod';
import { AI_GATEWAY_URL, AiGatewayError, IMAGE_MODEL, TEXT_MODEL, classifyAiError, createResponsesProvider } from './ai-gateway.server';
import { APP_URL } from './bot-messages';
import { imagePrompt, normalizeAiPost, writerInstructions, writerPrompt, type AiPostDraft, type WriterContext } from './channel-posts';

const draftSchema = z.object({
  angle: z.string(),
  title: z.string(),
  caption: z.string(),
  button_text: z.string(),
  image_headline: z.string(),
  image_subline: z.string(),
  image_scene: z.string(),
});

export async function writeChannelPost(apiKey: string, ctx: WriterContext): Promise<AiPostDraft> {
  try {
    const provider = createResponsesProvider(apiKey);
    const result = streamText({
      model: provider.responses(TEXT_MODEL),
      instructions: writerInstructions(),
      messages: [{ role: 'user', content: writerPrompt(ctx) }],
      output: Output.object({ schema: draftSchema }),
      maxRetries: 0,
      providerOptions: { openai: { store: false, forceReasoning: true, reasoningEffort: 'low', reasoningSummary: 'auto', include: ['reasoning.encrypted_content'] } },
    });
    const draft = normalizeAiPost(await result.output);
    if (draft.caption.length < 120 || !draft.title) throw new AiGatewayError('El texto generado es demasiado corto.', null, true);
    return draft;
  } catch (e) {
    if (NoObjectGeneratedError.isInstance(e)) throw new AiGatewayError('La IA no devolvió un post válido.', null, true);
    throw classifyAiError(e);
  }
}

/** Returns the JPEG bytes of a new cover that keeps the DOGG character from the reference image. */
export async function drawChannelImage(apiKey: string, draft: Pick<AiPostDraft, 'image_headline' | 'image_subline' | 'image_scene'>): Promise<Uint8Array> {
  const ref = await fetch(`${APP_URL}/bot-welcome.jpg`);
  if (!ref.ok) throw new AiGatewayError(`No se pudo leer la imagen de referencia (${ref.status}).`, ref.status, ref.status < 500);
  const form = new FormData();
  form.set('model', IMAGE_MODEL);
  form.set('prompt', imagePrompt(draft));
  form.set('image', new Blob([await ref.arrayBuffer()], { type: 'image/jpeg' }), 'reference.jpg');
  form.set('size', '1536x864');
  form.set('quality', 'medium');
  form.set('output_format', 'jpeg');
  let res: Response;
  try {
    res = await fetch(`${AI_GATEWAY_URL}/images/edits`, { method: 'POST', headers: { Authorization: `Bearer ${apiKey}` }, body: form });
  } catch (e) {
    throw new AiGatewayError(e instanceof Error ? e.message : 'network', null, false);
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new AiGatewayError(`Image ${res.status}: ${body.slice(0, 300)}`, res.status, !(res.status === 429 || res.status >= 500));
  }
  const json = await res.json() as { data?: { b64_json?: string }[] };
  const b64 = json.data?.[0]?.b64_json;
  if (!b64) throw new AiGatewayError('La IA no devolvió ninguna imagen.', null, true);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
