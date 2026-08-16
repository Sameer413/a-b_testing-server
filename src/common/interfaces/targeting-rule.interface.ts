/**
 * A single condition that must be met.
 * Multiple conditions within a RuleGroup are ANDed together.
 */
export interface TargetingCondition {
    /** The user attribute to evaluate.
     *  e.g. 'country', 'role', 'email', 'userId', 'signupDate', 'plan' */
    attribute: string;

    /** Comparison operator */
    operator:
        | 'in'           // attribute value is in the values array
        | 'not_in'       // attribute value is NOT in the values array
        | 'equals'       // exact match
        | 'not_equals'   // not equal
        | 'contains'     // string contains
        | 'starts_with'  // string starts with
        | 'ends_with'    // string ends with
        | 'gte'          // >= (numeric/date)
        | 'lte'          // <= (numeric/date)
        | 'gt'           // >  (numeric/date)
        | 'lt'           // <  (numeric/date)
        | 'exists'       // attribute is present
        | 'not_exists';  // attribute is not present

    /** Values to compare against */
    values: (string | number | boolean)[];
}

/**
 * A group of conditions ANDed together.
 * Multiple RuleGroups are ORed — if ANY group matches, the user qualifies.
 */
export interface TargetingRuleGroup {
    conditions: TargetingCondition[];
}

/**
 * Top-level targeting configuration.
 */
export interface TargetingRules {
    /** OR groups — user matches if ANY group's conditions are ALL true */
    groups: TargetingRuleGroup[];
}
