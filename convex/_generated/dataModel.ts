/* eslint-disable */
/**
 * Generated data model types.
 *
 * THIS FILE IS A STUB — run `npx convex dev` to generate the real version.
 */

export type Id<T extends string> = string & { __tableName: T };
export type Doc<T extends string> = Record<string, unknown> & {
  _id: Id<T>;
  _creationTime: number;
};
