import { defineBuildConfig } from 'unbuild'

export default defineBuildConfig({
  entries: ['src/index', 'src/devtools'],
  declaration: true,
  rollup: {
    emitCJS: false,
  },
})
