import { describe, expect, it } from 'vitest';
import { FakeAiGateway, OpenAICompatibleAiGateway } from '@family/ai-gateway';
import { createFamilyModelGatewayProvider, isFamilyModelLiveGatewayEnabled } from './family-model-gateway.provider';

describe('FamilyModelGatewayProvider', () => {
  it('defaults to FakeAiGateway when live mode is not explicitly enabled', () => {
    const gateway = createFamilyModelGatewayProvider({ FAMILY_MODEL_GATEWAY_MODE: 'cc-switch' });

    expect(gateway).toBeInstanceOf(FakeAiGateway);
    expect(isFamilyModelLiveGatewayEnabled({ FAMILY_MODEL_GATEWAY_MODE: 'cc-switch' })).toBe(false);
  });

  it('creates the live gateway only after cc-switch mode and live authorization are explicit', () => {
    const env = {
      FAMILY_MODEL_GATEWAY_MODE: 'cc-switch',
      FAMILY_MODEL_ALLOW_LIVE_EXTERNAL_AI: 'true',
      FAMILY_MODEL_CC_SWITCH_BASE_URL: 'http://127.0.0.1:15722/v1',
      FAMILY_MODEL_CC_SWITCH_API_KEY: 'local-secret',
      FAMILY_MODEL_CC_SWITCH_MODEL: 'routed-model',
    };

    expect(isFamilyModelLiveGatewayEnabled(env)).toBe(true);
    expect(createFamilyModelGatewayProvider(env)).toBeInstanceOf(OpenAICompatibleAiGateway);
  });
});
