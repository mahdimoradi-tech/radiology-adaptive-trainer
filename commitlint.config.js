export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [
      2,
      'always',
      ['api', 'web', 'engine', 'contracts', 'ml', 'docs', 'ci', 'repo', 'llm'],
    ],
  },
};
