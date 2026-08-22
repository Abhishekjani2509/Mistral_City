import type { RepoFile, Severity } from "../schema.js";

export interface SecurityProbe {
  id: string;
  name: string;
  category: string;
  severity: Extract<Severity, "major" | "critical">;
  indicator: RegExp;
}

export interface SecurityProbeFinding {
  probeId: string;
  name: string;
  category: string;
  severity: SecurityProbe["severity"];
  file: string;
  line: number;
  evidence: string;
}

export interface SecurityProbeReport {
  catalog: "OWASP-WSTG-50/v1";
  source: "https://github.com/OWASP/wstg";
  total: 50;
  detected: number;
  findings: SecurityProbeFinding[];
}

const probe = (id: string, name: string, category: string, severity: SecurityProbe["severity"], indicator: RegExp): SecurityProbe => ({ id, name, category, severity, indicator });

/**
 * Fifty code-review probes selected from OWASP WSTG's configuration,
 * identity, authentication, authorization, session, and input-validation
 * sections. They are static evidence checks, not claims that a live exploit
 * succeeded. Dynamic-only scenarios are represented by explicit insecure
 * configuration or behavior in source.
 */
export const OWASP_WSTG_50: readonly SecurityProbe[] = [
  probe("WSTG-CONF-02", "Application platform misconfiguration", "configuration", "major", /x-powered-by['"]?\s*:\s*['"]enabled/i),
  probe("WSTG-CONF-03", "Sensitive file extension exposure", "configuration", "major", /serveStatic\([^)]*\.env/i),
  probe("WSTG-CONF-04", "Backup file exposure", "configuration", "major", /(?:sendFile|readFile)[^\n]*(?:\.bak|\.old)/i),
  probe("WSTG-CONF-05", "Unprotected administration interface", "configuration", "critical", /app\.(?:get|post)\(['"]\/admin['"][^\n]*noAuth/i),
  probe("WSTG-CONF-06", "Dangerous HTTP methods", "configuration", "major", /methods\s*:\s*\[[^\]]*['"]TRACE['"]/i),
  probe("WSTG-CONF-07", "Missing strict transport enforcement", "configuration", "major", /strictTransportSecurity\s*[:=]\s*false/i),
  probe("WSTG-CONF-09", "Unsafe file permissions", "configuration", "critical", /chmodSync\([^,]+,\s*0o777/i),
  probe("WSTG-CONF-12", "Unsafe content security policy", "configuration", "major", /contentSecurityPolicy[^\n]*unsafe-inline/i),
  probe("WSTG-CONF-14", "Missing security response headers", "configuration", "major", /securityHeaders\s*[:=]\s*false/i),

  probe("WSTG-IDNT-04", "Account enumeration", "identity", "major", /User does not exist/i),
  probe("WSTG-IDNT-05", "Weak username policy", "identity", "major", /MIN_USERNAME_LENGTH\s*=\s*1/i),

  probe("WSTG-ATHN-01", "Credentials sent over an unencrypted channel", "authentication", "critical", /http:\/\/[^\s'"]+\/login/i),
  probe("WSTG-ATHN-02", "Default credentials", "authentication", "critical", /(?:username|user)\s*:\s*['"]admin['"][^\n]*(?:password|pass)\s*:\s*['"]admin['"]/i),
  probe("WSTG-ATHN-03", "Weak login lockout", "authentication", "major", /MAX_LOGIN_ATTEMPTS\s*=\s*Infinity/i),
  probe("WSTG-ATHN-04", "Authentication bypass", "authentication", "critical", /token\s*===\s*['"]debug-bypass['"]/i),
  probe("WSTG-ATHN-05", "Unsafe remember-password behavior", "authentication", "critical", /localStorage\.setItem\(['"]password['"]/i),
  probe("WSTG-ATHN-06", "Authentication response cached", "authentication", "major", /Cache-Control['"],\s*['"]public/i),
  probe("WSTG-ATHN-07", "Weak authentication method", "authentication", "major", /authMethod\s*=\s*['"]basic['"]/i),
  probe("WSTG-ATHN-08", "Weak security-question validation", "authentication", "major", /securityAnswer\s*===\s*['"]blue['"]/i),
  probe("WSTG-ATHN-09", "Predictable password reset token", "authentication", "critical", /resetToken\s*=\s*Math\.random\(\)/i),
  probe("WSTG-ATHN-10", "Weaker alternate authentication channel", "authentication", "critical", /smsAuthChecks\s*=\s*false/i),
  probe("WSTG-ATHN-11", "Multi-factor authentication disabled", "authentication", "major", /mfaRequired\s*=\s*false/i),

  probe("WSTG-ATHZ-01", "Directory traversal", "authorization", "critical", /join\([^\n]*req\.query\.(?:path|file)/i),
  probe("WSTG-ATHZ-02", "Authorization bypass", "authorization", "critical", /req\.query\.admin\s*===\s*['"]true['"]/i),
  probe("WSTG-ATHZ-03", "Privilege escalation", "authorization", "critical", /user\.role\s*=\s*req\.body\.role/i),
  probe("WSTG-ATHZ-04", "Insecure direct object reference", "authorization", "critical", /users\[req\.params\.id\]/i),
  probe("WSTG-ATHZ-05", "Unsafe OAuth redirect", "authorization", "critical", /allowedRedirects\s*=\s*\[['"]\*['"]\]/i),

  probe("WSTG-SESS-01", "Predictable session identifier", "session", "critical", /sessionId\s*=\s*String\(Date\.now\(\)\)/i),
  probe("WSTG-SESS-02", "Insecure cookie attributes", "session", "critical", /secure\s*:\s*false[^\n]*httpOnly\s*:\s*false/i),
  probe("WSTG-SESS-03", "Session fixation", "session", "critical", /sessionId\s*=\s*req\.query\.session/i),
  probe("WSTG-SESS-04", "Session exposed in URL", "session", "major", /redirect\([^\n]*sessionId=/i),
  probe("WSTG-SESS-05", "Cross-site request forgery protection disabled", "session", "critical", /csrfProtection\s*=\s*false/i),
  probe("WSTG-SESS-06", "Unsafe logout behavior", "session", "major", /app\.get\(['"]\/logout['"]/i),
  probe("WSTG-SESS-07", "Missing session timeout", "session", "major", /SESSION_TIMEOUT\s*=\s*Infinity/i),
  probe("WSTG-SESS-08", "Session state confusion", "session", "major", /adminSession\s*=\s*userSession/i),
  probe("WSTG-SESS-09", "Session token stored in browser storage", "session", "critical", /localStorage\.setItem\(['"]sessionToken['"]/i),
  probe("WSTG-SESS-10", "JWT signature verification disabled", "session", "critical", /jwt\.decode\([^)]*verify\s*:\s*false/i),
  probe("WSTG-SESS-11", "Unlimited concurrent sessions", "session", "major", /MAX_CONCURRENT_SESSIONS\s*=\s*Infinity/i),

  probe("WSTG-INPV-01", "Reflected cross-site scripting", "input-validation", "critical", /innerHTML\s*=\s*req\.query/i),
  probe("WSTG-INPV-02", "Stored cross-site scripting", "input-validation", "critical", /storedHtml\.push\(req\.body/i),
  probe("WSTG-INPV-03", "HTTP verb tampering", "input-validation", "major", /methodOverride\(req\.query\._method\)/i),
  probe("WSTG-INPV-04", "HTTP parameter pollution", "input-validation", "major", /Object\.fromEntries\(req\.query\.entries\(\)\)/i),
  probe("WSTG-INPV-05", "SQL injection", "input-validation", "critical", /query\(`[^`]*\$\{req\.(?:query|body|params)/i),
  probe("WSTG-INPV-11", "Code injection", "input-validation", "critical", /eval\(req\.(?:query|body)/i),
  probe("WSTG-INPV-12", "Command injection", "input-validation", "critical", /exec\([^\n]*req\.(?:query|body)/i),
  probe("WSTG-INPV-17", "Host header injection", "input-validation", "critical", /req\.headers\.host[^\n]*(?:redirect|location)/i),
  probe("WSTG-INPV-18", "Server-side template injection", "input-validation", "critical", /compile\(req\.body\.template\)/i),
  probe("WSTG-INPV-19", "Server-side request forgery", "input-validation", "critical", /fetch\(req\.(?:query|body)\.url\)/i),
  probe("WSTG-INPV-20", "Mass assignment", "input-validation", "critical", /Object\.assign\(user,\s*req\.body\)/i),
  probe("WSTG-INPV-22", "Prototype pollution", "input-validation", "critical", /target\[req\.body\.key\]\s*=\s*req\.body\.value/i),
] as const;

export function runSecurityProbeSuite(files: RepoFile[]): SecurityProbeReport {
  const findings: SecurityProbeFinding[] = [];
  for (const item of OWASP_WSTG_50) {
    for (const file of files) {
      const lines = file.content.split(/\r?\n/);
      const index = lines.findIndex((line) => item.indicator.test(line));
      if (index < 0) continue;
      findings.push({ probeId: item.id, name: item.name, category: item.category, severity: item.severity, file: file.path, line: index + 1, evidence: lines[index]!.trim() });
      break;
    }
  }
  return { catalog: "OWASP-WSTG-50/v1", source: "https://github.com/OWASP/wstg", total: 50, detected: findings.length, findings };
}
