import type { Provider } from '@nestjs/common';
import type { AiGateway } from '@family/ai-gateway';
import { createFamilyModelGatewayFromEnv } from '@family/ai-gateway';

export const FAMILY_MODEL_GATEWAY = 'FAMILY_MODEL_GATEWAY' as const;

/**
 * 免费测评智能内核的模型网关注入点。
 * A5 授权门:默认 mock;仅当 env 显式开启 live flag 且 cc-switch 模式配好 provider 时,才构造真实网关。
 * 授权状态从 env 读,业务层仍必须走 consent / human gate;此处不读取或记录任何密钥。
 */
export function createFamilyModelGatewayProvider(env: Record<string, string | undefined> = process.env): AiGateway {
  return createFamilyModelGatewayFromEnv(env, {
    authorization: { liveExternalAiAuthorized: env.FAMILY_MODEL_ALLOW_LIVE_EXTERNAL_AI === 'true' },
  });
}

export const FamilyModelGatewayProvider: Provider = {
  provide: FAMILY_MODEL_GATEWAY,
  useFactory: () => createFamilyModelGatewayProvider(),
};
