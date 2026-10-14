// Code style enforcement for an ESLint flat config in a TypeScript project. Copy it next to the
// project's config, spread `codeStyleConfigs` after the project's own entries, and keep only the
// rules the project adopted. Needs `typescript-eslint` with type information for the boolean rule.

// Module-level constants set from a literal or literal arithmetic are UPPER_SNAKE_CASE. Values
// computed at runtime and framework-required export names keep camelCase.
export const constantNaming = {
    selector: [
        ":matches(Program, Program > ExportNamedDeclaration) > VariableDeclaration[kind='const']",
        "> VariableDeclarator[id.type='Identifier']",
        ':matches([init.type=/^(Literal|TemplateLiteral)$/],',
        " [init.type='BinaryExpression']:not(:has(CallExpression, MemberExpression)))",
        // A boolean constant follows the boolean naming rule instead (`isEnabled`).
        ":not([init.raw=/^(true|false)$/])",
        ':not([id.name=/^[A-Z][A-Z0-9_]*$/])',
    ].join(''),
    message: 'Name a module-level literal constant in UPPER_SNAKE_CASE.',
};

// A number inside logic gets a name. Constant initializers may hold numbers, so arithmetic and
// schema limits stay readable; 0, 1, 2, defaults, enum members, literal types, and computed
// indexes are exempt.
const NUMBER_LITERAL = 'Literal[raw=/^[0-9]/]:not([raw=/^[0-2]$/])';
const EXEMPT_NUMBER = [
    ':not(AssignmentPattern > Literal.right)',
    ':not(MemberExpression[computed=true] > Literal.property)',
    ':not(TSLiteralType Literal)',
    ':not(TSEnumMember Literal)',
].join('');
const MAGIC_NUMBER_MESSAGE = 'Name this number as a module-level UPPER_SNAKE_CASE constant.';
export const magicNumbers = [
    { selector: `:function ${NUMBER_LITERAL}${EXEMPT_NUMBER}`, message: MAGIC_NUMBER_MESSAGE },
    {
        selector: [
            NUMBER_LITERAL,
            EXEMPT_NUMBER,
            ':not(:function Literal)',
            ':not(Program > VariableDeclaration Literal)',
            ':not(Program > ExportNamedDeclaration > VariableDeclaration Literal)',
            ':not(PropertyDefinition > Literal.value)',
        ].join(''),
        message: MAGIC_NUMBER_MESSAGE,
    },
];

// A component's own event handler is handleX; a forwarded prop is onX and a state setter is setX.
export const handlerNaming = {
    selector:
        'JSXAttribute[name.name=/^on[A-Z]/] > JSXExpressionContainer > Identifier[name!=/^(handle|on|set)[A-Z]/]',
    message: 'Name an event handler handleX (or pass an onX prop or setX setter).',
};

/**
 * The `no-restricted-syntax` entry for one group of files. A flat config that restates the rule
 * replaces it entirely, so build every group's list here instead of copying selectors.
 */
export function restrictedSyntax({ withNumbers = false, withHandlers = false } = {}) {
    return [
        'error',
        constantNaming,
        ...(withNumbers ? magicNumbers : []),
        ...(withHandlers ? [handlerNaming] : []),
    ];
}

const BOOLEAN_PREFIXES = ['is', 'are', 'has', 'can', 'should', 'was', 'did', 'will', 'with'];

export const codeStyleConfigs = [
    {
        files: ['**/*.{js,mjs,ts,tsx}'],
        rules: {
            eqeqeq: ['error', 'always'],
            'no-else-return': ['error', { allowElseIf: false }],
            'object-shorthand': ['error', 'always'],
            'prefer-template': 'error',
            'max-params': ['error', 4],
            'max-lines': ['error', { max: 300, skipBlankLines: true, skipComments: true }],
            'id-length': ['error', { min: 2, exceptions: ['_', 'a', 'b', 'i'], properties: 'never' }],
        },
    },
    {
        files: ['**/*.{ts,tsx}'],
        rules: {
            '@typescript-eslint/naming-convention': [
                'error',
                {
                    selector: ['variable', 'parameter'],
                    types: ['boolean'],
                    format: ['PascalCase'],
                    prefix: BOOLEAN_PREFIXES,
                },
                // Destructured names come from object properties and props, which keep their names.
                {
                    selector: ['variable', 'parameter'],
                    modifiers: ['destructured'],
                    types: ['boolean'],
                    format: null,
                },
            ],
            'no-restricted-syntax': restrictedSyntax({ withNumbers: true, withHandlers: true }),
        },
    },
    {
        // Tests keep literal expectations.
        files: ['**/__tests__/**', '**/*.{spec,test}.{ts,tsx}', 'tests/**', '**/*.config.*'],
        rules: { 'no-restricted-syntax': restrictedSyntax({ withHandlers: true }) },
    },
];
