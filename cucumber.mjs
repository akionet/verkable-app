export default {
  default: {
    paths: ["features/**/*.feature"],
    import: ["features/support/**/*.mjs", "features/steps/**/*.mjs"],
    format: ["progress"],
    publishQuiet: true,
  },
};
