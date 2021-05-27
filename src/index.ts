import {Command, flags} from '@oclif/command'
import { searchAll } from './search'

class SimpleSignMatch extends Command {
  static description = 'Iterates over fragments and find matching chapters in the Corpus.'

  static flags = {
    version: flags.version({char: 'v'}),
    help: flags.help({char: 'h'}),
    tls: flags.boolean({char: 't', default: false}),
    skip: flags.integer({char: 's', default: 0}),
    limit: flags.integer({char: 'l', default: 5}),
  }

  static args = [{name: 'uri'}]

  async run() {
    const {args, flags} = this.parse(SimpleSignMatch)
    await searchAll(args.uri, flags.tls, flags.skip, flags.limit)
  }
}

export = SimpleSignMatch
