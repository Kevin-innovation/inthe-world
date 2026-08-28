export type AssignmentDraft = {
  id: string;
  guestId: string;
  seasonId: string;
  countryId: string;
  seed: number;
  createdAt: number;
  consumed: boolean;
};

const globalForAssign = globalThis as unknown as {
  __simulAssignments?: Map<string, AssignmentDraft>;
};

function store(): Map<string, AssignmentDraft> {
  if (!globalForAssign.__simulAssignments) {
    globalForAssign.__simulAssignments = new Map();
  }
  return globalForAssign.__simulAssignments;
}

export function createAssignment(
  input: Omit<AssignmentDraft, "consumed">,
): AssignmentDraft {
  const row: AssignmentDraft = { ...input, consumed: false };
  store().set(row.id, row);
  return row;
}

export function getAssignment(id: string): AssignmentDraft | undefined {
  return store().get(id);
}

export function findOpenAssignment(
  guestId: string,
  seasonId: string,
): AssignmentDraft | undefined {
  for (const row of store().values()) {
    if (!row.consumed && row.guestId === guestId && row.seasonId === seasonId) {
      return row;
    }
  }
  return undefined;
}

export function consumeAssignment(
  id: string,
  guestId: string,
): AssignmentDraft | undefined {
  const row = store().get(id);
  if (!row || row.guestId !== guestId || row.consumed) return undefined;
  row.consumed = true;
  return row;
}
