/**
 * Maps human-written job posting names → canonical keys in SI_ICONS_MAP (generated.ts).
 * All keys must be lowercased. Values must exactly match a key in generated.ts.
 */
export const ICON_ALIASES: Record<string, string> = {
  // ── Mobile stores ──────────────────────────────────────────────────────────
  'play store':               'googleplay',
  'google play':              'googleplay',
  'playstore':                'googleplay',
  'app store':                'appstore',
  'appstore':                 'appstore',
  'apple app store':          'appstore',
  'ios app store':            'appstore',

  // ── JetBrains IDEs ─────────────────────────────────────────────────────────
  'intellij':                 'intellijidea',
  'intellij idea':            'intellijidea',
  'pycharm':                  'pycharm',
  'webstorm':                 'webstorm',
  'goland':                   'goland',
  'clion':                    'clion',
  'phpstorm':                 'phpstorm',
  'rubymine':                 'rubymine',
  'rider':                    'rider',
  'datagrip':                 'datagrip',
  'teamcity':                 'teamcity',

  // ── Languages — short/alternate names ──────────────────────────────────────
  'js':                       'javascript',
  'ts':                       'typescript',
  'c++':                      'cplusplus',
  'cpp':                      'cplusplus',
  'c#':                       'csharp',
  'csharp':                   'csharp',
  '.net':                     'dotnet',
  'dotnet':                   'dotnet',
  'asp.net':                  'dotnet',
  'aspnet':                   'dotnet',

  // ── Frameworks ─────────────────────────────────────────────────────────────
  'react.js':                 'react',
  'reactjs':                  'react',
  'react js':                 'react',
  'vue.js':                   'vuedotjs',
  'vuejs':                    'vuedotjs',
  'vue js':                   'vuedotjs',
  'next.js':                  'nextdotjs',
  'nextjs':                   'nextdotjs',
  'next js':                  'nextdotjs',
  'nest.js':                  'nestjs',
  'nestjs':                   'nestjs',
  'nuxt.js':                  'nuxtdotjs',
  'nuxtjs':                   'nuxtdotjs',
  'express.js':               'express',
  'expressjs':                'express',
  'tailwind':                 'tailwindcss',
  'tailwind css':             'tailwindcss',

  // ── Node / Runtime ─────────────────────────────────────────────────────────
  'node':                     'nodedotjs',
  'node.js':                  'nodedotjs',
  'nodejs':                   'nodedotjs',
  'node js':                  'nodedotjs',

  // ── Databases ──────────────────────────────────────────────────────────────
  'postgres':                 'postgresql',
  'pg':                       'postgresql',
  'mongo':                    'mongodb',
  'mongo db':                 'mongodb',
  'elastic search':           'elasticsearch',
  'influx':                   'influxdb',
  'influx db':                'influxdb',

  // ── Cloud ──────────────────────────────────────────────────────────────────
  'gcp':                      'googlecloud',
  'google cloud platform':    'googlecloud',
  'google cloud':             'googlecloud',

  // ── DevOps / CI ────────────────────────────────────────────────────────────
  'k8s':                      'kubernetes',
  'gh actions':               'githubactions',
  'github actions':           'githubactions',
  'tf':                       'terraform',
  'kafka':                    'apachekafka',
  'apache kafka':             'apachekafka',
  'spark':                    'apachespark',
  'apache spark':             'apachespark',
  'airflow':                  'apacheairflow',
  'apache airflow':           'apacheairflow',

  // ── Spring ─────────────────────────────────────────────────────────────────
  'spring boot':              'springboot',
  'spring framework':         'spring',

  // ── AI / ML ────────────────────────────────────────────────────────────────
  'sklearn':                  'scikitlearn',
  'scikit learn':             'scikitlearn',
  'sci-kit learn':            'scikitlearn',
  'hf':                       'huggingface',
  'hugging face':             'huggingface',
  'colab':                    'googlecolab',
  'google colab':             'googlecolab',
  'jupyter notebook':         'jupyter',
  'jupyter lab':              'jupyter',
  'wandb':                    'weightsandbiases',
  'weights and biases':       'weightsandbiases',
  'weights & biases':         'weightsandbiases',

  // ── Editors ────────────────────────────────────────────────────────────────
  'nvim':                     'neovim',
  'sublime':                  'sublimetext',
  'sublime text':             'sublimetext',
}
