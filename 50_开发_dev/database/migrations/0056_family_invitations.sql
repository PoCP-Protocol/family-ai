-- Growth-loop referral: a family invites another family. This table only records the
-- attribution relationship (who invited whom, via which code, in what state) — it never
-- grants any reward, discount, or entitlement. Reward eligibility/fulfillment is a
-- separate, deliberately unbuilt decision (business-terms confirmation required first).
-- Not part of test_experience_operations (DEV/TEST-only synthetic fixture sandbox) — this
-- is the production-shaped table for a real referral relationship.

CREATE TABLE IF NOT EXISTS family_invitations (
  invitation_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES families(family_id),
  inviter_person_id uuid NOT NULL REFERENCES persons(person_id),
  -- Short, shareable code — not the invitation_id itself. Uppercase alnum, fixed length,
  -- avoids ambiguous characters (0/O, 1/I/L) at the application layer.
  invitation_code varchar(16) NOT NULL,
  campaign_ref varchar(80) NOT NULL DEFAULT 'FAMILY_REFERRAL_DEFAULT',
  channel varchar(40) NULL,
  status varchar(16) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACCEPTED', 'EXPIRED')),
  accepted_by_family_id uuid NULL REFERENCES families(family_id),
  accepted_at timestamptz NULL,
  expires_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT family_invitation_accept_consistency CHECK (
    (status = 'ACCEPTED' AND accepted_by_family_id IS NOT NULL AND accepted_at IS NOT NULL)
    OR (status <> 'ACCEPTED' AND accepted_by_family_id IS NULL AND accepted_at IS NULL)
  ),
  -- A family cannot accept its own invitation.
  CONSTRAINT family_invitation_no_self_accept CHECK (accepted_by_family_id IS NULL OR accepted_by_family_id <> family_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_family_invitations_code ON family_invitations(invitation_code);
CREATE INDEX IF NOT EXISTS idx_family_invitations_family ON family_invitations(family_id, created_at);
-- A code can only ever be accepted once — enforced at the DB level, not just in service code.
CREATE UNIQUE INDEX IF NOT EXISTS uq_family_invitations_accepted_by ON family_invitations(accepted_by_family_id) WHERE accepted_by_family_id IS NOT NULL;

COMMENT ON TABLE family_invitations IS 'Referral attribution only; no reward, discount, or entitlement is granted by this table.';
