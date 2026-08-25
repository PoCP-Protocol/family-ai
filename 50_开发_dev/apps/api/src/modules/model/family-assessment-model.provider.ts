import { Inject, Injectable, Optional } from '@nestjs/common';
import type { AiGateway } from '@family/ai-gateway';
import { createFamilyEducationAssessmentModelRuntime } from '@family/family-model';
import type { FamilyAssessmentAiSubsystemOutput, FamilyModelUi02AssessmentResponseSetInput } from '@family/family-model';
import { FAMILY_MODEL_GATEWAY, FAMILY_MODEL_LIVE_GATEWAY_ENABLED } from '../family/family-model-gateway.provider';

@Injectable()
export class FamilyAssessmentModelProvider {
  constructor(
    @Optional() @Inject(FAMILY_MODEL_GATEWAY) private readonly familyModelGateway?: AiGateway,
    @Optional() @Inject(FAMILY_MODEL_LIVE_GATEWAY_ENABLED) private readonly liveGatewayEnabled = false,
  ) {}

  async generateAssessmentSubsystemOutput(input: FamilyModelUi02AssessmentResponseSetInput): Promise<FamilyAssessmentAiSubsystemOutput> {
    if (this.liveGatewayEnabled && this.familyModelGateway) {
      try {
        return await createFamilyEducationAssessmentModelRuntime(this.familyModelGateway).generateUi02AssessmentSubsystemOutput(input, 'DEEP_AI_INTERPRETATION');
      } catch {
        // Gateway output is a draft source. A deterministic fallback preserves the human-gated command path.
      }
    }
    return createFamilyEducationAssessmentModelRuntime().assessUi02ResponseSet(input, 'DEEP_AI_INTERPRETATION');
  }
}