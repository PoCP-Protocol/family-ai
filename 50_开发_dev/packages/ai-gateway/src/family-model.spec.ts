import { describe, expect, it } from 'vitest';
import {
  AiGatewayError,
  FAMILY_MODEL_CC_SWITCH_PROVIDER_ID,
  FAMILY_MODEL_CODEX_CC_SWITCH_PROVIDER_ID,
  FakeAiGateway,
  OpenAICompatibleAiGateway,
  createFamilyModelGatewayFromEnv,
  type JsonFetch,
} from './index';

describe('createFamilyModelGatewayFromEnv', () => {
  it('defaults to FakeAiGateway and never requires external config', () => {
    const gateway = createFamilyModelGatewayFromEnv({});
    expect(gateway).toBeInstanceOf(FakeAiGateway);
  });

  it('rejects unsupported modes before any provider setup', () => {
    expect(() => createFamilyModelGatewayFromEnv({ FAMILY_MODEL_GATEWAY_MODE: 'direct-openai' })).toThrow(AiGatewayError);
  });

  it('fails closed when cc-switch mode is set but live flag is disabled', () => {
    expect(() => createFamilyModelGatewayFromEnv({
      FAMILY_MODEL_GATEWAY_MODE: 'cc-switch',
      FAMILY_MODEL_ALLOW_LIVE_EXTERNAL_AI: 'false',
    })).toThrowError(/FAMILY_MODEL_ALLOW_LIVE_EXTERNAL_AI/);
  });

  it('fails closed when current sprint authorization is not passed by the caller', () => {
    expect(() => createFamilyModelGatewayFromEnv({
      FAMILY_MODEL_GATEWAY_MODE: 'cc-switch',
      FAMILY_MODEL_ALLOW_LIVE_EXTERNAL_AI: 'true',
      FAMILY_MODEL_CC_SWITCH_BASE_URL: 'http://127.0.0.1:15722/v1',
      FAMILY_MODEL_CC_SWITCH_API_KEY: 'local-secret',
      FAMILY_MODEL_CC_SWITCH_MODEL: 'routed-model',
    })).toThrowError(/current authorization/);
  });

  it('fails closed when provider policy does not approve cc switch', () => {
    expect(() => createFamilyModelGatewayFromEnv({
      FAMILY_MODEL_GATEWAY_MODE: 'cc-switch',
      FAMILY_MODEL_ALLOW_LIVE_EXTERNAL_AI: 'true',
      FAMILY_MODEL_CC_SWITCH_BASE_URL: 'http://127.0.0.1:15722/v1',
      FAMILY_MODEL_CC_SWITCH_API_KEY: 'local-secret',
      FAMILY_MODEL_CC_SWITCH_MODEL: 'routed-model',
    }, {
      authorization: { liveExternalAiAuthorized: true, approvedProviderIds: ['other-provider'] },
    })).toThrowError(FAMILY_MODEL_CC_SWITCH_PROVIDER_ID);
  });

  it('builds OpenAI-compatible cc switch gateway only after explicit env and authorization gates', async () => {
    let called = false;
    const httpFetch: JsonFetch = async (url, init) => {
      called = true;
      expect(url).toBe('http://127.0.0.1:15722/v1/chat/completions');
      expect(init.headers.authorization).toBe('Bearer local-secret');
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({ model: 'routed-model', choices: [{ message: { content: '{"ok":true}' } }] }),
      };
    };

    const gateway = createFamilyModelGatewayFromEnv({
      FAMILY_MODEL_GATEWAY_MODE: 'cc-switch',
      FAMILY_MODEL_ALLOW_LIVE_EXTERNAL_AI: 'true',
      FAMILY_MODEL_CC_SWITCH_BASE_URL: 'http://127.0.0.1:15722/v1',
      FAMILY_MODEL_CC_SWITCH_API_KEY: 'local-secret',
      FAMILY_MODEL_CC_SWITCH_MODEL: 'routed-model',
    }, {
      authorization: { liveExternalAiAuthorized: true, approvedProviderIds: [FAMILY_MODEL_CC_SWITCH_PROVIDER_ID] },
      httpFetch,
    });

    expect(gateway).toBeInstanceOf(OpenAICompatibleAiGateway);
    const result = await gateway.generateStructured({
      use_case: 'family_model_config_test',
      prompt_version: 'p1',
      schema_version: 's1',
      input: { q: 'hello' },
      output_schema: {},
      input_refs: [],
      policy_context: { human_confirmation_required: true, may_mutate_business_state: false },
    });
    expect(result.output).toEqual({ ok: true });
    expect(called).toBe(true);
  });

  it('treats Codex cc switch API as a first-class approved provider', async () => {
    let called = false;
    const httpFetch: JsonFetch = async (url, init) => {
      called = true;
      expect(url).toBe('http://127.0.0.1:19999/v1/chat/completions');
      expect(init.headers.authorization).toBe('Bearer codex-local-secret');
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({ model: 'codex-routed-model', choices: [{ message: { content: '{"codex":true}' } }] }),
      };
    };

    expect(() => createFamilyModelGatewayFromEnv({
      FAMILY_MODEL_GATEWAY_MODE: 'cc-switch',
      FAMILY_MODEL_ALLOW_LIVE_EXTERNAL_AI: 'true',
      FAMILY_MODEL_CC_SWITCH_API_KIND: 'codex',
      FAMILY_MODEL_CODEX_BASE_URL: 'http://127.0.0.1:19999/v1',
      FAMILY_MODEL_CODEX_API_KEY: 'codex-local-secret',
      FAMILY_MODEL_CODEX_MODEL: 'codex-routed-model',
    }, {
      authorization: { liveExternalAiAuthorized: true, approvedProviderIds: [FAMILY_MODEL_CC_SWITCH_PROVIDER_ID] },
      httpFetch,
    })).toThrowError(FAMILY_MODEL_CODEX_CC_SWITCH_PROVIDER_ID);

    const gateway = createFamilyModelGatewayFromEnv({
      FAMILY_MODEL_GATEWAY_MODE: 'cc-switch',
      FAMILY_MODEL_ALLOW_LIVE_EXTERNAL_AI: 'true',
      FAMILY_MODEL_CC_SWITCH_API_KIND: 'codex',
      FAMILY_MODEL_CODEX_BASE_URL: 'http://127.0.0.1:19999/v1',
      FAMILY_MODEL_CODEX_API_KEY: 'codex-local-secret',
      FAMILY_MODEL_CODEX_MODEL: 'codex-routed-model',
    }, {
      authorization: { liveExternalAiAuthorized: true, approvedProviderIds: [FAMILY_MODEL_CODEX_CC_SWITCH_PROVIDER_ID] },
      httpFetch,
    });

    const result = await gateway.generateStructured({
      use_case: 'family_model_codex_config_test',
      prompt_version: 'p1',
      schema_version: 's1',
      input: { q: 'hello codex' },
      output_schema: {},
      input_refs: [],
      policy_context: { human_confirmation_required: true, may_mutate_business_state: false },
    });
    expect(result.output).toEqual({ codex: true });
    expect(called).toBe(true);
  });
});