// @cliDescription  Generates an entity component, redux, saga, api, listings, styles, and optional tests.

module.exports = async function (context) {
  // grab some features
  const { ignite, parameters, print, prompt, strings } = context
  const { pascalCase, snakeCase, camelCase, isBlank } = strings
  const prompts = require('./entity-prompts')
  const fs = require('fs-extra')
  // const config = ignite.loadIgniteConfig()
  // const { tests } = config

  // flags
  const jhDirectoryFlag = parameters.options['jh-dir'] || ''

  // validation
  if (isBlank(parameters.first)) {
    print.info(`${context.runtime.brand} generate entity <name>\n`)
    print.info('A name is required.')
    return
  }

  // read some configuration
  const name = pascalCase(parameters.first)
  const props = { name }
  const entityFileName = `${name}.json`
  const localEntityFilePath = `.jhipster/${entityFileName}`
  const igniteConfigPath = 'ignite/ignite.json'

  // load the ignite config and set the default jhipster directory
  let igniteConfig = await fs.readJson(igniteConfigPath)
  prompts.entityPrompts[0].default = igniteConfig.jhipsterDirectory

  let fullEntityFilePath
  let jhipsterDirectory

  // if the file exists, skip loading it
  if (fs.existsSync(localEntityFilePath)) {
    print.success(`Found the entity config locally in .jhipster`)
  } else if (jhDirectoryFlag) {
    if (!fs.existsSync(`${jhDirectoryFlag}/${localEntityFilePath}`)) {
      print.error(`No entity configuration file found at ${jhDirectoryFlag}/${localEntityFilePath}`)
      return
    }
    print.success(`Found the entity config at ${jhDirectoryFlag}/${localEntityFilePath}`)
    jhipsterDirectory = jhDirectoryFlag
    fullEntityFilePath = `${jhDirectoryFlag}/.jhipster/${localEntityFilePath}`
  } else {
    // prompt the user until an entity configuration file is found
    while (true) {
      let entityAnswers = await prompt.ask(prompts.entityPrompts)
      // strip the trailing slash from the directory
      jhipsterDirectory = `${entityAnswers.filePath}`.replace(/\/$/, ``)
      fullEntityFilePath = `${jhipsterDirectory}/.jhipster/${entityFileName}`
      print.info(`Looking for ${fullEntityFilePath}`)
      if (fs.existsSync(fullEntityFilePath)) {
        print.success(`Found entity file at ${fullEntityFilePath}`)
        break
      } else {
        print.error(`Could not find entity file, please try again.`)
      }
    }

    if (!fs.existsSync(`.jhipster`)) {
      fs.mkdirSync(`.jhipster`)
    }

    await fs.copy(fullEntityFilePath, localEntityFilePath)
    print.success(`Entity config saved to your app's .jhipster folder.`)

    // save the jhipster app directory to the ignite config as the new jhipsterDirectory default
    igniteConfig.jhipsterDirectory = jhipsterDirectory
    await fs.writeJson(igniteConfigPath, igniteConfig, { spaces: '\t' })
  }

  // load the entity config into memory
  // let entityConfig = await fs.readJson(localEntityFilePath)

  const jhipsterApiFilePath = `${process.cwd()}/App/Services/JhipsterApi.js`
  const reduxIndexFilePath = `${process.cwd()}/App/Redux/index.js`
  const sagaIndexFilePath = `${process.cwd()}/App/Sagas/index.js`

  // REDUX AND SAGA SECTION
  const apiMethods = `
  const update${props.name} = () => api.put('api/${camelCase(props.name)}s')
  const get${props.name}s = () => api.get('api/${camelCase(props.name)}s')
  const get${props.name} = (${camelCase(props.name)}Id) => api.get('api/${camelCase(props.name)}s/' + ${camelCase(props.name)}Id)
  const delete${props.name} = (${camelCase(props.name)}Id) => api.delete('api/${camelCase(props.name)}s/' + ${camelCase(props.name)}Id)`

  const apiMethodsExport = `
    update${props.name},
    get${props.name}s,
    get${props.name},
    delete${props.name},`

  // add methods to api
  ignite.patchInFile(jhipsterApiFilePath, {
    before: 'ignite-jhipster-api-method-needle',
    insert: apiMethods,
    match: apiMethods
  })
  ignite.patchInFile(jhipsterApiFilePath, {
    before: 'ignite-jhipster-api-export-needle',
    insert: apiMethodsExport,
    match: apiMethodsExport
  })

  // import redux in redux/index.js
  ignite.patchInFile(reduxIndexFilePath, {
    before: 'ignite-jhipster-redux-store-import-needle',
    insert: `    ${camelCase(props.name)}s: require('./${props.name}Redux').reducer,`,
    match: `    ${camelCase(props.name)}s: require('./${props.name}Redux').reducer,`
  })

  // import saga/redux in sagas/index.js
  ignite.patchInFile(sagaIndexFilePath, {
    before: 'ignite-jhipster-saga-redux-import-needle',
    insert: `import { ${props.name}Types } from '../Redux/${props.name}Redux'`,
    match: `import { ${props.name}Types } from '../Redux/${props.name}Redux'`
  })
  ignite.patchInFile(sagaIndexFilePath, {
    before: 'ignite-jhipster-saga-method-import-needle',
    insert: `import { get${props.name}, get${props.name}s, update${props.name}, delete${props.name} } from './${props.name}Sagas'`,
    match: `import { get${props.name}, get${props.name}s, update${props.name}, delete${props.name} } from './${props.name}Sagas'`
  })

  const sagaConnections = `
    takeLatest(${props.name}Types.${snakeCase(props.name).toUpperCase()}_REQUEST, get${props.name}, jhipsterApi),
    takeLatest(${props.name}Types.${snakeCase(props.name).toUpperCase()}_ALL_REQUEST, get${props.name}s, jhipsterApi),
    takeLatest(${props.name}Types.${snakeCase(props.name).toUpperCase()}_UPDATE_REQUEST, update${props.name}, jhipsterApi),
    takeLatest(${props.name}Types.${snakeCase(props.name).toUpperCase()}_DELETE_REQUEST, delete${props.name}, jhipsterApi),`

  ignite.patchInFile(sagaIndexFilePath, {
    before: 'ignite-jhipster-saga-redux-connect-needle',
    insert: sagaConnections,
    match: sagaConnections
  })

  const sagaReduxJobs = [
    {
      template: `saga.ejs`,
      target: `App/Sagas/${name}Sagas.js`
    },
    {
      template: `redux.ejs`,
      target: `App/Redux/${name}Redux.js`
    }
  ]

  await ignite.copyBatch(context, sagaReduxJobs, props)

  // generate entity listing component
  // connect entity redux

  // generate entity listing screen
  // connect entity redux

  // generate entity detail component
  // connect entity redux

  // generate entity edit component
  // connect entity redux

  // add listing screen to navigation
  // ignite-jhipster-navigation-import-needle
  // ignite-jhipster-navigation-needle

  // add screen for entities, link to listings page

  // const jobs = [
  // component jobs
  // {
  //     template: 'component.ejs',
  //     target: `App/Components/${name}.js`
  // },
  // {
  //     template: 'component-style.ejs',
  //     target: `App/Components/Styles/${name}Style.js`
  // },
  // screen jobs
  // {
  //     template: `screen.ejs`,
  //     target: `App/Containers/${name}Screen.js`
  // },
  // {
  //     template: `saga.ejs`,
  //     target: `App/Containers/Styles/${name}ScreenStyle.js`
  // },
  //
  // listview jobs
  // {
  //     template: `listview.ejs`,
  //     target: `App/Containers/${name}.js`
  // },
  // {
  //     template: `listview-style.ejs`,
  //     target: `App/Containers/Styles/${name}Style.js`
  // }
  // ]

  // if (tests) {
  //     // component tests
  //     if (tests === 'ava') {
  //         jobs.push({
  //             template: 'component-test.ejs',
  //             target: `Test/Components/${name}Test.js`
  //         })
  //     }
  //     // saga tests
  //     jobs.push({
  //         template: `saga-test-${tests}.ejs`,
  //         target: `Tests/Saga/${name}SagaTest.js`
  //     })
  //     // redux tests
  //     jobs.push({
  //         template: `redux-test-${config.tests}.ejs`,
  //         target: `Tests/Redux/${name}ReduxTest.js`
  //     })
  // }

  // await ignite.copyBatch(context, jobs, props)
}
