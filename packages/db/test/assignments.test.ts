import { describe, expect, it } from "vitest";
import {
  consumeAssignment,
  createAssignment,
  findOpenAssignment,
  getAssignment,
} from "../src/index";

describe("assignment drafts", () => {
  it("reuses an open draft and consumes it once", () => {
    const guestId = "11111111-1111-4111-8111-111111111111";
    const created = createAssignment({
      id: "assign-1",
      guestId,
      seasonId: "the_coming_storm",
      countryId: "ETH",
      seed: 9,
      createdAt: 1,
    });
    expect(getAssignment(created.id)?.countryId).toBe("ETH");
    expect(findOpenAssignment(guestId, "the_coming_storm")?.id).toBe(created.id);

    expect(() =>
      createAssignment({
        id: "assign-1-dup",
        guestId,
        seasonId: "the_coming_storm",
        countryId: "USA",
        seed: 10,
        createdAt: 2,
      }),
    ).toThrow(/open_assignment/);
    expect(findOpenAssignment(guestId, "the_coming_storm")?.id).toBe(created.id);

    const first = consumeAssignment(created.id, guestId);
    expect(first?.consumed).toBe(true);
    expect(consumeAssignment(created.id, guestId)).toBeUndefined();
    expect(findOpenAssignment(guestId, "the_coming_storm")).toBeUndefined();
  });
});
