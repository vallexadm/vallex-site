export type MemberPermissions = {
  customers: { view: boolean; manage: boolean };
  quotes: { view: boolean; create: boolean; edit: boolean };
  agenda: { view: boolean; updateAssigned: boolean; manage: boolean };
  services: { view: boolean; manage: boolean };
  finance: { view: boolean; manage: boolean };
};

export const defaultMemberPermissions: MemberPermissions = {
  customers: { view: false, manage: false },
  quotes: { view: true, create: true, edit: true },
  agenda: { view: true, updateAssigned: true, manage: false },
  services: { view: false, manage: false },
  finance: { view: false, manage: false },
};

export const ownerPermissions: MemberPermissions = {
  customers: { view: true, manage: true },
  quotes: { view: true, create: true, edit: true },
  agenda: { view: true, updateAssigned: true, manage: true },
  services: { view: true, manage: true },
  finance: { view: true, manage: true },
};

function booleanOr(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

export function normalizeMemberPermissions(value: unknown): MemberPermissions {
  const input = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const customers = input.customers && typeof input.customers === "object" ? input.customers as Record<string, unknown> : {};
  const quotes = input.quotes && typeof input.quotes === "object" ? input.quotes as Record<string, unknown> : {};
  const agenda = input.agenda && typeof input.agenda === "object" ? input.agenda as Record<string, unknown> : {};
  const services = input.services && typeof input.services === "object" ? input.services as Record<string, unknown> : {};
  const finance = input.finance && typeof input.finance === "object" ? input.finance as Record<string, unknown> : {};

  const result: MemberPermissions = {
    customers: {
      view: booleanOr(customers.view, defaultMemberPermissions.customers.view),
      manage: booleanOr(customers.manage, defaultMemberPermissions.customers.manage),
    },
    quotes: {
      view: booleanOr(quotes.view, defaultMemberPermissions.quotes.view),
      create: booleanOr(quotes.create, defaultMemberPermissions.quotes.create),
      edit: booleanOr(quotes.edit, defaultMemberPermissions.quotes.edit),
    },
    agenda: {
      view: booleanOr(agenda.view, defaultMemberPermissions.agenda.view),
      updateAssigned: booleanOr(agenda.updateAssigned, defaultMemberPermissions.agenda.updateAssigned),
      manage: booleanOr(agenda.manage, defaultMemberPermissions.agenda.manage),
    },
    services: {
      view: booleanOr(services.view, defaultMemberPermissions.services.view),
      manage: booleanOr(services.manage, defaultMemberPermissions.services.manage),
    },
    finance: {
      view: booleanOr(finance.view, defaultMemberPermissions.finance.view),
      manage: booleanOr(finance.manage, defaultMemberPermissions.finance.manage),
    },
  };

  // A user who can change data must also be able to open and read that module.
  result.customers.view ||= result.customers.manage;
  result.quotes.view ||= result.quotes.create || result.quotes.edit;
  result.agenda.view ||= result.agenda.updateAssigned || result.agenda.manage;
  result.services.view ||= result.services.manage;
  result.finance.view ||= result.finance.manage;
  return result;
}

export function isValidMemberPermissions(value: unknown): value is MemberPermissions {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const input = value as Record<string, unknown>;
  const expected: Record<string, string[]> = {
    customers: ["view", "manage"],
    quotes: ["view", "create", "edit"],
    agenda: ["view", "updateAssigned", "manage"],
    services: ["view", "manage"],
    finance: ["view", "manage"],
  };
  return Object.entries(expected).every(([module, actions]) => {
    const valueForModule = input[module];
    if (!valueForModule || typeof valueForModule !== "object" || Array.isArray(valueForModule)) return false;
    const actionValues = valueForModule as Record<string, unknown>;
    return actions.every((action) => typeof actionValues[action] === "boolean");
  });
}
