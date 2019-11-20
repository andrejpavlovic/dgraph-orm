import { Expose, Transform, Type } from 'class-transformer';

import { MetadataStorage } from '../metadata/storage';
import { PredicateType, PredicateTypeUtils } from '../types/predicate_type';
import { Constructor } from '../utils/class';

/**
 * A decorator to annotate predicates on a DGraph Node class. Only the properties
 * decorated with this decorator will be treated as a node property.
 */
export function Predicate(options: Predicate.IOptions = {}) {
  return function(target: Object, propertyName: string): void {
    const { type, isArray, isNodePredicate } = Private.sanitizePredicateType(options, target, propertyName);
    if (!type) {
      throw new Error(
        `Cannot infer the type for predicate '${propertyName}' on node '${target.constructor.name}'. ` +
          'Please try to explicitly define a type in the predicate options'
      );
    }

    let name = options.name;
    if (!name) {
      name = `${target.constructor.name}.${propertyName}`;
      // When we load data into the class, we will have a new property
      // defined as the auto-generated name, we need to make sure property with predicate
      // decorator returns the correct value.
      Expose({ name, toClassOnly: true })(target, propertyName);
    }

    // Setup class transformer for node type of predicates.
    // This will also be threat as a connection edge when building
    // queries.
    if (isNodePredicate) {
      Type(() => type as Function)(target, propertyName);
      const facet = MetadataStorage.Instance.facets.get((type as Function).name);

      // Here we register a transformer on the predicate decorator.
      // This will allow us to transform child predicates facet values on runtime.
      // TODO: We need to check if we can do this more performant way.
      //  Currently, this is O(N) on each predicate field.
      if (facet) {
        facet.forEach(f => {
          const facetPropertyName = `${name}|${f.args.propertyName}`;
          Transform((value: any[]) => {
            value.forEach(v => {
              v[f.args.propertyName] = v[facetPropertyName];
              delete v[facetPropertyName];
            });

            return value;
          })(target, propertyName);
        });
      }
    }

    MetadataStorage.Instance.addPredicateMetadata({
      type: Private.isPredicateType(type) ? type : 'node',
      name,
      isArray,
      target,
      propertyName
    });
  };
}

export namespace Predicate {
  /**
   * Options for the `Predicate` decorator.
   */
  export interface IOptions {
    /**
     * Dgraph type of the predicate.
     */
    type?: PredicateType | PredicateType[] | Constructor | Constructor[];

    /**
     * Name of the predicate that is created in DGraph. Setting name
     * property lets user to reuse a global predicate between different nodes.
     */
    name?: string;
  }
}

/**
 * Private module statics.
 */
namespace Private {
  export function isPredicateType(value: PredicateType | any): value is PredicateType {
    return Object.values(PredicateType).includes(value);
  }

  /**
   * Find out the type of the predicate based on user defined type or reflected type
   * and create additional metadata to help building correct serialization/deserialization on
   * nodes.
   */
  export function sanitizePredicateType(options: Predicate.IOptions, target: Object, propertyName: string) {
    let type = options.type;
    let isArray = false;
    let isNodePredicate = false;

    if (type && Array.isArray(type)) {
      if (type.length != 1) {
        throw new Error('Type definition array should contain exactly 1 type');
      }

      isArray = true;
      type = type[0];

      if (typeof type === 'function') {
        isNodePredicate = true;
      }
    }

    // If no type, fallback to reflected type.
    type = type || getPropertyPredicateType(target, propertyName);

    return {
      isNodePredicate,
      isArray,
      type
    };
  }

  /**
   * Get reflected type of a predicate property.
   */
  function getPropertyPredicateType(target: Object, propertyName: string) {
    const reflected =
      Reflect && Reflect.getMetadata ? Reflect.getMetadata('design:type', target, propertyName) : undefined;

    return PredicateTypeUtils.convertReflectedToPredicateType(reflected.name.toLowerCase());
  }
}
