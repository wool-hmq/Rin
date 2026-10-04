import { handleFetch } from "./runtime/fetch-handler";
import { handleQueue } from "./runtime/queue-handler";
import { handleScheduled } from "./runtime/scheduled-handler";
import { handleEmail } from "./runtime/email-handler";

export default {
    async fetch(
        request: Request,
        env: Env,
    ): Promise<Response> {
        return handleFetch(request, env);
    },

    async scheduled(
        _controller: ScheduledController | null,
        env: Env,
        ctx: ExecutionContext
    ) {
        return handleScheduled(_controller, env, ctx);
    },

    async queue(
        batch: MessageBatch<unknown>,
        env: Env,
        ctx: ExecutionContext,
    ) {
        return handleQueue(batch, env, ctx);
    },

    async email(
        message: ForwardableEmailMessage,
        env: Env,
        ctx: ExecutionContext,
    ): Promise<void> {
        return handleEmail(message, env, ctx);
    },
}
