import { bestPhone, isEmail, telHref } from "@/lib/format";
import type { Agent } from "@/lib/types";
import { IPhone } from "./icons";

type Contact = Pick<Agent, "name" | "phone" | "mobile" | "email">;

/** Call, Text and Email buttons for an agent. Call opens the phone's dialler; it's only shown if there is a number to dial. */
export function AgentContactButtons({ agent, showNumber = false, firstName = false }: { agent: Contact; showNumber?: boolean; firstName?: boolean }) {
  const number = bestPhone(agent);
  const tel = telHref(number);
  const email = agent.email && isEmail(agent.email) ? agent.email.trim() : null;
  if (!tel && !email) return null;
  const who = firstName ? ` ${agent.name.split(" ")[0]}` : "";
  return (
    <>
      {tel && <a className="btn" href={`tel:${tel}`} aria-label={`Call ${agent.name} on ${number}`}><IPhone />Call{who}{showNumber ? ` ${number}` : ""}</a>}
      {tel && <a className="btn" href={`sms:${tel}`} aria-label={`Text ${agent.name}`}>Text</a>}
      {email && <a className="btn" href={`mailto:${email}`} aria-label={`Email ${agent.name} at ${email}`}>Email</a>}
    </>
  );
}

/** The numbers and address written out, so they can be read, copied or read aloud. */
export function AgentDetails({ agent }: { agent: Contact }) {
  const rows: Array<[string, string, string | null]> = [
    ["Mobile", agent.mobile ?? "", telHref(agent.mobile) ? `tel:${telHref(agent.mobile)}` : null],
    ["Phone", agent.phone ?? "", telHref(agent.phone) ? `tel:${telHref(agent.phone)}` : null],
    ["Email", agent.email ?? "", isEmail(agent.email) ? `mailto:${agent.email!.trim()}` : null],
  ];
  const shown = rows.filter(([, v]) => v.trim());
  if (!shown.length) return <p className="m-0 text-sm text-muted">No phone number or email saved yet.</p>;
  return (
    <dl className="m-0 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 text-sm">
      {shown.map(([k, v, href]) => (
        <div key={k} className="contents"><dt className="text-muted">{k}</dt><dd className="m-0 break-words">{href ? <a href={href}>{v}</a> : v}</dd></div>
      ))}
    </dl>
  );
}
