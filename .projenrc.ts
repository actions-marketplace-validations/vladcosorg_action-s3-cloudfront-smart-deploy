import { GithubAction, RunsUsing } from '@vladcos/projen-base'
import { JobPermission } from 'projen/lib/github/workflows-model'
import { TypeScriptModuleResolution } from 'projen/lib/javascript'

const project = new (class extends GithubAction {
  override preSynthesize() {
    super.preSynthesize()
    this.addGitIgnore('!/dist/')
    this.package.addField('type', 'module')
    const testJob = 'test_list'
    this.release?.addJobs({
      [testJob]: {
        permissions: {
          contents: JobPermission.READ,
          idToken: JobPermission.WRITE,
        },
        runsOn: ['ubuntu-latest'],
        env: {
          CI: 'true',
        },
        steps: [
          { uses: 'actions/checkout@v3' },
          {
            name: 'Configure AWS credentials',
            uses: 'aws-actions/configure-aws-credentials@v2',
            with: {
              'role-to-assume': '${{ vars.AWS_ROLE }}',
              'aws-region': '${{ vars.AWS_REGION }}',
            },
          },
          {
            run: [
              'mkdir ${{ runner.temp }}/test/',
              'touch ${{ runner.temp }}/test/foo.bar',
            ].join('\n'),
          },
          {
            uses: './',
            with: {
              'from-local-path': '${{ runner.temp }}/test',
              'to-s3-uri': 's3://${{ vars.AWS_BUCKET }}/',
              'distribution-id': '${{ vars.AWS_DISTRIBUTION }}',
            },
          },
          {
            run: ['aws s3 rm s3://${{ vars.AWS_BUCKET }}/ --recursive'].join(
              '\n',
            ),
          },
        ],
      },
    })

    const releaseWorkflowFile = this.tryFindObjectFile(
      '.github/workflows/release.yml',
    )
    releaseWorkflowFile?.addOverride(
      'jobs.release.permissions.id-token',
      'write',
    )
    releaseWorkflowFile?.addOverride('jobs.release.needs', testJob)
    this.compileTask.reset('packemon build --loadConfigs --no-addFiles')
  }
})({
  releaseToNpm: false,
  defaultReleaseBranch: 'main',
  devDeps: [
    '@vladcos/projen-base',
    'tsconfig-paths',
    'fs-jetpack',
    'lodash',
    '@types/lodash',
    'type-fest',
    'ts-extras',
    'execa@7',
  ],
  name: '@vladcos/action-s3-cloudfront-smart-deploy',
  projenrcTs: true,
  tsconfigDev: {
    compilerOptions: {
      module: 'ES2022',
      moduleResolution: TypeScriptModuleResolution.BUNDLER,
    },
  },
  actionMetadata: {
    name: 'S3/Cloudfront Smart Invalidation -  save money on invalidations and maximize cache hits',
    description:
      'I will analyze your changed files to S3 and minimize the number of Cloudfront invalidations while maximizing cache hits',
    branding: {
      color: 'blue',
      icon: 'refresh-cw',
    },
    inputs: '@/src/schema',
    runs: {
      using: RunsUsing.NODE_16,
      main: 'dist/index.mjs',
    },
  },

  releaseWorkflowSetupSteps: [
    {
      name: 'Configure AWS credentials',
      uses: 'aws-actions/configure-aws-credentials@v2',
      with: {
        'role-to-assume': '${{ vars.AWS_ROLE }}',
        'aws-region': '${{ vars.AWS_REGION }}',
      },
    },
  ],
  entrypoint: './mjs/index.mjs',
})

project.synth()
