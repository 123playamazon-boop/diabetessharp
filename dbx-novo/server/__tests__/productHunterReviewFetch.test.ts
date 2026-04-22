import { describe, expect, it } from "vitest";
import { extractStarRatingFromBlock } from "../productHunterReviewFetch";

describe("productHunterReviewFetch", () => {
  it("extractStarRatingFromBlock lê vários formatos", () => {
    expect(extractStarRatingFromBlock("3.0 out of 5 stars great")).toBe(3);
    expect(extractStarRatingFromBlock("5 stars ok")).toBe(5);
    expect(extractStarRatingFromBlock("no rating here")).toBeNull();
  });
});
