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

const guestLocks = new Map<string, Promise<unknown>>();

export function withGuestLock<T>(guestId: string, fn: () => T): Promise<T> {
  const prev = guestLocks.get(guestId) ?? Promise.resolve();
  const run = prev.then(fn, fn);
  guestLocks.set(
    guestId,
    run.then(
      () => undefined,
      () => undefined,
    ),
  );
  return run;
}

export function createAssignment(
  input: Omit<AssignmentDraft, "consumed">,
): AssignmentDraft {
  // One open draft per guest+season; a second tab must reuse, not mint another country.
  if (findOpenAssignment(input.guestId, input.seasonId)) {
    throw new Error("open_assignment");
  }
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
