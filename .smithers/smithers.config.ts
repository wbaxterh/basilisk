export const repoCommands = {
  lint: "npm run lint --if-present",
  test: "npm run test --if-present",
  typecheck: "npm run typecheck --if-present",
  build: "npm run build",
  coverage: null,
} as const;

export default { repoCommands };
