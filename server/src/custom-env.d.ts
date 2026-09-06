import type { QueueTask } from "./queue";

declare global {
  interface Env {
    TASK_QUEUE?: Queue<QueueTask>;
    R2_BUCKET?: R2Bucket;
    RIN_QQ_TOKEN?: string;
    RIN_WECHAT_APPID?: string;
    RIN_WECHAT_APPKEY?: string;
  }
}

export {};
