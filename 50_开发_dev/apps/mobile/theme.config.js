/** @type {const} */
// 色系与 App 附件一致：蓝色主调 + 干净浅灰白底 + 多彩功能强调色。App 与 Web 共用此令牌，改此处两端同步。
const themeColors = {
  primary: { light: '#3B82F6', dark: '#60A5FA' },
  background: { light: '#F5F7FA', dark: '#0F1620' },
  surface: { light: '#FFFFFF', dark: '#1A2330' },
  foreground: { light: '#1F2A44', dark: '#E8EDF5' },
  muted: { light: '#7B8AA3', dark: '#9DAAC0' },
  border: { light: '#E4E9F2', dark: '#2A3646' },
  success: { light: '#36A866', dark: '#5FCB8C' },
  warning: { light: '#F59D34', dark: '#FBB765' },
  error: { light: '#E5544B', dark: '#F58A82' },
};

module.exports = { themeColors };
