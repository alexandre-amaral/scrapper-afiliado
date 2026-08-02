/**
 * Módulo de afiliados: geração de link (camada HTTP) + renovação de sessão
 * (camada Playwright) + persistência criptografada dos cookies do portal.
 */

export { saveSession, loadSession, sessionFilePath, type PortalCookie } from "./session.js";
export {
  SessionExpiredError,
  getSessionStatus,
  generateAffiliateLink,
  generateAffiliateLinks,
  type AffiliateSessionStatus,
} from "./linkbuilder.js";
export {
  canOpenVisibleBrowser,
  INTERACTIVE_UNAVAILABLE_MSG,
  refreshSessionInteractive,
  tryRefreshSessionHeadless,
} from "./portal-login.js";
export {
  parseCookiePaste,
  importAffiliateSession,
  seedPlaywrightProfile,
  type ImportSessionResult,
} from "./cookie-import.js";
