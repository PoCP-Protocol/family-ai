import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { OrchestrationRepository } from './orchestration.repository';

export interface FamilyInvitationDto {
  invitation_id: string;
  invitation_code: string;
  campaign_ref: string;
  channel: string | null;
  status: 'PENDING' | 'ACCEPTED' | 'EXPIRED';
  accepted_by_family_id: string | null;
  accepted_at: string | null;
  created_at: string;
}

const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // Excludes 0/O/1/I/L to avoid ambiguity when read aloud or hand-copied.

function generateInvitationCode(): string {
  let code = '';
  for (let i = 0; i < 8; i += 1) code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  return code;
}

/**
 * Growth-loop referral — family-to-family attribution only.
 *
 * This service deliberately does not touch reward eligibility, coupons, discounts, or
 * any commerce entitlement. acceptInvitation only records "family A referred family B";
 * whether that earns anything is a separate, unbuilt decision pending business-terms
 * confirmation (see plan Context). Do not wire this to family-commerce-intent.service.ts
 * or any entitlement-granting path without that confirmation first.
 *
 * Not the same table as test_experience_operations' DEV/TEST-only synthetic
 * 'COMMERCE_INVITE' fixture — that one is sandboxed and explicitly produces zero external
 * effect by design; this is the production-shaped referral relationship.
 */
@Injectable()
export class FamilyInvitationService {
  constructor(@Inject(OrchestrationRepository) private readonly repo: OrchestrationRepository) {}

  async createInvitation(familyId: string, inviterPersonId: string, campaignRef: string | null, channel: string | null): Promise<FamilyInvitationDto> {
    const own = await this.repo.query<{ person_id: string }>(`select person_id from persons where person_id=$1 and family_id=$2`, [inviterPersonId, familyId]);
    if (!own.rowCount) throw new ForbiddenException('inviter_not_in_family');

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const code = generateInvitationCode();
      try {
        const row = await this.repo.query<FamilyInvitationDto>(
          `insert into family_invitations(family_id, inviter_person_id, invitation_code, campaign_ref, channel)
           values ($1,$2,$3,$4,$5)
           returning invitation_id, invitation_code, campaign_ref, channel, status, accepted_by_family_id, accepted_at, created_at`,
          [familyId, inviterPersonId, code, campaignRef?.trim() || 'FAMILY_REFERRAL_DEFAULT', channel?.trim() || null],
        );
        return row.rows[0];
      } catch (err) {
        // uq_family_invitations_code collision — regenerate and retry. A handful of
        // attempts is enough given the 32^8 code space; anything beyond that points to a
        // real problem, not bad luck.
        const isUniqueViolation = (err as { code?: string })?.code === '23505';
        if (!isUniqueViolation) throw err;
      }
    }
    throw new ConflictException('invitation_code_generation_exhausted');
  }

  async listMyInvitations(familyId: string): Promise<FamilyInvitationDto[]> {
    const rows = await this.repo.query<FamilyInvitationDto>(
      `select invitation_id, invitation_code, campaign_ref, channel, status, accepted_by_family_id, accepted_at, created_at
         from family_invitations where family_id=$1 order by created_at desc`,
      [familyId],
    );
    return rows.rows;
  }

  /**
   * Called after a new family has been created, with the code the new family typed in
   * during onboarding (if any). Records attribution only — see class-level note. Fails
   * closed (silently, via BadRequestException the caller can choose to ignore) rather than
   * blocking family creation itself; onboarding should not be able to fail because of a
   * typo'd referral code.
   */
  async acceptInvitation(acceptingFamilyId: string, invitationCode: string): Promise<{ invitation_id: string; inviting_family_id: string }> {
    const code = invitationCode.trim().toUpperCase();
    if (!code) throw new BadRequestException('invitation_code_required');
    const row = await this.repo.query<{ invitation_id: string; family_id: string }>(
      `update family_invitations
          set status='ACCEPTED', accepted_by_family_id=$2, accepted_at=now()
        where invitation_code=$1 and status='PENDING' and family_id <> $2
          and (expires_at is null or expires_at > now())
        returning invitation_id, family_id`,
      [code, acceptingFamilyId],
    );
    if (!row.rows[0]) throw new BadRequestException('invitation_code_invalid_or_already_used');
    return { invitation_id: row.rows[0].invitation_id, inviting_family_id: row.rows[0].family_id };
  }
}
