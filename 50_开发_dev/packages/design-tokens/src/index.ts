export const familyTokens = {
  color: {
    primary: '#2563EB',
    primaryStrong: '#1D4ED8',
    background: '#F5F8FC',
    surface: '#FFFFFF',
    ink: '#102A43',
    muted: '#627D98',
    green: '#16A34A',
    orange: '#F59E0B',
    violet: '#7C3AED',
    danger: '#DC2626',
  },
  radius: { sm: '10px', md: '18px', lg: '28px', pill: '999px' },
  space: { xs: '6px', sm: '10px', md: '16px', lg: '24px', xl: '32px' },
  shadow: { card: '0 12px 32px rgba(16, 42, 67, .08)' },
  breakpoint: { mobile: '390px', tablet: '1024px', desktop: '1440px' },
} as const;

export const familyTokenCss = `:root{--fai-primary:${familyTokens.color.primary};--fai-primary-strong:${familyTokens.color.primaryStrong};--fai-bg:${familyTokens.color.background};--fai-surface:${familyTokens.color.surface};--fai-ink:${familyTokens.color.ink};--fai-muted:${familyTokens.color.muted};--fai-green:${familyTokens.color.green};--fai-orange:${familyTokens.color.orange};--fai-violet:${familyTokens.color.violet};--fai-danger:${familyTokens.color.danger};--fai-radius-md:${familyTokens.radius.md};--fai-radius-lg:${familyTokens.radius.lg};--fai-shadow-card:${familyTokens.shadow.card}}`;
