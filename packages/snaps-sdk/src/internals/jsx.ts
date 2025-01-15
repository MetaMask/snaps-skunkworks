import type {
  AnyStruct,
  EnumSchema,
  Infer,
  InferStructTuple,
  IsExactMatch,
  IsMatch,
  IsRecord,
  IsTuple,
  Struct,
  UnionToIntersection,
} from '@metamask/superstruct';

import type { EmptyObject } from '../types';
import { union } from './structs';

/**
 * Check if a type is a union. Infers `true` if it is a union, otherwise
 * `false`.
 */
type IsUnion<Type> = [Type] extends [UnionToIntersection<Type>] ? false : true;

/**
 * Get a struct schema for a type.
 *
 * This is copied from `superstruct` but fixes some issues with the original
 * implementation.
 */
type StructSchema<Type> =
  IsUnion<Type> extends true
    ? null
    : [Type] extends [EmptyObject]
      ? EmptyObject
      : [Type] extends [string | undefined | null]
        ? [Type] extends [`0x${string}`]
          ? null
          : [Type] extends [IsMatch<Type, string | undefined | null>]
            ? null
            : [Type] extends [IsUnion<Type>]
              ? EnumSchema<Type>
              : Type
        : [Type] extends [number | undefined | null]
          ? [Type] extends [IsMatch<Type, number | undefined | null>]
            ? null
            : [Type] extends [IsUnion<Type>]
              ? EnumSchema<Type>
              : Type
          : [Type] extends [boolean]
            ? [Type] extends [IsExactMatch<Type, boolean>]
              ? null
              : Type
            : Type extends
                  | bigint
                  | symbol
                  | undefined
                  | null
                  // eslint-disable-next-line @typescript-eslint/ban-types
                  | Function
                  | Date
                  | Error
                  | RegExp
                  | Map<any, any>
                  | WeakMap<any, any>
                  | Set<any>
                  | WeakSet<any>
                  | Promise<any>
              ? null
              : Type extends (infer E)[]
                ? Type extends IsTuple<Type>
                  ? null
                  : Struct<E>
                : Type extends object
                  ? Type extends IsRecord<Type>
                    ? null
                    : {
                        [InnerKey in keyof Type]: Describe<Type[InnerKey]>;
                      }
                  : null;

/**
 * Describe a struct type.
 */
export type Describe<Type> = Struct<Type, StructSchema<Type>>;

/**
 * Create a union struct that uses `null` for the schema type, for better
 * compatibility with `Describe`.
 *
 * @param structs - The structs to union.
 * @returns The `superstruct` struct, which validates that the value satisfies
 * one of the structs.
 */
export function nullUnion<Head extends AnyStruct, Tail extends AnyStruct[]>(
  structs: [head: Head, ...tail: Tail],
): Struct<Infer<Head> | InferStructTuple<Tail>[number], null> {
  return union(structs) as unknown as Struct<
    Infer<Head> | InferStructTuple<Tail>[number],
    null
  >;
}
