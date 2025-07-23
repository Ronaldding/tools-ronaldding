import { Router } from 'itty-router';
import { Env, ChatMessage } from "./types";

// Model ID for Workers AI model
// https://developers.cloudflare.com/workers-ai/models/
const MODEL_ID = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

// Default system prompt
const SYSTEM_PROMPT =
  "You are a helpful, friendly assistant. Provide concise and accurate responses.";

// Create router
const router = Router<Env>();

// Utility: Fetch static HTML from Workers Assets
async function getStaticHtml(path: string, env: Env): Promise<Response> {
  const asset = await env.ASSETS.get(path);
  if (asset) {
    return new Response(await asset.text(), {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }
  return new Response('404 Not Found', { status: 404 });
}

// Static HTML routes
router
  .get('/', async ({ env }) => await getStaticHtml('index.html', env))
  .get('/about', async ({ env }) => await getStaticHtml('about.html', env))
  .get('/user/:id', async ({ env, params }) => {
    const rawHtml = await getStaticHtml('user.html', env);
    if (rawHtml.status === 404) return rawHtml;
    
    const htmlWithId = (await rawHtml.text()).replace('{{userId}}', params.id);
    return new Response(htmlWithId, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  });

// Chat API route
router.post('/api/chat', async ({ request, env }) => {
  try {
    const { messages = [] } = (await request.json()) as {
      messages: ChatMessage[];
    };

    if (!messages.some((msg) => msg.role === "system")) {
      messages.unshift({ role: "system", content: SYSTEM_PROMPT });
    }

    const response = await env.AI.run(
      MODEL_ID,
      {
        messages,
        max_tokens: 1024,
      },
      {
        returnRawResponse: true,
      },
    );

    return response;
  } catch (error) {
    console.error("Error processing chat request:", error);
    return new Response(
      JSON.stringify({ error: "Failed to process request" }),
      {
        status: 500,
        headers: { "content-type": "application/json" },
      },
    );
  }
});

// 404 handler
router.all('*', () => new Response('404 Not Found', { status: 404 }));

// Main worker entry point
export default {
  fetch: (request: Request, env: Env, ctx: ExecutionContext) => {
    return router.handle(request, env, ctx);
  },
} satisfies ExportedHandler<Env>;