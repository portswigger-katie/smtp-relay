import { SmtpFilter, SmtpFilterConfig } from "../filter";
import { SmtpFlow } from "../flow";
import { SmtpAddress, SmtpSession } from "../server";

export interface WhitelistFilterConfiguration extends SmtpFilterConfig {
  from?: (string | RegExp)[];
  to?: (string | RegExp)[];
  ips?: (string | RegExp)[];
  domains?: (string | RegExp)[];
}

/**
 * Whitelist Ips, domains, senders or recipients
 */
export class WhitelistFilter extends SmtpFilter<WhitelistFilterConfiguration> {
  type: string = "whitelist";

  constructor(flow: SmtpFlow, config: WhitelistFilterConfiguration) {
    super(flow, config);
    // Ensure regexps do not allow any partial match
    ["from", "to", "ips", "domains"]
      .filter(a => config[a])
      .forEach(attr => {
        this.config[attr] = this.config[attr].map(r => this.getRegExp(r));
      });
  }
  /**
   * Filter on sender
   * @param account
   * @returns
   */
  async onMailFrom(account: SmtpAddress) {
    return this.check("from", account.address);
  }

  /**
   * Avoid regexp to have partial match
   * @param reg
   */
  getRegExp(reg: string): RegExp | string {
    if (!reg.startsWith("regexp:")) {
      return reg;
    }
    reg = reg.substr(7);
    if (!reg.startsWith("^")) {
      reg = "^" + reg;
    }
    if (!reg.endsWith("$")) {
      reg += "$";
    }
    return new RegExp(reg);
  }

  /**
   * Check if we have condition on the field and return if the value
   * match any of the regexp configured
   *
   * @param attr
   * @param value
   * @returns
   */
  check(attr: "to" | "from" | "ips" | "domains", value: string) {
    if (this.config[attr]) {
      for (let f of this.config[attr]) {
        if (typeof f === "string") {
          if (f === value) {
            return true;
          }
        } else if (value.match(new RegExp(f))) {
          return true;
        }
      }
      return false;
    }
    return undefined;
  }

  /**
   * Filter on IPS and Domains with a "OR"
   *
   * @param session
   * @returns
   */
  async onConnect(session: SmtpSession) {
    let ip = this.check("ips", session.remoteAddress);
    let domain = this.check("domains", session.clientHostname);
    if (ip === undefined && domain === undefined) {
      return undefined;
    }
    return ip || domain;
  }

  /**
   * Filter on receptient
   * @param account
   * @returns
   */
  async onRcptTo(account: SmtpAddress) {
    return this.check("to", account.address);
  }
}
