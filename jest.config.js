module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': ['ts-jest', {
      useESM: false,
      tsconfig: {
        esModuleInterop: true,
        module: 'commonjs',
        moduleResolution: 'node',
        resolvePackageJsonExports: false,
        allowSyntheticDefaultImports: true,
      },
    }],
  },
  collectCoverageFrom: ['**/*.(t|j)s'],
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^src/(.*)$': '<rootDir>/$1',
    '^(.+)\\.js$': '$1',
  },
};
