/* eslint-disable */
/**
 * Hand-written Convex API types (stand-in until `npx convex dev` codegen).
 */
import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import type * as assignments from "../assignments.js";
import type * as catchup from "../catchup.js";
import type * as guests from "../guests.js";
import type * as saves from "../saves.js";

declare const fullApi: ApiFromModules<{
  assignments: typeof assignments;
  catchup: typeof catchup;
  guests: typeof guests;
  saves: typeof saves;
}>;

export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;
