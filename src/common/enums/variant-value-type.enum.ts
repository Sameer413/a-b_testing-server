export enum VariantValueType {
    /**
     * Plain string value (default). No coercion needed on the client.
     * Example: "blue", "control"
     */
    STRING = 'string',

    /**
     * Numeric value stored as a string in the DB.
     * SDK must parse via Number(value) or parseFloat(value).
     * Example: "1.5", "42"
     */
    NUMBER = 'number',

    /**
     * Boolean value stored as "true" / "false" in the DB.
     * SDK must parse via value === 'true'.
     */
    BOOLEAN = 'boolean',

    /**
     * JSON payload stored as a serialized string in the DB.
     * SDK must parse via JSON.parse(value).
     * Example: '{"theme":"dark","fontSize":14}'
     */
    JSON = 'json',
}
